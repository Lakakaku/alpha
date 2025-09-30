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
  Shield, 
  TrendingUp, 
  TrendingDown, 
  Eye, 
  Search,
  Filter,
  Download,
  RefreshCw
} from 'lucide-react';

// Types for fraud score data
interface FraudScore {
  id: string;
  feedback_id: string;
  overall_score: number;
  context_score: number;
  keyword_score: number;
  behavioral_score: number;
  transaction_score: number;
  is_fraudulent: boolean;
  scoring_method: string;
  analysis_metadata: any;
  created_at: string;
  updated_at: string;
}

interface FraudScoreStats {
  total_scores: number;
  fraudulent_count: number;
  legitimate_count: number;
  avg_overall_score: number;
  high_risk_count: number;
  medium_risk_count: number;
  low_risk_count: number;
  blocked_rewards: number;
  recent_trends: {
    period: string;
    fraud_rate: number;
    trend_direction: 'up' | 'down' | 'stable';
  };
}

interface FraudScoreFilters {
  dateRange: string;
  riskLevel: string;
  scoringMethod: string;
  isFraudulent?: boolean;
  search: string;
}

const FraudScoreMonitor: React.FC = () => {
  const [fraudScores, setFraudScores] = useState<FraudScore[]>([]);
  const [stats, setStats] = useState<FraudScoreStats | null>(null);
  const [filters, setFilters] = useState<FraudScoreFilters>({
    dateRange: '7d',
    riskLevel: 'all',
    scoringMethod: 'all',
    search: ''
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedScore, setSelectedScore] = useState<FraudScore | null>(null);

  // Fetch fraud scores and statistics
  const fetchFraudData = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filters.dateRange !== 'all') params.set('period', filters.dateRange);
      if (filters.riskLevel !== 'all') params.set('risk_level', filters.riskLevel);
      if (filters.scoringMethod !== 'all') params.set('scoring_method', filters.scoringMethod);
      if (filters.isFraudulent !== undefined) params.set('is_fraudulent', filters.isFraudulent.toString());
      if (filters.search) params.set('search', filters.search);

      // Fetch fraud scores
      const scoresResponse = await fetch(`/api/fraud/analyze?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!scoresResponse.ok) {
        throw new Error(`Failed to fetch fraud scores: ${scoresResponse.status}`);
      }

      const scoresData = await scoresResponse.json();

      // Fetch fraud statistics
      const statsResponse = await fetch(`/api/fraud/analyze/stats?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!statsResponse.ok) {
        throw new Error(`Failed to fetch fraud statistics: ${statsResponse.status}`);
      }

      const statsData = await statsResponse.json();

      setFraudScores(scoresData.data || []);
      setStats(statsData);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch fraud data');
      console.error('Error fetching fraud data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFraudData();
  }, [filters]);

  // Get risk level based on overall score
  const getRiskLevel = (score: number): { level: string; color: string; icon: React.ReactNode } => {
    if (score >= 90) return { level: 'Critical', color: 'destructive', icon: <AlertTriangle className="w-4 h-4" /> };
    if (score >= 70) return { level: 'High', color: 'destructive', icon: <AlertTriangle className="w-4 h-4" /> };
    if (score >= 50) return { level: 'Medium', color: 'warning', icon: <TrendingUp className="w-4 h-4" /> };
    if (score >= 30) return { level: 'Low', color: 'secondary', icon: <TrendingDown className="w-4 h-4" /> };
    return { level: 'Very Low', color: 'default', icon: <Shield className="w-4 h-4" /> };
  };

  // Export fraud scores data
  const exportData = async (format: 'csv' | 'json' | 'pdf') => {
    try {
      const params = new URLSearchParams(filters as any);
      params.set('export_format', format);
      
      const response = await fetch(`/api/fraud/analyze/export?${params.toString()}`, {
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
      a.download = `fraud-scores-${new Date().toISOString().split('T')[0]}.${format}`;
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
          <span className="ml-2">Loading fraud data...</span>
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
          <Button variant="outline" size="sm" className="ml-2" onClick={fetchFraudData}>
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
          <h2 className="text-3xl font-bold tracking-tight">Fraud Score Monitor</h2>
          <p className="text-muted-foreground">
            Monitor and analyze fraud detection scores across all feedback submissions
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={fetchFraudData}>
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
              <CardTitle className="text-sm font-medium">Total Scores</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_scores.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                Fraud rate: {((stats.fraudulent_count / stats.total_scores) * 100).toFixed(1)}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Fraudulent</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.fraudulent_count}</div>
              <p className="text-xs text-muted-foreground">
                Blocked rewards: {stats.blocked_rewards}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Score</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.avg_overall_score.toFixed(1)}</div>
              <Progress value={stats.avg_overall_score} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">High Risk</CardTitle>
              <Shield className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.high_risk_count}</div>
              <p className="text-xs text-muted-foreground">
                {stats.recent_trends.trend_direction === 'up' ? '↗' : 
                 stats.recent_trends.trend_direction === 'down' ? '↘' : '→'} 
                {' '}{stats.recent_trends.fraud_rate.toFixed(1)}% trend
              </p>
            </CardContent>
          </Card>
        </div>
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
              <label className="text-sm font-medium">Scoring Method</label>
              <Select 
                value={filters.scoringMethod} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, scoringMethod: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All methods</SelectItem>
                  <SelectItem value="composite_v1">Composite v1</SelectItem>
                  <SelectItem value="composite_v2">Composite v2</SelectItem>
                  <SelectItem value="ml_enhanced">ML Enhanced</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search feedback ID..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-8"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fraud Scores Table */}
      <Card>
        <CardHeader>
          <CardTitle>Fraud Score Analysis</CardTitle>
          <CardDescription>
            Detailed view of fraud detection scores and analysis results
          </CardDescription>
        </CardHeader>
        <CardContent>
          {fraudScores.length === 0 ? (
            <div className="text-center py-8">
              <Shield className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No fraud scores found with current filters</p>
            </div>
          ) : (
            <div className="space-y-4">
              {fraudScores.map((score) => {
                const riskInfo = getRiskLevel(score.overall_score);
                return (
                  <div
                    key={score.id}
                    className="border rounded-lg p-4 hover:bg-muted/50 cursor-pointer"
                    onClick={() => setSelectedScore(score)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center space-x-2">
                        <Badge variant={riskInfo.color as any} className="flex items-center">
                          {riskInfo.icon}
                          <span className="ml-1">{riskInfo.level}</span>
                        </Badge>
                        {score.is_fraudulent && (
                          <Badge variant="destructive">Fraud Detected</Badge>
                        )}
                        <span className="text-sm text-muted-foreground">
                          ID: {score.feedback_id.substring(0, 8)}...
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">{score.overall_score}</div>
                        <div className="text-sm text-muted-foreground">Overall Score</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-4 mb-3">
                      <div>
                        <div className="text-sm text-muted-foreground">Context</div>
                        <div className="font-medium">{score.context_score}</div>
                        <Progress value={score.context_score} className="h-1 mt-1" />
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Keywords</div>
                        <div className="font-medium">{score.keyword_score}</div>
                        <Progress value={score.keyword_score} className="h-1 mt-1" />
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Behavioral</div>
                        <div className="font-medium">{score.behavioral_score}</div>
                        <Progress value={score.behavioral_score} className="h-1 mt-1" />
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Transaction</div>
                        <div className="font-medium">{score.transaction_score}</div>
                        <Progress value={score.transaction_score} className="h-1 mt-1" />
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-sm text-muted-foreground">
                      <div>Method: {score.scoring_method}</div>
                      <div>{new Date(score.created_at).toLocaleString()}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Score Modal/Panel */}
      {selectedScore && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Fraud Score Details
              <Button variant="outline" size="sm" onClick={() => setSelectedScore(null)}>
                Close
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="analysis">Analysis</TabsTrigger>
                <TabsTrigger value="metadata">Metadata</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-2">Score Breakdown</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Context Analysis (40%)</span>
                        <span className="font-medium">{selectedScore.context_score}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Keyword Detection (20%)</span>
                        <span className="font-medium">{selectedScore.keyword_score}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Behavioral Pattern (30%)</span>
                        <span className="font-medium">{selectedScore.behavioral_score}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Transaction Analysis (10%)</span>
                        <span className="font-medium">{selectedScore.transaction_score}</span>
                      </div>
                      <hr />
                      <div className="flex justify-between text-lg font-bold">
                        <span>Overall Score</span>
                        <span>{selectedScore.overall_score}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Risk Assessment</h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span>Fraud Status</span>
                        <Badge variant={selectedScore.is_fraudulent ? "destructive" : "default"}>
                          {selectedScore.is_fraudulent ? "Fraudulent" : "Legitimate"}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Risk Level</span>
                        <span className="font-medium">{getRiskLevel(selectedScore.overall_score).level}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Scoring Method</span>
                        <span className="font-medium">{selectedScore.scoring_method}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="analysis" className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Analysis Results</h4>
                  <div className="bg-muted p-4 rounded-lg">
                    <pre className="text-sm whitespace-pre-wrap">
                      {selectedScore.analysis_metadata ? 
                        JSON.stringify(selectedScore.analysis_metadata, null, 2) : 
                        'No detailed analysis metadata available'
                      }
                    </pre>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="metadata" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-2">Record Information</h4>
                    <div className="space-y-2 text-sm">
                      <div><span className="font-medium">Score ID:</span> {selectedScore.id}</div>
                      <div><span className="font-medium">Feedback ID:</span> {selectedScore.feedback_id}</div>
                      <div><span className="font-medium">Created:</span> {new Date(selectedScore.created_at).toLocaleString()}</div>
                      <div><span className="font-medium">Updated:</span> {new Date(selectedScore.updated_at).toLocaleString()}</div>
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

export default FraudScoreMonitor;