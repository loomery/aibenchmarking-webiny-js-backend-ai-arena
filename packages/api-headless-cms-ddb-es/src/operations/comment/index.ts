import type {
    CmsComment,
    CmsCommentStorageOperations
} from "@webiny/api-headless-cms/types/index.js";
import type { Entity } from "@webiny/db-dynamodb/toolbox.js";
import WebinyError from "@webiny/error";
import { getClean } from "@webiny/db-dynamodb/utils/get.js";
import { put, deleteItem, queryAll } from "@webiny/db-dynamodb";

interface CreateCommentStorageOperationsParams {
    entity: Entity<any>;
}

interface PartitionKeyParams {
    tenant: string;
    entryId: string;
    modelId: string;
}

const createPartitionKey = ({ tenant, entryId, modelId }: PartitionKeyParams): string => {
    return `T#${tenant}#CMS#MODEL#${modelId}#ENTRY#${entryId}#COMMENTS`;
};

const createSortKey = (id: string): string => {
    return id;
};

export const createCommentStorageOperations = (
    params: CreateCommentStorageOperationsParams
): CmsCommentStorageOperations => {
    const { entity } = params;

    const create = async (comment: CmsComment) => {
        const pk = createPartitionKey({
            tenant: comment.tenant,
            entryId: comment.entryId,
            modelId: comment.modelId
        });
        const sk = createSortKey(comment.id);

        try {
            await put({
                entity,
                item: {
                    ...comment,
                    PK: pk,
                    SK: sk
                }
            });
            return comment;
        } catch (ex) {
            throw new WebinyError(
                ex.message || "Could not create comment.",
                ex.code || "CREATE_COMMENT_ERROR",
                {
                    error: ex,
                    comment
                }
            );
        }
    };

    const update = async (comment: CmsComment) => {
        const pk = createPartitionKey({
            tenant: comment.tenant,
            entryId: comment.entryId,
            modelId: comment.modelId
        });
        const sk = createSortKey(comment.id);

        try {
            await put({
                entity,
                item: {
                    ...comment,
                    PK: pk,
                    SK: sk
                }
            });
            return comment;
        } catch (ex) {
            throw new WebinyError(
                ex.message || "Could not update comment.",
                ex.code || "UPDATE_COMMENT_ERROR",
                {
                    error: ex,
                    comment
                }
            );
        }
    };

    const get = async (params: {
        id: string;
        entryId: string;
        modelId: string;
        tenant: string;
    }) => {
        const pk = createPartitionKey({
            tenant: params.tenant,
            entryId: params.entryId,
            modelId: params.modelId
        });
        const sk = createSortKey(params.id);

        try {
            return await getClean<CmsComment>({
                entity,
                keys: {
                    PK: pk,
                    SK: sk
                }
            });
        } catch (ex) {
            throw new WebinyError(
                ex.message || "Could not get comment.",
                ex.code || "GET_COMMENT_ERROR",
                {
                    error: ex,
                    params
                }
            );
        }
    };

    const list = async (params: { entryId: string; modelId: string; tenant: string }) => {
        const pk = createPartitionKey({
            tenant: params.tenant,
            entryId: params.entryId,
            modelId: params.modelId
        });

        try {
            const items = await queryAll<CmsComment>({
                entity,
                partitionKey: pk,
                options: {
                    gte: " "
                }
            });
            return items;
        } catch (ex) {
            throw new WebinyError(
                ex.message || "Could not list comments.",
                ex.code || "LIST_COMMENTS_ERROR",
                {
                    error: ex,
                    params
                }
            );
        }
    };

    const deleteComment = async (params: {
        id: string;
        entryId: string;
        modelId: string;
        tenant: string;
    }) => {
        const pk = createPartitionKey({
            tenant: params.tenant,
            entryId: params.entryId,
            modelId: params.modelId
        });
        const sk = createSortKey(params.id);

        try {
            await deleteItem({
                entity,
                keys: {
                    PK: pk,
                    SK: sk
                }
            });
            return true;
        } catch (ex) {
            throw new WebinyError(
                ex.message || "Could not delete comment.",
                ex.code || "DELETE_COMMENT_ERROR",
                {
                    error: ex,
                    params
                }
            );
        }
    };

    return {
        create,
        update,
        get,
        list,
        delete: deleteComment
    };
};
