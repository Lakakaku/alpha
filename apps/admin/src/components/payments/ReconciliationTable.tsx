'use client';

import { useState, useEffect } from 'react';

interface StoreBreakdown {
  storeId: string;
  storeName: string;
  businessName: string;
  feedbackCount: number;
  verifiedCount: number;
  averageQualityScore: number;
  totalRewardsSek: number;
  successfulPayments: number;
  failedPayments: number;
}

interface ReconciliationData {
  batchId: string;
  reportPeriod: string;
  totalRewardsPaidSek: number;
  adminFeesCollectedSek: number;
  paymentSuccessCount: number;
  paymentFailureCount: number;
  paymentSuccessRate: number;
  storeBreakdown: StoreBreakdown[];
}

interface ReconciliationTableProps {
  batchId: string;
}

export default function ReconciliationTable({ batchId }: ReconciliationTableProps) {
  const [data, setData] = useState<ReconciliationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedStores, setExpandedStores] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchReconciliationData();
  }, [batchId]);

  const fetchReconciliationData = async () => {
    try {
      const sessionToken = localStorage.getItem('adminSessionToken');
      const response = await fetch(`/api/admin/payments/reconciliation/${batchId}`, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch reconciliation data');
      }

      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const toggleStoreExpansion = (storeId: string) => {
    const newExpanded = new Set(expandedStores);
    if (newExpanded.has(storeId)) {
      newExpanded.delete(storeId);
    } else {
      newExpanded.add(storeId);
    }
    setExpandedStores(newExpanded);
  };

  if (loading) {
    return (
      <div className="bg-white shadow-lg rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Error loading reconciliation report: {error}</p>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="bg-white shadow-lg rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">
          Reconciliation Report - Week {data.reportPeriod}
        </h3>
        <p className="mt-1 text-sm text-gray-500">Batch ID: {data.batchId}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Store / Business
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Feedback
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Verified
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Avg Score
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Rewards (SEK)
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Successful
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Failed
              </th>
              <th scope="col" className="relative px-6 py-3">
                <span className="sr-only">Expand</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.storeBreakdown.map((store) => (
              <React.Fragment key={store.storeId}>
                <tr className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{store.storeName}</div>
                      <div className="text-sm text-gray-500">{store.businessName}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {store.feedbackCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {store.verifiedCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {store.averageQualityScore.toFixed(1)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {store.totalRewardsSek.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                      {store.successfulPayments}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {store.failedPayments > 0 ? (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                        {store.failedPayments}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-500">0</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => toggleStoreExpansion(store.storeId)}
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      {expandedStores.has(store.storeId) ? 'Collapse' : 'Expand'}
                    </button>
                  </td>
                </tr>
                {expandedStores.has(store.storeId) && (
                  <tr className="bg-gray-50">
                    <td colSpan={8} className="px-6 py-4">
                      <div className="text-sm text-gray-700">
                        <p>Detailed breakdown for {store.storeName}:</p>
                        <ul className="mt-2 list-disc list-inside">
                          <li>Total feedback submissions: {store.feedbackCount}</li>
                          <li>Business-verified feedback: {store.verifiedCount}</li>
                          <li>Average quality score: {store.averageQualityScore.toFixed(2)}/100</li>
                          <li>Total rewards paid: {store.totalRewardsSek.toFixed(2)} SEK</li>
                          <li>Payment success rate: {
                            store.successfulPayments + store.failedPayments > 0
                              ? ((store.successfulPayments / (store.successfulPayments + store.failedPayments)) * 100).toFixed(1)
                              : '0'
                          }%</li>
                        </ul>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
          <tfoot className="bg-gray-100">
            <tr>
              <td colSpan={4} className="px-6 py-4 text-sm font-medium text-gray-900">
                Summary Totals
              </td>
              <td className="px-6 py-4 text-sm font-bold text-gray-900">
                {data.totalRewardsPaidSek.toFixed(2)} SEK
              </td>
              <td className="px-6 py-4">
                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                  {data.paymentSuccessCount}
                </span>
              </td>
              <td className="px-6 py-4">
                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                  {data.paymentFailureCount}
                </span>
              </td>
              <td></td>
            </tr>
            <tr className="border-t-2 border-gray-300">
              <td colSpan={4} className="px-6 py-4 text-sm font-medium text-gray-900">
                Admin Fees (20%)
              </td>
              <td className="px-6 py-4 text-sm font-bold text-gray-900">
                {data.adminFeesCollectedSek.toFixed(2)} SEK
              </td>
              <td colSpan={3} className="px-6 py-4 text-sm text-gray-500">
                Success Rate: {data.paymentSuccessRate.toFixed(1)}%
              </td>
            </tr>
            <tr className="bg-indigo-50 border-t-2 border-indigo-200">
              <td colSpan={4} className="px-6 py-4 text-sm font-bold text-gray-900">
                Total Invoice Amount (Rewards + Admin Fees)
              </td>
              <td className="px-6 py-4 text-sm font-bold text-indigo-900">
                {(data.totalRewardsPaidSek + data.adminFeesCollectedSek).toFixed(2)} SEK
              </td>
              <td colSpan={3}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}