'use client';

import { useState, useEffect } from 'react';
import { Card } from '@vocilia/ui';

interface TestMetrics {
  overview: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    skippedTests: number;
    passRate: number;
    avgExecutionTime: number;
    totalExecutionTime: number;
  };
  performance: {
    cacheHitRate: number;
    avgResponseTime: number;
    parallelEfficiency: number;
    memoryUsage: number;
    cpuUsage: number;
  };
  trends: {
    passRateTrend: number[];
    executionTimeTrend: number[];
    failureRateTrend: number[];
    dates: string[];
  };
  suites: {
    id: string;
    name: string;
    category: string;
    passRate: number;
    avgDuration: number;
    lastRun: string;
    status: 'passed' | 'failed' | 'running' | 'pending';
  }[];
  recentRuns: {
    id: string;
    trigger: string;
    status: 'passed' | 'failed' | 'running' | 'cancelled';
    duration: number;
    startedAt: string;
    completedAt?: string;
    testsPassed: number;
    testsFailed: number;
  }[];
}

interface AlertMetric {
  id: string;
  type: 'error' | 'warning' | 'info';
  title: string;
  description: string;
  value: string;
  threshold: string;
  action?: string;
}

export default function TestMetricsDashboard() {
  const [metrics, setMetrics] = useState<TestMetrics | null>(null);
  const [alerts, setAlerts] = useState<AlertMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchMetrics();
    
    if (autoRefresh) {
      const interval = setInterval(fetchMetrics, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [selectedTimeRange, autoRefresh]);

  const fetchMetrics = async () => {
    try {
      const response = await fetch(`/api/admin/testing/metrics?timeRange=${selectedTimeRange}`);
      const data = await response.json();
      setMetrics(data.metrics);
      setAlerts(data.alerts || []);
    } catch (error) {
      console.error('Failed to fetch test metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'passed': return 'text-green-600 bg-green-100';
      case 'failed': return 'text-red-600 bg-red-100';
      case 'running': return 'text-blue-600 bg-blue-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'cancelled': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded mb-6"></div>
          <div className="h-48 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No test metrics available</h3>
          <p className="text-gray-500">Run some tests to see metrics data.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Test Metrics Dashboard</h1>
        <div className="flex items-center space-x-4">
          <select
            value={selectedTimeRange}
            onChange={(e) => setSelectedTimeRange(e.target.value as any)}
            className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-2 rounded-md text-sm font-medium ${
              autoRefresh
                ? 'bg-blue-100 text-blue-700 border border-blue-200'
                : 'bg-gray-100 text-gray-700 border border-gray-200'
            }`}
          >
            {autoRefresh ? '🔄 Auto-refresh' : '⏸️ Manual'}
          </button>
          <button
            onClick={fetchMetrics}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-4 rounded-md border ${
                alert.type === 'error'
                  ? 'bg-red-50 border-red-200 text-red-800'
                  : alert.type === 'warning'
                  ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
                  : 'bg-blue-50 border-blue-200 text-blue-800'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-medium">{alert.title}</h4>
                  <p className="text-sm mt-1">{alert.description}</p>
                  <div className="text-xs mt-2">
                    Current: {alert.value} | Threshold: {alert.threshold}
                  </div>
                </div>
                {alert.action && (
                  <button className="text-sm underline hover:no-underline">
                    {alert.action}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Pass Rate</p>
              <p className="text-2xl font-bold text-gray-900">
                {(metrics.overview.passRate * 100).toFixed(1)}%
              </p>
            </div>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              metrics.overview.passRate > 0.95 ? 'bg-green-100' : 
              metrics.overview.passRate > 0.8 ? 'bg-yellow-100' : 'bg-red-100'
            }`}>
              {metrics.overview.passRate > 0.95 ? '✅' : 
               metrics.overview.passRate > 0.8 ? '⚠️' : '❌'}
            </div>
          </div>
          <div className="mt-2 text-sm text-gray-600">
            {metrics.overview.passedTests} passed, {metrics.overview.failedTests} failed
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Avg Execution Time</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatDuration(metrics.overview.avgExecutionTime)}
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              ⏱️
            </div>
          </div>
          <div className="mt-2 text-sm text-gray-600">
            Total: {formatDuration(metrics.overview.totalExecutionTime)}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Cache Hit Rate</p>
              <p className="text-2xl font-bold text-gray-900">
                {(metrics.performance.cacheHitRate * 100).toFixed(1)}%
              </p>
            </div>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              metrics.performance.cacheHitRate > 0.7 ? 'bg-green-100' : 'bg-yellow-100'
            }`}>
              💾
            </div>
          </div>
          <div className="mt-2 text-sm text-gray-600">
            Performance optimization
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Memory Usage</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatBytes(metrics.performance.memoryUsage)}
              </p>
            </div>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              metrics.performance.memoryUsage < 500 * 1024 * 1024 ? 'bg-green-100' : 'bg-yellow-100'
            }`}>
              🧠
            </div>
          </div>
          <div className="mt-2 text-sm text-gray-600">
            Parallel efficiency: {(metrics.performance.parallelEfficiency * 100).toFixed(1)}%
          </div>
        </Card>
      </div>

      {/* Test Suites Performance */}
      <Card className="p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Test Suites Performance</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Suite
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pass Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Avg Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Run
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {metrics.suites.map((suite) => (
                <tr key={suite.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{suite.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      {suite.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(suite.status)}`}>
                      {suite.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex items-center">
                      <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                        <div
                          className={`h-2 rounded-full ${
                            suite.passRate > 0.95 ? 'bg-green-500' :
                            suite.passRate > 0.8 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${suite.passRate * 100}%` }}
                        ></div>
                      </div>
                      {(suite.passRate * 100).toFixed(1)}%
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDuration(suite.avgDuration)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(suite.lastRun).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Recent Test Runs */}
      <Card className="p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Test Runs</h3>
        <div className="space-y-3">
          {metrics.recentRuns.map((run) => (
            <div key={run.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-4">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(run.status)}`}>
                  {run.status}
                </span>
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {run.trigger} trigger
                  </div>
                  <div className="text-sm text-gray-500">
                    {new Date(run.startedAt).toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-gray-900">
                  {formatDuration(run.duration)}
                </div>
                <div className="text-sm text-gray-500">
                  {run.testsPassed} passed, {run.testsFailed} failed
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Performance Trends */}
      <Card className="p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Performance Trends</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Pass Rate Trend</h4>
            <div className="space-y-2">
              {metrics.trends.passRateTrend.map((rate, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    {metrics.trends.dates[index]}
                  </span>
                  <div className="flex items-center">
                    <div className="w-20 bg-gray-200 rounded-full h-1 mr-2">
                      <div
                        className={`h-1 rounded-full ${
                          rate > 0.95 ? 'bg-green-500' :
                          rate > 0.8 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${rate * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-xs font-medium">
                      {(rate * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Execution Time Trend</h4>
            <div className="space-y-2">
              {metrics.trends.executionTimeTrend.map((time, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    {metrics.trends.dates[index]}
                  </span>
                  <span className="text-xs font-medium">
                    {formatDuration(time)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Failure Rate Trend</h4>
            <div className="space-y-2">
              {metrics.trends.failureRateTrend.map((rate, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    {metrics.trends.dates[index]}
                  </span>
                  <div className="flex items-center">
                    <div className="w-20 bg-gray-200 rounded-full h-1 mr-2">
                      <div
                        className="h-1 rounded-full bg-red-500"
                        style={{ width: `${rate * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-xs font-medium">
                      {(rate * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}