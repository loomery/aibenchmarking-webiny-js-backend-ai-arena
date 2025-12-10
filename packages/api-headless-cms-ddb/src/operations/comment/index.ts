import WebinyError from "@webiny/error";
import type { Entity } from "@webiny/db-dynamodb/toolbox.js";
import type { QueryAllParams, QueryOneParams } from "@webiny/db-dynamodb";
import { queryAll, queryOne } from "@webiny/db-dynamodb";
import { cleanupItem, cleanupItems } from "@webiny/db-dynamodb/utils/cleanup.js";
import type {
    CmsEntryComment,
    CmsEntryCommentStorageOperations
} from "@webiny/api-headless-cms/types/index.js";

interface CreateCommentsStorageOperationsParams {
    entity: Entity<any>;
}

type CommentRecord = CmsEntryComment & {
    PK: string;
    SK: string;
    GSI1_PK: string;
    GSI1_SK: string;
};

const createPartitionKey = (
    params: Pick<CmsEntryComment, "tenant" | "locale" | "entryId">
): string => {
    return `T#${params.tenant}#L#${params.locale}#CMS#CMC#${params.entryId}`;
};

const createSortKey = (comment: CmsEntryComment): string => {
    return `COMMENT#${comment.createdOn}#${comment.id}`;
};

const createGsiPartitionKey = (commentId: string) => {
    return `COMMENT#${commentId}`;
};

const createGsiSortKey = (comment: CmsEntryComment) => {
    return comment.entryId;
};

const createRecord = (comment: CmsEntryComment): CommentRecord => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { replies, ...rest } = comment;
    return {
        ...rest,
        PK: createPartitionKey(rest),
        SK: createSortKey(rest),
        GSI1_PK: createGsiPartitionKey(rest.id),
        GSI1_SK: createGsiSortKey(rest)
    } as CommentRecord;
};

export const createCommentsStorageOperations = (
    params: CreateCommentsStorageOperationsParams
): CmsEntryCommentStorageOperations => {
    const { entity } = params;

    const list: CmsEntryCommentStorageOperations["list"] = async params => {
        const { tenant, locale, entryId } = params;
        const queryAllParams: QueryAllParams = {
            entity,
            partitionKey: createPartitionKey({ tenant, locale, entryId }),
            options: {
                gte: " "
            }
        };

        try {
            const records = await queryAll<CommentRecord>(queryAllParams);
            return cleanupItems(entity, records) as CmsEntryComment[];
        } catch (ex) {
            throw new WebinyError(ex.message, "LIST_COMMENTS_ERROR", {
                partitionKey: queryAllParams.partitionKey,
                error: {
                    message: ex.message,
                    code: ex.code,
                    data: ex.data
                }
            });
        }
    };

    const get: CmsEntryCommentStorageOperations["get"] = async params => {
        const queryOneParams: QueryOneParams = {
            entity,
            partitionKey: createGsiPartitionKey(params.id),
            options: {
                index: "GSI1"
            }
        };

        try {
            const record = await queryOne<CommentRecord>(queryOneParams);
            if (!record) {
                return null;
            }
            return cleanupItem(entity, record) as CmsEntryComment;
        } catch (ex) {
            throw new WebinyError(ex.message, "GET_COMMENT_ERROR", {
                partitionKey: queryOneParams.partitionKey,
                error: {
                    message: ex.message,
                    code: ex.code,
                    data: ex.data
                }
            });
        }
    };

    const create: CmsEntryCommentStorageOperations["create"] = async params => {
        const record = createRecord(params.comment);

        try {
            await entity.put(record);
        } catch (ex) {
            throw new WebinyError(ex.message, "CREATE_COMMENT_ERROR", {
                comment: params.comment
            });
        }

        return cleanupItem(entity, record) as CmsEntryComment;
    };

    const update: CmsEntryCommentStorageOperations["update"] = async params => {
        const record = createRecord(params.comment);

        try {
            await entity.put(record);
        } catch (ex) {
            throw new WebinyError(ex.message, "UPDATE_COMMENT_ERROR", {
                comment: params.comment
            });
        }

        return cleanupItem(entity, record) as CmsEntryComment;
    };

    const remove: CmsEntryCommentStorageOperations["delete"] = async params => {
        const { comment } = params;
        try {
            await entity.delete({
                PK: createPartitionKey(comment),
                SK: createSortKey(comment)
            });
        } catch (ex) {
            throw new WebinyError(ex.message, "DELETE_COMMENT_ERROR", {
                comment
            });
        }
    };

    return {
        list,
        get,
        create,
        update,
        delete: remove
    };
};
