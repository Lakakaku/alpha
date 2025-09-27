'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Activity, Clock, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';

interface PerformanceMetric {
  metric_id: string;
  environment_id: string;
  metric_type: 'health_check' | 'performance' | 'error_rate' | 'uptime';
  metric_value: number;
  unit: string;
  threshold_warning: number;
  threshold_critical: number;
  status: 'healthy' | 'warning' | 'critical';
  timestamp: string;
  source: string;
}

interface PerformanceData {
  metrics: PerformanceMetric[];
  summary: {
    average_response_time: number;
    p95_response_time: number;
    error_rate: number;
    uptime_percentage: number;
    total_requests: number;
  };
  trends: {
    response_time_trend: 'up' | 'down' | 'stable';
    error_rate_trend: 'up' | 'down' | 'stable';
    traffic_trend: 'up' | 'down' | 'stable';
  };
}

export default function PerformanceMonitor() {
  const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState('1h');
  const [refreshing, setRefreshing] = useState(false);

  const fetchPerformanceData = async () => {
    try {
      setRefreshing(true);
      const response = await fetch(`/api/admin/monitoring/performance?timeframe=${timeframe}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch performance data');
      }

      const data = await response.json();
      setPerformanceData(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPerformanceData();
  }, [timeframe]);

  useEffect(() => {
    fetchPerformanceData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchPerformanceData, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: PerformanceMetric['status']) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'critical':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: PerformanceMetric['status']) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      case 'critical':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'down':
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      case 'stable':
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatMetricValue = (value: number, unit: string) => {
    if (unit === 'ms') {
      return `${Math.round(value)}ms`;
    }
    if (unit === '%') {
      return `${value.toFixed(1)}%`;
    }
    if (unit === 'count') {
      return value.toLocaleString();
    }
    return `${value.toFixed(2)} ${unit}`;
  };

  const isResponseTimeHealthy = (responseTime: number) => {
    return responseTime < 2000; // <2s requirement
  };

  const isUptimeHealthy = (uptime: number) => {
    return uptime >= 99.5; // 99.5% requirement
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Performance Monitor</CardTitle>
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
      {/* Controls */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Performance Monitor</CardTitle>
          <div className="flex items-center space-x-2">
            <Select value={timeframe} onValueChange={setTimeframe}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15m">Last 15 min</SelectItem>
                <SelectItem value="1h">Last 1 hour</SelectItem>
                <SelectItem value="6h">Last 6 hours</SelectItem>
                <SelectItem value="24h">Last 24 hours</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchPerformanceData}
              disabled={refreshing}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
      </Card>

      {error && (
        <Card>
          <CardContent className="pt-6">
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <AlertTriangle className="w-5 h-5 text-red-400 mr-2" />
                <p className="text-red-800">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {performanceData && (
        <>
          {/* Performance Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Avg Response Time</p>
                    <p className={`text-2xl font-bold ${
                      isResponseTimeHealthy(performanceData.summary.average_response_time) 
                        ? 'text-green-600' 
                        : 'text-red-600'
                    }`}>
                      {Math.round(performanceData.summary.average_response_time)}ms
                    </p>
                  </div>
                  <div className="flex items-center">
                    <Clock className="w-5 h-5 text-gray-400" />
                    {getTrendIcon(performanceData.trends.response_time_trend)}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">P95 Response Time</p>
                    <p className={`text-2xl font-bold ${
                      isResponseTimeHealthy(performanceData.summary.p95_response_time) 
                        ? 'text-green-600' 
                        : 'text-red-600'
                    }`}>
                      {Math.round(performanceData.summary.p95_response_time)}ms
                    </p>
                  </div>
                  <Clock className="w-5 h-5 text-gray-400" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Error Rate</p>
                    <p className={`text-2xl font-bold ${
                      performanceData.summary.error_rate < 1 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {performanceData.summary.error_rate.toFixed(2)}%
                    </p>
                  </div>
                  <div className="flex items-center">
                    <AlertTriangle className="w-5 h-5 text-gray-400" />
                    {getTrendIcon(performanceData.trends.error_rate_trend)}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Uptime</p>
                    <p className={`text-2xl font-bold ${
                      isUptimeHealthy(performanceData.summary.uptime_percentage) 
                        ? 'text-green-600' 
                        : 'text-red-600'
                    }`}>
                      {performanceData.summary.uptime_percentage.toFixed(2)}%
                    </p>
                  </div>
                  <CheckCircle className="w-5 h-5 text-gray-400" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Requests</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {performanceData.summary.total_requests.toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center">
                    <Activity className="w-5 h-5 text-gray-400" />
                    {getTrendIcon(performanceData.trends.traffic_trend)}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* SLA Status */}
          <Card>
            <CardHeader>
              <CardTitle>SLA Compliance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Response Time Target</p>
                    <p className="text-sm text-gray-600">&lt; 2000ms</p>
                  </div>
                  <Badge className={
                    isResponseTimeHealthy(performanceData.summary.p95_response_time)
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }>
                    {isResponseTimeHealthy(performanceData.summary.p95_response_time) ? 'Meeting' : 'Failing'}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Uptime Target</p>
                    <p className="text-sm text-gray-600">&geq; 99.5%</p>
                  </div>
                  <Badge className={
                    isUptimeHealthy(performanceData.summary.uptime_percentage)
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }>
                    {isUptimeHealthy(performanceData.summary.uptime_percentage) ? 'Meeting' : 'Failing'}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Error Rate Target</p>
                    <p className="text-sm text-gray-600">&lt; 1%</p>
                  </div>
                  <Badge className={
                    performanceData.summary.error_rate < 1
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }>
                    {performanceData.summary.error_rate < 1 ? 'Meeting' : 'Failing'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Detailed Metrics */}
          <Card>
            <CardHeader>
              <CardTitle>Detailed Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {performanceData.metrics.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No metrics available for selected timeframe</p>
                ) : (
                  performanceData.metrics.map((metric) => (
                    <div
                      key={metric.metric_id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(metric.status)}
                        <div>
                          <h4 className="font-medium">{metric.metric_type.replace(/_/g, ' ').toUpperCase()}</h4>
                          <p className="text-sm text-gray-600">
                            {metric.environment_id} • {metric.source}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg">
                          {formatMetricValue(metric.metric_value, metric.unit)}
                        </p>
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <Badge className={getStatusColor(metric.status)}>
                            {metric.status}
                          </Badge>
                          <span>{new Date(metric.timestamp).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}