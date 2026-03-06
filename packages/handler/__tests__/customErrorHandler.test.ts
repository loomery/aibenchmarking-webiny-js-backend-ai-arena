import { describe, it, expect } from "vitest";
import { createHandler } from "~/fastify";
import { createRoute } from "~/plugins/RoutePlugin";
import WebinyError from "@webiny/error";
import { createModifyFastifyPlugin } from "~/plugins/ModifyFastifyPlugin";

describe("custom error handler", () => {
    const data = {
        stringValue: "123",
        numberValue: 123,
        booleanValue: false,
        arrayValue: ["123", 123, false],
        objectValue: {
            testing: true,
            errorMessage: "not ok"
        }
    };

    it("should properly output error via built-in error handler", async () => {
        const app = createHandler({
            plugins: [
                createRoute(({ onAll }) => {
                    onAll("/webiny-test", async () => {
                        throw new WebinyError(
                            "Testing custom error handler output",
                            "CUSTOM_ERROR_HANDLER_CODE",
                            data
                        );
                    });
                })
            ]
        });

        const result = await app.inject({
            path: "/webiny-test",
            headers: {
                "content-type": "application/json"
            },
            method: "POST",
            payload: "{}"
        });

        const expected = JSON.stringify({
            message: "Testing custom error handler output",
            code: "CUSTOM_ERROR_HANDLER_CODE",
            data: {
                stringValue: "123",
                numberValue: 123,
                booleanValue: false,
                arrayValue: ["123", 123, false],
                objectValue: {
                    testing: true,
                    errorMessage: "not ok"
                }
            }
        });

        expect(result).toMatchObject({
            payload: expected,
            body: expected,
            statusCode: 500
        });
    });

    it("should properly output error via user defined error handler", async () => {
        const app = createHandler({
            plugins: [
                createModifyFastifyPlugin(instance => {
                    instance.setErrorHandler((error, request, reply) => {
                        return reply
                            .send({
                                justSimpleOutput: true
                            })
                            .code(404);
                    });
                }),
                createRoute(({ onAll }) => {
                    onAll("/webiny-test", async () => {
                        throw new WebinyError(
                            "Testing custom error handler output",
                            "CUSTOM_ERROR_HANDLER_CODE",
                            data
                        );
                    });
                })
            ]
        });

        const result = await app.inject({
            path: "/webiny-test",
            headers: {
                "content-type": "application/json"
            },
            method: "GET",
            payload: "{}"
        });

        const expected = JSON.stringify({
            justSimpleOutput: true
        });

        expect(result).toMatchObject({
            payload: expected,
            body: expected,
            statusCode: 404
        });
    });

    it("should keep auth and tenant errors sanitized with no-store caching policy", async () => {
        const app = createHandler({
            plugins: [
                createRoute(({ onAll }) => {
                    onAll("/auth-error", async () => {
                        throw new WebinyError(
                            "Not authenticated",
                            "Authentication/NotAuthenticated",
                            data
                        );
                    });

                    onAll("/tenant-error", async () => {
                        throw new WebinyError("Tenant disabled", "Tenancy/TenantDisabled", data);
                    });
                })
            ]
        });

        const authResult = await app.inject({
            path: "/auth-error",
            headers: {
                "content-type": "application/json"
            },
            method: "GET",
            payload: "{}"
        });

        expect(authResult).toMatchObject({
            statusCode: 401,
            headers: {
                "cache-control": "no-store"
            },
            payload: JSON.stringify({
                message: "Not authenticated",
                code: "Authentication/NotAuthenticated"
            })
        });

        const tenantResult = await app.inject({
            path: "/tenant-error",
            headers: {
                "content-type": "application/json"
            },
            method: "GET",
            payload: "{}"
        });

        expect(tenantResult).toMatchObject({
            statusCode: 503,
            headers: {
                "cache-control": "no-store"
            },
            payload: JSON.stringify({
                message: "Tenant disabled",
                code: "Tenancy/TenantDisabled"
            })
        });
    });
});
