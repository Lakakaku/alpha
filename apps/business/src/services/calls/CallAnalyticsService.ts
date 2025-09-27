export interface CallMetrics {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  averageDuration: number;
  totalCost: number;
  averageCost: number;
  successRate: number;
}

export interface QuestionMetrics {
  questionId: string;
  questionText: string;
  totalAsked: number;
  totalAnswered: number;
  responseRate: number;
  averageConfidence: number;
  sentimentDistribution: {
    positive: number;
    neutral: number;
    negative: number;
  };
  commonResponses: Array<{
    response: string;
    count: number;
    percentage: number;
  }>;
}

export interface ProviderMetrics {
  providerId: string;
  totalCalls: number;
  successfulCalls: number;
  totalCost: number;
  averageCost: number;
  averageDuration: number;
  successRate: number;
  reliability: number; // Based on connection success
}

export interface TimeSeriesData {
  timestamp: string;
  calls: number;
  success: number;
  cost: number;
  duration: number;
}

export interface CallAnalyticsData {
  period: {
    start: string;
    end: string;
  };
  overview: CallMetrics;
  questionAnalytics: QuestionMetrics[];
  providerComparison: ProviderMetrics[];
  timeSeries: TimeSeriesData[];
  insights: Array<{
    type: 'success' | 'warning' | 'info';
    title: string;
    description: string;
    metric?: string;
    value?: string | number;
  }>;
}

export class CallAnalyticsService {
  private baseUrl: string;
  private businessId: string;

  constructor(businessId: string) {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
    this.businessId = businessId;
  }

  /**
   * Get analytics data for a specific time period
   */
  async getAnalytics(startDate: Date, endDate: Date): Promise<CallAnalyticsData> {
    try {
      const params = new URLSearchParams({
        businessId: this.businessId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });

      const response = await fetch(`${this.baseUrl}/analytics/calls?${params}`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch analytics data');
      }

      return await response.json();
    } catch (error) {
      console.error('Analytics fetch error:', error);
      // Return mock data for development
      return this.getMockAnalyticsData(startDate, endDate);
    }
  }

  /**
   * Get real-time call statistics
   */
  async getRealTimeStats(): Promise<{
    activeCalls: number;
    queuedCalls: number;
    completedToday: number;
    costToday: number;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/analytics/calls/realtime?businessId=${this.businessId}`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch real-time stats');
      }

      return await response.json();
    } catch (error) {
      console.error('Real-time stats fetch error:', error);
      return {
        activeCalls: 2,
        queuedCalls: 0,
        completedToday: 15,
        costToday: 2.34
      };
    }
  }

  /**
   * Get detailed question performance analytics
   */
  async getQuestionAnalytics(questionId?: string): Promise<QuestionMetrics[]> {
    try {
      const params = new URLSearchParams({
        businessId: this.businessId
      });

      if (questionId) {
        params.append('questionId', questionId);
      }

      const response = await fetch(`${this.baseUrl}/analytics/questions?${params}`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch question analytics');
      }

      return await response.json();
    } catch (error) {
      console.error('Question analytics fetch error:', error);
      return this.getMockQuestionAnalytics();
    }
  }

  /**
   * Get cost breakdown and trends
   */
  async getCostAnalytics(period: 'day' | 'week' | 'month' = 'week'): Promise<{
    totalCost: number;
    costByProvider: Record<string, number>;
    costByDay: Array<{ date: string; cost: number }>;
    projectedMonthlyCost: number;
    costEfficiency: {
      costPerSuccessfulCall: number;
      costPerQuestion: number;
      costPerMinute: number;
    };
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/analytics/costs?businessId=${this.businessId}&period=${period}`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch cost analytics');
      }

      return await response.json();
    } catch (error) {
      console.error('Cost analytics fetch error:', error);
      return this.getMockCostAnalytics();
    }
  }

  /**
   * Generate insights and recommendations
   */
  async getInsights(): Promise<Array<{
    type: 'success' | 'warning' | 'info' | 'error';
    title: string;
    description: string;
    actionable?: boolean;
    action?: string;
  }>> {
    try {
      const analytics = await this.getAnalytics(
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        new Date()
      );

      const insights = [];

      // Success rate insights
      if (analytics.overview.successRate >= 90) {
        insights.push({
          type: 'success' as const,
          title: 'Excellent Success Rate',
          description: `Your calls have a ${analytics.overview.successRate.toFixed(1)}% success rate, which is excellent!`
        });
      } else if (analytics.overview.successRate < 70) {
        insights.push({
          type: 'warning' as const,
          title: 'Low Success Rate',
          description: `Your success rate is ${analytics.overview.successRate.toFixed(1)}%. Consider reviewing question difficulty or timing.`,
          actionable: true,
          action: 'Review Questions'
        });
      }

      // Cost efficiency insights
      const avgCost = analytics.overview.averageCost;
      if (avgCost > 0.20) {
        insights.push({
          type: 'warning' as const,
          title: 'High Average Cost',
          description: `Average cost per call is $${avgCost.toFixed(3)}. Consider optimizing call duration or provider selection.`,
          actionable: true,
          action: 'Optimize Costs'
        });
      }

      // Provider performance insights
      const providers = analytics.providerComparison;
      if (providers.length > 1) {
        const bestProvider = providers.reduce((best, current) => 
          current.successRate > best.successRate ? current : best
        );
        
        insights.push({
          type: 'info' as const,
          title: 'Provider Performance',
          description: `${bestProvider.providerId} has the highest success rate at ${bestProvider.successRate.toFixed(1)}%.`
        });
      }

      // Question performance insights
      const poorPerformingQuestions = analytics.questionAnalytics.filter(q => q.responseRate < 0.8);
      if (poorPerformingQuestions.length > 0) {
        insights.push({
          type: 'warning' as const,
          title: 'Low Response Rate Questions',
          description: `${poorPerformingQuestions.length} questions have response rates below 80%. Consider revising them.`,
          actionable: true,
          action: 'Edit Questions'
        });
      }

      return insights;
    } catch (error) {
      console.error('Insights generation error:', error);
      return [];
    }
  }

  /**
   * Export analytics data to CSV
   */
  async exportToCsv(startDate: Date, endDate: Date): Promise<string> {
    const analytics = await this.getAnalytics(startDate, endDate);
    
    let csv = 'Date,Calls,Successful,Failed,Cost,Average Duration\n';
    
    analytics.timeSeries.forEach(data => {
      csv += `${data.timestamp},${data.calls},${data.success},${data.calls - data.success},$${data.cost.toFixed(3)},${data.duration}s\n`;
    });

    return csv;
  }

  private getAuthToken(): string {
    // In a real implementation, get from secure storage
    return localStorage.getItem('auth_token') || '';
  }

  private getMockAnalyticsData(startDate: Date, endDate: Date): CallAnalyticsData {
    return {
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      overview: {
        totalCalls: 45,
        successfulCalls: 38,
        failedCalls: 7,
        averageDuration: 95,
        totalCost: 6.75,
        averageCost: 0.15,
        successRate: 84.4
      },
      questionAnalytics: this.getMockQuestionAnalytics(),
      providerComparison: [
        {
          providerId: 'fortyelks',
          totalCalls: 30,
          successfulCalls: 27,
          totalCost: 4.50,
          averageCost: 0.15,
          averageDuration: 92,
          successRate: 90.0,
          reliability: 95.0
        },
        {
          providerId: 'twilio',
          totalCalls: 15,
          successfulCalls: 11,
          totalCost: 2.25,
          averageCost: 0.15,
          averageDuration: 102,
          successRate: 73.3,
          reliability: 88.0
        }
      ],
      timeSeries: this.getMockTimeSeriesData(),
      insights: [
        {
          type: 'success',
          title: 'Strong Performance',
          description: 'Your call success rate is above the industry average of 75%.',
          metric: 'Success Rate',
          value: '84.4%'
        },
        {
          type: 'info',
          title: 'Cost Efficient',
          description: 'Average cost per call is within optimal range.',
          metric: 'Average Cost',
          value: '$0.15'
        }
      ]
    };
  }

  private getMockQuestionAnalytics(): QuestionMetrics[] {
    return [
      {
        questionId: 'q1',
        questionText: 'Hur nöjd är du med vår service på en skala från 1-5?',
        totalAsked: 45,
        totalAnswered: 42,
        responseRate: 0.93,
        averageConfidence: 0.87,
        sentimentDistribution: {
          positive: 28,
          neutral: 12,
          negative: 2
        },
        commonResponses: [
          { response: '4', count: 18, percentage: 42.9 },
          { response: '5', count: 12, percentage: 28.6 },
          { response: '3', count: 8, percentage: 19.0 }
        ]
      },
      {
        questionId: 'q2',
        questionText: 'Vad kan vi förbättra?',
        totalAsked: 42,
        totalAnswered: 35,
        responseRate: 0.83,
        averageConfidence: 0.72,
        sentimentDistribution: {
          positive: 5,
          neutral: 20,
          negative: 10
        },
        commonResponses: [
          { response: 'Snabbare service', count: 12, percentage: 34.3 },
          { response: 'Bättre kommunikation', count: 8, percentage: 22.9 },
          { response: 'Lägre priser', count: 6, percentage: 17.1 }
        ]
      }
    ];
  }

  private getMockTimeSeriesData(): TimeSeriesData[] {
    const data = [];
    const now = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      data.push({
        timestamp: date.toISOString().split('T')[0],
        calls: Math.floor(Math.random() * 10) + 5,
        success: Math.floor(Math.random() * 8) + 4,
        cost: Math.random() * 2 + 0.5,
        duration: Math.floor(Math.random() * 30) + 80
      });
    }
    
    return data;
  }

  private getMockCostAnalytics() {
    return {
      totalCost: 6.75,
      costByProvider: {
        fortyelks: 4.50,
        twilio: 2.25
      },
      costByDay: this.getMockTimeSeriesData().map(d => ({
        date: d.timestamp,
        cost: d.cost
      })),
      projectedMonthlyCost: 85.50,
      costEfficiency: {
        costPerSuccessfulCall: 0.178,
        costPerQuestion: 0.064,
        costPerMinute: 0.0105
      }
    };
  }
}