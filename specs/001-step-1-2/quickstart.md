# Quickstart: Database Foundation Setup

**Feature**: Database Foundation for Customer Feedback System
**Prerequisites**: Supabase account, existing "alpha" project (wtdckfgdcryjvbllcajq)
**Estimated Time**: 30-45 minutes

## Overview
This quickstart guide will help you set up the database foundation for the Vocilia customer feedback system. By the end, you'll have a fully configured Supabase database with all schemas, Row Level Security policies, and basic test data.

## Prerequisites Checklist
- [ ] Supabase account with access to project `wtdckfgdcryjvbllcajq`
- [ ] Supabase CLI installed (`npm install -g supabase`)
- [ ] Node.js 18+ and pnpm installed
- [ ] Git repository cloned and positioned in project root
- [ ] Environment variables ready (see step 1)

## Step 1: Environment Setup

### 1.1 Install Dependencies
```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Navigate to project root
cd /path/to/alpha

# Install project dependencies
pnpm install
```

### 1.2 Configure Environment Variables
Create `.env.local` in the project root:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://wtdckfgdcryjvbllcajq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Database Configuration
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.wtdckfgdcryjvbllcajq.supabase.co:5432/postgres
```

**Get your keys from**: [Supabase Dashboard](https://supabase.com/dashboard/project/wtdckfgdcryjvbllcajq/settings/api)

### 1.3 Verify Supabase Connection
```bash
# Login to Supabase CLI
supabase login

# Link to existing project
supabase link --project-ref wtdckfgdcryjvbllcajq

# Test connection
supabase status
```

**Expected Output**:
```
supabase local development setup is running.
API URL: https://wtdckfgdcryjvbllcajq.supabase.co
DB URL: postgresql://postgres:[YOUR-PASSWORD]@db.wtdckfgdcryjvbllcajq.supabase.co:5432/postgres
```

## Step 2: Database Schema Setup

### 2.1 Apply Database Schema
```bash
# Navigate to contracts directory
cd specs/001-step-1-2/contracts

# Apply schema to Supabase
supabase db reset --db-url $DATABASE_URL
psql $DATABASE_URL -f schema.sql
```

### 2.2 Verify Schema Installation
```bash
# Check if tables were created
psql $DATABASE_URL -c "\dt"
```

**Expected Output**: Should list all 7 tables (businesses, user_accounts, stores, context_window, transactions, feedback_sessions, verification_record)

### 2.3 Verify RLS Policies
```bash
# Check RLS policies
psql $DATABASE_URL -c "SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public';"
```

**Expected Output**: Should show RLS policies for all tables

## Step 3: Create Database Package

### 3.1 Initialize Shared Database Package
```bash
# Return to project root
cd ../../../

# Create database package structure
mkdir -p packages/database/src/{client,types,queries,migrations}
mkdir -p packages/database/tests
```

### 3.2 Create Package Configuration
Create `packages/database/package.json`:

```json
{
  "name": "@alpha/database",
  "version": "0.1.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "jest",
    "lint": "eslint src --ext .ts"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.39.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "jest": "^29.0.0",
    "@types/jest": "^29.0.0"
  }
}
```

### 3.3 Create TypeScript Configuration
Create `packages/database/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### 3.4 Copy Generated Types
```bash
# Copy TypeScript types from contracts
cp specs/001-step-1-2/contracts/types.ts packages/database/src/types/
```

### 3.5 Create Database Client
Create `packages/database/src/client/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
  },
});

export type SupabaseClient = typeof supabase;
```

### 3.6 Create Index File
Create `packages/database/src/index.ts`:

```typescript
// Export client
export { supabase } from './client/supabase';
export type { SupabaseClient } from './client/supabase';

// Export all types
export * from './types/types';

// Export queries (to be created later)
// export * from './queries';
```

## Step 4: Test Basic Operations

### 4.1 Create Test Script
Create `packages/database/tests/basic-operations.test.ts`:

```typescript
import { supabase } from '../src';
import type { BusinessInsert, StoreInsert } from '../src';

describe('Database Basic Operations', () => {
  test('should connect to Supabase', async () => {
    const { data, error } = await supabase.from('businesses').select('count');
    expect(error).toBeNull();
    expect(data).toBeDefined();
  });

  test('should create business with RLS enforcement', async () => {
    const businessData: BusinessInsert = {
      name: 'Test Business',
      email: 'test@example.com',
      phone: '+46701234567',
      settings: { test: true }
    };

    // This should fail without proper authentication
    const { data, error } = await supabase
      .from('businesses')
      .insert(businessData)
      .select();

    // Expected to fail due to RLS policies
    expect(error).toBeDefined();
    expect(error?.code).toBe('42501'); // Insufficient privilege
  });
});
```

### 4.2 Run Tests
```bash
cd packages/database
pnpm install
pnpm test
```

**Expected Output**: Tests should run and demonstrate RLS policy enforcement

## Step 5: Verify Real-time Subscriptions

### 5.1 Create Real-time Test
Create `packages/database/tests/realtime.test.ts`:

```typescript
import { supabase } from '../src';

describe('Real-time Subscriptions', () => {
  test('should establish real-time connection', async () => {
    let connectionEstablished = false;

    const channel = supabase
      .channel('test-channel')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'businesses'
      }, () => {
        connectionEstablished = true;
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          connectionEstablished = true;
        }
      });

    // Wait for connection
    await new Promise(resolve => setTimeout(resolve, 1000));

    expect(connectionEstablished).toBe(true);

    // Cleanup
    await supabase.removeChannel(channel);
  });
});
```

## Step 6: Create Sample Authentication Setup

### 6.1 Create Auth Helper
Create `packages/database/src/auth/auth-helper.ts`:

```typescript
import { supabase } from '../client/supabase';
import type { UserRole } from '../types/types';

export interface AuthUser {
  id: string;
  email: string;
  business_id?: string;
  role: UserRole;
}

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Get user account details with business association
  const { data: userAccount } = await supabase
    .from('user_accounts')
    .select('business_id, role')
    .eq('id', user.id)
    .single();

  return {
    id: user.id,
    email: user.email!,
    business_id: userAccount?.business_id,
    role: userAccount?.role || 'business_staff'
  };
}
```

## Step 7: Validation Checklist

### 7.1 Database Schema Validation
```bash
# Check all tables exist
psql $DATABASE_URL -c "\dt" | grep -E "(businesses|user_accounts|stores|context_window|transactions|feedback_sessions|verification_record)"
```
**Expected**: All 7 tables listed

### 7.2 RLS Policy Validation
```bash
# Check RLS is enabled
psql $DATABASE_URL -c "SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';"
```
**Expected**: All tables show `rowsecurity = true`

### 7.3 Index Validation
```bash
# Check critical indexes exist
psql $DATABASE_URL -c "SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE 'idx_%';"
```
**Expected**: Multiple performance indexes listed

### 7.4 Function Validation
```bash
# Check utility functions exist
psql $DATABASE_URL -c "SELECT proname FROM pg_proc WHERE proname IN ('create_time_tolerance', 'create_amount_tolerance', 'calculate_context_score');"
```
**Expected**: All 3 functions listed

### 7.5 TypeScript Package Validation
```bash
cd packages/database
pnpm build
```
**Expected**: Clean TypeScript compilation

## Step 8: Next Steps

### 8.1 Update Workspace Configuration
Add database package to `pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

### 8.2 Install in Apps
```bash
# In each app directory (apps/customer, apps/business, apps/admin)
pnpm add @alpha/database
```

### 8.3 Ready for Integration
The database foundation is now ready for:
- Business application integration
- Customer verification workflows
- Admin verification management
- Real-time feedback collection

## Troubleshooting

### Common Issues

**Issue**: Supabase connection fails
**Solution**: Verify environment variables and project ref

**Issue**: RLS policies block operations
**Solution**: Ensure proper JWT tokens with business_id and role claims

**Issue**: TypeScript compilation errors
**Solution**: Check tsconfig.json strict mode settings

**Issue**: Real-time subscriptions not working
**Solution**: Verify Supabase real-time is enabled in dashboard

### Support Resources
- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Project Repository Issues](https://github.com/Lakakaku/alpha/issues)

## Success Criteria
- ✅ All database tables created with proper constraints
- ✅ RLS policies enforcing business data isolation
- ✅ TypeScript types available for all entities
- ✅ Database package builds and exports successfully
- ✅ Basic operations demonstrate security enforcement
- ✅ Real-time subscriptions functional
- ✅ Ready for application integration

**Estimated completion time**: 30-45 minutes
**Next phase**: Ready for `/tasks` command to generate implementation tasks