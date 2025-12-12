import type { CmsIdentity } from "./identity.js";
import type { CmsModel } from "./model.js";
import type { Topic } from "@webiny/pubsub/types.js";

/**
 * A comment on a CMS entry
 *
 * @category CmsEntryComment
 */
export interface CmsEntryComment {
    /**
     * Unique comment ID
     */
    id: string;
    /**
     * Entry ID this comment belongs to
     */
    entryId: string;
    /**
     * Model ID for the entry
     */
    modelId: string;
    /**
     * Comment text body
     */
    body: string;
    /**
     * Parent comment ID for threaded comments (null for top-level)
     */
    parentId: string | null;
    /**
     * User IDs mentioned in the comment
     */
    mentions: string[];
    /**
     * Tenant ID
     */
    tenant: string;
    /**
     * Locale code
     */
    locale: string;
    /**
     * An ISO 8601 date/time string
     */
    createdOn: string;
    /**
     * Identity that created the comment
     */
    createdBy: CmsIdentity;
    /**
     * An ISO 8601 date/time string (null if never modified)
     */
    modifiedOn: string | null;
    /**
     * Identity that last modified the comment (null if never modified)
     */
    modifiedBy: CmsIdentity | null;
    /**
     * An ISO 8601 date/time string (null if not deleted)
     */
    deletedOn: string | null;
    /**
     * Identity that deleted the comment (null if not deleted)
     */
    deletedBy: CmsIdentity | null;
    /**
     * Webiny version
     */
    webinyVersion: string;
}

/**
 * Input for creating a comment
 *
 * @category CmsEntryComment
 */
export interface CreateCmsEntryCommentInput {
    /**
     * Entry ID to comment on
     */
    entryId: string;
    /**
     * Comment text
     */
    body: string;
    /**
     * Parent comment ID for replies (optional)
     */
    parentId?: string | null;
    /**
     * User IDs to mention (optional)
     */
    mentions?: string[];
}

/**
 * Input for updating a comment
 *
 * @category CmsEntryComment
 */
export interface UpdateCmsEntryCommentInput {
    /**
     * Comment text
     */
    body: string;
    /**
     * User IDs to mention (optional)
     */
    mentions?: string[];
}

/**
 * Parameters for listing comments
 *
 * @category CmsEntryComment
 */
export interface CmsEntryCommentListParams {
    /**
     * Entry ID to get comments for
     */
    entryId?: string;
    /**
     * Parent comment ID to get replies (null for top-level only)
     */
    parentId?: string | null;
    /**
     * Limit number of results
     */
    limit?: number;
    /**
     * Cursor for pagination
     */
    after?: string | null;
    /**
     * Include deleted comments
     */
    includeDeleted?: boolean;
}

/**
 * Response metadata for comment listing
 *
 * @category CmsEntryComment
 */
export interface CmsEntryCommentMeta {
    /**
     * Cursor for pagination
     */
    cursor: string | null;
    /**
     * Has more items
     */
    hasMoreItems: boolean;
    /**
     * Total count
     */
    totalCount: number;
}

/**
 * CMS Entry Comment context methods
 *
 * @category Context
 * @category CmsEntryComment
 */
export interface CmsEntryCommentContext {
    /**
     * Lifecycle hooks
     */
    onEntryCommentBeforeCreate: Topic<OnEntryCommentBeforeCreateTopicParams>;
    onEntryCommentAfterCreate: Topic<OnEntryCommentAfterCreateTopicParams>;
    onEntryCommentBeforeUpdate: Topic<OnEntryCommentBeforeUpdateTopicParams>;
    onEntryCommentAfterUpdate: Topic<OnEntryCommentAfterUpdateTopicParams>;
    onEntryCommentBeforeDelete: Topic<OnEntryCommentBeforeDeleteTopicParams>;
    onEntryCommentAfterDelete: Topic<OnEntryCommentAfterDeleteTopicParams>;

    /**
     * Create a new comment on an entry
     */
    createEntryComment(
        model: CmsModel,
        input: CreateCmsEntryCommentInput
    ): Promise<CmsEntryComment>;
    /**
     * Update an existing comment
     */
    updateEntryComment(
        model: CmsModel,
        id: string,
        input: UpdateCmsEntryCommentInput
    ): Promise<CmsEntryComment>;
    /**
     * Delete a comment (soft delete)
     */
    deleteEntryComment(model: CmsModel, id: string): Promise<boolean>;
    /**
     * Get a single comment by ID
     */
    getEntryComment(model: CmsModel, id: string): Promise<CmsEntryComment>;
    /**
     * List comments for an entry or comment thread
     */
    listEntryComments(
        model: CmsModel,
        params: CmsEntryCommentListParams
    ): Promise<[CmsEntryComment[], CmsEntryCommentMeta]>;
}

/**
 * Storage operations for comments
 *
 * @category StorageOperations
 * @category CmsEntryComment
 */
export interface CmsEntryCommentStorageOperations {
    /**
     * Create a comment
     */
    create(model: CmsModel, comment: CmsEntryComment): Promise<CmsEntryComment>;
    /**
     * Update a comment
     */
    update(model: CmsModel, comment: CmsEntryComment): Promise<CmsEntryComment>;
    /**
     * Delete a comment
     */
    delete(model: CmsModel, id: string): Promise<boolean>;
    /**
     * Get a comment by ID
     */
    get(model: CmsModel, id: string): Promise<CmsEntryComment | null>;
    /**
     * List comments
     */
    list(
        model: CmsModel,
        params: CmsEntryCommentListParams
    ): Promise<{
        items: CmsEntryComment[];
        cursor: string | null;
        hasMoreItems: boolean;
        totalCount: number;
    }>;
}

/**
 * Topic params for comment lifecycle hooks
 */
export interface OnEntryCommentBeforeCreateTopicParams {
    input: CreateCmsEntryCommentInput;
    comment: CmsEntryComment;
    model: CmsModel;
}

export interface OnEntryCommentAfterCreateTopicParams {
    input: CreateCmsEntryCommentInput;
    comment: CmsEntryComment;
    model: CmsModel;
}

export interface OnEntryCommentBeforeUpdateTopicParams {
    input: UpdateCmsEntryCommentInput;
    original: CmsEntryComment;
    comment: CmsEntryComment;
    model: CmsModel;
}

export interface OnEntryCommentAfterUpdateTopicParams {
    input: UpdateCmsEntryCommentInput;
    original: CmsEntryComment;
    comment: CmsEntryComment;
    model: CmsModel;
}

export interface OnEntryCommentBeforeDeleteTopicParams {
    comment: CmsEntryComment;
    model: CmsModel;
}

export interface OnEntryCommentAfterDeleteTopicParams {
    comment: CmsEntryComment;
    model: CmsModel;
}
