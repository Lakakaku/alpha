'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Area,
  AreaChart 
} from 'recharts';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Zap, 
  Server, 
  Database,
  Loader2,
  RefreshCw,
  Cpu,
  MemoryStick,
  HardDrive,
  Network,
  TrendingUp,
  TrendingDown,
  AlertCircle
} from 'lucide-react';

interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical';
  response_time_ms: number;
  cache_hit_rate: number;
  database_connections: number;
  active_triggers: number;
  questions_per_minute: number;
  error_rate: number;
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
}

interface PerformanceMetrics {
  timestamp: string;
  response_time: number;
  throughput: number;
  error_rate: number;
  cache_hit_rate: number;
}

interface ErrorLog {
  id: string;
  timestamp: string;
  level: 'error' | 'warning' | 'info';
  component: string;
  message: string;
  details?: string;
  business_context_id?: string;
  trigger_id?: string;
}

interface ServiceStatus {
  name: string;
  status: 'up' | 'down' | 'degraded';
  response_time: number;
  last_check: string;
  error_count: number;
}

interface MonitoringData {
  system_health: SystemHealth;
  performance_history: PerformanceMetrics[];
  error_logs: ErrorLog[];
  service_statuses: ServiceStatus[];
  alerts: Array<{
    id: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    description: string;
    timestamp: string;
    resolved: boolean;
  }>;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'healthy':
    case 'up':
      return 'text-green-600 border-green-200 bg-green-50';
    case 'warning':
    case 'degraded':
      return 'text-orange-600 border-orange-200 bg-orange-50';
    case 'critical':
    case 'down':
      return 'text-red-600 border-red-200 bg-red-50';
    default:
      return 'text-gray-600 border-gray-200 bg-gray-50';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'healthy':
    case 'up':
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    case 'warning':
    case 'degraded':
      return <AlertTriangle className="h-4 w-4 text-orange-600" />;
    case 'critical':
    case 'down':
      return <AlertCircle className="h-4 w-4 text-red-600" />;
    default:
      return <Activity className="h-4 w-4 text-gray-600" />;
  }
};

const getSeverityBadge = (severity: string) => {
  switch (severity) {
    case 'critical':
      return <Badge variant="destructive">Critical</Badge>;
    case 'high':
      return <Badge variant="destructive">High</Badge>;
    case 'medium':
      return <Badge variant="secondary">Medium</Badge>;
    case 'low':
      return <Badge variant="outline">Low</Badge>;
    default:
      return <Badge variant="outline">{severity}</Badge>;
  }
};

export function QuestionLogicMonitoring() {
  const [loading, setLoading] = useState(true);
  const [monitoring, setMonitoring] = useState<MonitoringData | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMonitoringData();

    if (autoRefresh) {
      const interval = setInterval(loadMonitoringData, 30000); // 30 seconds
      setRefreshInterval(interval);
      return () => clearInterval(interval);
    }

    return () => {
      if (refreshInterval) clearInterval(refreshInterval);
    };
  }, [autoRefresh]);

  const loadMonitoringData = async () => {
    try {
      if (!monitoring) setLoading(true);
      setError(null);

      const response = await fetch('/api/admin/monitoring/question-logic', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load monitoring data');
      }

      const data = await response.json();
      setMonitoring(data.monitoring);
    } catch (error) {
      console.error('Error loading monitoring data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load monitoring data');
    } finally {
      setLoading(false);
    }
  };

  const toggleAutoRefresh = () => {
    setAutoRefresh(!autoRefresh);
    if (refreshInterval) {
      clearInterval(refreshInterval);
      setRefreshInterval(null);
    }
  };

  if (loading && !monitoring) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin mr-4" />
          Loading system monitoring data...
        </CardContent>
      </Card>
    );
  }

  if (error || !monitoring) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          {error || 'Failed to load monitoring data'}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={loadMonitoringData}
            className="ml-2"
          >
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const { system_health } = monitoring;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Question Logic System Monitoring</h2>
          <p className="text-muted-foreground">
            Real-time monitoring of advanced question logic performance and health
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={toggleAutoRefresh}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto Refresh {autoRefresh ? 'On' : 'Off'}
          </Button>
          <Button variant="outline" size="sm" onClick={loadMonitoringData}>
            Refresh Now
          </Button>
        </div>
      </div>

      {/* System Status Overview */}
      <div className={`p-4 rounded-lg border ${getStatusColor(system_health.status)}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {getStatusIcon(system_health.status)}
            <div>
              <h3 className="text-lg font-semibold capitalize">
                System Status: {system_health.status}
              </h3>
              <p className="text-sm opacity-80">
                Question logic services are {system_health.status === 'healthy' ? 'operating normally' : 
                system_health.status === 'warning' ? 'experiencing minor issues' : 
                'experiencing critical issues'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{system_health.response_time_ms}ms</div>
            <div className="text-sm opacity-80">Avg Response Time</div>
          </div>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(system_health.cache_hit_rate * 100).toFixed(1)}%
            </div>
            <Progress value={system_health.cache_hit_rate * 100} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Triggers</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{system_health.active_triggers}</div>
            <p className="text-xs text-muted-foreground mt-2">
              Processing questions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Throughput</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{system_health.questions_per_minute}</div>
            <p className="text-xs text-muted-foreground mt-2">
              Questions per minute
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {(system_health.error_rate * 100).toFixed(2)}%
            </div>
            <Badge variant={system_health.error_rate < 0.01 ? "default" : "destructive"} className="text-xs mt-2">
              {system_health.error_rate < 0.01 ? 'Good' : 'High'}
            </Badge>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="logs">Error Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Response Time Trend</CardTitle>
                <CardDescription>Average response time over the last hour</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={monitoring.performance_history}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={(value) => new Date(value).toLocaleTimeString()} 
                    />
                    <YAxis tickFormatter={(value) => `${value}ms`} />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value).toLocaleString()}
                      formatter={(value) => [`${value}ms`, 'Response Time']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="response_time" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">System Throughput</CardTitle>
                <CardDescription>Questions processed per minute</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={monitoring.performance_history}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={(value) => new Date(value).toLocaleTimeString()} 
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value).toLocaleString()}
                      formatter={(value) => [value, 'Questions/min']}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="throughput" 
                      stroke="#10b981" 
                      fill="#10b981" 
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="services" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Service Status</CardTitle>
              <CardDescription>Health status of question logic microservices</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {monitoring.service_statuses.map((service) => (
                  <div key={service.name} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(service.status)}
                      <div>
                        <div className="font-medium">{service.name}</div>
                        <div className="text-sm text-muted-foreground">
                          Last checked: {new Date(service.last_check).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      <div className="text-center">
                        <div className="text-sm font-medium">Response Time</div>
                        <div className="text-lg font-bold">{service.response_time}ms</div>
                      </div>
                      
                      <div className="text-center">
                        <div className="text-sm font-medium">Errors (24h)</div>
                        <div className="text-lg font-bold text-red-600">{service.error_count}</div>
                      </div>
                      
                      <Badge variant={service.status === 'up' ? 'default' : service.status === 'degraded' ? 'secondary' : 'destructive'}>
                        {service.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resources" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
                <Cpu className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{system_health.cpu_usage.toFixed(1)}%</div>
                <Progress value={system_health.cpu_usage} className="mt-2" />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>0%</span>
                  <span>100%</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
                <MemoryStick className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{system_health.memory_usage.toFixed(1)}%</div>
                <Progress value={system_health.memory_usage} className="mt-2" />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>0%</span>
                  <span>100%</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Disk Usage</CardTitle>
                <HardDrive className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{system_health.disk_usage.toFixed(1)}%</div>
                <Progress value={system_health.disk_usage} className="mt-2" />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>0%</span>
                  <span>100%</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Database Connections</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{system_health.database_connections}</div>
              <p className="text-sm text-muted-foreground">Active database connections</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">System Alerts</CardTitle>
              <CardDescription>Recent alerts and notifications</CardDescription>
            </CardHeader>
            <CardContent>
              {monitoring.alerts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No active alerts</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {monitoring.alerts.map((alert) => (
                    <Alert key={alert.id} variant={alert.severity === 'critical' ? 'destructive' : 'default'}>
                      <AlertTriangle className="h-4 w-4" />
                      <div className="flex items-center justify-between w-full">
                        <div>
                          <div className="font-medium">{alert.title}</div>
                          <AlertDescription className="mt-1">
                            {alert.description}
                          </AlertDescription>
                          <div className="text-xs text-muted-foreground mt-2">
                            {new Date(alert.timestamp).toLocaleString()}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {getSeverityBadge(alert.severity)}
                          {alert.resolved && <Badge variant="outline">Resolved</Badge>}
                        </div>
                      </div>
                    </Alert>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Error Logs</CardTitle>
              <CardDescription>Latest errors and warnings from the question logic system</CardDescription>
            </CardHeader>
            <CardContent>
              {monitoring.error_logs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No recent errors</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {monitoring.error_logs.map((log) => (
                    <div key={log.id} className="p-3 border rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <Badge variant={
                              log.level === 'error' ? 'destructive' : 
                              log.level === 'warning' ? 'secondary' : 
                              'outline'
                            }>
                              {log.level}
                            </Badge>
                            <span className="font-medium">{log.component}</span>
                          </div>
                          <div className="mt-1 text-sm">{log.message}</div>
                          {log.details && (
                            <details className="mt-2">
                              <summary className="text-xs cursor-pointer text-muted-foreground">
                                Show details
                              </summary>
                              <pre className="text-xs mt-1 p-2 bg-muted rounded overflow-x-auto">
                                {log.details}
                              </pre>
                            </details>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(log.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}