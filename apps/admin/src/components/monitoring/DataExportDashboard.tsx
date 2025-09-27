'use client'

import { useState, useEffect } from 'react'

interface ExportRequest {
  data_type: 'system_metrics' | 'fraud_reports' | 'revenue_analytics' | 'business_performance'
  format: 'csv' | 'pdf' | 'json'
  date_range: {
    start_date: string
    end_date: string
  }
  filters?: {
    store_ids?: string[]
    service_names?: string[]
  }
}

interface ExportJob {
  export_id: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  data_type: string
  format: string
  created_at: string
  download_url?: string
  expires_at?: string
  file_size?: number
  error_message?: string
}

const DATA_TYPE_OPTIONS = [
  { value: 'system_metrics', label: 'System Metrics', description: 'Performance metrics, API response times, error rates' },
  { value: 'fraud_reports', label: 'Fraud Detection Reports', description: 'Verification failures and suspicious patterns' },
  { value: 'revenue_analytics', label: 'Revenue Analytics', description: 'Revenue data, rewards paid, admin fees' },
  { value: 'business_performance', label: 'Business Performance', description: 'Store performance metrics and trends' }
]

const FORMAT_OPTIONS = [
  { value: 'csv', label: 'CSV', description: 'Spreadsheet format for data analysis' },
  { value: 'pdf', label: 'PDF', description: 'Formatted report for presentation' },
  { value: 'json', label: 'JSON', description: 'Structured data for API integration' }
]

const SERVICE_OPTIONS = [
  'backend',
  'customer_app',
  'business_app',
  'admin_app'
]

export default function DataExportDashboard() {
  const [exportJobs, setExportJobs] = useState<ExportJob[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)

  // Form state
  const [exportForm, setExportForm] = useState<ExportRequest>({
    data_type: 'system_metrics',
    format: 'csv',
    date_range: {
      start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days ago
      end_date: new Date().toISOString().split('T')[0]
    },
    filters: {
      store_ids: [],
      service_names: []
    }
  })

  // Filter inputs
  const [storeIdInput, setStoreIdInput] = useState('')
  const [selectedServices, setSelectedServices] = useState<string[]>([])

  useEffect(() => {
    fetchExportJobs()
    
    // Poll for job status updates every 5 seconds
    const interval = setInterval(fetchExportJobs, 5000)
    return () => clearInterval(interval)
  }, [])

  const fetchExportJobs = async () => {
    try {
      // Note: This would typically be a separate endpoint for listing export jobs
      // For now, we'll just simulate the job list
      setLoading(false)
    } catch (err) {
      console.error('Export jobs fetch error:', err)
    }
  }

  const createExport = async () => {
    try {
      setCreating(true)
      setError('')

      // Prepare the request with filters
      const requestBody: ExportRequest = {
        ...exportForm,
        filters: {
          ...(storeIdInput.trim() ? { store_ids: storeIdInput.split(',').map(id => id.trim()) } : {}),
          ...(selectedServices.length > 0 ? { service_names: selectedServices } : {})
        }
      }

      const response = await fetch('/api/monitoring/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      if (response.ok) {
        const result = await response.json()
        
        if (result.download_url) {
          // Immediate download available
          const newJob: ExportJob = {
            export_id: `export_${Date.now()}`,
            status: 'completed',
            data_type: exportForm.data_type,
            format: exportForm.format,
            created_at: new Date().toISOString(),
            download_url: result.download_url,
            expires_at: result.expires_at,
            file_size: result.file_size
          }
          setExportJobs(prev => [newJob, ...prev])
          
          // Auto-download
          window.open(result.download_url, '_blank')
        } else if (result.export_id) {
          // Job queued for processing
          const newJob: ExportJob = {
            export_id: result.export_id,
            status: result.status || 'queued',
            data_type: exportForm.data_type,
            format: exportForm.format,
            created_at: new Date().toISOString()
          }
          setExportJobs(prev => [newJob, ...prev])
        }
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to create export')
      }
    } catch (err) {
      setError('Network error while creating export')
      console.error('Create export error:', err)
    } finally {
      setCreating(false)
    }
  }

  const downloadExport = (job: ExportJob) => {
    if (job.download_url) {
      window.open(job.download_url, '_blank')
    }
  }

  const handleServiceToggle = (service: string) => {
    setSelectedServices(prev => 
      prev.includes(service) 
        ? prev.filter(s => s !== service)
        : [...prev, service]
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800'
      case 'processing': return 'bg-blue-100 text-blue-800'
      case 'queued': return 'bg-yellow-100 text-yellow-800'
      case 'failed': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown'
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  const getDataTypeDescription = (dataType: string) => {
    return DATA_TYPE_OPTIONS.find(option => option.value === dataType)?.description || ''
  }

  const getFormatDescription = (format: string) => {
    return FORMAT_OPTIONS.find(option => option.value === format)?.description || ''
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Data Export</h1>
          <p className="text-gray-600">Export analytics data in multiple formats for analysis and reporting</p>
        </div>
        <button
          onClick={fetchExportJobs}
          className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
        >
          🔄 Refresh Jobs
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Export Form */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold mb-4">Create New Export</h2>
        
        <div className="space-y-6">
          {/* Data Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Data Type *
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {DATA_TYPE_OPTIONS.map(option => (
                <label key={option.value} className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="data_type"
                    value={option.value}
                    checked={exportForm.data_type === option.value}
                    onChange={(e) => setExportForm(prev => ({ ...prev, data_type: e.target.value as any }))}
                    className="mt-1 h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-900">{option.label}</div>
                    <div className="text-xs text-gray-500">{option.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Format Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Export Format *
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {FORMAT_OPTIONS.map(option => (
                <label key={option.value} className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="format"
                    value={option.value}
                    checked={exportForm.format === option.value}
                    onChange={(e) => setExportForm(prev => ({ ...prev, format: e.target.value as any }))}
                    className="mt-1 h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-900">{option.label}</div>
                    <div className="text-xs text-gray-500">{option.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date Range *
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="start-date" className="block text-xs text-gray-500 mb-1">Start Date</label>
                <input
                  id="start-date"
                  type="date"
                  value={exportForm.date_range.start_date}
                  onChange={(e) => setExportForm(prev => ({
                    ...prev,
                    date_range: { ...prev.date_range, start_date: e.target.value }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="end-date" className="block text-xs text-gray-500 mb-1">End Date</label>
                <input
                  id="end-date"
                  type="date"
                  value={exportForm.date_range.end_date}
                  onChange={(e) => setExportForm(prev => ({
                    ...prev,
                    date_range: { ...prev.date_range, end_date: e.target.value }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="space-y-4">
            <h3 className="text-md font-medium text-gray-900">Optional Filters</h3>
            
            {/* Store IDs Filter */}
            <div>
              <label htmlFor="store-ids" className="block text-sm font-medium text-gray-700 mb-1">
                Store IDs (comma-separated)
              </label>
              <input
                id="store-ids"
                type="text"
                value={storeIdInput}
                onChange={(e) => setStoreIdInput(e.target.value)}
                placeholder="store-1, store-2, store-3..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">Leave empty to include all stores</p>
            </div>

            {/* Services Filter (for system metrics) */}
            {exportForm.data_type === 'system_metrics' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Services (select specific services or leave empty for all)
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {SERVICE_OPTIONS.map(service => (
                    <label key={service} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={selectedServices.includes(service)}
                        onChange={() => handleServiceToggle(service)}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{service}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Quick Date Presets */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quick Presets
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  const today = new Date().toISOString().split('T')[0]
                  setExportForm(prev => ({
                    ...prev,
                    date_range: { start_date: today, end_date: today }
                  }))
                }}
                className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => {
                  const today = new Date()
                  const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
                  setExportForm(prev => ({
                    ...prev,
                    date_range: {
                      start_date: lastWeek.toISOString().split('T')[0],
                      end_date: today.toISOString().split('T')[0]
                    }
                  }))
                }}
                className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                Last 7 Days
              </button>
              <button
                type="button"
                onClick={() => {
                  const today = new Date()
                  const lastMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
                  setExportForm(prev => ({
                    ...prev,
                    date_range: {
                      start_date: lastMonth.toISOString().split('T')[0],
                      end_date: today.toISOString().split('T')[0]
                    }
                  }))
                }}
                className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                Last 30 Days
              </button>
            </div>
          </div>

          {/* Create Export Button */}
          <div className="flex justify-end">
            <button
              onClick={createExport}
              disabled={creating}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {creating ? 'Creating Export...' : 'Create Export'}
            </button>
          </div>
        </div>
      </div>

      {/* Export Jobs List */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold">Export History</h2>
        </div>

        {exportJobs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No export jobs yet. Create your first export above.
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {exportJobs.map((job) => (
              <div key={job.export_id} className="p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-md font-medium text-gray-900">
                        {DATA_TYPE_OPTIONS.find(opt => opt.value === job.data_type)?.label || job.data_type}
                      </h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                        {job.status.toUpperCase()}
                      </span>
                      <span className="text-sm text-gray-500">
                        {job.format.toUpperCase()}
                      </span>
                    </div>
                    
                    <div className="text-sm text-gray-600 mb-2">
                      {getDataTypeDescription(job.data_type)} • {getFormatDescription(job.format)}
                    </div>

                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      <span>Created: {new Date(job.created_at).toLocaleString()}</span>
                      {job.file_size && <span>Size: {formatFileSize(job.file_size)}</span>}
                      {job.expires_at && (
                        <span>Expires: {new Date(job.expires_at).toLocaleString()}</span>
                      )}
                    </div>

                    {job.error_message && (
                      <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                        Error: {job.error_message}
                      </div>
                    )}
                  </div>

                  {/* Download Button */}
                  <div className="ml-4">
                    {job.status === 'completed' && job.download_url ? (
                      <button
                        onClick={() => downloadExport(job)}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                      >
                        📥 Download
                      </button>
                    ) : job.status === 'processing' ? (
                      <div className="flex items-center text-blue-600">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                        Processing...
                      </div>
                    ) : job.status === 'queued' ? (
                      <span className="text-yellow-600">Queued</span>
                    ) : job.status === 'failed' ? (
                      <span className="text-red-600">Failed</span>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Export Guidelines */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <h3 className="text-sm font-medium text-blue-900 mb-2">Export Guidelines</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• <strong>CSV</strong>: Best for data analysis in spreadsheet applications</li>
          <li>• <strong>PDF</strong>: Formatted reports suitable for presentations and sharing</li>
          <li>• <strong>JSON</strong>: Structured data format for API integration and custom processing</li>
          <li>• Large datasets may take several minutes to process</li>
          <li>• Download links expire after 24 hours for security</li>
          <li>• Maximum export range is 1 year of data</li>
        </ul>
      </div>
    </div>
  )
}