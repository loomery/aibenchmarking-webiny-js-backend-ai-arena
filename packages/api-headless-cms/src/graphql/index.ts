import type { Plugin } from "@webiny/plugins/types.js";
import { createSystemSchemaPlugin } from "./system.js";
import type { GraphQLHandlerFactoryParams } from "./graphQLHandlerFactory.js";
import { graphQLHandlerFactory } from "./graphQLHandlerFactory.js";
import { createBaseSchema } from "~/graphql/schema/baseSchema.js";
import { createCommentsGraphQL } from "~/comments/graphql.js";

export type CreateGraphQLParams = GraphQLHandlerFactoryParams;
export const createGraphQL = (params: CreateGraphQLParams): Plugin[] => {
    return [
        createBaseSchema(),
        createCommentsGraphQL(),
        createSystemSchemaPlugin(),
        ...graphQLHandlerFactory(params)
    ];
};
