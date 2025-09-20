# @vocilia/auth

Authentication utilities, hooks, and components for Vocilia applications.

## Overview

This package provides a complete authentication solution for all Vocilia applications, including React hooks, providers, guards, middleware, and utilities for managing user authentication and authorization.

## Features

- 🔐 **Supabase Auth Integration** - Built on Supabase Auth v2
- ⚛️ **React Hooks & Providers** - Easy integration with React applications
- 🛡️ **Auth Guards & Middleware** - Protect routes and API endpoints
- 🎯 **Permission System** - Role-based access control (RBAC)
- 🔄 **Session Management** - Automatic token refresh and session handling
- 📱 **Multi-App Support** - Shared auth across customer, business, and admin apps

## Installation

```bash
# Install via workspace (recommended)
pnpm add @vocilia/auth

# Or install directly
npm install @vocilia/auth
```

## Quick Start

### 1. Setup Auth Provider

```typescript
// app/layout.tsx or _app.tsx
import { AuthProvider } from '@vocilia/auth';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
```

### 2. Use Auth Hook

```typescript
// components/LoginForm.tsx
import { useAuth } from '@vocilia/auth';

export function LoginForm() {
  const { login, loading, user, error } = useAuth();

  const handleSubmit = async (email: string, password: string) => {
    await login(email, password);
  };

  if (user) {
    return <div>Welcome, {user.email}!</div>;
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Login form */}
    </form>
  );
}
```

### 3. Protect Routes

```typescript
// components/ProtectedPage.tsx
import { withAuth } from '@vocilia/auth';

function DashboardPage() {
  return <div>Protected Dashboard Content</div>;
}

export default withAuth(DashboardPage, {
  requiredRole: 'business_account',
  permissions: ['business.read']
});
```

## API Reference

### Hooks

#### `useAuth()`

Main authentication hook providing user state and auth methods.

```typescript
const {
  user,           // Current user or null
  loading,        // Loading state
  error,          // Last error
  login,          // Login function
  logout,         // Logout function
  register,       // Registration function
  updateProfile,  // Update user profile
  refreshToken    // Manually refresh token
} = useAuth();
```

#### `usePermissions()`

Hook for checking user permissions and roles.

```typescript
const {
  hasPermission,    // Check specific permission
  hasRole,          // Check user role
  hasAnyPermission, // Check any of multiple permissions
  permissions,      // All user permissions
  role             // User role
} = usePermissions();

// Usage
if (hasPermission('business.write')) {
  // Show edit button
}

if (hasRole('admin_account')) {
  // Show admin features
}
```

#### `useSession()`

Low-level session management hook.

```typescript
const {
  session,        // Supabase session
  refreshing,     // Token refresh state
  refreshToken,   // Manual refresh function
  clearSession    // Clear session
} = useSession();
```

### Components

#### `<AuthProvider>`

Root provider component that manages authentication state.

```typescript
<AuthProvider 
  config={{
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    redirectTo: '/dashboard'
  }}
>
  {children}
</AuthProvider>
```

#### `<AuthGuard>`

Component-based route protection.

```typescript
<AuthGuard
  requiredRole="business_account"
  permissions={['business.read']}
  fallback={<LoginPrompt />}
  loading={<LoadingSpinner />}
>
  <ProtectedContent />
</AuthGuard>
```

#### `<LoginForm>`

Pre-built login form component.

```typescript
<LoginForm
  onSuccess={(user) => router.push('/dashboard')}
  onError={(error) => setError(error.message)}
  className="custom-form-class"
/>
```

### HOCs (Higher-Order Components)

#### `withAuth()`

HOC for protecting React components.

```typescript
const ProtectedComponent = withAuth(MyComponent, {
  requiredRole: 'business_account',
  permissions: ['business.read'],
  redirectTo: '/login',
  loading: LoadingComponent
});
```

### Utilities

#### Authentication Client

```typescript
import { createAuthClient } from '@vocilia/auth/clients';

const authClient = createAuthClient({
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_ANON_KEY
});

// Server-side usage
const user = await authClient.getUser(token);
const session = await authClient.refreshToken(refreshToken);
```

#### Permission Utilities

```typescript
import { checkPermission, getUserRole } from '@vocilia/auth/permissions';

// Check permissions
const canEdit = checkPermission(user, 'business.write');
const isAdmin = getUserRole(user) === 'admin_account';

// Get user permissions
const permissions = await getUserPermissions(user.id);
```

## Middleware

### Next.js Middleware

```typescript
// middleware.ts
import { createAuthMiddleware } from '@vocilia/auth/middleware';

export const middleware = createAuthMiddleware({
  protectedRoutes: ['/dashboard', '/admin'],
  publicRoutes: ['/login', '/register'],
  roleMappings: {
    '/admin': ['admin_account'],
    '/dashboard': ['business_account', 'admin_account']
  }
});

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)']
};
```

### Express.js Middleware

```typescript
// server.ts
import { authMiddleware } from '@vocilia/auth/middleware';

app.use('/api/protected', authMiddleware({
  requiredRole: 'business_account',
  permissions: ['api.access']
}));
```

## Configuration

### Environment Variables

```bash
# Required
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Optional
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # Server-side only
AUTH_REDIRECT_URL=http://localhost:3000/auth/callback
AUTH_SESSION_TIMEOUT=3600  # 1 hour
```

### Auth Config

```typescript
// auth.config.ts
export const authConfig = {
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  },
  session: {
    timeout: 3600, // 1 hour
    refreshThreshold: 300, // 5 minutes before expiry
    persistSession: true
  },
  permissions: {
    defaultRole: 'business_account',
    roles: ['business_account', 'admin_account'],
    permissions: [
      'business.read',
      'business.write',
      'stores.read',
      'stores.write',
      'feedback.read',
      'customers.read',
      'admin.users',
      'admin.system'
    ]
  }
};
```

## Permission System

### Role Hierarchy

```
admin_account (highest)
├── Can access all business functions
├── Can manage users and system settings
└── Has all permissions

business_account
├── Can manage own business
├── Can view/edit stores
├── Can view feedback and customers
└── Limited permissions
```

### Permission Categories

- **business.*** - Business management permissions
- **stores.*** - Store management permissions  
- **feedback.*** - Feedback system permissions
- **customers.*** - Customer data permissions
- **admin.*** - Administrative permissions

## Examples

### Complete Authentication Flow

```typescript
// pages/login.tsx
import { useAuth } from '@vocilia/auth';
import { useRouter } from 'next/router';

export default function LoginPage() {
  const { login, loading, error } = useAuth();
  const router = useRouter();

  const handleLogin = async (formData: FormData) => {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err) {
      console.error('Login failed:', err);
    }
  };

  return (
    <form action={handleLogin}>
      <input name="email" type="email" required />
      <input name="password" type="password" required />
      <button type="submit" disabled={loading}>
        {loading ? 'Signing in...' : 'Sign in'}
      </button>
      {error && <p className="error">{error.message}</p>}
    </form>
  );
}
```

### Permission-Based UI

```typescript
// components/BusinessDashboard.tsx
import { usePermissions } from '@vocilia/auth';

export function BusinessDashboard() {
  const { hasPermission, hasRole } = usePermissions();

  return (
    <div>
      <h1>Business Dashboard</h1>
      
      {hasPermission('business.write') && (
        <button>Edit Business</button>
      )}
      
      {hasPermission('stores.write') && (
        <button>Add Store</button>
      )}
      
      {hasRole('admin_account') && (
        <AdminPanel />
      )}
    </div>
  );
}
```

### Server-Side Authentication

```typescript
// pages/api/business/[id].ts
import { authMiddleware } from '@vocilia/auth/middleware';
import { NextApiRequest, NextApiResponse } from 'next';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  // User is authenticated and has required permissions
  const { user } = req;
  
  if (req.method === 'GET') {
    // Get business data
  } else if (req.method === 'PUT') {
    // Update business data
  }
}

export default authMiddleware(handler, {
  requiredRole: 'business_account',
  permissions: ['business.read']
});
```

## Development

### Building

```bash
pnpm build
```

### Testing

```bash
pnpm test
pnpm test:watch
```

### Type Checking

```bash
pnpm typecheck
```

## Dependencies

- **@supabase/supabase-js**: ^2.39.3 - Supabase client
- **@supabase/ssr**: ^0.7.0 - Server-side rendering support
- **@supabase/auth-helpers-nextjs**: ^0.8.7 - Next.js helpers
- **@supabase/auth-helpers-react**: ^0.4.2 - React helpers
- **jwt-decode**: ^4.0.0 - JWT token decoding
- **react**: ^18.2.0 - React framework

## Troubleshooting

### Common Issues

**"Session not found" errors**
- Ensure AuthProvider is at the root of your app
- Check environment variables are correctly set
- Verify Supabase configuration

**Permission denied errors**
- Check user role and permissions in database
- Verify RLS policies are correctly configured
- Ensure user has the required permissions

**Token refresh issues**
- Check network connectivity
- Verify refresh token is still valid
- Ensure auth configuration is correct

## License

Private - Internal use only within the Vocilia ecosystem.

## Support

For authentication-related issues:

- **Team**: Vocilia Development Team
- **Email**: dev@vocilia.se
- **Documentation**: [Authentication Guide](../../docs/auth/README.md)