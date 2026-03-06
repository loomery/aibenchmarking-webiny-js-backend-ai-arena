import type { PluginCollection } from "@webiny/plugins/types.js";
import { PluginsContainer } from "@webiny/plugins/types.js";
import type { FastifyInstance, FastifyServerOptions as ServerOptions } from "fastify";
import fastify from "fastify";
import type { MiddlewareCallable } from "@webiny/utils";
import { middleware } from "@webiny/utils";
import type {
    ContextRoutes,
    DefinedContextRoutes,
    HTTPMethods,
    RouteMethod,
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
import type { CustomError } from "./stringifyError.js";
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

// All uppercase HTTP methods supported by Fastify.
const HTTP_METHODS: HTTPMethods[] = [
    "POST",
    "GET",
    "OPTIONS",
    "DELETE",
    "PATCH",
    "PUT",
    "HEAD",
    "COPY",
    "LOCK",
    "MKCOL",
    "MOVE",
    "PROPFIND",
    "PROPPATCH",
    "SEARCH",
    "TRACE",
    "UNLOCK",
    "REPORT",
    "MKCALENDAR"
];

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

const createDefinedRoutes = (): DefinedContextRoutes => {
    return Object.fromEntries(HTTP_METHODS.map(method => [method, []])) as DefinedContextRoutes;
};

// Serializes only safe, non-sensitive error fields for HTTP responses.
const toErrorResponseBody = (error: {
    message?: string;
    code?: string;
    data?: unknown;
}): string => {
    return JSON.stringify({
        message: error.message,
        code: error.code,
        data: error.data
    });
};

// Executes a list of plugins with consistent error logging and rethrow behavior.
const runPlugins = <T extends { name?: string }>(
    plugins: T[],
    pluginType: string,
    location: string,
    executor: (plugin: T) => void
): void => {
    let currentPluginName: string | undefined;
    try {
        for (const plugin of plugins) {
            currentPluginName = plugin.name;
            executor(plugin);
        }
    } catch (ex) {
        const nameLabel = currentPluginName ? ` (${currentPluginName})` : "";
        console.error(
            `Error while running the "${pluginType}"${nameLabel} plugin in the ${location}.`
        );
        console.error(stringifyError(ex as CustomError));
        throw ex;
    }
};

const modifyResponseHeaders = (
    app: FastifyInstance,
    request: Request.Interface,
    reply: Reply.Interface
): void => {
    const plugins = app.webiny.plugins.byType<ModifyResponseHeadersPlugin>(
        ModifyResponseHeadersPlugin.type
    );

    const replyHeaders = reply.getHeaders() as StandardHeaders;
    const headers = ResponseHeaders.create(replyHeaders);

    for (const plugin of plugins) {
        plugin.modify(request, headers);
    }

    // Exclude 'set-cookie' to avoid duplication; cookies are managed by @fastify/cookie.
    const headersToSet = headers.getHeaders();
    delete headersToSet["set-cookie"];

    reply.headers(headersToSet);
};

const throwOnDefinedRoute = (
    definedRoutes: DefinedContextRoutes,
    type: HTTPMethods | "ALL",
    path: string,
    options?: RouteMethodOptions
): void => {
    if (type === "ALL") {
        const conflicting = Object.keys(definedRoutes).find(key => {
            return definedRoutes[key as HTTPMethods].includes(path);
        });

        if (!conflicting) {
            return;
        }

        console.error(
            "Error while registering onAll route. One of the routes is already defined."
        );
        console.error(JSON.stringify(conflicting));
        throw new WebinyError(
            "You cannot override a route with onAll() method, please remove unnecessary route from the system.",
            "OVERRIDE_ROUTE_ERROR",
            { type, path }
        );
    }

    if (!definedRoutes[type].includes(path) || options?.override === true) {
        return;
    }

    console.error(`Error while trying to override route: [${type}] ${path}`);
    throw new WebinyError(
        'When you are trying to override existing route, you must send "override" parameter when adding that route.',
        "OVERRIDE_ROUTE_ERROR",
        { type, path }
    );
};

const addDefinedRoute = (
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

const createRouteHelpers = (
    app: FastifyInstance,
    definedRoutes: DefinedContextRoutes
): ContextRoutes => {
    const route = (method: HTTPMethods): RouteMethod => {
        return (path, handler, options) => {
            throwOnDefinedRoute(definedRoutes, method, path, options);
            const fastifyMethod = method.toLowerCase() as Lowercase<HTTPMethods>;
            (app[fastifyMethod] as typeof app.all)(path, handler);
        };
    };

    return {
        defined: definedRoutes,
        onPost: route("POST"),
        onGet: route("GET"),
        onOptions: route("OPTIONS"),
        onDelete: route("DELETE"),
        onPatch: route("PATCH"),
        onPut: route("PUT"),
        onAll: (path, handler, options) => {
            throwOnDefinedRoute(definedRoutes, "ALL", path, options);
            app.all(path, handler);
        },
        onHead: route("HEAD")
    };
};

const registerFastifyPlugins = (app: FastifyInstance): void => {
    // @fastify/cookie - https://github.com/fastify/fastify-cookie
    app.register(fastifyCookie, { parseOptions: {} });

    // @fastify/compress - https://github.com/fastify/fastify-compress
    app.register(fastifyCompress, {
        global: true,
        threshold: 1024,
        onUnsupportedEncoding: (encoding, _, reply) => {
            reply.code(406);
            return `We do not support the ${encoding} encoding.`;
        },
        inflateIfDeflated: true
    });
};

const registerContentTypeParser = (app: FastifyInstance): void => {
    // Custom JSON parser to prevent Unsupported Media Type errors on OPTIONS requests with a body.
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

    // Clear content-type on OPTIONS requests with undefined body to avoid unnecessary parsing.
    // @see https://fastify.dev/docs/latest/Reference/ContentTypeParser/#content-type-parser
    app.addHook("onRequest", async request => {
        if (request.method === "OPTIONS" && request.body === undefined) {
            request.headers["content-type"] = undefined;
        }
    });
};

const registerPreHandler = (app: FastifyInstance, definedRoutes: DefinedContextRoutes): void => {
    app.addHook("preHandler", async (request, reply) => {
        app.webiny.request = request;
        app.webiny.reply = reply;

        // Bind request and reply to DI container for runtime access.
        if (app.webiny.container) {
            app.webiny.container.registerInstance(Request, request);
            app.webiny.container.registerInstance(Reply, reply);
        }

        // Default to 200; errors are set explicitly via reply.send.
        reply.code(200);

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

        const preHandler = new PreHandler([
            new SetDefaultHeaders(definedRoutes),
            new ProcessHandlerOnRequestPlugins(handlerOnRequestPlugins),
            new IfNotOptionsRequest([
                new ProcessContextPlugins(app.webiny, contextPlugins),
                new ProcessBeforeHandlerPlugins(app.webiny, beforeHandlerPlugins)
            ]),
            new IfOptionsRequest([new SendEarlyOptionsResponse(modifyHeadersPlugins)])
        ]);

        await preHandler.execute(request, reply, app.webiny);
    });
};

const registerPreSerialization = (app: FastifyInstance): void => {
    app.addHook("preSerialization", async (_, __, payload) => {
        const plugins = app.webiny.plugins.byType<HandlerResultPlugin>(HandlerResultPlugin.type);
        let currentPluginName: string | undefined;
        try {
            for (const plugin of plugins) {
                currentPluginName = plugin.name;
                await plugin.handle(app.webiny, payload);
            }
        } catch (ex) {
            const nameLabel = currentPluginName ? ` (${currentPluginName})` : "";
            console.error(
                `Error while running the "HandlerResultPlugin"${nameLabel} plugin in the preSerialization hook.`
            );
            console.error(stringifyError(ex as CustomError));
            throw ex;
        }
        return payload;
    });
};

const registerErrorHandler = (app: FastifyInstance): void => {
    app.setErrorHandler<WebinyError>(async (error, _, reply) => {
        if (reply.sent) {
            console.warn("Reply already sent, cannot send the result (handler:setErrorHandler).");
            return reply;
        }

        if (error.code?.startsWith("Authentication/")) {
            return reply
                .status(401)
                .headers(NO_STORE_HEADERS)
                .send(toErrorResponseBody(error));
        }

        if (error.code === "Tenancy/TenantDisabled") {
            return reply
                .status(503)
                .headers(NO_STORE_HEADERS)
                .send(toErrorResponseBody(error));
        }

        return reply.status(500).headers(NO_STORE_HEADERS).send(toErrorResponseBody(error));
    });
};

const registerOnErrorHook = (app: FastifyInstance): void => {
    app.addHook("onError", async (_, reply, error: any) => {
        const plugins = app.webiny.plugins.byType<HandlerErrorPlugin>(HandlerErrorPlugin.type);

        // Log error to cloud, as these can be extremely annoying to debug.
        console.error("Logging error in @webiny/handler");
        try {
            console.error(stringifyError(error));
        } catch (ex) {
            console.warn("Could not stringify error:");
            console.log(error);
            console.error("Stringify error:", ex);
        }

        if (!reply.sent) {
            reply.status(500).headers(NO_STORE_HEADERS).send(toErrorResponseBody(error));
        } else {
            console.warn("Reply already sent, cannot send the result (handler:addHook:onError).");
        }

        const handler = middleware(
            plugins.map(pl => {
                return (context: Context, error: Error, next: MiddlewareCallable) => {
                    return pl.handle(context, error, next);
                };
            })
        );
        await handler(app.webiny, error);

        return reply;
    });
};

const registerOnSendHook = (app: FastifyInstance): void => {
    app.addHook("onSend", async (request, reply, input) => {
        modifyResponseHeaders(app, request, reply);
        const plugins = app.webiny.plugins.byType<OnRequestResponseSendPlugin>(
            OnRequestResponseSendPlugin.type
        );
        let payload = input;
        for (const plugin of plugins) {
            payload = await plugin.exec(request, reply, payload);
        }
        return payload;
    });
};

const registerLifecycleHooks = (app: FastifyInstance, context: Context): void => {
    // Output benchmark results at the end of the request.
    app.addHook("onResponse", async () => {
        await context.benchmark.output();
    });

    app.addHook("onTimeout", async (request, reply) => {
        const plugins = app.webiny.plugins.byType<OnRequestTimeoutPlugin>(
            OnRequestTimeoutPlugin.type
        );
        for (const plugin of plugins) {
            await plugin.exec(request, reply);
        }
        await context.benchmark.output();
    });
};

const applyModifyFastifyPlugins = (app: FastifyInstance): void => {
    const plugins = app.webiny.plugins.byType<ModifyFastifyPlugin>(ModifyFastifyPlugin.type);
    runPlugins(plugins, "ModifyFastifyPlugin", 'end of the "createHandler" callable', plugin => {
        plugin.modify(app);
    });
};

const applyRoutePlugins = (app: FastifyInstance): void => {
    const plugins = app.webiny.plugins.byType<RoutePlugin>(RoutePlugin.type);
    runPlugins(
        plugins,
        "RoutePlugin",
        'beginning of the "createHandler" callable',
        plugin => {
            plugin.cb({
                ...app.webiny.routes,
                context: app.webiny
            });
        }
    );
};

const createContext = (
    paramPlugins: PluginCollection | PluginsContainer,
    routes: ContextRoutes
): Context => {
    const plugins = new PluginsContainer([
        // handlerClient must be one of the first context plugins applied.
        createHandlerClient()
    ]);
    plugins.merge(paramPlugins || []);

    try {
        return new Context({
            plugins,
            WEBINY_VERSION: process.env.WEBINY_VERSION as string,
            routes
        });
    } catch (ex) {
        console.error("Error while constructing the Context.");
        console.error(stringifyError(ex as CustomError));
        throw ex;
    }
};

export interface CreateHandlerParams {
    plugins: PluginCollection | PluginsContainer;
    options?: ServerOptions;
    debug?: boolean;
}

export const createHandler = (params: CreateHandlerParams) => {
    const definedRoutes = createDefinedRoutes();

    const app = fastify({
        bodyLimit: 536870912, // 512MB.
        disableRequestLogging: true,
        allowErrorHandlerOverride: true,
        ...(params.options || {})
    });

    // Track defined routes to output headers and disallow route overriding.
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

    registerFastifyPlugins(app);

    const routes = createRouteHelpers(app, definedRoutes);
    const context = createContext(params.plugins, routes);
    app.decorate("webiny", context);

    registerContentTypeParser(app);
    registerPreHandler(app, definedRoutes);
    registerPreSerialization(app);
    registerErrorHandler(app);
    registerOnErrorHook(app);
    registerOnSendHook(app);
    registerLifecycleHooks(app, context);

    applyModifyFastifyPlugins(app);
    applyRoutePlugins(app);

    return app;
};
