import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { FeedbackProcessor } from '../../../../apps/backend/src/services/feedback-analysis/feedback-processor';
import { FeedbackSessionModel, FeedbackAnalysisModel } from '@vocilia/database';
import { OpenAIService } from '../../../../apps/backend/src/services/openai';
import { FeedbackSession, FeedbackAnalysis, AIFeedbackEvaluation } from '@vocilia/types';

// Mock dependencies
jest.mock('@vocilia/database');
jest.mock('../../../../apps/backend/src/services/openai');

const mockFeedbackSessionModel = FeedbackSessionModel as jest.Mocked<typeof FeedbackSessionModel>;
const mockFeedbackAnalysisModel = FeedbackAnalysisModel as jest.Mocked<typeof FeedbackAnalysisModel>;
const mockOpenAIService = OpenAIService as jest.MockedClass<typeof OpenAIService>;

describe('FeedbackProcessor', () => {
  let feedbackProcessor: FeedbackProcessor;
  let mockOpenAI: jest.Mocked<OpenAIService>;

  const mockFeedbackSession: FeedbackSession = {
    id: 'session-123',
    userId: 'user-456',
    storeId: 'store-789',
    callId: 'call-abc',
    transcript: 'Jag var mycket nöjd med servicen. Personalen var vänlig och hjälpsam.',
    duration: 45000, // 45 seconds
    quality: 'high',
    language: 'sv-SE',
    createdAt: new Date('2024-01-15T10:30:00Z'),
    updatedAt: new Date('2024-01-15T10:30:00Z')
  };

  beforeEach(() => {
    mockOpenAI = new mockOpenAIService() as jest.Mocked<OpenAIService>;
    feedbackProcessor = new FeedbackProcessor(mockOpenAI);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('processFeedback', () => {
    const mockAIEvaluation: AIFeedbackEvaluation = {
      overallScore: 85,
      sentiment: 'positive',
      categories: {
        service: { score: 90, mentioned: true },
        product: { score: 80, mentioned: false },
        environment: { score: 75, mentioned: true },
        value: { score: 85, mentioned: false }
      },
      qualityIndicators: {
        specificExamples: true,
        detailedFeedback: true,
        constructiveComments: true,
        authenticity: 0.92
      },
      flaggedIssues: [],
      language: 'sv-SE',
      confidence: 0.88
    };

    it('should successfully process valid feedback', async () => {
      mockFeedbackSessionModel.findById.mockResolvedValue(mockFeedbackSession);
      mockOpenAI.evaluateFeedback.mockResolvedValue(mockAIEvaluation);
      
      const mockAnalysis: FeedbackAnalysis = {
        id: 'analysis-123',
        sessionId: mockFeedbackSession.id,
        overallScore: mockAIEvaluation.overallScore,
        sentiment: mockAIEvaluation.sentiment,
        categories: mockAIEvaluation.categories,
        qualityIndicators: mockAIEvaluation.qualityIndicators,
        flaggedIssues: mockAIEvaluation.flaggedIssues,
        rewardEligible: true,
        rewardPercentage: 12, // Based on score of 85
        processingStatus: 'completed',
        confidence: mockAIEvaluation.confidence,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockFeedbackAnalysisModel.create.mockResolvedValue(mockAnalysis);

      const result = await feedbackProcessor.processFeedback(mockFeedbackSession.id);

      expect(result.success).toBe(true);
      expect(result.analysis).toEqual(mockAnalysis);
      expect(mockOpenAI.evaluateFeedback).toHaveBeenCalledWith(
        mockFeedbackSession.transcript,
        mockFeedbackSession.language
      );
    });

    it('should calculate reward percentage based on score', async () => {
      mockFeedbackSessionModel.findById.mockResolvedValue(mockFeedbackSession);
      
      // Test different score ranges
      const testCases = [
        { score: 95, expectedReward: 15 }, // 95 -> 15% (max)
        { score: 85, expectedReward: 12 }, // 85 -> 12%
        { score: 75, expectedReward: 9 },  // 75 -> 9%
        { score: 65, expectedReward: 6 },  // 65 -> 6%
        { score: 55, expectedReward: 3 },  // 55 -> 3%
        { score: 50, expectedReward: 2 },  // 50 -> 2% (min)
        { score: 45, expectedReward: 0 }   // Below threshold -> 0%
      ];

      for (const testCase of testCases) {
        const evaluation = { ...mockAIEvaluation, overallScore: testCase.score };
        mockOpenAI.evaluateFeedback.mockResolvedValue(evaluation);
        mockFeedbackAnalysisModel.create.mockResolvedValue({} as FeedbackAnalysis);

        await feedbackProcessor.processFeedback(mockFeedbackSession.id);

        const createCall = mockFeedbackAnalysisModel.create.mock.calls.slice(-1)[0][0];
        expect(createCall.rewardPercentage).toBe(testCase.expectedReward);
        expect(createCall.rewardEligible).toBe(testCase.expectedReward > 0);
      }
    });

    it('should flag low confidence evaluations', async () => {
      mockFeedbackSessionModel.findById.mockResolvedValue(mockFeedbackSession);
      
      const lowConfidenceEvaluation = {
        ...mockAIEvaluation,
        confidence: 0.45 // Below 0.5 threshold
      };
      
      mockOpenAI.evaluateFeedback.mockResolvedValue(lowConfidenceEvaluation);
      mockFeedbackAnalysisModel.create.mockResolvedValue({} as FeedbackAnalysis);

      await feedbackProcessor.processFeedback(mockFeedbackSession.id);

      const createCall = mockFeedbackAnalysisModel.create.mock.calls[0][0];
      expect(createCall.flaggedIssues).toContain('low_confidence');
      expect(createCall.rewardEligible).toBe(false);
    });

    it('should detect potentially fraudulent feedback', async () => {
      const suspiciousFeedback = {
        ...mockFeedbackSession,
        transcript: 'Bra bra bra bra bra.' // Repetitive, low-quality
      };

      mockFeedbackSessionModel.findById.mockResolvedValue(suspiciousFeedback);
      
      const fraudulentEvaluation = {
        ...mockAIEvaluation,
        qualityIndicators: {
          specificExamples: false,
          detailedFeedback: false,
          constructiveComments: false,
          authenticity: 0.25 // Very low authenticity
        },
        flaggedIssues: ['repetitive_content', 'low_authenticity']
      };
      
      mockOpenAI.evaluateFeedback.mockResolvedValue(fraudulentEvaluation);
      mockFeedbackAnalysisModel.create.mockResolvedValue({} as FeedbackAnalysis);

      await feedbackProcessor.processFeedback(mockFeedbackSession.id);

      const createCall = mockFeedbackAnalysisModel.create.mock.calls[0][0];
      expect(createCall.flaggedIssues).toEqual(['repetitive_content', 'low_authenticity']);
      expect(createCall.rewardEligible).toBe(false);
    });

    it('should handle transcript too short for analysis', async () => {
      const shortFeedback = {
        ...mockFeedbackSession,
        transcript: 'Bra.',
        duration: 2000 // 2 seconds
      };

      mockFeedbackSessionModel.findById.mockResolvedValue(shortFeedback);

      const result = await feedbackProcessor.processFeedback(mockFeedbackSession.id);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Feedback too short for meaningful analysis');
      expect(mockOpenAI.evaluateFeedback).not.toHaveBeenCalled();
    });

    it('should handle AI service errors gracefully', async () => {
      mockFeedbackSessionModel.findById.mockResolvedValue(mockFeedbackSession);
      mockOpenAI.evaluateFeedback.mockRejectedValue(new Error('AI service unavailable'));

      const result = await feedbackProcessor.processFeedback(mockFeedbackSession.id);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to process feedback: AI service unavailable');
    });

    it('should handle non-existent feedback session', async () => {
      mockFeedbackSessionModel.findById.mockResolvedValue(null);

      const result = await feedbackProcessor.processFeedback('nonexistent-session');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Feedback session not found');
    });
  });

  describe('reprocessFeedback', () => {
    it('should reprocess existing feedback with updated analysis', async () => {
      const existingAnalysis: FeedbackAnalysis = {
        id: 'analysis-123',
        sessionId: mockFeedbackSession.id,
        overallScore: 70,
        sentiment: 'neutral',
        categories: mockAIEvaluation.categories,
        qualityIndicators: mockAIEvaluation.qualityIndicators,
        flaggedIssues: [],
        rewardEligible: true,
        rewardPercentage: 8,
        processingStatus: 'completed',
        confidence: 0.75,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockFeedbackSessionModel.findById.mockResolvedValue(mockFeedbackSession);
      mockFeedbackAnalysisModel.findBySessionId.mockResolvedValue(existingAnalysis);
      mockOpenAI.evaluateFeedback.mockResolvedValue(mockAIEvaluation);
      mockFeedbackAnalysisModel.update.mockResolvedValue({
        ...existingAnalysis,
        overallScore: mockAIEvaluation.overallScore,
        rewardPercentage: 12,
        updatedAt: new Date()
      });

      const result = await feedbackProcessor.reprocessFeedback(mockFeedbackSession.id);

      expect(result.success).toBe(true);
      expect(mockFeedbackAnalysisModel.update).toHaveBeenCalledWith(
        existingAnalysis.id,
        expect.objectContaining({
          overallScore: mockAIEvaluation.overallScore,
          rewardPercentage: 12
        })
      );
    });
  });

  describe('calculateRewardPercentage', () => {
    it('should calculate linear reward based on score range', () => {
      // Test the private method through public interface
      const testCases = [
        { score: 100, expected: 15 },
        { score: 95, expected: 15 },
        { score: 85, expected: 12 },
        { score: 75, expected: 9 },
        { score: 65, expected: 6 },
        { score: 55, expected: 3 },
        { score: 50, expected: 2 },
        { score: 45, expected: 0 },
        { score: 0, expected: 0 }
      ];

      testCases.forEach(({ score, expected }) => {
        const result = (feedbackProcessor as any).calculateRewardPercentage(score);
        expect(result).toBe(expected);
      });
    });
  });

  describe('detectFraudIndicators', () => {
    it('should identify various fraud patterns', () => {
      const fraudIndicators = [
        {
          transcript: 'Bra bra bra bra bra bra',
          description: 'repetitive content'
        },
        {
          transcript: 'Det var okej',
          description: 'too generic'
        },
        {
          transcript: 'a'.repeat(1000),
          description: 'unusually long'
        }
      ];

      fraudIndicators.forEach(({ transcript, description }) => {
        const indicators = (feedbackProcessor as any).detectFraudIndicators(transcript);
        expect(indicators.length).toBeGreaterThan(0);
      });
    });
  });
});