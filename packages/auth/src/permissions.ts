import type { PermissionName, UserRole, UserPermission, PERMISSIONS } from '@vocilia/types'

/**
 * Permission management utilities for the Vocilia platform
 * Provides role-based and granular permission checking
 */

// Permission sets by role
export const ROLE_PERMISSIONS: Record<UserRole, PermissionName[]> = {
  business_account: [
    'business.read',
    'business.write',
    'customers.read', 
    'customers.write',
    'feedback.read'
  ],
  admin_account: [
    'business.read',
    'business.write', 
    'business.delete',
    'customers.read',
    'customers.write',
    'feedback.read',
    'feedback.moderate',
    'admin.users',
    'admin.businesses',
    'admin.system'
  ]
}

// Permission hierarchies (higher permissions include lower ones)
export const PERMISSION_HIERARCHY: Record<PermissionName, PermissionName[]> = {
  'business.delete': ['business.write', 'business.read'],
  'business.write': ['business.read'],
  'business.read': [],
  
  'customers.write': ['customers.read'],
  'customers.read': [],
  
  'feedback.moderate': ['feedback.read'],
  'feedback.read': [],
  
  'admin.system': ['admin.businesses', 'admin.users'],
  'admin.businesses': ['business.delete', 'business.write', 'business.read'],
  'admin.users': ['customers.write', 'customers.read'],
}

// Permission categories for UI grouping
export const PERMISSION_CATEGORIES = {
  business: [
    'business.read',
    'business.write', 
    'business.delete'
  ] as PermissionName[],
  
  customers: [
    'customers.read',
    'customers.write'
  ] as PermissionName[],
  
  feedback: [
    'feedback.read',
    'feedback.moderate'
  ] as PermissionName[],
  
  admin: [
    'admin.users',
    'admin.businesses',
    'admin.system'
  ] as PermissionName[]
}

// Human-readable permission descriptions
export const PERMISSION_DESCRIPTIONS: Record<PermissionName, string> = {
  'business.read': 'View business information and settings',
  'business.write': 'Update business information and settings',
  'business.delete': 'Delete business accounts (admin only)',
  
  'customers.read': 'View customer data and profiles',
  'customers.write': 'Update customer information and manage accounts',
  
  'feedback.read': 'View feedback submissions and reports',
  'feedback.moderate': 'Moderate, approve, or remove feedback content',
  
  'admin.users': 'Manage user accounts and permissions',
  'admin.businesses': 'Manage all business accounts and data',
  'admin.system': 'Full system administration access'
}

/**
 * Check if a user has a specific permission
 */
export function hasPermission(
  userPermissions: PermissionName[],
  requiredPermission: PermissionName,
  includeInherited: boolean = true
): boolean {
  // Direct permission check
  if (userPermissions.includes(requiredPermission)) {
    return true
  }

  if (!includeInherited) {
    return false
  }

  // Check inherited permissions from hierarchy
  for (const userPermission of userPermissions) {
    const inheritedPermissions = PERMISSION_HIERARCHY[userPermission] || []
    if (inheritedPermissions.includes(requiredPermission)) {
      return true
    }
  }

  return false
}

/**
 * Check if a user has any of the specified permissions
 */
export function hasAnyPermission(
  userPermissions: PermissionName[],
  requiredPermissions: PermissionName[],
  includeInherited: boolean = true
): boolean {
  return requiredPermissions.some(permission => 
    hasPermission(userPermissions, permission, includeInherited)
  )
}

/**
 * Check if a user has all of the specified permissions
 */
export function hasAllPermissions(
  userPermissions: PermissionName[],
  requiredPermissions: PermissionName[],
  includeInherited: boolean = true
): boolean {
  return requiredPermissions.every(permission => 
    hasPermission(userPermissions, permission, includeInherited)
  )
}

/**
 * Get all permissions for a specific role (including inherited)
 */
export function getRolePermissions(role: UserRole): PermissionName[] {
  const basePermissions = ROLE_PERMISSIONS[role] || []
  const allPermissions = new Set<PermissionName>(basePermissions)

  // Add inherited permissions
  for (const permission of basePermissions) {
    const inherited = PERMISSION_HIERARCHY[permission] || []
    inherited.forEach(p => allPermissions.add(p))
  }

  return Array.from(allPermissions)
}

/**
 * Get effective permissions for a user (role + granted permissions)
 */
export function getEffectivePermissions(
  role: UserRole,
  grantedPermissions: PermissionName[] = []
): PermissionName[] {
  const rolePermissions = getRolePermissions(role)
  const allPermissions = new Set<PermissionName>([...rolePermissions, ...grantedPermissions])

  // Add inherited permissions for granted permissions
  for (const permission of grantedPermissions) {
    const inherited = PERMISSION_HIERARCHY[permission] || []
    inherited.forEach(p => allPermissions.add(p))
  }

  return Array.from(allPermissions)
}

/**
 * Check if a permission grant would be redundant (already covered by role or other permissions)
 */
export function isPermissionRedundant(
  role: UserRole,
  existingPermissions: PermissionName[],
  newPermission: PermissionName
): boolean {
  const currentEffective = getEffectivePermissions(role, existingPermissions)
  return hasPermission(currentEffective, newPermission, true)
}

/**
 * Get missing permissions needed to satisfy a requirement
 */
export function getMissingPermissions(
  userPermissions: PermissionName[],
  requiredPermissions: PermissionName[],
  includeInherited: boolean = true
): PermissionName[] {
  return requiredPermissions.filter(permission => 
    !hasPermission(userPermissions, permission, includeInherited)
  )
}

/**
 * Validate if a permission exists in the system
 */
export function isValidPermission(permission: string): permission is PermissionName {
  return Object.values(PERMISSIONS).includes(permission as PermissionName)
}

/**
 * Get permissions grouped by category
 */
export function getPermissionsByCategory(): Record<string, { permissions: PermissionName[], descriptions: Record<PermissionName, string> }> {
  const result: Record<string, { permissions: PermissionName[], descriptions: Record<PermissionName, string> }> = {}

  for (const [category, permissions] of Object.entries(PERMISSION_CATEGORIES)) {
    result[category] = {
      permissions,
      descriptions: Object.fromEntries(
        permissions.map(p => [p, PERMISSION_DESCRIPTIONS[p]])
      ) as Record<PermissionName, string>
    }
  }

  return result
}

/**
 * Create a permission checker function for a specific user
 */
export function createPermissionChecker(
  role: UserRole,
  grantedPermissions: PermissionName[] = []
) {
  const effectivePermissions = getEffectivePermissions(role, grantedPermissions)

  return {
    has: (permission: PermissionName) => hasPermission(effectivePermissions, permission),
    hasAny: (permissions: PermissionName[]) => hasAnyPermission(effectivePermissions, permissions),
    hasAll: (permissions: PermissionName[]) => hasAllPermissions(effectivePermissions, permissions),
    can: (action: string, resource: string) => {
      const permission = `${resource}.${action}` as PermissionName
      return isValidPermission(permission) && hasPermission(effectivePermissions, permission)
    },
    getAll: () => effectivePermissions,
    getMissing: (required: PermissionName[]) => getMissingPermissions(effectivePermissions, required)
  }
}

/**
 * Business-specific permission utilities
 */
export const BusinessPermissions = {
  /**
   * Check if user can access a specific business
   */
  canAccessBusiness(
    userRole: UserRole,
    userBusinessId: string | null,
    targetBusinessId: string,
    userPermissions: PermissionName[] = []
  ): boolean {
    // Admin users can access any business
    if (userRole === 'admin_account' && hasPermission(userPermissions, 'admin.businesses')) {
      return true
    }

    // Business users can only access their own business
    if (userRole === 'business_account' && userBusinessId === targetBusinessId) {
      return hasPermission(userPermissions, 'business.read')
    }

    return false
  },

  /**
   * Check if user can modify a specific business
   */
  canModifyBusiness(
    userRole: UserRole,
    userBusinessId: string | null,
    targetBusinessId: string,
    userPermissions: PermissionName[] = []
  ): boolean {
    // Admin users can modify any business
    if (userRole === 'admin_account' && hasPermission(userPermissions, 'admin.businesses')) {
      return true
    }

    // Business users can only modify their own business
    if (userRole === 'business_account' && userBusinessId === targetBusinessId) {
      return hasPermission(userPermissions, 'business.write')
    }

    return false
  },

  /**
   * Check if user can delete a specific business
   */
  canDeleteBusiness(
    userRole: UserRole,
    userPermissions: PermissionName[] = []
  ): boolean {
    // Only admin users can delete businesses
    return userRole === 'admin_account' && hasPermission(userPermissions, 'business.delete')
  }
}

/**
 * Customer data permission utilities
 */
export const CustomerPermissions = {
  /**
   * Check if user can access customer data for a business
   */
  canAccessCustomers(
    userRole: UserRole,
    userBusinessId: string | null,
    targetBusinessId: string,
    userPermissions: PermissionName[] = []
  ): boolean {
    // Admin users can access any business's customers
    if (userRole === 'admin_account' && hasPermission(userPermissions, 'admin.users')) {
      return true
    }

    // Business users can access their own customers
    if (userRole === 'business_account' && userBusinessId === targetBusinessId) {
      return hasPermission(userPermissions, 'customers.read')
    }

    return false
  },

  /**
   * Check if user can modify customer data
   */
  canModifyCustomers(
    userRole: UserRole,
    userBusinessId: string | null,
    targetBusinessId: string,
    userPermissions: PermissionName[] = []
  ): boolean {
    // Admin users can modify any business's customers
    if (userRole === 'admin_account' && hasPermission(userPermissions, 'admin.users')) {
      return true
    }

    // Business users can modify their own customers
    if (userRole === 'business_account' && userBusinessId === targetBusinessId) {
      return hasPermission(userPermissions, 'customers.write')
    }

    return false
  }
}

/**
 * Feedback permission utilities
 */
export const FeedbackPermissions = {
  /**
   * Check if user can view feedback for a business
   */
  canViewFeedback(
    userRole: UserRole,
    userBusinessId: string | null,
    targetBusinessId: string,
    userPermissions: PermissionName[] = []
  ): boolean {
    // Admin users can view any business's feedback
    if (userRole === 'admin_account' && hasPermission(userPermissions, 'admin.system')) {
      return true
    }

    // Business users can view their own feedback
    if (userRole === 'business_account' && userBusinessId === targetBusinessId) {
      return hasPermission(userPermissions, 'feedback.read')
    }

    return false
  },

  /**
   * Check if user can moderate feedback
   */
  canModerateFeedback(
    userRole: UserRole,
    userPermissions: PermissionName[] = []
  ): boolean {
    return hasPermission(userPermissions, 'feedback.moderate')
  }
}

/**
 * API Key permission utilities
 */
export const ApiKeyPermissions = {
  /**
   * Validate API key permissions against required permissions
   */
  validateApiKeyPermissions(
    apiKeyPermissions: string[],
    requiredPermissions: PermissionName[]
  ): boolean {
    const validPermissions = apiKeyPermissions.filter(isValidPermission) as PermissionName[]
    return hasAllPermissions(validPermissions, requiredPermissions)
  },

  /**
   * Get maximum permissions allowed for an API key based on creator's permissions
   */
  getAllowedApiKeyPermissions(
    creatorRole: UserRole,
    creatorPermissions: PermissionName[]
  ): PermissionName[] {
    const effectivePermissions = getEffectivePermissions(creatorRole, creatorPermissions)
    
    // API keys cannot have admin permissions
    return effectivePermissions.filter(p => !p.startsWith('admin.'))
  }
}

/**
 * Export all permission utilities as a single object
 */
export const PermissionUtils = {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  getRolePermissions,
  getEffectivePermissions,
  isPermissionRedundant,
  getMissingPermissions,
  isValidPermission,
  getPermissionsByCategory,
  createPermissionChecker,
  Business: BusinessPermissions,
  Customer: CustomerPermissions,
  Feedback: FeedbackPermissions,
  ApiKey: ApiKeyPermissions
}