'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@vocilia/ui';
import { Button } from '@vocilia/ui';
import { Badge } from '@vocilia/ui';
import { Progress } from '@vocilia/ui';
import { Alert, AlertDescription } from '@vocilia/ui';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@vocilia/ui';
import { Input } from '@vocilia/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@vocilia/ui';
import { 
  AlertTriangle, 
  Clock, 
  MapPin, 
  Users, 
  TrendingUp, 
  Search,
  Filter,
  Download,
  RefreshCw,
  Eye,
  Hash
} from 'lucide-react';

// Types for behavioral pattern data
interface BehavioralPattern {
  id: string;
  phone_number_hash: string;
  customer_id: string | null;
  pattern_type: 'call_frequency' | 'time_pattern' | 'location_pattern' | 'similarity_pattern';
  pattern_data: {
    frequency?: number;
    time_windows?: string[];
    locations?: string[];
    similarity_score?: number;
    threshold_breaches?: number;
    details?: any;
  };
  risk_score: number;
  detection_window: string;
  first_detected_at: string;
  last_updated_at: string;
  violation_count: number;
}

interface PatternStats {
  total_patterns: number;
  active_patterns: number;
  high_risk_count: number;
  pattern_type_distribution: Record<string, number>;
  recent_trends: {
    new_patterns_today: number;
    trend_direction: 'up' | 'down' | 'stable';
    avg_risk_score: number;
  };
}

interface PatternFilters {
  patternType: string;
  riskLevel: string;
  dateRange: string;
  search: string;
}

const BehavioralPatternDashboard: React.FC = () => {
  const [patterns, setPatterns] = useState<BehavioralPattern[]>([]);
  const [stats, setStats] = useState<PatternStats | null>(null);
  const [filters, setFilters] = useState<PatternFilters>({
    patternType: 'all',
    riskLevel: 'all',
    dateRange: '7d',
    search: ''
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPattern, setSelectedPattern] = useState<BehavioralPattern | null>(null);

  // Fetch behavioral patterns and statistics
  const fetchPatternData = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filters.patternType !== 'all') params.set('pattern_type', filters.patternType);
      if (filters.riskLevel !== 'all') params.set('risk_level', filters.riskLevel);
      if (filters.dateRange !== 'all') params.set('period', filters.dateRange);
      if (filters.search) params.set('search', filters.search);

      // Fetch behavioral patterns
      const patternsResponse = await fetch(`/api/fraud/patterns?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!patternsResponse.ok) {
        throw new Error(`Failed to fetch patterns: ${patternsResponse.status}`);
      }

      const patternsData = await patternsResponse.json();

      // Fetch pattern statistics
      const statsResponse = await fetch(`/api/fraud/patterns/stats?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!statsResponse.ok) {
        throw new Error(`Failed to fetch pattern statistics: ${statsResponse.status}`);
      }

      const statsData = await statsResponse.json();

      setPatterns(patternsData.data || []);
      setStats(statsData);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch pattern data');
      console.error('Error fetching pattern data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatternData();
  }, [filters]);

  // Get pattern type info
  const getPatternTypeInfo = (type: string) => {
    switch (type) {
      case 'call_frequency':
        return { label: 'Call Frequency', icon: <Clock className="w-4 h-4" />, color: 'blue' };
      case 'time_pattern':
        return { label: 'Time Pattern', icon: <Clock className="w-4 h-4" />, color: 'green' };
      case 'location_pattern':
        return { label: 'Location Pattern', icon: <MapPin className="w-4 h-4" />, color: 'orange' };
      case 'similarity_pattern':
        return { label: 'Similarity Pattern', icon: <Users className="w-4 h-4" />, color: 'purple' };
      default:
        return { label: 'Unknown', icon: <Hash className="w-4 h-4" />, color: 'gray' };
    }
  };

  // Get risk level based on risk score
  const getRiskLevel = (score: number): { level: string; color: string; variant: any } => {
    if (score >= 90) return { level: 'Critical', color: 'text-red-600', variant: 'destructive' };
    if (score >= 70) return { level: 'High', color: 'text-orange-600', variant: 'destructive' };
    if (score >= 50) return { level: 'Medium', color: 'text-yellow-600', variant: 'secondary' };
    if (score >= 30) return { level: 'Low', color: 'text-blue-600', variant: 'outline' };
    return { level: 'Very Low', color: 'text-green-600', variant: 'outline' };
  };

  // Export pattern data
  const exportData = async (format: 'csv' | 'json' | 'pdf') => {
    try {
      const params = new URLSearchParams(filters as any);
      params.set('export_format', format);
      
      const response = await fetch(`/api/fraud/patterns/export?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });

      if (!response.ok) {
        throw new Error(`Export failed: ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `behavioral-patterns-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center p-8">
          <RefreshCw className="w-8 h-8 animate-spin" />
          <span className="ml-2">Loading behavioral patterns...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          {error}
          <Button variant="outline" size="sm" className="ml-2" onClick={fetchPatternData}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Behavioral Pattern Dashboard</h2>
          <p className="text-muted-foreground">
            Monitor suspicious behavioral patterns and fraud indicators
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={fetchPatternData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Select onValueChange={(value) => exportData(value as any)}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Export" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="csv">CSV</SelectItem>
              <SelectItem value="json">JSON</SelectItem>
              <SelectItem value="pdf">PDF</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Statistics Overview */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Patterns</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_patterns.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                Active: {stats.active_patterns}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">High Risk</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.high_risk_count}</div>
              <p className="text-xs text-muted-foreground">
                {((stats.high_risk_count / stats.total_patterns) * 100).toFixed(1)}% of total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">New Today</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.recent_trends.new_patterns_today}</div>
              <p className="text-xs text-muted-foreground">
                {stats.recent_trends.trend_direction === 'up' ? '↗' : 
                 stats.recent_trends.trend_direction === 'down' ? '↘' : '→'} 
                {' '}Trend
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Risk Score</CardTitle>
              <Hash className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.recent_trends.avg_risk_score.toFixed(1)}</div>
              <Progress value={stats.recent_trends.avg_risk_score} className="mt-2" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Pattern Type Distribution */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle>Pattern Type Distribution</CardTitle>
            <CardDescription>Breakdown of detected behavioral patterns by type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(stats.pattern_type_distribution).map(([type, count]) => {
                const typeInfo = getPatternTypeInfo(type);
                return (
                  <div key={type} className="text-center">
                    <div className="flex items-center justify-center mb-2">
                      {typeInfo.icon}
                      <span className="ml-2 font-medium">{typeInfo.label}</span>
                    </div>
                    <div className="text-2xl font-bold">{count}</div>
                    <div className="text-sm text-muted-foreground">
                      {((count / stats.total_patterns) * 100).toFixed(1)}%
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <Filter className="w-5 h-5 mr-2" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium">Pattern Type</label>
              <Select 
                value={filters.patternType} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, patternType: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="call_frequency">Call Frequency</SelectItem>
                  <SelectItem value="time_pattern">Time Pattern</SelectItem>
                  <SelectItem value="location_pattern">Location Pattern</SelectItem>
                  <SelectItem value="similarity_pattern">Similarity Pattern</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Risk Level</label>
              <Select 
                value={filters.riskLevel} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, riskLevel: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All levels</SelectItem>
                  <SelectItem value="critical">Critical (90+)</SelectItem>
                  <SelectItem value="high">High (70-89)</SelectItem>
                  <SelectItem value="medium">Medium (50-69)</SelectItem>
                  <SelectItem value="low">Low (30-49)</SelectItem>
                  <SelectItem value="very-low">Very Low (0-29)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Date Range</label>
              <Select 
                value={filters.dateRange} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, dateRange: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1d">Last 24 hours</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search phone hash..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-8"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Behavioral Patterns Table */}
      <Card>
        <CardHeader>
          <CardTitle>Behavioral Patterns</CardTitle>
          <CardDescription>
            Detailed view of suspicious behavioral patterns and risk indicators
          </CardDescription>
        </CardHeader>
        <CardContent>
          {patterns.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No behavioral patterns found with current filters</p>
            </div>
          ) : (
            <div className="space-y-4">
              {patterns.map((pattern) => {
                const typeInfo = getPatternTypeInfo(pattern.pattern_type);
                const riskInfo = getRiskLevel(pattern.risk_score);
                return (
                  <div
                    key={pattern.id}
                    className="border rounded-lg p-4 hover:bg-muted/50 cursor-pointer"
                    onClick={() => setSelectedPattern(pattern)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="flex items-center">
                          {typeInfo.icon}
                          <span className="ml-1">{typeInfo.label}</span>
                        </Badge>
                        <Badge variant={riskInfo.variant}>
                          {riskInfo.level}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          Hash: {pattern.phone_number_hash.substring(0, 12)}...
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">{pattern.risk_score}</div>
                        <div className="text-sm text-muted-foreground">Risk Score</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                      <div>
                        <div className="text-sm text-muted-foreground">Violations</div>
                        <div className="font-medium">{pattern.violation_count}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Detection Window</div>
                        <div className="font-medium">{pattern.detection_window}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">First Detected</div>
                        <div className="font-medium">
                          {new Date(pattern.first_detected_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Last Updated</div>
                        <div className="font-medium">
                          {new Date(pattern.last_updated_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-sm text-muted-foreground">
                      <div>Customer ID: {pattern.customer_id || 'Unknown'}</div>
                      <div>
                        Pattern Data: {Object.keys(pattern.pattern_data).length} fields
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Pattern Modal/Panel */}
      {selectedPattern && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Pattern Details
              <Button variant="outline" size="sm" onClick={() => setSelectedPattern(null)}>
                Close
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="data">Pattern Data</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-2">Pattern Information</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Pattern Type</span>
                        <Badge variant="outline">
                          {getPatternTypeInfo(selectedPattern.pattern_type).label}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Risk Score</span>
                        <span className="font-medium">{selectedPattern.risk_score}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Risk Level</span>
                        <Badge variant={getRiskLevel(selectedPattern.risk_score).variant}>
                          {getRiskLevel(selectedPattern.risk_score).level}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Violation Count</span>
                        <span className="font-medium">{selectedPattern.violation_count}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Detection Information</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Detection Window</span>
                        <span className="font-medium">{selectedPattern.detection_window}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Phone Hash</span>
                        <span className="font-medium text-xs">
                          {selectedPattern.phone_number_hash.substring(0, 16)}...
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Customer ID</span>
                        <span className="font-medium">
                          {selectedPattern.customer_id || 'Unknown'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="data" className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Pattern Data</h4>
                  <div className="bg-muted p-4 rounded-lg">
                    <pre className="text-sm whitespace-pre-wrap">
                      {JSON.stringify(selectedPattern.pattern_data, null, 2)}
                    </pre>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="timeline" className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Detection Timeline</h4>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <div>
                        <div className="font-medium">First Detected</div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(selectedPattern.first_detected_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <div>
                        <div className="font-medium">Last Updated</div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(selectedPattern.last_updated_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      <div>
                        <div className="font-medium">Total Violations</div>
                        <div className="text-sm text-muted-foreground">
                          {selectedPattern.violation_count} violations detected
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default BehavioralPatternDashboard;