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
                // Skip if no source key found (shouldn't happen in normal flow)
                return Promise.resolve();
            }

            const copier = async () => {
                // Copy the main file
                await s3.send(
                    new CopyObjectCommand({
                        Bucket: this.bucket,
                        CopySource: `${this.bucket}/${sourceKey}`,
                        Key: file.key,
                        MetadataDirective: "COPY",
                        CacheControl: "max-age=31536000"
                    })
                );

                // Copy the metadata file if it exists
                try {
                    await s3.send(
                        new CopyObjectCommand({
                            Bucket: this.bucket,
                            CopySource: `${this.bucket}/${sourceKey}.metadata`,
                            Key: `${file.key}.metadata`,
                            MetadataDirective: "REPLACE",
                            ContentType: "application/json",
                            CacheControl: "max-age=31536000"
                        })
                    );
                } catch {
                    // Metadata file might not exist, which is fine
                    console.log(`Metadata file not found for ${sourceKey}, skipping.`);
                }
            };

            return executeWithRetry(copier);
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
                await s3FileCopier.copyFiles(files, meta.sourceKeyMap as Map<string, string>);
            }
        });
    });
};
