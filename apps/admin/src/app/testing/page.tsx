'use client';

import React, { useState } from 'react';
import { TestSuiteList } from '../../components/testing/test-suite-list';
import { TestRunMonitor } from '../../components/testing/test-run-monitor';
import { PerformanceDashboard } from '../../components/testing/performance-dashboard';
import { TestResults } from '../../components/testing/test-results';
import { TestSuite, TestRun } from '@vocilia/types';

type TabType = 'overview' | 'suites' | 'runs' | 'performance' | 'results';

export default function TestingPage() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [selectedSuite, setSelectedSuite] = useState<TestSuite | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const tabs = [
    { id: 'overview', name: 'Overview', icon: '📊' },
    { id: 'suites', name: 'Test Suites', icon: '📋' },
    { id: 'runs', name: 'Test Runs', icon: '▶️' },
    { id: 'performance', name: 'Performance', icon: '⚡' },
    { id: 'results', name: 'Results', icon: '📈' }
  ] as const;

  const handleSuiteSelect = (suite: TestSuite) => {
    setSelectedSuite(suite);
    // Switch to runs tab to show runs for this suite
    setActiveTab('runs');
  };

  const handleRunSelect = (runId: string) => {
    setSelectedRunId(runId);
    setActiveTab('runs');
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Quick stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-100 rounded-md flex items-center justify-center">
                <span className="text-blue-600 text-sm">📋</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Test Suites</p>
              <p className="text-2xl font-semibold text-gray-900">24</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-100 rounded-md flex items-center justify-center">
                <span className="text-green-600 text-sm">✓</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Pass Rate</p>
              <p className="text-2xl font-semibold text-gray-900">94.2%</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-yellow-100 rounded-md flex items-center justify-center">
                <span className="text-yellow-600 text-sm">⚡</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Avg Duration</p>
              <p className="text-2xl font-semibold text-gray-900">2.4s</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-purple-100 rounded-md flex items-center justify-center">
                <span className="text-purple-600 text-sm">📈</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Coverage</p>
              <p className="text-2xl font-semibold text-gray-900">87.5%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Recent Test Runs</h3>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              {[
                { suite: 'Customer QR Workflow', status: 'passed', duration: '1.2s', time: '2 min ago' },
                { suite: 'Payment Processing', status: 'passed', duration: '3.1s', time: '5 min ago' },
                { suite: 'Admin Dashboard', status: 'failed', duration: '0.8s', time: '12 min ago' },
                { suite: 'Business Analytics', status: 'passed', duration: '2.9s', time: '18 min ago' },
                { suite: 'Mobile Responsiveness', status: 'passed', duration: '4.2s', time: '23 min ago' }
              ].map((run, index) => (
                <div key={index} className="flex items-center justify-between py-2">
                  <div className="flex items-center space-x-3">
                    <div className={`w-2 h-2 rounded-full ${
                      run.status === 'passed' ? 'bg-green-400' : 'bg-red-400'
                    }`}></div>
                    <span className="text-sm font-medium text-gray-900">{run.suite}</span>
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    <div>{run.duration}</div>
                    <div className="text-xs">{run.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Test Health</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm">
                  <span>Unit Tests</span>
                  <span>156/164 passing</span>
                </div>
                <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-green-600 h-2 rounded-full" style={{ width: '95.1%' }}></div>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between text-sm">
                  <span>Integration Tests</span>
                  <span>42/45 passing</span>
                </div>
                <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-green-600 h-2 rounded-full" style={{ width: '93.3%' }}></div>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between text-sm">
                  <span>E2E Tests</span>
                  <span>28/32 passing</span>
                </div>
                <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-yellow-600 h-2 rounded-full" style={{ width: '87.5%' }}></div>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between text-sm">
                  <span>Performance Tests</span>
                  <span>18/20 passing</span>
                </div>
                <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-green-600 h-2 rounded-full" style={{ width: '90%' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => setActiveTab('suites')}
            className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <span className="mr-2">📋</span>
            Manage Test Suites
          </button>
          
          <button
            onClick={() => setActiveTab('performance')}
            className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <span className="mr-2">⚡</span>
            View Performance
          </button>
          
          <button
            onClick={() => window.open('/api/admin/test/reports/latest', '_blank')}
            className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <span className="mr-2">📊</span>
            Download Report
          </button>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverview();
      
      case 'suites':
        return (
          <TestSuiteList 
            onSuiteSelect={handleSuiteSelect}
            showActions={true}
          />
        );
      
      case 'runs':
        return (
          <TestRunMonitor 
            runId={selectedRunId || undefined}
            autoRefresh={true}
          />
        );
      
      case 'performance':
        return <PerformanceDashboard />;
      
      case 'results':
        return (
          <TestResults 
            suiteId={selectedSuite?.id}
            runId={selectedRunId || undefined}
          />
        );
      
      default:
        return renderOverview();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Testing Management</h1>
              <p className="mt-2 text-sm text-gray-600">
                Monitor and manage your comprehensive testing infrastructure
              </p>
            </div>
            
            <div className="flex space-x-3">
              <button className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700">
                Run All Tests
              </button>
              <button className="bg-green-600 text-white px-4 py-2 rounded-md text-sm hover:bg-green-700">
                Create Suite
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } flex items-center whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.name}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderContent()}
      </div>

      {/* Floating action button for quick test run */}
      <div className="fixed bottom-6 right-6">
        <button
          onClick={() => {
            // Quick test run functionality
            window.open('/api/admin/test/quick-run', '_blank');
          }}
          className="bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
          title="Quick Test Run"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h1m4 0h1m-6-8h8a2 2 0 012 2v8a2 2 0 01-2 2H8a2 2 0 01-2-2v-8a2 2 0 012-2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}