'use client';

import { useState, useEffect } from 'react';

interface PaymentStatsData {
  totalPaymentsThisWeek: number;
  successRatePercent: number;
  totalAmountPaidSek: number;
  failedPaymentsCount: number;
}

export default function PaymentStats() {
  const [stats, setStats] = useState<PaymentStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const sessionToken = localStorage.getItem('adminSessionToken');
      const response = await fetch('/api/admin/payments/stats', {
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch payment statistics');
      }

      const data = await response.json();
      setStats(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white overflow-hidden shadow rounded-lg animate-pulse">
            <div className="p-5">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Error loading statistics: {error}</p>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const statCards = [
    {
      title: 'Total Payments This Week',
      value: stats.totalPaymentsThisWeek.toLocaleString(),
      bgColor: 'bg-blue-500'
    },
    {
      title: 'Success Rate',
      value: `${stats.successRatePercent.toFixed(1)}%`,
      bgColor: 'bg-green-500'
    },
    {
      title: 'Total Amount Paid',
      value: `${stats.totalAmountPaidSek.toFixed(2)} SEK`,
      bgColor: 'bg-indigo-500'
    },
    {
      title: 'Failed Payments',
      value: stats.failedPaymentsCount.toLocaleString(),
      bgColor: 'bg-red-500'
    }
  ];

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {statCards.map((stat, index) => (
        <div key={index} className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-1">
                <dt className="text-sm font-medium text-gray-500 truncate">
                  {stat.title}
                </dt>
                <dd className="mt-1 text-3xl font-semibold text-gray-900">
                  {stat.value}
                </dd>
              </div>
              <div className={`ml-4 h-12 w-12 rounded-md ${stat.bgColor} opacity-80`}></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}