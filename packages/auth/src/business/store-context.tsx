import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Store, BusinessStorePermission } from '@vocilia/types/business-auth';

export interface StoreContextState {
  currentStore: Store | null;
  availableStores: Store[];
  permissions: BusinessStorePermission[];
  loading: boolean;
  error: string | null;
}

export interface StoreContextActions {
  switchStore: (storeId: string) => Promise<{ success: boolean; error?: string }>;
  refreshStores: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  canAccessAnalytics: () => boolean;
  canManageQR: () => boolean;
  canWriteContext: () => boolean;
  isAdmin: () => boolean;
}

export type StoreContextValue = StoreContextState & StoreContextActions;

const StoreContext = createContext<StoreContextValue | null>(null);

export interface StoreProviderProps {
  children: ReactNode;
  businessAccountId: string | null;
  userId: string | null;
}

/**
 * Provider for multi-store context management
 */
export function StoreProvider({ children, businessAccountId, userId }: StoreProviderProps) {
  const [currentStore, setCurrentStore] = useState<Store | null>(null);
  const [availableStores, setAvailableStores] = useState<Store[]>([]);
  const [permissions, setPermissions] = useState<BusinessStorePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClientComponentClient();

  // Load stores and permissions when business account or user changes
  useEffect(() => {
    if (businessAccountId && userId) {
      loadStoresAndPermissions();
    } else {
      setCurrentStore(null);
      setAvailableStores([]);
      setPermissions([]);
      setLoading(false);
    }
  }, [businessAccountId, userId]);

  const loadStoresAndPermissions = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!businessAccountId || !userId) {
        throw new Error('Business account ID and user ID required');
      }

      // Load stores with permissions through business_stores junction table
      const { data: businessStores, error: storesError } = await supabase
        .from('business_stores')
        .select(`
          store_id,
          permissions,
          created_at,
          stores (
            id,
            name,
            address,
            qr_code,
            business_id,
            created_at,
            updated_at
          )
        `)
        .eq('business_account_id', businessAccountId);

      if (storesError) {
        throw new Error(`Failed to load stores: ${storesError.message}`);
      }

      if (!businessStores || businessStores.length === 0) {
        setAvailableStores([]);
        setPermissions([]);
        setCurrentStore(null);
        return;
      }

      // Transform data and extract stores
      const storesWithPermissions = businessStores.map(bs => ({
        ...bs.stores,
        permissions: bs.permissions,
        joinedAt: bs.created_at
      }));

      setAvailableStores(storesWithPermissions);
      setPermissions(businessStores.map(bs => ({
        store_id: bs.store_id,
        permissions: bs.permissions
      })));

      // Load current store from session or set to first available
      await loadCurrentStore(storesWithPermissions, userId);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stores');
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentStore = async (stores: Store[], userId: string) => {
    try {
      // Check for active session with current store
      const { data: sessionData, error: sessionError } = await supabase
        .from('business_sessions')
        .select(`
          current_store_id,
          stores (
            id,
            name,
            address,
            qr_code,
            business_id,
            created_at,
            updated_at
          )
        `)
        .eq('user_id', userId)
        .eq('active', true)
        .single();

      if (sessionError && sessionError.code !== 'PGRST116') {
        console.warn('Failed to load session:', sessionError);
      }

      // Use store from session if valid and user has access
      if (sessionData?.stores) {
        const sessionStore = stores.find(s => s.id === sessionData.current_store_id);
        if (sessionStore) {
          setCurrentStore(sessionStore);
          return;
        }
      }

      // Default to first available store
      if (stores.length > 0) {
        setCurrentStore(stores[0]);
        // Update session with default store
        await updateBusinessSession(stores[0].id, userId);
      }
    } catch (err) {
      console.warn('Failed to load current store:', err);
      // Fallback to first store
      if (stores.length > 0) {
        setCurrentStore(stores[0]);
      }
    }
  };

  const updateBusinessSession = async (storeId: string, userId: string) => {
    if (!businessAccountId) return;

    try {
      await supabase
        .from('business_sessions')
        .upsert({
          user_id: userId,
          business_account_id: businessAccountId,
          current_store_id: storeId,
          active: true,
          last_activity: new Date().toISOString()
        });
    } catch (err) {
      console.warn('Failed to update business session:', err);
    }
  };

  const switchStore = async (storeId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!userId || !businessAccountId) {
        return { success: false, error: 'User not authenticated' };
      }

      // Verify user has access to this store
      const store = availableStores.find(s => s.id === storeId);
      if (!store) {
        return { success: false, error: 'Store not found or access denied' };
      }

      // Update business session
      await updateBusinessSession(storeId, userId);

      setCurrentStore(store);
      setError(null);

      return { success: true };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Store switch failed';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  };

  const refreshStores = async () => {
    await loadStoresAndPermissions();
  };

  const hasPermission = (permission: string): boolean => {
    if (!currentStore) return false;
    
    const storePermissions = permissions.find(p => p.store_id === currentStore.id);
    return storePermissions?.permissions.includes(permission) || false;
  };

  const canAccessAnalytics = (): boolean => {
    return hasPermission('view_analytics') || hasPermission('admin');
  };

  const canManageQR = (): boolean => {
    return hasPermission('manage_qr') || hasPermission('admin');
  };

  const canWriteContext = (): boolean => {
    return hasPermission('write_context') || hasPermission('admin');
  };

  const isAdmin = (): boolean => {
    return hasPermission('admin');
  };

  const contextValue: StoreContextValue = {
    currentStore,
    availableStores,
    permissions,
    loading,
    error,
    switchStore,
    refreshStores,
    hasPermission,
    canAccessAnalytics,
    canManageQR,
    canWriteContext,
    isAdmin,
  };

  return (
    <StoreContext.Provider value={contextValue}>
      {children}
    </StoreContext.Provider>
  );
}

/**
 * Hook to access store context
 */
export function useStoreContext(): StoreContextValue {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStoreContext must be used within a StoreProvider');
  }
  return context;
}

/**
 * Higher-order component for store-aware components
 */
export function withStoreContext<P extends object>(
  Component: React.ComponentType<P & { storeContext: StoreContextValue }>
) {
  return function StoreContextWrappedComponent(props: P) {
    const storeContext = useStoreContext();
    return <Component {...props} storeContext={storeContext} />;
  };
}

/**
 * Utility to check if user has specific permission for a store
 */
export function checkStorePermission(
  permissions: BusinessStorePermission[],
  storeId: string,
  permission: string
): boolean {
  const storePermissions = permissions.find(p => p.store_id === storeId);
  return storePermissions?.permissions.includes(permission) || 
         storePermissions?.permissions.includes('admin') || 
         false;
}

/**
 * Utility to get all permissions for a specific store
 */
export function getStorePermissions(
  permissions: BusinessStorePermission[],
  storeId: string
): string[] {
  const storePermissions = permissions.find(p => p.store_id === storeId);
  return storePermissions?.permissions || [];
}

/**
 * Utility to format store name with permissions indicator
 */
export function formatStoreDisplayName(store: Store, permissions: string[]): string {
  const isAdmin = permissions.includes('admin');
  const roleIndicator = isAdmin ? ' (Admin)' : '';
  return `${store.name}${roleIndicator}`;
}

/**
 * Hook for store switching with loading state
 */
export function useStoreSwitch() {
  const { switchStore } = useStoreContext();
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);

  const handleStoreSwitch = async (storeId: string) => {
    try {
      setSwitching(true);
      setSwitchError(null);
      
      const result = await switchStore(storeId);
      if (!result.success) {
        setSwitchError(result.error || 'Store switch failed');
      }
      
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Store switch failed';
      setSwitchError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setSwitching(false);
    }
  };

  return {
    switchStore: handleStoreSwitch,
    switching,
    switchError,
    clearError: () => setSwitchError(null)
  };
}