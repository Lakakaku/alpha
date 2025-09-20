import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@vocilia/types';

export interface PendingRegistration {
  id: string;
  email: string;
  business_name: string;
  business_phone?: string;
  created_at: string;
  raw_user_meta_data?: any;
}

export interface VerificationDecision {
  approved: boolean;
  notes?: string;
  approvedBy: string;
  approvedAt: string;
}

export async function getPendingRegistrations(): Promise<PendingRegistration[]> {
  const supabase = createClientComponentClient<Database>();
  
  const { data, error } = await supabase
    .from('auth.users')
    .select('*')
    .eq('raw_user_meta_data->>verification_status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching pending registrations:', error);
    return [];
  }

  return (data || []).map(user => ({
    id: user.id,
    email: user.email || '',
    business_name: user.raw_user_meta_data?.business_name || '',
    business_phone: user.raw_user_meta_data?.business_phone,
    created_at: user.created_at,
    raw_user_meta_data: user.raw_user_meta_data
  }));
}

export async function approveBusinessRegistration(
  userId: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClientComponentClient<Database>();
  
  const { error } = await supabase.rpc('approve_business_registration', {
    user_id: userId,
    notes: notes || null
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function rejectBusinessRegistration(
  userId: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClientComponentClient<Database>();
  
  const { error } = await supabase.rpc('reject_business_registration', {
    user_id: userId,
    notes: notes || null
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function validateAdminPermissions(): Promise<boolean> {
  const supabase = createClientComponentClient<Database>();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return false;
  
  // Check if user has admin role
  const { data, error } = await supabase
    .from('user_accounts')
    .select('role')
    .eq('id', user.id)
    .single();

  if (error || !data) return false;
  
  return data.role === 'admin';
}