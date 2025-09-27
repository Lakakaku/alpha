/**
 * Feedback Categorization Display Component
 * Feature: 008-step-2-6
 * 
 * Displays current week feedback categorized by sentiment with positive/negative summaries,
 * department breakdowns, and actionable insights visualization.
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@vocilia/ui/components/card';
import { Badge } from '@vocilia/ui/components/badge';
import { Button } from '@vocilia/ui/components/button';
import { Progress } from '@vocilia/ui/components/progress';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  MessageSquare, 
  AlertCircle,
  CheckCircle,
  Clock,
  BarChart3,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import type { AnalysisReport } from '@vocilia/types/feedback-analysis';

interface CategorizationDisplayProps {
  report: AnalysisReport;
  className?: string;
}

interface DepartmentStats {
  department: string;
  positive_count: number;
  negative_count: number;
  neutral_count: number;
  total_count: number;
  avg_score: number;
}

export function CategorizationDisplay({ report, className = '' }: CategorizationDisplayProps) {
  const [expandedSections, setExpandedSections] = useState<{
    positive: boolean;
    negative: boolean;
    insights: boolean;
    departments: boolean;
  }>({
    positive: true,
    negative: true,
    insights: true,
    departments: false,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // Calculate sentiment percentages
  const totalFeedback = report.total_feedback_count;
  const positiveCount = report.sentiment_breakdown?.positive || 0;
  const negativeCount = report.sentiment_breakdown?.negative || 0;
  const neutralCount = report.sentiment_breakdown?.neutral || 0;
  const mixedCount = report.sentiment_breakdown?.mixed || 0;

  const positivePercent = totalFeedback > 0 ? (positiveCount / totalFeedback) * 100 : 0;
  const negativePercent = totalFeedback > 0 ? (negativeCount / totalFeedback) * 100 : 0;
  const neutralPercent = totalFeedback > 0 ? (neutralCount / totalFeedback) * 100 : 0;
  const mixedPercent = totalFeedback > 0 ? (mixedCount / totalFeedback) * 100 : 0;

  // Mock department data (would come from API in real implementation)
  const departmentStats: DepartmentStats[] = [
    { department: 'Kassa', positive_count: 45, negative_count: 12, neutral_count: 8, total_count: 65, avg_score: 7.2 },
    { department: 'Kött', positive_count: 23, negative_count: 18, neutral_count: 5, total_count: 46, avg_score: 6.1 },
    { department: 'Bageri', positive_count: 31, negative_count: 7, neutral_count: 4, total_count: 42, avg_score: 8.1 },
    { department: 'Kundservice', positive_count: 19, negative_count: 15, neutral_count: 3, total_count: 37, avg_score: 6.8 },
    { department: 'Parkering', positive_count: 8, negative_count: 22, neutral_count: 6, total_count: 36, avg_score: 4.2 },
  ];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Veckorapport - Vecka {report.week_number}, {report.year}
              </CardTitle>
              <CardDescription>
                Analys av {totalFeedback.toLocaleString()} feedbackresponser
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-sm">
              Genererad: {new Date(report.created_at).toLocaleDateString('sv-SE')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {/* Sentiment Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 rounded-lg bg-green-50 border border-green-200">
              <div className="text-2xl font-bold text-green-700">{positiveCount}</div>
              <div className="text-sm text-green-600">Positiv ({positivePercent.toFixed(1)}%)</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-red-50 border border-red-200">
              <div className="text-2xl font-bold text-red-700">{negativeCount}</div>
              <div className="text-sm text-red-600">Negativ ({negativePercent.toFixed(1)}%)</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-gray-50 border border-gray-200">
              <div className="text-2xl font-bold text-gray-700">{neutralCount}</div>
              <div className="text-sm text-gray-600">Neutral ({neutralPercent.toFixed(1)}%)</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-blue-50 border border-blue-200">
              <div className="text-2xl font-bold text-blue-700">{mixedCount}</div>
              <div className="text-sm text-blue-600">Blandad ({mixedPercent.toFixed(1)}%)</div>
            </div>
          </div>

          {/* Sentiment Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm font-medium">
              <span>Sentimentfördelning</span>
              <span>{totalFeedback} total</span>
            </div>
            <div className="flex h-3 rounded-full overflow-hidden bg-gray-200">
              <div className="bg-green-500" style={{ width: `${positivePercent}%` }}></div>
              <div className="bg-red-500" style={{ width: `${negativePercent}%` }}></div>
              <div className="bg-gray-400" style={{ width: `${neutralPercent}%` }}></div>
              <div className="bg-blue-500" style={{ width: `${mixedPercent}%` }}></div>
            </div>
            <div className="flex justify-between text-xs text-gray-600">
              <span>Positiv</span>
              <span>Negativ</span>
              <span>Neutral</span>
              <span>Blandad</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Positive Summary */}
      {report.positive_summary && (
        <Card>
          <CardHeader>
            <Button
              variant="ghost"
              onClick={() => toggleSection('positive')}
              className="w-full justify-between p-0 h-auto hover:bg-transparent"
            >
              <CardTitle className="flex items-center gap-2 text-green-700">
                <TrendingUp className="h-5 w-5" />
                Positiv feedback-sammanfattning
              </CardTitle>
              {expandedSections.positive ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CardHeader>
          {expandedSections.positive && (
            <CardContent>
              <p className="text-gray-700 leading-relaxed">{report.positive_summary}</p>
            </CardContent>
          )}
        </Card>
      )}

      {/* Negative Summary */}
      {report.negative_summary && (
        <Card>
          <CardHeader>
            <Button
              variant="ghost"
              onClick={() => toggleSection('negative')}
              className="w-full justify-between p-0 h-auto hover:bg-transparent"
            >
              <CardTitle className="flex items-center gap-2 text-red-700">
                <TrendingDown className="h-5 w-5" />
                Negativ feedback-sammanfattning
              </CardTitle>
              {expandedSections.negative ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CardHeader>
          {expandedSections.negative && (
            <CardContent>
              <p className="text-gray-700 leading-relaxed">{report.negative_summary}</p>
            </CardContent>
          )}
        </Card>
      )}

      {/* General Opinions */}
      {report.general_opinions && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Allmänna åsikter
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 leading-relaxed">{report.general_opinions}</p>
          </CardContent>
        </Card>
      )}

      {/* New Critiques */}
      {report.new_critiques && report.new_critiques.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-600" />
              Nya kritikpunkter
            </CardTitle>
            <CardDescription>
              Nya problem som identifierats denna vecka
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {report.new_critiques.map((critique, index) => (
                <li key={index} className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <AlertCircle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">{critique}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Actionable Insights */}
      {report.actionable_insights && report.actionable_insights.length > 0 && (
        <Card>
          <CardHeader>
            <Button
              variant="ghost"
              onClick={() => toggleSection('insights')}
              className="w-full justify-between p-0 h-auto hover:bg-transparent"
            >
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Åtgärdsbara insights ({report.actionable_insights.length})
              </CardTitle>
              {expandedSections.insights ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CardHeader>
          {expandedSections.insights && (
            <CardContent>
              <div className="space-y-4">
                {report.actionable_insights.map((insight, index) => (
                  <div key={index} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-gray-900">{insight.title}</h4>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant="secondary" 
                          className={`${getPriorityColor(insight.priority)} text-white`}
                        >
                          {insight.priority}
                        </Badge>
                        <Badge variant="outline">{insight.department}</Badge>
                      </div>
                    </div>
                    <p className="text-gray-700 mb-3">{insight.description}</p>
                    {insight.suggested_actions && insight.suggested_actions.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-gray-600 mb-2">Föreslagna åtgärder:</p>
                        <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                          {insight.suggested_actions.map((action, actionIndex) => (
                            <li key={actionIndex}>{action}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Department Breakdown */}
      <Card>
        <CardHeader>
          <Button
            variant="ghost"
            onClick={() => toggleSection('departments')}
            className="w-full justify-between p-0 h-auto hover:bg-transparent"
          >
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Avdelningsuppdelning
            </CardTitle>
            {expandedSections.departments ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </CardHeader>
        {expandedSections.departments && (
          <CardContent>
            <div className="space-y-4">
              {departmentStats.map((dept, index) => {
                const positivePercent = dept.total_count > 0 ? (dept.positive_count / dept.total_count) * 100 : 0;
                const negativePercent = dept.total_count > 0 ? (dept.negative_count / dept.total_count) * 100 : 0;
                
                return (
                  <div key={index} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold">{dept.department}</h4>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-gray-600">{dept.total_count} feedback</span>
                        <Badge variant="outline">
                          Snitt: {dept.avg_score.toFixed(1)}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="flex h-2 rounded-full overflow-hidden bg-gray-200 mb-2">
                      <div 
                        className="bg-green-500" 
                        style={{ width: `${positivePercent}%` }}
                      ></div>
                      <div 
                        className="bg-red-500" 
                        style={{ width: `${negativePercent}%` }}
                      ></div>
                    </div>
                    
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>{dept.positive_count} positiv ({positivePercent.toFixed(0)}%)</span>
                      <span>{dept.negative_count} negativ ({negativePercent.toFixed(0)}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}