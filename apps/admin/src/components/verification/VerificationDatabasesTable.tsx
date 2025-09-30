'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@vocilia/ui';
import { Button } from '@vocilia/ui';
import { Badge } from '@vocilia/ui';
import { Input } from '@vocilia/ui';
import { 
  Database,
  Download,
  Upload,
  Calendar,
  Store,
  Users,
  AlertTriangle,
  CheckCircle,
  Clock,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  FileText,
  Eye
} from 'lucide-react';

interface VerificationDatabase {
  id: string;
  cycle_id: string;
  store_id: string;
  store_name: string;
  business_name: string;
  transaction_count: number;
  status: 'preparing' | 'ready' | 'downloaded' | 'submitted' | 'processed' | 'expired';
  deadline_at: string;
  prepared_at?: string;
  downloaded_at?: string;
  submitted_at?: string;
  processed_at?: string;
  verification_results?: {
    verified_count: number;
    fake_count: number;
    total_rewards: number;
  };
  file_exports?: {
    csv_url?: string;
    excel_url?: string;
    json_url?: string;
  };
  submitted_file_url?: string;
  created_at: string;
}

interface VerificationDatabasesTableProps {
  cycleId?: string;
  onDatabaseSelect?: (database: VerificationDatabase) => void;
}

export default function VerificationDatabasesTable({ cycleId, onDatabaseSelect }: VerificationDatabasesTableProps) {
  const [databases, setDatabases] = useState<VerificationDatabase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [processingDatabase, setProcessingDatabase] = useState<string | null>(null);

  useEffect(() => {
    fetchDatabases();
  }, [cycleId]);

  const fetchDatabases = async () => {
    try {
      setLoading(true);
      const url = cycleId 
        ? `/api/admin/verification/cycles/${cycleId}/databases`
        : '/api/admin/verification/databases';
        
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch verification databases');
      }

      const data = await response.json();
      setDatabases(data.databases || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleProcessDatabase = async (databaseId: string) => {
    try {
      setProcessingDatabase(databaseId);
      const response = await fetch(`/api/admin/verification/databases/${databaseId}/process`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to process database');
      }

      // Refresh databases list
      await fetchDatabases();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process database');
    } finally {
      setProcessingDatabase(null);
    }
  };

  const filteredDatabases = databases.filter(db => {
    const matchesSearch = 
      db.store_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      db.business_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      db.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || db.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: VerificationDatabase['status']) => {
    switch (status) {
      case 'preparing':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-700"><RefreshCw className="w-3 h-3 mr-1" />Preparing</Badge>;
      case 'ready':
        return <Badge variant="default" className="bg-green-100 text-green-700"><CheckCircle className="w-3 h-3 mr-1" />Ready</Badge>;
      case 'downloaded':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-700"><Download className="w-3 h-3 mr-1" />Downloaded</Badge>;
      case 'submitted':
        return <Badge variant="default" className="bg-purple-100 text-purple-700"><Upload className="w-3 h-3 mr-1" />Submitted</Badge>;
      case 'processed':
        return <Badge variant="default" className="bg-green-100 text-green-700"><CheckCircle className="w-3 h-3 mr-1" />Processed</Badge>;
      case 'expired':
        return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" />Expired</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getDaysUntilDeadline = (deadline: string) => {
    const deadlineDate = new Date(deadline);
    const now = new Date();
    const diffTime = deadlineDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getDeadlineStatus = (deadline: string) => {
    const days = getDaysUntilDeadline(deadline);
    if (days < 0) return { color: 'text-red-600', text: `${Math.abs(days)} days overdue` };
    if (days === 0) return { color: 'text-red-600', text: 'Due today' };
    if (days === 1) return { color: 'text-orange-600', text: 'Due tomorrow' };
    if (days <= 2) return { color: 'text-orange-600', text: `${days} days left` };
    return { color: 'text-gray-600', text: `${days} days left` };
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          Loading verification databases...
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
            <p className="text-red-600 mb-2">{error}</p>
            <Button onClick={fetchDatabases} variant="outline" size="sm">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Verification Databases</h2>
          <p className="text-gray-600">
            {cycleId ? 'Databases for this verification cycle' : 'All verification databases across cycles'}
          </p>
        </div>
        <Button onClick={fetchDatabases} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search by store name, business, or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="all">All Status</option>
            <option value="preparing">Preparing</option>
            <option value="ready">Ready</option>
            <option value="downloaded">Downloaded</option>
            <option value="submitted">Submitted</option>
            <option value="processed">Processed</option>
            <option value="expired">Expired</option>
          </select>
        </div>
      </div>

      {/* Statistics Summary */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        {['preparing', 'ready', 'downloaded', 'submitted', 'processed', 'expired'].map((status) => {
          const count = filteredDatabases.filter(db => db.status === status).length;
          return (
            <Card key={status}>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-gray-900">{count}</p>
                <p className="text-sm text-gray-600 capitalize">{status}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Databases Table */}
      <Card>
        <CardHeader>
          <CardTitle>Databases ({filteredDatabases.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredDatabases.length === 0 ? (
            <div className="text-center py-8">
              <Database className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">No verification databases found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Store</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Transactions</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Deadline</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Progress</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDatabases.map((database) => {
                    const deadlineStatus = getDeadlineStatus(database.deadline_at);
                    
                    return (
                      <tr 
                        key={database.id} 
                        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                        onClick={() => onDatabaseSelect?.(database)}
                      >
                        <td className="py-4 px-4">
                          <div>
                            <p className="font-medium text-gray-900">{database.store_name}</p>
                            <p className="text-sm text-gray-600">{database.business_name}</p>
                            <p className="text-xs text-gray-500">ID: {database.id.slice(0, 8)}...</p>
                          </div>
                        </td>
                        
                        <td className="py-4 px-4">
                          {getStatusBadge(database.status)}
                        </td>
                        
                        <td className="py-4 px-4">
                          <div className="flex items-center">
                            <Users className="w-4 h-4 text-gray-400 mr-2" />
                            <span className="font-medium">{database.transaction_count.toLocaleString()}</span>
                          </div>
                          {database.verification_results && (
                            <div className="text-sm text-gray-600 mt-1">
                              <span className="text-green-600">{database.verification_results.verified_count} verified</span>
                              {database.verification_results.fake_count > 0 && (
                                <>, <span className="text-red-600">{database.verification_results.fake_count} fake</span></>
                              )}
                            </div>
                          )}
                        </td>
                        
                        <td className="py-4 px-4">
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                            <div>
                              <p className="text-sm">{formatDate(database.deadline_at)}</p>
                              <p className={`text-xs ${deadlineStatus.color}`}>{deadlineStatus.text}</p>
                            </div>
                          </div>
                        </td>
                        
                        <td className="py-4 px-4">
                          <div className="space-y-1">
                            {database.prepared_at && (
                              <div className="flex items-center text-xs text-gray-600">
                                <CheckCircle className="w-3 h-3 text-green-500 mr-1" />
                                Prepared {formatDate(database.prepared_at)}
                              </div>
                            )}
                            {database.downloaded_at && (
                              <div className="flex items-center text-xs text-gray-600">
                                <Download className="w-3 h-3 text-blue-500 mr-1" />
                                Downloaded {formatDate(database.downloaded_at)}
                              </div>
                            )}
                            {database.submitted_at && (
                              <div className="flex items-center text-xs text-gray-600">
                                <Upload className="w-3 h-3 text-purple-500 mr-1" />
                                Submitted {formatDate(database.submitted_at)}
                              </div>
                            )}
                            {database.verification_results && (
                              <div className="text-xs text-green-600 font-medium">
                                {formatCurrency(database.verification_results.total_rewards)} rewards
                              </div>
                            )}
                          </div>
                        </td>
                        
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            {database.status === 'submitted' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleProcessDatabase(database.id);
                                }}
                                disabled={processingDatabase === database.id}
                              >
                                {processingDatabase === database.id ? (
                                  <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : (
                                  <>
                                    <CheckCircle className="w-4 h-4 mr-1" />
                                    Process
                                  </>
                                )}
                              </Button>
                            )}
                            
                            {database.file_exports && (
                              <div className="flex gap-1">
                                {database.file_exports.csv_url && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      window.open(database.file_exports!.csv_url, '_blank');
                                    }}
                                    title="Download CSV"
                                  >
                                    <FileText className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            )}
                            
                            {database.submitted_file_url && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(database.submitted_file_url, '_blank');
                                }}
                                title="View Submitted File"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            )}
                            
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDatabaseSelect?.(database);
                              }}
                              title="View Details"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}