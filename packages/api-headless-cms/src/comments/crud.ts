import { CmsComment, CmsContext, CmsCommentContext } from "~/types/index.js";
import WebinyError from "@webiny/error";
import { mdbid } from "@webiny/utils";

export const createCommentsCrud = (context: CmsContext): CmsCommentContext => {
    const { storageOperations } = context.cms;

    const getTenant = () => {
        const tenant = context.tenancy.getCurrentTenant();
        if (!tenant) {
            throw new WebinyError("Tenant is missing.", "TENANT_MISSING");
        }
        return tenant.id;
    };

    const getIdentity = () => {
        const identity = context.security.getIdentity();
        if (!identity) {
            throw new WebinyError("Not authorized.", "NOT_AUTHORIZED");
        }
        return identity;
    };

    return {
        async getComment(id, entryId, modelId) {
            const tenant = getTenant();
            const comment = await storageOperations.comments.get({ id, entryId, modelId, tenant });
            if (!comment) {
                throw new WebinyError("Comment not found.", "COMMENT_NOT_FOUND", { id });
            }
            return comment;
        },
        async listComments(entryId, modelId) {
            const tenant = getTenant();
            return await storageOperations.comments.list({ entryId, modelId, tenant });
        },
        async createComment(input) {
            const tenant = getTenant();
            const identity = getIdentity();

            const id = mdbid();
            const comment: CmsComment = {
                ...input,
                mentions: input.mentions || [],
                id,
                tenant,
                author: identity,
                createdOn: new Date().toISOString()
            };

            try {
                await storageOperations.comments.create(comment);
                return comment;
            } catch (ex) {
                throw new WebinyError(
                    ex.message || "Could not create comment.",
                    ex.code || "CREATE_COMMENT_ERROR",
                    {
                        error: ex,
                        input
                    }
                );
            }
        },
        async updateComment(id, entryId, modelId, input) {
            const tenant = getTenant();
            const original = await storageOperations.comments.get({ id, entryId, modelId, tenant });
            if (!original) {
                throw new WebinyError("Comment not found.", "COMMENT_NOT_FOUND", { id });
            }

            const comment: CmsComment = {
                ...original,
                ...input,
                mentions: input.mentions || original.mentions || [],
                updatedOn: new Date().toISOString()
            };

            try {
                await storageOperations.comments.update(comment);
                return comment;
            } catch (ex) {
                throw new WebinyError(
                    ex.message || "Could not update comment.",
                    ex.code || "UPDATE_COMMENT_ERROR",
                    {
                        error: ex,
                        input
                    }
                );
            }
        },
        async deleteComment(id, entryId, modelId) {
            const tenant = getTenant();
            const comment = await storageOperations.comments.get({ id, entryId, modelId, tenant });
            if (!comment) {
                throw new WebinyError("Comment not found.", "COMMENT_NOT_FOUND", { id });
            }

            try {
                await storageOperations.comments.delete({ id, entryId, modelId, tenant });
                return true;
            } catch (ex) {
                throw new WebinyError(
                    ex.message || "Could not delete comment.",
                    ex.code || "DELETE_COMMENT_ERROR",
                    {
                        error: ex,
                        id
                    }
                );
            }
        }
    };
};
