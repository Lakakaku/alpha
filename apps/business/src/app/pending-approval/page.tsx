'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
// Temporary mock hook for demo purposes
const useBusinessAuth = () => ({
  user: { id: 'demo-user', email: 'demo@business.com' },
  businessAccount: { 
    business_name: 'Demo Business',
    contact_person: 'John Doe',
    business_type: 'restaurant',
    verification_status: 'pending',
    created_at: new Date().toISOString()
  },
  signOut: async () => {},
  loading: false
});

export default function PendingApprovalPage() {
  const router = useRouter();
  const { user, businessAccount, signOut, loading } = useBusinessAuth();
  const [timeElapsed, setTimeElapsed] = useState('');

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }

    // Redirect if approved
    if (!loading && businessAccount?.verification_status === 'approved') {
      router.push('/dashboard');
      return;
    }

    // Redirect if rejected
    if (!loading && businessAccount?.verification_status === 'rejected') {
      router.push('/login?message=Your business account was rejected. Please contact support for more information.&type=error');
      return;
    }
  }, [user, businessAccount, loading, router]);

  // Calculate time elapsed since registration
  useEffect(() => {
    if (businessAccount?.created_at) {
      const updateTimeElapsed = () => {
        const createdAt = new Date(businessAccount.created_at);
        const now = new Date();
        const diffInHours = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60));
        
        if (diffInHours < 1) {
          const diffInMinutes = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60));
          setTimeElapsed(`${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`);
        } else if (diffInHours < 24) {
          setTimeElapsed(`${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`);
        } else {
          const diffInDays = Math.floor(diffInHours / 24);
          setTimeElapsed(`${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`);
        }
      };

      updateTimeElapsed();
      const interval = setInterval(updateTimeElapsed, 60000); // Update every minute

      return () => clearInterval(interval);
    }
  }, [businessAccount?.created_at]);

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  const handleContactSupport = () => {
    window.location.href = 'mailto:support@vocilia.com?subject=Business Account Approval Status&body=Hello, I would like to inquire about the status of my business account approval. My business name is: ' + (businessAccount?.business_name || '') + '. Thank you.';
  };

  // Show loading while authentication is being checked
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render anything if user is not authenticated or redirecting
  if (!user || !businessAccount || businessAccount.verification_status !== 'pending') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="text-2xl font-bold text-indigo-600">Vocilia</div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Account Pending Approval
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="text-center">
            {/* Status Icon */}
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-yellow-100 mb-6">
              <svg
                className="h-8 w-8 text-yellow-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>

            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Your account is being reviewed
            </h3>

            <p className="text-sm text-gray-600 mb-6">
              We're currently reviewing your business registration. This process typically takes 1-2 business days.
            </p>
          </div>

          {/* Business Information Summary */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Registration Details</h4>
            <dl className="space-y-2">
              <div className="flex justify-between text-sm">
                <dt className="text-gray-500">Business Name:</dt>
                <dd className="text-gray-900 font-medium">{businessAccount.business_name}</dd>
              </div>
              <div className="flex justify-between text-sm">
                <dt className="text-gray-500">Contact Person:</dt>
                <dd className="text-gray-900">{businessAccount.contact_person}</dd>
              </div>
              <div className="flex justify-between text-sm">
                <dt className="text-gray-500">Business Type:</dt>
                <dd className="text-gray-900 capitalize">{businessAccount.business_type}</dd>
              </div>
              <div className="flex justify-between text-sm">
                <dt className="text-gray-500">Submitted:</dt>
                <dd className="text-gray-900">{timeElapsed}</dd>
              </div>
            </dl>
          </div>

          {/* Status Timeline */}
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Review Process</h4>
            <div className="space-y-3">
              <div className="flex items-center">
                <div className="flex-shrink-0 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3 text-sm text-gray-900">Registration submitted</div>
              </div>
              
              <div className="flex items-center">
                <div className="flex-shrink-0 w-6 h-6 bg-yellow-100 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-yellow-600 rounded-full animate-pulse"></div>
                </div>
                <div className="ml-3 text-sm text-gray-900">Under admin review</div>
              </div>
              
              <div className="flex items-center">
                <div className="flex-shrink-0 w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                </div>
                <div className="ml-3 text-sm text-gray-500">Account approval</div>
              </div>
              
              <div className="flex items-center">
                <div className="flex-shrink-0 w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                </div>
                <div className="ml-3 text-sm text-gray-500">Dashboard access granted</div>
              </div>
            </div>
          </div>

          {/* What happens next */}
          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <h4 className="text-sm font-medium text-blue-900 mb-2">What happens next?</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Our team will review your business information</li>
              <li>• You'll receive an email notification when approved</li>
              <li>• Once approved, you can access your business dashboard</li>
              <li>• We may contact you if additional information is needed</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={handleContactSupport}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Contact Support
            </button>
            
            <button
              onClick={handleSignOut}
              className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Sign Out
            </button>
          </div>

          {/* Additional Information */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              Need to update your registration information?{' '}
              <button
                onClick={handleContactSupport}
                className="font-medium text-indigo-600 hover:text-indigo-500"
              >
                Contact our support team
              </button>
            </p>
          </div>

          {/* Support Hours */}
          <div className="mt-4 bg-gray-50 rounded-lg p-3">
            <h5 className="text-xs font-medium text-gray-900 mb-1">Support Hours</h5>
            <p className="text-xs text-gray-600">
              Monday - Friday: 9:00 AM - 6:00 PM (EST)<br />
              Average response time: 4-6 hours
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}