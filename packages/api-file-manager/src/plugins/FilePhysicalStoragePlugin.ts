import { Plugin } from "@webiny/plugins";
import WebinyError from "@webiny/error";
import type { FileManagerSettings } from "~/types.js";

export interface FilePhysicalStoragePluginCopyLocation {
    folderId?: string;
}

export interface FilePhysicalStoragePluginCopyParams {
    key: string;
    name: string;
    type: string;
    size: number;
    location?: FilePhysicalStoragePluginCopyLocation;
}

export interface FilePhysicalStoragePluginCopyResult {
    id: string;
    key: string;
    name?: string;
    size?: number;
    type?: string;
}

export interface FilePhysicalStoragePluginParams<
    U extends FilePhysicalStoragePluginUploadParams,
    D extends FilePhysicalStoragePluginDeleteParams,
    C extends FilePhysicalStoragePluginCopyParams
> {
    upload: (args: U) => Promise<any>;
    delete: (args: D) => Promise<void>;
    copy: (args: C) => Promise<FilePhysicalStoragePluginCopyResult>;
}

export interface FilePhysicalStoragePluginUploadParams {
    settings: FileManagerSettings;
    buffer: Buffer;
}

export interface FilePhysicalStoragePluginDeleteParams {
    key: string;
}

export class FilePhysicalStoragePlugin<
    U extends FilePhysicalStoragePluginUploadParams = FilePhysicalStoragePluginUploadParams,
    D extends FilePhysicalStoragePluginDeleteParams = FilePhysicalStoragePluginDeleteParams,
    C extends FilePhysicalStoragePluginCopyParams = FilePhysicalStoragePluginCopyParams
> extends Plugin {
    public static override readonly type: string = "api-file-manager-storage";
    private readonly _params: FilePhysicalStoragePluginParams<U, D, C>;

    public constructor(params: FilePhysicalStoragePluginParams<U, D, C>) {
        super();
        this._params = params;
    }

    public async upload(params: U): Promise<any> {
        if (!this._params.upload) {
            throw new WebinyError(
                `You must define the "upload" method of this plugin.`,
                "UPLOAD_METHOD_ERROR"
            );
        }
        return this._params.upload(params);
    }

    public async copy(params: C): Promise<FilePhysicalStoragePluginCopyResult> {
        if (!this._params.copy) {
            throw new WebinyError(
                `You must define the "copy" method of this plugin.`,
                "COPY_METHOD_ERROR"
            );
        }
        return this._params.copy(params);
    }

    public async delete(params: D): Promise<any> {
        if (!this._params.delete) {
            throw new WebinyError(
                `You must define the "delete" method of this plugin.`,
                "DELETE_METHOD_ERROR"
            );
        }
        return this._params.delete(params);
    }
}
