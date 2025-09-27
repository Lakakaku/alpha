'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, AlertTriangle, Eye, Clock, Users, Database } from 'lucide-react';
import AuditLogViewer from '@/components/security/AuditLogViewer';
import IntrusionEventDashboard from '@/components/security/IntrusionEventDashboard';
import SecurityAlertsMonitor from '@/components/security/SecurityAlertsMonitor';

interface SecurityStats {
  totalAlerts: number;
  criticalAlerts: number;
  auditEvents: number;
  intrusionAttempts: number;
  systemStatus: 'healthy' | 'warning' | 'critical';
  lastIncident: string;
}

interface RecentAlert {
  id: string;
  type: 'fraud_detection' | 'intrusion_attempt' | 'data_breach' | 'authentication_failure' | 'rate_limit_exceeded' | 'policy_violation' | 'system_anomaly';
  severity: number;
  description: string;
  timestamp: string;
  status: 'active' | 'investigating' | 'resolved';
}

export default function SecurityPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState<SecurityStats>({
    totalAlerts: 0,
    criticalAlerts: 0,
    auditEvents: 0,
    intrusionAttempts: 0,
    systemStatus: 'healthy',
    lastIncident: ''
  });
  const [recentAlerts, setRecentAlerts] = useState<RecentAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSecurityOverview();
  }, []);

  const fetchSecurityOverview = async () => {
    try {
      const [statsResponse, alertsResponse] = await Promise.all([
        fetch('/api/admin/security/stats', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
          }
        }),
        fetch('/api/admin/security/recent-alerts?limit=10', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
          }
        })
      ]);

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }

      if (alertsResponse.ok) {
        const alertsData = await alertsResponse.json();
        setRecentAlerts(alertsData.alerts || []);
      }
    } catch (error) {
      console.error('Failed to fetch security overview:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSystemStatusBadge = (status: string) => {
    const colors = {
      healthy: 'bg-green-100 text-green-800',
      warning: 'bg-yellow-100 text-yellow-800',
      critical: 'bg-red-100 text-red-800'
    };
    return colors[status as keyof typeof colors] || colors.healthy;
  };

  const getAlertTypeInfo = (type: string) => {
    switch (type) {
      case 'fraud_detection':
        return { label: 'Fraud Detection', icon: <Shield className="w-4 h-4" />, color: 'red' };
      case 'intrusion_attempt':
        return { label: 'Intrusion Attempt', icon: <AlertTriangle className="w-4 h-4" />, color: 'red' };
      case 'data_breach':
        return { label: 'Data Breach', icon: <Database className="w-4 h-4" />, color: 'red' };
      case 'authentication_failure':
        return { label: 'Auth Failure', icon: <Users className="w-4 h-4" />, color: 'orange' };
      case 'rate_limit_exceeded':
        return { label: 'Rate Limit', icon: <Clock className="w-4 h-4" />, color: 'yellow' };
      case 'policy_violation':
        return { label: 'Policy Violation', icon: <Shield className="w-4 h-4" />, color: 'orange' };
      case 'system_anomaly':
        return { label: 'System Anomaly', icon: <Eye className="w-4 h-4" />, color: 'blue' };
      default:
        return { label: type, icon: <AlertTriangle className="w-4 h-4" />, color: 'gray' };
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      active: 'bg-red-100 text-red-800',
      investigating: 'bg-yellow-100 text-yellow-800',
      resolved: 'bg-green-100 text-green-800'
    };
    return colors[status as keyof typeof colors] || colors.active;
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Security Management</h1>
          <p className="text-muted-foreground">
            Monitor security alerts, audit logs, and intrusion detection
          </p>
        </div>
        <Badge className={getSystemStatusBadge(stats.systemStatus)}>
          System: {stats.systemStatus.charAt(0).toUpperCase() + stats.systemStatus.slice(1)}
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="audit">Audit Logs</TabsTrigger>
          <TabsTrigger value="intrusion">Intrusion Events</TabsTrigger>
          <TabsTrigger value="alerts">Security Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Alerts</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalAlerts}</div>
                <p className="text-xs text-muted-foreground">
                  All security alerts
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Critical Alerts</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{stats.criticalAlerts}</div>
                <p className="text-xs text-muted-foreground">
                  High priority incidents
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Audit Events</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.auditEvents}</div>
                <p className="text-xs text-muted-foreground">
                  Logged activities today
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Intrusion Attempts</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.intrusionAttempts}</div>
                <p className="text-xs text-muted-foreground">
                  Attack attempts blocked
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Recent Security Alerts
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-4">Loading alerts...</div>
                ) : recentAlerts.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    No recent alerts
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentAlerts.slice(0, 5).map((alert) => {
                      const typeInfo = getAlertTypeInfo(alert.type);
                      return (
                        <div key={alert.id} className="flex items-center justify-between p-3 rounded-lg border">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full bg-${typeInfo.color}-100`}>
                              {typeInfo.icon}
                            </div>
                            <div>
                              <p className="text-sm font-medium">{typeInfo.label}</p>
                              <p className="text-xs text-muted-foreground">
                                {alert.description.length > 50
                                  ? `${alert.description.substring(0, 50)}...`
                                  : alert.description
                                }
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge className={getStatusBadge(alert.status)}>
                              {alert.status}
                            </Badge>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(alert.timestamp).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Security System Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Fraud Detection</span>
                    <Badge className="bg-green-100 text-green-800">Active</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Intrusion Detection</span>
                    <Badge className="bg-green-100 text-green-800">Active</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Audit Logging</span>
                    <Badge className="bg-green-100 text-green-800">Active</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Rate Limiting</span>
                    <Badge className="bg-green-100 text-green-800">Active</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">RLS Policies</span>
                    <Badge className="bg-green-100 text-green-800">Enforced</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Encryption</span>
                    <Badge className="bg-green-100 text-green-800">AES-256</Badge>
                  </div>
                </div>
                {stats.lastIncident && (
                  <div className="mt-4 p-3 rounded-lg border border-yellow-200 bg-yellow-50">
                    <p className="text-xs font-medium text-yellow-800">Last Security Incident</p>
                    <p className="text-xs text-yellow-700">{stats.lastIncident}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="audit">
          <AuditLogViewer />
        </TabsContent>

        <TabsContent value="intrusion">
          <IntrusionEventDashboard />
        </TabsContent>

        <TabsContent value="alerts">
          <SecurityAlertsMonitor />
        </TabsContent>
      </Tabs>
    </div>
  );
}