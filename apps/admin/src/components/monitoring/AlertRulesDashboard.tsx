'use client'

import { useState, useEffect } from 'react'

interface AlertRule {
  id: string
  rule_name: string
  metric_type: string
  threshold_value: number
  comparison_operator: '>' | '<' | '>=' | '<=' | '='
  notification_channels: ('email' | 'dashboard' | 'sms')[]
  is_active: boolean
  created_by: string
  created_at: string
}

interface CreateAlertRuleRequest {
  rule_name: string
  metric_type: string
  threshold_value: number
  comparison_operator: '>' | '<' | '>=' | '<=' | '='
  notification_channels: ('email' | 'dashboard' | 'sms')[]
}

const METRIC_TYPE_OPTIONS = [
  { value: 'api_response_time', label: 'API Response Time (ms)' },
  { value: 'cpu_usage', label: 'CPU Usage (%)' },
  { value: 'memory_usage', label: 'Memory Usage (%)' },
  { value: 'error_rate', label: 'Error Rate (%)' },
  { value: 'uptime_percentage', label: 'Uptime (%)' },
  { value: 'request_rate', label: 'Request Rate (req/min)' }
]

const COMPARISON_OPERATORS = [
  { value: '>', label: 'Greater than (>)' },
  { value: '>=', label: 'Greater than or equal (>=)' },
  { value: '<', label: 'Less than (<)' },
  { value: '<=', label: 'Less than or equal (<=)' },
  { value: '=', label: 'Equal to (=)' }
]

const NOTIFICATION_CHANNELS = [
  { value: 'email', label: 'Email' },
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'sms', label: 'SMS' }
]

export default function AlertRulesDashboard() {
  const [rules, setRules] = useState<AlertRule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null)
  const [creating, setCreating] = useState(false)
  const [updating, setUpdating] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState<CreateAlertRuleRequest>({
    rule_name: '',
    metric_type: 'api_response_time',
    threshold_value: 0,
    comparison_operator: '>',
    notification_channels: ['dashboard']
  })

  useEffect(() => {
    fetchAlertRules()
  }, [])

  const fetchAlertRules = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/monitoring/alerts/rules')
      if (response.ok) {
        const data = await response.json()
        setRules(data.rules || [])
        setError('')
      } else {
        setError('Failed to fetch alert rules')
      }
    } catch (err) {
      setError('Network error while fetching alert rules')
      console.error('Alert rules fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  const createAlertRule = async () => {
    try {
      setCreating(true)
      const response = await fetch('/api/monitoring/alerts/rules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        const newRule = await response.json()
        setRules(prev => [...prev, newRule])
        setShowCreateForm(false)
        resetForm()
        setError('')
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to create alert rule')
      }
    } catch (err) {
      setError('Network error while creating alert rule')
      console.error('Create alert rule error:', err)
    } finally {
      setCreating(false)
    }
  }

  const updateAlertRule = async (ruleId: string, updates: Partial<AlertRule>) => {
    try {
      setUpdating(ruleId)
      const response = await fetch(`/api/monitoring/alerts/rules/${ruleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      })

      if (response.ok) {
        setRules(prev => prev.map(rule => 
          rule.id === ruleId ? { ...rule, ...updates } : rule
        ))
        setEditingRule(null)
        setError('')
      } else {
        setError('Failed to update alert rule')
      }
    } catch (err) {
      setError('Network error while updating alert rule')
      console.error('Update alert rule error:', err)
    } finally {
      setUpdating(null)
    }
  }

  const deleteAlertRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this alert rule?')) {
      return
    }

    try {
      setDeleting(ruleId)
      const response = await fetch(`/api/monitoring/alerts/rules/${ruleId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setRules(prev => prev.filter(rule => rule.id !== ruleId))
        setError('')
      } else {
        setError('Failed to delete alert rule')
      }
    } catch (err) {
      setError('Network error while deleting alert rule')
      console.error('Delete alert rule error:', err)
    } finally {
      setDeleting(null)
    }
  }

  const toggleRuleStatus = async (ruleId: string, isActive: boolean) => {
    await updateAlertRule(ruleId, { is_active: isActive })
  }

  const resetForm = () => {
    setFormData({
      rule_name: '',
      metric_type: 'api_response_time',
      threshold_value: 0,
      comparison_operator: '>',
      notification_channels: ['dashboard']
    })
  }

  const startEditing = (rule: AlertRule) => {
    setEditingRule(rule)
    setFormData({
      rule_name: rule.rule_name,
      metric_type: rule.metric_type,
      threshold_value: rule.threshold_value,
      comparison_operator: rule.comparison_operator,
      notification_channels: rule.notification_channels
    })
  }

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingRule) {
      updateAlertRule(editingRule.id, formData)
    } else {
      createAlertRule()
    }
  }

  const handleChannelChange = (channel: 'email' | 'dashboard' | 'sms', checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      notification_channels: checked
        ? [...prev.notification_channels, channel]
        : prev.notification_channels.filter(c => c !== channel)
    }))
  }

  const getMetricTypeLabel = (type: string) => {
    return METRIC_TYPE_OPTIONS.find(option => option.value === type)?.label || type
  }

  const getOperatorLabel = (operator: string) => {
    return COMPARISON_OPERATORS.find(op => op.value === operator)?.label || operator
  }

  const formatThreshold = (value: number, metricType: string) => {
    if (metricType.includes('time')) {
      return `${value}ms`
    } else if (metricType.includes('percentage') || metricType.includes('rate')) {
      return `${value}%`
    }
    return value.toString()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Alert Rules</h1>
          <p className="text-gray-600">Configure alert thresholds and notification preferences</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={fetchAlertRules}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
          >
            🔄 Refresh
          </button>
          <button
            onClick={() => {
              setShowCreateForm(true)
              setEditingRule(null)
              resetForm()
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            + Create Alert Rule
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Create/Edit Form */}
      {(showCreateForm || editingRule) && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-4">
            {editingRule ? 'Edit Alert Rule' : 'Create New Alert Rule'}
          </h2>
          
          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="rule-name" className="block text-sm font-medium text-gray-700 mb-1">
                  Rule Name *
                </label>
                <input
                  id="rule-name"
                  type="text"
                  value={formData.rule_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, rule_name: e.target.value }))}
                  placeholder="High API Response Time"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="metric-type" className="block text-sm font-medium text-gray-700 mb-1">
                  Metric Type *
                </label>
                <select
                  id="metric-type"
                  value={formData.metric_type}
                  onChange={(e) => setFormData(prev => ({ ...prev, metric_type: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {METRIC_TYPE_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="comparison-operator" className="block text-sm font-medium text-gray-700 mb-1">
                  Condition *
                </label>
                <select
                  id="comparison-operator"
                  value={formData.comparison_operator}
                  onChange={(e) => setFormData(prev => ({ ...prev, comparison_operator: e.target.value as any }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {COMPARISON_OPERATORS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="threshold-value" className="block text-sm font-medium text-gray-700 mb-1">
                  Threshold Value *
                </label>
                <input
                  id="threshold-value"
                  type="number"
                  step="0.1"
                  value={formData.threshold_value}
                  onChange={(e) => setFormData(prev => ({ ...prev, threshold_value: parseFloat(e.target.value) || 0 }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notification Channels * (at least one required)
              </label>
              <div className="space-y-2">
                {NOTIFICATION_CHANNELS.map(channel => (
                  <label key={channel.value} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.notification_channels.includes(channel.value as any)}
                      onChange={(e) => handleChannelChange(channel.value as any, e.target.checked)}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">{channel.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false)
                  setEditingRule(null)
                  resetForm()
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating || updating !== null || formData.notification_channels.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {(creating || updating !== null) ? 'Saving...' : editingRule ? 'Update Rule' : 'Create Rule'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Rules List */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold">Configured Alert Rules ({rules.length})</h2>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Loading alert rules...</span>
          </div>
        ) : rules.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No alert rules configured. Create your first alert rule to get started.
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {rules.map((rule) => (
              <div key={rule.id} className="p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-medium text-gray-900">{rule.rule_name}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${rule.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {rule.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    
                    <div className="text-sm text-gray-600 mb-3">
                      <span className="font-medium">{getMetricTypeLabel(rule.metric_type)}</span>
                      {' '}
                      <span>{getOperatorLabel(rule.comparison_operator)}</span>
                      {' '}
                      <span className="font-medium">{formatThreshold(rule.threshold_value, rule.metric_type)}</span>
                    </div>

                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      <div>
                        <span className="font-medium">Notifications:</span>
                        {' '}
                        {rule.notification_channels.map(channel => (
                          <span key={channel} className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded mr-1">
                            {channel}
                          </span>
                        ))}
                      </div>
                      <span>Created: {new Date(rule.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex space-x-2 ml-4">
                    <button
                      onClick={() => toggleRuleStatus(rule.id, !rule.is_active)}
                      disabled={updating === rule.id}
                      className={`px-3 py-1 text-xs rounded ${rule.is_active 
                        ? 'bg-yellow-600 text-white hover:bg-yellow-700' 
                        : 'bg-green-600 text-white hover:bg-green-700'
                      } disabled:opacity-50 transition-colors`}
                    >
                      {rule.is_active ? 'Disable' : 'Enable'}
                    </button>
                    
                    <button
                      onClick={() => startEditing(rule)}
                      disabled={updating === rule.id}
                      className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      Edit
                    </button>
                    
                    <button
                      onClick={() => deleteAlertRule(rule.id)}
                      disabled={deleting === rule.id || updating === rule.id}
                      className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      {deleting === rule.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Templates */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold mb-4">Quick Templates</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => {
              setFormData({
                rule_name: 'High API Response Time',
                metric_type: 'api_response_time',
                threshold_value: 2000,
                comparison_operator: '>',
                notification_channels: ['email', 'dashboard']
              })
              setShowCreateForm(true)
              setEditingRule(null)
            }}
            className="p-3 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="text-sm font-medium text-gray-900">High Response Time</div>
            <div className="text-xs text-gray-500">Alert when API response > 2000ms</div>
          </button>
          
          <button
            onClick={() => {
              setFormData({
                rule_name: 'High Error Rate',
                metric_type: 'error_rate',
                threshold_value: 5,
                comparison_operator: '>',
                notification_channels: ['email', 'dashboard', 'sms']
              })
              setShowCreateForm(true)
              setEditingRule(null)
            }}
            className="p-3 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="text-sm font-medium text-gray-900">High Error Rate</div>
            <div className="text-xs text-gray-500">Alert when error rate > 5%</div>
          </button>
          
          <button
            onClick={() => {
              setFormData({
                rule_name: 'High CPU Usage',
                metric_type: 'cpu_usage',
                threshold_value: 80,
                comparison_operator: '>',
                notification_channels: ['dashboard']
              })
              setShowCreateForm(true)
              setEditingRule(null)
            }}
            className="p-3 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="text-sm font-medium text-gray-900">High CPU Usage</div>
            <div className="text-xs text-gray-500">Alert when CPU usage > 80%</div>
          </button>
        </div>
      </div>
    </div>
  )
}