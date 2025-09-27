'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Save,
  AlertCircle
} from 'lucide-react';

interface VerificationRecord {
  id: string;
  transaction_time: string;
  transaction_value: number;
  verification_status: 'pending' | 'verified' | 'fake';
  reward_percentage?: number;
  reward_amount?: number;
}

interface VerificationRecordsTableProps {
  databaseId: string;
  readOnly?: boolean;
  onRecordsUpdate?: (updatedCount: number) => void;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export function VerificationRecordsTable({ 
  databaseId, 
  readOnly = false,
  onRecordsUpdate 
}: VerificationRecordsTableProps) {
  const [records, setRecords] = useState<VerificationRecord[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 50,
    total: 0,
    total_pages: 0
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<'verified' | 'fake' | null>(null);

  useEffect(() => {
    loadRecords();
  }, [databaseId, pagination.page, statusFilter]);

  const loadRecords = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString()
      });

      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const response = await fetch(`/api/business/verification/databases/${databaseId}/records?${params}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('business_token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to load records: ${response.statusText}`);
      }

      const data = await response.json();
      setRecords(data.records);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Error loading records:', err);
      setError(err instanceof Error ? err.message : 'Failed to load verification records');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (recordId: string, newStatus: 'verified' | 'fake') => {
    if (readOnly) return;

    setRecords(prev => prev.map(record => 
      record.id === recordId 
        ? { ...record, verification_status: newStatus }
        : record
    ));
  };

  const handleSelectRecord = (recordId: string, selected: boolean) => {
    setSelectedRecords(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(recordId);
      } else {
        newSet.delete(recordId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedRecords(new Set(records.map(r => r.id)));
    } else {
      setSelectedRecords(new Set());
    }
  };

  const handleBulkAction = (action: 'verified' | 'fake') => {
    if (readOnly || selectedRecords.size === 0) return;

    setRecords(prev => prev.map(record => 
      selectedRecords.has(record.id)
        ? { ...record, verification_status: action }
        : record
    ));

    setSelectedRecords(new Set());
  };

  const handleSaveChanges = async () => {
    if (readOnly) return;

    try {
      setSaving(true);
      setError(null);

      const changedRecords = records
        .filter(record => record.verification_status !== 'pending')
        .map(record => ({
          record_id: record.id,
          verification_status: record.verification_status
        }));

      if (changedRecords.length === 0) {
        setError('No changes to save');
        return;
      }

      const response = await fetch(`/api/business/verification/databases/${databaseId}/records`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('business_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ records: changedRecords })
      });

      if (!response.ok) {
        throw new Error(`Failed to save changes: ${response.statusText}`);
      }

      const result = await response.json();
      onRecordsUpdate?.(result.updated_count);
      
      // Reload to get updated data
      await loadRecords();

    } catch (err) {
      console.error('Error saving changes:', err);
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: VerificationRecord['verification_status']) => {
    const config = {
      pending: { label: 'Pending', variant: 'secondary' as const, icon: Clock, color: 'text-gray-600' },
      verified: { label: 'Verified', variant: 'default' as const, icon: CheckCircle, color: 'text-green-600' },
      fake: { label: 'Fake', variant: 'destructive' as const, icon: XCircle, color: 'text-red-600' }
    };

    const { label, variant, icon: Icon, color } = config[status];
    
    return (
      <Badge variant={variant} className="flex items-center gap-1">
        <Icon size={12} />
        {label}
      </Badge>
    );
  };

  const filteredRecords = records.filter(record => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        record.transaction_value.toString().includes(search) ||
        new Date(record.transaction_time).toLocaleDateString().includes(search)
      );
    }
    return true;
  });

  const getStatusCounts = () => {
    const counts = {
      total: records.length,
      verified: records.filter(r => r.verification_status === 'verified').length,
      fake: records.filter(r => r.verification_status === 'fake').length,
      pending: records.filter(r => r.verification_status === 'pending').length
    };
    return counts;
  };

  const statusCounts = getStatusCounts();

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Loading verification records...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{statusCounts.total}</div>
            <div className="text-sm text-gray-600">Total</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{statusCounts.verified}</div>
            <div className="text-sm text-gray-600">Verified</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{statusCounts.fake}</div>
            <div className="text-sm text-gray-600">Fake</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-gray-600">{statusCounts.pending}</div>
            <div className="text-sm text-gray-600">Pending</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transaction Records</CardTitle>
          <CardDescription>
            Review each transaction and mark as verified or fake. 
            {!readOnly && ' Changes are saved automatically.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert className="mb-4 border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-red-700">
                {error}
              </AlertDescription>
            </Alert>
          )}

          {/* Filters and Search */}
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by amount or date..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Records</SelectItem>
                <SelectItem value="pending">Pending Only</SelectItem>
                <SelectItem value="verified">Verified Only</SelectItem>
                <SelectItem value="fake">Fake Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Bulk Actions */}
          {!readOnly && selectedRecords.size > 0 && (
            <div className="flex items-center gap-2 mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
              <span className="text-sm font-medium text-blue-900">
                {selectedRecords.size} record{selectedRecords.size > 1 ? 's' : ''} selected
              </span>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleBulkAction('verified')}
              >
                Mark as Verified
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleBulkAction('fake')}
              >
                Mark as Fake
              </Button>
            </div>
          )}

          {/* Records Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  {!readOnly && (
                    <TableHead className="w-12">
                      <input
                        type="checkbox"
                        checked={selectedRecords.size === records.length && records.length > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="rounded"
                      />
                    </TableHead>
                  )}
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reward</TableHead>
                  {!readOnly && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((record) => (
                  <TableRow key={record.id}>
                    {!readOnly && (
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedRecords.has(record.id)}
                          onChange={(e) => handleSelectRecord(record.id, e.target.checked)}
                          className="rounded"
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="text-sm">
                        <div>{new Date(record.transaction_time).toLocaleDateString()}</div>
                        <div className="text-gray-500">{new Date(record.transaction_time).toLocaleTimeString()}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{record.transaction_value.toFixed(2)} kr</span>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(record.verification_status)}
                    </TableCell>
                    <TableCell>
                      {record.reward_amount ? (
                        <div className="text-sm">
                          <div className="font-medium">{record.reward_amount.toFixed(2)} kr</div>
                          <div className="text-gray-500">{record.reward_percentage}%</div>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    {!readOnly && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant={record.verification_status === 'verified' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => handleStatusChange(record.id, 'verified')}
                          >
                            Verified
                          </Button>
                          <Button
                            variant={record.verification_status === 'fake' ? 'destructive' : 'outline'}
                            size="sm"
                            onClick={() => handleStatusChange(record.id, 'fake')}
                          >
                            Fake
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-gray-600">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
              {pagination.total} records
            </p>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page <= 1}
              >
                <ChevronLeft size={16} />
                Previous
              </Button>
              
              <span className="text-sm px-3 py-1 bg-gray-100 rounded">
                Page {pagination.page} of {pagination.total_pages}
              </span>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page >= pagination.total_pages}
              >
                Next
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>

          {/* Save Button */}
          {!readOnly && (
            <div className="flex justify-end mt-4">
              <Button
                onClick={handleSaveChanges}
                disabled={saving || statusCounts.pending === statusCounts.total}
              >
                {saving ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Saving...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Save size={16} />
                    <span>Save Changes</span>
                  </div>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default VerificationRecordsTable;