import { S3, CopyObjectCommand } from "@webiny/aws-sdk/client-s3/index.js";
import { ContextPlugin } from "@webiny/api";
import type { FileManagerContext, File } from "@webiny/api-file-manager/types.js";
import { executeWithRetry } from "@webiny/utils";

export class S3FileCopier {
    private readonly bucket: string;

    constructor(bucket: string) {
        this.bucket = bucket;
    }

    async copyFiles(files: File[], sourceKeyMap: Map<string, string>) {
        const s3 = this.getS3();

        // Copy each file with retry
        const copiers = files.map(file => {
            const sourceKey = sourceKeyMap.get(file.key);
            if (!sourceKey) {
                console.warn(`No source key found for ${file.key}, skipping S3 copy`);
                return Promise.resolve();
            }

            const copier = async () => {
                console.log(`Copying S3 file from ${sourceKey} to ${file.key}`);

                // Copy the main file
                await s3.send(
                    new CopyObjectCommand({
                        Bucket: this.bucket,
                        CopySource: encodeURIComponent(`${this.bucket}/${sourceKey}`),
                        Key: file.key,
                        MetadataDirective: "COPY",
                        CacheControl: "max-age=31536000"
                    })
                );

                console.log(`Successfully copied main file: ${file.key}`);
            };

            return executeWithRetry(copier, {
                onFailedAttempt: (error: any) => {
                    console.error(`Failed to copy ${sourceKey} to ${file.key}:`, error.message);
                }
            });
        });

        await Promise.all(copiers);
    }

    private getS3() {
        return new S3({ region: process.env.AWS_REGION });
    }
}

export const copyFilesToS3 = () => {
    return new ContextPlugin<FileManagerContext>(context => {
        const s3FileCopier = new S3FileCopier(String(process.env.S3_BUCKET));

        context.fileManager.onFileAfterBatchCreate.subscribe(async ({ files, meta }) => {
            // Only handle copy operations
            if (meta?.operation === "copy" && meta?.sourceKeyMap) {
                console.log(`[copyFilesToS3] Starting S3 copy for ${files.length} files`);
                try {
                    await s3FileCopier.copyFiles(files, meta.sourceKeyMap as Map<string, string>);
                    console.log(`[copyFilesToS3] Successfully copied ${files.length} files to S3`);
                } catch (error) {
                    console.error(`[copyFilesToS3] Error copying files:`, error);
                    throw error;
                }
            }
        });
    });
};
