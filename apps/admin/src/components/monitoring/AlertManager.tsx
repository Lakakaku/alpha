'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@vocilia/ui';
import { Badge } from '@vocilia/ui';
import { Button } from '@vocilia/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@vocilia/ui';
import { Input } from '@vocilia/ui';
import { Textarea } from '@vocilia/ui';
import { Bell, AlertTriangle, CheckCircle, XCircle, Clock, RefreshCw, Settings } from 'lucide-react';

interface Alert {
  alert_id: string;
  alert_type: 'uptime' | 'performance' | 'error_rate' | 'backup_failure' | 'ssl_expiry' | 'deployment_failure';
  severity: 'info' | 'warning' | 'critical';
  status: 'active' | 'acknowledged' | 'resolved' | 'silenced';
  title: string;
  description: string;
  source_service: string;
  triggered_at: string;
  acknowledged_at?: string;
  resolved_at?: string;
  acknowledged_by?: string;
  resolved_by?: string;
  alert_data: Record<string, any>;
}

interface AlertRule {
  rule_id: string;
  name: string;
  alert_type: string;
  severity: 'info' | 'warning' | 'critical';
  condition: string;
  threshold_value: number;
  enabled: boolean;
  notification_channels: string[];
  cooldown_minutes: number;
  created_at: string;
  updated_at: string;
}

export default function AlertManager() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'alerts' | 'rules'>('alerts');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');

  // New alert rule form state
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [newRule, setNewRule] = useState({
    name: '',
    alert_type: '',
    severity: 'warning' as const,
    condition: '',
    threshold_value: 0,
    notification_channels: [] as string[],
    cooldown_minutes: 15,
  });

  const fetchAlertData = async () => {
    try {
      setRefreshing(true);
      const [alertsResponse, rulesResponse] = await Promise.all([
        fetch('/api/admin/monitoring/alerts', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
          },
        }),
        fetch('/api/admin/monitoring/alert-rules', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
          },
        })
      ]);

      if (!alertsResponse.ok || !rulesResponse.ok) {
        throw new Error('Failed to fetch alert data');
      }

      const alertsData = await alertsResponse.json();
      const rulesData = await rulesResponse.json();
      
      setAlerts(alertsData.alerts || []);
      setAlertRules(rulesData.rules || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAlertData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchAlertData, 30000);
    return () => clearInterval(interval);
  }, []);

  const getSeverityIcon = (severity: Alert['severity']) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'info':
        return <Bell className="w-4 h-4 text-blue-500" />;
      default:
        return <Bell className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusIcon = (status: Alert['status']) => {
    switch (status) {
      case 'resolved':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'acknowledged':
        return <Clock className="w-4 h-4 text-blue-500" />;
      case 'silenced':
        return <XCircle className="w-4 h-4 text-gray-500" />;
      case 'active':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default:
        return <Bell className="w-4 h-4 text-gray-500" />;
    }
  };

  const getSeverityColor = (severity: Alert['severity']) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      case 'info':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: Alert['status']) => {
    switch (status) {
      case 'resolved':
        return 'bg-green-100 text-green-800';
      case 'acknowledged':
        return 'bg-blue-100 text-blue-800';
      case 'silenced':
        return 'bg-gray-100 text-gray-800';
      case 'active':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const acknowledgeAlert = async (alertId: string) => {
    try {
      const response = await fetch(`/api/admin/monitoring/alerts/${alertId}/acknowledge`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to acknowledge alert');
      }

      fetchAlertData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to acknowledge alert');
    }
  };

  const resolveAlert = async (alertId: string) => {
    try {
      const response = await fetch(`/api/admin/monitoring/alerts/${alertId}/resolve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to resolve alert');
      }

      fetchAlertData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to resolve alert');
    }
  };

  const silenceAlert = async (alertId: string, duration: number) => {
    try {
      const response = await fetch(`/api/admin/monitoring/alerts/${alertId}/silence`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
        },
        body: JSON.stringify({ duration_minutes: duration }),
      });

      if (!response.ok) {
        throw new Error('Failed to silence alert');
      }

      fetchAlertData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to silence alert');
    }
  };

  const toggleAlertRule = async (ruleId: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/admin/monitoring/alert-rules/${ruleId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
        },
        body: JSON.stringify({ enabled }),
      });

      if (!response.ok) {
        throw new Error('Failed to update alert rule');
      }

      fetchAlertData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update alert rule');
    }
  };

  const createAlertRule = async () => {
    if (!newRule.name || !newRule.alert_type || !newRule.condition) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const response = await fetch('/api/admin/monitoring/alert-rules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
        },
        body: JSON.stringify(newRule),
      });

      if (!response.ok) {
        throw new Error('Failed to create alert rule');
      }

      // Reset form
      setNewRule({
        name: '',
        alert_type: '',
        severity: 'warning',
        condition: '',
        threshold_value: 0,
        notification_channels: [],
        cooldown_minutes: 15,
      });
      setShowRuleForm(false);
      fetchAlertData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create alert rule');
    }
  };

  // Filter alerts
  const filteredAlerts = alerts.filter(alert => {
    if (statusFilter !== 'all' && alert.status !== statusFilter) return false;
    if (severityFilter !== 'all' && alert.severity !== severityFilter) return false;
    return true;
  });

  // Count alerts by status
  const alertCounts = {
    active: alerts.filter(a => a.status === 'active').length,
    acknowledged: alerts.filter(a => a.status === 'acknowledged').length,
    resolved: alerts.filter(a => a.status === 'resolved').length,
    total: alerts.length,
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Alert Manager</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Alert Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Alerts</p>
                <p className="text-2xl font-bold text-red-600">{alertCounts.active}</p>
              </div>
              <AlertTriangle className="w-5 h-5 text-gray-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Acknowledged</p>
                <p className="text-2xl font-bold text-blue-600">{alertCounts.acknowledged}</p>
              </div>
              <Clock className="w-5 h-5 text-gray-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Resolved</p>
                <p className="text-2xl font-bold text-green-600">{alertCounts.resolved}</p>
              </div>
              <CheckCircle className="w-5 h-5 text-gray-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total</p>
                <p className="text-2xl font-bold text-gray-600">{alertCounts.total}</p>
              </div>
              <Bell className="w-5 h-5 text-gray-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tab Navigation */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex space-x-4">
            <button
              onClick={() => setActiveTab('alerts')}
              className={`px-3 py-2 rounded-md text-sm font-medium ${
                activeTab === 'alerts' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Alerts ({alerts.length})
            </button>
            <button
              onClick={() => setActiveTab('rules')}
              className={`px-3 py-2 rounded-md text-sm font-medium ${
                activeTab === 'rules' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Alert Rules ({alertRules.length})
            </button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAlertData}
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </CardHeader>
      </Card>

      {error && (
        <Card>
          <CardContent className="pt-6">
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <XCircle className="w-5 h-5 text-red-400 mr-2" />
                <p className="text-red-800">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alerts Tab */}
      {activeTab === 'alerts' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Current Alerts</CardTitle>
            <div className="flex items-center space-x-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="acknowledged">Acknowledged</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="silenced">Silenced</SelectItem>
                </SelectContent>
              </Select>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severity</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredAlerts.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No alerts found</p>
              ) : (
                filteredAlerts.map((alert) => (
                  <div
                    key={alert.alert_id}
                    className="border rounded-lg p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {getSeverityIcon(alert.severity)}
                        <div>
                          <h4 className="font-medium">{alert.title}</h4>
                          <p className="text-sm text-gray-500">{alert.source_service}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className={getSeverityColor(alert.severity)}>
                          {alert.severity}
                        </Badge>
                        <Badge className={getStatusColor(alert.status)}>
                          {alert.status}
                        </Badge>
                      </div>
                    </div>

                    <p className="text-sm text-gray-700">{alert.description}</p>

                    <div className="text-xs text-gray-500">
                      Triggered: {new Date(alert.triggered_at).toLocaleString()}
                      {alert.acknowledged_at && (
                        <> • Acknowledged: {new Date(alert.acknowledged_at).toLocaleString()}</>
                      )}
                      {alert.resolved_at && (
                        <> • Resolved: {new Date(alert.resolved_at).toLocaleString()}</>
                      )}
                    </div>

                    {alert.status === 'active' && (
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => acknowledgeAlert(alert.alert_id)}
                        >
                          Acknowledge
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => resolveAlert(alert.alert_id)}
                        >
                          Resolve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => silenceAlert(alert.alert_id, 60)}
                        >
                          Silence 1h
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alert Rules Tab */}
      {activeTab === 'rules' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Alert Rules</CardTitle>
            <Button
              onClick={() => setShowRuleForm(!showRuleForm)}
            >
              <Settings className="w-4 h-4 mr-2" />
              {showRuleForm ? 'Cancel' : 'New Rule'}
            </Button>
          </CardHeader>
          <CardContent>
            {showRuleForm && (
              <div className="mb-6 p-4 border rounded-lg space-y-4">
                <h3 className="font-medium">Create Alert Rule</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    placeholder="Rule name"
                    value={newRule.name}
                    onChange={(e) => setNewRule({...newRule, name: e.target.value})}
                  />
                  <Select value={newRule.alert_type} onValueChange={(value) => setNewRule({...newRule, alert_type: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Alert type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="uptime">Uptime</SelectItem>
                      <SelectItem value="performance">Performance</SelectItem>
                      <SelectItem value="error_rate">Error Rate</SelectItem>
                      <SelectItem value="backup_failure">Backup Failure</SelectItem>
                      <SelectItem value="ssl_expiry">SSL Expiry</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Textarea
                  placeholder="Condition (e.g., response_time > 2000)"
                  value={newRule.condition}
                  onChange={(e) => setNewRule({...newRule, condition: e.target.value})}
                />
                <div className="flex space-x-2">
                  <Button onClick={createAlertRule}>Create Rule</Button>
                  <Button variant="outline" onClick={() => setShowRuleForm(false)}>Cancel</Button>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {alertRules.map((rule) => (
                <div
                  key={rule.rule_id}
                  className="border rounded-lg p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">{rule.name}</h4>
                    <div className="flex items-center space-x-2">
                      <Badge className={getSeverityColor(rule.severity)}>
                        {rule.severity}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleAlertRule(rule.rule_id, !rule.enabled)}
                      >
                        {rule.enabled ? 'Disable' : 'Enable'}
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700">{rule.condition}</p>
                  <p className="text-xs text-gray-500">
                    Threshold: {rule.threshold_value} • Cooldown: {rule.cooldown_minutes}min
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}