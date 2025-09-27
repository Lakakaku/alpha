'use client';

import React, { useState, useEffect, useRef } from 'react';
import { TestRun, TestResult, TestSuite } from '@vocilia/types';

interface TestRunMonitorProps {
  runId?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface TestRunWithResults extends TestRun {
  suite: TestSuite;
  results: TestResult[];
  progress: {
    total: number;
    completed: number;
    passed: number;
    failed: number;
    skipped: number;
  };
}

export function TestRunMonitor({ 
  runId, 
  autoRefresh = true, 
  refreshInterval = 2000 
}: TestRunMonitorProps) {
  const [testRun, setTestRun] = useState<TestRunWithResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [selectedResult, setSelectedResult] = useState<TestResult | null>(null);
  const intervalRef = useRef<NodeJS.Timeout>();
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (runId) {
      fetchTestRun();
      
      if (autoRefresh) {
        intervalRef.current = setInterval(fetchTestRun, refreshInterval);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [runId, autoRefresh, refreshInterval]);

  useEffect(() => {
    // Auto-scroll logs to bottom
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const fetchTestRun = async () => {
    if (!runId) return;

    try {
      const response = await fetch(`/api/admin/test/runs/${runId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch test run');
      }

      const data = await response.json();
      setTestRun(data.testRun);
      
      // Stop auto-refresh if test is complete
      if (data.testRun.status === 'passed' || data.testRun.status === 'failed' || data.testRun.status === 'cancelled') {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      }

      // Fetch logs if running
      if (data.testRun.status === 'running') {
        fetchLogs();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    if (!runId) return;

    try {
      const response = await fetch(`/api/admin/test/runs/${runId}/logs`);
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
      }
    } catch (err) {
      // Logs are optional, don't show error
      console.warn('Failed to fetch logs:', err);
    }
  };

  const cancelTestRun = async () => {
    if (!runId || !testRun) return;

    try {
      const response = await fetch(`/api/admin/test/runs/${runId}/cancel`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error('Failed to cancel test run');
      }

      fetchTestRun();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel test run');
    }
  };

  const retryFailedTests = async () => {
    if (!runId || !testRun) return;

    try {
      const response = await fetch(`/api/admin/test/runs/${runId}/retry`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error('Failed to retry tests');
      }

      const data = await response.json();
      // Navigate to new test run
      window.location.href = `/admin/testing/runs/${data.newRunId}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retry tests');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>;
      case 'passed':
        return <div className="h-4 w-4 bg-green-600 rounded-full flex items-center justify-center">
          <span className="text-white text-xs">✓</span>
        </div>;
      case 'failed':
        return <div className="h-4 w-4 bg-red-600 rounded-full flex items-center justify-center">
          <span className="text-white text-xs">✗</span>
        </div>;
      case 'cancelled':
        return <div className="h-4 w-4 bg-gray-600 rounded-full flex items-center justify-center">
          <span className="text-white text-xs">-</span>
        </div>;
      default:
        return <div className="h-4 w-4 bg-gray-300 rounded-full"></div>;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'text-blue-600 bg-blue-100';
      case 'passed': return 'text-green-600 bg-green-100';
      case 'failed': return 'text-red-600 bg-red-100';
      case 'cancelled': return 'text-gray-600 bg-gray-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const formatDuration = (start: string, end?: string) => {
    const startTime = new Date(start).getTime();
    const endTime = end ? new Date(end).getTime() : Date.now();
    const duration = endTime - startTime;
    
    if (duration < 1000) return `${duration}ms`;
    if (duration < 60000) return `${(duration / 1000).toFixed(1)}s`;
    return `${(duration / 60000).toFixed(1)}m`;
  };

  if (loading && !testRun) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading test run...</span>
      </div>
    );
  }

  if (error && !testRun) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error Loading Test Run</h3>
            <p className="mt-1 text-sm text-red-700">{error}</p>
            <button
              onClick={fetchTestRun}
              className="mt-2 text-sm bg-red-100 text-red-800 px-3 py-1 rounded hover:bg-red-200"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!testRun) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400 text-lg mb-2">No test run selected</div>
        <p className="text-gray-500 text-sm">Select a test run from the list to monitor its progress</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Test run header */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center space-x-3">
              {getStatusIcon(testRun.status)}
              <h2 className="text-xl font-semibold text-gray-900">{testRun.suite.name}</h2>
              <span className={`px-2 py-1 text-xs rounded ${getStatusColor(testRun.status)}`}>
                {testRun.status.charAt(0).toUpperCase() + testRun.status.slice(1)}
              </span>
            </div>
            <div className="mt-2 text-sm text-gray-600">
              <div>Run ID: {testRun.id}</div>
              <div>Trigger: {testRun.triggerType} ({testRun.triggerReference})</div>
              <div>Branch: {testRun.branch}</div>
              <div>Started: {new Date(testRun.startedAt).toLocaleString()}</div>
              {testRun.completedAt && (
                <div>Duration: {formatDuration(testRun.startedAt, testRun.completedAt)}</div>
              )}
            </div>
          </div>

          <div className="flex space-x-2">
            {testRun.status === 'running' && (
              <button
                onClick={cancelTestRun}
                className="bg-red-600 text-white px-4 py-2 rounded-md text-sm hover:bg-red-700"
              >
                Cancel
              </button>
            )}
            {(testRun.status === 'failed' || testRun.status === 'cancelled') && (
              <button
                onClick={retryFailedTests}
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700"
              >
                Retry Failed
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-6">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Progress: {testRun.progress.completed} / {testRun.progress.total} tests</span>
            <span>{((testRun.progress.completed / testRun.progress.total) * 100).toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(testRun.progress.completed / testRun.progress.total) * 100}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span className="text-green-600">{testRun.progress.passed} passed</span>
            <span className="text-red-600">{testRun.progress.failed} failed</span>
            <span className="text-gray-600">{testRun.progress.skipped} skipped</span>
          </div>
        </div>
      </div>

      {/* Test results and logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Test results */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Test Results</h3>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {testRun.results.map((result) => (
              <div
                key={result.id}
                className={`px-6 py-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                  selectedResult?.id === result.id ? 'bg-blue-50' : ''
                }`}
                onClick={() => setSelectedResult(result)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(result.status)}
                    <span className="text-sm font-medium text-gray-900">
                      {result.testCase?.name || 'Unknown test'}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {formatDuration('0', result.duration.toString())}
                  </span>
                </div>
                {result.errorMessage && (
                  <div className="mt-1 text-xs text-red-600 truncate">
                    {result.errorMessage}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Live logs */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Live Logs</h3>
          </div>
          <div className="h-96 overflow-y-auto bg-gray-900 text-green-400 font-mono text-xs p-4">
            {logs.length > 0 ? (
              logs.map((log, index) => (
                <div key={index} className="mb-1">
                  {log}
                </div>
              ))
            ) : (
              <div className="text-gray-500">No logs available</div>
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>

      {/* Selected test result details */}
      {selectedResult && (
        <div className="bg-white shadow rounded-lg p-6">
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
              <dl className="text-sm">
                <dt className="text-gray-500">Test Name:</dt>
                <dd className="text-gray-900 mb-2">{selectedResult.testCase?.name}</dd>
                
                <dt className="text-gray-500">Status:</dt>
                <dd className={`mb-2 ${getStatusColor(selectedResult.status)}`}>
                  {selectedResult.status}
                </dd>
                
                <dt className="text-gray-500">Duration:</dt>
                <dd className="text-gray-900 mb-2">
                  {formatDuration('0', selectedResult.duration.toString())}
                </dd>
                
                <dt className="text-gray-500">Retry Attempt:</dt>
                <dd className="text-gray-900 mb-2">{selectedResult.retryAttempt}</dd>
              </dl>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 mb-2">Assertions</h4>
              {selectedResult.assertions && (
                <div className="text-sm">
                  <div className="text-gray-500">
                    Total: {selectedResult.assertions.total} | 
                    Passed: <span className="text-green-600">{selectedResult.assertions.passed}</span> | 
                    Failed: <span className="text-red-600">{selectedResult.assertions.failed}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {selectedResult.errorMessage && (
            <div className="mt-6">
              <h4 className="font-medium text-gray-900 mb-2">Error Message</h4>
              <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">
                {selectedResult.errorMessage}
              </div>
            </div>
          )}

          {selectedResult.stackTrace && (
            <div className="mt-4">
              <h4 className="font-medium text-gray-900 mb-2">Stack Trace</h4>
              <div className="bg-gray-900 text-gray-300 rounded p-3 text-xs font-mono overflow-x-auto">
                <pre>{selectedResult.stackTrace}</pre>
              </div>
            </div>
          )}

          {selectedResult.screenshots && selectedResult.screenshots.length > 0 && (
            <div className="mt-4">
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
        </div>
      )}
    </div>
  );
}