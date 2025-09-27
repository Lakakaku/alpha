import { User } from '@supabase/supabase-js';

export type ContextPermission = 
  | 'context:read'           // View context data
  | 'context:write'          // Edit context data
  | 'context:admin'          // Full context management
  | 'context:export'         // Export context for AI
  | 'context:version'        // Manage versions/snapshots
  | 'context:upload'         // Upload files (images, etc.)
  | 'context:validate'       // Run validation checks
  | 'context:audit'          // View audit logs
  | 'context:profile:read'   // Read store profile
  | 'context:profile:write'  // Edit store profile
  | 'context:personnel:read' // View personnel data
  | 'context:personnel:write'// Manage personnel
  | 'context:layout:read'    // View layout data
  | 'context:layout:write'   // Edit layouts
  | 'context:inventory:read' // View inventory data
  | 'context:inventory:write'// Manage inventory;

export type ContextSection = 'profile' | 'personnel' | 'layout' | 'inventory';

export interface ContextPermissionContext {
  storeId: string;
  section?: ContextSection;
  resourceId?: string;
  action: 'read' | 'write' | 'delete' | 'admin';
}

export interface BusinessUserMetadata {
  businessId: string;
  role: 'owner' | 'manager' | 'staff';
  permissions: string[];
  stores: Array<{
    storeId: string;
    permissions: ContextPermission[];
    role: 'admin' | 'manager' | 'editor' | 'viewer';
  }>;
  isApproved: boolean;
  verificationStatus: 'pending' | 'approved' | 'rejected';
}

export class ContextPermissions {
  /**
   * Default permission sets for different roles
   */
  static readonly ROLE_PERMISSIONS = {
    admin: [
      'context:read',
      'context:write', 
      'context:admin',
      'context:export',
      'context:version',
      'context:upload',
      'context:validate',
      'context:audit',
      'context:profile:read',
      'context:profile:write',
      'context:personnel:read',
      'context:personnel:write',
      'context:layout:read',
      'context:layout:write',
      'context:inventory:read',
      'context:inventory:write',
    ] as ContextPermission[],
    
    manager: [
      'context:read',
      'context:write',
      'context:export',
      'context:version',
      'context:upload',
      'context:validate',
      'context:profile:read',
      'context:profile:write',
      'context:personnel:read',
      'context:personnel:write',
      'context:layout:read',
      'context:layout:write',
      'context:inventory:read',
      'context:inventory:write',
    ] as ContextPermission[],
    
    editor: [
      'context:read',
      'context:write',
      'context:upload',
      'context:validate',
      'context:profile:read',
      'context:personnel:read',
      'context:personnel:write',
      'context:layout:read',
      'context:layout:write',
      'context:inventory:read',
      'context:inventory:write',
    ] as ContextPermission[],
    
    viewer: [
      'context:read',
      'context:profile:read',
      'context:personnel:read',
      'context:layout:read',
      'context:inventory:read',
    ] as ContextPermission[],
  };

  /**
   * Extract business metadata from Supabase user
   */
  static extractBusinessMetadata(user: User): BusinessUserMetadata | null {
    const metadata = user.user_metadata;
    const appMetadata = user.app_metadata;

    if (!metadata?.businessId && !appMetadata?.businessId) {
      return null;
    }

    return {
      businessId: metadata?.businessId || appMetadata?.businessId,
      role: metadata?.role || appMetadata?.role || 'staff',
      permissions: metadata?.permissions || appMetadata?.permissions || [],
      stores: metadata?.stores || appMetadata?.stores || [],
      isApproved: metadata?.isApproved ?? appMetadata?.isApproved ?? false,
      verificationStatus: metadata?.verificationStatus || appMetadata?.verificationStatus || 'pending',
    };
  }

  /**
   * Get user's permissions for a specific store
   */
  static getStorePermissions(
    userMetadata: BusinessUserMetadata, 
    storeId: string
  ): ContextPermission[] {
    // Find store-specific permissions
    const storeAccess = userMetadata.stores.find(store => store.storeId === storeId);
    
    if (!storeAccess) {
      return []; // No access to this store
    }

    // Combine role-based permissions with explicit permissions
    const rolePermissions = this.ROLE_PERMISSIONS[storeAccess.role] || [];
    const explicitPermissions = storeAccess.permissions || [];

    return [...new Set([...rolePermissions, ...explicitPermissions])];
  }

  /**
   * Check if user has a specific permission for a store
   */
  static hasPermission(
    userMetadata: BusinessUserMetadata,
    storeId: string,
    permission: ContextPermission
  ): boolean {
    if (!userMetadata.isApproved || userMetadata.verificationStatus !== 'approved') {
      return false;
    }

    const permissions = this.getStorePermissions(userMetadata, storeId);
    
    // Check direct permission
    if (permissions.includes(permission)) {
      return true;
    }

    // Check admin override
    if (permissions.includes('context:admin')) {
      return true;
    }

    // Check section-specific admin permissions
    const [section, action] = permission.split(':');
    if (section === 'context' && permissions.includes(`context:${action}` as ContextPermission)) {
      return true;
    }

    return false;
  }

  /**
   * Check if user can perform an action on a context section
   */
  static canAccessSection(
    userMetadata: BusinessUserMetadata,
    storeId: string,
    section: ContextSection,
    action: 'read' | 'write' = 'read'
  ): boolean {
    if (!userMetadata.isApproved || userMetadata.verificationStatus !== 'approved') {
      return false;
    }

    const readPermission = `context:${section}:read` as ContextPermission;
    const writePermission = `context:${section}:write` as ContextPermission;

    if (action === 'read') {
      return this.hasPermission(userMetadata, storeId, readPermission);
    }

    if (action === 'write') {
      return this.hasPermission(userMetadata, storeId, writePermission) ||
             this.hasPermission(userMetadata, storeId, readPermission); // Read implies write for some sections
    }

    return false;
  }

  /**
   * Get all accessible stores for a user
   */
  static getAccessibleStores(userMetadata: BusinessUserMetadata): string[] {
    if (!userMetadata.isApproved || userMetadata.verificationStatus !== 'approved') {
      return [];
    }

    return userMetadata.stores.map(store => store.storeId);
  }

  /**
   * Check if user has any context permissions for a store
   */
  static hasAnyContextAccess(userMetadata: BusinessUserMetadata, storeId: string): boolean {
    const permissions = this.getStorePermissions(userMetadata, storeId);
    return permissions.some(permission => permission.startsWith('context:'));
  }

  /**
   * Generate permission summary for debugging/auditing
   */
  static getPermissionSummary(
    userMetadata: BusinessUserMetadata, 
    storeId: string
  ): {
    storeId: string;
    hasAccess: boolean;
    role: string;
    permissions: ContextPermission[];
    sections: {
      profile: { read: boolean; write: boolean };
      personnel: { read: boolean; write: boolean };
      layout: { read: boolean; write: boolean };
      inventory: { read: boolean; write: boolean };
    };
    capabilities: {
      canExport: boolean;
      canUpload: boolean;
      canValidate: boolean;
      canManageVersions: boolean;
      canViewAudit: boolean;
      isAdmin: boolean;
    };
  } {
    const storeAccess = userMetadata.stores.find(store => store.storeId === storeId);
    const permissions = this.getStorePermissions(userMetadata, storeId);

    return {
      storeId,
      hasAccess: this.hasAnyContextAccess(userMetadata, storeId),
      role: storeAccess?.role || 'none',
      permissions,
      sections: {
        profile: {
          read: this.canAccessSection(userMetadata, storeId, 'profile', 'read'),
          write: this.canAccessSection(userMetadata, storeId, 'profile', 'write'),
        },
        personnel: {
          read: this.canAccessSection(userMetadata, storeId, 'personnel', 'read'),
          write: this.canAccessSection(userMetadata, storeId, 'personnel', 'write'),
        },
        layout: {
          read: this.canAccessSection(userMetadata, storeId, 'layout', 'read'),
          write: this.canAccessSection(userMetadata, storeId, 'layout', 'write'),
        },
        inventory: {
          read: this.canAccessSection(userMetadata, storeId, 'inventory', 'read'),
          write: this.canAccessSection(userMetadata, storeId, 'inventory', 'write'),
        },
      },
      capabilities: {
        canExport: this.hasPermission(userMetadata, storeId, 'context:export'),
        canUpload: this.hasPermission(userMetadata, storeId, 'context:upload'),
        canValidate: this.hasPermission(userMetadata, storeId, 'context:validate'),
        canManageVersions: this.hasPermission(userMetadata, storeId, 'context:version'),
        canViewAudit: this.hasPermission(userMetadata, storeId, 'context:audit'),
        isAdmin: this.hasPermission(userMetadata, storeId, 'context:admin'),
      },
    };
  }

  /**
   * Validate permission context for API requests
   */
  static validatePermissionContext(
    userMetadata: BusinessUserMetadata,
    context: ContextPermissionContext
  ): {
    allowed: boolean;
    reason?: string;
    requiredPermission?: ContextPermission;
  } {
    if (!userMetadata.isApproved || userMetadata.verificationStatus !== 'approved') {
      return {
        allowed: false,
        reason: 'User account not approved',
      };
    }

    const { storeId, section, action } = context;

    // Check store access
    if (!this.hasAnyContextAccess(userMetadata, storeId)) {
      return {
        allowed: false,
        reason: 'No access to this store',
      };
    }

    // Determine required permission
    let requiredPermission: ContextPermission;

    if (section) {
      requiredPermission = `context:${section}:${action === 'read' ? 'read' : 'write'}` as ContextPermission;
    } else {
      switch (action) {
        case 'admin':
          requiredPermission = 'context:admin';
          break;
        case 'write':
        case 'delete':
          requiredPermission = 'context:write';
          break;
        case 'read':
        default:
          requiredPermission = 'context:read';
          break;
      }
    }

    // Check permission
    const hasPermission = this.hasPermission(userMetadata, storeId, requiredPermission);

    return {
      allowed: hasPermission,
      reason: hasPermission ? undefined : `Missing permission: ${requiredPermission}`,
      requiredPermission,
    };
  }

  /**
   * Create middleware-friendly permission checker
   */
  static createPermissionChecker(user: User) {
    const userMetadata = this.extractBusinessMetadata(user);
    
    if (!userMetadata) {
      return {
        hasAccess: () => false,
        canAccess: () => ({ allowed: false, reason: 'Invalid user metadata' }),
        getStoreAccess: () => [],
        getSummary: () => null,
      };
    }

    return {
      hasAccess: (storeId: string, permission: ContextPermission) => 
        this.hasPermission(userMetadata, storeId, permission),
      
      canAccess: (context: ContextPermissionContext) => 
        this.validatePermissionContext(userMetadata, context),
      
      getStoreAccess: () => 
        this.getAccessibleStores(userMetadata),
      
      getSummary: (storeId: string) => 
        this.getPermissionSummary(userMetadata, storeId),
        
      canAccessSection: (storeId: string, section: ContextSection, action: 'read' | 'write' = 'read') =>
        this.canAccessSection(userMetadata, storeId, section, action),
    };
  }
}

export default ContextPermissions;