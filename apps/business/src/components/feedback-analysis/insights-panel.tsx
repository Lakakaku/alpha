/**
 * Actionable Insights Panel Component
 * Feature: 008-step-2-6
 * 
 * Provides comprehensive insights management including status updates,
 * priority filtering, bulk operations, and team collaboration features.
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@vocilia/ui/components/card';
import { Button } from '@vocilia/ui/components/button';
import { Badge } from '@vocilia/ui/components/badge';
import { Checkbox } from '@vocilia/ui/components/checkbox';
import { Input } from '@vocilia/ui/components/input';
import { 
  AlertCircle,
  CheckCircle,
  Clock,
  User,
  Calendar,
  Filter,
  MoreHorizontal,
  ArrowUpDown,
  RefreshCw,
  Plus,
  Search,
  FileText,
  Users,
  Sparkles,
  X,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useAuth } from '@vocilia/auth/context/AuthContext';
import type { FeedbackInsight, InsightStatus, InsightPriority } from '@vocilia/types/feedback-analysis';

interface InsightsPanelProps {
  storeId: string;
  className?: string;
}

interface InsightsFilter {
  status: InsightStatus | 'all';
  priority: InsightPriority | 'all';
  department?: string;
  assigned_to?: string;
  search?: string;
}

interface InsightsSummary {
  total_count: number;
  pending_count: number;
  in_progress_count: number;
  completed_count: number;
  dismissed_count: number;
  critical_count: number;
  high_priority_count: number;
  overdue_count: number;
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'Alla status', color: 'gray' },
  { value: 'pending', label: 'Väntande', color: 'yellow' },
  { value: 'in_progress', label: 'Pågående', color: 'blue' },
  { value: 'completed', label: 'Slutförd', color: 'green' },
  { value: 'dismissed', label: 'Avvisad', color: 'gray' },
] as const;

const PRIORITY_OPTIONS = [
  { value: 'all', label: 'Alla prioriteter', color: 'gray' },
  { value: 'critical', label: 'Kritisk', color: 'red' },
  { value: 'high', label: 'Hög', color: 'orange' },
  { value: 'medium', label: 'Medium', color: 'yellow' },
  { value: 'low', label: 'Låg', color: 'green' },
] as const;

export function InsightsPanel({ storeId, className = '' }: InsightsPanelProps) {
  const { user } = useAuth();
  
  // State management
  const [insights, setInsights] = useState<FeedbackInsight[]>([]);
  const [summary, setSummary] = useState<InsightsSummary | null>(null);
  const [selectedInsights, setSelectedInsights] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [expandedInsights, setExpandedInsights] = useState<Set<string>>(new Set());
  
  // Filter and sort state
  const [filters, setFilters] = useState<InsightsFilter>({
    status: 'all',
    priority: 'all',
  });
  const [sortBy, setSortBy] = useState<'created_at' | 'updated_at' | 'priority' | 'due_date'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [pagination, setPagination] = useState({ limit: 20, offset: 0 });

  // Load insights data
  const loadInsights = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams({
        limit: pagination.limit.toString(),
        offset: pagination.offset.toString(),
        sort_by: sortBy,
        sort_order: sortOrder,
        ...(filters.status !== 'all' && { status: filters.status }),
        ...(filters.priority !== 'all' && { priority: filters.priority }),
        ...(filters.department && { department: filters.department }),
        ...(filters.assigned_to && { assigned_to: filters.assigned_to }),
      });

      const [insightsResponse, summaryResponse] = await Promise.all([
        fetch(`/api/feedback-analysis/insights/${storeId}?${queryParams}`, {
          headers: {
            'Authorization': `Bearer ${user?.access_token}`,
          },
        }),
        fetch(`/api/feedback-analysis/insights/${storeId}/summary`, {
          headers: {
            'Authorization': `Bearer ${user?.access_token}`,
          },
        }),
      ]);

      if (!insightsResponse.ok) {
        throw new Error('Kunde inte ladda insights');
      }

      const insightsData = await insightsResponse.json();
      setInsights(insightsData.insights || []);

      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json();
        setSummary(summaryData);
      }

    } catch (err) {
      console.error('Insights loading error:', err);
      setError(err instanceof Error ? err.message : 'Ett fel uppstod vid laddning av insights');
    } finally {
      setIsLoading(false);
    }
  };

  // Load data on mount and when dependencies change
  useEffect(() => {
    if (storeId && user?.access_token) {
      loadInsights();
    }
  }, [storeId, user?.access_token, filters, sortBy, sortOrder, pagination]);

  // Update insight status
  const updateInsightStatus = async (
    insightId: string, 
    status: InsightStatus,
    notes?: string,
    assignedTo?: string,
    dueDate?: string
  ) => {
    setIsUpdating(true);

    try {
      const response = await fetch(`/api/feedback-analysis/insights/${insightId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.access_token}`,
        },
        body: JSON.stringify({
          status,
          ...(notes && { notes }),
          ...(assignedTo && { assigned_to: assignedTo }),
          ...(dueDate && { due_date: dueDate }),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Kunde inte uppdatera insight-status');
      }

      // Reload insights to get updated data
      await loadInsights();

    } catch (err) {
      console.error('Status update error:', err);
      setError(err instanceof Error ? err.message : 'Ett fel uppstod vid statusuppdatering');
    } finally {
      setIsUpdating(false);
    }
  };

  // Bulk update selected insights
  const bulkUpdateStatus = async (status: InsightStatus, notes?: string) => {
    if (selectedInsights.length === 0) return;

    setIsUpdating(true);

    try {
      const response = await fetch('/api/feedback-analysis/insights/bulk/status', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.access_token}`,
        },
        body: JSON.stringify({
          insight_ids: selectedInsights,
          status_update: {
            status,
            ...(notes && { notes }),
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Kunde inte uppdatera insights');
      }

      setSelectedInsights([]);
      await loadInsights();

    } catch (err) {
      console.error('Bulk update error:', err);
      setError(err instanceof Error ? err.message : 'Ett fel uppstod vid bulk-uppdatering');
    } finally {
      setIsUpdating(false);
    }
  };

  // Toggle insight selection
  const toggleInsightSelection = (insightId: string) => {
    setSelectedInsights(prev => 
      prev.includes(insightId)
        ? prev.filter(id => id !== insightId)
        : [...prev, insightId]
    );
  };

  // Toggle insight expansion
  const toggleInsightExpansion = (insightId: string) => {
    setExpandedInsights(prev => {
      const newSet = new Set(prev);
      if (newSet.has(insightId)) {
        newSet.delete(insightId);
      } else {
        newSet.add(insightId);
      }
      return newSet;
    });
  };

  // Get priority color
  const getPriorityColor = (priority: InsightPriority) => {
    switch (priority) {
      case 'critical': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-white';
      case 'low': return 'bg-green-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  // Get status icon
  const getStatusIcon = (status: InsightStatus) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'in_progress': return <AlertCircle className="h-4 w-4 text-blue-600" />;
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'dismissed': return <X className="h-4 w-4 text-gray-600" />;
      default: return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-6"></div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Åtgärdsbara insights
              </CardTitle>
              <CardDescription>
                Hantera och följ upp AI-genererade förbättringsförslag
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2"
              >
                <Filter className="h-4 w-4" />
                Filter
                {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
              <Button
                variant="outline"
                onClick={loadInsights}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Uppdatera
              </Button>
            </div>
          </div>
        </CardHeader>
        
        {/* Summary Stats */}
        {summary && (
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-lg font-bold">{summary.total_count}</div>
                <div className="text-xs text-gray-600">Total</div>
              </div>
              <div className="text-center p-3 bg-yellow-50 rounded-lg">
                <div className="text-lg font-bold text-yellow-700">{summary.pending_count}</div>
                <div className="text-xs text-gray-600">Väntande</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-lg font-bold text-blue-700">{summary.in_progress_count}</div>
                <div className="text-xs text-gray-600">Pågående</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-lg font-bold text-green-700">{summary.completed_count}</div>
                <div className="text-xs text-gray-600">Slutförd</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <div className="text-lg font-bold text-red-700">{summary.critical_count}</div>
                <div className="text-xs text-gray-600">Kritisk</div>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <div className="text-lg font-bold text-orange-700">{summary.overdue_count}</div>
                <div className="text-xs text-gray-600">Försenad</div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filter och sortering</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Status Filter */}
              <div>
                <label className="text-sm font-medium mb-2 block">Status</label>
                <div className="flex flex-wrap gap-1">
                  {STATUS_OPTIONS.map((option) => (
                    <Button
                      key={option.value}
                      variant={filters.status === option.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFilters(prev => ({ ...prev, status: option.value }))}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Priority Filter */}
              <div>
                <label className="text-sm font-medium mb-2 block">Prioritet</label>
                <div className="flex flex-wrap gap-1">
                  {PRIORITY_OPTIONS.map((option) => (
                    <Button
                      key={option.value}
                      variant={filters.priority === option.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFilters(prev => ({ ...prev, priority: option.value }))}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Search */}
              <div>
                <label className="text-sm font-medium mb-2 block">Sök</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Sök i titel eller beskrivning..."
                    value={filters.search || ''}
                    onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Sort */}
              <div>
                <label className="text-sm font-medium mb-2 block">Sortera</label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSortBy('created_at')}
                    className={sortBy === 'created_at' ? 'bg-blue-50' : ''}
                  >
                    Skapad
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSortBy('priority')}
                    className={sortBy === 'priority' ? 'bg-blue-50' : ''}
                  >
                    Prioritet
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  >
                    <ArrowUpDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bulk Actions */}
      {selectedInsights.length > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {selectedInsights.length} insights valda
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => bulkUpdateStatus('in_progress')}
                  disabled={isUpdating}
                >
                  Markera som pågående
                </Button>
                <Button
                  size="sm"
                  onClick={() => bulkUpdateStatus('completed')}
                  disabled={isUpdating}
                >
                  Markera som slutförd
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedInsights([])}
                >
                  Rensa urval
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <span className="text-red-700 text-sm">{error}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setError(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Insights List */}
      <div className="space-y-4">
        {insights.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Sparkles className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Inga insights hittades</h3>
              <p className="text-gray-600">
                Inga insights matchar dina nuvarande filter. Prova att justera filtren eller vänta på nya AI-genererade insights.
              </p>
            </CardContent>
          </Card>
        ) : (
          insights.map((insight) => (
            <Card key={insight.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <Checkbox
                    checked={selectedInsights.includes(insight.id)}
                    onCheckedChange={() => toggleInsightSelection(insight.id)}
                  />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <h3 className="font-medium text-gray-900 leading-tight">
                          {insight.title}
                        </h3>
                        <Badge className={getPriorityColor(insight.priority)}>
                          {insight.priority}
                        </Badge>
                        <Badge variant="outline">
                          {insight.department}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {getStatusIcon(insight.status)}
                        <span className="text-sm text-gray-600 capitalize">
                          {insight.status.replace('_', ' ')}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleInsightExpansion(insight.id)}
                        >
                          {expandedInsights.has(insight.id) ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <p className="text-gray-700 text-sm mb-3 leading-relaxed">
                      {insight.description}
                    </p>

                    {/* Expanded Content */}
                    {expandedInsights.has(insight.id) && (
                      <div className="space-y-4 pt-4 border-t">
                        {/* Suggested Actions */}
                        {insight.suggested_actions && insight.suggested_actions.length > 0 && (
                          <div>
                            <h4 className="font-medium text-sm text-gray-900 mb-2">Föreslagna åtgärder:</h4>
                            <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                              {insight.suggested_actions.map((action, index) => (
                                <li key={index}>{action}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Metadata */}
                        <div className="flex items-center gap-6 text-xs text-gray-500">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Skapad: {new Date(insight.created_at).toLocaleDateString('sv-SE')}
                          </div>
                          {insight.assigned_to && (
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              Tilldelad: {insight.assigned_to}
                            </div>
                          )}
                          {insight.due_date && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Förfall: {new Date(insight.due_date).toLocaleDateString('sv-SE')}
                            </div>
                          )}
                        </div>

                        {/* Status Update Buttons */}
                        <div className="flex gap-2">
                          {insight.status === 'pending' && (
                            <Button
                              size="sm"
                              onClick={() => updateInsightStatus(insight.id, 'in_progress')}
                              disabled={isUpdating}
                            >
                              Starta arbete
                            </Button>
                          )}
                          {insight.status === 'in_progress' && (
                            <Button
                              size="sm"
                              onClick={() => updateInsightStatus(insight.id, 'completed')}
                              disabled={isUpdating}
                            >
                              Markera som slutförd
                            </Button>
                          )}
                          {insight.status !== 'dismissed' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateInsightStatus(insight.id, 'dismissed')}
                              disabled={isUpdating}
                            >
                              Avvisa
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Load More */}
      {insights.length >= pagination.limit && (
        <div className="text-center">
          <Button
            variant="outline"
            onClick={() => setPagination(prev => ({ ...prev, offset: prev.offset + prev.limit }))}
            disabled={isLoading}
          >
            Ladda fler insights
          </Button>
        </div>
      )}
    </div>
  );
}