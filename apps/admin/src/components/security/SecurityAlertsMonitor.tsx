'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  AlertTriangle, 
  Shield, 
  Bell, 
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Search,
  Filter,
  RefreshCw,
  Play,
  Pause,
  Volume2,
  VolumeX
} from 'lucide-react';

// Types for security alerts
interface SecurityAlert {
  id: string;
  alert_type: 'fraud_detection' | 'intrusion_attempt' | 'data_breach' | 'authentication_failure' | 'rate_limit_exceeded' | 'policy_violation' | 'system_anomaly';
  severity_level: number;
  title: string;
  description: string;
  source_component: string;
  affected_resources: string[];
  detection_timestamp: string;
  acknowledgment_status: 'pending' | 'acknowledged' | 'resolved' | 'dismissed';
  assigned_admin: string | null;
  escalation_level: number;
  auto_resolved: boolean;
  resolution_notes: string | null;
  metadata: {
    source_ip?: string;
    user_id?: string;
    correlation_id?: string;
    threshold_breached?: number;
    anomaly_score?: number;
    related_events?: string[];
  };
}

interface AlertStats {
  total_alerts: number;
  pending_alerts: number;
  acknowledged_alerts: number;
  resolved_alerts: number;
  critical_alerts: number;
  alert_type_distribution: Record<string, number>;
  severity_distribution: Record<string, number>;
  recent_trends: {
    alerts_last_hour: number;
    trend_direction: 'up' | 'down' | 'stable';
    avg_resolution_time: number;
    escalated_alerts: number;
  };
}

interface AlertFilters {
  alertType: string;
  severityLevel: string;
  acknowledgmentStatus: string;
  dateRange: string;
  assignedAdmin: string;
  search: string;
}

const SecurityAlertsMonitor: React.FC = () => {
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [stats, setStats] = useState<AlertStats | null>(null);
  const [filters, setFilters] = useState<AlertFilters>({
    alertType: 'all',
    severityLevel: 'all',
    acknowledgmentStatus: 'pending',
    dateRange: '24h',
    assignedAdmin: 'all',
    search: ''
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<SecurityAlert | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Fetch security alerts and statistics
  const fetchAlertsData = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filters.alertType !== 'all') params.set('alert_type', filters.alertType);
      if (filters.severityLevel !== 'all') params.set('severity_level', filters.severityLevel);
      if (filters.acknowledgmentStatus !== 'all') params.set('acknowledgment_status', filters.acknowledgmentStatus);
      if (filters.dateRange !== 'all') params.set('period', filters.dateRange);
      if (filters.assignedAdmin !== 'all') params.set('assigned_admin', filters.assignedAdmin);
      if (filters.search) params.set('search', filters.search);

      // Fetch security alerts
      const alertsResponse = await fetch(`/api/security/monitoring/alerts?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!alertsResponse.ok) {
        throw new Error(`Failed to fetch security alerts: ${alertsResponse.status}`);
      }

      const alertsData = await alertsResponse.json();

      // Fetch alert statistics
      const statsResponse = await fetch(`/api/security/monitoring/alerts/stats?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!statsResponse.ok) {
        throw new Error(`Failed to fetch alert statistics: ${statsResponse.status}`);
      }

      const statsData = await statsResponse.json();

      // Check for new critical alerts (for sound notification)
      const newCriticalAlerts = alertsData.data?.filter((alert: SecurityAlert) => 
        alert.severity_level >= 8 && alert.acknowledgment_status === 'pending' &&
        new Date(alert.detection_timestamp).getTime() > Date.now() - 30000 // Last 30 seconds
      ) || [];

      if (newCriticalAlerts.length > 0 && soundEnabled) {
        // Play sound notification for critical alerts
        const audio = new Audio('/sounds/alert-critical.mp3');
        audio.play().catch(() => {
          // Fallback to system notification sound
          console.log('🚨 Critical security alert detected!');
        });
      }

      setAlerts(alertsData.data || []);
      setStats(statsData);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch alerts data');
      console.error('Error fetching alerts data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlertsData();
  }, [filters]);

  // Auto-refresh functionality
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(fetchAlertsData, 15000); // Refresh every 15 seconds
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, filters, soundEnabled]);

  // Get alert type info
  const getAlertTypeInfo = (type: string) => {
    switch (type) {
      case 'fraud_detection':
        return { label: 'Fraud Detection', icon: '🚨', color: 'destructive' };
      case 'intrusion_attempt':
        return { label: 'Intrusion Attempt', icon: '🔥', color: 'destructive' };
      case 'data_breach':
        return { label: 'Data Breach', icon: '💥', color: 'destructive' };
      case 'authentication_failure':
        return { label: 'Auth Failure', icon: '🔐', color: 'warning' };
      case 'rate_limit_exceeded':
        return { label: 'Rate Limit', icon: '⚡', color: 'secondary' };
      case 'policy_violation':
        return { label: 'Policy Violation', icon: '📋', color: 'warning' };
      case 'system_anomaly':
        return { label: 'System Anomaly', icon: '⚠️', color: 'secondary' };
      default:
        return { label: 'Unknown', icon: '❓', color: 'outline' };
    }
  };

  // Get severity info
  const getSeverityInfo = (level: number) => {
    if (level >= 8) return { label: 'Critical', color: 'destructive', textColor: 'text-red-600', bgColor: 'bg-red-50' };
    if (level >= 6) return { label: 'High', color: 'destructive', textColor: 'text-orange-600', bgColor: 'bg-orange-50' };
    if (level >= 4) return { label: 'Medium', color: 'secondary', textColor: 'text-yellow-600', bgColor: 'bg-yellow-50' };
    return { label: 'Low', color: 'outline', textColor: 'text-blue-600', bgColor: 'bg-blue-50' };
  };

  // Get status info
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pending':
        return { label: 'Pending', icon: <Clock className="w-4 h-4" />, color: 'secondary' };
      case 'acknowledged':
        return { label: 'Acknowledged', icon: <CheckCircle className="w-4 h-4" />, color: 'default' };
      case 'resolved':
        return { label: 'Resolved', icon: <CheckCircle className="w-4 h-4" />, color: 'default' };
      case 'dismissed':
        return { label: 'Dismissed', icon: <XCircle className="w-4 h-4" />, color: 'outline' };
      default:
        return { label: 'Unknown', icon: <Clock className="w-4 h-4" />, color: 'outline' };
    }
  };

  // Update alert status
  const updateAlertStatus = async (alertId: string, newStatus: string, notes?: string) => {
    try {
      const response = await fetch(`/api/security/monitoring/alerts/${alertId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          acknowledgment_status: newStatus,
          assigned_admin: newStatus === 'acknowledged' ? 'current_admin' : undefined,
          resolution_notes: notes || undefined
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to update alert: ${response.status}`);
      }

      await fetchAlertsData();
      setSelectedAlert(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update alert');
    }
  };

  // Bulk acknowledge alerts
  const bulkAcknowledgeAlerts = async () => {
    try {
      const pendingAlertIds = alerts
        .filter(alert => alert.acknowledgment_status === 'pending')
        .map(alert => alert.id);

      if (pendingAlertIds.length === 0) return;

      const response = await fetch('/api/security/monitoring/alerts/bulk-acknowledge', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          alert_ids: pendingAlertIds,
          assigned_admin: 'current_admin'
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to bulk acknowledge alerts: ${response.status}`);
      }

      await fetchAlertsData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to bulk acknowledge alerts');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center p-8">
          <RefreshCw className="w-8 h-8 animate-spin" />
          <span className="ml-2">Loading security alerts...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          {error}
          <Button variant="outline" size="sm" className="ml-2" onClick={fetchAlertsData}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Security Alerts Monitor</h2>
          <p className="text-muted-foreground">
            Real-time monitoring and management of security alerts
          </p>
        </div>
        <div className="flex space-x-2">
          <Button
            variant={soundEnabled ? "default" : "outline"}
            onClick={() => setSoundEnabled(!soundEnabled)}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 mr-2" /> : <VolumeX className="w-4 h-4 mr-2" />}
            Sound
          </Button>
          <Button
            variant={autoRefresh ? "default" : "outline"}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
            {autoRefresh ? 'Auto' : 'Manual'}
          </Button>
          <Button variant="outline" onClick={fetchAlertsData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={bulkAcknowledgeAlerts}>
            <CheckCircle className="w-4 h-4 mr-2" />
            Acknowledge All
          </Button>
        </div>
      </div>

      {/* Critical Alerts Banner */}
      {stats && stats.critical_alerts > 0 && (
        <Alert variant="destructive" className="border-red-500 bg-red-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <span className="font-semibold">🚨 {stats.critical_alerts} Critical Security Alerts Require Immediate Attention!</span>
          </AlertDescription>
        </Alert>
      )}

      {/* Statistics Overview */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Alerts</CardTitle>
              <Bell className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_alerts.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                Last hour: {stats.recent_trends.alerts_last_hour}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.pending_alerts}</div>
              <p className="text-xs text-muted-foreground">
                Critical: {stats.critical_alerts}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Resolved</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.resolved_alerts}</div>
              <p className="text-xs text-muted-foreground">
                Avg resolution: {stats.recent_trends.avg_resolution_time}m
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Escalated</CardTitle>
              <TrendingUp className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {stats.recent_trends.escalated_alerts}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.recent_trends.trend_direction === 'up' ? '↗' : 
                 stats.recent_trends.trend_direction === 'down' ? '↘' : '→'} 
                {' '}Trend
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Alert Type Distribution */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle>Alert Type Distribution</CardTitle>
            <CardDescription>Breakdown of security alerts by type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(stats.alert_type_distribution).map(([type, count]) => {
                const typeInfo = getAlertTypeInfo(type);
                return (
                  <div key={type} className="text-center">
                    <div className="flex items-center justify-center mb-2">
                      <span className="text-lg mr-2">{typeInfo.icon}</span>
                      <span className="font-medium">{typeInfo.label}</span>
                    </div>
                    <div className="text-2xl font-bold">{count}</div>
                    <div className="text-sm text-muted-foreground">
                      {((count / stats.total_alerts) * 100).toFixed(1)}%
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <Filter className="w-5 h-5 mr-2" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="text-sm font-medium">Alert Type</label>
              <Select 
                value={filters.alertType} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, alertType: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="fraud_detection">Fraud Detection</SelectItem>
                  <SelectItem value="intrusion_attempt">Intrusion Attempt</SelectItem>
                  <SelectItem value="data_breach">Data Breach</SelectItem>
                  <SelectItem value="authentication_failure">Authentication Failure</SelectItem>
                  <SelectItem value="rate_limit_exceeded">Rate Limit Exceeded</SelectItem>
                  <SelectItem value="policy_violation">Policy Violation</SelectItem>
                  <SelectItem value="system_anomaly">System Anomaly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Severity Level</label>
              <Select 
                value={filters.severityLevel} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, severityLevel: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All levels</SelectItem>
                  <SelectItem value="critical">Critical (8-10)</SelectItem>
                  <SelectItem value="high">High (6-7)</SelectItem>
                  <SelectItem value="medium">Medium (4-5)</SelectItem>
                  <SelectItem value="low">Low (1-3)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Status</label>
              <Select 
                value={filters.acknowledgmentStatus} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, acknowledgmentStatus: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="acknowledged">Acknowledged</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="dismissed">Dismissed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium">Date Range</label>
              <Select 
                value={filters.dateRange} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, dateRange: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">Last hour</SelectItem>
                  <SelectItem value="24h">Last 24 hours</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Assigned Admin</label>
              <Select 
                value={filters.assignedAdmin} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, assignedAdmin: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All admins</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  <SelectItem value="current_admin">Me</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search alerts..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-8"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Alerts List */}
      <Card>
        <CardHeader>
          <CardTitle>Security Alerts</CardTitle>
          <CardDescription>
            Real-time security alerts requiring attention and response
          </CardDescription>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <div className="text-center py-8">
              <Shield className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No security alerts found with current filters</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => {
                const alertInfo = getAlertTypeInfo(alert.alert_type);
                const severityInfo = getSeverityInfo(alert.severity_level);
                const statusInfo = getStatusInfo(alert.acknowledgment_status);
                return (
                  <div
                    key={alert.id}
                    className={`border rounded-lg p-4 hover:bg-muted/50 cursor-pointer ${
                      alert.severity_level >= 8 ? 'border-red-500 ' + severityInfo.bgColor : ''
                    }`}
                    onClick={() => setSelectedAlert(alert)}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center space-x-2">
                        <Badge variant={alertInfo.color as any}>
                          {alertInfo.icon} {alertInfo.label}
                        </Badge>
                        <Badge variant={severityInfo.color as any}>
                          {severityInfo.label} {alert.severity_level}
                        </Badge>
                        <Badge variant={statusInfo.color as any} className="flex items-center">
                          {statusInfo.icon}
                          <span className="ml-1">{statusInfo.label}</span>
                        </Badge>
                        {alert.auto_resolved && (
                          <Badge variant="outline">Auto-Resolved</Badge>
                        )}
                        {alert.escalation_level > 0 && (
                          <Badge variant="destructive">Escalated L{alert.escalation_level}</Badge>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {new Date(alert.detection_timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <div className="mb-3">
                      <h4 className="font-semibold text-lg mb-1">{alert.title}</h4>
                      <p className="text-sm text-muted-foreground">{alert.description}</p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Source:</span>
                        <span className="ml-2 font-medium">{alert.source_component}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Affected:</span>
                        <span className="ml-2 font-medium">
                          {alert.affected_resources.length} resource{alert.affected_resources.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Assigned:</span>
                        <span className="ml-2 font-medium">
                          {alert.assigned_admin || 'Unassigned'}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Source IP:</span>
                        <span className="ml-2 font-medium">
                          {alert.metadata.source_ip || 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alert Details Modal/Panel */}
      {selectedAlert && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Security Alert Details
              <Button variant="outline" size="sm" onClick={() => setSelectedAlert(null)}>
                Close
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="details">
              <TabsList>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="metadata">Metadata</TabsTrigger>
                <TabsTrigger value="actions">Actions</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-2">Alert Information</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Alert Type</span>
                        <Badge variant={getAlertTypeInfo(selectedAlert.alert_type).color as any}>
                          {getAlertTypeInfo(selectedAlert.alert_type).label}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Severity</span>
                        <Badge variant={getSeverityInfo(selectedAlert.severity_level).color as any}>
                          {getSeverityInfo(selectedAlert.severity_level).label} ({selectedAlert.severity_level}/10)
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Status</span>
                        <Badge variant={getStatusInfo(selectedAlert.acknowledgment_status).color as any}>
                          {getStatusInfo(selectedAlert.acknowledgment_status).label}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Escalation Level</span>
                        <span className="font-medium">{selectedAlert.escalation_level}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Response Information</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Source Component</span>
                        <span className="font-medium">{selectedAlert.source_component}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Assigned Admin</span>
                        <span className="font-medium">{selectedAlert.assigned_admin || 'Unassigned'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Auto-Resolved</span>
                        <span className="font-medium">{selectedAlert.auto_resolved ? 'Yes' : 'No'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Detection Time</span>
                        <span className="font-medium text-xs">
                          {new Date(selectedAlert.detection_timestamp).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Description</h4>
                  <p className="text-sm bg-muted p-3 rounded-lg">{selectedAlert.description}</p>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Affected Resources</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedAlert.affected_resources.map((resource, index) => (
                      <Badge key={index} variant="outline">{resource}</Badge>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="metadata" className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Alert Metadata</h4>
                  <div className="bg-muted p-4 rounded-lg">
                    <pre className="text-sm whitespace-pre-wrap">
                      {JSON.stringify(selectedAlert.metadata, null, 2)}
                    </pre>
                  </div>
                </div>

                {selectedAlert.resolution_notes && (
                  <div>
                    <h4 className="font-semibold mb-2">Resolution Notes</h4>
                    <div className="bg-muted p-4 rounded-lg">
                      <p className="text-sm">{selectedAlert.resolution_notes}</p>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="actions" className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-4">Update Alert Status</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <Button
                      variant="outline"
                      onClick={() => updateAlertStatus(selectedAlert.id, 'acknowledged')}
                      disabled={selectedAlert.acknowledgment_status === 'acknowledged'}
                    >
                      Acknowledge
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => updateAlertStatus(selectedAlert.id, 'resolved', 'Alert resolved by admin investigation')}
                      disabled={selectedAlert.acknowledgment_status === 'resolved'}
                    >
                      Mark Resolved
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => updateAlertStatus(selectedAlert.id, 'dismissed', 'Alert dismissed as false positive')}
                      disabled={selectedAlert.acknowledgment_status === 'dismissed'}
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SecurityAlertsMonitor;