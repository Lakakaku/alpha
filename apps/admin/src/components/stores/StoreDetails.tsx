'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

interface Store {
  id: string
  name: string
  email: string
  phone_number?: string
  physical_address?: string
  qr_codes_count: number
  active_qr_codes: number
  total_verifications: number
  sync_status: 'synced' | 'pending' | 'error'
  online_status: 'online' | 'offline' | 'maintenance'
  performance_score: number
  last_sync: string
  created_at: string
  updated_at: string
}

interface StoreMetrics {
  sync_count: number
  error_count: number
  avg_response_time: number
  uptime_percentage: number
  last_error?: string
  last_sync: string
}

export default function StoreDetails() {
  const params = useParams()
  const router = useRouter()
  const storeId = params.id as string
  
  const [store, setStore] = useState<Store | null>(null)
  const [metrics, setMetrics] = useState<StoreMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    fetchStoreDetails()
  }, [storeId])

  const fetchStoreDetails = async () => {
    try {
      setLoading(true)
      const [storeResponse, metricsResponse] = await Promise.all([
        fetch(`/api/admin/stores/${storeId}`),
        fetch(`/api/admin/stores/${storeId}/metrics`)
      ])

      if (!storeResponse.ok) {
        throw new Error('Failed to fetch store details')
      }

      const storeData = await storeResponse.json()
      setStore(storeData)

      if (metricsResponse.ok) {
        const metricsData = await metricsResponse.json()
        setMetrics(metricsData)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load store details')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusUpdate = async (status: 'online' | 'offline' | 'maintenance') => {
    try {
      setUpdating(true)
      const response = await fetch(`/api/admin/stores/${storeId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ online_status: status })
      })

      if (!response.ok) {
        throw new Error('Failed to update store status')
      }

      setStore(prev => prev ? { ...prev, online_status: status } : null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status')
    } finally {
      setUpdating(false)
    }
  }

  const handleHealthCheck = async () => {
    try {
      setUpdating(true)
      const response = await fetch(`/api/admin/stores/${storeId}/health-check`, {
        method: 'POST'
      })

      if (!response.ok) {
        throw new Error('Health check failed')
      }

      await fetchStoreDetails()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Health check failed')
    } finally {
      setUpdating(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': case 'synced': return 'text-green-600 bg-green-100'
      case 'offline': case 'error': return 'text-red-600 bg-red-100'
      case 'maintenance': case 'pending': return 'text-yellow-600 bg-yellow-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getPerformanceColor = (score: number) => {
    if (score >= 90) return 'text-green-600'
    if (score >= 70) return 'text-yellow-600'
    return 'text-red-600'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading store details...</p>
        </div>
      </div>
    )
  }

  if (error || !store) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Store</h2>
          <p className="text-gray-600 mb-4">{error || 'Store not found'}</p>
          <button
            onClick={() => router.push('/admin/stores')}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Back to Stores
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/admin/stores')}
            className="mb-4 text-blue-600 hover:text-blue-800 flex items-center"
          >
            ← Back to Stores
          </button>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{store.name}</h1>
              <p className="text-gray-600">{store.email}</p>
            </div>
            <div className="flex space-x-3">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(store.online_status)}`}>
                {store.online_status}
              </span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(store.sync_status)}`}>
                {store.sync_status}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Store Information */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Store Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Store Name</label>
                  <p className="mt-1 text-gray-900">{store.name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <p className="mt-1 text-gray-900">{store.email}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Phone Number</label>
                  <p className="mt-1 text-gray-900">{store.phone_number || 'Not provided'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Physical Address</label>
                  <p className="mt-1 text-gray-900">{store.physical_address || 'Not provided'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Created</label>
                  <p className="mt-1 text-gray-900">{new Date(store.created_at).toLocaleDateString()}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Last Updated</label>
                  <p className="mt-1 text-gray-900">{new Date(store.updated_at).toLocaleDateString()}</p>
                </div>
              </div>
            </div>

            {/* QR Code Statistics */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">QR Code Statistics</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{store.qr_codes_count}</div>
                  <div className="text-sm text-gray-600">Total QR Codes</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{store.active_qr_codes}</div>
                  <div className="text-sm text-gray-600">Active QR Codes</div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">{store.total_verifications}</div>
                  <div className="text-sm text-gray-600">Total Verifications</div>
                </div>
              </div>
            </div>

            {/* Performance Metrics */}
            {metrics && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">Performance Metrics</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Sync Count</label>
                    <p className="mt-1 text-2xl font-bold text-gray-900">{metrics.sync_count}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Error Count</label>
                    <p className="mt-1 text-2xl font-bold text-red-600">{metrics.error_count}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Avg Response Time</label>
                    <p className="mt-1 text-2xl font-bold text-gray-900">{metrics.avg_response_time}ms</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Uptime</label>
                    <p className="mt-1 text-2xl font-bold text-green-600">{metrics.uptime_percentage}%</p>
                  </div>
                </div>
                {metrics.last_error && (
                  <div className="mt-4 p-3 bg-red-50 rounded-lg">
                    <h4 className="text-sm font-medium text-red-800">Last Error</h4>
                    <p className="text-sm text-red-700">{metrics.last_error}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions Panel */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Store Status</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Online Status</label>
                  <select
                    value={store.online_status}
                    onChange={(e) => handleStatusUpdate(e.target.value as any)}
                    disabled={updating}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="online">Online</option>
                    <option value="offline">Offline</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Performance Score</label>
                  <div className={`text-2xl font-bold ${getPerformanceColor(store.performance_score)}`}>
                    {store.performance_score}/100
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Last Sync</label>
                  <p className="text-sm text-gray-900">{new Date(store.last_sync).toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Actions</h2>
              <div className="space-y-3">
                <button
                  onClick={handleHealthCheck}
                  disabled={updating}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {updating ? 'Running...' : 'Run Health Check'}
                </button>
                <button
                  onClick={() => router.push(`/admin/stores/${storeId}/edit`)}
                  className="w-full px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  Edit Store
                </button>
                <button
                  onClick={() => router.push(`/admin/stores/${storeId}/qr-codes`)}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Manage QR Codes
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}