'use client';

import React, { useState, useEffect } from 'react';
import { TestSuite, TestCase, TestRun } from '@vocilia/types';

interface TestSuiteListProps {
  onSuiteSelect?: (suite: TestSuite) => void;
  showActions?: boolean;
}

interface TestSuiteWithStats extends TestSuite {
  totalTests: number;
  lastRun?: TestRun;
  passRate: number;
  avgDuration: number;
}

export function TestSuiteList({ onSuiteSelect, showActions = true }: TestSuiteListProps) {
  const [suites, setSuites] = useState<TestSuiteWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<{
    type: string;
    component: string;
    status: string;
    search: string;
  }>({
    type: '',
    component: '',
    status: '',
    search: ''
  });
  const [sortBy, setSortBy] = useState<keyof TestSuiteWithStats>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    fetchTestSuites();
  }, [filter, sortBy, sortOrder]);

  const fetchTestSuites = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (filter.type) params.append('type', filter.type);
      if (filter.component) params.append('component', filter.component);
      if (filter.status) params.append('status', filter.status);
      if (filter.search) params.append('search', filter.search);
      params.append('sortBy', sortBy);
      params.append('sortOrder', sortOrder);

      const response = await fetch(`/api/admin/test/suites?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch test suites');
      }

      const data = await response.json();
      setSuites(data.suites);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const runTestSuite = async (suiteId: string) => {
    try {
      const response = await fetch(`/api/admin/test/suites/${suiteId}/run`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error('Failed to start test run');
      }

      const data = await response.json();
      // Refresh the suite list to show updated status
      fetchTestSuites();
      
      // Optionally navigate to test run monitor
      if (data.runId) {
        window.open(`/admin/testing/runs/${data.runId}`, '_blank');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run test suite');
    }
  };

  const toggleSuiteStatus = async (suiteId: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/admin/test/suites/${suiteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update suite status');
      }

      fetchTestSuites();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update suite');
    }
  };

  const getStatusBadge = (suite: TestSuiteWithStats) => {
    if (!suite.enabled) {
      return <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">Disabled</span>;
    }
    
    if (!suite.lastRun) {
      return <span className="px-2 py-1 text-xs bg-blue-100 text-blue-600 rounded">Never Run</span>;
    }

    const status = suite.lastRun.status;
    const colors = {
      passed: 'bg-green-100 text-green-600',
      failed: 'bg-red-100 text-red-600',
      running: 'bg-yellow-100 text-yellow-600',
      pending: 'bg-gray-100 text-gray-600',
      cancelled: 'bg-gray-100 text-gray-600'
    };

    return (
      <span className={`px-2 py-1 text-xs rounded ${colors[status] || colors.pending}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const colors = {
      critical: 'bg-red-100 text-red-800',
      high: 'bg-orange-100 text-orange-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-green-100 text-green-800'
    };

    return (
      <span className={`px-2 py-1 text-xs rounded ${colors[priority] || colors.medium}`}>
        {priority.charAt(0).toUpperCase() + priority.slice(1)}
      </span>
    );
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const handleSort = (field: keyof TestSuiteWithStats) => {
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
        <span className="ml-2 text-gray-600">Loading test suites...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error Loading Test Suites</h3>
            <p className="mt-1 text-sm text-red-700">{error}</p>
            <button
              onClick={fetchTestSuites}
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
    <div className="bg-white shadow rounded-lg">
      {/* Header with filters */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">Test Suites</h3>
          {showActions && (
            <button
              onClick={() => window.location.href = '/admin/testing/suites/new'}
              className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700"
            >
              Create Suite
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            type="text"
            placeholder="Search suites..."
            value={filter.search}
            onChange={(e) => setFilter({ ...filter, search: e.target.value })}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
          
          <select
            value={filter.type}
            onChange={(e) => setFilter({ ...filter, type: e.target.value })}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="">All Types</option>
            <option value="unit">Unit</option>
            <option value="integration">Integration</option>
            <option value="e2e">E2E</option>
            <option value="performance">Performance</option>
          </select>

          <select
            value={filter.component}
            onChange={(e) => setFilter({ ...filter, component: e.target.value })}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="">All Components</option>
            <option value="customer-app">Customer App</option>
            <option value="business-app">Business App</option>
            <option value="admin-app">Admin App</option>
            <option value="backend-api">Backend API</option>
            <option value="shared-packages">Shared Packages</option>
          </select>

          <select
            value={filter.status}
            onChange={(e) => setFilter({ ...filter, status: e.target.value })}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="">All Status</option>
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
            <option value="passing">Passing</option>
            <option value="failing">Failing</option>
          </select>
        </div>
      </div>

      {/* Test suites table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('name')}
              >
                Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Component
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Priority
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('totalTests')}
              >
                Tests {sortBy === 'totalTests' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('passRate')}
              >
                Pass Rate {sortBy === 'passRate' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Avg Duration
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Run
              </th>
              {showActions && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {suites.map((suite) => (
              <tr
                key={suite.id}
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() => onSuiteSelect?.(suite)}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{suite.name}</div>
                    <div className="text-sm text-gray-500">Coverage: {suite.coverageTarget}%</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                    {suite.type}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {suite.component}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getPriorityBadge(suite.priority)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {suite.totalTests}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-1 bg-gray-200 rounded-full h-2 mr-2">
                      <div
                        className={`h-2 rounded-full ${
                          suite.passRate >= 95 ? 'bg-green-600' :
                          suite.passRate >= 80 ? 'bg-yellow-600' : 'bg-red-600'
                        }`}
                        style={{ width: `${suite.passRate}%` }}
                      ></div>
                    </div>
                    <span className="text-sm text-gray-900">{suite.passRate.toFixed(1)}%</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDuration(suite.avgDuration)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getStatusBadge(suite)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {suite.lastRun ? (
                    <div>
                      <div>{new Date(suite.lastRun.startedAt).toLocaleDateString()}</div>
                      <div className="text-xs text-gray-400">
                        {new Date(suite.lastRun.startedAt).toLocaleTimeString()}
                      </div>
                    </div>
                  ) : (
                    'Never'
                  )}
                </td>
                {showActions && (
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          runTestSuite(suite.id);
                        }}
                        className="text-blue-600 hover:text-blue-900"
                        title="Run test suite"
                      >
                        Run
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSuiteStatus(suite.id, !suite.enabled);
                        }}
                        className={`${
                          suite.enabled ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'
                        }`}
                        title={suite.enabled ? 'Disable suite' : 'Enable suite'}
                      >
                        {suite.enabled ? 'Disable' : 'Enable'}
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {suites.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 text-lg mb-2">No test suites found</div>
          <p className="text-gray-500 text-sm">
            {filter.search || filter.type || filter.component || filter.status
              ? 'Try adjusting your filters'
              : 'Create your first test suite to get started'
            }
          </p>
        </div>
      )}
    </div>
  );
}