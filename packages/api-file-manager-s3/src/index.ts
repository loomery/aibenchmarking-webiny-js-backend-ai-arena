import graphqlFileStorageS3 from "./plugins/graphqlFileStorageS3.js";
import fileStorageS3 from "./plugins/fileStorageS3.js";
import { addFileMetadata } from "./plugins/addFileMetadata.js";
import { copyFilesToS3 } from "./plugins/copyFilesToS3.js";
import { flushCdnCache } from "~/flushCdnCache/index.js";

export { createFileUploadModifier } from "./utils/FileUploadModifier.js";
export { createAssetDelivery } from "./assetDelivery/createAssetDelivery.js";
export { createCustomAssetDelivery } from "./assetDelivery/createCustomAssetDelivery.js";

export default () => [
    fileStorageS3(),
    graphqlFileStorageS3,
    addFileMetadata(),
    copyFilesToS3(),
    flushCdnCache()
];
