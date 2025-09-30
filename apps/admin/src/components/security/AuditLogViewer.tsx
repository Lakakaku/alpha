'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@vocilia/ui';
import { Button } from '@vocilia/ui';
import { Badge } from '@vocilia/ui';
import { Alert, AlertDescription } from '@vocilia/ui';
import { Input } from '@vocilia/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@vocilia/ui';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@vocilia/ui';
import { 
  AlertTriangle, 
  Shield, 
  User, 
  Database, 
  Settings, 
  Search,
  Filter,
  Download,
  RefreshCw,
  Eye,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';

// Types for audit log data
interface AuditLog {
  id: string;
  event_type: 'authentication' | 'authorization' | 'data_access' | 'data_modification' | 'admin_action' | 'security_violation' | 'system_event' | 'fraud_detection';
  user_id: string | null;
  user_type: 'customer' | 'business' | 'admin' | 'system' | null;
  action_performed: string;
  resource_type: string | null;
  resource_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  correlation_id: string;
  event_metadata: any;
  result_status: 'success' | 'failure' | 'blocked' | 'warning';
  created_at: string;
}

interface AuditLogStats {
  total_events: number;
  events_today: number;
  success_rate: number;
  failed_events: number;
  blocked_events: number;
  event_type_distribution: Record<string, number>;
  recent_trends: {
    security_violations: number;
    failed_authentications: number;
    trend_direction: 'up' | 'down' | 'stable';
  };
}

interface AuditLogFilters {
  eventType: string;
  userType: string;
  resultStatus: string;
  dateRange: string;
  search: string;
  userId: string;
  ipAddress: string;
}

const AuditLogViewer: React.FC = () => {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditLogStats | null>(null);
  const [filters, setFilters] = useState<AuditLogFilters>({
    eventType: 'all',
    userType: 'all',
    resultStatus: 'all',
    dateRange: '24h',
    search: '',
    userId: '',
    ipAddress: ''
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Fetch audit logs and statistics
  const fetchAuditData = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filters.eventType !== 'all') params.set('event_type', filters.eventType);
      if (filters.userType !== 'all') params.set('user_type', filters.userType);
      if (filters.resultStatus !== 'all') params.set('result_status', filters.resultStatus);
      if (filters.dateRange !== 'all') params.set('period', filters.dateRange);
      if (filters.search) params.set('search', filters.search);
      if (filters.userId) params.set('user_id', filters.userId);
      if (filters.ipAddress) params.set('ip_address', filters.ipAddress);

      // Fetch audit logs
      const logsResponse = await fetch(`/api/security/audit-logs?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!logsResponse.ok) {
        throw new Error(`Failed to fetch audit logs: ${logsResponse.status}`);
      }

      const logsData = await logsResponse.json();

      // Fetch audit statistics
      const statsResponse = await fetch(`/api/security/audit-logs/stats?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!statsResponse.ok) {
        throw new Error(`Failed to fetch audit statistics: ${statsResponse.status}`);
      }

      const statsData = await statsResponse.json();

      setAuditLogs(logsData.data || []);
      setStats(statsData);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch audit data');
      console.error('Error fetching audit data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditData();
  }, [filters]);

  // Get event type info
  const getEventTypeInfo = (type: string) => {
    switch (type) {
      case 'authentication':
        return { label: 'Authentication', icon: <User className="w-4 h-4" />, color: 'blue' };
      case 'authorization':
        return { label: 'Authorization', icon: <Shield className="w-4 h-4" />, color: 'green' };
      case 'data_access':
        return { label: 'Data Access', icon: <Database className="w-4 h-4" />, color: 'cyan' };
      case 'data_modification':
        return { label: 'Data Modification', icon: <Settings className="w-4 h-4" />, color: 'orange' };
      case 'admin_action':
        return { label: 'Admin Action', icon: <Settings className="w-4 h-4" />, color: 'purple' };
      case 'security_violation':
        return { label: 'Security Violation', icon: <AlertTriangle className="w-4 h-4" />, color: 'red' };
      case 'system_event':
        return { label: 'System Event', icon: <Settings className="w-4 h-4" />, color: 'gray' };
      case 'fraud_detection':
        return { label: 'Fraud Detection', icon: <Shield className="w-4 h-4" />, color: 'yellow' };
      default:
        return { label: 'Unknown', icon: <AlertCircle className="w-4 h-4" />, color: 'gray' };
    }
  };

  // Get result status info
  const getResultStatusInfo = (status: string) => {
    switch (status) {
      case 'success':
        return { label: 'Success', icon: <CheckCircle className="w-4 h-4 text-green-600" />, color: 'default', textColor: 'text-green-600' };
      case 'failure':
        return { label: 'Failure', icon: <XCircle className="w-4 h-4 text-red-600" />, color: 'destructive', textColor: 'text-red-600' };
      case 'blocked':
        return { label: 'Blocked', icon: <Shield className="w-4 h-4 text-orange-600" />, color: 'destructive', textColor: 'text-orange-600' };
      case 'warning':
        return { label: 'Warning', icon: <AlertCircle className="w-4 h-4 text-yellow-600" />, color: 'secondary', textColor: 'text-yellow-600' };
      default:
        return { label: 'Unknown', icon: <AlertCircle className="w-4 h-4" />, color: 'outline', textColor: 'text-gray-600' };
    }
  };

  // Export audit logs data
  const exportData = async (format: 'csv' | 'json' | 'pdf') => {
    try {
      const params = new URLSearchParams(filters as any);
      params.set('export_format', format);
      
      const response = await fetch(`/api/security/audit-logs/export?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });

      if (!response.ok) {
        throw new Error(`Export failed: ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center p-8">
          <RefreshCw className="w-8 h-8 animate-spin" />
          <span className="ml-2">Loading audit logs...</span>
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
          <Button variant="outline" size="sm" className="ml-2" onClick={fetchAuditData}>
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
          <h2 className="text-3xl font-bold tracking-tight">Audit Log Viewer</h2>
          <p className="text-muted-foreground">
            Monitor and review all security events and user activities
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={fetchAuditData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Select onValueChange={(value) => exportData(value as any)}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Export" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="csv">CSV</SelectItem>
              <SelectItem value="json">JSON</SelectItem>
              <SelectItem value="pdf">PDF</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Statistics Overview */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Events</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_events.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                Today: {stats.events_today}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.success_rate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">
                {stats.total_events - stats.failed_events - stats.blocked_events} successful events
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Failed Events</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.failed_events}</div>
              <p className="text-xs text-muted-foreground">
                Blocked: {stats.blocked_events}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Security Violations</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {stats.recent_trends.security_violations}
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

      {/* Event Type Distribution */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle>Event Type Distribution</CardTitle>
            <CardDescription>Breakdown of audit events by type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(stats.event_type_distribution).map(([type, count]) => {
                const typeInfo = getEventTypeInfo(type);
                return (
                  <div key={type} className="text-center">
                    <div className="flex items-center justify-center mb-2">
                      {typeInfo.icon}
                      <span className="ml-2 font-medium">{typeInfo.label}</span>
                    </div>
                    <div className="text-2xl font-bold">{count}</div>
                    <div className="text-sm text-muted-foreground">
                      {((count / stats.total_events) * 100).toFixed(1)}%
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="text-sm font-medium">Event Type</label>
              <Select 
                value={filters.eventType} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, eventType: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="authentication">Authentication</SelectItem>
                  <SelectItem value="authorization">Authorization</SelectItem>
                  <SelectItem value="data_access">Data Access</SelectItem>
                  <SelectItem value="data_modification">Data Modification</SelectItem>
                  <SelectItem value="admin_action">Admin Action</SelectItem>
                  <SelectItem value="security_violation">Security Violation</SelectItem>
                  <SelectItem value="system_event">System Event</SelectItem>
                  <SelectItem value="fraud_detection">Fraud Detection</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">User Type</label>
              <Select 
                value={filters.userType} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, userType: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All users</SelectItem>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="business">Business</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Result Status</label>
              <Select 
                value={filters.resultStatus} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, resultStatus: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All results</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="failure">Failure</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                </SelectContent>
              </Select>
            </div>

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
                  <SelectItem value="90d">Last 90 days</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium">Search Action</label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search actions..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-8"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">User ID</label>
              <Input
                placeholder="Filter by user ID..."
                value={filters.userId}
                onChange={(e) => setFilters(prev => ({ ...prev, userId: e.target.value }))}
              />
            </div>

            <div>
              <label className="text-sm font-medium">IP Address</label>
              <Input
                placeholder="Filter by IP address..."
                value={filters.ipAddress}
                onChange={(e) => setFilters(prev => ({ ...prev, ipAddress: e.target.value }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Audit Events</CardTitle>
          <CardDescription>
            Detailed audit trail of all security events and user activities
          </CardDescription>
        </CardHeader>
        <CardContent>
          {auditLogs.length === 0 ? (
            <div className="text-center py-8">
              <Shield className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No audit logs found with current filters</p>
            </div>
          ) : (
            <div className="space-y-3">
              {auditLogs.map((log) => {
                const eventInfo = getEventTypeInfo(log.event_type);
                const statusInfo = getResultStatusInfo(log.result_status);
                return (
                  <div
                    key={log.id}
                    className="border rounded-lg p-4 hover:bg-muted/50 cursor-pointer"
                    onClick={() => setSelectedLog(log)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="flex items-center">
                          {eventInfo.icon}
                          <span className="ml-1">{eventInfo.label}</span>
                        </Badge>
                        <Badge variant={statusInfo.color as any} className="flex items-center">
                          {statusInfo.icon}
                          <span className="ml-1">{statusInfo.label}</span>
                        </Badge>
                        {log.user_type && (
                          <Badge variant="secondary">
                            {log.user_type}
                          </Badge>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {new Date(log.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <div className="mb-2">
                      <div className="font-medium text-sm mb-1">Action Performed:</div>
                      <div className="text-sm">{log.action_performed}</div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
                      <div>
                        <span className="font-medium">User ID:</span>
                        <span className="ml-1">
                          {log.user_id ? log.user_id.substring(0, 8) + '...' : 'System'}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium">IP Address:</span>
                        <span className="ml-1">{log.ip_address || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="font-medium">Resource:</span>
                        <span className="ml-1">
                          {log.resource_type ? `${log.resource_type}${log.resource_id ? ':' + log.resource_id.substring(0, 8) + '...' : ''}` : 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium">Correlation:</span>
                        <span className="ml-1">{log.correlation_id.substring(0, 8)}...</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Log Modal/Panel */}
      {selectedLog && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Audit Event Details
              <Button variant="outline" size="sm" onClick={() => setSelectedLog(null)}>
                Close
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="metadata">Event Metadata</TabsTrigger>
                <TabsTrigger value="technical">Technical Details</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-2">Event Information</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Event Type</span>
                        <Badge variant="outline">
                          {getEventTypeInfo(selectedLog.event_type).label}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Result Status</span>
                        <Badge variant={getResultStatusInfo(selectedLog.result_status).color as any}>
                          {getResultStatusInfo(selectedLog.result_status).label}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>User Type</span>
                        <span className="font-medium">{selectedLog.user_type || 'System'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Action</span>
                        <span className="font-medium text-right max-w-48 truncate">
                          {selectedLog.action_performed}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Context Information</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Timestamp</span>
                        <span className="font-medium text-xs">
                          {new Date(selectedLog.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>IP Address</span>
                        <span className="font-medium">{selectedLog.ip_address || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>User ID</span>
                        <span className="font-medium text-xs">
                          {selectedLog.user_id || 'System'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Correlation ID</span>
                        <span className="font-medium text-xs">{selectedLog.correlation_id}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="metadata" className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Event Metadata</h4>
                  <div className="bg-muted p-4 rounded-lg">
                    <pre className="text-sm whitespace-pre-wrap">
                      {selectedLog.event_metadata ? 
                        JSON.stringify(selectedLog.event_metadata, null, 2) : 
                        'No metadata available for this event'
                      }
                    </pre>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="technical" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-2">Technical Details</h4>
                    <div className="space-y-2 text-sm">
                      <div><span className="font-medium">Event ID:</span> {selectedLog.id}</div>
                      <div><span className="font-medium">Resource Type:</span> {selectedLog.resource_type || 'N/A'}</div>
                      <div><span className="font-medium">Resource ID:</span> {selectedLog.resource_id || 'N/A'}</div>
                      <div><span className="font-medium">User Agent:</span> {selectedLog.user_agent || 'N/A'}</div>
                    </div>
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

export default AuditLogViewer;