# Quickstart Guide: Shared Infrastructure

**Generated**: 2025-09-20
**For Feature**: Shared Infrastructure (002-step-1-3)

## Overview

This quickstart guide demonstrates how to use the shared infrastructure components across Vocilia's three applications. It provides step-by-step validation scenarios to verify the implementation works correctly.

## Prerequisites

- Node.js 18+ and PNPM installed
- Access to existing Supabase project (wtdckfgdcryjvbllcajq)
- Access to existing Railway project (5b587bbc-f3b2-4550-97b6-fd906ff5ead1)
- Access to existing Vercel project (alpha)

## Environment Setup

1. **Install dependencies**:
```bash
cd /Users/lucasjenner/alpha
pnpm install
```

2. **Configure environment variables**:
```bash
# Copy example environment file
cp .env.example .env.local

# Add required environment variables
NEXT_PUBLIC_SUPABASE_URL=https://wtdckfgdcryjvbllcajq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
DATABASE_URL=your_database_url
```

3. **Build shared packages**:
```bash
pnpm run build
```

## Validation Scenarios

### Scenario 1: Shared Database Client

**Objective**: Verify typed database queries work across all applications

**Steps**:
1. **Import database client in business app**:
```typescript
// apps/business/src/app/dashboard/page.tsx
import { createServerComponentClient } from '@alpha/database'

export default async function Dashboard() {
  const supabase = createServerComponentClient()

  // This should provide full TypeScript support
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, role, business_id, full_name')
    .single()

  return <div>Welcome, {profile?.full_name}</div>
}
```

2. **Test in customer app**:
```typescript
// apps/customer/src/app/page.tsx
import { createClient } from '@alpha/database'

export default function HomePage() {
  const supabase = createClient()

  // Should have same typed interface
  const handleAuth = async () => {
    const { data } = await supabase.auth.signInWithPassword({
      email: 'test@example.com',
      password: 'password'
    })
  }

  return <button onClick={handleAuth}>Sign In</button>
}
```

3. **Verify admin app access**:
```typescript
// apps/admin/src/app/businesses/page.tsx
import { createServerComponentClient } from '@alpha/database'

export default async function BusinessesPage() {
  const supabase = createServerComponentClient()

  // Admin should access all businesses
  const { data: businesses } = await supabase
    .from('businesses')
    .select('id, name, subscription_status')
    .order('created_at', { ascending: false })

  return (
    <div>
      {businesses?.map(business => (
        <div key={business.id}>{business.name}</div>
      ))}
    </div>
  )
}
```

**Expected Result**: All apps can import and use database client with full TypeScript support

### Scenario 2: Shared Authentication

**Objective**: Verify authentication works consistently across applications

**Steps**:
1. **Set up auth provider in business app**:
```typescript
// apps/business/src/app/layout.tsx
import { AuthProvider } from '@alpha/shared/auth'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
```

2. **Create protected page**:
```typescript
// apps/business/src/app/dashboard/page.tsx
'use client'
import { useAuth, usePermissions } from '@alpha/shared/auth'
import { RouteGuard } from '@alpha/shared/auth/guards'

function DashboardContent() {
  const { user, profile } = useAuth()
  const { hasPermission, isBusinessUser } = usePermissions()

  return (
    <div>
      <h1>Dashboard - {profile?.full_name}</h1>
      <p>Role: {profile?.role}</p>
      {hasPermission('business.read') && (
        <p>Can read business data</p>
      )}
      {isBusinessUser() && (
        <p>Business user confirmed</p>
      )}
    </div>
  )
}

export default function Dashboard() {
  return (
    <RouteGuard requiredRoles={['business_account']}>
      <DashboardContent />
    </RouteGuard>
  )
}
```

3. **Test auth middleware**:
```typescript
// apps/business/middleware.ts
import { createMiddlewareClient } from '@alpha/shared/auth/clients'
import { NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  const supabase = createMiddlewareClient(request)
  const { data: { user } } = await supabase.auth.getUser()

  if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  return NextResponse.next()
}
```

**Expected Result**: Authentication state is consistent across all applications

### Scenario 3: Shared UI Components

**Objective**: Verify UI components work with consistent styling

**Steps**:
1. **Use shared button component**:
```typescript
// apps/business/src/app/page.tsx
import { Button, Card, Input } from '@alpha/ui'

export default function HomePage() {
  return (
    <Card className="p-6">
      <h1 className="text-2xl font-bold mb-4">Business Portal</h1>
      <Input
        placeholder="Search businesses..."
        className="mb-4"
      />
      <Button variant="primary" size="lg">
        Get Started
      </Button>
    </Card>
  )
}
```

2. **Test in admin app**:
```typescript
// apps/admin/src/app/page.tsx
import { Button, Card, DataTable } from '@alpha/ui'

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <Card>
        <h1>Admin Dashboard</h1>
        <Button variant="secondary">Manage Users</Button>
      </Card>
      <DataTable
        columns={[
          { key: 'name', label: 'Business Name' },
          { key: 'status', label: 'Status' }
        ]}
        data={[]}
      />
    </div>
  )
}
```

3. **Verify customer app styling**:
```typescript
// apps/customer/src/app/page.tsx
import { Button, Card } from '@alpha/ui'

export default function CustomerPage() {
  return (
    <Card className="max-w-md mx-auto">
      <h1>Customer Feedback</h1>
      <Button variant="primary" fullWidth>
        Start Feedback
      </Button>
    </Card>
  )
}
```

**Expected Result**: All UI components render consistently with Tailwind styling

### Scenario 4: Backend API Integration

**Objective**: Verify backend API serves all frontend applications

**Steps**:
1. **Start backend server**:
```bash
cd apps/backend
pnpm dev
```

2. **Test health endpoint**:
```bash
curl -X GET http://localhost:3001/health
# Expected: {"status":"healthy","timestamp":"...","uptime":...}
```

3. **Test authentication endpoint**:
```bash
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

4. **Test CORS with different origins**:
```javascript
// Test from business app (localhost:3000)
fetch('http://localhost:3001/api/v1/auth/profile', {
  headers: {
    'Authorization': 'Bearer your_token',
    'Origin': 'http://localhost:3000'
  }
})

// Test from admin app (localhost:3002)
fetch('http://localhost:3001/api/v1/businesses', {
  headers: {
    'Authorization': 'Bearer your_token',
    'Origin': 'http://localhost:3002'
  }
})
```

**Expected Result**: API responds correctly with proper CORS headers

### Scenario 5: Shared Utilities and Types

**Objective**: Verify utilities and types work across applications

**Steps**:
1. **Use validation utilities**:
```typescript
// apps/business/src/app/stores/create/page.tsx
import { validateEmail, formatPhoneNumber } from '@alpha/shared/utils'
import { CreateStoreRequest } from '@alpha/types'

export default function CreateStorePage() {
  const handleSubmit = (data: CreateStoreRequest) => {
    // Validation should work with TypeScript support
    if (!validateEmail(data.contact_email)) {
      throw new Error('Invalid email')
    }

    const formattedPhone = formatPhoneNumber(data.phone_number)
    // Submit store creation...
  }

  return <form onSubmit={handleSubmit}>...</form>
}
```

2. **Test type safety across packages**:
```typescript
// apps/admin/src/app/businesses/page.tsx
import { Business, UserProfile } from '@alpha/types'
import { createClient } from '@alpha/database'

export default function BusinessesPage() {
  const [businesses, setBusinesses] = useState<Business[]>([])

  // Types should be consistent across all apps
  const fetchBusinesses = async (): Promise<Business[]> => {
    const supabase = createClient()
    const { data } = await supabase
      .from('businesses')
      .select('*') // Should return Business[] type

    return data || []
  }

  return <div>...</div>
}
```

**Expected Result**: All utilities and types work consistently with full TypeScript support

## Success Criteria

### ✅ Functional Validation
- [ ] Database client provides typed queries in all three apps
- [ ] Authentication state synchronizes across applications
- [ ] UI components render consistently with shared styling
- [ ] Backend API serves all frontends with proper CORS
- [ ] Shared utilities and types provide TypeScript support

### ✅ Performance Validation
- [ ] Initial page load < 3 seconds for all apps
- [ ] API responses < 200ms for health and auth endpoints
- [ ] Database queries execute efficiently with RLS policies
- [ ] Shared package imports don't significantly increase bundle size

### ✅ Security Validation
- [ ] RLS policies enforce business data isolation
- [ ] Authentication tokens work consistently across apps
- [ ] API endpoints require proper authentication
- [ ] CORS only allows approved domain origins
- [ ] No sensitive data exposed in error messages

### ✅ Development Validation
- [ ] TypeScript strict mode passes for all packages
- [ ] Hot reload works with shared package changes
- [ ] Build process completes successfully for all apps
- [ ] Tests pass for shared components and utilities
- [ ] Linting passes for all shared code

## Troubleshooting

### Common Issues

**Issue**: TypeScript errors with shared packages
**Solution**: Ensure all packages have proper type exports in package.json

**Issue**: Authentication not working across apps
**Solution**: Verify environment variables are set correctly in all applications

**Issue**: CORS errors from backend
**Solution**: Check ALLOWED_ORIGINS environment variable includes all frontend URLs

**Issue**: Database connection failures
**Solution**: Verify DATABASE_URL and Supabase credentials are correct

**Issue**: Build failures with shared packages
**Solution**: Ensure proper build order with `pnpm run build` from root

## Next Steps

After successful validation:
1. Deploy backend to Railway environment
2. Deploy frontend applications to Vercel
3. Configure production environment variables
4. Set up monitoring and logging
5. Implement end-to-end tests

This quickstart guide ensures the shared infrastructure works correctly across all applications while maintaining production-ready quality standards.