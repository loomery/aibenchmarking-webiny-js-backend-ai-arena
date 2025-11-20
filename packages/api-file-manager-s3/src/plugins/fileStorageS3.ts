import { S3 } from "@webiny/aws-sdk/client-s3/index.js";
import { FilePhysicalStoragePlugin } from "@webiny/api-file-manager/plugins/FilePhysicalStoragePlugin.js";
import { getPresignedPostPayload } from "~/utils/getPresignedPostPayload.js";
import uploadFileToS3 from "../utils/uploadFileToS3.js";
import { ContextPlugin } from "@webiny/api";
import { createFileNormalizerFromContext } from "~/utils/createFileNormalizerFromContext.js";
import type { PresignedPostPayloadData } from "~/types.js";
import { mdbid } from "@webiny/utils";
import { FileKey } from "~/utils/FileKey.js";

const S3_BUCKET = process.env.S3_BUCKET;

export default () => {
    /**
     * We need to extend the type for FilePhysicalStoragePlugin.
     * Otherwise, the `getPresignedPostPayload` doesn't know it has all required values in params.
     */
    return new ContextPlugin(context => {
        context.plugins.register(
            new FilePhysicalStoragePlugin({
                upload: async params => {
                    const { settings, buffer, ...data } = params;

                    const normalizer = createFileNormalizerFromContext(context);

                    const { data: preSignedPostPayload, file } = await getPresignedPostPayload(
                        await normalizer.normalizeFile(data as PresignedPostPayloadData),
                        settings
                    );

                    const response = await uploadFileToS3(buffer, preSignedPostPayload);
                    if (!response.ok) {
                        throw Error("Unable to upload file.");
                    }

                    return {
                        data: preSignedPostPayload,
                        file
                    };
                },
                delete: async params => {
                    const { key } = params;
                    const s3 = new S3();

                    if (!key || !S3_BUCKET) {
                        return;
                    }

                    await s3.deleteObject({
                        Bucket: S3_BUCKET,
                        Key: key
                    });
                },
                copy: async params => {
                    const { key, name, type, location } = params;
                    const s3 = new S3();

                    if (!key || !S3_BUCKET) {
                        throw new Error("Missing key or S3_BUCKET.");
                    }

                    const id = mdbid();

                    const fileKey = new FileKey({
                        id,
                        name,
                        type,
                        size: 0,
                        keyPrefix: location?.folderId
                    });
                    const newKey = fileKey.toString();

                    await s3.copyObject({
                        Bucket: S3_BUCKET,
                        CopySource: `${S3_BUCKET}/${key}`,
                        Key: newKey
                    });

                    return {
                        key: newKey,
                        id
                    };
                }
            })
        );
    });
};
