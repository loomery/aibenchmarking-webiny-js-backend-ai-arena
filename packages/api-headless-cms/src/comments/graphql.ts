import { CmsContext } from "~/types/index.js";
import { createCmsGraphQLSchemaPlugin } from "~/plugins/index.js";

export const createCommentsGraphQL = () => {
    return createCmsGraphQLSchemaPlugin<CmsContext>({
        typeDefs: /* GraphQL */ `
            type CmsCommentAuthor {
                id: String
                displayName: String
                type: String
            }

            type CmsComment {
                id: ID!
                entryId: ID!
                modelId: ID!
                parentId: ID
                body: String!
                mentions: [String]
                author: CmsCommentAuthor
                createdOn: String!
                updatedOn: String
            }

            input CmsCommentCreateInput {
                entryId: ID!
                modelId: ID!
                parentId: ID
                body: String!
                mentions: [String]
            }

            input CmsCommentUpdateInput {
                body: String!
                mentions: [String]
            }

            extend type Query {
                getComment(id: ID!, entryId: ID!, modelId: ID!): CmsComment
                listComments(entryId: ID!, modelId: ID!): [CmsComment]
            }

            extend type Mutation {
                createComment(data: CmsCommentCreateInput!): CmsComment
                updateComment(
                    id: ID!
                    entryId: ID!
                    modelId: ID!
                    data: CmsCommentUpdateInput!
                ): CmsComment
                deleteComment(id: ID!, entryId: ID!, modelId: ID!): Boolean
            }
        `,
        resolvers: {
            Query: {
                getComment: async (_, { id, entryId, modelId }, context) => {
                    return context.cms.getComment(id, entryId, modelId);
                },
                listComments: async (_, { entryId, modelId }, context) => {
                    return context.cms.listComments(entryId, modelId);
                }
            },
            Mutation: {
                createComment: async (_, { data }, context) => {
                    return context.cms.createComment(data);
                },
                updateComment: async (_, { id, entryId, modelId, data }, context) => {
                    return context.cms.updateComment(id, entryId, modelId, data);
                },
                deleteComment: async (_, { id, entryId, modelId }, context) => {
                    return context.cms.deleteComment(id, entryId, modelId);
                }
            }
        }
    });
};
