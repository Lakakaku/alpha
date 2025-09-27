'use client';

import React, { useState, useEffect } from 'react';
import { PerformanceBenchmark, PerformanceResult, TestRun } from '@vocilia/types';

interface PerformanceMetrics {
  responseTime: {
    current: number;
    target: number;
    trend: number[];
    status: 'good' | 'warning' | 'critical';
  };
  pageLoad: {
    current: number;
    target: number;
    trend: number[];
    status: 'good' | 'warning' | 'critical';
  };
  throughput: {
    current: number;
    target: number;
    trend: number[];
    status: 'good' | 'warning' | 'critical';
  };
  errorRate: {
    current: number;
    target: number;
    trend: number[];
    status: 'good' | 'warning' | 'critical';
  };
}

interface PerformanceAlert {
  id: string;
  metric: string;
  severity: 'warning' | 'critical';
  message: string;
  timestamp: string;
  resolved: boolean;
}

export function PerformanceDashboard() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [benchmarks, setBenchmarks] = useState<PerformanceBenchmark[]>([]);
  const [recentResults, setRecentResults] = useState<PerformanceResult[]>([]);
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
  const [selectedComponent, setSelectedComponent] = useState<string>('all');

  useEffect(() => {
    fetchPerformanceData();
    fetchBenchmarks();
    fetchAlerts();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchPerformanceData, 30000);
    return () => clearInterval(interval);
  }, [timeRange, selectedComponent]);

  const fetchPerformanceData = async () => {
    try {
      const params = new URLSearchParams({
        timeRange,
        component: selectedComponent
      });

      const response = await fetch(`/api/admin/test/performance/metrics?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch performance data');
      }

      const data = await response.json();
      setMetrics(data.metrics);
      setRecentResults(data.recentResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const fetchBenchmarks = async () => {
    try {
      const response = await fetch('/api/admin/test/performance/benchmarks');
      if (response.ok) {
        const data = await response.json();
        setBenchmarks(data.benchmarks);
      }
    } catch (err) {
      console.warn('Failed to fetch benchmarks:', err);
    }
  };

  const fetchAlerts = async () => {
    try {
      const response = await fetch('/api/admin/test/performance/alerts?unresolved=true');
      if (response.ok) {
        const data = await response.json();
        setAlerts(data.alerts);
      }
    } catch (err) {
      console.warn('Failed to fetch alerts:', err);
    }
  };

  const resolveAlert = async (alertId: string) => {
    try {
      const response = await fetch(`/api/admin/test/performance/alerts/${alertId}/resolve`, {
        method: 'POST'
      });
      
      if (response.ok) {
        setAlerts(alerts.filter(alert => alert.id !== alertId));
      }
    } catch (err) {
      console.error('Failed to resolve alert:', err);
    }
  };

  const getStatusColor = (status: 'good' | 'warning' | 'critical') => {
    switch (status) {
      case 'good': return 'text-green-600 bg-green-100';
      case 'warning': return 'text-yellow-600 bg-yellow-100';
      case 'critical': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: 'good' | 'warning' | 'critical') => {
    switch (status) {
      case 'good': return '✓';
      case 'warning': return '⚠';
      case 'critical': return '✗';
      default: return '?';
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatThroughput = (rps: number) => {
    if (rps < 1000) return `${rps.toFixed(1)} req/s`;
    return `${(rps / 1000).toFixed(1)}k req/s`;
  };

  const renderTrendChart = (trend: number[], target: number, unit: string) => {
    if (!trend || trend.length === 0) return null;

    const max = Math.max(...trend, target * 1.2);
    const min = Math.min(...trend, 0);
    const range = max - min;

    return (
      <div className="h-16 w-32 relative">
        <svg width="100%" height="100%" className="absolute inset-0">
          {/* Target line */}
          <line
            x1="0"
            y1={`${((max - target) / range) * 100}%`}
            x2="100%"
            y2={`${((max - target) / range) * 100}%`}
            stroke="#ef4444"
            strokeWidth="1"
            strokeDasharray="2,2"
          />
          
          {/* Trend line */}
          <polyline
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
            points={trend.map((value, index) => 
              `${(index / (trend.length - 1)) * 100},${((max - value) / range) * 100}`
            ).join(' ')}
          />
          
          {/* Data points */}
          {trend.map((value, index) => (
            <circle
              key={index}
              cx={`${(index / (trend.length - 1)) * 100}%`}
              cy={`${((max - value) / range) * 100}%`}
              r="2"
              fill="#3b82f6"
            />
          ))}
        </svg>
      </div>
    );
  };

  const renderMetricCard = (
    title: string,
    metric: {
      current: number;
      target: number;
      trend: number[];
      status: 'good' | 'warning' | 'critical';
    },
    formatter: (value: number) => string
  ) => (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">{title}</h3>
        <span className={`px-2 py-1 text-xs rounded ${getStatusColor(metric.status)}`}>
          {getStatusIcon(metric.status)} {metric.status.toUpperCase()}
        </span>
      </div>
      
      <div className="flex items-end justify-between">
        <div>
          <div className="text-2xl font-bold text-gray-900">
            {formatter(metric.current)}
          </div>
          <div className="text-sm text-gray-500">
            Target: {formatter(metric.target)}
          </div>
        </div>
        
        {renderTrendChart(metric.trend, metric.target, title)}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading performance data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error Loading Performance Data</h3>
            <p className="mt-1 text-sm text-red-700">{error}</p>
            <button
              onClick={fetchPerformanceData}
              className="mt-2 text-sm bg-red-100 text-red-800 px-3 py-1 rounded hover:bg-red-200"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with controls */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Performance Dashboard</h2>
        
        <div className="flex space-x-4">
          <select
            value={selectedComponent}
            onChange={(e) => setSelectedComponent(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="all">All Components</option>
            <option value="customer-app">Customer App</option>
            <option value="business-app">Business App</option>
            <option value="admin-app">Admin App</option>
            <option value="backend-api">Backend API</option>
          </select>
          
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
        </div>
      </div>

      {/* Active alerts */}
      {alerts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-lg font-medium text-red-800 mb-3">Active Performance Alerts</h3>
          <div className="space-y-2">
            {alerts.map((alert) => (
              <div key={alert.id} className="flex items-center justify-between bg-white p-3 rounded border">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs rounded ${
                      alert.severity === 'critical' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {alert.severity.toUpperCase()}
                    </span>
                    <span className="font-medium">{alert.metric}</span>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">{alert.message}</div>
                  <div className="text-xs text-gray-500">{new Date(alert.timestamp).toLocaleString()}</div>
                </div>
                <button
                  onClick={() => resolveAlert(alert.id)}
                  className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded hover:bg-gray-200"
                >
                  Resolve
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Performance metrics */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {renderMetricCard(
            'API Response Time',
            metrics.responseTime,
            formatDuration
          )}
          {renderMetricCard(
            'Page Load Time',
            metrics.pageLoad,
            formatDuration
          )}
          {renderMetricCard(
            'Throughput',
            metrics.throughput,
            formatThroughput
          )}
          {renderMetricCard(
            'Error Rate',
            metrics.errorRate,
            (value) => `${value.toFixed(2)}%`
          )}
        </div>
      )}

      {/* Benchmarks and Recent Results */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance Benchmarks */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Performance Benchmarks</h3>
          </div>
          <div className="p-6">
            {benchmarks.length > 0 ? (
              <div className="space-y-4">
                {benchmarks.map((benchmark) => (
                  <div key={benchmark.id} className="border rounded p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-medium text-gray-900">{benchmark.operation}</div>
                        <div className="text-sm text-gray-500">{benchmark.component}</div>
                      </div>
                      <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                        {benchmark.metric}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      Target: {benchmark.target} {benchmark.unit}
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      Warning: {benchmark.threshold.warning} | Critical: {benchmark.threshold.critical}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                No performance benchmarks configured
              </div>
            )}
          </div>
        </div>

        {/* Recent Test Results */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Recent Performance Results</h3>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {recentResults.length > 0 ? (
              recentResults.map((result) => (
                <div key={result.id} className="px-6 py-3 border-b border-gray-100">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {result.benchmark?.operation}
                      </div>
                      <div className="text-xs text-gray-500">
                        {result.benchmark?.component}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-medium ${getStatusColor(result.status).split(' ')[0]}`}>
                        {result.value} {result.benchmark?.unit}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(result.measuredAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  
                  {result.measurements && (
                    <div className="mt-2 text-xs text-gray-500">
                      Avg: {result.measurements.avg} | 
                      P95: {result.measurements.p95} | 
                      P99: {result.measurements.p99}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center text-gray-500 py-8">
                No recent performance results
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Performance Summary */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Performance Summary</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {metrics ? (
                (Object.values(metrics).filter(m => m.status === 'good').length / 4 * 100).toFixed(0)
              ) : 0}%
            </div>
            <div className="text-sm text-gray-500">Health Score</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{recentResults.length}</div>
            <div className="text-sm text-gray-500">Tests in {timeRange}</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{alerts.length}</div>
            <div className="text-sm text-gray-500">Active Alerts</div>
          </div>
        </div>
      </div>
    </div>
  );
}