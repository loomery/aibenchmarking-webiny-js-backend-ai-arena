import type { PluginCollection } from "@webiny/plugins/types.js";
import { PluginsContainer } from "@webiny/plugins/types.js";
import type { FastifyServerOptions as ServerOptions } from "fastify";
import fastify from "fastify";
import type { MiddlewareCallable } from "@webiny/utils";
import { middleware } from "@webiny/utils";
import type {
    ContextRoutes,
    DefinedContextRoutes,
    HTTPMethods,
    RouteMethodOptions
} from "~/types.js";
import { Context } from "~/Context.js";
import WebinyError from "@webiny/error";
import { RoutePlugin } from "./plugins/RoutePlugin.js";
import { createHandlerClient } from "@webiny/handler-client";
import fastifyCookie from "@fastify/cookie";
import fastifyCompress from "@fastify/compress";
import { ContextPlugin } from "@webiny/api";
import { BeforeHandlerPlugin } from "./plugins/BeforeHandlerPlugin.js";
import { HandlerResultPlugin } from "./plugins/HandlerResultPlugin.js";
import { HandlerErrorPlugin } from "./plugins/HandlerErrorPlugin.js";
import { ModifyFastifyPlugin } from "~/plugins/ModifyFastifyPlugin.js";
import { HandlerOnRequestPlugin } from "~/plugins/HandlerOnRequestPlugin.js";
import type { StandardHeaders } from "~/ResponseHeaders.js";
import { ResponseHeaders } from "~/ResponseHeaders.js";
import { ModifyResponseHeadersPlugin } from "~/plugins/ModifyResponseHeadersPlugin.js";
import { SetDefaultHeaders } from "./PreHandler/SetDefaultHeaders.js";
import { PreHandler } from "./PreHandler/PreHandler.js";
import { stringifyError } from "./stringifyError.js";
import { ProcessHandlerOnRequestPlugins } from "./PreHandler/ProcessHandlerOnRequestPlugins.js";
import { ProcessContextPlugins } from "./PreHandler/ProcessContextPlugins.js";
import { IfNotOptionsRequest } from "./PreHandler/IfNotOptionsRequest.js";
import { ProcessBeforeHandlerPlugins } from "./PreHandler/ProcessBeforeHandlerPlugins.js";
import { IfOptionsRequest } from "./PreHandler/IfOptionsRequest.js";
import { SendEarlyOptionsResponse } from "./PreHandler/SendEarlyOptionsResponse.js";
import { OnRequestTimeoutPlugin } from "~/plugins/OnRequestTimeoutPlugin.js";
import { OnRequestResponseSendPlugin } from "~/plugins/OnRequestResponseSendPlugin.js";
import { Request } from "./abstractions/Request.js";
import { Reply } from "./abstractions/Reply.js";

/**
 * Applies each ModifyResponseHeadersPlugin to the current reply headers.
 * The 'set-cookie' header is excluded from the update to avoid duplication,
 * since cookie management is handled separately by @fastify/cookie.
 */
const modifyResponseHeaders = (
    plugins: ModifyResponseHeadersPlugin[],
    request: Request.Interface,
    reply: Reply.Interface
) => {
    const replyHeaders = reply.getHeaders() as StandardHeaders;
    const headers = ResponseHeaders.create(replyHeaders);

    plugins.forEach(plugin => {
        plugin.modify(request, headers);
    });

    // Exclude 'set-cookie' to avoid duplication — managed by @fastify/cookie.
    const headersToSet = headers.getHeaders();
    delete headersToSet["set-cookie"];

    reply.headers(headersToSet);
};

/**
 * Serialises only the safe subset of an error for inclusion in HTTP responses,
 * avoiding accidental leakage of sensitive internal details.
 */
const createErrorPayload = (error: { message?: string; code?: string; data?: any }): string => {
    return JSON.stringify({ message: error.message, code: error.code, data: error.data });
};

/**
 * Creates an empty DefinedContextRoutes map with all supported HTTP methods.
 */
export const createDefinedRoutes = (): DefinedContextRoutes => ({
    POST: [],
    GET: [],
    OPTIONS: [],
    DELETE: [],
    PATCH: [],
    PUT: [],
    HEAD: [],
    COPY: [],
    LOCK: [],
    MKCOL: [],
    MOVE: [],
    PROPFIND: [],
    PROPPATCH: [],
    SEARCH: [],
    TRACE: [],
    UNLOCK: [],
    REPORT: [],
    MKCALENDAR: []
});

/**
 * Records a route path for a given HTTP method in the definedRoutes map.
 * Duplicate registrations are silently ignored. Unknown methods (those not present
 * in the DefinedContextRoutes map) are also silently ignored to stay resilient
 * against custom or future HTTP method names that are not tracked by this system.
 */
export const addDefinedRoute = (
    definedRoutes: DefinedContextRoutes,
    input: HTTPMethods,
    path: string
): void => {
    const type = input.toUpperCase() as HTTPMethods;
    if (!definedRoutes[type] || definedRoutes[type].includes(path)) {
        return;
    }
    definedRoutes[type].push(path);
};

/**
 * Throws a WebinyError when a route is being registered that would silently override an
 * existing one, unless the caller has explicitly opted in via options.override.
 */
export const throwOnDefinedRoute = (
    definedRoutes: DefinedContextRoutes,
    type: HTTPMethods | "ALL",
    path: string,
    options?: RouteMethodOptions
): void => {
    if (type === "ALL") {
        const isAlreadyDefined = Object.values(definedRoutes).some(routes =>
            routes.includes(path)
        );
        if (!isAlreadyDefined) {
            return;
        }
        throw new WebinyError(
            `You cannot override a route with onAll() method. The path "${path}" is already registered for method "${conflictingMethod}". Remove the existing route or register this path under that specific method instead.`,
            "OVERRIDE_ROUTE_ERROR",
            { type, path }
        );
    }

    if (!definedRoutes[type].includes(path) || options?.override === true) {
        return;
    }

    throw new WebinyError(
        `The [${type}] ${path} route is already registered. To intentionally replace it, pass { override: true } in the options parameter.`,
        "OVERRIDE_ROUTE_ERROR",
        { type, path }
    );
};

export interface CreateHandlerParams {
    plugins: PluginCollection | PluginsContainer;
    options?: ServerOptions;
    debug?: boolean;
}

export const createHandler = (params: CreateHandlerParams) => {
    const definedRoutes = createDefinedRoutes();

    /**
     * We must attach the server to our internal context if we want to have it accessible.
     */
    const app = fastify({
        bodyLimit: 536870912, // 512MB
        disableRequestLogging: true,
        allowErrorHandlerOverride: true,
        ...(params.options || {})
    });

    /**
     * We need to register routes in our system to output headers later on, and disallow route overriding.
     */
    app.addHook("onRoute", route => {
        const method = route.method as HTTPMethods | HTTPMethods[];
        if (Array.isArray(method)) {
            for (const m of method) {
                addDefinedRoute(definedRoutes, m, route.path);
            }
            return;
        }
        addDefinedRoute(definedRoutes, method, route.path);
    });

    /**
     * ############################
     * Register the Fastify plugins.
     */
    /**
     * Package @fastify/cookie
     *
     * https://github.com/fastify/fastify-cookie
     */
    app.register(fastifyCookie, {
        parseOptions: {} // options for parsing cookies
    });
    /**
     * Package @fastify/compress
     *
     * https://github.com/fastify/fastify-compress
     */
    app.register(fastifyCompress, {
        global: true,
        threshold: 1024,
        onUnsupportedEncoding: (encoding, _, reply) => {
            reply.code(406);
            return `We do not support the ${encoding} encoding.`;
        },
        inflateIfDeflated: true
    });

    /**
     * Route helpers - mostly for users.
     */
    const routes: ContextRoutes = {
        defined: definedRoutes,
        onPost: (path, handler, options) => {
            throwOnDefinedRoute(definedRoutes, "POST", path, options);
            app.post(path, handler);
        },
        onGet: (path, handler, options) => {
            throwOnDefinedRoute(definedRoutes, "GET", path, options);
            app.get(path, handler);
        },
        onOptions: (path, handler, options) => {
            throwOnDefinedRoute(definedRoutes, "OPTIONS", path, options);
            app.options(path, handler);
        },
        onDelete: (path, handler, options) => {
            throwOnDefinedRoute(definedRoutes, "DELETE", path, options);
            app.delete(path, handler);
        },
        onPatch: (path, handler, options) => {
            throwOnDefinedRoute(definedRoutes, "PATCH", path, options);
            app.patch(path, handler);
        },
        onPut: (path, handler, options) => {
            throwOnDefinedRoute(definedRoutes, "PUT", path, options);
            app.put(path, handler);
        },
        onAll: (path, handler, options) => {
            throwOnDefinedRoute(definedRoutes, "ALL", path, options);
            app.all(path, handler);
        },
        onHead: (path, handler, options) => {
            throwOnDefinedRoute(definedRoutes, "HEAD", path, options);
            app.head(path, handler);
        }
    };

    const plugins = new PluginsContainer([
        /**
         * We must have handlerClient by default.
         * And it must be one of the first context plugins applied.
         */
        createHandlerClient()
    ]);
    plugins.merge(params.plugins || []);

    let context: Context;
    try {
        context = new Context({
            plugins,
            /**
             * Inserted via webpack at build time.
             */
            WEBINY_VERSION: process.env.WEBINY_VERSION as string,
            routes
        });
    } catch (ex) {
        console.error(`Error while constructing the Context.`);
        console.error(stringifyError(ex));
        throw ex;
    }

    /**
     * We are attaching our custom context to webiny variable on the fastify app, so it is accessible everywhere.
     */
    app.decorate("webiny", context);

    /**
     * To prevent Unsupported Media Type errors on OPTIONS requests with a body,
     * we need to have a custom parser
     */
    app.addContentTypeParser(
        "application/json",
        { parseAs: "string", bodyLimit: 1024 * 1024 },
        (req, body, done) => {
            if (req.method === "OPTIONS") {
                done(null, undefined);
                return;
            }

            try {
                const json = typeof body === "string" ? body : body.toString("utf8");
                done(null, JSON.parse(json));
            } catch (err) {
                done(err as Error);
            }
        }
    );

    /**
     * With this we ensure that an undefined request body is not parsed on OPTIONS requests,
     * in case there's a `content-type` header set for whatever reason.
     *
     * @see https://fastify.dev/docs/latest/Reference/ContentTypeParser/#content-type-parser
     */
    app.addHook("onRequest", async request => {
        if (request.method === "OPTIONS" && request.body === undefined) {
            request.headers["content-type"] = undefined;
        }
    });

    /**
     * Cache plugin lookups once at initialisation time to avoid repeated byType() calls
     * on every request (plugins are registered statically before any request is handled).
     */
    const handlerOnRequestPlugins = app.webiny.plugins.byType<HandlerOnRequestPlugin>(
        HandlerOnRequestPlugin.type
    );
    const contextPlugins = app.webiny.plugins.byType<ContextPlugin>(ContextPlugin.type);
    const beforeHandlerPlugins = app.webiny.plugins.byType<BeforeHandlerPlugin>(
        BeforeHandlerPlugin.type
    );
    const modifyHeadersPlugins = app.webiny.plugins.byType<ModifyResponseHeadersPlugin>(
        ModifyResponseHeadersPlugin.type
    );
    const handlerResultPlugins = app.webiny.plugins.byType<HandlerResultPlugin>(
        HandlerResultPlugin.type
    );
    const handlerErrorPlugins = app.webiny.plugins.byType<HandlerErrorPlugin>(
        HandlerErrorPlugin.type
    );
    const onSendPlugins = app.webiny.plugins.byType<OnRequestResponseSendPlugin>(
        OnRequestResponseSendPlugin.type
    );
    const onTimeoutPlugins = app.webiny.plugins.byType<OnRequestTimeoutPlugin>(
        OnRequestTimeoutPlugin.type
    );

    /**
     * Build the pre-handler pipeline once to avoid rebuilding it on every request.
     *
     * At this point, request body is properly parsed, and we can execute Webiny business logic:
     * - set default headers
     * - process `HandlerOnRequestPlugin`
     * - if OPTIONS request, exit early
     * - process `ContextPlugin`
     * - process `BeforeHandlerPlugin`
     */
    const preHandler = new PreHandler([
        new SetDefaultHeaders(definedRoutes),
        new ProcessHandlerOnRequestPlugins(handlerOnRequestPlugins),
        new IfNotOptionsRequest([
            new ProcessContextPlugins(app.webiny, contextPlugins),
            new ProcessBeforeHandlerPlugins(app.webiny, beforeHandlerPlugins)
        ]),
        new IfOptionsRequest([new SendEarlyOptionsResponse(modifyHeadersPlugins)])
    ]);

    app.addHook("preHandler", async (request, reply) => {
        app.webiny.request = request;
        app.webiny.reply = reply;

        // Bind request and reply to DI container for runtime access.
        if (app.webiny.container) {
            app.webiny.container.registerInstance(Request, request);
            app.webiny.container.registerInstance(Reply, reply);
        }

        /**
         * Default code to 200 - so we do not need to set it again.
         * Usually we set errors manually when we use reply.send.
         */
        reply.code(200);

        await preHandler.execute(request, reply, app.webiny);
    });

    app.addHook("preSerialization", async (_, __, payload) => {
        let name: string | undefined;
        try {
            for (const plugin of handlerResultPlugins) {
                name = plugin.name;
                await plugin.handle(app.webiny, payload);
            }
        } catch (ex) {
            console.error(
                `Error while running the "HandlerResultPlugin" ${
                    name ? `(${name})` : ""
                } plugin in the preSerialization hook.`
            );
            console.error(stringifyError(ex));
            throw ex;
        }
        return payload;
    });

    app.setErrorHandler<WebinyError>(async (error, _, reply) => {
        /**
         * IMPORTANT! Do not send anything if reply was already sent.
         */
        if (reply.sent) {
            console.warn("Reply already sent, cannot send the result (handler:setErrorHandler).");
            return reply;
        }

        let statusCode = 500;
        if (error.code?.startsWith("Authentication/")) {
            statusCode = 401;
        } else if (error.code === "Tenancy/TenantDisabled") {
            statusCode = 503;
        }

        /**
         * When we are sending the error in the response, we cannot send the whole error object,
         * as it might contain some sensitive data.
         */
        return reply
            .status(statusCode)
            .headers({ "Cache-Control": "no-store" })
            .send(createErrorPayload(error));
    });

    app.addHook("onError", async (_, reply, error: any) => {
        /**
         * Log error to cloud, as these can be extremely annoying to debug!
         */
        console.error("Logging error in @webiny/handler");
        try {
            console.error(stringifyError(error));
        } catch (ex) {
            console.warn("Could not stringify error:");
            console.log(error);
            console.error("Stringify error:", ex);
        }

        /**
         * IMPORTANT! Do not send anything if reply was already sent.
         * When we are sending the error in the response, we cannot send the whole error object,
         * as it might contain some sensitive data.
         */
        if (!reply.sent) {
            reply
                .status(500)
                .headers({ "Cache-Control": "no-store" })
                .send(createErrorPayload(error));
        } else {
            console.warn("Reply already sent, cannot send the result (handler:addHook:onError).");
        }

        const handler = middleware(
            handlerErrorPlugins.map(pl => {
                return (context: Context, error: Error, next: MiddlewareCallable) => {
                    return pl.handle(context, error, next);
                };
            })
        );
        await handler(app.webiny, error);

        return reply;
    });

    /**
     * Apply response headers modifier plugins.
     */
    app.addHook("onSend", async (request, reply, input) => {
        modifyResponseHeaders(modifyHeadersPlugins, request, reply);
        let payload = input;
        for (const plugin of onSendPlugins) {
            payload = await plugin.exec(request, reply, payload);
        }
        return payload;
    });

    /**
     * We need to output the benchmark results at the end of the request in both response and timeout cases.
     */
    app.addHook("onResponse", async () => {
        await context.benchmark.output();
    });

    app.addHook("onTimeout", async (request, reply) => {
        for (const plugin of onTimeoutPlugins) {
            await plugin.exec(request, reply);
        }
        await context.benchmark.output();
    });

    /**
     * With these plugins we give users possibility to do anything they want on our fastify instance.
     */
    const modifyPlugins = app.webiny.plugins.byType<ModifyFastifyPlugin>(ModifyFastifyPlugin.type);

    let modifyFastifyPluginName: string | undefined;
    try {
        for (const plugin of modifyPlugins) {
            modifyFastifyPluginName = plugin.name;
            plugin.modify(app);
        }
    } catch (ex) {
        console.error(
            `Error while running the "ModifyFastifyPlugin" ${
                modifyFastifyPluginName ? `(${modifyFastifyPluginName})` : ""
            } plugin in the end of the "createHandler" callable.`
        );
        console.error(stringifyError(ex));
        throw ex;
    }

    /**
     * We have few types of triggers:
     *  * Events - EventPlugin
     *  * Routes - RoutePlugin
     *
     * Routes are registered in fastify but events must be handled in package which implements cloud specific methods.
     */
    const routePlugins = app.webiny.plugins.byType<RoutePlugin>(RoutePlugin.type);

    /**
     * Add routes to the system.
     */
    let routePluginName: string | undefined;
    try {
        for (const plugin of routePlugins) {
            routePluginName = plugin.name;
            plugin.cb({
                ...app.webiny.routes,
                context: app.webiny
            });
        }
    } catch (ex) {
        console.error(
            `Error while running the "RoutePlugin" ${
                routePluginName ? `(${routePluginName})` : ""
            } plugin in the beginning of the "createHandler" callable.`
        );
        console.error(stringifyError(ex));
        throw ex;
    }

    return app;
};
