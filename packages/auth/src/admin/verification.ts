import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { BusinessAccount } from '@vocilia/types/business-auth';

export interface VerificationDecision {
  approved: boolean;
  notes?: string;
  adminUserId: string;
}

export interface VerificationResult {
  success: boolean;
  error?: string;
  businessAccount?: BusinessAccount;
}

export interface PendingRegistration {
  id: string;
  business_name: string;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
  business_type: string;
  estimated_monthly_customers: number;
  created_at: string;
  metadata?: {
    registration_ip?: string;
    user_agent?: string;
    [key: string]: any;
  };
}

/**
 * Retrieves all pending business registrations for admin review
 */
export async function getPendingRegistrations(): Promise<{
  registrations: PendingRegistration[];
  error?: string;
}> {
  try {
    const supabase = createClientComponentClient();

    const { data: pendingAccounts, error } = await supabase
      .from('business_accounts')
      .select(`
        id,
        business_name,
        contact_person,
        phone,
        address,
        business_type,
        estimated_monthly_customers,
        created_at,
        auth_users!inner (
          email,
          raw_user_meta_data
        )
      `)
      .eq('verification_status', 'pending')
      .order('created_at', { ascending: true });

    if (error) {
      return { registrations: [], error: error.message };
    }

    const registrations: PendingRegistration[] = pendingAccounts?.map(account => ({
      id: account.id,
      business_name: account.business_name,
      contact_person: account.contact_person,
      email: account.auth_users.email,
      phone: account.phone,
      address: account.address,
      business_type: account.business_type,
      estimated_monthly_customers: account.estimated_monthly_customers,
      created_at: account.created_at,
      metadata: account.auth_users.raw_user_meta_data
    })) || [];

    return { registrations };

  } catch (err) {
    return {
      registrations: [],
      error: err instanceof Error ? err.message : 'Failed to fetch pending registrations'
    };
  }
}

/**
 * Approves a business registration
 */
export async function approveBusinessRegistration(
  businessAccountId: string,
  decision: VerificationDecision
): Promise<VerificationResult> {
  try {
    const supabase = createClientComponentClient();

    // Update business account status
    const { data: updatedAccount, error: updateError } = await supabase
      .from('business_accounts')
      .update({
        verification_status: decision.approved ? 'approved' : 'rejected',
        verification_notes: decision.notes || null,
        verified_by: decision.adminUserId,
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', businessAccountId)
      .select()
      .single();

    if (updateError) {
      return {
        success: false,
        error: `Failed to update business account: ${updateError.message}`
      };
    }

    if (!updatedAccount) {
      return {
        success: false,
        error: 'Business account not found'
      };
    }

    // Create verification log entry
    await createVerificationLog(businessAccountId, decision);

    // Send notification to business user
    await notifyBusinessUser(updatedAccount, decision.approved);

    // If approved, create default store if none exists
    if (decision.approved) {
      await createDefaultStore(updatedAccount);
    }

    return {
      success: true,
      businessAccount: updatedAccount
    };

  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Verification failed'
    };
  }
}

/**
 * Rejects a business registration
 */
export async function rejectBusinessRegistration(
  businessAccountId: string,
  decision: VerificationDecision
): Promise<VerificationResult> {
  return approveBusinessRegistration(businessAccountId, {
    ...decision,
    approved: false
  });
}

/**
 * Gets verification history for a business account
 */
export async function getVerificationHistory(businessAccountId: string): Promise<{
  history: any[];
  error?: string;
}> {
  try {
    const supabase = createClientComponentClient();

    const { data: history, error } = await supabase
      .from('business_verification_logs')
      .select(`
        *,
        admin_user:auth_users!admin_user_id (
          email,
          raw_user_meta_data
        )
      `)
      .eq('business_account_id', businessAccountId)
      .order('created_at', { ascending: false });

    if (error) {
      return { history: [], error: error.message };
    }

    return { history: history || [] };

  } catch (err) {
    return {
      history: [],
      error: err instanceof Error ? err.message : 'Failed to fetch verification history'
    };
  }
}

/**
 * Creates a verification log entry
 */
async function createVerificationLog(
  businessAccountId: string,
  decision: VerificationDecision
): Promise<void> {
  try {
    const supabase = createClientComponentClient();

    await supabase
      .from('business_verification_logs')
      .insert({
        business_account_id: businessAccountId,
        admin_user_id: decision.adminUserId,
        action: decision.approved ? 'approved' : 'rejected',
        notes: decision.notes,
        created_at: new Date().toISOString()
      });

  } catch (err) {
    console.error('Failed to create verification log:', err);
  }
}

/**
 * Sends notification to business user about verification decision
 */
async function notifyBusinessUser(
  businessAccount: BusinessAccount,
  approved: boolean
): Promise<void> {
  try {
    const supabase = createClientComponentClient();

    const notificationData = {
      user_id: businessAccount.user_id,
      type: approved ? 'account_approved' : 'account_rejected',
      title: approved ? 'Business Account Approved' : 'Business Account Rejected',
      message: approved
        ? `Your business account for "${businessAccount.business_name}" has been approved. You can now log in to access your dashboard.`
        : `Your business account for "${businessAccount.business_name}" has been rejected. Please contact support for more information.`,
      metadata: {
        business_account_id: businessAccount.id,
        business_name: businessAccount.business_name
      },
      read: false,
      created_at: new Date().toISOString()
    };

    await supabase
      .from('user_notifications')
      .insert(notificationData);

    // Also send email notification
    await sendVerificationEmail(businessAccount, approved);

  } catch (err) {
    console.error('Failed to notify business user:', err);
  }
}

/**
 * Sends email notification about verification decision
 */
async function sendVerificationEmail(
  businessAccount: BusinessAccount,
  approved: boolean
): Promise<void> {
  try {
    const supabase = createClientComponentClient();

    // Get user email
    const { data: userData } = await supabase
      .from('auth.users')
      .select('email')
      .eq('id', businessAccount.user_id)
      .single();

    if (!userData?.email) return;

    const emailData = {
      to: userData.email,
      template: approved ? 'business_account_approved' : 'business_account_rejected',
      data: {
        business_name: businessAccount.business_name,
        contact_person: businessAccount.contact_person,
        login_url: `${process.env.NEXT_PUBLIC_SITE_URL}/login`,
        support_email: process.env.SUPPORT_EMAIL || 'support@vocilia.com'
      }
    };

    // Queue email for sending
    await supabase
      .from('email_queue')
      .insert({
        to_email: emailData.to,
        template_name: emailData.template,
        template_data: emailData.data,
        priority: 'normal',
        status: 'pending',
        created_at: new Date().toISOString()
      });

  } catch (err) {
    console.error('Failed to send verification email:', err);
  }
}

/**
 * Creates default store for approved business
 */
async function createDefaultStore(businessAccount: BusinessAccount): Promise<void> {
  try {
    const supabase = createClientComponentClient();

    // Check if business already has stores
    const { data: existingStores } = await supabase
      .from('stores')
      .select('id')
      .eq('business_id', businessAccount.id)
      .limit(1);

    if (existingStores && existingStores.length > 0) {
      return; // Business already has stores
    }

    // Create default store
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .insert({
        name: `${businessAccount.business_name} - Main Location`,
        address: businessAccount.address,
        business_id: businessAccount.id,
        qr_code: generateQRCode(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (storeError || !store) {
      console.error('Failed to create default store:', storeError);
      return;
    }

    // Grant admin permissions to business account for the default store
    await supabase
      .from('business_stores')
      .insert({
        business_account_id: businessAccount.id,
        store_id: store.id,
        permissions: ['admin', 'read_feedback', 'write_context', 'manage_qr', 'view_analytics'],
        created_at: new Date().toISOString()
      });

  } catch (err) {
    console.error('Failed to create default store:', err);
  }
}

/**
 * Generates a unique QR code for a store
 */
function generateQRCode(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `VCL-${timestamp}-${random}`.toUpperCase();
}

/**
 * Validates admin permissions for verification actions
 */
export async function validateAdminPermissions(userId: string): Promise<{
  hasPermission: boolean;
  error?: string;
}> {
  try {
    const supabase = createClientComponentClient();

    // Check if user has admin role
    const { data: adminData, error } = await supabase
      .from('admin_users')
      .select('role, permissions')
      .eq('user_id', userId)
      .eq('active', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      return { hasPermission: false, error: error.message };
    }

    if (!adminData) {
      return { hasPermission: false, error: 'User is not an admin' };
    }

    // Check if admin has business verification permissions
    const canVerifyBusiness = adminData.role === 'super_admin' ||
      adminData.permissions?.includes('verify_business_accounts');

    return { hasPermission: canVerifyBusiness };

  } catch (err) {
    return {
      hasPermission: false,
      error: err instanceof Error ? err.message : 'Permission check failed'
    };
  }
}

/**
 * Bulk approve/reject multiple business registrations
 */
export async function bulkVerifyRegistrations(
  decisions: Array<{ businessAccountId: string; decision: VerificationDecision }>
): Promise<{
  successful: string[];
  failed: Array<{ businessAccountId: string; error: string }>;
}> {
  const successful: string[] = [];
  const failed: Array<{ businessAccountId: string; error: string }> = [];

  for (const { businessAccountId, decision } of decisions) {
    try {
      const result = await approveBusinessRegistration(businessAccountId, decision);
      if (result.success) {
        successful.push(businessAccountId);
      } else {
        failed.push({ businessAccountId, error: result.error || 'Unknown error' });
      }
    } catch (err) {
      failed.push({
        businessAccountId,
        error: err instanceof Error ? err.message : 'Verification failed'
      });
    }
  }

  return { successful, failed };
}