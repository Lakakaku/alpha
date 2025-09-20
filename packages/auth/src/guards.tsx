import React, { ReactNode, useEffect, useState } from 'react'
import { useAuth, useAuthState, useAuthGuard } from './hooks.js'
import type { UserRole, PermissionName } from '@vocilia/types'

export interface AuthGuardProps {
  children: ReactNode
  fallback?: ReactNode
  redirectTo?: string
  requireAuth?: boolean
  requireRoles?: UserRole[]
  requirePermissions?: PermissionName[]
  requireBusinessAccess?: boolean
  allowedBusinessIds?: string[]
  onUnauthorized?: () => void
  loadingComponent?: ReactNode
}

export interface RoleGuardProps {
  children: ReactNode
  allowedRoles: UserRole[]
  fallback?: ReactNode
  onUnauthorized?: () => void
}

export interface PermissionGuardProps {
  children: ReactNode
  requiredPermissions: PermissionName[]
  requireAll?: boolean
  fallback?: ReactNode
  onUnauthorized?: () => void
}

export interface BusinessGuardProps {
  children: ReactNode
  businessId?: string
  allowedBusinessIds?: string[]
  fallback?: ReactNode
  onUnauthorized?: () => void
}

/**
 * Default loading component
 */
const DefaultLoadingComponent = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
  </div>
)

/**
 * Default unauthorized component
 */
const DefaultUnauthorizedComponent = ({ message = "You don't have permission to access this page." }) => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="text-center">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
      <p className="text-gray-600">{message}</p>
    </div>
  </div>
)

/**
 * Main authentication guard component
 * Provides comprehensive access control for routes and components
 */
export function AuthGuard({
  children,
  fallback,
  redirectTo,
  requireAuth = true,
  requireRoles,
  requirePermissions,
  requireBusinessAccess = false,
  allowedBusinessIds,
  onUnauthorized,
  loadingComponent = <DefaultLoadingComponent />
}: AuthGuardProps) {
  const { user, isLoading, isAuthenticated } = useAuth()
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false)

  // Handle redirect logic
  useEffect(() => {
    if (!isLoading && !hasCheckedAuth) {
      setHasCheckedAuth(true)
      
      if (requireAuth && !isAuthenticated && redirectTo) {
        // In a real Next.js app, use next/router
        // For now, we'll use window.location
        if (typeof window !== 'undefined') {
          window.location.href = redirectTo
        }
      }
    }
  }, [isLoading, isAuthenticated, requireAuth, redirectTo, hasCheckedAuth])

  // Show loading state
  if (isLoading) {
    return <>{loadingComponent}</>
  }

  // Check authentication requirement
  if (requireAuth && !isAuthenticated) {
    if (onUnauthorized) {
      onUnauthorized()
    }
    
    return fallback ? <>{fallback}</> : <DefaultUnauthorizedComponent message="Please sign in to access this page." />
  }

  // If not requiring auth and user is not authenticated, allow access
  if (!requireAuth && !isAuthenticated) {
    return <>{children}</>
  }

  // From here on, user is authenticated
  if (!user) {
    return <DefaultUnauthorizedComponent message="User information not available." />
  }

  // Check role requirements
  if (requireRoles && requireRoles.length > 0) {
    if (!requireRoles.includes(user.role)) {
      if (onUnauthorized) {
        onUnauthorized()
      }
      
      return fallback ? <>{fallback}</> : <DefaultUnauthorizedComponent message="You don't have the required role to access this page." />
    }
  }

  // Check permission requirements
  if (requirePermissions && requirePermissions.length > 0) {
    const hasAllPermissions = requirePermissions.every(permission => 
      user.permissions.includes(permission)
    )
    
    if (!hasAllPermissions) {
      if (onUnauthorized) {
        onUnauthorized()
      }
      
      return fallback ? <>{fallback}</> : <DefaultUnauthorizedComponent message="You don't have the required permissions to access this page." />
    }
  }

  // Check business access requirements
  if (requireBusinessAccess) {
    // Admin users can access any business
    if (user.role !== 'admin_account') {
      // Business users must have a business_id
      if (!user.business_id) {
        if (onUnauthorized) {
          onUnauthorized()
        }
        
        return fallback ? <>{fallback}</> : <DefaultUnauthorizedComponent message="Business access required." />
      }

      // Check if user's business is in allowed list
      if (allowedBusinessIds && allowedBusinessIds.length > 0) {
        if (!allowedBusinessIds.includes(user.business_id)) {
          if (onUnauthorized) {
            onUnauthorized()
          }
          
          return fallback ? <>{fallback}</> : <DefaultUnauthorizedComponent message="You don't have access to this business." />
        }
      }
    }
  }

  return <>{children}</>
}

/**
 * Role-based access guard
 */
export function RoleGuard({
  children,
  allowedRoles,
  fallback,
  onUnauthorized
}: RoleGuardProps) {
  return (
    <AuthGuard
      requireRoles={allowedRoles}
      fallback={fallback}
      onUnauthorized={onUnauthorized}
    >
      {children}
    </AuthGuard>
  )
}

/**
 * Permission-based access guard
 */
export function PermissionGuard({
  children,
  requiredPermissions,
  requireAll = true,
  fallback,
  onUnauthorized
}: PermissionGuardProps) {
  const { user } = useAuthState()

  if (!user) {
    return fallback ? <>{fallback}</> : <DefaultUnauthorizedComponent message="Authentication required." />
  }

  const hasPermission = requireAll
    ? requiredPermissions.every(permission => user.permissions.includes(permission))
    : requiredPermissions.some(permission => user.permissions.includes(permission))

  if (!hasPermission) {
    if (onUnauthorized) {
      onUnauthorized()
    }
    
    return fallback ? <>{fallback}</> : <DefaultUnauthorizedComponent message="Insufficient permissions." />
  }

  return <>{children}</>
}

/**
 * Business-specific access guard
 */
export function BusinessGuard({
  children,
  businessId,
  allowedBusinessIds,
  fallback,
  onUnauthorized
}: BusinessGuardProps) {
  const { user } = useAuthState()

  if (!user) {
    return fallback ? <>{fallback}</> : <DefaultUnauthorizedComponent message="Authentication required." />
  }

  // Admin users can access any business
  if (user.role === 'admin_account') {
    return <>{children}</>
  }

  // Business users must have a business_id
  if (!user.business_id) {
    if (onUnauthorized) {
      onUnauthorized()
    }
    
    return fallback ? <>{fallback}</> : <DefaultUnauthorizedComponent message="Business access required." />
  }

  // Check specific business access
  if (businessId && user.business_id !== businessId) {
    if (onUnauthorized) {
      onUnauthorized()
    }
    
    return fallback ? <>{fallback}</> : <DefaultUnauthorizedComponent message="You don't have access to this business." />
  }

  // Check allowed business list
  if (allowedBusinessIds && allowedBusinessIds.length > 0) {
    if (!allowedBusinessIds.includes(user.business_id)) {
      if (onUnauthorized) {
        onUnauthorized()
      }
      
      return fallback ? <>{fallback}</> : <DefaultUnauthorizedComponent message="You don't have access to this business." />
    }
  }

  return <>{children}</>
}

/**
 * Admin-only access guard
 */
export function AdminGuard({
  children,
  fallback,
  onUnauthorized
}: {
  children: ReactNode
  fallback?: ReactNode
  onUnauthorized?: () => void
}) {
  return (
    <RoleGuard
      allowedRoles={['admin_account']}
      fallback={fallback}
      onUnauthorized={onUnauthorized}
    >
      {children}
    </RoleGuard>
  )
}

/**
 * Business user access guard
 */
export function BusinessUserGuard({
  children,
  fallback,
  onUnauthorized
}: {
  children: ReactNode
  fallback?: ReactNode
  onUnauthorized?: () => void
}) {
  return (
    <RoleGuard
      allowedRoles={['business_account']}
      fallback={fallback}
      onUnauthorized={onUnauthorized}
    >
      {children}
    </RoleGuard>
  )
}

/**
 * Conditional component for authenticated users only
 */
export function AuthenticatedOnly({
  children,
  fallback
}: {
  children: ReactNode
  fallback?: ReactNode
}) {
  const { isAuthenticated } = useAuthGuard()
  
  return isAuthenticated ? <>{children}</> : <>{fallback}</>
}

/**
 * Conditional component for unauthenticated users only
 */
export function UnauthenticatedOnly({
  children,
  fallback
}: {
  children: ReactNode
  fallback?: ReactNode
}) {
  const { isAuthenticated } = useAuthGuard()
  
  return !isAuthenticated ? <>{children}</> : <>{fallback}</>
}

/**
 * Higher-order component for route protection
 */
export function withAuthGuard<P extends object>(
  Component: React.ComponentType<P>,
  guardProps: Omit<AuthGuardProps, 'children'>
) {
  return function AuthGuardedComponent(props: P) {
    return (
      <AuthGuard {...guardProps}>
        <Component {...props} />
      </AuthGuard>
    )
  }
}

/**
 * Higher-order component for role protection
 */
export function withRoleGuard<P extends object>(
  Component: React.ComponentType<P>,
  allowedRoles: UserRole[],
  fallback?: ReactNode
) {
  return function RoleGuardedComponent(props: P) {
    return (
      <RoleGuard allowedRoles={allowedRoles} fallback={fallback}>
        <Component {...props} />
      </RoleGuard>
    )
  }
}

/**
 * Higher-order component for permission protection
 */
export function withPermissionGuard<P extends object>(
  Component: React.ComponentType<P>,
  requiredPermissions: PermissionName[],
  requireAll: boolean = true,
  fallback?: ReactNode
) {
  return function PermissionGuardedComponent(props: P) {
    return (
      <PermissionGuard 
        requiredPermissions={requiredPermissions} 
        requireAll={requireAll}
        fallback={fallback}
      >
        <Component {...props} />
      </PermissionGuard>
    )
  }
}

/**
 * Utility hook for checking access permissions
 */
export function useAccessControl() {
  const { user, isAuthenticated } = useAuthState()

  const hasRole = (role: UserRole): boolean => {
    return user?.role === role
  }

  const hasAnyRole = (roles: UserRole[]): boolean => {
    return user ? roles.includes(user.role) : false
  }

  const hasPermission = (permission: PermissionName): boolean => {
    return user?.permissions.includes(permission) ?? false
  }

  const hasAnyPermission = (permissions: PermissionName[]): boolean => {
    return user ? permissions.some(p => user.permissions.includes(p)) : false
  }

  const hasAllPermissions = (permissions: PermissionName[]): boolean => {
    return user ? permissions.every(p => user.permissions.includes(p)) : false
  }

  const hasBusinessAccess = (businessId?: string): boolean => {
    if (!user) return false
    
    // Admin users have access to all businesses
    if (user.role === 'admin_account') return true
    
    // Business users must have a business_id
    if (!user.business_id) return false
    
    // If specific business ID is provided, check access
    if (businessId) {
      return user.business_id === businessId
    }
    
    // Otherwise, user has access to their own business
    return true
  }

  const isAdmin = (): boolean => hasRole('admin_account')
  const isBusinessUser = (): boolean => hasRole('business_account')

  return {
    isAuthenticated,
    user,
    hasRole,
    hasAnyRole,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasBusinessAccess,
    isAdmin,
    isBusinessUser
  }
}