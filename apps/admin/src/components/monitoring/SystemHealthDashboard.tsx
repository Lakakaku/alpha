'use client'

import { useState, useEffect } from 'react'
import { MetricsChart } from './charts/MetricsChart'

interface SystemMetric {
  id: string
  timestamp: string
  metric_type: 'api_response_time' | 'cpu_usage' | 'memory_usage' | 'error_rate'
  metric_value: number
  service_name: 'backend' | 'customer_app' | 'business_app' | 'admin_app'
  additional_data: Record<string, any>
}

interface MetricsSummary {
  total_data_points: number
  average_value: number
  min_value: number
  max_value: number
  trend_direction: 'up' | 'down' | 'stable'
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  services: {
    database: 'healthy' | 'unhealthy'
    api: 'healthy' | 'unhealthy'
    monitoring: 'healthy' | 'unhealthy'
  }
  metrics: {
    uptime_seconds: number
    response_time_ms: number
    error_rate: number
  }
}

const SERVICE_OPTIONS = [
  { value: '', label: 'All Services' },
  { value: 'backend', label: 'Backend API' },
  { value: 'customer_app', label: 'Customer App' },
  { value: 'business_app', label: 'Business App' },
  { value: 'admin_app', label: 'Admin App' }
]

const METRIC_TYPE_OPTIONS = [
  { value: '', label: 'All Metrics' },
  { value: 'api_response_time', label: 'API Response Time' },
  { value: 'cpu_usage', label: 'CPU Usage' },
  { value: 'memory_usage', label: 'Memory Usage' },
  { value: 'error_rate', label: 'Error Rate' }
]

const GRANULARITY_OPTIONS = [
  { value: 'minute', label: 'Per Minute' },
  { value: 'hour', label: 'Per Hour' },
  { value: 'day', label: 'Per Day' }
]

export default function SystemHealthDashboard() {
  const [metrics, setMetrics] = useState<SystemMetric[]>([])
  const [summary, setSummary] = useState<MetricsSummary | null>(null)
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
  // Filter states
  const [selectedService, setSelectedService] = useState('')
  const [selectedMetricType, setSelectedMetricType] = useState('')
  const [granularity, setGranularity] = useState<'minute' | 'hour' | 'day'>('minute')
  const [timeRange, setTimeRange] = useState({
    start: new Date(Date.now() - 60 * 60 * 1000).toISOString().slice(0, 16), // 1 hour ago
    end: new Date().toISOString().slice(0, 16)
  })

  useEffect(() => {
    fetchSystemHealth()
    fetchMetrics()
    
    // Auto-refresh every minute for real-time data
    const interval = setInterval(() => {
      fetchSystemHealth()
      fetchMetrics()
    }, 60000)
    
    return () => clearInterval(interval)
  }, [selectedService, selectedMetricType, granularity, timeRange])

  const fetchSystemHealth = async () => {
    try {
      const response = await fetch('/api/monitoring/health')
      if (response.ok) {
        const healthData = await response.json()
        setHealth(healthData)
      }
    } catch (err) {
      console.error('Failed to fetch health status:', err)
    }
  }

  const fetchMetrics = async () => {
    try {
      setLoading(true)
      
      const params = new URLSearchParams({
        granularity,
        start_time: timeRange.start,
        end_time: timeRange.end
      })
      
      if (selectedService) params.append('service', selectedService)
      if (selectedMetricType) params.append('metric_type', selectedMetricType)

      const response = await fetch(`/api/monitoring/metrics?${params}`)
      if (response.ok) {
        const data = await response.json()
        setMetrics(data.metrics || [])
        setSummary(data.summary || null)
        setError('')
      } else {
        setError('Failed to fetch metrics data')
      }
    } catch (err) {
      setError('Network error while fetching metrics')
      console.error('Metrics fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-100 text-green-800'
      case 'degraded': return 'bg-yellow-100 text-yellow-800'
      case 'unhealthy': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'up': return '↗️'
      case 'down': return '↘️'
      case 'stable': return '➡️'
      default: return '➡️'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Health Monitoring</h1>
          <p className="text-gray-600">Real-time performance metrics and system status</p>
        </div>
        <button
          onClick={() => {
            fetchSystemHealth()
            fetchMetrics()
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          🔄 Refresh Data
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* System Health Status */}
      {health && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-4">Overall System Health</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getHealthStatusColor(health.status)}`}>
                {health.status.toUpperCase()}
              </div>
              <div className="mt-2 text-sm text-gray-600">Overall Status</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getHealthStatusColor(health.services.database)}`}>
                {health.services.database.toUpperCase()}
              </div>
              <div className="mt-2 text-sm text-gray-600">Database</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getHealthStatusColor(health.services.api)}`}>
                {health.services.api.toUpperCase()}
              </div>
              <div className="mt-2 text-sm text-gray-600">API Services</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getHealthStatusColor(health.services.monitoring)}`}>
                {health.services.monitoring.toUpperCase()}
              </div>
              <div className="mt-2 text-sm text-gray-600">Monitoring</div>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {formatUptime(health.metrics.uptime_seconds)}
              </div>
              <div className="text-sm text-gray-600">System Uptime</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {health.metrics.response_time_ms.toFixed(1)}ms
              </div>
              <div className="text-sm text-gray-600">Avg Response Time</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {(health.metrics.error_rate * 100).toFixed(2)}%
              </div>
              <div className="text-sm text-gray-600">Error Rate</div>
            </div>
          </div>
        </div>
      )}

      {/* Metrics Filters */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold mb-4">Performance Metrics</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
          <div>
            <label htmlFor="service" className="block text-sm font-medium text-gray-700 mb-1">
              Service
            </label>
            <select
              id="service"
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {SERVICE_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="metric-type" className="block text-sm font-medium text-gray-700 mb-1">
              Metric Type
            </label>
            <select
              id="metric-type"
              value={selectedMetricType}
              onChange={(e) => setSelectedMetricType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {METRIC_TYPE_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="granularity" className="block text-sm font-medium text-gray-700 mb-1">
              Granularity
            </label>
            <select
              id="granularity"
              value={granularity}
              onChange={(e) => setGranularity(e.target.value as 'minute' | 'hour' | 'day')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {GRANULARITY_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="start-time" className="block text-sm font-medium text-gray-700 mb-1">
              Start Time
            </label>
            <input
              id="start-time"
              type="datetime-local"
              value={timeRange.start}
              onChange={(e) => setTimeRange(prev => ({ ...prev, start: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="end-time" className="block text-sm font-medium text-gray-700 mb-1">
              End Time
            </label>
            <input
              id="end-time"
              type="datetime-local"
              value={timeRange.end}
              onChange={(e) => setTimeRange(prev => ({ ...prev, end: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Metrics Summary */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-lg font-semibold text-gray-900">{summary.total_data_points}</div>
              <div className="text-sm text-gray-600">Data Points</div>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-lg font-semibold text-blue-600">{summary.average_value.toFixed(2)}</div>
              <div className="text-sm text-gray-600">Average Value</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-lg font-semibold text-green-600">
                {summary.min_value.toFixed(2)} / {summary.max_value.toFixed(2)}
              </div>
              <div className="text-sm text-gray-600">Min / Max</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-lg font-semibold text-purple-600">
                {getTrendIcon(summary.trend_direction)} {summary.trend_direction}
              </div>
              <div className="text-sm text-gray-600">Trend</div>
            </div>
          </div>
        )}

        {/* Metrics Chart */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Loading metrics...</span>
          </div>
        ) : (
          <div className="h-96">
            <MetricsChart 
              data={metrics}
              granularity={granularity}
              height={384}
            />
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => {
              const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString().slice(0, 16)
              const now = new Date().toISOString().slice(0, 16)
              setTimeRange({ start: oneHourAgo, end: now })
              setGranularity('minute')
            }}
            className="p-3 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="text-sm font-medium text-gray-900">Last Hour</div>
            <div className="text-xs text-gray-500">View past 60 minutes</div>
          </button>
          
          <button
            onClick={() => {
              const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
              const now = new Date().toISOString().slice(0, 16)
              setTimeRange({ start: oneDayAgo, end: now })
              setGranularity('hour')
            }}
            className="p-3 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="text-sm font-medium text-gray-900">Last 24 Hours</div>
            <div className="text-xs text-gray-500">View daily trends</div>
          </button>
          
          <button
            onClick={() => {
              const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
              const now = new Date().toISOString().slice(0, 16)
              setTimeRange({ start: oneWeekAgo, end: now })
              setGranularity('day')
            }}
            className="p-3 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="text-sm font-medium text-gray-900">Last Week</div>
            <div className="text-xs text-gray-500">View weekly patterns</div>
          </button>
        </div>
      </div>
    </div>
  )
}