'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Store {
  id: string;
  name: string;
  businessEmail: string;
  phoneNumber?: string;
  physicalAddress?: string;
  businessRegistrationNumber?: string;
  onlineStatus: boolean;
  syncStatus: 'pending' | 'success' | 'failed';
  lastSyncAt?: string;
  errorCount: number;
  performanceScore?: number;
  monitoringEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  recentMetrics?: {
    errorCount: number;
    avgPerformance: number;
    availabilityPercentage: number;
    syncSuccessRate: number;
  };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

interface StoreListProps {
  onStoreSelect?: (store: Store) => void;
  filters?: {
    search?: string;
    onlineStatus?: boolean;
    syncStatus?: 'pending' | 'success' | 'failed';
    monitoringEnabled?: boolean;
  };
}

export default function StoreList({ onStoreSelect, filters }: StoreListProps) {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
    hasNext: false,
    hasPrevious: false
  });
  const [searchQuery, setSearchQuery] = useState(filters?.search || '');
  const [statusFilter, setStatusFilter] = useState<string>(
    filters?.onlineStatus !== undefined ? (filters.onlineStatus ? 'online' : 'offline') : 'all'
  );
  const [syncFilter, setSyncFilter] = useState<string>(filters?.syncStatus || 'all');

  const fetchStores = async (page = 1) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString()
      });

      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }

      if (statusFilter !== 'all') {
        params.append('online_status', statusFilter === 'online' ? 'true' : 'false');
      }

      if (syncFilter !== 'all') {
        params.append('sync_status', syncFilter);
      }

      const response = await fetch(`/api/admin/stores?${params}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch stores');
      }

      const data = await response.json();

      if (data.success) {
        setStores(data.stores);
        setPagination(data.pagination);
      } else {
        throw new Error(data.error || 'Failed to fetch stores');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStores(1);
  }, [searchQuery, statusFilter, syncFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchStores(1);
  };

  const getStatusBadge = (store: Store) => {
    if (!store.monitoringEnabled) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          Monitoring Off
        </span>
      );
    }

    if (store.onlineStatus) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <div className="w-2 h-2 bg-green-400 rounded-full mr-1"></div>
          Online
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
        <div className="w-2 h-2 bg-red-400 rounded-full mr-1"></div>
        Offline
      </span>
    );
  };

  const getSyncStatusBadge = (syncStatus: string) => {
    switch (syncStatus) {
      case 'success':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Success
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            Failed
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            Pending
          </span>
        );
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading && stores.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Store Management</h1>
          <p className="mt-2 text-sm text-gray-700">
            Monitor and manage all stores in the system
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <Link
            href="/stores/create"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Create New Store
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow">
        <form onSubmit={handleSearch} className="space-y-4 sm:space-y-0 sm:flex sm:items-end sm:space-x-4">
          <div className="flex-1">
            <label htmlFor="search" className="block text-sm font-medium text-gray-700">
              Search stores
            </label>
            <input
              type="text"
              id="search"
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="Search by name, email, or address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700">
              Status
            </label>
            <select
              id="status"
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
            </select>
          </div>

          <div>
            <label htmlFor="sync" className="block text-sm font-medium text-gray-700">
              Sync Status
            </label>
            <select
              id="sync"
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              value={syncFilter}
              onChange={(e) => setSyncFilter(e.target.value)}
            >
              <option value="all">All Sync Status</option>
              <option value="success">Success</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <button
            type="submit"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Search
          </button>
        </form>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.664-.833-2.464 0L4.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* Store List */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {stores.map((store) => (
            <li key={store.id}>
              <div className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium text-blue-600 truncate">
                        <Link 
                          href={`/stores/${store.id}`}
                          onClick={() => onStoreSelect?.(store)}
                        >
                          {store.name}
                        </Link>
                      </h3>
                      <div className="flex items-center space-x-2">
                        {getStatusBadge(store)}
                        {getSyncStatusBadge(store.syncStatus)}
                      </div>
                    </div>
                    
                    <div className="mt-2 sm:flex sm:justify-between">
                      <div className="sm:flex">
                        <p className="text-sm text-gray-600">
                          {store.businessEmail}
                        </p>
                        {store.phoneNumber && (
                          <p className="mt-2 text-sm text-gray-600 sm:mt-0 sm:ml-6">
                            {store.phoneNumber}
                          </p>
                        )}
                      </div>
                    </div>

                    {store.physicalAddress && (
                      <p className="mt-2 text-sm text-gray-500 truncate">
                        📍 {store.physicalAddress}
                      </p>
                    )}

                    <div className="mt-2 flex items-center text-sm text-gray-500 space-x-4">
                      <span>ID: {store.id.substring(0, 8)}...</span>
                      {store.errorCount > 0 && (
                        <span className="text-red-600">
                          ⚠️ {store.errorCount} errors
                        </span>
                      )}
                      {store.performanceScore !== null && store.performanceScore !== undefined && (
                        <span>
                          📊 Performance: {store.performanceScore.toFixed(1)}/10
                        </span>
                      )}
                      {store.lastSyncAt && (
                        <span>
                          🔄 Last sync: {formatDate(store.lastSyncAt)}
                        </span>
                      )}
                    </div>

                    {store.recentMetrics && (
                      <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-gray-500">
                        <span>Availability: {store.recentMetrics.availabilityPercentage.toFixed(1)}%</span>
                        <span>Sync Rate: {store.recentMetrics.syncSuccessRate.toFixed(1)}%</span>
                        <span>Avg Performance: {store.recentMetrics.avgPerformance.toFixed(1)}</span>
                        <span>24h Errors: {store.recentMetrics.errorCount}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {stores.length === 0 && !loading && (
          <div className="text-center py-12">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 48 48"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M34 16l-8-8-8 8M26 16v12M6 16h4m28 0h4"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No stores found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchQuery || statusFilter !== 'all' || syncFilter !== 'all'
                ? 'Try adjusting your search criteria.'
                : 'Get started by creating a new store.'}
            </p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => fetchStores(pagination.page - 1)}
              disabled={!pagination.hasPrevious}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => fetchStores(pagination.page + 1)}
              disabled={!pagination.hasNext}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing <span className="font-medium">{((pagination.page - 1) * pagination.limit) + 1}</span> to{' '}
                <span className="font-medium">
                  {Math.min(pagination.page * pagination.limit, pagination.total)}
                </span>{' '}
                of <span className="font-medium">{pagination.total}</span> stores
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                <button
                  onClick={() => fetchStores(pagination.page - 1)}
                  disabled={!pagination.hasPrevious}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                  Page {pagination.page} of {pagination.pages}
                </span>
                <button
                  onClick={() => fetchStores(pagination.page + 1)}
                  disabled={!pagination.hasNext}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}