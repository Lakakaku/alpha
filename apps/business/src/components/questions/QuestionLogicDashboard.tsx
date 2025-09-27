'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { 
  Activity, 
  TrendingUp, 
  Clock, 
  Zap, 
  AlertTriangle, 
  CheckCircle, 
  Settings, 
  BarChart3, 
  Loader2,
  RefreshCw
} from 'lucide-react';

interface DashboardMetrics {
  overview: {
    total_questions: number;
    active_triggers: number;
    avg_call_duration: number;
    combination_rules: number;
    unresolved_conflicts: number;
  };
  performance: {
    avg_response_time_ms: number;
    cache_hit_rate: number;
    success_rate: number;
    questions_per_minute: number;
  };
  trigger_effectiveness: Array<{
    trigger_id: string;
    trigger_name: string;
    trigger_type: string;
    activation_rate: number;
    effectiveness_score: number;
    avg_response_quality: number;
  }>;
  question_analytics: Array<{
    question_id: string;
    question_text: string;
    ask_frequency: number;
    avg_response_time: number;
    completion_rate: number;
    priority_level: number;
  }>;
  time_distribution: Array<{
    hour: number;
    question_count: number;
    avg_duration: number;
  }>;
  recent_activity: Array<{
    timestamp: string;
    event_type: 'question_asked' | 'trigger_activated' | 'rule_updated';
    description: string;
    customer_id?: string;
    effectiveness?: number;
  }>;
}

interface QuestionLogicDashboardProps {
  businessContextId: string;
}

const EFFECTIVENESS_COLORS = {
  excellent: '#22c55e',
  good: '#3b82f6', 
  average: '#f59e0b',
  poor: '#ef4444'
};

const getEffectivenessColor = (score: number) => {
  if (score >= 0.8) return EFFECTIVENESS_COLORS.excellent;
  if (score >= 0.6) return EFFECTIVENESS_COLORS.good;
  if (score >= 0.4) return EFFECTIVENESS_COLORS.average;
  return EFFECTIVENESS_COLORS.poor;
};

const getEffectivenessLabel = (score: number) => {
  if (score >= 0.8) return 'Excellent';
  if (score >= 0.6) return 'Good';
  if (score >= 0.4) return 'Average';
  return 'Needs Improvement';
};

export function QuestionLogicDashboard({ businessContextId }: QuestionLogicDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('7d');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMetrics();
  }, [businessContextId, timeRange]);

  const loadMetrics = async () => {
    try {
      if (!refreshing) setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/questions/analytics/dashboard?business_context_id=${businessContextId}&time_range=${timeRange}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load dashboard metrics');
      }

      const data = await response.json();
      setMetrics(data.metrics);
    } catch (error) {
      console.error('Error loading metrics:', error);
      setError(error instanceof Error ? error.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadMetrics();
  };

  if (loading && !metrics) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin mr-4" />
          Loading dashboard metrics...
        </CardContent>
      </Card>
    );
  }

  if (error || !metrics) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          {error || 'Failed to load dashboard metrics'}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            className="ml-2"
          >
            Try Again
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Question Logic Dashboard</h1>
          <p className="text-muted-foreground">Monitor and optimize your advanced question system</p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Select value={timeRange} onValueChange={(value: '24h' | '7d' | '30d') => setTimeRange(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Questions</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.overview.total_questions}</div>
            <p className="text-xs text-muted-foreground">Configured questions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Triggers</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.overview.active_triggers}</div>
            <p className="text-xs text-muted-foreground">Dynamic triggers enabled</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Call Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.overview.avg_call_duration}s</div>
            <p className="text-xs text-muted-foreground">Within 120s target</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Response Time</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.performance.avg_response_time_ms}ms</div>
            <p className="text-xs text-muted-foreground">
              <Badge variant={metrics.performance.avg_response_time_ms < 500 ? "default" : "destructive"}>
                {metrics.performance.avg_response_time_ms < 500 ? 'Good' : 'Slow'}
              </Badge>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conflicts</CardTitle>
            {metrics.overview.unresolved_conflicts === 0 ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-orange-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.overview.unresolved_conflicts}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.overview.unresolved_conflicts === 0 ? 'All resolved' : 'Need attention'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="triggers">Trigger Analytics</TabsTrigger>
          <TabsTrigger value="questions">Question Analytics</TabsTrigger>
          <TabsTrigger value="activity">Recent Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Performance Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Cache Hit Rate</span>
                    <span>{(metrics.performance.cache_hit_rate * 100).toFixed(1)}%</span>
                  </div>
                  <Progress value={metrics.performance.cache_hit_rate * 100} className="mt-2" />
                </div>
                
                <div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Success Rate</span>
                    <span>{(metrics.performance.success_rate * 100).toFixed(1)}%</span>
                  </div>
                  <Progress value={metrics.performance.success_rate * 100} className="mt-2" />
                </div>
                
                <div className="pt-2">
                  <div className="text-sm font-medium">Questions/Minute</div>
                  <div className="text-2xl font-bold">{metrics.performance.questions_per_minute}</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Daily Question Volume</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={metrics.time_distribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value, name) => [
                        `${value} ${name === 'question_count' ? 'questions' : 'seconds'}`,
                        name === 'question_count' ? 'Questions' : 'Avg Duration'
                      ]}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="question_count" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="triggers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Trigger Effectiveness</CardTitle>
              <CardDescription>Performance metrics for your dynamic triggers</CardDescription>
            </CardHeader>
            <CardContent>
              {metrics.trigger_effectiveness.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No trigger data available for the selected time range</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {metrics.trigger_effectiveness.map((trigger) => (
                    <div key={trigger.trigger_id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium">{trigger.trigger_name}</div>
                        <div className="text-sm text-muted-foreground flex items-center space-x-2">
                          <Badge variant="outline">{trigger.trigger_type}</Badge>
                          <span>•</span>
                          <span>Activated {(trigger.activation_rate * 100).toFixed(1)}% of eligible customers</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-4">
                        <div className="text-center">
                          <div className="text-sm font-medium">Effectiveness</div>
                          <Badge 
                            style={{ backgroundColor: getEffectivenessColor(trigger.effectiveness_score) }}
                            className="text-white"
                          >
                            {getEffectivenessLabel(trigger.effectiveness_score)}
                          </Badge>
                        </div>
                        
                        <div className="text-center">
                          <div className="text-sm font-medium">Quality</div>
                          <div className="text-lg font-bold">
                            {(trigger.avg_response_quality * 100).toFixed(0)}%
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="questions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Question Performance</CardTitle>
              <CardDescription>Analytics for individual questions</CardDescription>
            </CardHeader>
            <CardContent>
              {metrics.question_analytics.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No question data available for the selected time range</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {metrics.question_analytics.map((question) => (
                    <div key={question.question_id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium">{question.question_text}</div>
                        <div className="text-sm text-muted-foreground flex items-center space-x-2">
                          <Badge variant="secondary">Priority {question.priority_level}/5</Badge>
                          <span>•</span>
                          <span>Asked every {question.ask_frequency} customers</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-6">
                        <div className="text-center">
                          <div className="text-sm font-medium">Response Time</div>
                          <div className="text-lg font-bold">{question.avg_response_time}s</div>
                        </div>
                        
                        <div className="text-center">
                          <div className="text-sm font-medium">Completion</div>
                          <div className="text-lg font-bold">
                            {(question.completion_rate * 100).toFixed(0)}%
                          </div>
                        </div>
                        
                        <div className="w-20">
                          <Progress value={question.completion_rate * 100} className="h-2" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Activity</CardTitle>
              <CardDescription>Latest events in your question logic system</CardDescription>
            </CardHeader>
            <CardContent>
              {metrics.recent_activity.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No recent activity to display</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {metrics.recent_activity.map((activity, index) => (
                    <div key={index} className="flex items-start space-x-3 p-3 rounded-lg bg-muted/30">
                      <div className="flex-shrink-0 mt-1">
                        {activity.event_type === 'question_asked' && <Settings className="h-4 w-4 text-blue-600" />}
                        {activity.event_type === 'trigger_activated' && <Zap className="h-4 w-4 text-orange-600" />}
                        {activity.event_type === 'rule_updated' && <Settings className="h-4 w-4 text-green-600" />}
                      </div>
                      
                      <div className="flex-1">
                        <div className="text-sm font-medium">{activity.description}</div>
                        <div className="text-xs text-muted-foreground flex items-center space-x-2 mt-1">
                          <span>{new Date(activity.timestamp).toLocaleString()}</span>
                          {activity.customer_id && (
                            <>
                              <span>•</span>
                              <span>Customer: {activity.customer_id.substring(0, 8)}...</span>
                            </>
                          )}
                          {activity.effectiveness !== undefined && (
                            <>
                              <span>•</span>
                              <Badge variant="outline" className="text-xs">
                                {(activity.effectiveness * 100).toFixed(0)}% effective
                              </Badge>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}