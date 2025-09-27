/**
 * Unit tests for temporal comparison logic
 * Feature: 008-step-2-6 (T040)
 * Created: 2025-09-22
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TemporalComparisonService } from '../../src/services/feedback-analysis/temporal-comparison';
import { openaiService } from '../../src/config/openai';

// Mock OpenAI service
jest.mock('../../src/config/openai');
const mockOpenAIService = openaiService as jest.Mocked<typeof openaiService>;

// Mock Supabase client
const mockSupabase = {
  from: jest.fn(),
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => mockSupabase,
}));

describe('TemporalComparisonService', () => {
  let temporalService: TemporalComparisonService;

  beforeEach(() => {
    temporalService = new TemporalComparisonService();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('compareWeeks', () => {
    test('should correctly identify new issues appearing in current week', async () => {
      const currentWeekData = [
        { content: 'Köttet var gammalt', sentiment: 'negative', department_tags: ['kött'] },
        { content: 'Kassan var långsam', sentiment: 'negative', department_tags: ['kassa'] },
        { content: 'Bra kundservice', sentiment: 'positive', department_tags: ['kundservice'] },
      ];

      const previousWeekData = [
        { content: 'Bra kundservice', sentiment: 'positive', department_tags: ['kundservice'] },
        { content: 'Bra parkering', sentiment: 'positive', department_tags: ['parkering'] },
      ];

      mockOpenAIService.analyzeTemporalComparison.mockResolvedValue({
        new_issues: ['Köttavdelningens kvalitet har försämrats', 'Kassan är nu långsammare'],
        resolved_issues: ['Parkeringssituationen inte längre kommenterad'],
        trend_direction: 'declining',
        key_changes: 'Nya kvalitetsproblem har uppstått i kött och kassa',
      });

      const result = await temporalService.compareWeeks(
        'store-123',
        'business-456',
        2025,
        38, // Current week
        37  // Previous week
      );

      expect(result.new_issues).toContain('Köttavdelningens kvalitet har försämrats');
      expect(result.new_issues).toContain('Kassan är nu långsammare');
      expect(result.trend_direction).toBe('declining');
      expect(result.comparison_metadata.current_week_feedback_count).toBe(3);
      expect(result.comparison_metadata.previous_week_feedback_count).toBe(2);
    });

    test('should correctly identify resolved issues from previous week', async () => {
      const currentWeekData = [
        { content: 'Fantastisk kundservice', sentiment: 'positive', department_tags: ['kundservice'] },
        { content: 'Bra kvalitet på kött', sentiment: 'positive', department_tags: ['kött'] },
      ];

      const previousWeekData = [
        { content: 'Köttet var dåligt', sentiment: 'negative', department_tags: ['kött'] },
        { content: 'Långsam kundservice', sentiment: 'negative', department_tags: ['kundservice'] },
        { content: 'Problem med kassan', sentiment: 'negative', department_tags: ['kassa'] },
      ];

      mockOpenAIService.analyzeTemporalComparison.mockResolvedValue({
        new_issues: [],
        resolved_issues: ['Köttavdelningens kvalitet har förbättrats', 'Kundservicen är nu snabbare', 'Inga kassaproblem denna vecka'],
        trend_direction: 'improving',
        key_changes: 'Betydande förbättringar inom alla avdelningar',
      });

      const result = await temporalService.compareWeeks(
        'store-123',
        'business-456',
        2025,
        38,
        37
      );

      expect(result.resolved_issues).toHaveLength(3);
      expect(result.resolved_issues).toContain('Köttavdelningens kvalitet har förbättrats');
      expect(result.trend_direction).toBe('improving');
    });

    test('should correctly calculate sentiment distribution changes', async () => {
      const currentWeekData = [
        { content: 'Bra service', sentiment: 'positive', department_tags: ['kundservice'] },
        { content: 'Okej kvalitet', sentiment: 'neutral', department_tags: ['allmän'] },
        { content: 'Fantastisk butik', sentiment: 'positive', department_tags: ['allmän'] },
      ];

      const previousWeekData = [
        { content: 'Dålig service', sentiment: 'negative', department_tags: ['kundservice'] },
        { content: 'Problem med kassa', sentiment: 'negative', department_tags: ['kassa'] },
      ];

      mockOpenAIService.analyzeTemporalComparison.mockResolvedValue({
        new_issues: [],
        resolved_issues: ['Servicen har förbättrats'],
        trend_direction: 'improving',
        key_changes: 'Sentiment har förbättrats markant',
      });

      const result = await temporalService.compareWeeks(
        'store-123',
        'business-456',
        2025,
        38,
        37
      );

      // Current week: 2 positive, 1 neutral, 0 negative = 66.7% positive
      expect(result.sentiment_changes.current_positive_percentage).toBeCloseTo(66.7, 1);
      
      // Previous week: 0 positive, 0 neutral, 2 negative = 0% positive
      expect(result.sentiment_changes.previous_positive_percentage).toBe(0);
      
      // Change should be +66.7 percentage points
      expect(result.sentiment_changes.positive_change).toBeCloseTo(66.7, 1);
    });

    test('should identify department-specific trends correctly', async () => {
      const currentWeekData = [
        { content: 'Köttet är nu bra', sentiment: 'positive', department_tags: ['kött'] },
        { content: 'Köttet har bra kvalitet', sentiment: 'positive', department_tags: ['kött'] },
        { content: 'Kassan är fortfarande långsam', sentiment: 'negative', department_tags: ['kassa'] },
      ];

      const previousWeekData = [
        { content: 'Dåligt kött', sentiment: 'negative', department_tags: ['kött'] },
        { content: 'Kassan är långsam', sentiment: 'negative', department_tags: ['kassa'] },
      ];

      mockOpenAIService.analyzeTemporalComparison.mockResolvedValue({
        new_issues: [],
        resolved_issues: ['Köttavdelningen har förbättrats'],
        trend_direction: 'improving',
        key_changes: 'Kött förbättrat, kassa fortfarande problematisk',
      });

      const result = await temporalService.compareWeeks(
        'store-123',
        'business-456',
        2025,
        38,
        37
      );

      // Should have department-specific analysis
      expect(result.department_trends).toBeDefined();
      expect(result.department_trends.kött.trend_direction).toBe('improving');
      expect(result.department_trends.kassa.trend_direction).toBe('stable');
    });

    test('should handle weeks with no feedback gracefully', async () => {
      const currentWeekData: any[] = [];
      const previousWeekData = [
        { content: 'Bra service', sentiment: 'positive', department_tags: ['kundservice'] },
      ];

      mockOpenAIService.analyzeTemporalComparison.mockResolvedValue({
        new_issues: [],
        resolved_issues: [],
        trend_direction: 'stable',
        key_changes: 'Ingen feedback denna vecka',
      });

      const result = await temporalService.compareWeeks(
        'store-123',
        'business-456',
        2025,
        38,
        37
      );

      expect(result.comparison_metadata.current_week_feedback_count).toBe(0);
      expect(result.trend_direction).toBe('stable');
      expect(result.key_changes).toContain('Ingen feedback');
    });

    test('should calculate confidence scores based on data volume', async () => {
      // Test with large dataset (should have high confidence)
      const largeCurrentWeek = Array(50).fill(null).map((_, i) => ({
        content: `Feedback ${i}`,
        sentiment: i % 2 === 0 ? 'positive' : 'negative',
        department_tags: ['allmän'],
      }));

      const largePreviousWeek = Array(45).fill(null).map((_, i) => ({
        content: `Previous feedback ${i}`,
        sentiment: 'negative',
        department_tags: ['allmän'],
      }));

      mockOpenAIService.analyzeTemporalComparison.mockResolvedValue({
        new_issues: [],
        resolved_issues: [],
        trend_direction: 'improving',
        key_changes: 'Förbättring baserat på stor datamängd',
      });

      const result = await temporalService.compareWeeks(
        'store-123',
        'business-456',
        2025,
        38,
        37
      );

      expect(result.confidence_score).toBeGreaterThan(0.9); // High confidence
      expect(result.comparison_metadata.statistical_significance).toBe(true);
    });

    test('should identify seasonal patterns and recurring issues', async () => {
      // Mock historical data for pattern detection
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({
                  data: [
                    { week_number: 35, negative_summary: 'Kassaproblem' },
                    { week_number: 36, negative_summary: 'Kassaproblem' },
                    { week_number: 37, negative_summary: 'Kassaproblem' },
                  ],
                }),
              }),
            }),
          }),
        }),
      });

      const currentWeekData = [
        { content: 'Kassan är långsam igen', sentiment: 'negative', department_tags: ['kassa'] },
      ];

      const previousWeekData = [
        { content: 'Kassaproblem', sentiment: 'negative', department_tags: ['kassa'] },
      ];

      mockOpenAIService.analyzeTemporalComparison.mockResolvedValue({
        new_issues: [],
        resolved_issues: [],
        trend_direction: 'stable',
        key_changes: 'Återkommande kassaproblem',
      });

      const result = await temporalService.compareWeeks(
        'store-123',
        'business-456',
        2025,
        38,
        37
      );

      expect(result.recurring_patterns).toBeDefined();
      expect(result.recurring_patterns?.some(pattern => 
        pattern.includes('kassa')
      )).toBe(true);
    });
  });

  describe('compareMultipleWeeks', () => {
    test('should analyze trends across multiple weeks correctly', async () => {
      const weeklyData = [
        {
          week: 36,
          data: [
            { content: 'Dålig kvalitet', sentiment: 'negative', department_tags: ['kött'] },
          ],
        },
        {
          week: 37,
          data: [
            { content: 'Okej kvalitet', sentiment: 'neutral', department_tags: ['kött'] },
          ],
        },
        {
          week: 38,
          data: [
            { content: 'Bra kvalitet', sentiment: 'positive', department_tags: ['kött'] },
          ],
        },
      ];

      mockOpenAIService.analyzeTemporalComparison
        .mockResolvedValueOnce({
          new_issues: [],
          resolved_issues: ['Kvaliteten förbättras'],
          trend_direction: 'improving',
          key_changes: 'Gradvis förbättring',
        })
        .mockResolvedValueOnce({
          new_issues: [],
          resolved_issues: ['Fortsatt förbättring'],
          trend_direction: 'improving', 
          key_changes: 'Stabil förbättring',
        });

      const result = await temporalService.compareMultipleWeeks(
        'store-123',
        'business-456',
        2025,
        [36, 37, 38]
      );

      expect(result.overall_trend).toBe('improving');
      expect(result.weekly_comparisons).toHaveLength(2); // 37 vs 36, 38 vs 37
      expect(result.trend_strength).toBeGreaterThan(0.7); // Strong consistent trend
    });

    test('should detect volatile trends with mixed directions', async () => {
      mockOpenAIService.analyzeTemporalComparison
        .mockResolvedValueOnce({
          new_issues: [],
          resolved_issues: [],
          trend_direction: 'improving',
          key_changes: 'Förbättring',
        })
        .mockResolvedValueOnce({
          new_issues: ['Nya problem'],
          resolved_issues: [],
          trend_direction: 'declining',
          key_changes: 'Försämring',
        })
        .mockResolvedValueOnce({
          new_issues: [],
          resolved_issues: [],
          trend_direction: 'improving',
          key_changes: 'Återförbättring',
        });

      const result = await temporalService.compareMultipleWeeks(
        'store-123',
        'business-456',
        2025,
        [35, 36, 37, 38]
      );

      expect(result.overall_trend).toBe('volatile');
      expect(result.trend_strength).toBeLessThan(0.5); // Weak/inconsistent trend
      expect(result.volatility_score).toBeGreaterThan(0.6);
    });
  });

  describe('calculateTrendMetrics', () => {
    test('should calculate linear trend slope correctly', () => {
      const dataPoints = [
        { week: 35, positive_percentage: 30 },
        { week: 36, positive_percentage: 40 },
        { week: 37, positive_percentage: 50 },
        { week: 38, positive_percentage: 60 },
      ];

      const metrics = temporalService.calculateTrendMetrics(dataPoints);

      expect(metrics.linear_slope).toBeCloseTo(10, 1); // 10% increase per week
      expect(metrics.r_squared).toBeGreaterThan(0.9); // Strong linear correlation
      expect(metrics.trend_direction).toBe('improving');
    });

    test('should identify cyclical patterns in data', () => {
      const cyclicalData = [
        { week: 35, positive_percentage: 50 },
        { week: 36, positive_percentage: 30 }, // Dip
        { week: 37, positive_percentage: 50 },
        { week: 38, positive_percentage: 30 }, // Dip
        { week: 39, positive_percentage: 50 },
      ];

      const metrics = temporalService.calculateTrendMetrics(cyclicalData);

      expect(metrics.cyclical_pattern_detected).toBe(true);
      expect(metrics.cycle_length).toBe(2); // 2-week cycle
    });

    test('should calculate moving averages for smoothing', () => {
      const noisyData = [
        { week: 35, positive_percentage: 45 },
        { week: 36, positive_percentage: 55 }, // +10
        { week: 37, positive_percentage: 40 }, // -15
        { week: 38, positive_percentage: 60 }, // +20
        { week: 39, positive_percentage: 50 }, // -10
      ];

      const metrics = temporalService.calculateTrendMetrics(noisyData, { smoothing_window: 3 });

      expect(metrics.moving_average).toBeDefined();
      expect(metrics.moving_average.length).toBe(noisyData.length);
      
      // Moving average should be smoother than raw data
      const rawVariance = temporalService.calculateVariance(
        noisyData.map(d => d.positive_percentage)
      );
      const smoothedVariance = temporalService.calculateVariance(metrics.moving_average);
      
      expect(smoothedVariance).toBeLessThan(rawVariance);
    });
  });

  describe('predictFutureTrends', () => {
    test('should predict continuation of linear trends', async () => {
      const historicalData = [
        { week: 35, positive_percentage: 40 },
        { week: 36, positive_percentage: 50 },
        { week: 37, positive_percentage: 60 },
        { week: 38, positive_percentage: 70 },
      ];

      const prediction = await temporalService.predictFutureTrends(
        'store-123',
        'business-456',
        historicalData,
        2 // Predict 2 weeks ahead
      );

      expect(prediction.predicted_weeks).toHaveLength(2);
      expect(prediction.predicted_weeks[0].week).toBe(39);
      expect(prediction.predicted_weeks[1].week).toBe(40);
      
      // Should predict continued improvement
      expect(prediction.predicted_weeks[0].positive_percentage).toBeGreaterThan(70);
      expect(prediction.predicted_weeks[1].positive_percentage).toBeGreaterThan(
        prediction.predicted_weeks[0].positive_percentage
      );
      
      expect(prediction.confidence_level).toBeGreaterThan(0.7);
    });

    test('should account for seasonal adjustments', async () => {
      // Mock seasonal data (e.g., holiday effects)
      const seasonalData = [
        { week: 48, positive_percentage: 60 }, // Normal
        { week: 49, positive_percentage: 40 }, // Pre-holiday stress
        { week: 50, positive_percentage: 30 }, // Holiday peak stress
        { week: 51, positive_percentage: 45 }, // Recovery
      ];

      const prediction = await temporalService.predictFutureTrends(
        'store-123',
        'business-456',
        seasonalData,
        3,
        { adjust_for_seasonality: true }
      );

      expect(prediction.seasonal_adjustments).toBeDefined();
      expect(prediction.predicted_weeks[0].seasonal_factor).toBeDefined();
    });

    test('should provide confidence intervals for predictions', async () => {
      const volatileData = [
        { week: 35, positive_percentage: 30 },
        { week: 36, positive_percentage: 70 },
        { week: 37, positive_percentage: 40 },
        { week: 38, positive_percentage: 60 },
      ];

      const prediction = await temporalService.predictFutureTrends(
        'store-123',
        'business-456',
        volatileData,
        1
      );

      expect(prediction.confidence_level).toBeLessThan(0.6); // Lower confidence due to volatility
      expect(prediction.predicted_weeks[0].confidence_interval).toBeDefined();
      expect(prediction.predicted_weeks[0].confidence_interval.lower).toBeLessThan(
        prediction.predicted_weeks[0].positive_percentage
      );
      expect(prediction.predicted_weeks[0].confidence_interval.upper).toBeGreaterThan(
        prediction.predicted_weeks[0].positive_percentage
      );
    });
  });

  describe('detectAnomalies', () => {
    test('should detect statistical outliers in feedback patterns', () => {
      const normalData = [
        { week: 35, positive_percentage: 50, feedback_count: 100 },
        { week: 36, positive_percentage: 52, feedback_count: 98 },
        { week: 37, positive_percentage: 48, feedback_count: 102 },
        { week: 38, positive_percentage: 85, feedback_count: 25 }, // Anomaly: high sentiment, low count
      ];

      const anomalies = temporalService.detectAnomalies(normalData);

      expect(anomalies).toHaveLength(1);
      expect(anomalies[0].week).toBe(38);
      expect(anomalies[0].anomaly_type).toBe('statistical_outlier');
      expect(anomalies[0].confidence).toBeGreaterThan(0.8);
    });

    test('should detect sudden sentiment shifts', () => {
      const shiftData = [
        { week: 35, positive_percentage: 70 },
        { week: 36, positive_percentage: 72 },
        { week: 37, positive_percentage: 25 }, // Sudden drop
        { week: 38, positive_percentage: 75 }, // Recovery
      ];

      const anomalies = temporalService.detectAnomalies(shiftData);

      const sentimentShift = anomalies.find(a => a.anomaly_type === 'sentiment_shift');
      expect(sentimentShift).toBeDefined();
      expect(sentimentShift?.week).toBe(37);
      expect(sentimentShift?.severity).toBe('high');
    });

    test('should detect volume anomalies', () => {
      const volumeData = [
        { week: 35, feedback_count: 100 },
        { week: 36, feedback_count: 105 },
        { week: 37, feedback_count: 500 }, // Volume spike
        { week: 38, feedback_count: 98 },
      ];

      const anomalies = temporalService.detectAnomalies(volumeData);

      const volumeAnomaly = anomalies.find(a => a.anomaly_type === 'volume_anomaly');
      expect(volumeAnomaly).toBeDefined();
      expect(volumeAnomaly?.week).toBe(37);
      expect(volumeAnomaly?.description).toContain('volume spike');
    });
  });

  describe('performance optimization', () => {
    test('should cache comparison results for frequently accessed periods', async () => {
      mockOpenAIService.analyzeTemporalComparison.mockResolvedValue({
        new_issues: [],
        resolved_issues: [],
        trend_direction: 'stable',
        key_changes: 'No significant changes',
      });

      // First comparison
      await temporalService.compareWeeks('store-123', 'business-456', 2025, 38, 37);
      expect(mockOpenAIService.analyzeTemporalComparison).toHaveBeenCalledTimes(1);

      // Second comparison of same period - should use cache
      await temporalService.compareWeeks('store-123', 'business-456', 2025, 38, 37);
      expect(mockOpenAIService.analyzeTemporalComparison).toHaveBeenCalledTimes(1); // Still 1
    });

    test('should handle large datasets efficiently', async () => {
      const largeDataset = Array(1000).fill(null).map((_, i) => ({
        content: `Feedback ${i}`,
        sentiment: i % 3 === 0 ? 'positive' : i % 3 === 1 ? 'negative' : 'neutral',
        department_tags: ['allmän'],
      }));

      mockOpenAIService.analyzeTemporalComparison.mockResolvedValue({
        new_issues: [],
        resolved_issues: [],
        trend_direction: 'stable',
        key_changes: 'Large dataset analysis',
      });

      const startTime = Date.now();
      await temporalService.compareWeeks('store-123', 'business-456', 2025, 38, 37);
      const processingTime = Date.now() - startTime;

      // Should process large dataset within 5 seconds
      expect(processingTime).toBeLessThan(5000);
    });
  });

  describe('error handling', () => {
    test('should handle AI service failures gracefully', async () => {
      mockOpenAIService.analyzeTemporalComparison.mockRejectedValue(
        new Error('AI service unavailable')
      );

      const result = await temporalService.compareWeeks(
        'store-123',
        'business-456',
        2025,
        38,
        37
      );

      expect(result.fallback_analysis).toBe(true);
      expect(result.trend_direction).toBe('stable'); // Default fallback
      expect(result.confidence_score).toBeLessThan(0.5); // Lower confidence
    });

    test('should validate input parameters', async () => {
      await expect(
        temporalService.compareWeeks('', 'business-456', 2025, 38, 37)
      ).rejects.toThrow('Store ID cannot be empty');

      await expect(
        temporalService.compareWeeks('store-123', 'business-456', 2025, 54, 37)
      ).rejects.toThrow('Invalid week number: 54');

      await expect(
        temporalService.compareWeeks('store-123', 'business-456', 2019, 38, 37)
      ).rejects.toThrow('Year must be between 2020 and 2050');
    });

    test('should handle missing data gracefully', async () => {
      // Mock empty data response
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({
                  data: null,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      });

      const result = await temporalService.compareWeeks(
        'store-123',
        'business-456',
        2025,
        38,
        37
      );

      expect(result.comparison_metadata.current_week_feedback_count).toBe(0);
      expect(result.comparison_metadata.previous_week_feedback_count).toBe(0);
      expect(result.trend_direction).toBe('stable');
    });
  });
});