/**
 * Security Testing Admin Dashboard
 *
 * @description Main admin interface for security testing management and monitoring
 * @constitutional_requirement Admin-only access, real-time monitoring, TypeScript strict
 * @performance_target <2s dashboard load, real-time status updates
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SecurityTestResults } from '@/components/security/SecurityTestResults';
import { VulnerabilityManager } from '@/components/security/VulnerabilityManager';
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
  Play,
  Pause,
  BarChart3,
  Activity,
  FileText
} from 'lucide-react';

interface SecurityTestSuite {
  id: string;
  name: string;
  description: string;
  category: string;
  test_count: number;
  estimated_duration: number;
  last_execution?: string;
  status: 'active' | 'maintenance' | 'deprecated';
}

interface SecurityMetrics {
  total_tests_run: number;
  vulnerabilities_found: number;
  critical_vulnerabilities: number;
  performance_impact: number;
  compliance_score: number;
  last_scan_time: string;
}

interface ActiveExecution {
  execution_id: string;
  suite_name: string;
  status: 'running' | 'queued';
  progress: number;
  performance_impact: number;
  started_at: string;
}

export default function SecurityDashboard() {
  const [testSuites, setTestSuites] = useState<SecurityTestSuite[]>([]);
  const [metrics, setMetrics] = useState<SecurityMetrics | null>(null);
  const [activeExecutions, setActiveExecutions] = useState<ActiveExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSuiteCategory, setSelectedSuiteCategory] = useState<string>('all');

  // Load initial data
  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [suitesResponse, metricsResponse, executionsResponse] = await Promise.all([
          fetch('/api/security/test-suites', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
          }),
          fetch('/api/security/metrics', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
          }),
          fetch('/api/security/executions/active', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
          })
        ]);

        if (!suitesResponse.ok || !metricsResponse.ok || !executionsResponse.ok) {
          throw new Error('Failed to load dashboard data');
        }

        const suitesData = await suitesResponse.json();
        const metricsData = await metricsResponse.json();
        const executionsData = await executionsResponse.json();

        setTestSuites(suitesData.test_suites || []);
        setMetrics(metricsData);
        setActiveExecutions(executionsData.executions || []);

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
        console.error('Dashboard load error:', err);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();

    // Refresh active executions every 5 seconds
    const interval = setInterval(() => {
      if (activeExecutions.length > 0) {
        fetch('/api/security/executions/active', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
        })
          .then(res => res.json())
          .then(data => setActiveExecutions(data.executions || []))
          .catch(console.error);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [activeExecutions.length]);

  // Execute security test suite
  const executeTestSuite = async (suiteId: string, suiteName: string) => {
    try {
      const response = await fetch(`/api/security/test-suites/${suiteId}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
        },
        body: JSON.stringify({
          performance_limit: 10, // Constitutional maximum
          target_environment: 'staging',
          notification_settings: {
            email_alerts: true
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to start test execution');
      }

      const result = await response.json();

      // Add to active executions
      setActiveExecutions(prev => [...prev, {
        execution_id: result.execution_id,
        suite_name: suiteName,
        status: result.status,
        progress: 0,
        performance_impact: 0,
        started_at: new Date().toISOString()
      }]);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute test suite');
    }
  };

  // Filter test suites by category
  const filteredTestSuites = selectedSuiteCategory === 'all'
    ? testSuites
    : testSuites.filter(suite => suite.category === selectedSuiteCategory);

  const categories = ['all', 'authentication', 'authorization', 'privacy', 'gdpr', 'vulnerability', 'fraud'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Activity className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading security dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Security Testing Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor security tests, vulnerabilities, and compliance status
          </p>
        </div>
        <Button
          onClick={() => window.location.reload()}
          variant="outline"
        >
          <Activity className="h-4 w-4 mr-2" />
          Refresh Dashboard
        </Button>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Security Metrics Cards */}
      {metrics && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tests Run</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.total_tests_run}</div>
              <p className="text-xs text-muted-foreground">
                Last scan: {new Date(metrics.last_scan_time).toLocaleDateString()}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vulnerabilities</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.vulnerabilities_found}</div>
              <p className="text-xs text-muted-foreground">
                {metrics.critical_vulnerabilities} critical
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Performance Impact</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.performance_impact}%</div>
              <p className="text-xs text-muted-foreground">
                {metrics.performance_impact <= 10 ? 'Within constitutional limit' : 'Exceeds limit'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Compliance Score</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.compliance_score}%</div>
              <p className="text-xs text-muted-foreground">
                {metrics.compliance_score >= 80 ? 'Compliant' : 'Needs attention'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Tests</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeExecutions.length}</div>
              <p className="text-xs text-muted-foreground">
                Currently running
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Active Executions */}
      {activeExecutions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Activity className="h-5 w-5 mr-2" />
              Active Security Test Executions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activeExecutions.map((execution) => (
                <div
                  key={execution.execution_id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                    <div>
                      <p className="font-medium">{execution.suite_name}</p>
                      <p className="text-sm text-muted-foreground">
                        Started: {new Date(execution.started_at).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Badge variant={execution.status === 'running' ? 'default' : 'secondary'}>
                      {execution.status}
                    </Badge>
                    <span className="text-sm font-medium">
                      Impact: {execution.performance_impact}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Dashboard Tabs */}
      <Tabs defaultValue="test-suites" className="space-y-4">
        <TabsList>
          <TabsTrigger value="test-suites">Test Suites</TabsTrigger>
          <TabsTrigger value="results">Test Results</TabsTrigger>
          <TabsTrigger value="vulnerabilities">Vulnerabilities</TabsTrigger>
        </TabsList>

        {/* Test Suites Tab */}
        <TabsContent value="test-suites" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Security Test Suites</CardTitle>
                <div className="flex items-center space-x-2">
                  <select
                    value={selectedSuiteCategory}
                    onChange={(e) => setSelectedSuiteCategory(e.target.value)}
                    className="px-3 py-1 border rounded-md text-sm"
                  >
                    {categories.map(category => (
                      <option key={category} value={category}>
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredTestSuites.map((suite) => (
                  <Card key={suite.id} className="relative">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{suite.name}</CardTitle>
                        <Badge variant={suite.status === 'active' ? 'default' : 'secondary'}>
                          {suite.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{suite.description}</p>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Tests:</span>
                          <span>{suite.test_count}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Duration:</span>
                          <span>{suite.estimated_duration}min</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Category:</span>
                          <span className="capitalize">{suite.category}</span>
                        </div>
                        {suite.last_execution && (
                          <div className="flex justify-between text-sm">
                            <span>Last run:</span>
                            <span>{new Date(suite.last_execution).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                      <Button
                        className="w-full mt-4"
                        onClick={() => executeTestSuite(suite.id, suite.name)}
                        disabled={suite.status !== 'active' || activeExecutions.length >= 3}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Execute Test Suite
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Test Results Tab */}
        <TabsContent value="results">
          <SecurityTestResults />
        </TabsContent>

        {/* Vulnerabilities Tab */}
        <TabsContent value="vulnerabilities">
          <VulnerabilityManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}