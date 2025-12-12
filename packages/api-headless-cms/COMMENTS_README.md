# CMS Entry Comments System

## Overview

This implementation adds a comprehensive commenting system for CMS entries in the Webiny Headless CMS. The system enables editorial discussions and feedback on content entries.

## Features

### Core Functionality
- **Create Comments**: Add comments to any CMS entry
- **Update Comments**: Edit existing comments
- **Delete Comments**: Soft delete comments (preserves data with deletion timestamp)
- **List Comments**: Retrieve comments for an entry with pagination
- **Threaded Comments**: Support for replies (parent-child relationships)
- **User Mentions**: Tag users in comments using `@[DisplayName](userId)` syntax

### Technical Features
- Multi-tenant and locale-aware
- Identity tracking (who created/modified/deleted)
- Lifecycle hooks for extensibility
- GraphQL API
- DynamoDB storage implementation
- Soft deletes

## API Usage

### GraphQL API

#### Create a Comment

```graphql
mutation {
  cms {
    createEntryComment(
      modelId: "article"
      data: {
        entryId: "entry-id"
        body: "Great article! Thanks @[John](user-123)"
        parentId: null  # Optional: for threaded replies
      }
    ) {
      data {
        id
        body
        entryId
        parentId
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

#### Update a Comment

```graphql
mutation {
  cms {
    updateEntryComment(
      modelId: "article"
      id: "comment-id"
      data: {
        body: "Updated comment text"
        mentions: ["user-123"]
      }
    ) {
      data {
        id
        body
        modifiedOn
        modifiedBy {
          id
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

#### Delete a Comment

```graphql
mutation {
  cms {
    deleteEntryComment(
      modelId: "article"
      id: "comment-id"
    ) {
      data
      error {
        message
      }
    }
  }
}
```

#### Get a Single Comment

```graphql
query {
  cms {
    getEntryComment(
      modelId: "article"
      id: "comment-id"
    ) {
      data {
        id
        body
        entryId
        createdBy {
          id
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

#### List Comments for an Entry

```graphql
query {
  cms {
    listEntryComments(
      modelId: "article"
      where: {
        entryId: "entry-id"
        parentId: null  # Get top-level comments only
        limit: 20
        after: null  # For pagination
        includeDeleted: false
      }
    ) {
      data {
        id
        body
        parentId
        mentions
        createdOn
        createdBy {
          id
          displayName
        }
      }
      meta {
        cursor
        hasMoreItems
        totalCount
      }
      error {
        message
      }
    }
  }
}
```

#### List Replies to a Comment

```graphql
query {
  cms {
    listEntryComments(
      modelId: "article"
      where: {
        entryId: "entry-id"
        parentId: "parent-comment-id"  # Get replies to this comment
      }
    ) {
      data {
        id
        body
        parentId
      }
      meta {
        totalCount
      }
    }
  }
}
```

### Programmatic API (Context)

```typescript
// Create a comment
const comment = await context.cms.createEntryComment(model, {
    entryId: entry.id,
    body: "Great work!",
    parentId: null, // Optional: for replies
    mentions: ["user-123"] // Optional: explicit mentions
});

// Update a comment
const updated = await context.cms.updateEntryComment(model, commentId, {
    body: "Updated text",
    mentions: ["user-456"]
});

// Delete a comment
await context.cms.deleteEntryComment(model, commentId);

// Get a comment
const comment = await context.cms.getEntryComment(model, commentId);

// List comments
const [comments, meta] = await context.cms.listEntryComments(model, {
    entryId: entry.id,
    parentId: null, // null for top-level, or a comment ID for replies
    limit: 20,
    after: cursor,
    includeDeleted: false
});
```

## Architecture

### Data Model

```typescript
interface CmsEntryComment {
    id: string;                      // Unique comment ID
    entryId: string;                 // Entry this comment belongs to
    modelId: string;                 // Model ID of the entry
    body: string;                    // Comment text
    parentId: string | null;         // Parent comment ID (for threading)
    mentions: string[];              // User IDs mentioned
    tenant: string;                  // Tenant ID
    locale: string;                  // Locale code
    createdOn: string;               // ISO 8601 timestamp
    createdBy: CmsIdentity;          // Who created it
    modifiedOn: string | null;       // ISO 8601 timestamp
    modifiedBy: CmsIdentity | null;  // Who last modified it
    deletedOn: string | null;        // ISO 8601 timestamp (soft delete)
    deletedBy: CmsIdentity | null;   // Who deleted it
    webinyVersion: string;           // Webiny version
}
```

### Storage Schema (DynamoDB)

- **Partition Key (PK)**: `COMMENT#ENTRY#{entryId}`
- **Sort Key (SK)**: `COMMENT#{commentId}`
- **Type**: `cms.entry.comment`

This design allows efficient querying of all comments for a given entry.

### Lifecycle Hooks

The system provides hooks for extending functionality:

```typescript
// Before creating a comment
context.cms.onEntryCommentBeforeCreate.subscribe(async ({ comment, model }) => {
    // Validate, transform, or reject
});

// After creating a comment
context.cms.onEntryCommentAfterCreate.subscribe(async ({ comment, model }) => {
    // Send notifications, update analytics, etc.
});

// Similarly for update and delete:
// - onEntryCommentBeforeUpdate
// - onEntryCommentAfterUpdate
// - onEntryCommentBeforeDelete
// - onEntryCommentAfterDelete
```

## User Mention Syntax

Comments support user mentions using the format:

```
@[Display Name](userId)
```

Example:
```
"Great work @[John Doe](user-123) and @[Jane Smith](user-456)!"
```

The system automatically extracts user IDs from this syntax and populates the `mentions` array.

## Threading

Comments support one level of threading:
- **Top-level comments**: `parentId` is `null`
- **Replies**: `parentId` references the parent comment ID

To get all top-level comments:
```typescript
const [comments] = await context.cms.listEntryComments(model, {
    entryId: entry.id,
    parentId: null
});
```

To get replies to a specific comment:
```typescript
const [replies] = await context.cms.listEntryComments(model, {
    entryId: entry.id,
    parentId: parentCommentId
});
```

## Security & Permissions

Comments inherit the same permission model as entries:
- Users must have read access to the entry's model to view/add comments
- The existing `cms.contentEntry` permission controls comment access
- All operations are tenant and locale-scoped

## Soft Deletes

Comments use soft deletes:
- `deletedOn` timestamp is set
- `deletedBy` identity is recorded
- Deleted comments are excluded from listings by default
- Use `includeDeleted: true` to retrieve deleted comments

## Files Modified/Created

### Core Package (@webiny/api-headless-cms)
- **New**: `src/types/comments.ts` - TypeScript interfaces
- **New**: `src/crud/contentEntryComments.crud.ts` - CRUD operations
- **New**: `src/graphql/entryComments.ts` - GraphQL schema and resolvers
- **Modified**: `src/types/index.ts` - Export comment types
- **Modified**: `src/types/types.ts` - Add comment context to HeadlessCms
- **Modified**: `src/context.ts` - Wire up comment CRUD
- **Modified**: `src/graphql/index.ts` - Register comment schema

### DynamoDB Package (@webiny/api-headless-cms-ddb)
- **New**: `src/operations/comment/index.ts` - DynamoDB storage implementation
- **Modified**: `src/types.ts` - Export comment storage operations type
- **Modified**: `src/index.ts` - Wire up comment storage operations

### Tests
- **New**: `__tests__/comments/comments.crud.test.ts` - CRUD tests
- **New**: `__tests__/comments/comments.graphql.test.ts` - GraphQL API tests

## Future Enhancements

Potential improvements for future iterations:
1. **Nested Threading**: Support multiple levels of nesting
2. **Rich Text**: Support formatted text in comment bodies
3. **Reactions**: Add emoji reactions to comments
4. **Notifications**: Send notifications when users are mentioned
5. **Edit History**: Track comment edit history
6. **Moderation**: Add moderation workflow for comments
7. **Search**: Full-text search across comments
8. **Attachments**: Allow file attachments in comments
9. **Real-time Updates**: WebSocket/GraphQL subscriptions for live comments

## Testing

Run the comment tests:

```bash
# Run all CMS tests
yarn test

# Run only comment tests
yarn test comments
```

## Migration Notes

For existing Webiny installations, no migration is needed. The commenting system is opt-in and doesn't affect existing data or functionality.

The DynamoDB table structure is designed to coexist with existing entry data using different partition keys.
