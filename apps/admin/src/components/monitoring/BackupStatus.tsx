'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Database, Download, Shield, Clock, CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';

interface BackupRecord {
  backup_id: string;
  database_name: string;
  backup_type: 'daily' | 'weekly' | 'monthly' | 'manual';
  backup_size: number;
  backup_location: string;
  backup_status: 'in_progress' | 'completed' | 'failed' | 'expired';
  created_at: string;
  expires_at: string;
  restore_point: boolean;
  checksum: string;
}

interface BackupSummary {
  total_backups: number;
  latest_backup: string;
  total_size: number;
  retention_compliance: boolean;
  last_restore_test: string;
  next_backup: string;
}

export default function BackupStatus() {
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [summary, setSummary] = useState<BackupSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('all');

  const fetchBackupStatus = async () => {
    try {
      setRefreshing(true);
      const response = await fetch('/api/admin/monitoring/backups', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch backup status');
      }

      const data = await response.json();
      setBackups(data.backups || []);
      setSummary(data.summary || null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBackupStatus();
    // Refresh every 5 minutes
    const interval = setInterval(fetchBackupStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: BackupRecord['backup_status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'in_progress':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'expired':
        return <AlertTriangle className="w-4 h-4 text-gray-500" />;
      default:
        return <Database className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: BackupRecord['backup_status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'expired':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeColor = (type: BackupRecord['backup_type']) => {
    switch (type) {
      case 'daily':
        return 'bg-blue-100 text-blue-800';
      case 'weekly':
        return 'bg-purple-100 text-purple-800';
      case 'monthly':
        return 'bg-indigo-100 text-indigo-800';
      case 'manual':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatSize = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const isExpiringSoon = (expiresAt: string) => {
    const expiry = new Date(expiresAt);
    const now = new Date();
    const daysUntilExpiry = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return daysUntilExpiry <= 7; // Expiring within 7 days
  };

  const initiateBackup = async (type: 'manual' | 'daily') => {
    try {
      const response = await fetch('/api/admin/monitoring/backup/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
        },
        body: JSON.stringify({
          backup_type: type,
          reason: `Manual ${type} backup from admin dashboard`,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to initiate backup');
      }

      // Refresh backup status
      fetchBackupStatus();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to initiate backup');
    }
  };

  const initiateRestore = async (backupId: string) => {
    if (!confirm('Are you sure you want to initiate a restore? This will affect the staging environment.')) {
      return;
    }

    try {
      const response = await fetch('/api/admin/monitoring/backup/restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
        },
        body: JSON.stringify({
          backup_id: backupId,
          target_environment: 'staging',
          reason: 'Restore test from admin dashboard',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to initiate restore');
      }

      alert('Restore initiated successfully');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to initiate restore');
    }
  };

  const filteredBackups = selectedType === 'all' 
    ? backups 
    : backups.filter(backup => backup.backup_type === selectedType);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Backup Status</CardTitle>
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
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Backups</p>
                  <p className="text-2xl font-bold text-blue-600">{summary.total_backups}</p>
                </div>
                <Database className="w-5 h-5 text-gray-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Size</p>
                  <p className="text-2xl font-bold text-purple-600">{formatSize(summary.total_size)}</p>
                </div>
                <Shield className="w-5 h-5 text-gray-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Latest Backup</p>
                  <p className="text-sm font-bold text-green-600">
                    {new Date(summary.latest_backup).toLocaleDateString()}
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
                  <p className="text-sm font-medium text-gray-600">Retention Status</p>
                  <Badge className={summary.retention_compliance ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                    {summary.retention_compliance ? 'Compliant' : 'Non-compliant'}
                  </Badge>
                </div>
                <Clock className="w-5 h-5 text-gray-400" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Controls */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Backup Status</CardTitle>
          <div className="flex items-center space-x-2">
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => initiateBackup('manual')}
            >
              <Database className="w-4 h-4 mr-2" />
              Manual Backup
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchBackupStatus}
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
                <XCircle className="w-5 h-5 text-red-400 mr-2" />
                <p className="text-red-800">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Backup List */}
      <Card>
        <CardHeader>
          <CardTitle>Backup Records</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredBackups.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No backups found for selected filter</p>
            ) : (
              filteredBackups.map((backup) => (
                <div
                  key={backup.backup_id}
                  className={`border rounded-lg p-4 space-y-3 ${
                    isExpiringSoon(backup.expires_at) ? 'border-yellow-200 bg-yellow-50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(backup.backup_status)}
                      <div>
                        <h4 className="font-medium">{backup.database_name}</h4>
                        <p className="text-sm text-gray-500">
                          {backup.backup_location}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className={getTypeColor(backup.backup_type)}>
                        {backup.backup_type}
                      </Badge>
                      <Badge className={getStatusColor(backup.backup_status)}>
                        {backup.backup_status}
                      </Badge>
                      {backup.restore_point && (
                        <Badge variant="outline">
                          Restore Point
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Size</p>
                      <p className="font-medium">{formatSize(backup.backup_size)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Created</p>
                      <p className="font-medium">{new Date(backup.created_at).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Expires</p>
                      <p className={`font-medium ${isExpiringSoon(backup.expires_at) ? 'text-yellow-600' : ''}`}>
                        {new Date(backup.expires_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Checksum</p>
                      <p className="font-mono text-xs">{backup.checksum.substring(0, 8)}...</p>
                    </div>
                  </div>

                  {backup.backup_status === 'completed' && backup.restore_point && (
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => initiateRestore(backup.backup_id)}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Test Restore
                      </Button>
                    </div>
                  )}

                  {isExpiringSoon(backup.expires_at) && (
                    <div className="bg-yellow-100 border border-yellow-200 rounded-md p-3">
                      <p className="text-yellow-800 text-sm">
                        <AlertTriangle className="w-4 h-4 inline mr-1" />
                        This backup expires soon. Consider creating a new backup if needed.
                      </p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}