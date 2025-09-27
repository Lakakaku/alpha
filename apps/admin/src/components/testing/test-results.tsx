'use client';

import React, { useState, useEffect } from 'react';
import { TestResult, TestRun, TestCase, PerformanceResult } from '@vocilia/types';

interface TestResultsProps {
  suiteId?: string;
  runId?: string;
  showFilters?: boolean;
}

interface TestResultWithMetadata extends TestResult {
  testCase: TestCase;
  testRun: TestRun;
}

interface ResultsAnalytics {
  totalTests: number;
  passRate: number;
  avgDuration: number;
  trends: {
    passRate: number[];
    duration: number[];
    coverage: number[];
  };
  failurePatterns: {
    component: string;
    count: number;
    percentage: number;
  }[];
  performanceMetrics?: {
    apiResponseTime: number;
    pageLoadTime: number;
    errorRate: number;
  };
}

export function TestResults({ suiteId, runId, showFilters = true }: TestResultsProps) {
  const [results, setResults] = useState<TestResultWithMetadata[]>([]);
  const [analytics, setAnalytics] = useState<ResultsAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    status: '',
    component: '',
    dateRange: '7d',
    search: ''
  });
  const [sortBy, setSortBy] = useState<'duration' | 'timestamp' | 'component'>('timestamp');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedResult, setSelectedResult] = useState<TestResultWithMetadata | null>(null);

  useEffect(() => {
    fetchResults();
    fetchAnalytics();
  }, [suiteId, runId, filters, sortBy, sortOrder]);

  const fetchResults = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (suiteId) params.append('suiteId', suiteId);
      if (runId) params.append('runId', runId);
      if (filters.status) params.append('status', filters.status);
      if (filters.component) params.append('component', filters.component);
      if (filters.dateRange) params.append('dateRange', filters.dateRange);
      if (filters.search) params.append('search', filters.search);
      params.append('sortBy', sortBy);
      params.append('sortOrder', sortOrder);

      const response = await fetch(`/api/admin/test/results?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch test results');
      }

      const data = await response.json();
      setResults(data.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const params = new URLSearchParams();
      if (suiteId) params.append('suiteId', suiteId);
      if (runId) params.append('runId', runId);
      params.append('dateRange', filters.dateRange);

      const response = await fetch(`/api/admin/test/results/analytics?${params}`);
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data.analytics);
      }
    } catch (err) {
      console.warn('Failed to fetch analytics:', err);
    }
  };

  const exportResults = async (format: 'csv' | 'json' | 'pdf') => {
    try {
      const params = new URLSearchParams();
      if (suiteId) params.append('suiteId', suiteId);
      if (runId) params.append('runId', runId);
      params.append('format', format);

      const response = await fetch(`/api/admin/test/results/export?${params}`);
      if (!response.ok) {
        throw new Error('Failed to export results');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `test-results-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export results');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed': return <span className="text-green-600">✓</span>;
      case 'failed': return <span className="text-red-600">✗</span>;
      case 'skipped': return <span className="text-yellow-600">-</span>;
      case 'timeout': return <span className="text-orange-600">⏰</span>;
      case 'error': return <span className="text-red-600">⚠</span>;
      default: return <span className="text-gray-600">?</span>;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'passed': return 'text-green-600 bg-green-100';
      case 'failed': return 'text-red-600 bg-red-100';
      case 'skipped': return 'text-yellow-600 bg-yellow-100';
      case 'timeout': return 'text-orange-600 bg-orange-100';
      case 'error': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const renderTrendChart = (data: number[], title: string) => {
    if (!data || data.length === 0) return null;

    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;

    return (
      <div className="h-20 w-full">
        <div className="text-xs text-gray-500 mb-1">{title}</div>
        <svg width="100%" height="60" className="border rounded">
          <polyline
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
            points={data.map((value, index) => 
              `${(index / (data.length - 1)) * 100}%,${60 - ((value - min) / range) * 50}`
            ).join(' ')}
          />
          {data.map((value, index) => (
            <circle
              key={index}
              cx={`${(index / (data.length - 1)) * 100}%`}
              cy={60 - ((value - min) / range) * 50}
              r="2"
              fill="#3b82f6"
            />
          ))}
        </svg>
      </div>
    );
  };

  const handleSort = (field: 'duration' | 'timestamp' | 'component') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading test results...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error Loading Test Results</h3>
            <p className="mt-1 text-sm text-red-700">{error}</p>
            <button
              onClick={fetchResults}
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
      {/* Analytics overview */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-2xl font-bold text-gray-900">{analytics.totalTests}</div>
            <div className="text-sm text-gray-500">Total Tests</div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-2xl font-bold text-green-600">{analytics.passRate.toFixed(1)}%</div>
            <div className="text-sm text-gray-500">Pass Rate</div>
            {renderTrendChart(analytics.trends.passRate, 'Trend')}
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-2xl font-bold text-blue-600">{formatDuration(analytics.avgDuration)}</div>
            <div className="text-sm text-gray-500">Avg Duration</div>
            {renderTrendChart(analytics.trends.duration, 'Trend')}
          </div>
          
          {analytics.performanceMetrics && (
            <>
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-2xl font-bold text-purple-600">
                  {formatDuration(analytics.performanceMetrics.apiResponseTime)}
                </div>
                <div className="text-sm text-gray-500">API Response</div>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-2xl font-bold text-orange-600">
                  {analytics.performanceMetrics.errorRate.toFixed(2)}%
                </div>
                <div className="text-sm text-gray-500">Error Rate</div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Filters and controls */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">Test Results</h3>
          
          <div className="flex space-x-2">
            <button
              onClick={() => exportResults('csv')}
              className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded hover:bg-gray-200"
            >
              Export CSV
            </button>
            <button
              onClick={() => exportResults('json')}
              className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded hover:bg-gray-200"
            >
              Export JSON
            </button>
            <button
              onClick={() => exportResults('pdf')}
              className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded hover:bg-gray-200"
            >
              Export PDF
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <input
              type="text"
              placeholder="Search tests..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
            
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">All Status</option>
              <option value="passed">Passed</option>
              <option value="failed">Failed</option>
              <option value="skipped">Skipped</option>
              <option value="timeout">Timeout</option>
              <option value="error">Error</option>
            </select>

            <select
              value={filters.component}
              onChange={(e) => setFilters({ ...filters, component: e.target.value })}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">All Components</option>
              <option value="customer-app">Customer App</option>
              <option value="business-app">Business App</option>
              <option value="admin-app">Admin App</option>
              <option value="backend-api">Backend API</option>
            </select>

            <select
              value={filters.dateRange}
              onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="1d">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
            </select>
          </div>
        )}
      </div>

      {/* Results table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Test Name
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('component')}
                >
                  Component {sortBy === 'component' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('duration')}
                >
                  Duration {sortBy === 'duration' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Assertions
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('timestamp')}
                >
                  Timestamp {sortBy === 'timestamp' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {results.map((result) => (
                <tr
                  key={result.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelectedResult(result)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getStatusIcon(result.status)}
                      <span className={`ml-2 px-2 py-1 text-xs rounded ${getStatusColor(result.status)}`}>
                        {result.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">
                      {result.testCase.name}
                    </div>
                    <div className="text-sm text-gray-500 truncate max-w-xs">
                      {result.testCase.description}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {result.testRun.suite?.component}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDuration(result.duration)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {result.assertions ? (
                      <div>
                        <span className="text-green-600">{result.assertions.passed}</span>
                        {result.assertions.failed > 0 && (
                          <span className="text-red-600"> / {result.assertions.failed} failed</span>
                        )}
                        <div className="text-xs">of {result.assertions.total}</div>
                      </div>
                    ) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(result.createdAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedResult(result);
                      }}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {results.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 text-lg mb-2">No test results found</div>
            <p className="text-gray-500 text-sm">
              {filters.search || filters.status || filters.component
                ? 'Try adjusting your filters'
                : 'No tests have been run yet'
              }
            </p>
          </div>
        )}
      </div>

      {/* Failure patterns */}
      {analytics && analytics.failurePatterns.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Failure Patterns</h3>
          <div className="space-y-3">
            {analytics.failurePatterns.map((pattern, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="text-sm font-medium text-gray-900">{pattern.component}</div>
                  <div className="text-sm text-gray-500">{pattern.count} failures</div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-red-600 h-2 rounded-full"
                      style={{ width: `${pattern.percentage}%` }}
                    ></div>
                  </div>
                  <span className="text-sm text-gray-600">{pattern.percentage.toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selected result modal */}
      {selectedResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-screen overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-medium text-gray-900">Test Result Details</h3>
                <button
                  onClick={() => setSelectedResult(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Test Information</h4>
                  <dl className="text-sm space-y-2">
                    <div>
                      <dt className="text-gray-500">Test Name:</dt>
                      <dd className="text-gray-900">{selectedResult.testCase.name}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Status:</dt>
                      <dd className={`${getStatusColor(selectedResult.status)}`}>
                        {selectedResult.status}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Duration:</dt>
                      <dd className="text-gray-900">{formatDuration(selectedResult.duration)}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Component:</dt>
                      <dd className="text-gray-900">{selectedResult.testRun.suite?.component}</dd>
                    </div>
                  </dl>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Run Information</h4>
                  <dl className="text-sm space-y-2">
                    <div>
                      <dt className="text-gray-500">Run ID:</dt>
                      <dd className="text-gray-900 font-mono text-xs">{selectedResult.testRunId}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Branch:</dt>
                      <dd className="text-gray-900">{selectedResult.testRun.branch}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Trigger:</dt>
                      <dd className="text-gray-900">{selectedResult.testRun.triggerType}</dd>
                    </div>
                  </dl>
                </div>
              </div>

              {selectedResult.errorMessage && (
                <div className="mt-6">
                  <h4 className="font-medium text-gray-900 mb-2">Error Details</h4>
                  <div className="bg-red-50 border border-red-200 rounded p-3 text-sm">
                    <div className="text-red-800 font-medium mb-2">{selectedResult.errorMessage}</div>
                    {selectedResult.stackTrace && (
                      <pre className="text-red-700 text-xs overflow-x-auto whitespace-pre-wrap">
                        {selectedResult.stackTrace}
                      </pre>
                    )}
                  </div>
                </div>
              )}

              {selectedResult.screenshots && selectedResult.screenshots.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-medium text-gray-900 mb-2">Screenshots</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedResult.screenshots.map((screenshot, index) => (
                      <img
                        key={index}
                        src={screenshot}
                        alt={`Screenshot ${index + 1}`}
                        className="border rounded max-w-full h-auto"
                      />
                    ))}
                  </div>
                </div>
              )}

              {selectedResult.logs && (
                <div className="mt-6">
                  <h4 className="font-medium text-gray-900 mb-2">Test Logs</h4>
                  <div className="bg-gray-900 text-green-400 rounded p-3 text-xs font-mono max-h-64 overflow-y-auto">
                    <pre>{selectedResult.logs}</pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}