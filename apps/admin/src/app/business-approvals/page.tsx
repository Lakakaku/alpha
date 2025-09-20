'use client';

import { useState, useEffect } from 'react';
// Types for business approval
interface PendingRegistration {
  id: string;
  email: string;
  business_name: string;
  business_phone?: string;
  business_type: string;
  contact_person: string;
  phone: string;
  address: string;
  estimated_monthly_customers: number;
  created_at: string;
}

interface VerificationDecision {
  approved: boolean;
  notes?: string;
  adminUserId: string;
}

// Client-side functions for admin verification
async function getPendingRegistrations(): Promise<{ registrations: PendingRegistration[]; error?: string }> {
  const supabase = createClientComponentClient();
  
  const { data, error } = await supabase
    .from('business_accounts')
    .select('*')
    .eq('verification_status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching pending registrations:', error);
    return { registrations: [], error: error.message };
  }

  return { 
    registrations: (data || []).map(account => ({
      id: account.id,
      email: account.email || '',
      business_name: account.business_name || '',
      business_phone: account.phone,
      business_type: account.business_type || 'restaurant',
      contact_person: account.contact_person || '',
      phone: account.phone || '',
      address: account.address || '',
      estimated_monthly_customers: account.estimated_monthly_customers || 0,
      created_at: account.created_at
    }))
  };
}

async function validateAdminPermissions(userId: string): Promise<{ hasPermission: boolean; error?: string }> {
  const supabase = createClientComponentClient();
  
  const { data, error } = await supabase
    .from('user_accounts')
    .select('role')
    .eq('id', userId)
    .single();

  if (error || !data) {
    return { hasPermission: false, error: 'Failed to verify admin permissions' };
  }
  
  return { hasPermission: data.role === 'admin' };
}

async function approveBusinessRegistration(
  businessId: string,
  decision: VerificationDecision
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClientComponentClient();
  
  const { error } = await supabase
    .from('business_accounts')
    .update({ 
      verification_status: 'approved',
      verification_notes: decision.notes,
      verified_at: new Date().toISOString(),
      verified_by: decision.adminUserId
    })
    .eq('id', businessId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

async function rejectBusinessRegistration(
  businessId: string,
  decision: VerificationDecision
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClientComponentClient();
  
  const { error } = await supabase
    .from('business_accounts')
    .update({ 
      verification_status: 'rejected',
      verification_notes: decision.notes,
      verified_at: new Date().toISOString(),
      verified_by: decision.adminUserId
    })
    .eq('id', businessId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

interface BusinessApprovalPageState {
  registrations: PendingRegistration[];
  loading: boolean;
  error: string | null;
  processing: Set<string>;
  selectedRegistrations: Set<string>;
  adminUserId: string | null;
}

export default function BusinessApprovalsPage() {
  const [state, setState] = useState<BusinessApprovalPageState>({
    registrations: [],
    loading: true,
    error: null,
    processing: new Set(),
    selectedRegistrations: new Set(),
    adminUserId: null
  });

  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        router.push('/admin/login');
        return;
      }

      const { hasPermission, error } = await validateAdminPermissions(session.user.id);
      
      if (!hasPermission) {
        setState(prev => ({ 
          ...prev, 
          loading: false, 
          error: error || 'Insufficient permissions to access business approvals' 
        }));
        return;
      }

      setState(prev => ({ ...prev, adminUserId: session.user.id }));
      await loadPendingRegistrations();
    } catch (err) {
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: 'Failed to verify admin access' 
      }));
    }
  };

  const loadPendingRegistrations = async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const { registrations, error } = await getPendingRegistrations();
      
      if (error) {
        setState(prev => ({ ...prev, loading: false, error }));
        return;
      }

      setState(prev => ({ 
        ...prev, 
        registrations, 
        loading: false 
      }));
    } catch (err) {
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: 'Failed to load pending registrations' 
      }));
    }
  };

  const handleApprove = async (registrationId: string, notes?: string) => {
    if (!state.adminUserId) return;

    setState(prev => ({ 
      ...prev, 
      processing: new Set([...prev.processing, registrationId]) 
    }));

    try {
      const decision: VerificationDecision = {
        approved: true,
        notes,
        adminUserId: state.adminUserId
      };

      const result = await approveBusinessRegistration(registrationId, decision);
      
      if (result.success) {
        // Remove from pending list
        setState(prev => ({
          ...prev,
          registrations: prev.registrations.filter(r => r.id !== registrationId),
          processing: new Set([...prev.processing].filter(id => id !== registrationId))
        }));
      } else {
        setState(prev => ({
          ...prev,
          error: result.error || 'Failed to approve registration',
          processing: new Set([...prev.processing].filter(id => id !== registrationId))
        }));
      }
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: 'Failed to approve registration',
        processing: new Set([...prev.processing].filter(id => id !== registrationId))
      }));
    }
  };

  const handleReject = async (registrationId: string, notes: string) => {
    if (!state.adminUserId) return;

    setState(prev => ({ 
      ...prev, 
      processing: new Set([...prev.processing, registrationId]) 
    }));

    try {
      const decision: VerificationDecision = {
        approved: false,
        notes,
        adminUserId: state.adminUserId
      };

      const result = await rejectBusinessRegistration(registrationId, decision);
      
      if (result.success) {
        // Remove from pending list
        setState(prev => ({
          ...prev,
          registrations: prev.registrations.filter(r => r.id !== registrationId),
          processing: new Set([...prev.processing].filter(id => id !== registrationId))
        }));
      } else {
        setState(prev => ({
          ...prev,
          error: result.error || 'Failed to reject registration',
          processing: new Set([...prev.processing].filter(id => id !== registrationId))
        }));
      }
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: 'Failed to reject registration',
        processing: new Set([...prev.processing].filter(id => id !== registrationId))
      }));
    }
  };

  const toggleSelection = (registrationId: string) => {
    setState(prev => {
      const newSelected = new Set(prev.selectedRegistrations);
      if (newSelected.has(registrationId)) {
        newSelected.delete(registrationId);
      } else {
        newSelected.add(registrationId);
      }
      return { ...prev, selectedRegistrations: newSelected };
    });
  };

  const selectAll = () => {
    setState(prev => ({
      ...prev,
      selectedRegistrations: new Set(prev.registrations.map(r => r.id))
    }));
  };

  const clearSelection = () => {
    setState(prev => ({
      ...prev,
      selectedRegistrations: new Set()
    }));
  };

  if (state.loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading pending registrations...</p>
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded max-w-md">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{state.error}</span>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Business Account Approvals</h1>
          <p className="mt-2 text-gray-600">
            Review and approve pending business registrations
          </p>
        </div>

        {state.registrations.length === 0 ? (
          <div className="bg-white rounded-lg shadow px-6 py-12 text-center">
            <div className="text-gray-400 text-6xl mb-4">📋</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No pending registrations</h3>
            <p className="text-gray-500">All business registrations have been processed.</p>
            <button
              onClick={loadPendingRegistrations}
              className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Refresh
            </button>
          </div>
        ) : (
          <>
            {/* Bulk Actions */}
            <div className="bg-white rounded-lg shadow mb-6 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-600">
                    {state.selectedRegistrations.size} of {state.registrations.length} selected
                  </span>
                  <button
                    onClick={selectAll}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Select All
                  </button>
                  <button
                    onClick={clearSelection}
                    className="text-sm text-gray-600 hover:text-gray-800"
                  >
                    Clear Selection
                  </button>
                </div>
                <button
                  onClick={loadPendingRegistrations}
                  className="bg-gray-100 text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-200"
                >
                  Refresh
                </button>
              </div>
            </div>

            {/* Registration List */}
            <div className="space-y-6">
              {state.registrations.map((registration) => (
                <RegistrationCard
                  key={registration.id}
                  registration={registration}
                  isSelected={state.selectedRegistrations.has(registration.id)}
                  isProcessing={state.processing.has(registration.id)}
                  onToggleSelection={() => toggleSelection(registration.id)}
                  onApprove={(notes) => handleApprove(registration.id, notes)}
                  onReject={(notes) => handleReject(registration.id, notes)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

interface RegistrationCardProps {
  registration: PendingRegistration;
  isSelected: boolean;
  isProcessing: boolean;
  onToggleSelection: () => void;
  onApprove: (notes?: string) => void;
  onReject: (notes: string) => void;
}

function RegistrationCard({
  registration,
  isSelected,
  isProcessing,
  onToggleSelection,
  onApprove,
  onReject
}: RegistrationCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [rejectionNotes, setRejectionNotes] = useState('');
  const [showApprovalForm, setShowApprovalForm] = useState(false);
  const [showRejectionForm, setShowRejectionForm] = useState(false);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatBusinessType = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ');
  };

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200">
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={onToggleSelection}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {registration.business_name}
              </h3>
              <p className="text-sm text-gray-500">
                Registered {formatDate(registration.created_at)}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-gray-400 hover:text-gray-600"
            >
              {showDetails ? '▼' : '▶'}
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <span className="text-sm font-medium text-gray-500">Contact Person</span>
            <p className="text-sm text-gray-900">{registration.contact_person}</p>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-500">Email</span>
            <p className="text-sm text-gray-900">{registration.email}</p>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-500">Business Type</span>
            <p className="text-sm text-gray-900">{formatBusinessType(registration.business_type)}</p>
          </div>
        </div>

        {showDetails && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <span className="text-sm font-medium text-gray-500">Phone</span>
                <p className="text-sm text-gray-900">{registration.phone}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Monthly Customers</span>
                <p className="text-sm text-gray-900">{registration.estimated_monthly_customers}</p>
              </div>
              <div className="md:col-span-2">
                <span className="text-sm font-medium text-gray-500">Address</span>
                <p className="text-sm text-gray-900">{registration.address}</p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={() => setShowApprovalForm(true)}
            disabled={isProcessing}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? 'Processing...' : 'Approve'}
          </button>
          <button
            onClick={() => setShowRejectionForm(true)}
            disabled={isProcessing}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? 'Processing...' : 'Reject'}
          </button>
        </div>

        {/* Approval Form */}
        {showApprovalForm && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded">
            <h4 className="font-medium text-green-800 mb-3">Approve Registration</h4>
            <textarea
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
              placeholder="Optional approval notes..."
              className="w-full p-2 border border-gray-300 rounded text-sm"
              rows={3}
            />
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => {
                  onApprove(approvalNotes || undefined);
                  setShowApprovalForm(false);
                  setApprovalNotes('');
                }}
                className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
              >
                Confirm Approval
              </button>
              <button
                onClick={() => {
                  setShowApprovalForm(false);
                  setApprovalNotes('');
                }}
                className="bg-gray-300 text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Rejection Form */}
        {showRejectionForm && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded">
            <h4 className="font-medium text-red-800 mb-3">Reject Registration</h4>
            <textarea
              value={rejectionNotes}
              onChange={(e) => setRejectionNotes(e.target.value)}
              placeholder="Reason for rejection (required)..."
              className="w-full p-2 border border-gray-300 rounded text-sm"
              rows={3}
              required
            />
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => {
                  if (rejectionNotes.trim()) {
                    onReject(rejectionNotes);
                    setShowRejectionForm(false);
                    setRejectionNotes('');
                  }
                }}
                disabled={!rejectionNotes.trim()}
                className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirm Rejection
              </button>
              <button
                onClick={() => {
                  setShowRejectionForm(false);
                  setRejectionNotes('');
                }}
                className="bg-gray-300 text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}