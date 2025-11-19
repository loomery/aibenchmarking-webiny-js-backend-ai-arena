import { describe, test, it, beforeAll, expect } from "vitest";
import { mdbid } from "@webiny/utils";
import useGqlHandler from "~tests/utils/useGqlHandler";
import testFiles from "./data";
import { ids, fileDData, fileCData, fileBData, fileAData } from "./mocks/files";

describe("Files CRUD test", { timeout: 100_000, retry: 3 }, () => {
    const { createFile, updateFile, createFiles, getFile, listFiles, listTags, copyFiles } =
        useGqlHandler();

    test("should copy files", async () => {
        // 1. Create an initial file
        const [createFileResponse] = await createFile({ data: fileAData });
        expect(createFileResponse).toEqual({
            data: {
                fileManager: {
                    createFile: {
                        data: fileAData,
                        error: null
                    }
                }
            }
        });

        // 2. Copy the file to the same folder
        const [copyFilesResponse] = await copyFiles({
            data: {
                files: [{ id: fileAData.id }]
            }
        });

        expect(copyFilesResponse).toEqual({
            data: {
                fileManager: {
                    copyFiles: {
                        data: true,
                        error: null
                    }
                }
            }
        });

        // Verify that two files exist and one has a unique name
        const [listFilesResponse] = await listFiles();
        expect(listFilesResponse.data.fileManager.listFiles.data.length).toBe(2);

        const copiedFile = listFilesResponse.data.fileManager.listFiles.data.find(
            (file: any) => file.name === "filenameA (1).png"
        );
        expect(copiedFile).toBeDefined();
        expect(copiedFile.key).toContain("filenameA (1).png");
        expect(copiedFile.location.folderId).toBe("root");
        expect(copiedFile.id).not.toBe(fileAData.id);

        // 3. Create another file
        const [createFileResponse2] = await createFile({ data: fileBData });
        expect(createFileResponse2).toEqual({
            data: {
                fileManager: {
                    createFile: {
                        data: fileBData,
                        error: null
                    }
                }
            }
        });

        // 4. Copy multiple files
        const [copyMultipleFilesResponse] = await copyFiles({
            data: {
                files: [{ id: fileAData.id }, { id: fileBData.id }]
            }
        });

        expect(copyMultipleFilesResponse).toEqual({
            data: {
                fileManager: {
                    copyFiles: {
                        data: true,
                        error: null
                    }
                }
            }
        });

        // Verify that total 5 files exist (original A, copied A, original B, copied A (2), copied B (1))
        const [listAllFilesResponse] = await listFiles();
        expect(listAllFilesResponse.data.fileManager.listFiles.data.length).toBe(5);

        const copiedFileA2 = listAllFilesResponse.data.fileManager.listFiles.data.find(
            (file: any) => file.name === "filenameA (2).png"
        );
        expect(copiedFileA2).toBeDefined();
        expect(copiedFileA2.id).not.toBe(fileAData.id);

        const copiedFileB1 = listAllFilesResponse.data.fileManager.listFiles.data.find(
            (file: any) => file.name === "filenameB (1).jpeg"
        );
        expect(copiedFileB1).toBeDefined();
        expect(copiedFileB1.id).not.toBe(fileBData.id);

        // 5. Test error case - non-existent file
        const [copyNonExistentFileResponse] = await copyFiles({
            data: {
                files: [{ id: "non-existent-id" }]
            }
        });

        expect(copyNonExistentFileResponse).toEqual({
            data: {
                fileManager: {
                    copyFiles: {
                        data: null,
                        error: {
                            code: "FILE_COPY_ERROR",
                            message: 'Failed to copy file with ID "non-existent-id".',
                            data: {
                                fileId: "non-existent-id"
                            }
                        }
                    }
                }
            }
        });
    });

    beforeAll(() => {
        testFiles.forEach(file => {
            file.id = mdbid();
            file.key = `${file.id}/${file.key}`;
        });
    });

    test("should create, read, update and delete files", async () => {
        const [create] = await createFile({ data: fileAData });
        expect(create).toEqual({
            data: {
                fileManager: {
                    createFile: {
                        data: fileAData,
                        error: null
                    }
                }
            }
        });

        // This is commented out until we add proper file model validation!
        //
        // // Let's update File tags with too long tag.
        // const { id: fileAId, ...fileAUpdate } = fileAData;
        // const [update1] = await updateFile({
        //     id: fileAId,
        //     data: {
        //         ...fileAUpdate,
        //         tags: [...fileAUpdate.tags, LONG_STRING]
        //     }
        // });
        // expect(update1).toEqual({
        //     data: {
        //         fileManager: {
        //             updateFile: {
        //                 data: null,
        //                 error: {
        //                     message: "Validation failed.",
        //                     code: "VALIDATION_FAILED_INVALID_FIELDS",
        //                     data: {
        //                         invalidFields: {
        //                             tags: {
        //                                 code: "VALIDATION_FAILED_INVALID_FIELD",
        //                                 data: null,
        //                                 message: `Tag ${LONG_STRING} is more than 50 characters long.`
        //                             }
        //                         },
        //                         original: expect.any(Object),
        //                         file: expect.any(Object)
        //                     }
        //                 }
        //             }
        //         }
        //     }
        // });

        // Only update "tags"
        const [update3] = await updateFile({
            id: ids.A,
            data: { tags: ["sketch"] }
        });

        expect(update3).toEqual({
            data: {
                fileManager: {
                    updateFile: {
                        data: {
                            ...fileAData,
                            tags: ["sketch"]
                        },
                        error: null
                    }
                }
            }
        });

        // Let's create multiple files
        const [create2] = await createFiles({
            data: [fileBData]
        });

        expect(create2).toEqual({
            data: {
                fileManager: {
                    createFiles: {
                        data: [fileBData],
                        error: null
                    }
                }
            }
        });

        // Let's get a file by ID
        const [get] = await getFile({
            id: ids.A
        });

        expect(get).toEqual({
            data: {
                fileManager: {
                    getFile: {
                        data: {
                            ...fileAData,
                            tags: ["sketch"]
                        },
                        error: null
                    }
                }
            }
        });

        // Let's get a all files
        const [list2] = await listFiles();
        expect(list2).toEqual({
            data: {
                fileManager: {
                    listFiles: {
                        data: [
                            // Files are sorted by `id` in descending order
                            fileBData,
                            {
                                ...fileAData,
                                tags: ["sketch"]
                            }
                        ],
                        meta: {
                            cursor: null,
                            totalCount: expect.any(Number),
                            hasMoreItems: false
                        },
                        error: null
                    }
                }
            }
        });
    });

    test("should create files in bulk and paginate using cursor", async () => {
        // Bulk insert test data
        await createFiles({ data: testFiles });

        const inElastic = testFiles.reverse();

        const [page1] = await listFiles({ limit: 20 });

        const meta1 = page1.data.fileManager.listFiles.meta;
        expect(meta1.totalCount).toBe(100);
        expect(page1.data.fileManager.listFiles.data.length).toBe(20);
        expect(page1.data.fileManager.listFiles.data).toEqual(inElastic.slice(0, 20));

        const [page2] = await listFiles({ limit: 20, after: meta1.cursor });
        const meta2 = page2.data.fileManager.listFiles.meta;
        expect(page2.data.fileManager.listFiles.data.length).toBe(20);
        expect(page2.data.fileManager.listFiles.data).toEqual(inElastic.slice(20, 40));

        const [page3] = await listFiles({ limit: 60, after: meta2.cursor });
        const meta3 = page3.data.fileManager.listFiles.meta;
        expect(page3.data.fileManager.listFiles.data.length).toBe(60);
        expect(page3.data.fileManager.listFiles.data).toEqual(inElastic.slice(40, 100));
        expect(meta3.cursor).toEqual(null);
    });

    it("should find files by tags", async () => {
        const [createResponse] = await createFiles({
            data: [fileAData, fileBData, fileCData, fileDData]
        });
        expect(createResponse).toEqual({
            data: {
                fileManager: {
                    createFiles: {
                        data: expect.any(Array),
                        error: null
                    }
                }
            }
        });

        const [response] = await listFiles({
            where: {
                tags_in: ["art"]
            }
        });

        expect(response).toEqual({
            data: {
                fileManager: {
                    listFiles: {
                        data: [{ ...fileCData, aliases: [] }, fileBData],
                        error: null,
                        meta: {
                            hasMoreItems: false,
                            cursor: null,
                            totalCount: 2
                        }
                    }
                }
            }
        });

        const [scopedListFilesResponse] = await listFiles({
            where: {
                tags_in: ["scope:apw"]
            }
        });

        expect(scopedListFilesResponse).toEqual({
            data: {
                fileManager: {
                    listFiles: {
                        data: [{ ...fileDData, aliases: [] }],
                        error: null,
                        meta: {
                            hasMoreItems: false,
                            cursor: null,
                            totalCount: 1
                        }
                    }
                }
            }
        });
    });

    it("should find files by specific IDs", async () => {
        const [createResponse] = await createFiles({
            data: [fileAData, fileBData, fileCData, fileDData]
        });
        expect(createResponse).toEqual({
            data: {
                fileManager: {
                    createFiles: {
                        data: expect.any(Array),
                        error: null
                    }
                }
            }
        });

        const [response] = await listFiles({
            ids: [fileAData.id, fileBData.id, fileCData.id, fileDData.id]
        });

        expect(response).toEqual({
            data: {
                fileManager: {
                    listFiles: {
                        data: [
                            { ...fileDData, aliases: [] },
                            { ...fileCData, aliases: [] },
                            fileBData,
                            fileAData
                        ],
                        error: null,
                        meta: {
                            hasMoreItems: false,
                            cursor: null,
                            totalCount: 4
                        }
                    }
                }
            }
        });
    });

    it("should list all the tags from files", async () => {
        const [createResponse] = await createFiles({
            data: [fileAData, fileBData, fileCData, fileDData]
        });
        expect(createResponse).toEqual({
            data: {
                fileManager: {
                    createFiles: {
                        data: expect.any(Array),
                        error: null
                    }
                }
            }
        });

        const tags = [
            {
                tag: "art",
                count: 2
            },
            {
                tag: "sketch",
                count: 2
            },
            {
                tag: "webiny",
                count: 2
            },
            {
                tag: "file-a",
                count: 1
            },
            {
                tag: "file-b",
                count: 1
            },
            {
                tag: "file-c",
                count: 1
            }
        ];
        const scopedTags = [
            {
                tag: "scope:apw",
                count: 1
            },
            {
                tag: "scope:apw:file-d",
                count: 1
            },
            {
                tag: "scope:apw:media",
                count: 1
            }
        ];

        const [response] = await listTags({
            where: {
                tags_not_startsWith: "scope:apw"
            }
        });

        expect(response).toEqual({
            data: {
                fileManager: {
                    listTags: {
                        data: tags,
                        error: null
                    }
                }
            }
        });

        const [scopedListTagsResponse] = await listTags({
            where: {
                tags_startsWith: "scope:apw"
            }
        });

        expect(scopedListTagsResponse).toEqual({
            data: {
                fileManager: {
                    listTags: {
                        data: scopedTags,
                        error: null
                    }
                }
            }
        });
    });

    /**
     * Unfortunately this test is skipped because it is not passing on the CI (DDB+ES package).
     * Testing the search locally and on deployed system shows that searching works.
     */

    it("should find files by name", async () => {
        const [createResponse] = await createFiles({
            data: [fileAData, fileBData, fileCData]
        });
        expect(createResponse).toEqual({
            data: {
                fileManager: {
                    createFiles: {
                        data: expect.any(Array),
                        error: null
                    }
                }
            }
        });

        const [searchNameResponse] = await listFiles({
            search: "filenameC"
        });

        expect(searchNameResponse).toEqual({
            data: {
                fileManager: {
                    listFiles: {
                        data: [
                            {
                                ...fileCData,
                                id: expect.any(String)
                            }
                        ],
                        error: null,
                        meta: {
                            hasMoreItems: false,
                            totalCount: 1,
                            cursor: null
                        }
                    }
                }
            }
        });
    });

    it("should find files by tag", async () => {
        const [createResponse] = await createFiles({
            data: [fileAData, fileBData, fileCData]
        });

        expect(createResponse).toEqual({
            data: {
                fileManager: {
                    createFiles: {
                        data: expect.any(Array),
                        error: null
                    }
                }
            }
        });

        const [searchTagsResponse] = await listFiles({
            search: "art"
        });

        expect(searchTagsResponse).toEqual({
            data: {
                fileManager: {
                    listFiles: {
                        data: [
                            {
                                ...fileCData,
                                aliases: []
                            },
                            fileBData
                        ],
                        error: null,
                        meta: {
                            hasMoreItems: false,
                            totalCount: 2,
                            cursor: null
                        }
                    }
                }
            }
        });

        const [searchTags2Response] = await listFiles({
            search: "webiny"
        });

        expect(searchTags2Response).toEqual({
            data: {
                fileManager: {
                    listFiles: {
                        data: [
                            {
                                ...fileCData,
                                aliases: []
                            },
                            fileAData
                        ],
                        error: null,
                        meta: {
                            hasMoreItems: false,
                            totalCount: 2,
                            cursor: null
                        }
                    }
                }
            }
        });
    });

    it("should have no tags if files uploaded have no tags", async () => {
        const [createResponse] = await createFiles({
            data: [fileAData, fileBData, fileCData].map(file => {
                return {
                    ...file,
                    tags: undefined
                };
            })
        });

        expect(createResponse).toEqual({
            data: {
                fileManager: {
                    createFiles: {
                        data: expect.any(Array),
                        error: null
                    }
                }
            }
        });

        const [tagsResponse] = await listTags({});

        expect(tagsResponse).toEqual({
            data: {
                fileManager: {
                    listTags: {
                        data: [],
                        error: null
                    }
                }
            }
        });
    });
});
