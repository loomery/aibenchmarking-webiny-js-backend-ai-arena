import { describe, expect, it, beforeEach } from "vitest";
import { useGraphQLHandler } from "~tests/testHelpers/useGraphQLHandler";
import { articleModel } from "../lifecycleHooks/mocks/article.model";
import { CmsModelPlugin } from "~/plugins";
import type { CmsEntry } from "~/types";

describe("Entry Comments GraphQL", () => {
    let handler: any;
    let entry: CmsEntry;

    beforeEach(async () => {
        handler = useGraphQLHandler({
            plugins: [new CmsModelPlugin(articleModel)],
            path: "manage/en-US"
        });

        // Create a test entry
        const [createResponse] = await handler.createArticle({
            data: {
                title: "Test Article for Comments",
                content: "This is a test article"
            }
        });

        entry = createResponse.data.createArticle.data;
    });

    it("should create a comment via GraphQL", async () => {
        const mutation = /* GraphQL */ `
            mutation CreateEntryComment($modelId: ID!, $data: CmsCreateEntryCommentInput!) {
                cms {
                    createEntryComment(modelId: $modelId, data: $data) {
                        data {
                            id
                            entryId
                            body
                            parentId
                            mentions
                            createdOn
                            createdBy {
                                id
                                displayName
                            }
                        }
                        error {
                            message
                            code
                        }
                    }
                }
            }
        `;

        const [response] = await handler.invoke({
            body: {
                query: mutation,
                variables: {
                    modelId: "article",
                    data: {
                        entryId: entry.id,
                        body: "Test comment via GraphQL",
                        mentions: []
                    }
                }
            }
        });

        expect(response.data.cms.createEntryComment.data).toBeDefined();
        expect(response.data.cms.createEntryComment.data.body).toBe("Test comment via GraphQL");
        expect(response.data.cms.createEntryComment.data.entryId).toBe(entry.id);
        expect(response.data.cms.createEntryComment.error).toBeNull();
    });

    it("should list comments via GraphQL", async () => {
        // Create comments first
        const createMutation = /* GraphQL */ `
            mutation CreateEntryComment($modelId: ID!, $data: CmsCreateEntryCommentInput!) {
                cms {
                    createEntryComment(modelId: $modelId, data: $data) {
                        data {
                            id
                        }
                    }
                }
            }
        `;

        await handler.invoke({
            body: {
                query: createMutation,
                variables: {
                    modelId: "article",
                    data: {
                        entryId: entry.id,
                        body: "First comment",
                        mentions: []
                    }
                }
            }
        });

        await handler.invoke({
            body: {
                query: createMutation,
                variables: {
                    modelId: "article",
                    data: {
                        entryId: entry.id,
                        body: "Second comment",
                        mentions: []
                    }
                }
            }
        });

        // List comments
        const listQuery = /* GraphQL */ `
            query ListEntryComments($modelId: ID!, $where: CmsListEntryCommentsInput!) {
                cms {
                    listEntryComments(modelId: $modelId, where: $where) {
                        data {
                            id
                            body
                            entryId
                        }
                        meta {
                            totalCount
                            hasMoreItems
                        }
                        error {
                            message
                        }
                    }
                }
            }
        `;

        const [response] = await handler.invoke({
            body: {
                query: listQuery,
                variables: {
                    modelId: "article",
                    where: {
                        entryId: entry.id
                    }
                }
            }
        });

        expect(response.data.cms.listEntryComments.data).toHaveLength(2);
        expect(response.data.cms.listEntryComments.meta.totalCount).toBe(2);
    });
});
