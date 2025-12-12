import { describe, expect, it, beforeEach } from "vitest";
import { useHandler } from "~tests/testHelpers/useHandler";
import { articleModel } from "../lifecycleHooks/mocks/article.model";
import { CmsModelPlugin } from "~/plugins";
import type { CmsContext, CmsEntry } from "~/types";

describe("Entry Comments CRUD", () => {
    let context: CmsContext;
    let handler: any;
    let tenant: any;
    let model: any;
    let entry: CmsEntry;

    beforeEach(async () => {
        const setup = useHandler({
            plugins: [new CmsModelPlugin(articleModel)]
        });
        handler = setup.handler;
        tenant = setup.tenant;

        context = await handler({
            path: "/cms/manage/en-US",
            headers: {
                "x-tenant": tenant.id
            }
        });

        model = await context.cms.getModel("article");
        if (!model) {
            throw new Error(`Missing "article" model!`);
        }

        // Create a test entry
        entry = await context.cms.createEntry(model, {
            title: "Test Article for Comments",
            content: "This is a test article"
        });
    });

    it("should create a comment on an entry", async () => {
        const comment = await context.cms.createEntryComment(model, {
            entryId: entry.id,
            body: "This is a test comment",
            mentions: []
        });

        expect(comment).toBeDefined();
        expect(comment.id).toBeDefined();
        expect(comment.entryId).toBe(entry.id);
        expect(comment.body).toBe("This is a test comment");
        expect(comment.parentId).toBeNull();
        expect(comment.mentions).toEqual([]);
        expect(comment.createdOn).toBeDefined();
        expect(comment.createdBy).toBeDefined();
        expect(comment.modifiedOn).toBeNull();
    });

    it("should create a threaded comment (reply)", async () => {
        const parentComment = await context.cms.createEntryComment(model, {
            entryId: entry.id,
            body: "Parent comment",
            mentions: []
        });

        const replyComment = await context.cms.createEntryComment(model, {
            entryId: entry.id,
            body: "This is a reply",
            parentId: parentComment.id
        });

        expect(replyComment.parentId).toBe(parentComment.id);
        expect(replyComment.entryId).toBe(entry.id);
    });

    it("should extract mentions from comment body", async () => {
        const comment = await context.cms.createEntryComment(model, {
            entryId: entry.id,
            body: "Hey @[John Doe](user-123) and @[Jane Smith](user-456), check this out!"
        });

        expect(comment.mentions).toEqual(["user-123", "user-456"]);
    });
});
