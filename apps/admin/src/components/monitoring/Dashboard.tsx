'use client'

import { useState, useEffect } from 'react'

interface SystemHealth {
  database_status: 'healthy' | 'degraded' | 'down'
  api_status: 'healthy' | 'degraded' | 'down'
  storage_status: 'healthy' | 'degraded' | 'down'
  overall_status: 'healthy' | 'degraded' | 'down'
  last_check: string
}

interface SystemStats {
  total_stores: number
  active_stores: number
  total_qr_codes: number
  active_qr_codes: number
  total_verifications: number
  recent_verifications: number
  avg_response_time: number
  uptime_percentage: number
}

interface SecurityAlert {
  id: string
  type: 'login_failure' | 'multiple_sessions' | 'suspicious_activity' | 'system_error'
  message: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  timestamp: string
  resolved: boolean
}

interface RecentActivity {
  id: string
  admin_username: string
  action_type: string
  resource_type: string
  resource_id?: string
  details: string
  timestamp: string
}

export default function MonitoringDashboard() {
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [stats, setStats] = useState<SystemStats | null>(null)
  const [alerts, setAlerts] = useState<SecurityAlert[]>([])
  const [activities, setActivities] = useState<RecentActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetchDashboardData()
    const interval = setInterval(fetchDashboardData, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [])

  const fetchDashboardData = async () => {
    try {
      if (!loading) setRefreshing(true)
      
      const [healthResponse, statsResponse, alertsResponse, activitiesResponse] = await Promise.all([
        fetch('/api/admin/monitoring/health'),
        fetch('/api/admin/monitoring/stats'),
        fetch('/api/admin/monitoring/security-alerts?limit=10'),
        fetch('/api/admin/monitoring/audit-logs?limit=20')
      ])

      if (healthResponse.ok) {
        setHealth(await healthResponse.json())
      }
      if (statsResponse.ok) {
        setStats(await statsResponse.json())
      }
      if (alertsResponse.ok) {
        setAlerts(await alertsResponse.json())
      }
      if (activitiesResponse.ok) {
        setActivities(await activitiesResponse.json())
      }
    } catch (err) {
      setError('Failed to load dashboard data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const resolveAlert = async (alertId: string) => {
    try {
      const response = await fetch(`/api/admin/monitoring/security-alerts/${alertId}/resolve`, {
        method: 'PATCH'
      })
      if (response.ok) {
        setAlerts(prev => prev.map(alert => 
          alert.id === alertId ? { ...alert, resolved: true } : alert
        ))
      }
    } catch (err) {
      console.error('Failed to resolve alert:', err)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-100'
      case 'degraded': return 'text-yellow-600 bg-yellow-100'
      case 'down': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'text-blue-600 bg-blue-100'
      case 'medium': return 'text-yellow-600 bg-yellow-100'
      case 'high': return 'text-orange-600 bg-orange-100'
      case 'critical': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading monitoring dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">System Monitoring</h1>
            <p className="text-gray-600">Real-time system health and performance metrics</p>
          </div>
          <button
            onClick={fetchDashboardData}
            disabled={refreshing}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {refreshing ? 'Refreshing...' : '🔄 Refresh'}
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* System Health */}
        {health && (
          <div className="mb-8 bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">System Health Status</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center p-4 border rounded-lg">
                <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(health.overall_status)}`}>
                  {health.overall_status}
                </div>
                <div className="mt-2 text-sm text-gray-600">Overall</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(health.database_status)}`}>
                  {health.database_status}
                </div>
                <div className="mt-2 text-sm text-gray-600">Database</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(health.api_status)}`}>
                  {health.api_status}
                </div>
                <div className="mt-2 text-sm text-gray-600">API</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(health.storage_status)}`}>
                  {health.storage_status}
                </div>
                <div className="mt-2 text-sm text-gray-600">Storage</div>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-4">Last checked: {new Date(health.last_check).toLocaleString()}</p>
          </div>
        )}

        {/* System Statistics */}
        {stats && (
          <div className="mb-8 bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">System Statistics</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{stats.total_stores}</div>
                <div className="text-sm text-gray-600">Total Stores</div>
                <div className="text-xs text-green-600">{stats.active_stores} active</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{stats.total_qr_codes}</div>
                <div className="text-sm text-gray-600">QR Codes</div>
                <div className="text-xs text-green-600">{stats.active_qr_codes} active</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">{stats.total_verifications}</div>
                <div className="text-sm text-gray-600">Total Verifications</div>
                <div className="text-xs text-purple-600">{stats.recent_verifications} today</div>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{stats.avg_response_time}ms</div>
                <div className="text-sm text-gray-600">Avg Response</div>
                <div className="text-xs text-green-600">{stats.uptime_percentage}% uptime</div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Security Alerts */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Security Alerts</h2>
              <span className="text-sm text-gray-500">{alerts.filter(a => !a.resolved).length} unresolved</span>
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {alerts.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No recent alerts</p>
              ) : (
                alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-3 border rounded-lg ${alert.resolved ? 'bg-gray-50 opacity-60' : 'bg-white'}`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center mb-1">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(alert.severity)}`}>
                            {alert.severity}
                          </span>
                          {alert.resolved && (
                            <span className="ml-2 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-600">
                              Resolved
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-900 mb-1">{alert.message}</p>
                        <p className="text-xs text-gray-500">{new Date(alert.timestamp).toLocaleString()}</p>
                      </div>
                      {!alert.resolved && (
                        <button
                          onClick={() => resolveAlert(alert.id)}
                          className="ml-2 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Recent Admin Activity</h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {activities.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No recent activity</p>
              ) : (
                activities.map((activity) => (
                  <div key={activity.id} className="p-3 border border-gray-200 rounded-lg">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="text-sm text-gray-900 mb-1">
                          <span className="font-medium">{activity.admin_username}</span> {activity.details}
                        </p>
                        <div className="flex items-center text-xs text-gray-500">
                          <span className="px-2 py-1 bg-gray-100 rounded mr-2">{activity.action_type}</span>
                          <span>{activity.resource_type}</span>
                          {activity.resource_id && <span className="ml-1">#{activity.resource_id}</span>}
                        </div>
                      </div>
                      <span className="text-xs text-gray-500 ml-2">
                        {new Date(activity.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button className="p-3 text-left border border-gray-200 rounded-lg hover:bg-gray-50">
              <div className="text-sm font-medium text-gray-900">Clean Old Sessions</div>
              <div className="text-xs text-gray-500">Remove expired sessions</div>
            </button>
            <button className="p-3 text-left border border-gray-200 rounded-lg hover:bg-gray-50">
              <div className="text-sm font-medium text-gray-900">Export Audit Logs</div>
              <div className="text-xs text-gray-500">Download activity logs</div>
            </button>
            <button className="p-3 text-left border border-gray-200 rounded-lg hover:bg-gray-50">
              <div className="text-sm font-medium text-gray-900">System Health Check</div>
              <div className="text-xs text-gray-500">Run full diagnostics</div>
            </button>
            <button className="p-3 text-left border border-gray-200 rounded-lg hover:bg-gray-50">
              <div className="text-sm font-medium text-gray-900">Clear Cache</div>
              <div className="text-xs text-gray-500">Reset system cache</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}