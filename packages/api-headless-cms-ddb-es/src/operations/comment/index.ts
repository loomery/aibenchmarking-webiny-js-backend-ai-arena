import WebinyError from "@webiny/error";
import type {
    CmsEntryComment,
    CmsEntryCommentListParams,
    CmsModel
} from "@webiny/api-headless-cms/types/index.js";
import type { Entity } from "@webiny/db-dynamodb/toolbox.js";
import type { CmsEntryCommentStorageOperations } from "~/types.js";
import { cleanupItems, queryAll } from "@webiny/db-dynamodb";
import type { QueryAllParams } from "@webiny/db-dynamodb";
import { decodeCursor, encodeCursor } from "@webiny/utils/cursor.js";

const createType = (): string => {
    return "cms.entry.comment";
};

const createPartitionKey = (params: { entryId: string }): string => {
    const { entryId } = params;
    return `COMMENT#ENTRY#${entryId}`;
};

const createSortKey = (id: string): string => {
    return `COMMENT#${id}`;
};

export interface CreateCommentsStorageOperationsParams {
    entity: Entity<any>;
}

export const createCommentsStorageOperations = (
    params: CreateCommentsStorageOperationsParams
): CmsEntryCommentStorageOperations => {
    const { entity } = params;

    return {
        async create(model: CmsModel, comment: CmsEntryComment): Promise<CmsEntryComment> {
            const keys = {
                PK: createPartitionKey({ entryId: comment.entryId }),
                SK: createSortKey(comment.id)
            };

            try {
                await entity.put({
                    ...comment,
                    TYPE: createType(),
                    ...keys
                });

                return comment;
            } catch (error) {
                throw new WebinyError(
                    error.message || "Could not create comment in DynamoDB.",
                    error.code || "CREATE_COMMENT_ERROR",
                    {
                        error,
                        comment
                    }
                );
            }
        },

        async update(model: CmsModel, comment: CmsEntryComment): Promise<CmsEntryComment> {
            const keys = {
                PK: createPartitionKey({ entryId: comment.entryId }),
                SK: createSortKey(comment.id)
            };

            try {
                await entity.put({
                    ...comment,
                    TYPE: createType(),
                    ...keys
                });

                return comment;
            } catch (error) {
                throw new WebinyError(
                    error.message || "Could not update comment in DynamoDB.",
                    error.code || "UPDATE_COMMENT_ERROR",
                    {
                        error,
                        comment
                    }
                );
            }
        },

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        async delete(model: CmsModel, id: string): Promise<boolean> {
            throw new WebinyError(
                "Direct delete is not supported. Use update with deletedOn field.",
                "DELETE_NOT_SUPPORTED"
            );
        },

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        async get(model: CmsModel, id: string): Promise<CmsEntryComment | null> {
            throw new WebinyError(
                "Get by ID requires entryId context. Use list with entryId filter.",
                "GET_BY_ID_NOT_IMPLEMENTED"
            );
        },

        async list(
            model: CmsModel,
            params: CmsEntryCommentListParams
        ): Promise<{
            items: CmsEntryComment[];
            cursor: string | null;
            hasMoreItems: boolean;
            totalCount: number;
        }> {
            const { entryId, parentId, limit = 100, after, includeDeleted = false } = params;

            if (!entryId) {
                throw new WebinyError(
                    "entryId is required for listing comments.",
                    "ENTRY_ID_REQUIRED"
                );
            }

            const queryParams: QueryAllParams = {
                entity,
                partitionKey: createPartitionKey({ entryId }),
                options: {
                    beginsWith: "COMMENT#",
                    limit
                }
            };

            if (after) {
                const cursor = decodeCursor(after) as string;
                if (cursor) {
                    queryParams.options = {
                        ...queryParams.options,
                        gt: cursor
                    };
                }
            }

            try {
                const results = await queryAll<CmsEntryComment>(queryParams);
                let items = cleanupItems(entity, results);

                // Filter by parentId if specified
                if (parentId !== undefined) {
                    items = items.filter(item => item.parentId === parentId);
                }

                // Filter out deleted comments unless explicitly requested
                if (!includeDeleted) {
                    items = items.filter(item => !item.deletedOn);
                }

                // Apply limit
                const hasMoreItems = items.length > limit;
                if (hasMoreItems) {
                    items = items.slice(0, limit);
                }

                const cursor = items.length > 0 ? encodeCursor(items[items.length - 1].id) : null;

                return {
                    items,
                    cursor,
                    hasMoreItems,
                    totalCount: items.length
                };
            } catch (error) {
                throw new WebinyError(
                    error.message || "Could not list comments from DynamoDB.",
                    error.code || "LIST_COMMENTS_ERROR",
                    {
                        error,
                        params
                    }
                );
            }
        }
    };
};
