# ✅ FIXED: GraphQL Comments API Now Exposed

## Issue Identified
The comments GraphQL API was not appearing in introspection because it was using the wrong plugin type.

## Root Cause
- Used: `new GraphQLSchemaPlugin()` from `@webiny/handler-graphql`
- Should use: `createCmsGraphQLSchemaPlugin()` from `~/plugins/index.js`

The `generateSchema` function filters plugins by type `"cms.graphql.schema"`:
```typescript
const schemaPlugins = context.plugins
    .byType<ICmsGraphQLSchemaPlugin>(CmsGraphQLSchemaPlugin.type) // Looks for "cms.graphql.schema"
    .filter(pl => {
        if (typeof pl.isApplicable === "function") {
            return pl.isApplicable(context);
        }
        return true;
    });
```

## Fix Applied
Changed in `packages/api-headless-cms/src/graphql/entryComments.ts`:

**Before:**
```typescript
import { GraphQLSchemaPlugin } from "@webiny/handler-graphql";

const plugin = new GraphQLSchemaPlugin<CmsContext>({
    typeDefs: `...`,
    resolvers: {...}
});
```

**After:**
```typescript
import { createCmsGraphQLSchemaPlugin } from "~/plugins/index.js";

const plugin = createCmsGraphQLSchemaPlugin<CmsContext>({
    typeDefs: `...`,
    resolvers: {...}
});
```

## Status
✅ **Build successful** (timestamp: 18:32)
✅ **Plugin properly registered** as type `"cms.graphql.schema"`
✅ **Will now be picked up** by the schema generator

## Next Steps

**You MUST restart/redeploy for changes to take effect:**

### For Local Development:
```bash
# Stop your current dev server (Ctrl+C)
# Then restart:
yarn webiny watch
# Or:
yarn dev
```

### For Deployed Environment:
```bash
yarn webiny deploy api --env=<your-env>
```

## Verification

After restarting, you should see these in GraphQL introspection:

```graphql
type Query {
  cms: CmsQuery
}

type CmsQuery {
  # New comment queries
  getEntryComment(modelId: ID!, id: ID!): CmsEntryCommentResponse
  listEntryComments(modelId: ID!, where: CmsListEntryCommentsInput!): CmsEntryCommentListResponse
}

type Mutation {
  cms: CmsMutation
}

type CmsMutation {
  # New comment mutations
  createEntryComment(modelId: ID!, data: CmsCreateEntryCommentInput!): CmsEntryCommentResponse
  updateEntryComment(modelId: ID!, id: ID!, data: CmsUpdateEntryCommentInput!): CmsEntryCommentResponse
  deleteEntryComment(modelId: ID!, id: ID!): CmsEntryCommentDeleteResponse
}
```

## Test Query

Try this in Postman after restarting:

```graphql
mutation TestCreateComment {
  cms {
    createEntryComment(
      modelId: "article"
      data: {
        entryId: "your-entry-id#0001"
        body: "Test comment"
      }
    ) {
      data {
        id
        body
        createdOn
        createdBy {
          displayName
        }
      }
      error {
        message
      }
    }
  }
}
```

## Files Changed
- ✅ `packages/api-headless-cms/src/graphql/entryComments.ts` - Fixed plugin type
- ✅ Package rebuilt successfully
- ✅ Ready to use after restart/redeploy

**The fix is complete - just restart your server!** 🎉
