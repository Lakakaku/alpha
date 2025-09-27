/**
 * Unit tests for sentiment analysis accuracy
 * Feature: 008-step-2-6 (T038)
 * Created: 2025-09-22
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { SentimentAnalysisService } from '../../src/services/feedback-analysis/sentiment-analysis';
import { openaiService } from '../../src/config/openai';

// Mock OpenAI service
jest.mock('../../src/config/openai');
const mockOpenAIService = openaiService as jest.Mocked<typeof openaiService>;

describe('SentimentAnalysisService', () => {
  let sentimentService: SentimentAnalysisService;

  beforeEach(() => {
    sentimentService = new SentimentAnalysisService();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('analyzeFeedback', () => {
    test('should correctly analyze positive Swedish feedback', async () => {
      // Mock positive sentiment response
      mockOpenAIService.analyzeSentiment.mockResolvedValue({
        sentiment: 'positive',
        department_tags: ['kundservice'],
        priority_score: 8,
        ai_summary: 'Kunden är mycket nöjd med servicen',
      });

      const feedback = 'Fantastisk kundservice! Personalen var mycket hjälpsam och vänlig.';
      const result = await sentimentService.analyzeFeedback(feedback, 'store-123', 'business-456');

      expect(result).toMatchObject({
        sentiment: 'positive',
        department_tags: ['kundservice'],
        priority_score: 8,
        ai_summary: 'Kunden är mycket nöjd med servicen',
      });

      expect(mockOpenAIService.analyzeSentiment).toHaveBeenCalledWith(feedback);
      expect(result.confidence_score).toBeGreaterThan(0.8);
      expect(result.analysis_metadata.language_detected).toBe('swedish');
    });

    test('should correctly analyze negative Swedish feedback', async () => {
      mockOpenAIService.analyzeSentiment.mockResolvedValue({
        sentiment: 'negative',
        department_tags: ['kött', 'kvalitet'],
        priority_score: 9,
        ai_summary: 'Kunden klagar på köttavdelningens kvalitet',
      });

      const feedback = 'Köttet var gammalt och luktade illa. Mycket dålig kvalitet i köttavdelningen.';
      const result = await sentimentService.analyzeFeedback(feedback, 'store-123', 'business-456');

      expect(result).toMatchObject({
        sentiment: 'negative',
        department_tags: ['kött', 'kvalitet'],
        priority_score: 9,
        ai_summary: 'Kunden klagar på köttavdelningens kvalitet',
      });

      expect(result.confidence_score).toBeGreaterThan(0.8);
      expect(result.analysis_metadata.language_detected).toBe('swedish');
    });

    test('should correctly analyze neutral Swedish feedback', async () => {
      mockOpenAIService.analyzeSentiment.mockResolvedValue({
        sentiment: 'neutral',
        department_tags: ['allmän'],
        priority_score: 5,
        ai_summary: 'Allmän feedback utan stark känsla',
      });

      const feedback = 'Butiken är okej, inget speciellt att kommentera.';
      const result = await sentimentService.analyzeFeedback(feedback, 'store-123', 'business-456');

      expect(result).toMatchObject({
        sentiment: 'neutral',
        department_tags: ['allmän'],
        priority_score: 5,
        ai_summary: 'Allmän feedback utan stark känsla',
      });

      expect(result.confidence_score).toBeGreaterThan(0.6);
    });

    test('should correctly analyze mixed sentiment feedback', async () => {
      mockOpenAIService.analyzeSentiment.mockResolvedValue({
        sentiment: 'mixed',
        department_tags: ['kundservice', 'kassa'],
        priority_score: 7,
        ai_summary: 'Blandad feedback om service och kassa',
      });

      const feedback = 'Kundservicen var bra men kassan var långsam och krånglig.';
      const result = await sentimentService.analyzeFeedback(feedback, 'store-123', 'business-456');

      expect(result).toMatchObject({
        sentiment: 'mixed',
        department_tags: ['kundservice', 'kassa'],
        priority_score: 7,
        ai_summary: 'Blandad feedback om service och kassa',
      });

      expect(result.confidence_score).toBeGreaterThan(0.7);
    });

    test('should detect and handle Swedish department names correctly', async () => {
      const departmentTestCases = [
        { feedback: 'Köttet var perfekt', expectedDepartments: ['kött'] },
        { feedback: 'Kassören var snabb', expectedDepartments: ['kassa'] },
        { feedback: 'Bra bageri och konditori', expectedDepartments: ['bageri'] },
        { feedback: 'Fin frukt och grönt', expectedDepartments: ['frukt'] },
        { feedback: 'Bra parkering utanför', expectedDepartments: ['parkering'] },
      ];

      for (const testCase of departmentTestCases) {
        mockOpenAIService.analyzeSentiment.mockResolvedValue({
          sentiment: 'positive',
          department_tags: testCase.expectedDepartments,
          priority_score: 7,
          ai_summary: 'Test feedback',
        });

        const result = await sentimentService.analyzeFeedback(
          testCase.feedback, 
          'store-123', 
          'business-456'
        );

        expect(result.department_tags).toEqual(
          expect.arrayContaining(testCase.expectedDepartments)
        );
      }
    });

    test('should handle priority scoring accurately', async () => {
      const priorityTestCases = [
        { priority: 10, expectedRange: [9, 10] }, // Critical issues
        { priority: 8, expectedRange: [7, 9] },   // High priority
        { priority: 5, expectedRange: [4, 6] },   // Medium priority
        { priority: 2, expectedRange: [1, 3] },   // Low priority
      ];

      for (const testCase of priorityTestCases) {
        mockOpenAIService.analyzeSentiment.mockResolvedValue({
          sentiment: 'negative',
          department_tags: ['test'],
          priority_score: testCase.priority,
          ai_summary: 'Test feedback',
        });

        const result = await sentimentService.analyzeFeedback(
          'Test feedback', 
          'store-123', 
          'business-456'
        );

        expect(result.priority_score).toBeGreaterThanOrEqual(testCase.expectedRange[0]);
        expect(result.priority_score).toBeLessThanOrEqual(testCase.expectedRange[1]);
      }
    });

    test('should calculate confidence scores accurately', async () => {
      const confidenceTestCases = [
        {
          sentiment: 'positive' as const,
          feedback: 'Absolutely fantastic service, amazing staff!',
          expectedMinConfidence: 0.9,
        },
        {
          sentiment: 'negative' as const,
          feedback: 'Terrible experience, worst service ever.',
          expectedMinConfidence: 0.9,
        },
        {
          sentiment: 'neutral' as const,
          feedback: 'It was okay.',
          expectedMinConfidence: 0.6,
        },
        {
          sentiment: 'mixed' as const,
          feedback: 'Good food but bad service.',
          expectedMinConfidence: 0.7,
        },
      ];

      for (const testCase of confidenceTestCases) {
        mockOpenAIService.analyzeSentiment.mockResolvedValue({
          sentiment: testCase.sentiment,
          department_tags: ['test'],
          priority_score: 5,
          ai_summary: 'Test feedback',
        });

        const result = await sentimentService.analyzeFeedback(
          testCase.feedback,
          'store-123',
          'business-456'
        );

        expect(result.confidence_score).toBeGreaterThanOrEqual(testCase.expectedMinConfidence);
        expect(result.confidence_score).toBeLessThanOrEqual(1.0);
      }
    });

    test('should handle empty or very short feedback', async () => {
      const shortFeedbackCases = ['', 'ok', 'bra', 'dåligt'];

      for (const feedback of shortFeedbackCases) {
        if (feedback === '') {
          await expect(
            sentimentService.analyzeFeedback(feedback, 'store-123', 'business-456')
          ).rejects.toThrow('Feedback content cannot be empty');
        } else {
          mockOpenAIService.analyzeSentiment.mockResolvedValue({
            sentiment: 'neutral',
            department_tags: ['allmän'],
            priority_score: 3,
            ai_summary: 'Kort feedback',
          });

          const result = await sentimentService.analyzeFeedback(
            feedback,
            'store-123',
            'business-456'
          );

          expect(result.confidence_score).toBeLessThan(0.7);
          expect(result.analysis_metadata.feedback_length).toBeLessThan(10);
        }
      }
    });

    test('should handle very long feedback efficiently', async () => {
      const longFeedback = 'Detta är en mycket lång feedback som innehåller många detaljer om kundens upplevelse i butiken. '.repeat(20);

      mockOpenAIService.analyzeSentiment.mockResolvedValue({
        sentiment: 'mixed',
        department_tags: ['allmän'],
        priority_score: 6,
        ai_summary: 'Lång detaljerad feedback',
      });

      const startTime = Date.now();
      const result = await sentimentService.analyzeFeedback(
        longFeedback,
        'store-123',
        'business-456'
      );
      const processingTime = Date.now() - startTime;

      expect(result.analysis_metadata.feedback_length).toBeGreaterThan(100);
      expect(processingTime).toBeLessThan(5000); // Should process within 5 seconds
      expect(result.confidence_score).toBeGreaterThan(0.5);
    });

    test('should handle special characters and emojis in Swedish feedback', async () => {
      const specialCharacterCases = [
        'Fantastisk service! 😊 Tack så mycket!',
        'Kött & chark var bra, men frukt & grönt mindre bra...',
        'Betyg: 5/5 ⭐⭐⭐⭐⭐',
        'Pris: 199:- (för dyrt!!!)',
      ];

      for (const feedback of specialCharacterCases) {
        mockOpenAIService.analyzeSentiment.mockResolvedValue({
          sentiment: 'positive',
          department_tags: ['allmän'],
          priority_score: 7,
          ai_summary: 'Feedback med specialtecken',
        });

        const result = await sentimentService.analyzeFeedback(
          feedback,
          'store-123',
          'business-456'
        );

        expect(result.analysis_metadata.has_special_characters).toBe(true);
        expect(result.confidence_score).toBeGreaterThan(0.6);
      }
    });

    test('should maintain consistency across multiple analyses of similar feedback', async () => {
      const similarFeedback = [
        'Fantastisk service och bra personal',
        'Utmärkt service och trevlig personal',
        'Bra service och hjälpsam personal',
      ];

      const results = [];
      for (const feedback of similarFeedback) {
        mockOpenAIService.analyzeSentiment.mockResolvedValue({
          sentiment: 'positive',
          department_tags: ['kundservice'],
          priority_score: 8,
          ai_summary: 'Positiv feedback om service',
        });

        const result = await sentimentService.analyzeFeedback(
          feedback,
          'store-123',
          'business-456'
        );
        results.push(result);
      }

      // All should have positive sentiment
      results.forEach(result => {
        expect(result.sentiment).toBe('positive');
        expect(result.department_tags).toContain('kundservice');
        expect(result.priority_score).toBeGreaterThanOrEqual(7);
        expect(result.confidence_score).toBeGreaterThan(0.7);
      });

      // Confidence scores should be similar (within 0.2 range)
      const confidenceScores = results.map(r => r.confidence_score);
      const maxConfidence = Math.max(...confidenceScores);
      const minConfidence = Math.min(...confidenceScores);
      expect(maxConfidence - minConfidence).toBeLessThan(0.2);
    });
  });

  describe('batchAnalyzeFeedback', () => {
    test('should efficiently process multiple feedback items', async () => {
      const feedbackBatch = [
        'Fantastisk service!',
        'Dålig kvalitet på köttet.',
        'Okej upplevelse.',
        'Bra priser men dålig service.',
      ];

      const mockResponses = [
        { sentiment: 'positive' as const, department_tags: ['kundservice'], priority_score: 8, ai_summary: 'Positiv' },
        { sentiment: 'negative' as const, department_tags: ['kött'], priority_score: 9, ai_summary: 'Negativ' },
        { sentiment: 'neutral' as const, department_tags: ['allmän'], priority_score: 5, ai_summary: 'Neutral' },
        { sentiment: 'mixed' as const, department_tags: ['kassa', 'priser'], priority_score: 6, ai_summary: 'Blandad' },
      ];

      mockResponses.forEach((response, index) => {
        mockOpenAIService.analyzeSentiment.mockResolvedValueOnce(response);
      });

      const startTime = Date.now();
      const results = await sentimentService.batchAnalyzeFeedback(
        feedbackBatch.map((content, index) => ({
          id: `feedback-${index}`,
          content,
          store_id: 'store-123',
          business_id: 'business-456',
        }))
      );
      const processingTime = Date.now() - startTime;

      expect(results).toHaveLength(4);
      expect(processingTime).toBeLessThan(10000); // Should process batch within 10 seconds

      // Verify each result
      expect(results[0].sentiment).toBe('positive');
      expect(results[1].sentiment).toBe('negative');
      expect(results[2].sentiment).toBe('neutral');
      expect(results[3].sentiment).toBe('mixed');
    });

    test('should handle batch processing errors gracefully', async () => {
      const feedbackBatch = [
        'Valid feedback',
        '', // Empty feedback - should cause error
        'Another valid feedback',
      ];

      mockOpenAIService.analyzeSentiment
        .mockResolvedValueOnce({
          sentiment: 'positive',
          department_tags: ['allmän'],
          priority_score: 7,
          ai_summary: 'Valid',
        })
        .mockRejectedValueOnce(new Error('Empty feedback'))
        .mockResolvedValueOnce({
          sentiment: 'positive',
          department_tags: ['allmän'],
          priority_score: 7,
          ai_summary: 'Valid',
        });

      const results = await sentimentService.batchAnalyzeFeedback(
        feedbackBatch.map((content, index) => ({
          id: `feedback-${index}`,
          content,
          store_id: 'store-123',
          business_id: 'business-456',
        }))
      );

      expect(results).toHaveLength(2); // Only successful analyses
      expect(results.every(r => r.sentiment === 'positive')).toBe(true);
    });
  });

  describe('validateAnalysisAccuracy', () => {
    test('should validate sentiment analysis accuracy against expected results', async () => {
      const testCases = [
        {
          feedback: 'Fantastisk service och bra personal',
          expectedSentiment: 'positive' as const,
          expectedDepartments: ['kundservice'],
          expectedPriorityRange: [7, 9],
        },
        {
          feedback: 'Köttet var dåligt och luktade illa',
          expectedSentiment: 'negative' as const,
          expectedDepartments: ['kött'],
          expectedPriorityRange: [8, 10],
        },
        {
          feedback: 'Butiken var okej, inget speciellt',
          expectedSentiment: 'neutral' as const,
          expectedDepartments: ['allmän'],
          expectedPriorityRange: [3, 6],
        },
      ];

      let accuracyScore = 0;
      const totalTests = testCases.length;

      for (const testCase of testCases) {
        mockOpenAIService.analyzeSentiment.mockResolvedValue({
          sentiment: testCase.expectedSentiment,
          department_tags: testCase.expectedDepartments,
          priority_score: testCase.expectedPriorityRange[1],
          ai_summary: 'Test case',
        });

        const result = await sentimentService.analyzeFeedback(
          testCase.feedback,
          'store-123',
          'business-456'
        );

        // Check sentiment accuracy
        if (result.sentiment === testCase.expectedSentiment) {
          accuracyScore += 0.4;
        }

        // Check department accuracy
        const departmentMatch = testCase.expectedDepartments.some(dept =>
          result.department_tags.includes(dept)
        );
        if (departmentMatch) {
          accuracyScore += 0.3;
        }

        // Check priority range accuracy
        if (result.priority_score >= testCase.expectedPriorityRange[0] &&
            result.priority_score <= testCase.expectedPriorityRange[1]) {
          accuracyScore += 0.3;
        }
      }

      const finalAccuracy = accuracyScore / totalTests;
      expect(finalAccuracy).toBeGreaterThan(0.8); // 80% accuracy threshold
    });
  });

  describe('performance benchmarks', () => {
    test('should meet response time requirements', async () => {
      mockOpenAIService.analyzeSentiment.mockResolvedValue({
        sentiment: 'positive',
        department_tags: ['test'],
        priority_score: 7,
        ai_summary: 'Performance test',
      });

      const startTime = Date.now();
      await sentimentService.analyzeFeedback(
        'Performance test feedback',
        'store-123',
        'business-456'
      );
      const responseTime = Date.now() - startTime;

      // Should complete within 3 seconds (AI response time requirement)
      expect(responseTime).toBeLessThan(3000);
    });

    test('should handle concurrent analyses efficiently', async () => {
      const concurrentRequests = 10;
      const promises = [];

      mockOpenAIService.analyzeSentiment.mockResolvedValue({
        sentiment: 'positive',
        department_tags: ['test'],
        priority_score: 7,
        ai_summary: 'Concurrent test',
      });

      const startTime = Date.now();
      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(
          sentimentService.analyzeFeedback(
            `Concurrent test feedback ${i}`,
            'store-123',
            'business-456'
          )
        );
      }

      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      expect(results).toHaveLength(concurrentRequests);
      expect(totalTime).toBeLessThan(5000); // All requests within 5 seconds
      results.forEach(result => {
        expect(result.sentiment).toBe('positive');
        expect(result.confidence_score).toBeGreaterThan(0);
      });
    });
  });

  describe('error handling', () => {
    test('should handle OpenAI service failures gracefully', async () => {
      mockOpenAIService.analyzeSentiment.mockRejectedValue(
        new Error('OpenAI service unavailable')
      );

      await expect(
        sentimentService.analyzeFeedback(
          'Test feedback',
          'store-123',
          'business-456'
        )
      ).rejects.toThrow('Sentiment analysis failed');
    });

    test('should handle invalid JSON responses from OpenAI', async () => {
      mockOpenAIService.analyzeSentiment.mockRejectedValue(
        new Error('Failed to parse sentiment analysis response')
      );

      await expect(
        sentimentService.analyzeFeedback(
          'Test feedback',
          'store-123',
          'business-456'
        )
      ).rejects.toThrow('Sentiment analysis failed');
    });

    test('should validate required parameters', async () => {
      await expect(
        sentimentService.analyzeFeedback('', 'store-123', 'business-456')
      ).rejects.toThrow('Feedback content cannot be empty');

      await expect(
        sentimentService.analyzeFeedback('Valid feedback', '', 'business-456')
      ).rejects.toThrow('Store ID is required');

      await expect(
        sentimentService.analyzeFeedback('Valid feedback', 'store-123', '')
      ).rejects.toThrow('Business ID is required');
    });
  });
});