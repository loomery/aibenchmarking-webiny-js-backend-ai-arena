import { S3 } from "@webiny/aws-sdk/client-s3/index.js";
import { FilePhysicalStoragePlugin } from "@webiny/api-file-manager/plugins/FilePhysicalStoragePlugin.js";
import { getPresignedPostPayload } from "~/utils/getPresignedPostPayload.js";
import uploadFileToS3 from "../utils/uploadFileToS3.js";
import { ContextPlugin } from "@webiny/api";
import { createFileNormalizerFromContext } from "~/utils/createFileNormalizerFromContext.js";
import type { PresignedPostPayloadData } from "~/types.js";

const S3_BUCKET = process.env.S3_BUCKET;

const sanitizeKey = (key: string): string => {
    if (!key) {
        return "";
    }
    return key.startsWith("/") ? key.slice(1) : key;
};

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
                        Key: sanitizeKey(key)
                    });
                },
                copy: async params => {
                    const { sourceKey, targetKey } = params;

                    if (!S3_BUCKET) {
                        throw new Error("Missing S3 bucket environment variable.");
                    }

                    const s3 = new S3();
                    const sanitizedSource = sanitizeKey(sourceKey);
                    const sanitizedTarget = sanitizeKey(targetKey);

                    await s3.copyObject({
                        Bucket: S3_BUCKET,
                        Key: sanitizedTarget,
                        CopySource: encodeURIComponent(`${S3_BUCKET}/${sanitizedSource}`)
                    });
                }
            })
        );
    });
};
