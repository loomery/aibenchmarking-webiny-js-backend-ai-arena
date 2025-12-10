import type { Table } from "@webiny/db-dynamodb/toolbox.js";
import { Entity } from "@webiny/db-dynamodb/toolbox.js";
import type { Attributes } from "~/types.js";

interface Params {
    table: Table<string, string, string>;
    entityName: string;
    attributes: Attributes;
}

export const createCommentEntity = (params: Params): Entity<any> => {
    const { table, entityName, attributes } = params;

    return new Entity({
        name: entityName,
        table,
        attributes: {
            PK: {
                type: "string",
                partitionKey: true
            },
            SK: {
                type: "string",
                sortKey: true
            },
            GSI1_PK: {
                type: "string"
            },
            GSI1_SK: {
                type: "string"
            },
            tenant: {
                type: "string"
            },
            locale: {
                type: "string"
            },
            modelId: {
                type: "string"
            },
            entryId: {
                type: "string"
            },
            id: {
                type: "string"
            },
            parentId: {
                type: "string"
            },
            threadId: {
                type: "string"
            },
            body: {
                type: "string"
            },
            mentions: {
                type: "list"
            },
            createdOn: {
                type: "string"
            },
            createdBy: {
                type: "map"
            },
            updatedOn: {
                type: "string"
            },
            updatedBy: {
                type: "map"
            },
            ...(attributes || {})
        }
    });
};
