'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle, Clock, XCircle, RefreshCw, ExternalLink } from 'lucide-react';

interface DeploymentStatus {
  deployment_id: string;
  environment_id: string;
  commit_sha: string;
  branch: string;
  status: 'pending' | 'building' | 'deploying' | 'success' | 'failed' | 'rolled_back';
  platform_deployment_id: string;
  started_at: string;
  completed_at?: string;
  rollback_target: boolean;
  artifacts_url?: string;
  logs_url?: string;
  app_name: string;
  platform: 'Railway' | 'Vercel';
}

interface Environment {
  environment_id: string;
  platform: 'Railway' | 'Vercel' | 'Supabase';
  app_name: string;
  environment_type: 'production' | 'staging' | 'development';
  is_active: boolean;
}

export default function DeploymentStatus() {
  const [deployments, setDeployments] = useState<DeploymentStatus[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDeploymentStatus = async () => {
    try {
      setRefreshing(true);
      const response = await fetch('/api/admin/deployment/status', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch deployment status');
      }

      const data = await response.json();
      setDeployments(data.deployments || []);
      setEnvironments(data.environments || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDeploymentStatus();
    // Refresh every 30 seconds
    const interval = setInterval(fetchDeploymentStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: DeploymentStatus['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'pending':
      case 'building':
      case 'deploying':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'rolled_back':
        return <AlertCircle className="w-4 h-4 text-orange-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: DeploymentStatus['status']) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'pending':
      case 'building':
      case 'deploying':
        return 'bg-yellow-100 text-yellow-800';
      case 'rolled_back':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDuration = (startedAt: string, completedAt?: string) => {
    const start = new Date(startedAt);
    const end = completedAt ? new Date(completedAt) : new Date();
    const durationMs = end.getTime() - start.getTime();
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  const initiateRollback = async (deploymentId: string, environmentId: string) => {
    if (!confirm('Are you sure you want to rollback this deployment?')) {
      return;
    }

    try {
      const response = await fetch('/api/admin/deployment/rollback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
        },
        body: JSON.stringify({
          target_deployment_id: deploymentId,
          environment: environmentId,
          reason: 'Manual rollback from admin dashboard',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to initiate rollback');
      }

      // Refresh deployment status
      fetchDeploymentStatus();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to initiate rollback');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Deployment Status</CardTitle>
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
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Deployment Status</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDeploymentStatus}
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
              <div className="flex">
                <XCircle className="w-5 h-5 text-red-400 mr-2" />
                <p className="text-red-800">{error}</p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {deployments.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No deployments found</p>
            ) : (
              deployments.map((deployment) => (
                <div
                  key={deployment.deployment_id}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(deployment.status)}
                      <div>
                        <h3 className="font-medium">
                          {deployment.app_name} ({deployment.platform})
                        </h3>
                        <p className="text-sm text-gray-500">
                          {deployment.environment_id} • {deployment.branch}
                        </p>
                      </div>
                    </div>
                    <Badge className={getStatusColor(deployment.status)}>
                      {deployment.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Commit</p>
                      <p className="font-mono">{deployment.commit_sha.substring(0, 8)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Duration</p>
                      <p>{formatDuration(deployment.started_at, deployment.completed_at)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Started</p>
                      <p>{new Date(deployment.started_at).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Platform ID</p>
                      <p className="font-mono">{deployment.platform_deployment_id}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {deployment.logs_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(deployment.logs_url, '_blank')}
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        View Logs
                      </Button>
                    )}
                    {deployment.artifacts_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(deployment.artifacts_url, '_blank')}
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Artifacts
                      </Button>
                    )}
                    {deployment.rollback_target && deployment.status === 'success' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => initiateRollback(deployment.deployment_id, deployment.environment_id)}
                      >
                        Rollback
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Environment Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Environment Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {environments.map((env) => (
              <div
                key={env.environment_id}
                className={`border rounded-lg p-4 ${
                  env.is_active ? 'border-green-200 bg-green-50' : 'border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">{env.app_name}</h4>
                  <Badge variant={env.is_active ? 'default' : 'secondary'}>
                    {env.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600">{env.platform}</p>
                <p className="text-sm text-gray-500">{env.environment_type}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}