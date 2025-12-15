import { describe, test, beforeAll, expect } from "vitest";
import { mdbid } from "@webiny/utils";
import useGqlHandler from "~tests/utils/useGqlHandler";

describe("Bulk Tagging test", { timeout: 100_000 }, () => {
    const { createFiles, bulkAddTags, bulkRemoveTags, getFile } = useGqlHandler();

    let fileIds: string[];

    beforeAll(async () => {
        fileIds = [mdbid(), mdbid(), mdbid()];

        const testFiles = fileIds.map((id, index) => ({
            id,
            key: `${id}/test-file-${index}.jpg`,
            name: `test-file-${index}.jpg`,
            size: 1024,
            type: "image/jpeg",
            tags: index === 0 ? ["existing"] : [],
            aliases: []
        }));

        await createFiles({ data: testFiles });
    });

    test("should add tags to multiple files", async () => {
        const [response] = await bulkAddTags({
            input: {
                ids: [fileIds[0], fileIds[1]],
                tags: ["new-tag", "another-tag"]
            }
        });

        expect(response).toEqual({
            data: {
                fileManager: {
                    bulkAddTags: {
                        data: {
                            success: [fileIds[0], fileIds[1]],
                            failed: []
                        },
                        error: null
                    }
                }
            }
        });

        const [file1Response] = await getFile({ id: fileIds[0] });
        expect(file1Response.data.fileManager.getFile.data.tags).toEqual(
            expect.arrayContaining(["existing", "new-tag", "another-tag"])
        );

        const [file2Response] = await getFile({ id: fileIds[1] });
        expect(file2Response.data.fileManager.getFile.data.tags).toEqual(
            expect.arrayContaining(["new-tag", "another-tag"])
        );
    });

    test("should remove tags from multiple files", async () => {
        await bulkAddTags({
            input: {
                ids: [fileIds[0], fileIds[1]],
                tags: ["remove-me", "keep-me"]
            }
        });

        const [response] = await bulkRemoveTags({
            input: {
                ids: [fileIds[0], fileIds[1]],
                tags: ["remove-me"]
            }
        });

        expect(response).toEqual({
            data: {
                fileManager: {
                    bulkRemoveTags: {
                        data: {
                            success: [fileIds[0], fileIds[1]],
                            failed: []
                        },
                        error: null
                    }
                }
            }
        });

        const [file1Response] = await getFile({ id: fileIds[0] });
        expect(file1Response.data.fileManager.getFile.data.tags).not.toContain("remove-me");
        expect(file1Response.data.fileManager.getFile.data.tags).toContain("keep-me");

        const [file2Response] = await getFile({ id: fileIds[1] });
        expect(file2Response.data.fileManager.getFile.data.tags).not.toContain("remove-me");
        expect(file2Response.data.fileManager.getFile.data.tags).toContain("keep-me");
    });

    test("should handle partial failures with non-existent files", async () => {
        const nonExistentId = mdbid();
        const [response] = await bulkAddTags({
            input: {
                ids: [fileIds[2], nonExistentId],
                tags: ["test-tag"]
            }
        });

        expect(response.data.fileManager.bulkAddTags.data.success).toEqual([fileIds[2]]);
        expect(response.data.fileManager.bulkAddTags.data.failed).toHaveLength(1);
        expect(response.data.fileManager.bulkAddTags.data.failed[0].id).toBe(nonExistentId);
        expect(response.data.fileManager.bulkAddTags.data.failed[0].error).toContain("not found");
    });

    test("should not add duplicate tags", async () => {
        await bulkAddTags({
            input: {
                ids: [fileIds[2]],
                tags: ["unique-tag"]
            }
        });

        await bulkAddTags({
            input: {
                ids: [fileIds[2]],
                tags: ["unique-tag", "unique-tag"]
            }
        });

        const [fileResponse] = await getFile({ id: fileIds[2] });
        const tags = fileResponse.data.fileManager.getFile.data.tags;
        const uniqueTagCount = tags.filter((tag: string) => tag === "unique-tag").length;
        expect(uniqueTagCount).toBe(1);
    });

    test("should handle empty tag arrays", async () => {
        const [addResponse] = await bulkAddTags({
            input: {
                ids: [fileIds[0]],
                tags: []
            }
        });

        expect(addResponse.data.fileManager.bulkAddTags.data.success).toEqual([fileIds[0]]);

        const [removeResponse] = await bulkRemoveTags({
            input: {
                ids: [fileIds[0]],
                tags: []
            }
        });

        expect(removeResponse.data.fileManager.bulkRemoveTags.data.success).toEqual([fileIds[0]]);
    });

    test("should handle empty file ID arrays", async () => {
        const [response] = await bulkAddTags({
            input: {
                ids: [],
                tags: ["test-tag"]
            }
        });

        expect(response.data.fileManager.bulkAddTags.data.success).toEqual([]);
        expect(response.data.fileManager.bulkAddTags.data.failed).toEqual([]);
    });
});
