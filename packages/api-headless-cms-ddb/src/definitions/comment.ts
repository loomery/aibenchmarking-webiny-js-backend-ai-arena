import type { Table } from "@webiny/db-dynamodb/toolbox.js";
import { Entity } from "@webiny/db-dynamodb/toolbox.js";
import type { Attributes } from "~/types.js";

interface Params {
    table: Table<string, string, string>;
    entityName: string;
    attributes: Attributes;
}

export const createCommentEntity = (params: Params): Entity<any> => {
    const { entityName, attributes, table } = params;
    return new Entity({
        name: entityName,
        table,
        attributes: {
            PK: {
                partitionKey: true
            },
            SK: {
                sortKey: true
            },
            id: {
                type: "string"
            },
            entryId: {
                type: "string"
            },
            modelId: {
                type: "string"
            },
            parentId: {
                type: "string"
            },
            body: {
                type: "string"
            },
            author: {
                type: "map"
            },
            mentions: {
                type: "list"
            },
            createdOn: {
                type: "string"
            },
            updatedOn: {
                type: "string"
            },
            ...(attributes || {})
        }
    });
};
