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
            // This is a placeholder - in reality, we do soft deletes via update
            // This method won't actually be called based on our CRUD implementation
            throw new WebinyError(
                "Direct delete is not supported. Use update with deletedOn field.",
                "DELETE_NOT_SUPPORTED"
            );
        },

        async get(model: CmsModel, id: string): Promise<CmsEntryComment | null> {
            // Since we don't know entryId here, we need to use a different query approach
            // For now, we'll use a GSI or scan. Let's use query with just SK for simplicity
            // In production, this would need proper indexing

            try {
                // This is a simplified approach - in production we'd need a GSI on comment ID
                // For now, we'll throw an error indicating the limitation
                throw new WebinyError(
                    "Get by ID requires entryId context. Use list with entryId filter.",
                    "GET_BY_ID_NOT_IMPLEMENTED"
                );
            } catch (error) {
                if (error.code === "GET_BY_ID_NOT_IMPLEMENTED") {
                    throw error;
                }
                throw new WebinyError(
                    error.message || "Could not get comment from DynamoDB.",
                    error.code || "GET_COMMENT_ERROR",
                    {
                        error,
                        id
                    }
                );
            }
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
                partitions: [
                    {
                        PK: createPartitionKey({ entryId }),
                        SK: { $beginsWith: "COMMENT#" }
                    }
                ],
                options: {
                    limit
                }
            };

            if (after) {
                const cursor = decodeCursor(after);
                if (cursor) {
                    queryParams.options = {
                        ...queryParams.options,
                        gt: cursor.id
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

                const cursor =
                    items.length > 0 ? encodeCursor({ id: items[items.length - 1].id }) : null;

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
