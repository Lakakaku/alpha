/**
 * Temporal Comparison Charts Component
 * Feature: 008-step-2-6
 * 
 * Provides week-over-week trend analysis with interactive charts,
 * sentiment progression, department comparisons, and AI-powered insights.
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@vocilia/ui/components/card';
import { Button } from '@vocilia/ui/components/button';
import { Badge } from '@vocilia/ui/components/badge';
import { Progress } from '@vocilia/ui/components/progress';
import { 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  BarChart3, 
  LineChart, 
  Activity,
  ArrowUp,
  ArrowDown,
  Minus,
  RefreshCw,
  AlertCircle,
  Sparkles,
  Users,
  MessageSquare
} from 'lucide-react';
import { useAuth } from '@vocilia/auth/context/AuthContext';
import type { WeeklyComparisonData } from '@vocilia/types/feedback-analysis';

interface TemporalComparisonProps {
  storeId: string;
  className?: string;
}

interface TrendDataPoint {
  week: number;
  year: number;
  total_feedback: number;
  positive_count: number;
  negative_count: number;
  neutral_count: number;
  mixed_count: number;
  avg_sentiment_score: number;
  week_label: string;
}

interface DepartmentTrend {
  department: string;
  current_week: {
    positive: number;
    negative: number;
    total: number;
  };
  previous_week: {
    positive: number;
    negative: number;
    total: number;
  };
  change_percent: number;
  trend_direction: 'improving' | 'declining' | 'stable';
}

export function TemporalComparison({ storeId, className = '' }: TemporalComparisonProps) {
  const { user } = useAuth();
  
  // State management
  const [comparisonData, setComparisonData] = useState<WeeklyComparisonData | null>(null);
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);
  const [departmentTrends, setDepartmentTrends] = useState<DepartmentTrend[]>([]);
  const [selectedWeeksBack, setSelectedWeeksBack] = useState(4);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Load temporal comparison data
  const loadTemporalData = async (weeksBack: number = selectedWeeksBack) => {
    setIsLoading(true);
    setError(null);

    try {
      const [comparisonResponse, trendResponse] = await Promise.all([
        fetch(`/api/feedback-analysis/temporal/${storeId}?weeks_back=${weeksBack}`, {
          headers: {
            'Authorization': `Bearer ${user?.access_token}`,
          },
        }),
        fetch(`/api/feedback-analysis/trends/${storeId}?weeks=${weeksBack + 4}`, {
          headers: {
            'Authorization': `Bearer ${user?.access_token}`,
          },
        }),
      ]);

      if (!comparisonResponse.ok) {
        throw new Error('Kunde inte ladda jämförelsedata');
      }

      const comparisonResult = await comparisonResponse.json();
      setComparisonData(comparisonResult);

      // Handle trend data (might not be available)
      if (trendResponse.ok) {
        const trendResult = await trendResponse.json();
        setTrendData(trendResult.weeks || []);
        setDepartmentTrends(trendResult.department_trends || []);
      }

      setLastUpdated(new Date());

    } catch (err) {
      console.error('Temporal data loading error:', err);
      setError(err instanceof Error ? err.message : 'Ett fel uppstod vid laddning av trenddata');
    } finally {
      setIsLoading(false);
    }
  };

  // Load data on mount and when dependencies change
  useEffect(() => {
    if (storeId && user?.access_token) {
      loadTemporalData();
    }
  }, [storeId, user?.access_token, selectedWeeksBack]);

  // Calculate percentage change
  const calculatePercentChange = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  // Get trend icon
  const getTrendIcon = (change: number) => {
    if (change > 5) return <ArrowUp className="h-4 w-4 text-green-600" />;
    if (change < -5) return <ArrowDown className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-gray-400" />;
  };

  // Get trend color
  const getTrendColor = (change: number) => {
    if (change > 5) return 'text-green-600';
    if (change < -5) return 'text-red-600';
    return 'text-gray-600';
  };

  // Generate simple bar chart data
  const generateBarChart = (data: TrendDataPoint[], metric: keyof TrendDataPoint) => {
    if (data.length === 0) return null;
    
    const values = data.map(d => Number(d[metric]));
    const maxValue = Math.max(...values);
    
    return (
      <div className="flex items-end gap-2 h-20">
        {data.map((point, index) => {
          const height = maxValue > 0 ? (Number(point[metric]) / maxValue) * 100 : 0;
          return (
            <div key={index} className="flex-1 flex flex-col items-center">
              <div 
                className="w-full bg-blue-500 rounded-t min-h-[2px]"
                style={{ height: `${height}%` }}
                title={`${point.week_label}: ${point[metric]}`}
              ></div>
              <span className="text-xs text-gray-500 mt-1 transform rotate-45 origin-left">
                V{point.week}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-64 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`${className}`}>
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-800">
              <AlertCircle className="h-5 w-5" />
              Fel vid laddning av trenddata
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-700 mb-4">{error}</p>
            <Button 
              onClick={() => loadTemporalData()} 
              variant="outline"
              className="border-red-300 text-red-700 hover:bg-red-100"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Försök igen
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <LineChart className="h-5 w-5" />
                Trendanalys och jämförelser
              </CardTitle>
              <CardDescription>
                Vecka-för-vecka utveckling och förändringar
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Jämför senaste:</span>
                <div className="flex gap-1">
                  {[2, 4, 8, 12].map((weeks) => (
                    <Button
                      key={weeks}
                      variant={selectedWeeksBack === weeks ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedWeeksBack(weeks)}
                    >
                      {weeks}v
                    </Button>
                  ))}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadTemporalData()}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Uppdatera
              </Button>
            </div>
          </div>
          {lastUpdated && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Calendar className="h-3 w-3" />
              Senast uppdaterad: {lastUpdated.toLocaleString('sv-SE')}
            </div>
          )}
        </CardHeader>
      </Card>

      {/* Week-over-Week Comparison */}
      {comparisonData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Total Feedback</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">
                    {comparisonData.current_week?.total_feedback || 0}
                  </div>
                  <div className="text-sm text-gray-500">
                    vs {comparisonData.previous_week?.total_feedback || 0} förra veckan
                  </div>
                </div>
                <div className={`flex items-center gap-1 ${getTrendColor(
                  calculatePercentChange(
                    comparisonData.current_week?.total_feedback || 0,
                    comparisonData.previous_week?.total_feedback || 0
                  )
                )}`}>
                  {getTrendIcon(
                    calculatePercentChange(
                      comparisonData.current_week?.total_feedback || 0,
                      comparisonData.previous_week?.total_feedback || 0
                    )
                  )}
                  <span className="text-sm font-medium">
                    {Math.abs(calculatePercentChange(
                      comparisonData.current_week?.total_feedback || 0,
                      comparisonData.previous_week?.total_feedback || 0
                    )).toFixed(1)}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Positiv Feedback</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-green-600">
                    {comparisonData.current_week?.positive_count || 0}
                  </div>
                  <div className="text-sm text-gray-500">
                    vs {comparisonData.previous_week?.positive_count || 0} förra veckan
                  </div>
                </div>
                <div className={`flex items-center gap-1 ${getTrendColor(
                  calculatePercentChange(
                    comparisonData.current_week?.positive_count || 0,
                    comparisonData.previous_week?.positive_count || 0
                  )
                )}`}>
                  {getTrendIcon(
                    calculatePercentChange(
                      comparisonData.current_week?.positive_count || 0,
                      comparisonData.previous_week?.positive_count || 0
                    )
                  )}
                  <span className="text-sm font-medium">
                    {Math.abs(calculatePercentChange(
                      comparisonData.current_week?.positive_count || 0,
                      comparisonData.previous_week?.positive_count || 0
                    )).toFixed(1)}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Negativ Feedback</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-red-600">
                    {comparisonData.current_week?.negative_count || 0}
                  </div>
                  <div className="text-sm text-gray-500">
                    vs {comparisonData.previous_week?.negative_count || 0} förra veckan
                  </div>
                </div>
                <div className={`flex items-center gap-1 ${getTrendColor(
                  -calculatePercentChange( // Negative change is good for negative feedback
                    comparisonData.current_week?.negative_count || 0,
                    comparisonData.previous_week?.negative_count || 0
                  )
                )}`}>
                  {getTrendIcon(
                    -calculatePercentChange(
                      comparisonData.current_week?.negative_count || 0,
                      comparisonData.previous_week?.negative_count || 0
                    )
                  )}
                  <span className="text-sm font-medium">
                    {Math.abs(calculatePercentChange(
                      comparisonData.current_week?.negative_count || 0,
                      comparisonData.previous_week?.negative_count || 0
                    )).toFixed(1)}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Sentiment Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">
                    {(comparisonData.current_week?.avg_sentiment_score || 0).toFixed(1)}
                  </div>
                  <div className="text-sm text-gray-500">
                    vs {(comparisonData.previous_week?.avg_sentiment_score || 0).toFixed(1)} förra veckan
                  </div>
                </div>
                <div className={`flex items-center gap-1 ${getTrendColor(
                  calculatePercentChange(
                    comparisonData.current_week?.avg_sentiment_score || 0,
                    comparisonData.previous_week?.avg_sentiment_score || 0
                  )
                )}`}>
                  {getTrendIcon(
                    calculatePercentChange(
                      comparisonData.current_week?.avg_sentiment_score || 0,
                      comparisonData.previous_week?.avg_sentiment_score || 0
                    )
                  )}
                  <span className="text-sm font-medium">
                    {Math.abs(calculatePercentChange(
                      comparisonData.current_week?.avg_sentiment_score || 0,
                      comparisonData.previous_week?.avg_sentiment_score || 0
                    )).toFixed(1)}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Trend Charts */}
      {trendData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Feedback-volym över tid
              </CardTitle>
              <CardDescription>
                Total feedback per vecka senaste {selectedWeeksBack} veckorna
              </CardDescription>
            </CardHeader>
            <CardContent>
              {generateBarChart(trendData, 'total_feedback')}
              <div className="mt-4 text-sm text-gray-600">
                Genomsnitt: {(trendData.reduce((sum, d) => sum + d.total_feedback, 0) / trendData.length).toFixed(0)} feedback/vecka
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Sentiment-utveckling
              </CardTitle>
              <CardDescription>
                Genomsnittlig sentiment-poäng över tid
              </CardDescription>
            </CardHeader>
            <CardContent>
              {generateBarChart(trendData, 'avg_sentiment_score')}
              <div className="mt-4 text-sm text-gray-600">
                Genomsnitt: {(trendData.reduce((sum, d) => sum + d.avg_sentiment_score, 0) / trendData.length).toFixed(1)}/10
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* AI-Generated Insights */}
      {comparisonData?.new_issues && comparisonData.new_issues.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-600" />
              AI-genererade insights
            </CardTitle>
            <CardDescription>
              Automatisk analys av förändringar och trender
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* New Issues */}
            {comparisonData.new_issues.length > 0 && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <h4 className="font-medium text-red-800 mb-2 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Nya problem identifierade
                </h4>
                <ul className="space-y-1">
                  {comparisonData.new_issues.map((issue, index) => (
                    <li key={index} className="text-sm text-red-700">• {issue}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Resolved Issues */}
            {comparisonData.resolved_issues && comparisonData.resolved_issues.length > 0 && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="font-medium text-green-800 mb-2 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Lösta problem
                </h4>
                <ul className="space-y-1">
                  {comparisonData.resolved_issues.map((issue, index) => (
                    <li key={index} className="text-sm text-green-700">• {issue}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Overall Trend */}
            <div className={`p-4 rounded-lg border ${
              comparisonData.trend_direction === 'improving' 
                ? 'bg-green-50 border-green-200' 
                : comparisonData.trend_direction === 'declining'
                ? 'bg-red-50 border-red-200'
                : 'bg-gray-50 border-gray-200'
            }`}>
              <h4 className={`font-medium mb-2 flex items-center gap-2 ${
                comparisonData.trend_direction === 'improving' 
                  ? 'text-green-800' 
                  : comparisonData.trend_direction === 'declining'
                  ? 'text-red-800'
                  : 'text-gray-800'
              }`}>
                {comparisonData.trend_direction === 'improving' && <TrendingUp className="h-4 w-4" />}
                {comparisonData.trend_direction === 'declining' && <TrendingDown className="h-4 w-4" />}
                {comparisonData.trend_direction === 'stable' && <Minus className="h-4 w-4" />}
                Övergripande trend: {
                  comparisonData.trend_direction === 'improving' ? 'Förbättring' :
                  comparisonData.trend_direction === 'declining' ? 'Försämring' : 'Stabil'
                }
              </h4>
              <p className={`text-sm ${
                comparisonData.trend_direction === 'improving' 
                  ? 'text-green-700' 
                  : comparisonData.trend_direction === 'declining'
                  ? 'text-red-700'
                  : 'text-gray-700'
              }`}>
                {comparisonData.key_changes}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Department Trends */}
      {departmentTrends.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Avdelningstrender
            </CardTitle>
            <CardDescription>
              Vecka-för-vecka förändringar per avdelning
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {departmentTrends.map((dept, index) => (
                <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div>
                      <h4 className="font-medium capitalize">{dept.department}</h4>
                      <div className="text-sm text-gray-600">
                        {dept.current_week.total} feedback denna vecka
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <div className="text-sm font-medium text-green-600">
                        {dept.current_week.positive}
                      </div>
                      <div className="text-xs text-gray-500">Positiv</div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-sm font-medium text-red-600">
                        {dept.current_week.negative}
                      </div>
                      <div className="text-xs text-gray-500">Negativ</div>
                    </div>
                    
                    <div className={`flex items-center gap-1 ${getTrendColor(dept.change_percent)}`}>
                      {getTrendIcon(dept.change_percent)}
                      <span className="text-sm font-medium">
                        {Math.abs(dept.change_percent).toFixed(1)}%
                      </span>
                    </div>
                    
                    <Badge 
                      variant="outline"
                      className={`
                        ${dept.trend_direction === 'improving' ? 'text-green-700 border-green-300' : ''}
                        ${dept.trend_direction === 'declining' ? 'text-red-700 border-red-300' : ''}
                        ${dept.trend_direction === 'stable' ? 'text-gray-700 border-gray-300' : ''}
                      `}
                    >
                      {dept.trend_direction === 'improving' ? 'Förbättras' :
                       dept.trend_direction === 'declining' ? 'Försämras' : 'Stabil'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}