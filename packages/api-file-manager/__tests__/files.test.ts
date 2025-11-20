import { describe, test, it, beforeAll, expect } from "vitest";
import { mdbid } from "@webiny/utils";
import useGqlHandler from "~tests/utils/useGqlHandler";
import testFiles from "./data";
import { ids, fileDData, fileCData, fileBData, fileAData } from "./mocks/files";
import { FilePhysicalStoragePlugin } from "~/plugins/FilePhysicalStoragePlugin.js";

describe("Files CRUD test", { timeout: 100_000, retry: 3 }, () => {
    const { createFile, updateFile, createFiles, copyFiles, getFile, listFiles, listTags } =
        useGqlHandler();

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

    test("should copy multiple files into target folder", async () => {
        const sourceAId = mdbid();
        const sourceBId = mdbid();

        const sourceA = {
            ...fileAData,
            id: sourceAId,
            key: `${sourceAId}/filenameA.png`
        };
        const sourceB = {
            ...fileBData,
            id: sourceBId,
            key: `${sourceBId}/filenameB.png`
        };

        const [createSources] = await createFiles({
            data: [sourceA, sourceB]
        });

        expect(createSources).toEqual({
            data: {
                fileManager: {
                    createFiles: {
                        data: expect.any(Array),
                        error: null
                    }
                }
            }
        });

        const targetFolderId = `folder-${mdbid()}`;

        const [copyResponse] = await copyFiles(
            {
                data: {
                    ids: [sourceAId, sourceBId],
                    location: {
                        folderId: targetFolderId
                    }
                }
            },
            ["location { folderId }"]
        );

        expect(copyResponse).toEqual({
            data: {
                fileManager: {
                    copyFiles: {
                        data: [
                            {
                                id: expect.any(String),
                                key: expect.any(String),
                                name: sourceA.name,
                                size: sourceA.size,
                                type: sourceA.type,
                                tags: sourceA.tags,
                                aliases: [],
                                location: {
                                    folderId: targetFolderId
                                }
                            },
                            {
                                id: expect.any(String),
                                key: expect.any(String),
                                name: sourceB.name,
                                size: sourceB.size,
                                type: sourceB.type,
                                tags: sourceB.tags,
                                aliases: [],
                                location: {
                                    folderId: targetFolderId
                                }
                            }
                        ],
                        error: null
                    }
                }
            }
        });

        const copiedFiles = copyResponse.data.fileManager.copyFiles.data;
        expect(copiedFiles[0].id).not.toEqual(sourceAId);
        expect(copiedFiles[0].key).not.toEqual(sourceA.key);
        expect(copiedFiles[1].id).not.toEqual(sourceBId);
        expect(copiedFiles[1].key).not.toEqual(sourceB.key);
    });

    test("should apply storage plugin metadata overrides when copying files", async () => {
        const tenantPrefix = `tenant-${mdbid()}`;
        const customStoragePlugin = new FilePhysicalStoragePlugin({
            upload: async () => {},
            delete: async () => {},
            copy: async params => {
                const id = mdbid();

                const nameParts = params.name.split(".");
                const extension = nameParts.length > 1 ? nameParts.pop() || "" : "";
                const baseName = nameParts.join(".") || params.name;
                const copyName = extension ? `${baseName}-copy.${extension}` : `${baseName}-copy`;

                const segments = [tenantPrefix, params.location?.folderId, id, copyName].filter(
                    Boolean
                );

                return {
                    id,
                    key: segments.join("/"),
                    name: copyName,
                    size: params.size + 10,
                    type: `${params.type};copy`
                };
            }
        });

        const { createFiles, copyFiles } = useGqlHandler({ plugins: [customStoragePlugin] });

        const sourceId = mdbid();
        const source = {
            ...fileAData,
            id: sourceId,
            key: `${sourceId}/filenameA.png`
        };

        await createFiles({
            data: [source]
        });

        const targetFolderId = `folder-${mdbid()}`;

        const [copyResponse] = await copyFiles(
            {
                data: {
                    ids: [sourceId],
                    location: {
                        folderId: targetFolderId
                    }
                }
            },
            ["location { folderId }"]
        );

        const copiedFile = copyResponse.data.fileManager.copyFiles.data[0];

        expect(copiedFile.name).toBe("filenameA-copy.png");
        expect(copiedFile.size).toBe(source.size + 10);
        expect(copiedFile.type).toBe(`${source.type};copy`);
        expect(copiedFile.key.startsWith(`${tenantPrefix}/${targetFolderId}`)).toBeTruthy();
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
