'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Calendar,
  Database,
  DollarSign,
  Users,
  AlertCircle,
  CheckCircle,
  Clock,
  Play,
  RefreshCw,
  Search,
  Filter
} from 'lucide-react';

interface VerificationCycle {
  id: string;
  week_starting: string;
  week_ending: string;
  status: 'pending' | 'preparing' | 'active' | 'completed' | 'failed';
  total_databases: number;
  prepared_databases: number;
  submitted_databases: number;
  total_transactions: number;
  verified_transactions: number;
  fake_transactions: number;
  total_rewards: number;
  total_invoices: number;
  paid_invoices: number;
  created_at: string;
  prepared_at?: string;
  completed_at?: string;
}

interface VerificationCyclesListProps {
  onCycleSelect?: (cycle: VerificationCycle) => void;
  selectedCycleId?: string;
}

export default function VerificationCyclesList({ onCycleSelect, selectedCycleId }: VerificationCyclesListProps) {
  const [cycles, setCycles] = useState<VerificationCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [preparingCycle, setPreparingCycle] = useState<string | null>(null);

  useEffect(() => {
    fetchCycles();
  }, []);

  const fetchCycles = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/verification/cycles', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch verification cycles');
      }

      const data = await response.json();
      setCycles(data.cycles || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleStartPreparation = async (cycleId: string) => {
    try {
      setPreparingCycle(cycleId);
      const response = await fetch(`/api/admin/verification/cycles/${cycleId}/prepare`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to start preparation');
      }

      // Refresh cycles list
      await fetchCycles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start preparation');
    } finally {
      setPreparingCycle(null);
    }
  };

  const filteredCycles = cycles.filter(cycle => {
    const matchesSearch = cycle.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cycle.week_starting.includes(searchTerm) ||
      cycle.week_ending.includes(searchTerm);
    
    const matchesStatus = statusFilter === 'all' || cycle.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: VerificationCycle['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="bg-gray-100 text-gray-700"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'preparing':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-700"><RefreshCw className="w-3 h-3 mr-1 animate-spin" />Preparing</Badge>;
      case 'active':
        return <Badge variant="default" className="bg-orange-100 text-orange-700"><Play className="w-3 h-3 mr-1" />Active</Badge>;
      case 'completed':
        return <Badge variant="default" className="bg-green-100 text-green-700"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getCompletionRate = (cycle: VerificationCycle) => {
    if (cycle.total_databases === 0) return 0;
    return Math.round((cycle.submitted_databases / cycle.total_databases) * 100);
  };

  const getVerificationRate = (cycle: VerificationCycle) => {
    if (cycle.total_transactions === 0) return 0;
    return Math.round((cycle.verified_transactions / cycle.total_transactions) * 100);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          Loading verification cycles...
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
            <p className="text-red-600 mb-2">{error}</p>
            <Button onClick={fetchCycles} variant="outline" size="sm">
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
          <h2 className="text-2xl font-bold text-gray-900">Verification Cycles</h2>
          <p className="text-gray-600">Manage weekly verification cycles and database preparation</p>
        </div>
        <Button onClick={fetchCycles} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search cycles..."
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
            <option value="pending">Pending</option>
            <option value="preparing">Preparing</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {/* Cycles List */}
      <div className="grid gap-4">
        {filteredCycles.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center h-32">
              <div className="text-center text-gray-500">
                <Calendar className="w-8 h-8 mx-auto mb-2" />
                <p>No verification cycles found</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredCycles.map((cycle) => (
            <Card 
              key={cycle.id} 
              className={`cursor-pointer transition-all hover:shadow-md ${
                selectedCycleId === cycle.id ? 'ring-2 ring-blue-500 bg-blue-50' : ''
              }`}
              onClick={() => onCycleSelect?.(cycle)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      Week {formatDate(cycle.week_starting)} - {formatDate(cycle.week_ending)}
                    </CardTitle>
                    <p className="text-sm text-gray-600 mt-1">Cycle ID: {cycle.id.slice(0, 8)}...</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(cycle.status)}
                    {cycle.status === 'pending' && (
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartPreparation(cycle.id);
                        }}
                        disabled={preparingCycle === cycle.id}
                      >
                        {preparingCycle === cycle.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Play className="w-4 h-4 mr-1" />
                            Start Preparation
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Databases */}
                  <div className="flex items-center space-x-2">
                    <Database className="w-4 h-4 text-blue-500" />
                    <div>
                      <p className="text-sm font-medium">{cycle.submitted_databases}/{cycle.total_databases}</p>
                      <p className="text-xs text-gray-600">Databases ({getCompletionRate(cycle)}%)</p>
                    </div>
                  </div>

                  {/* Transactions */}
                  <div className="flex items-center space-x-2">
                    <Users className="w-4 h-4 text-green-500" />
                    <div>
                      <p className="text-sm font-medium">{cycle.verified_transactions.toLocaleString()}</p>
                      <p className="text-xs text-gray-600">Verified ({getVerificationRate(cycle)}%)</p>
                    </div>
                  </div>

                  {/* Rewards */}
                  <div className="flex items-center space-x-2">
                    <DollarSign className="w-4 h-4 text-yellow-500" />
                    <div>
                      <p className="text-sm font-medium">{formatCurrency(cycle.total_rewards)}</p>
                      <p className="text-xs text-gray-600">Total Rewards</p>
                    </div>
                  </div>

                  {/* Payment Status */}
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-purple-500" />
                    <div>
                      <p className="text-sm font-medium">{cycle.paid_invoices}/{cycle.total_invoices}</p>
                      <p className="text-xs text-gray-600">Paid Invoices</p>
                    </div>
                  </div>
                </div>

                {/* Progress Bars */}
                <div className="mt-4 space-y-2">
                  <div>
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>Database Submission Progress</span>
                      <span>{getCompletionRate(cycle)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full transition-all"
                        style={{ width: `${getCompletionRate(cycle)}%` }}
                      />
                    </div>
                  </div>

                  {cycle.total_transactions > 0 && (
                    <div>
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>Verification Rate</span>
                        <span>{getVerificationRate(cycle)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-500 h-2 rounded-full transition-all"
                          style={{ width: `${getVerificationRate(cycle)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Timestamps */}
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Created: {formatDate(cycle.created_at)}</span>
                    {cycle.completed_at && (
                      <span>Completed: {formatDate(cycle.completed_at)}</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}