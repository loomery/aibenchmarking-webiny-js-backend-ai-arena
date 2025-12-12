import { mdbid } from "@webiny/utils";
import WebinyError from "@webiny/error";
import { NotFoundError } from "@webiny/handler-graphql";
import { createTopic } from "@webiny/pubsub";
import type {
    CmsContext,
    CmsEntryComment,
    CmsEntryCommentContext,
    CmsEntryCommentListParams,
    CmsEntryCommentMeta,
    CmsModel,
    CreateCmsEntryCommentInput,
    UpdateCmsEntryCommentInput,
    HeadlessCmsStorageOperations,
    OnEntryCommentAfterCreateTopicParams,
    OnEntryCommentAfterDeleteTopicParams,
    OnEntryCommentAfterUpdateTopicParams,
    OnEntryCommentBeforeCreateTopicParams,
    OnEntryCommentBeforeDeleteTopicParams,
    OnEntryCommentBeforeUpdateTopicParams
} from "~/types/index.js";
import type { AccessControl } from "./AccessControl/AccessControl.js";
import type { SecurityIdentity } from "@webiny/api-core/types/security.js";
import type { Tenant } from "@webiny/api-core/types/tenancy.js";
import type { I18NLocale } from "@webiny/api-core/types/i18n.js";

interface CreateContentEntryCommentCrudParams {
    storageOperations: HeadlessCmsStorageOperations;
    accessControl: AccessControl;
    getTenant: () => Tenant;
    getLocale: () => I18NLocale;
    getIdentity: () => SecurityIdentity;
}

interface ContentEntryCommentsCrudContextObject {
    context: CmsContext;
}

const checkModelAccess = async (context: CmsContext, model: CmsModel) => {
    await context.cms.accessControl.ensureCanAccessEntry({ rwd: "r", model });
};

const extractMentions = (body: string): string[] => {
    const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
    const mentions: string[] = [];
    let match;
    while ((match = mentionRegex.exec(body)) !== null) {
        mentions.push(match[2]);
    }
    return mentions;
};

export const createContentEntryCommentsCrud = (
    params: CreateContentEntryCommentCrudParams
): CmsEntryCommentContext => {
    const { storageOperations, getTenant, getLocale, getIdentity } = params;

    const onEntryCommentBeforeCreate = createTopic<OnEntryCommentBeforeCreateTopicParams>(
        "cms.onEntryCommentBeforeCreate"
    );
    const onEntryCommentAfterCreate = createTopic<OnEntryCommentAfterCreateTopicParams>(
        "cms.onEntryCommentAfterCreate"
    );
    const onEntryCommentBeforeUpdate = createTopic<OnEntryCommentBeforeUpdateTopicParams>(
        "cms.onEntryCommentBeforeUpdate"
    );
    const onEntryCommentAfterUpdate = createTopic<OnEntryCommentAfterUpdateTopicParams>(
        "cms.onEntryCommentAfterUpdate"
    );
    const onEntryCommentBeforeDelete = createTopic<OnEntryCommentBeforeDeleteTopicParams>(
        "cms.onEntryCommentBeforeDelete"
    );
    const onEntryCommentAfterDelete = createTopic<OnEntryCommentAfterDeleteTopicParams>(
        "cms.onEntryCommentAfterDelete"
    );

    return {
        onEntryCommentBeforeCreate,
        onEntryCommentAfterCreate,
        onEntryCommentBeforeUpdate,
        onEntryCommentAfterUpdate,
        onEntryCommentBeforeDelete,
        onEntryCommentAfterDelete,

        async createEntryComment(
            this: ContentEntryCommentsCrudContextObject,
            model: CmsModel,
            input: CreateCmsEntryCommentInput
        ): Promise<CmsEntryComment> {
            await checkModelAccess(this.context, model);

            const identity = getIdentity();
            const tenant = getTenant();
            const locale = getLocale();
            const now = new Date().toISOString();

            // Extract mentions from body
            const mentions = input.mentions || extractMentions(input.body);

            // Validate parent comment exists if parentId is provided
            if (input.parentId) {
                const parent = await storageOperations.comments.get(model, input.parentId);
                if (!parent) {
                    throw new NotFoundError(`Parent comment "${input.parentId}" not found.`);
                }
                // Ensure parent comment is on the same entry
                if (parent.entryId !== input.entryId) {
                    throw new WebinyError(
                        `Parent comment belongs to a different entry.`,
                        "PARENT_COMMENT_MISMATCH"
                    );
                }
            }

            // Validate that the entry exists
            try {
                await this.context.cms.getEntryById(model, input.entryId);
            } catch {
                throw new NotFoundError(`Entry "${input.entryId}" not found.`);
            }

            const comment: CmsEntryComment = {
                id: mdbid(),
                entryId: input.entryId,
                modelId: model.modelId,
                body: input.body,
                parentId: input.parentId || null,
                mentions,
                tenant: tenant.id,
                locale: locale.code,
                createdOn: now,
                createdBy: {
                    id: identity.id,
                    displayName: identity.displayName,
                    type: identity.type
                },
                modifiedOn: null,
                modifiedBy: null,
                deletedOn: null,
                deletedBy: null,
                webinyVersion: this.context.WEBINY_VERSION
            };

            try {
                await onEntryCommentBeforeCreate.publish({
                    input,
                    comment,
                    model
                });

                const createdComment = await storageOperations.comments.create(model, comment);

                await onEntryCommentAfterCreate.publish({
                    input,
                    comment: createdComment,
                    model
                });

                return createdComment;
            } catch (error) {
                throw new WebinyError(
                    error.message || "Could not create comment.",
                    error.code || "CREATE_COMMENT_ERROR",
                    {
                        error,
                        input
                    }
                );
            }
        },

        async updateEntryComment(
            this: ContentEntryCommentsCrudContextObject,
            model: CmsModel,
            id: string,
            input: UpdateCmsEntryCommentInput
        ): Promise<CmsEntryComment> {
            await checkModelAccess(this.context, model);

            const original = await storageOperations.comments.get(model, id);
            if (!original) {
                throw new NotFoundError(`Comment "${id}" not found.`);
            }

            if (original.deletedOn) {
                throw new WebinyError("Cannot update a deleted comment.", "COMMENT_DELETED");
            }

            const identity = getIdentity();
            const now = new Date().toISOString();

            // Extract mentions from body
            const mentions = input.mentions || extractMentions(input.body);

            const comment: CmsEntryComment = {
                ...original,
                body: input.body,
                mentions,
                modifiedOn: now,
                modifiedBy: {
                    id: identity.id,
                    displayName: identity.displayName,
                    type: identity.type
                }
            };

            try {
                await onEntryCommentBeforeUpdate.publish({
                    input,
                    original,
                    comment,
                    model
                });

                const updatedComment = await storageOperations.comments.update(model, comment);

                await onEntryCommentAfterUpdate.publish({
                    input,
                    original,
                    comment: updatedComment,
                    model
                });

                return updatedComment;
            } catch (error) {
                throw new WebinyError(
                    error.message || "Could not update comment.",
                    error.code || "UPDATE_COMMENT_ERROR",
                    {
                        error,
                        id,
                        input
                    }
                );
            }
        },

        async deleteEntryComment(
            this: ContentEntryCommentsCrudContextObject,
            model: CmsModel,
            id: string
        ): Promise<boolean> {
            await checkModelAccess(this.context, model);

            const comment = await storageOperations.comments.get(model, id);
            if (!comment) {
                throw new NotFoundError(`Comment "${id}" not found.`);
            }

            if (comment.deletedOn) {
                throw new WebinyError("Comment is already deleted.", "COMMENT_ALREADY_DELETED");
            }

            const identity = getIdentity();
            const now = new Date().toISOString();

            const deletedComment: CmsEntryComment = {
                ...comment,
                deletedOn: now,
                deletedBy: {
                    id: identity.id,
                    displayName: identity.displayName,
                    type: identity.type
                }
            };

            try {
                await onEntryCommentBeforeDelete.publish({
                    comment: deletedComment,
                    model
                });

                await storageOperations.comments.update(model, deletedComment);

                await onEntryCommentAfterDelete.publish({
                    comment: deletedComment,
                    model
                });

                return true;
            } catch (error) {
                throw new WebinyError(
                    error.message || "Could not delete comment.",
                    error.code || "DELETE_COMMENT_ERROR",
                    {
                        error,
                        id
                    }
                );
            }
        },

        async getEntryComment(
            this: ContentEntryCommentsCrudContextObject,
            model: CmsModel,
            id: string
        ): Promise<CmsEntryComment> {
            await checkModelAccess(this.context, model);

            const comment = await storageOperations.comments.get(model, id);
            if (!comment) {
                throw new NotFoundError(`Comment "${id}" not found.`);
            }

            return comment;
        },

        async listEntryComments(
            this: ContentEntryCommentsCrudContextObject,
            model: CmsModel,
            params: CmsEntryCommentListParams
        ): Promise<[CmsEntryComment[], CmsEntryCommentMeta]> {
            await checkModelAccess(this.context, model);

            if (!params.entryId) {
                throw new WebinyError(
                    "entryId is required for listing comments.",
                    "ENTRY_ID_REQUIRED"
                );
            }

            try {
                const result = await storageOperations.comments.list(model, params);

                const meta: CmsEntryCommentMeta = {
                    cursor: result.cursor,
                    hasMoreItems: result.hasMoreItems,
                    totalCount: result.totalCount
                };

                return [result.items, meta];
            } catch (error) {
                throw new WebinyError(
                    error.message || "Could not list comments.",
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
