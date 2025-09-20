# @vocilia/database

Database layer for Alpha customer feedback system providing type-safe, RLS-compliant database operations with real-time capabilities.

## Overview

This package provides a comprehensive database abstraction layer built on Supabase, featuring:

- Type-safe database operations using generated TypeScript types
- Row Level Security (RLS) compliance for multi-tenant isolation
- Real-time subscriptions with business-level data isolation
- Automatic migration management and schema deployment
- Performance-optimized queries with tolerance matching
- JWT-based authentication integration

## Installation

```bash
# In workspace root
pnpm add @vocilia/database
```

## Quick Start

```typescript
import { database, createDatabaseOperations } from '@vocilia/database'

// Simple usage with default configuration
const operations = database.createOperations()

// Get businesses for authenticated user
const businesses = await operations.business.getBusinessesByUserId(userId)

// Create a new store
const store = await operations.store.createStore({
  businessId,
  name: 'Downtown Location',
  address: '123 Main St'
})
```

## Configuration

### Environment Variables

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key # For migrations only
```

### Custom Configuration

```typescript
import { createDatabaseClientFactory } from '@vocilia/database'

const database = createDatabaseClientFactory({
  supabaseUrl: 'https://custom.supabase.co',
  supabaseAnonKey: 'custom-key'
})
```

## Core Features

### Type-Safe Queries

All database operations are fully typed using generated Supabase types:

```typescript
import { BusinessQueries } from '@vocilia/database'

const businessQueries = new BusinessQueries(supabaseClient)

// TypeScript will enforce correct types
const business = await businessQueries.createBusiness({
  name: string,
  industry: string,
  contactEmail: string
  // All required fields are enforced
})
```

### Row Level Security (RLS)

All queries automatically enforce RLS policies for multi-tenant data isolation:

```typescript
// User can only access their own businesses
const businesses = await operations.business.getBusinessesByUserId(userId)

// Store queries automatically filter by business access
const stores = await operations.store.getStoresByBusinessId(businessId)
```

### Real-time Subscriptions

Subscribe to real-time changes with automatic business isolation:

```typescript
import { createRealtimeSubscriptionManager } from '@vocilia/database'

const realtime = createRealtimeSubscriptionManager(client)

// Subscribe to feedback sessions for a specific business
await realtime.subscribe({
  table: 'feedback_sessions',
  filter: `business_id=eq.${businessId}`,
  callback: (payload) => {
    console.log('New feedback session:', payload.new)
  }
})
```

### Migration Management

```typescript
import { createMigrationRunner } from '@vocilia/database'

const migrationRunner = createMigrationRunner(client, './migrations')

// Run pending migrations
const results = await migrationRunner.runPendingMigrations()

// Check migration status
const status = await migrationRunner.getMigrationStatus()
```

## Available Query Classes

### Business Operations
```typescript
const business = await operations.business.createBusiness(data)
const businesses = await operations.business.getBusinessesByUserId(userId)
const updated = await operations.business.updateBusiness(id, updates)
```

### Store Management
```typescript
const store = await operations.store.createStore(data)
const stores = await operations.store.getStoresByBusinessId(businessId)
const store = await operations.store.getStoreById(storeId)
```

### User Accounts
```typescript
const profile = await operations.userAccount.getUserProfile(userId)
const updated = await operations.userAccount.updateUserProfile(userId, data)
```

### Feedback Sessions
```typescript
const session = await operations.feedbackSession.createSession(data)
const sessions = await operations.feedbackSession.getSessionsByStore(storeId)
```

### Transactions & Verification
```typescript
const transaction = await operations.transaction.createTransaction(data)
const records = await operations.verificationRecord.getRecordsByBusiness(businessId)
```

## Testing

The package includes comprehensive test suites:

```bash
# Run all tests
pnpm test

# Run specific test types
pnpm test:unit      # Unit tests
pnpm test:contract  # Contract tests
pnpm test:integration # Integration tests
pnpm test:performance # Performance tests

# Watch mode
pnpm test:watch

# Coverage report
pnpm test:coverage
```

### Test Categories

- **Unit Tests**: Individual query methods and utilities
- **Contract Tests**: RLS policies and schema validation
- **Integration Tests**: Multi-component workflows
- **Performance Tests**: Query optimization and RLS performance

## Development

```bash
# Build package
pnpm build

# Watch mode
pnpm dev

# Type checking
pnpm typecheck

# Lint code
pnpm lint
```

## Schema Management

Database schema is managed through Supabase migrations in the `/supabase` directory:

- User profiles and authentication
- Business and store hierarchies
- Feedback sessions and context windows
- Transaction verification and compliance
- Permissions and role-based access

## Performance Features

- **Tolerance Matching**: Efficient comparison of feedback data
- **Context Scoring**: Intelligent completeness assessment
- **Optimized Queries**: Indexed lookups and filtered results
- **Connection Pooling**: Managed client connections
- **Real-time Filtering**: Business-level subscription isolation

## Error Handling

```typescript
import { isDatabaseError, formatDatabaseError } from '@vocilia/database'

try {
  const result = await operations.business.createBusiness(data)
} catch (error) {
  if (isDatabaseError(error)) {
    const formatted = formatDatabaseError(error)
    console.error('Database error:', formatted.message)
  }
}
```

## Dependencies

- `@supabase/supabase-js` - Supabase client
- `@vocilia/types` - Shared type definitions

## License

Private package - restricted access