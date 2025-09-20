import { useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { BusinessAccount, Store, BusinessSession } from '@vocilia/types/business-auth';

export interface BusinessAuthState {
  user: User | null;
  businessAccount: BusinessAccount | null;
  currentStore: Store | null;
  availableStores: Store[];
  session: Session | null;
  loading: boolean;
  error: string | null;
}

export interface BusinessAuthActions {
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (data: BusinessRegistrationData) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  switchStore: (storeId: string) => Promise<{ success: boolean; error?: string }>;
  refreshStores: () => Promise<void>;
}

export interface BusinessRegistrationData {
  email: string;
  password: string;
  businessName: string;
  contactPerson: string;
  phone: string;
  address: string;
  businessType: string;
  estimatedMonthlyCustomers: number;
}

export function useBusinessAuth(): BusinessAuthState & BusinessAuthActions {
  const [user, setUser] = useState<User | null>(null);
  const [businessAccount, setBusinessAccount] = useState<BusinessAccount | null>(null);
  const [currentStore, setCurrentStore] = useState<Store | null>(null);
  const [availableStores, setAvailableStores] = useState<Store[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClientComponentClient();

  // Optimized: Initialize auth state with parallel data loading
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        
        if (currentSession?.user) {
          setSession(currentSession);
          setUser(currentSession.user);
          setLoading(false); // Early loading completion for UI responsiveness
          
          // Load business data in parallel (non-blocking)
          Promise.all([
            loadBusinessAccount(currentSession.user.id),
            refreshStores()
          ]).catch(err => {
            setError(err instanceof Error ? err.message : 'Failed to load business data');
          });
        } else {
          setLoading(false);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize auth');
        setLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (event === 'SIGNED_IN' && newSession?.user) {
          setSession(newSession);
          setUser(newSession.user);
          await loadBusinessAccount(newSession.user.id);
          await refreshStores();
        } else if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setBusinessAccount(null);
          setCurrentStore(null);
          setAvailableStores([]);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const loadBusinessAccount = async (userId: string) => {
    try {
      const { data, error: accountError } = await supabase
        .from('business_accounts')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (accountError) {
        throw new Error(`Failed to load business account: ${accountError.message}`);
      }

      setBusinessAccount(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load business account');
    }
  };

  const refreshStores = async () => {
    if (!user || !businessAccount?.id) return;

    try {
      // Optimized: Parallel store and session fetching with minimal data selection
      const [storesResult, sessionResult] = await Promise.all([
        supabase
          .from('business_stores')
          .select(`
            store_id,
            permissions,
            stores (
              id,
              name,
              address,
              qr_code
            )
          `)
          .eq('business_account_id', businessAccount.id),
        supabase
          .from('business_sessions')
          .select('current_store_id')
          .eq('user_id', user.id)
          .eq('active', true)
          .single()
      ]);

      const { data: businessStores, error: storesError } = storesResult;
      const { data: sessionData } = sessionResult;

      if (storesError) {
        throw new Error(`Failed to load stores: ${storesError.message}`);
      }

      const stores = businessStores?.map(bs => ({
        ...bs.stores,
        permissions: bs.permissions
      })) || [];

      setAvailableStores(stores);

      // Set current store from session or default to first available
      const currentStoreId = sessionData?.current_store_id;
      const sessionStore = stores.find(s => s.id === currentStoreId);
      setCurrentStore(sessionStore || (stores.length > 0 ? stores[0] : null));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stores');
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        return { success: false, error: signInError.message };
      }

      // Check if business account is approved
      if (businessAccount?.verification_status !== 'approved') {
        await supabase.auth.signOut();
        const errorMsg = businessAccount?.verification_status === 'pending' 
          ? 'Your business account is pending admin approval'
          : 'Your business account is not approved';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }

      return { success: true };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Sign in failed';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (data: BusinessRegistrationData) => {
    try {
      setLoading(true);
      setError(null);

      // Create auth user
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            business_name: data.businessName,
            contact_person: data.contactPerson,
          }
        }
      });

      if (signUpError) {
        setError(signUpError.message);
        return { success: false, error: signUpError.message };
      }

      if (!authData.user) {
        setError('Failed to create user account');
        return { success: false, error: 'Failed to create user account' };
      }

      // Create business account record
      const { error: businessError } = await supabase
        .from('business_accounts')
        .insert({
          user_id: authData.user.id,
          business_name: data.businessName,
          contact_person: data.contactPerson,
          phone: data.phone,
          address: data.address,
          business_type: data.businessType,
          estimated_monthly_customers: data.estimatedMonthlyCustomers,
          verification_status: 'pending',
          registration_notes: null
        });

      if (businessError) {
        // Cleanup auth user if business account creation fails
        await supabase.auth.admin.deleteUser(authData.user.id);
        setError(businessError.message);
        return { success: false, error: businessError.message };
      }

      return { success: true };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Registration failed';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      await supabase.auth.signOut();
      
      // Clear business session
      if (user) {
        await supabase
          .from('business_sessions')
          .update({ active: false })
          .eq('user_id', user.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign out failed');
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      setLoading(true);
      setError(null);

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) {
        setError(resetError.message);
        return { success: false, error: resetError.message };
      }

      return { success: true };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Password reset failed';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  const switchStore = async (storeId: string) => {
    try {
      setLoading(true);
      setError(null);

      if (!user || !businessAccount) {
        throw new Error('User not authenticated');
      }

      // Verify user has access to this store
      const store = availableStores.find(s => s.id === storeId);
      if (!store) {
        throw new Error('Store not found or access denied');
      }

      // Update business session
      const { error: sessionError } = await supabase
        .from('business_sessions')
        .upsert({
          user_id: user.id,
          business_account_id: businessAccount.id,
          current_store_id: storeId,
          active: true,
          last_activity: new Date().toISOString()
        });

      if (sessionError) {
        throw new Error(`Failed to switch store: ${sessionError.message}`);
      }

      setCurrentStore(store);
      return { success: true };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Store switch failed';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  return {
    user,
    businessAccount,
    currentStore,
    availableStores,
    session,
    loading,
    error,
    signIn,
    signUp,
    signOut,
    resetPassword,
    switchStore,
    refreshStores,
  };
}