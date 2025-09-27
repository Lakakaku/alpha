'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PaymentStats from '../../components/payments/PaymentStats';
import ReconciliationTable from '../../components/payments/ReconciliationTable';
import FailedPaymentsList from '../../components/payments/FailedPaymentsList';

export default function PaymentsPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'reconciliation' | 'failed'>('overview');
  const [latestBatchId, setLatestBatchId] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Check admin authentication
    const sessionToken = localStorage.getItem('adminSessionToken');
    if (!sessionToken) {
      router.push('/admin/login');
      return;
    }
    setIsAuthenticated(true);

    // Fetch latest batch ID for reconciliation
    fetchLatestBatch();
  }, [router]);

  const fetchLatestBatch = async () => {
    try {
      const sessionToken = localStorage.getItem('adminSessionToken');
      const response = await fetch('/api/admin/payments/batch/latest', {
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setLatestBatchId(data.batchId);
      }
    } catch (error) {
      console.error('Error fetching latest batch:', error);
    }
  };

  if (!isAuthenticated) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Payment Management</h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage customer rewards, reconciliation reports, and payment failures
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <nav className="flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('overview')}
              className={`${
                activeTab === 'overview'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              } whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors duration-200`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('reconciliation')}
              className={`${
                activeTab === 'reconciliation'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              } whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors duration-200`}
            >
              Reconciliation
            </button>
            <button
              onClick={() => setActiveTab('failed')}
              className={`${
                activeTab === 'failed'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              } whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors duration-200`}
            >
              Failed Payments
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="mt-8">
          {activeTab === 'overview' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Payment Statistics</h2>
              <PaymentStats />
            </div>
          )}

          {activeTab === 'reconciliation' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Reconciliation Report</h2>
              {latestBatchId ? (
                <div>
                  <p className="text-sm text-gray-600 mb-4">
                    Latest batch ID: <span className="font-mono">{latestBatchId}</span>
                  </p>
                  <ReconciliationTable batchId={latestBatchId} />
                </div>
              ) : (
                <p className="text-gray-500">No batch reports available yet.</p>
              )}
            </div>
          )}

          {activeTab === 'failed' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Failed Payments</h2>
              <FailedPaymentsList />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}