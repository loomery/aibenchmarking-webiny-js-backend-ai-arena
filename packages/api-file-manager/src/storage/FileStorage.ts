import type { File, FileManagerContext } from "~/types.js";
import WebinyError from "@webiny/error";
import type {
    FilePhysicalStoragePlugin,
    FilePhysicalStoragePluginCopyResult
} from "~/plugins/FilePhysicalStoragePlugin.js";

export type Result = Record<string, any>;

const storagePluginType = "api-file-manager-storage";

export interface FileStorageUploadParams {
    buffer: Buffer;
    hideInFileManager: boolean | string;
    size: number;
    name: string;
    type: string;
    id?: string;
    key?: string;
    tags?: string[];
    keyPrefix?: string;
}
export interface FileStorageDeleteParams {
    id: string;
    key: string;
}

export interface FileStorageUploadMultipleParams {
    files: FileStorageUploadParams[];
}

export interface FileStorageCopyFilesLocation {
    folderId: string;
}

export interface FileStorageCopyFilesParams {
    ids: string[];
    location?: FileStorageCopyFilesLocation;
}

export interface FileStorageParams {
    context: FileManagerContext;
}
export class FileStorage {
    private readonly context: FileManagerContext;

    constructor({ context }: FileStorageParams) {
        this.context = context;
    }

    get storagePlugin() {
        const storagePlugin = this.context.plugins
            .byType<FilePhysicalStoragePlugin>(storagePluginType)
            .pop();

        if (!storagePlugin) {
            throw new WebinyError(
                `Missing plugin of type "${storagePluginType}".`,
                "STORAGE_PLUGIN_ERROR"
            );
        }

        return storagePlugin;
    }

    async upload(params: FileStorageUploadParams): Promise<Result> {
        const settings = await this.context.fileManager.getSettings();
        if (!settings) {
            throw new WebinyError("Missing File Manager Settings.", "FILE_MANAGER_ERROR");
        }

        // Add file to cloud storage.
        const { file: fileData } = await this.storagePlugin.upload({
            ...params,
            settings
        });

        // Save file in DB.
        return this.context.fileManager.createFile({
            ...fileData,
            meta: {
                private: Boolean(params.hideInFileManager)
            },
            tags: Array.isArray(params.tags) ? params.tags : []
        });
    }

    async uploadFiles({ files }: FileStorageUploadMultipleParams) {
        const settings = await this.context.fileManager.getSettings();
        if (!settings) {
            throw new WebinyError("Missing File Manager Settings.", "FILE_MANAGER_ERROR");
        }

        const filesData = await Promise.all(
            files.map(async item => {
                // TODO: improve types of this.storagePlugin.
                const { file } = await this.storagePlugin.upload({
                    ...item,
                    settings
                });

                return {
                    ...file,
                    meta: {
                        private: Boolean(item.hideInFileManager)
                    },
                    tags: Array.isArray(item.tags) ? item.tags : []
                };
            })
        );

        return this.context.fileManager.createFilesInBatch(filesData);
    }

    async delete(params: FileStorageDeleteParams) {
        const { id, key } = params;
        const { fileManager } = this.context;
        // Delete file from cloud storage.
        await this.storagePlugin.delete({
            key
        });

        // Delete file from the DB.
        return await fileManager.deleteFile(id);
    }

    async copyFiles(params: FileStorageCopyFilesParams): Promise<File[]> {
        const { ids, location } = params;
        if (!Array.isArray(ids) || ids.length === 0) {
            return [];
        }

        const copies: File[] = [];

        for (const fileId of ids) {
            const original = await this.context.fileManager.getFile(fileId);
            const targetLocation = location ?? original.location;

            const copyResult: FilePhysicalStoragePluginCopyResult = await this.storagePlugin.copy({
                key: original.key,
                name: original.name,
                type: original.type,
                size: original.size
            });

            const copyName = copyResult.name ?? original.name;
            const copySize = copyResult.size ?? original.size;
            const copyType = copyResult.type ?? original.type;

            const newFileInput = {
                id: copyResult.id,
                key: copyResult.key,
                name: copyName,
                size: copySize,
                type: copyType,
                meta: { ...(original.meta || {}) },
                location: targetLocation ? { folderId: targetLocation.folderId } : undefined,
                tags: Array.isArray(original.tags) ? [...original.tags] : [],
                aliases: [],
                extensions: original.extensions ? { ...original.extensions } : undefined
            };

            const created = await this.context.fileManager.createFile(newFileInput);
            copies.push(created);
        }

        return copies;
    }
}
