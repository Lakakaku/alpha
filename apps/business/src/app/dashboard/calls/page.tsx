'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@vocilia/ui';
import { Badge } from '@vocilia/ui';
import { CallSessionCard } from '../../../components/calls/CallSessionCard';
import { 
  Phone, 
  Clock, 
  CheckCircle, 
  XCircle, 
  DollarSign,
  TrendingUp,
  Users,
  MessageSquare,
  Filter,
  Download,
  RefreshCw
} from 'lucide-react';

interface CallSession {
  id: string;
  status: 'initiated' | 'connecting' | 'in_progress' | 'completed' | 'failed' | 'timeout';
  customerPhone: string;
  startedAt: string;
  duration?: number;
  actualCost?: number;
  estimatedCost: number;
  providerId?: string;
  questionsAnswered: number;
  totalQuestions: number;
  error?: string;
}

interface CallStats {
  totalCalls: number;
  activeCalls: number;
  completedCalls: number;
  failedCalls: number;
  totalCost: number;
  averageDuration: number;
  successRate: number;
  questionsAnswered: number;
}

export default function CallsDashboard() {
  const [sessions, setSessions] = useState<CallSession[]>([]);
  const [stats, setStats] = useState<CallStats>({
    totalCalls: 0,
    activeCalls: 0,
    completedCalls: 0,
    failedCalls: 0,
    totalCost: 0,
    averageDuration: 0,
    successRate: 0,
    questionsAnswered: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'failed'>('all');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Mock data for demonstration
  useEffect(() => {
    loadCallData();
    
    if (autoRefresh) {
      const interval = setInterval(loadCallData, 5000); // Refresh every 5 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const loadCallData = async () => {
    try {
      // Mock API call - in real implementation, this would call your backend
      const mockSessions: CallSession[] = [
        {
          id: '1',
          status: 'completed',
          customerPhone: '+46761234567',
          startedAt: new Date(Date.now() - 300000).toISOString(),
          duration: 87,
          actualCost: 0.15,
          estimatedCost: 0.12,
          providerId: 'fortyelks',
          questionsAnswered: 3,
          totalQuestions: 3
        },
        {
          id: '2',
          status: 'in_progress',
          customerPhone: '+46762345678',
          startedAt: new Date(Date.now() - 45000).toISOString(),
          duration: 45,
          estimatedCost: 0.10,
          providerId: 'fortyelks',
          questionsAnswered: 1,
          totalQuestions: 3
        },
        {
          id: '3',
          status: 'failed',
          customerPhone: '+46763456789',
          startedAt: new Date(Date.now() - 600000).toISOString(),
          estimatedCost: 0.12,
          providerId: 'twilio',
          questionsAnswered: 0,
          totalQuestions: 3,
          error: 'Customer did not answer'
        },
        {
          id: '4',
          status: 'completed',
          customerPhone: '+46764567890',
          startedAt: new Date(Date.now() - 900000).toISOString(),
          duration: 125,
          actualCost: 0.18,
          estimatedCost: 0.12,
          providerId: 'fortyelks',
          questionsAnswered: 4,
          totalQuestions: 4
        }
      ];

      setSessions(mockSessions);

      // Calculate stats
      const activeCalls = mockSessions.filter(s => ['initiated', 'connecting', 'in_progress'].includes(s.status)).length;
      const completedCalls = mockSessions.filter(s => s.status === 'completed').length;
      const failedCalls = mockSessions.filter(s => ['failed', 'timeout'].includes(s.status)).length;
      const totalCost = mockSessions.reduce((sum, s) => sum + (s.actualCost || 0), 0);
      const completedSessions = mockSessions.filter(s => s.duration);
      const averageDuration = completedSessions.length > 0 
        ? completedSessions.reduce((sum, s) => sum + (s.duration || 0), 0) / completedSessions.length 
        : 0;
      const successRate = mockSessions.length > 0 ? (completedCalls / mockSessions.length) * 100 : 0;
      const questionsAnswered = mockSessions.reduce((sum, s) => sum + s.questionsAnswered, 0);

      setStats({
        totalCalls: mockSessions.length,
        activeCalls,
        completedCalls,
        failedCalls,
        totalCost,
        averageDuration,
        successRate,
        questionsAnswered
      });

      setIsLoading(false);
    } catch (error) {
      console.error('Failed to load call data:', error);
      setIsLoading(false);
    }
  };

  const filteredSessions = sessions.filter(session => {
    switch (filter) {
      case 'active':
        return ['initiated', 'connecting', 'in_progress'].includes(session.status);
      case 'completed':
        return session.status === 'completed';
      case 'failed':
        return ['failed', 'timeout'].includes(session.status);
      default:
        return true;
    }
  });

  const handleViewDetails = (sessionId: string) => {
    // Navigate to call details page
    window.open(`/dashboard/calls/${sessionId}`, '_blank');
  };

  const handleRetryCall = (sessionId: string) => {
    // Implement retry logic
    console.log('Retry call:', sessionId);
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`;
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Samtalsöversikt</h1>
          <p className="text-gray-600">Hantera och övervaka dina AI-samtal</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-2 text-sm font-medium rounded-md border transition-colors ${
              autoRefresh 
                ? 'bg-green-50 text-green-700 border-green-200' 
                : 'bg-gray-50 text-gray-700 border-gray-200'
            }`}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto-uppdatering
          </button>
          
          <button
            onClick={loadCallData}
            className="px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Uppdatera
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Totalt antal samtal</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCalls}</div>
            <div className="text-xs text-muted-foreground">
              {stats.activeCalls} aktiva samtal
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Framgångsgrad</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.successRate.toFixed(1)}%</div>
            <div className="text-xs text-muted-foreground">
              {stats.completedCalls} / {stats.totalCalls} slutförda
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total kostnad</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalCost)}</div>
            <div className="text-xs text-muted-foreground">
              ø {stats.totalCalls > 0 ? formatCurrency(stats.totalCost / stats.totalCalls) : '$0.00'} per samtal
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Besvarade frågor</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.questionsAnswered}</div>
            <div className="text-xs text-muted-foreground">
              ø {formatDuration(stats.averageDuration)} per samtal
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Samtalshistorik</CardTitle>
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1">
                <Filter className="h-4 w-4 text-gray-600" />
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as any)}
                  className="text-sm border border-gray-300 rounded-md px-2 py-1"
                >
                  <option value="all">Alla samtal</option>
                  <option value="active">Aktiva</option>
                  <option value="completed">Slutförda</option>
                  <option value="failed">Misslyckade</option>
                </select>
              </div>
              
              <button className="px-3 py-1 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors">
                <Download className="h-4 w-4 mr-1" />
                Exportera
              </button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {filteredSessions.length === 0 ? (
            <div className="text-center py-8">
              <Phone className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Inga samtal hittades</h3>
              <p className="text-gray-600">
                {filter === 'all' 
                  ? 'Starta ditt första AI-samtal från QR-koder eller manuellt.'
                  : `Inga ${filter} samtal hittades.`
                }
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredSessions.map((session) => (
                <CallSessionCard
                  key={session.id}
                  session={session}
                  onViewDetails={handleViewDetails}
                  onRetryCall={handleRetryCall}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Snabbåtgärder</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button className="p-4 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <Phone className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <div className="font-medium">Starta manuellt samtal</div>
                  <div className="text-sm text-gray-600">Ring direkt till en kund</div>
                </div>
              </div>
            </button>

            <button className="p-4 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <MessageSquare className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <div className="font-medium">Hantera frågor</div>
                  <div className="text-sm text-gray-600">Redigera frågeformulär</div>
                </div>
              </div>
            </button>

            <button className="p-4 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <TrendingUp className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <div className="font-medium">Visa rapporter</div>
                  <div className="text-sm text-gray-600">Detaljerad analys</div>
                </div>
              </div>
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}