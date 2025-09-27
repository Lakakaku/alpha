'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { RotateCcw, Clock, CheckCircle, XCircle, AlertTriangle, RefreshCw, ExternalLink } from 'lucide-react';

interface RollbackOperation {
  rollback_id: string;
  deployment_id: string;
  target_deployment_id: string;
  environment: string;
  app: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  reason: string;
  started_at: string;
  completed_at?: string;
  duration_seconds?: number;
  rollback_url?: string;
  logs_url?: string;
  admin_username: string;
}

interface DeploymentHistory {
  deployment_id: string;
  commit_sha: string;
  branch: string;
  status: 'success' | 'failed' | 'rolled_back';
  started_at: string;
  completed_at?: string;
  rollback_target: boolean;
  app_name: string;
  environment_id: string;
}

export default function RollbackManager() {
  const [rollbacks, setRollbacks] = useState<RollbackOperation[]>([]);
  const [deploymentHistory, setDeploymentHistory] = useState<DeploymentHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // Rollback form state
  const [selectedEnvironment, setSelectedEnvironment] = useState<string>('');
  const [selectedApp, setSelectedApp] = useState<string>('');
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [rollbackReason, setRollbackReason] = useState<string>('');
  const [initiatingRollback, setInitiatingRollback] = useState(false);

  const fetchRollbackData = async () => {
    try {
      setRefreshing(true);
      const [rollbacksResponse, historyResponse] = await Promise.all([
        fetch('/api/admin/deployment/rollbacks', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
          },
        }),
        fetch('/api/admin/deployment/history', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
          },
        })
      ]);

      if (!rollbacksResponse.ok || !historyResponse.ok) {
        throw new Error('Failed to fetch rollback data');
      }

      const rollbacksData = await rollbacksResponse.json();
      const historyData = await historyResponse.json();
      
      setRollbacks(rollbacksData.rollbacks || []);
      setDeploymentHistory(historyData.deployments || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRollbackData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchRollbackData, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: RollbackOperation['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'pending':
      case 'in_progress':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'cancelled':
        return <AlertTriangle className="w-4 h-4 text-gray-500" />;
      default:
        return <RotateCcw className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: RollbackOperation['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'pending':
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDuration = (durationSeconds?: number) => {
    if (!durationSeconds) return 'N/A';
    
    const minutes = Math.floor(durationSeconds / 60);
    const seconds = durationSeconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  const initiateRollback = async () => {
    if (!selectedEnvironment || !selectedApp || !selectedTarget || !rollbackReason.trim()) {
      alert('Please fill in all required fields');
      return;
    }

    if (!confirm(`Are you sure you want to rollback ${selectedApp} in ${selectedEnvironment}? This action cannot be undone.`)) {
      return;
    }

    try {
      setInitiatingRollback(true);
      const response = await fetch('/api/admin/deployment/rollback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
        },
        body: JSON.stringify({
          target_deployment_id: selectedTarget,
          environment: selectedEnvironment,
          app: selectedApp,
          reason: rollbackReason,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to initiate rollback');
      }

      // Reset form
      setSelectedEnvironment('');
      setSelectedApp('');
      setSelectedTarget('');
      setRollbackReason('');
      
      // Refresh data
      fetchRollbackData();
      
      alert('Rollback initiated successfully');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to initiate rollback');
    } finally {
      setInitiatingRollback(false);
    }
  };

  const cancelRollback = async (rollbackId: string) => {
    if (!confirm('Are you sure you want to cancel this rollback?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/deployment/rollback/${rollbackId}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to cancel rollback');
      }

      fetchRollbackData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to cancel rollback');
    }
  };

  // Filter deployment history for rollback targets
  const rollbackTargets = deploymentHistory.filter(
    deployment => 
      deployment.rollback_target && 
      deployment.status === 'success' &&
      (!selectedEnvironment || deployment.environment_id === selectedEnvironment) &&
      (!selectedApp || deployment.app_name === selectedApp)
  );

  // Get unique environments and apps
  const environments = [...new Set(deploymentHistory.map(d => d.environment_id))];
  const apps = [...new Set(deploymentHistory.map(d => d.app_name))];

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Rollback Manager</CardTitle>
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
      {/* Initiate Rollback Form */}
      <Card>
        <CardHeader>
          <CardTitle>Initiate Rollback</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Environment
              </label>
              <Select value={selectedEnvironment} onValueChange={setSelectedEnvironment}>
                <SelectTrigger>
                  <SelectValue placeholder="Select environment" />
                </SelectTrigger>
                <SelectContent>
                  {environments.map(env => (
                    <SelectItem key={env} value={env}>{env}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Application
              </label>
              <Select value={selectedApp} onValueChange={setSelectedApp}>
                <SelectTrigger>
                  <SelectValue placeholder="Select application" />
                </SelectTrigger>
                <SelectContent>
                  {apps.map(app => (
                    <SelectItem key={app} value={app}>{app}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rollback Target
              </label>
              <Select value={selectedTarget} onValueChange={setSelectedTarget}>
                <SelectTrigger>
                  <SelectValue placeholder="Select target deployment" />
                </SelectTrigger>
                <SelectContent>
                  {rollbackTargets.map(deployment => (
                    <SelectItem key={deployment.deployment_id} value={deployment.deployment_id}>
                      {deployment.commit_sha.substring(0, 8)} - {deployment.branch} 
                      ({new Date(deployment.started_at).toLocaleDateString()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rollback Reason
            </label>
            <Textarea
              value={rollbackReason}
              onChange={(e) => setRollbackReason(e.target.value)}
              placeholder="Enter reason for rollback (required)"
              rows={3}
            />
          </div>
          
          <Button
            onClick={initiateRollback}
            disabled={initiatingRollback || !selectedEnvironment || !selectedApp || !selectedTarget || !rollbackReason.trim()}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            {initiatingRollback ? 'Initiating...' : 'Initiate Rollback'}
          </Button>
        </CardContent>
      </Card>

      {/* Rollback Operations */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Rollback Operations</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchRollbackData}
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
            {rollbacks.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No rollback operations found</p>
            ) : (
              rollbacks.map((rollback) => (
                <div
                  key={rollback.rollback_id}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(rollback.status)}
                      <div>
                        <h4 className="font-medium">
                          {rollback.app} - {rollback.environment}
                        </h4>
                        <p className="text-sm text-gray-500">
                          Initiated by {rollback.admin_username}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className={getStatusColor(rollback.status)}>
                        {rollback.status}
                      </Badge>
                      {rollback.status === 'in_progress' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => cancelRollback(rollback.rollback_id)}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Duration</p>
                      <p className="font-medium">
                        {rollback.status === 'in_progress' 
                          ? `${Math.floor((Date.now() - new Date(rollback.started_at).getTime()) / 1000)}s (ongoing)`
                          : formatDuration(rollback.duration_seconds)
                        }
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Started</p>
                      <p className="font-medium">{new Date(rollback.started_at).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Target Deployment</p>
                      <p className="font-mono text-xs">{rollback.target_deployment_id}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Rollback ID</p>
                      <p className="font-mono text-xs">{rollback.rollback_id}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500 mb-1">Reason:</p>
                    <p className="text-sm bg-gray-50 p-2 rounded border">{rollback.reason}</p>
                  </div>

                  <div className="flex items-center space-x-2">
                    {rollback.logs_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(rollback.logs_url, '_blank')}
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        View Logs
                      </Button>
                    )}
                    {rollback.rollback_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(rollback.rollback_url, '_blank')}
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        View Deployment
                      </Button>
                    )}
                  </div>

                  {rollback.status === 'in_progress' && (
                    <div className="bg-yellow-100 border border-yellow-200 rounded-md p-3">
                      <p className="text-yellow-800 text-sm">
                        <Clock className="w-4 h-4 inline mr-1" />
                        Rollback in progress. Target completion within 15 minutes.
                      </p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Deployment History */}
      <Card>
        <CardHeader>
          <CardTitle>Available Rollback Targets</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {rollbackTargets.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No rollback targets available</p>
            ) : (
              rollbackTargets.map((deployment) => (
                <div
                  key={deployment.deployment_id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <h4 className="font-medium">
                      {deployment.app_name} - {deployment.environment_id}
                    </h4>
                    <p className="text-sm text-gray-500">
                      {deployment.commit_sha.substring(0, 8)} - {deployment.branch}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-medium">{new Date(deployment.started_at).toLocaleDateString()}</p>
                    <Badge className="bg-green-100 text-green-800">
                      Available
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}