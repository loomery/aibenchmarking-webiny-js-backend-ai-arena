import graphqlHandlerPlugins from "@webiny/handler-graphql";
import { createTenancyAndSecurity } from "~tests/utils/tenancySecurity";
import {
    CmsParametersPlugin,
    createHeadlessCmsContext,
    createHeadlessCmsGraphQL
} from "@webiny/api-headless-cms";
import {
    createFileManagerContext,
    createFileManagerGraphQL,
    FilePhysicalStoragePlugin
} from "~/index";
import { getStorageOps } from "@webiny/project-utils/testing/environment";
import type { FileManagerStorageOperations } from "~/types";
import type { HeadlessCmsStorageOperations } from "@webiny/api-headless-cms/types";
import type { PluginCollection } from "@webiny/plugins/types";
import type { SecurityPermission } from "@webiny/api-core/types/security.js";
import { createApiCore } from "@webiny/api-core";
import type { IdentityData } from "@webiny/api-core/features/security/IdentityContext/index.js";
import { createTestWcpLicense } from "@webiny/wcp/testing/createTestWcpLicense";
import type { ApiCoreStorageOperations } from "@webiny/api-core/types/core.js";
import { mdbid } from "@webiny/utils";

export interface HandlerParams {
    permissions?: SecurityPermission[];
    identity?: IdentityData | null;
    plugins?: PluginCollection;
}

export const handlerPlugins = (params: HandlerParams) => {
    const { permissions, identity, plugins = [] } = params;

    const apiCoreStorage = getStorageOps<ApiCoreStorageOperations>("apiCore");
    const fileManagerStorage = getStorageOps<FileManagerStorageOperations>("fileManager");
    const cmsStorage = getStorageOps<HeadlessCmsStorageOperations>("cms");

    const testProjectLicense = createTestWcpLicense();

    return [
        createApiCore({
            storageOperations: apiCoreStorage.storageOperations,
            testProjectLicense
        }),
        ...cmsStorage.plugins,
        ...fileManagerStorage.plugins,
        graphqlHandlerPlugins(),
        ...createTenancyAndSecurity({ permissions, identity }),
        new CmsParametersPlugin(async () => {
            return {
                locale: "en-US",
                type: "manage"
            };
        }),
        createHeadlessCmsContext({ storageOperations: cmsStorage.storageOperations }),
        createHeadlessCmsGraphQL(),
        createFileManagerContext({
            storageOperations: fileManagerStorage.storageOperations
        }),
        createFileManagerGraphQL(),
        /**
         * Mock physical file storage plugin.
         */
        new FilePhysicalStoragePlugin({
            upload: async () => {},

            delete: async () => {},

            copy: async params => {
                const id = mdbid();
                const fileName = params.key.split("/").pop() || params.name;
                const segments = [params.location?.folderId, id, fileName].filter(Boolean);

                return {
                    id,
                    key: segments.join("/")
                };
            }
        }),
        /**
         * Make sure we dont have undefined plugins value.
         */
        ...(plugins || [])
    ];
};
