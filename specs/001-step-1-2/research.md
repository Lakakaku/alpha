# Technical Research: Database Foundation

**Date**: 2025-09-18
**Feature**: Database Foundation for Customer Feedback System
**Research Phase**: Phase 0 - Technical Decision Making

## Research Areas

### 1. Supabase RLS Multi-Tenant Patterns for Business Data Isolation

**Decision**: Implement tenant-based RLS using business_id foreign keys with organization-level isolation

**Rationale**:
- Supabase RLS policies can enforce business_id filtering at the database level
- Each business acts as a separate tenant with complete data isolation
- Built-in PostgreSQL security model prevents data leakage between businesses
- Supports multi-store businesses through hierarchical business → store relationships

**Alternatives Considered**:
- Schema-based multi-tenancy: Rejected due to complexity and Supabase limitations
- Application-level filtering: Rejected due to security risks and human error potential
- Database-per-tenant: Rejected due to Supabase single-database model

**Implementation Approach**:
```sql
-- Example RLS policy pattern
CREATE POLICY "business_isolation" ON feedback_sessions
FOR ALL USING (
  business_id = auth.jwt() ->> 'business_id'::text
);
```

### 2. Supabase Client Sharing in Next.js Monorepo

**Decision**: Create shared `@alpha/database` package with singleton client pattern

**Rationale**:
- Single source of truth for database configuration across all apps
- Consistent authentication and RLS policy enforcement
- Shared TypeScript types reduce duplication and errors
- Enables atomic migrations across the entire system

**Alternatives Considered**:
- Per-app Supabase clients: Rejected due to configuration drift and type inconsistencies
- Global singleton without package: Rejected due to poor dependency management
- Dynamic client creation: Rejected due to performance and connection pooling issues

**Implementation Approach**:
```typescript
// packages/database/src/client.ts
export const createClient = () => {
  return createClientBase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
};
```

### 3. Transaction Verification Database Patterns with Tolerance Matching

**Decision**: Implement time-based and amount-based tolerance using PostgreSQL range types and indexing

**Rationale**:
- PostgreSQL tsrange for time tolerance (±2 minutes) with GiST indexing
- Numeric ranges for amount tolerance (±2 SEK) with efficient querying
- Built-in overlap operators for fast tolerance matching
- Supports complex verification queries with multiple tolerance parameters

**Alternatives Considered**:
- Application-level tolerance checking: Rejected due to performance and complexity
- Separate tolerance tables: Rejected due to query complexity and join overhead
- Fixed tolerance values in code: Rejected due to inflexibility and maintenance issues

**Implementation Approach**:
```sql
-- Transaction table with tolerance ranges
CREATE TABLE transactions (
  id UUID PRIMARY KEY,
  store_id UUID REFERENCES stores(id),
  customer_time tsrange,  -- [submitted_time - 2min, submitted_time + 2min]
  customer_amount numrange, -- [submitted_amount - 2, submitted_amount + 2]
  verification_status verification_status_enum
);

-- Index for fast tolerance matching
CREATE INDEX idx_transactions_time_amount ON transactions
USING GIST (customer_time, customer_amount);
```

### 4. Database Indexing Strategies for Real-time Feedback Collection

**Decision**: Implement composite indexes on business_id + created_at with partial indexes for active sessions

**Rationale**:
- Business-specific queries are the primary access pattern
- Time-based ordering for feedback analysis and reporting
- Partial indexes on active sessions reduce index size and improve performance
- B-tree indexes optimal for range queries and sorting

**Alternatives Considered**:
- Single column indexes: Rejected due to poor performance on filtered queries
- Covering indexes: Rejected due to storage overhead and limited benefit
- Hash indexes: Rejected due to lack of range query support

**Implementation Approach**:
```sql
-- Primary access pattern: business feedback sessions by time
CREATE INDEX idx_feedback_sessions_business_time ON feedback_sessions
(business_id, created_at DESC);

-- Partial index for active sessions only
CREATE INDEX idx_feedback_sessions_active ON feedback_sessions
(store_id, status) WHERE status = 'active';

-- Verification workflow queries
CREATE INDEX idx_transactions_verification ON transactions
(store_id, verification_status, created_at);
```

## Security Model Research

### Row Level Security (RLS) Policy Patterns

**Decision**: Three-tier RLS model: Business isolation → Store access → Role permissions

**Policy Structure**:
1. **Business Isolation**: Prevent cross-business data access
2. **Store Access**: Control multi-store business access within business
3. **Role Permissions**: Admin vs business user vs customer access levels

**Example Policy Implementation**:
```sql
-- Tier 1: Business isolation (applies to all business-related tables)
CREATE POLICY "enforce_business_isolation" ON stores
FOR ALL USING (business_id = auth.jwt() ->> 'business_id'::text);

-- Tier 2: Store access within business
CREATE POLICY "store_access_within_business" ON feedback_sessions
FOR ALL USING (
  store_id IN (
    SELECT id FROM stores
    WHERE business_id = auth.jwt() ->> 'business_id'::text
  )
);

-- Tier 3: Role-based access
CREATE POLICY "admin_full_access" ON businesses
FOR ALL USING (auth.jwt() ->> 'role'::text = 'admin');
```

## Real-time Subscription Patterns

**Decision**: Channel-based subscriptions with business_id filtering for security

**Rationale**:
- Supabase real-time uses PostgreSQL logical replication
- Channel names include business_id for automatic filtering
- Subscription security enforced at channel level
- Optimal for feedback collection and verification workflows

**Implementation Pattern**:
```typescript
// Real-time subscription with business isolation
const channel = supabase
  .channel(`business:${businessId}:feedback`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'feedback_sessions',
    filter: `business_id=eq.${businessId}`
  }, handleNewFeedback)
  .subscribe();
```

## Performance Considerations

### Connection Pooling Strategy

**Decision**: Use Supabase connection pooling with PgBouncer in transaction mode

**Rationale**:
- Handles high concurrent feedback collection load
- Automatic connection management for Railway backend APIs
- Supports both short-lived (frontend) and long-lived (backend) connections
- Built into Supabase infrastructure

### Query Optimization

**Decision**: Prepared statements with TypeScript query builders for complex operations

**Benefits**:
- Query plan caching for repeated operations
- SQL injection prevention through parameterization
- Type safety for complex multi-table operations
- Performance monitoring through Supabase dashboard

## Migration Strategy

**Decision**: Incremental migration files with rollback capability

**Approach**:
- Version-controlled SQL migration files
- Supabase CLI for migration management
- Rollback scripts for each migration
- Testing migrations in development branches

## Research Conclusions

All technical decisions align with constitutional requirements:
- ✅ Production-ready Supabase usage from day one
- ✅ Strict RLS enforcement for business data isolation
- ✅ TypeScript strict mode compatibility
- ✅ Real-time capabilities for feedback collection
- ✅ Performance optimization for scale
- ✅ Security-first approach with defense in depth

**Next Phase**: Proceed to Phase 1 (Design & Contracts) with these technical foundations.