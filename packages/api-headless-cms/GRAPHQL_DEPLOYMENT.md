# GraphQL Schema Deployment Guide

## Issue
The comment API GraphQL schema is not appearing in introspection after building the packages.

## Root Cause
The GraphQL schema is properly defined and extends `CmsQuery` and `CmsMutation` correctly. However, the schema needs to be deployed/restarted for the changes to take effect.

## Solution

### For Local Development:
1. **Restart the API server** - The GraphQL schema is built at runtime, so you need to restart your local dev server
   ```bash
   # Stop your current dev server
   # Then restart it
   yarn webiny watch
   ```

2. **Clear any schema cache** - If using a tool like Postman or GraphiQL, refresh the schema cache

### For Deployed Environment:
1. **Redeploy the API** 
   ```bash
   yarn webiny deploy
   ```
   Or specifically deploy just the API:
   ```bash
   yarn webiny deploy api --env=<your-env>
   ```

## Verification

After restarting/redeploying, you should see these new queries and mutations in your GraphQL introspection:

### Queries:
```graphql
cms {
  getEntryComment(modelId: ID!, id: ID!): CmsEntryCommentResponse
  listEntryComments(modelId: ID!, where: CmsListEntryCommentsInput!): CmsEntryCommentListResponse
}
```

### Mutations:
```graphql
cms {
  createEntryComment(modelId: ID!, data: CmsCreateEntryCommentInput!): CmsEntryCommentResponse
  updateEntryComment(modelId: ID!, id: ID!, data: CmsUpdateEntryCommentInput!): CmsEntryCommentResponse
  deleteEntryComment(modelId: ID!, id: ID!): CmsEntryCommentDeleteResponse
}
```

## Example Usage

### Create a Comment
```graphql
mutation {
  cms {
    createEntryComment(
      modelId: "article"
      data: {
        entryId: "abc123#0001"
        body: "Great article! cc @[John Doe](user-123)"
      }
    ) {
      data {
        id
        body
        mentions
        createdOn
        createdBy {
          id
          displayName
        }
      }
      error {
        message
        code
      }
    }
  }
}
```

### List Comments
```graphql
query {
  cms {
    listEntryComments(
      modelId: "article"
      where: {
        entryId: "abc123#0001"
        parentId: null  # Top-level comments only
      }
    ) {
      data {
        id
        body
        parentId
        createdOn
      }
      meta {
        totalCount
        hasMoreItems
      }
      error {
        message
      }
    }
  }
}
```

## Troubleshooting

If the schema still doesn't appear:

1. **Check the build artifacts**:
   ```bash
   ls -la packages/api-headless-cms/dist/graphql/entryComments.js
   ```
   Should show a recent timestamp

2. **Verify the plugin is registered**:
   Check that `packages/api-headless-cms/dist/graphql/index.js` includes:
   ```javascript
   createEntryCommentsSchemaPlugin()
   ```

3. **Check for GraphQL errors in server logs** - Look for schema merging errors

4. **Verify the package is deployed**:
   ```bash
   # Check the version in node_modules
   cat node_modules/@webiny/api-headless-cms/package.json | grep version
   ```

## Files Modified
- ✅ `packages/api-headless-cms/src/graphql/entryComments.ts` - Fixed type name from `CmsBooleanResponse` to `CmsEntryCommentDeleteResponse`
- ✅ All packages built successfully
- ✅ Schema properly extends `CmsQuery` and `CmsMutation`

The schema is **ready to use** - you just need to restart/redeploy to see it in introspection!
