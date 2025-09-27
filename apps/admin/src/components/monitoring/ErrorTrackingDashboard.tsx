'use client'

import { useState, useEffect } from 'react'

interface ErrorLog {
  id: string
  timestamp: string
  severity: 'critical' | 'warning' | 'info'
  error_message: string
  stack_trace?: string
  service_name: string
  endpoint?: string
  user_context: Record<string, any>
  resolution_status: 'open' | 'investigating' | 'resolved'
}

interface PaginationInfo {
  total: number
  limit: number
  offset: number
  has_more: boolean
}

const SEVERITY_OPTIONS = [
  { value: '', label: 'All Severities' },
  { value: 'critical', label: 'Critical' },
  { value: 'warning', label: 'Warning' },
  { value: 'info', label: 'Info' }
]

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'open', label: 'Open' },
  { value: 'investigating', label: 'Investigating' },
  { value: 'resolved', label: 'Resolved' }
]

const SERVICE_OPTIONS = [
  { value: '', label: 'All Services' },
  { value: 'backend', label: 'Backend API' },
  { value: 'customer_app', label: 'Customer App' },
  { value: 'business_app', label: 'Business App' },
  { value: 'admin_app', label: 'Admin App' }
]

export default function ErrorTrackingDashboard() {
  const [errors, setErrors] = useState<ErrorLog[]>([])
  const [pagination, setPagination] = useState<PaginationInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedError, setSelectedError] = useState<ErrorLog | null>(null)
  const [showStackTrace, setShowStackTrace] = useState<string | null>(null)
  
  // Filter states
  const [filters, setFilters] = useState({
    severity: '',
    service: '',
    search: '',
    status: '',
    limit: 50,
    offset: 0
  })

  // Update resolution status
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null)

  useEffect(() => {
    fetchErrors()
  }, [filters])

  const fetchErrors = async () => {
    try {
      setLoading(true)
      
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== '' && value !== 0) {
          params.append(key, value.toString())
        }
      })

      const response = await fetch(`/api/monitoring/errors?${params}`)
      if (response.ok) {
        const data = await response.json()
        setErrors(data.errors || [])
        setPagination(data.pagination || null)
        setError('')
      } else {
        setError('Failed to fetch error logs')
      }
    } catch (err) {
      setError('Network error while fetching error logs')
      console.error('Error fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  const updateErrorStatus = async (errorId: string, newStatus: 'open' | 'investigating' | 'resolved') => {
    try {
      setUpdatingStatus(errorId)
      
      const response = await fetch('/api/monitoring/errors', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          error_id: errorId,
          resolution_status: newStatus
        })
      })

      if (response.ok) {
        // Update the error in the local state
        setErrors(prev => prev.map(err => 
          err.id === errorId ? { ...err, resolution_status: newStatus } : err
        ))
        
        // Update selected error if it's the one being updated
        if (selectedError?.id === errorId) {
          setSelectedError(prev => prev ? { ...prev, resolution_status: newStatus } : null)
        }
      } else {
        setError('Failed to update error status')
      }
    } catch (err) {
      setError('Network error while updating error status')
      console.error('Update error status error:', err)
    } finally {
      setUpdatingStatus(null)
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800'
      case 'warning': return 'bg-yellow-100 text-yellow-800'
      case 'info': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-red-100 text-red-800'
      case 'investigating': return 'bg-yellow-100 text-yellow-800'
      case 'resolved': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const handleFilterChange = (key: string, value: string | number) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      offset: key === 'offset' ? value : 0 // Reset to first page unless explicitly setting offset
    }))
  }

  const handlePageChange = (newOffset: number) => {
    setFilters(prev => ({ ...prev, offset: newOffset }))
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString()
  }

  const truncateMessage = (message: string, maxLength: number = 100) => {
    if (message.length <= maxLength) return message
    return message.slice(0, maxLength) + '...'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Error Tracking</h1>
          <p className="text-gray-600">Monitor and resolve application errors across all services</p>
        </div>
        <button
          onClick={fetchErrors}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          🔄 Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold mb-4">Filter Error Logs</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div>
            <label htmlFor="severity" className="block text-sm font-medium text-gray-700 mb-1">
              Severity
            </label>
            <select
              id="severity"
              value={filters.severity}
              onChange={(e) => handleFilterChange('severity', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {SEVERITY_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="service" className="block text-sm font-medium text-gray-700 mb-1">
              Service
            </label>
            <select
              id="service"
              value={filters.service}
              onChange={(e) => handleFilterChange('service', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {SERVICE_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              id="status"
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {STATUS_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="limit" className="block text-sm font-medium text-gray-700 mb-1">
              Per Page
            </label>
            <select
              id="limit"
              value={filters.limit}
              onChange={(e) => handleFilterChange('limit', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
            Search Error Messages
          </label>
          <input
            id="search"
            type="text"
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            placeholder="Search in error messages..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Error List */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-6 border-b">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Error Logs</h2>
            {pagination && (
              <span className="text-sm text-gray-600">
                Showing {pagination.offset + 1}-{Math.min(pagination.offset + pagination.limit, pagination.total)} of {pagination.total}
              </span>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Loading error logs...</span>
          </div>
        ) : errors.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No error logs found matching your criteria
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {errors.map((errorLog) => (
              <div key={errorLog.id} className="p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(errorLog.severity)}`}>
                        {errorLog.severity.toUpperCase()}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(errorLog.resolution_status)}`}>
                        {errorLog.resolution_status.toUpperCase()}
                      </span>
                      <span className="text-sm text-gray-500">{errorLog.service_name}</span>
                      {errorLog.endpoint && (
                        <span className="text-sm text-gray-500">• {errorLog.endpoint}</span>
                      )}
                    </div>
                    
                    <p className="text-sm text-gray-900 mb-2">{truncateMessage(errorLog.error_message)}</p>
                    
                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      <span>{formatTimestamp(errorLog.timestamp)}</span>
                      <button
                        onClick={() => setSelectedError(selectedError?.id === errorLog.id ? null : errorLog)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        {selectedError?.id === errorLog.id ? 'Hide Details' : 'View Details'}
                      </button>
                      {errorLog.stack_trace && (
                        <button
                          onClick={() => setShowStackTrace(showStackTrace === errorLog.id ? null : errorLog.id)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          {showStackTrace === errorLog.id ? 'Hide Stack' : 'View Stack'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Status Update Buttons */}
                  <div className="flex space-x-2 ml-4">
                    {errorLog.resolution_status !== 'investigating' && (
                      <button
                        onClick={() => updateErrorStatus(errorLog.id, 'investigating')}
                        disabled={updatingStatus === errorLog.id}
                        className="px-3 py-1 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50"
                      >
                        Mark Investigating
                      </button>
                    )}
                    {errorLog.resolution_status !== 'resolved' && (
                      <button
                        onClick={() => updateErrorStatus(errorLog.id, 'resolved')}
                        disabled={updatingStatus === errorLog.id}
                        className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                      >
                        Mark Resolved
                      </button>
                    )}
                    {errorLog.resolution_status !== 'open' && (
                      <button
                        onClick={() => updateErrorStatus(errorLog.id, 'open')}
                        disabled={updatingStatus === errorLog.id}
                        className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                      >
                        Reopen
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {selectedError?.id === errorLog.id && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Error Details</h4>
                        <p className="text-sm text-gray-700 mb-2">{errorLog.error_message}</p>
                        <div className="text-xs text-gray-500">
                          <p><strong>ID:</strong> {errorLog.id}</p>
                          <p><strong>Service:</strong> {errorLog.service_name}</p>
                          {errorLog.endpoint && <p><strong>Endpoint:</strong> {errorLog.endpoint}</p>}
                          <p><strong>Timestamp:</strong> {formatTimestamp(errorLog.timestamp)}</p>
                        </div>
                      </div>
                      
                      {Object.keys(errorLog.user_context).length > 0 && (
                        <div>
                          <h4 className="font-medium text-gray-900 mb-2">User Context</h4>
                          <pre className="text-xs text-gray-700 bg-white p-2 rounded border overflow-auto max-h-32">
                            {JSON.stringify(errorLog.user_context, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Stack Trace */}
                {showStackTrace === errorLog.id && errorLog.stack_trace && (
                  <div className="mt-4">
                    <h4 className="font-medium text-gray-900 mb-2">Stack Trace</h4>
                    <pre className="text-xs text-gray-700 bg-gray-50 p-4 rounded border overflow-auto max-h-64">
                      {errorLog.stack_trace}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.total > pagination.limit && (
          <div className="flex justify-between items-center px-6 py-4 border-t">
            <button
              onClick={() => handlePageChange(Math.max(0, pagination.offset - pagination.limit))}
              disabled={pagination.offset === 0}
              className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            
            <span className="text-sm text-gray-600">
              Page {Math.floor(pagination.offset / pagination.limit) + 1} of {Math.ceil(pagination.total / pagination.limit)}
            </span>
            
            <button
              onClick={() => handlePageChange(pagination.offset + pagination.limit)}
              disabled={!pagination.has_more}
              className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  )
}