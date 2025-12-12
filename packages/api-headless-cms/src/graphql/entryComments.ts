import {
    ErrorResponse,
    GraphQLSchemaPlugin,
    ListResponse,
    Response
} from "@webiny/handler-graphql";
import type { CmsContext } from "~/types/index.js";
import type {
    CmsEntryCommentListParams,
    CreateCmsEntryCommentInput,
    UpdateCmsEntryCommentInput
} from "~/types/index.js";

const plugin = new GraphQLSchemaPlugin<CmsContext>({
    typeDefs: /* GraphQL */ `
        type CmsEntryComment {
            id: ID!
            entryId: ID!
            modelId: String!
            body: String!
            parentId: ID
            mentions: [String!]!
            tenant: String!
            locale: String!
            createdOn: DateTime!
            createdBy: CmsIdentity!
            modifiedOn: DateTime
            modifiedBy: CmsIdentity
            deletedOn: DateTime
            deletedBy: CmsIdentity
        }

        input CmsCreateEntryCommentInput {
            entryId: ID!
            body: String!
            parentId: ID
            mentions: [String!]
        }

        input CmsUpdateEntryCommentInput {
            body: String!
            mentions: [String!]
        }

        input CmsListEntryCommentsInput {
            entryId: ID!
            parentId: ID
            limit: Int
            after: String
            includeDeleted: Boolean
        }

        type CmsEntryCommentMeta {
            cursor: String
            hasMoreItems: Boolean!
            totalCount: Int!
        }

        type CmsEntryCommentResponse {
            data: CmsEntryComment
            error: CmsError
        }

        type CmsEntryCommentListResponse {
            data: [CmsEntryComment!]
            meta: CmsEntryCommentMeta
            error: CmsError
        }

        type CmsEntryCommentDeleteResponse {
            data: Boolean
            error: CmsError
        }

        # Define CmsQuery and CmsMutation if they don't exist yet
        type CmsQuery {
            _empty: String
        }

        type CmsMutation {
            _empty: String
        }

        extend type CmsQuery {
            # Get a single comment by ID
            getEntryComment(modelId: ID!, id: ID!): CmsEntryCommentResponse
            # List comments for an entry
            listEntryComments(
                modelId: ID!
                where: CmsListEntryCommentsInput!
            ): CmsEntryCommentListResponse
        }

        extend type CmsMutation {
            # Create a comment on an entry
            createEntryComment(
                modelId: ID!
                data: CmsCreateEntryCommentInput!
            ): CmsEntryCommentResponse
            # Update a comment
            updateEntryComment(
                modelId: ID!
                id: ID!
                data: CmsUpdateEntryCommentInput!
            ): CmsEntryCommentResponse
            # Delete a comment (soft delete)
            deleteEntryComment(modelId: ID!, id: ID!): CmsEntryCommentDeleteResponse
        }
    `,
    resolvers: {
        CmsQuery: {
            getEntryComment: async (
                _: any,
                args: { modelId: string; id: string },
                context: CmsContext
            ) => {
                try {
                    const model = await context.cms.getModel(args.modelId);
                    if (!model) {
                        return new ErrorResponse({
                            code: "MODEL_NOT_FOUND",
                            message: `Model "${args.modelId}" not found.`
                        });
                    }

                    const comment = await context.cms.getEntryComment(model, args.id);
                    return new Response(comment);
                } catch (error) {
                    return new ErrorResponse(error);
                }
            },
            listEntryComments: async (
                _: any,
                args: { modelId: string; where: CmsEntryCommentListParams },
                context: CmsContext
            ) => {
                try {
                    const model = await context.cms.getModel(args.modelId);
                    if (!model) {
                        return new ErrorResponse({
                            code: "MODEL_NOT_FOUND",
                            message: `Model "${args.modelId}" not found.`
                        });
                    }

                    const [comments, meta] = await context.cms.listEntryComments(model, args.where);

                    return new ListResponse(comments, meta);
                } catch (error) {
                    return new ErrorResponse(error);
                }
            }
        },
        CmsMutation: {
            createEntryComment: async (
                _: any,
                args: { modelId: string; data: CreateCmsEntryCommentInput },
                context: CmsContext
            ) => {
                try {
                    const model = await context.cms.getModel(args.modelId);
                    if (!model) {
                        return new ErrorResponse({
                            code: "MODEL_NOT_FOUND",
                            message: `Model "${args.modelId}" not found.`
                        });
                    }

                    const comment = await context.cms.createEntryComment(model, args.data);
                    return new Response(comment);
                } catch (error) {
                    return new ErrorResponse(error);
                }
            },
            updateEntryComment: async (
                _: any,
                args: { modelId: string; id: string; data: UpdateCmsEntryCommentInput },
                context: CmsContext
            ) => {
                try {
                    const model = await context.cms.getModel(args.modelId);
                    if (!model) {
                        return new ErrorResponse({
                            code: "MODEL_NOT_FOUND",
                            message: `Model "${args.modelId}" not found.`
                        });
                    }

                    const comment = await context.cms.updateEntryComment(model, args.id, args.data);
                    return new Response(comment);
                } catch (error) {
                    return new ErrorResponse(error);
                }
            },
            deleteEntryComment: async (
                _: any,
                args: { modelId: string; id: string },
                context: CmsContext
            ) => {
                try {
                    const model = await context.cms.getModel(args.modelId);
                    if (!model) {
                        return new ErrorResponse({
                            code: "MODEL_NOT_FOUND",
                            message: `Model "${args.modelId}" not found.`
                        });
                    }

                    const result = await context.cms.deleteEntryComment(model, args.id);
                    return new Response(result);
                } catch (error) {
                    return new ErrorResponse(error);
                }
            }
        }
    }
});
plugin.name = "cms.graphql.schema.entryComments";

export const createEntryCommentsSchemaPlugin = () => {
    return plugin;
};
