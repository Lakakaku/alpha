/**
 * Unit Tests: Fraud Scoring Algorithm
 * Task: T072 - Unit tests for fraud scoring algorithm in apps/backend/tests/unit/fraud-scoring.test.ts
 * 
 * Tests the composite fraud scoring service algorithm including:
 * - Weighted score calculation
 * - Risk level determination
 * - Decision making logic
 * - Score breakdown generation
 * - Edge case handling
 */

import { FraudScoringService } from '../../src/services/fraud/fraudScoringService';
import { ContextAnalysisService } from '../../src/services/fraud/contextAnalysisService';
import { KeywordDetectionService } from '../../src/services/fraud/keywordDetectionService';
import { BehavioralPatternService } from '../../src/services/fraud/behavioralPatternService';
import { FraudScoreModel } from '../../../../packages/database/src/fraud/fraud-score';
import {
  CompositeFraudRequest,
  CompositeFraudResult,
  RiskLevel,
  ScoreComponents
} from '../../../../packages/types/src/fraud';

// Mock dependencies
jest.mock('../../src/services/fraud/contextAnalysisService');
jest.mock('../../src/services/fraud/keywordDetectionService');
jest.mock('../../src/services/fraud/behavioralPatternService');
jest.mock('../../../../packages/database/src/fraud/fraud-score');

const MockContextAnalysisService = ContextAnalysisService as jest.MockedClass<typeof ContextAnalysisService>;
const MockKeywordDetectionService = KeywordDetectionService as jest.MockedClass<typeof KeywordDetectionService>;
const MockBehavioralPatternService = BehavioralPatternService as jest.MockedClass<typeof BehavioralPatternService>;
const MockFraudScoreModel = FraudScoreModel as jest.MockedClass<typeof FraudScoreModel>;

describe('FraudScoringService', () => {
  let fraudScoringService: FraudScoringService;
  let mockContextService: jest.Mocked<ContextAnalysisService>;
  let mockKeywordService: jest.Mocked<KeywordDetectionService>;
  let mockBehavioralService: jest.Mocked<BehavioralPatternService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup service mocks
    mockContextService = new MockContextAnalysisService() as jest.Mocked<ContextAnalysisService>;
    mockKeywordService = new MockKeywordDetectionService() as jest.Mocked<KeywordDetectionService>;
    mockBehavioralService = new MockBehavioralPatternService() as jest.Mocked<BehavioralPatternService>;
    
    fraudScoringService = new FraudScoringService();
    
    // Mock database operations
    MockFraudScoreModel.create.mockResolvedValue({
      id: 'test-fraud-score-id',
      phone_hash: 'test-phone-hash',
      context_score: 80,
      keyword_score: 60,
      behavioral_score: 90,
      transaction_score: 40,
      composite_score: 76,
      risk_level: 'critical',
      fraud_probability: 0.76,
      analysis_metadata: {},
      processing_metadata: {}
    } as any);
  });

  describe('Weighted Score Calculation', () => {
    test('should calculate composite score using correct weights (40/30/20/10)', async () => {
      // Arrange
      const mockRequest: CompositeFraudRequest = {
        phone_hash: 'test-hash',
        call_transcript: 'Test transcript',
        feedback_content: 'Test feedback',
        call_history: [],
        time_window_start: '2025-01-01T00:00:00Z',
        time_window_end: '2025-01-01T23:59:59Z',
        language_code: 'sv'
      };

      mockContextService.analyzeContext.mockResolvedValue({
        analysis_id: 'test-analysis',
        overall_context_score: 80, // 40% weight = 32 points
        confidence_level: 0.9,
        reasoning: 'Test reasoning'
      } as any);

      mockKeywordService.detectKeywords.mockResolvedValue({
        overall_keyword_score: 60, // 20% weight = 12 points
        total_matches: 2,
        highest_severity: 5,
        risk_level: 'medium'
      } as any);

      mockBehavioralService.analyzeBehavioralPatterns.mockResolvedValue({
        composite_behavioral_score: 90, // 30% weight = 27 points
        patterns_detected: [],
        total_violations: 1,
        overall_risk_level: 'high'
      } as any);

      // Act
      const result = await fraudScoringService.generateFraudScore(mockRequest);

      // Assert
      // Expected composite score: (80 * 0.4) + (60 * 0.2) + (90 * 0.3) + (0 * 0.1) = 32 + 12 + 27 + 0 = 71
      expect(result.composite_score).toBe(71);
      expect(result.score_components.context_score).toBe(80);
      expect(result.score_components.keyword_score).toBe(60);
      expect(result.score_components.behavioral_score).toBe(90);
      expect(result.score_components.transaction_score).toBe(0); // Mock transaction returns 0
    });

    test('should handle component scores exceeding maximum limits', async () => {
      // Arrange
      const mockRequest: CompositeFraudRequest = {
        phone_hash: 'test-hash',
        call_transcript: 'Test transcript',
        feedback_content: 'Test feedback',
        call_history: [],
        time_window_start: '2025-01-01T00:00:00Z',
        time_window_end: '2025-01-01T23:59:59Z'
      };

      // Mock services to return scores exceeding their maximum weights
      mockContextService.analyzeContext.mockResolvedValue({
        overall_context_score: 150, // Should be capped at 40 (max weight)
        confidence_level: 0.9
      } as any);

      mockKeywordService.detectKeywords.mockResolvedValue({
        overall_keyword_score: 100, // Should be capped at 20 (max weight)
        total_matches: 5
      } as any);

      mockBehavioralService.analyzeBehavioralPatterns.mockResolvedValue({
        composite_behavioral_score: 80, // Should be capped at 30 (max weight)
        patterns_detected: []
      } as any);

      // Act
      const result = await fraudScoringService.generateFraudScore(mockRequest);

      // Assert
      expect(result.score_components.context_score).toBe(40); // Capped at max weight
      expect(result.score_components.keyword_score).toBe(20); // Capped at max weight
      expect(result.score_components.behavioral_score).toBe(30); // Capped at max weight
      expect(result.composite_score).toBe(90); // (40 + 20 + 30 + 0) = 90
    });

    test('should handle failed component analysis gracefully', async () => {
      // Arrange
      const mockRequest: CompositeFraudRequest = {
        phone_hash: 'test-hash',
        call_transcript: 'Test transcript',
        feedback_content: 'Test feedback',
        call_history: [],
        time_window_start: '2025-01-01T00:00:00Z',
        time_window_end: '2025-01-01T23:59:59Z'
      };

      // Mock one service to fail, others to succeed
      mockContextService.analyzeContext.mockRejectedValue(new Error('Context analysis failed'));
      mockKeywordService.detectKeywords.mockResolvedValue({
        overall_keyword_score: 80,
        total_matches: 3
      } as any);
      mockBehavioralService.analyzeBehavioralPatterns.mockResolvedValue({
        composite_behavioral_score: 60,
        patterns_detected: []
      } as any);

      // Act
      const result = await fraudScoringService.generateFraudScore(mockRequest);

      // Assert
      expect(result.score_components.context_score).toBe(0); // Failed component gets 0
      expect(result.score_components.keyword_score).toBe(80);
      expect(result.score_components.behavioral_score).toBe(60);
      // Composite score: (0 * 0.4) + (80 * 0.2) + (60 * 0.3) + (0 * 0.1) = 0 + 16 + 18 + 0 = 34
      expect(result.composite_score).toBe(34);
    });
  });

  describe('Risk Level Determination', () => {
    const testCases = [
      { score: 95, expectedRisk: 'critical' as RiskLevel },
      { score: 85, expectedRisk: 'critical' as RiskLevel },
      { score: 70, expectedRisk: 'critical' as RiskLevel },
      { score: 69, expectedRisk: 'high' as RiskLevel },
      { score: 60, expectedRisk: 'high' as RiskLevel },
      { score: 55, expectedRisk: 'high' as RiskLevel },
      { score: 54, expectedRisk: 'medium' as RiskLevel },
      { score: 40, expectedRisk: 'medium' as RiskLevel },
      { score: 30, expectedRisk: 'medium' as RiskLevel },
      { score: 29, expectedRisk: 'low' as RiskLevel },
      { score: 15, expectedRisk: 'low' as RiskLevel },
      { score: 0, expectedRisk: 'low' as RiskLevel }
    ];

    testCases.forEach(({ score, expectedRisk }) => {
      test(`should classify score ${score} as ${expectedRisk} risk`, async () => {
        // Arrange
        const mockRequest: CompositeFraudRequest = {
          phone_hash: 'test-hash',
          call_transcript: 'Test transcript',
          feedback_content: 'Test feedback',
          call_history: [],
          time_window_start: '2025-01-01T00:00:00Z',
          time_window_end: '2025-01-01T23:59:59Z'
        };

        // Mock services to return scores that result in the target composite score
        const contextScore = Math.min(40, score * 0.4);
        const keywordScore = Math.min(20, score * 0.2);
        const behavioralScore = Math.min(30, score * 0.3);
        
        mockContextService.analyzeContext.mockResolvedValue({
          overall_context_score: contextScore / 0.4, // Reverse engineer the input
          confidence_level: 0.8
        } as any);

        mockKeywordService.detectKeywords.mockResolvedValue({
          overall_keyword_score: keywordScore / 0.2,
          total_matches: 1
        } as any);

        mockBehavioralService.analyzeBehavioralPatterns.mockResolvedValue({
          composite_behavioral_score: behavioralScore / 0.3,
          patterns_detected: []
        } as any);

        // Act
        const result = await fraudScoringService.generateFraudScore(mockRequest);

        // Assert
        expect(result.risk_level).toBe(expectedRisk);
      });
    });
  });

  describe('Decision Making Logic', () => {
    test('should recommend blocking for critical fraud scores (>=70)', async () => {
      // Arrange - Mock high fraud score
      const mockRequest = createMockRequest();
      mockHighFraudScoreComponents(80, 60, 90, 20); // Results in score >= 70

      // Act
      const result = await fraudScoringService.generateFraudScore(mockRequest);

      // Assert
      expect(result.fraud_decision.is_fraud).toBe(true);
      expect(result.fraud_decision.recommendation).toBe('block_immediately');
      expect(result.fraud_decision.confidence).toBeGreaterThan(0.6);
    });

    test('should recommend manual review for high-risk scores (55-69)', async () => {
      // Arrange - Mock medium-high fraud score
      const mockRequest = createMockRequest();
      mockMediumFraudScoreComponents(60, 40, 70, 10); // Results in score 55-69

      // Act
      const result = await fraudScoringService.generateFraudScore(mockRequest);

      // Assert
      expect(result.fraud_decision.is_fraud).toBe(false);
      expect(result.fraud_decision.recommendation).toBe('manual_review');
      expect(result.fraud_decision.review_required).toBe(true);
    });

    test('should recommend monitoring for medium-risk scores (30-54)', async () => {
      // Arrange - Mock medium fraud score
      const mockRequest = createMockRequest();
      mockMediumFraudScoreComponents(40, 30, 50, 5); // Results in score 30-54

      // Act
      const result = await fraudScoringService.generateFraudScore(mockRequest);

      // Assert
      expect(result.fraud_decision.is_fraud).toBe(false);
      expect(result.fraud_decision.recommendation).toBe('monitor_closely');
      expect(result.fraud_decision.review_required).toBe(false);
    });

    test('should allow low-risk scores (<30)', async () => {
      // Arrange - Mock low fraud score
      const mockRequest = createMockRequest();
      mockLowFraudScoreComponents(10, 5, 20, 0); // Results in score < 30

      // Act
      const result = await fraudScoringService.generateFraudScore(mockRequest);

      // Assert
      expect(result.fraud_decision.is_fraud).toBe(false);
      expect(result.fraud_decision.recommendation).toBe('allow');
      expect(result.fraud_decision.review_required).toBe(false);
    });

    test('should require manual review for very high scores with low confidence', async () => {
      // Arrange - High score but edge case requiring review
      const mockRequest = createMockRequest();
      mockHighFraudScoreComponents(82, 50, 75, 15); // Score = 72.4 (just above threshold)

      // Act
      const result = await fraudScoringService.generateFraudScore(mockRequest);

      // Assert
      expect(result.fraud_decision.is_fraud).toBe(true);
      expect(result.fraud_decision.review_required).toBe(true); // Should require review for edge cases
    });
  });

  describe('Score Breakdown Generation', () => {
    test('should generate detailed score breakdown with component contributions', async () => {
      // Arrange
      const mockRequest = createMockRequest();
      mockContextService.analyzeContext.mockResolvedValue({
        overall_context_score: 75,
        confidence_level: 0.9
      } as any);

      mockKeywordService.detectKeywords.mockResolvedValue({
        overall_keyword_score: 50,
        total_matches: 2
      } as any);

      mockBehavioralService.analyzeBehavioralPatterns.mockResolvedValue({
        composite_behavioral_score: 80,
        patterns_detected: []
      } as any);

      // Act
      const result = await fraudScoringService.generateFraudScore(mockRequest);

      // Assert
      expect(result.score_breakdown).toBeDefined();
      expect(result.score_breakdown.component_contributions).toBeDefined();
      expect(result.score_breakdown.component_contributions.context.weight).toBe(0.4);
      expect(result.score_breakdown.component_contributions.keyword.weight).toBe(0.2);
      expect(result.score_breakdown.component_contributions.behavioral.weight).toBe(0.3);
      expect(result.score_breakdown.component_contributions.transaction.weight).toBe(0.1);
    });

    test('should identify risk factors for high component scores', async () => {
      // Arrange
      const mockRequest = createMockRequest();
      mockHighFraudScoreComponents(90, 80, 95, 70); // All high scores

      // Act
      const result = await fraudScoringService.generateFraudScore(mockRequest);

      // Assert
      expect(result.score_breakdown.risk_factors).toContain(expect.stringContaining('High context risk score'));
      expect(result.score_breakdown.risk_factors).toContain(expect.stringContaining('High keyword risk score'));
      expect(result.score_breakdown.risk_factors).toContain(expect.stringContaining('High behavioral risk score'));
      expect(result.score_breakdown.risk_factors).toContain(expect.stringContaining('High transaction risk score'));
    });

    test('should identify protective factors for low component scores', async () => {
      // Arrange
      const mockRequest = createMockRequest();
      mockLowFraudScoreComponents(2, 1, 3, 0); // All very low scores

      // Act
      const result = await fraudScoringService.generateFraudScore(mockRequest);

      // Assert
      expect(result.score_breakdown.protective_factors).toContain(expect.stringContaining('Low context risk indicators'));
      expect(result.score_breakdown.protective_factors).toContain(expect.stringContaining('Low keyword risk indicators'));
      expect(result.score_breakdown.protective_factors).toContain(expect.stringContaining('Low behavioral risk indicators'));
      expect(result.score_breakdown.protective_factors).toContain(expect.stringContaining('Low transaction risk indicators'));
    });
  });

  describe('Confidence Calculation', () => {
    test('should have high confidence for extreme scores', async () => {
      // Arrange - Very high fraud score
      const mockRequest = createMockRequest();
      mockHighFraudScoreComponents(95, 90, 100, 80); // Extreme high scores

      // Act
      const result = await fraudScoringService.generateFraudScore(mockRequest);

      // Assert
      expect(result.fraud_decision.confidence).toBeGreaterThanOrEqual(0.8);
      expect(result.confidence_level).toBeGreaterThanOrEqual(0.7);
    });

    test('should have lower confidence for threshold-adjacent scores', async () => {
      // Arrange - Score just near the fraud threshold
      const mockRequest = createMockRequest();
      mockMediumFraudScoreComponents(68, 45, 72, 15); // Results in score ~68-72 (near threshold)

      // Act
      const result = await fraudScoringService.generateFraudScore(mockRequest);

      // Assert
      expect(result.fraud_decision.confidence).toBeLessThan(0.9); // Should be less confident near threshold
    });

    test('should increase confidence when multiple components agree', async () => {
      // Arrange - All components showing similar high risk
      const mockRequest = createMockRequest();
      mockHighFraudScoreComponents(85, 80, 90, 75); // All consistently high

      // Act
      const result = await fraudScoringService.generateFraudScore(mockRequest);

      // Assert
      expect(result.confidence_level).toBeGreaterThan(0.7); // Higher confidence with consensus
      expect(result.fraud_decision.confidence).toBeGreaterThan(0.7);
    });

    test('should decrease confidence when components disagree', async () => {
      // Arrange - Mixed component results
      const mockRequest = createMockRequest();
      mockContextService.analyzeContext.mockResolvedValue({
        overall_context_score: 95, // Very high
        confidence_level: 0.9
      } as any);

      mockKeywordService.detectKeywords.mockResolvedValue({
        overall_keyword_score: 5, // Very low
        total_matches: 0
      } as any);

      mockBehavioralService.analyzeBehavioralPatterns.mockResolvedValue({
        composite_behavioral_score: 50, // Medium
        patterns_detected: []
      } as any);

      // Act
      const result = await fraudScoringService.generateFraudScore(mockRequest);

      // Assert
      expect(result.confidence_level).toBeLessThan(0.8); // Lower confidence with disagreement
    });
  });

  describe('Error Handling', () => {
    test('should handle service initialization errors', () => {
      // Test service can be constructed even if dependencies fail
      expect(() => new FraudScoringService()).not.toThrow();
    });

    test('should handle database save failures gracefully', async () => {
      // Arrange
      const mockRequest = createMockRequest();
      mockLowFraudScoreComponents(10, 5, 15, 0);
      MockFraudScoreModel.create.mockRejectedValue(new Error('Database connection failed'));

      // Act & Assert
      await expect(fraudScoringService.generateFraudScore(mockRequest))
        .rejects.toThrow('Fraud scoring failed: Database connection failed');
    });

    test('should handle invalid request data', async () => {
      // Arrange
      const invalidRequest = {} as CompositeFraudRequest;

      // Act & Assert
      await expect(fraudScoringService.generateFraudScore(invalidRequest))
        .rejects.toThrow();
    });

    test('should handle all component failures gracefully', async () => {
      // Arrange
      const mockRequest = createMockRequest();
      mockContextService.analyzeContext.mockRejectedValue(new Error('Context failed'));
      mockKeywordService.detectKeywords.mockRejectedValue(new Error('Keywords failed'));
      mockBehavioralService.analyzeBehavioralPatterns.mockRejectedValue(new Error('Behavioral failed'));

      // Act
      const result = await fraudScoringService.generateFraudScore(mockRequest);

      // Assert - Should still return a valid result with 0 scores
      expect(result.composite_score).toBe(0);
      expect(result.score_components.context_score).toBe(0);
      expect(result.score_components.keyword_score).toBe(0);
      expect(result.score_components.behavioral_score).toBe(0);
      expect(result.fraud_decision.recommendation).toBe('allow'); // Conservative on failure
    });
  });

  describe('Performance Requirements', () => {
    test('should complete fraud scoring within 500ms for simple cases', async () => {
      // Arrange
      const mockRequest = createMockRequest();
      mockLowFraudScoreComponents(20, 10, 25, 5);
      const startTime = Date.now();

      // Act
      const result = await fraudScoringService.generateFraudScore(mockRequest);

      // Assert
      const processingTime = Date.now() - startTime;
      expect(processingTime).toBeLessThan(500);
      expect(result.processing_time_ms).toBeDefined();
      expect(typeof result.processing_time_ms).toBe('number');
    });

    test('should run component analysis in parallel', async () => {
      // Arrange
      const mockRequest = createMockRequest();
      let contextStarted = false, keywordStarted = false, behavioralStarted = false;

      mockContextService.analyzeContext.mockImplementation(async () => {
        contextStarted = true;
        await new Promise(resolve => setTimeout(resolve, 100));
        return { overall_context_score: 30, confidence_level: 0.8 } as any;
      });

      mockKeywordService.detectKeywords.mockImplementation(async () => {
        keywordStarted = true;
        await new Promise(resolve => setTimeout(resolve, 100));
        return { overall_keyword_score: 20, total_matches: 1 } as any;
      });

      mockBehavioralService.analyzeBehavioralPatterns.mockImplementation(async () => {
        behavioralStarted = true;
        await new Promise(resolve => setTimeout(resolve, 100));
        return { composite_behavioral_score: 40, patterns_detected: [] } as any;
      });

      // Act
      const startTime = Date.now();
      await fraudScoringService.generateFraudScore(mockRequest);
      const totalTime = Date.now() - startTime;

      // Assert - Should complete faster than if run sequentially (300ms vs expected ~150ms)
      expect(totalTime).toBeLessThan(200); // Allow some margin for execution overhead
      expect(contextStarted).toBe(true);
      expect(keywordStarted).toBe(true);
      expect(behavioralStarted).toBe(true);
    });
  });

  // Helper functions for test setup
  function createMockRequest(): CompositeFraudRequest {
    return {
      phone_hash: 'test-phone-hash-123',
      call_transcript: 'Test transcript content',
      feedback_content: 'Test feedback content',
      call_history: [],
      time_window_start: '2025-01-01T00:00:00Z',
      time_window_end: '2025-01-01T23:59:59Z',
      language_code: 'sv',
      context_metadata: {
        store_id: 'test-store-id',
        business_context: 'restaurant'
      }
    };
  }

  function mockHighFraudScoreComponents(context: number, keyword: number, behavioral: number, transaction: number) {
    mockContextService.analyzeContext.mockResolvedValue({
      overall_context_score: context,
      confidence_level: 0.9,
      reasoning: 'High risk context detected'
    } as any);

    mockKeywordService.detectKeywords.mockResolvedValue({
      overall_keyword_score: keyword,
      total_matches: 5,
      highest_severity: 8
    } as any);

    mockBehavioralService.analyzeBehavioralPatterns.mockResolvedValue({
      composite_behavioral_score: behavioral,
      patterns_detected: [{ type: 'suspicious_pattern' }],
      total_violations: 3
    } as any);
  }

  function mockMediumFraudScoreComponents(context: number, keyword: number, behavioral: number, transaction: number) {
    mockContextService.analyzeContext.mockResolvedValue({
      overall_context_score: context,
      confidence_level: 0.7
    } as any);

    mockKeywordService.detectKeywords.mockResolvedValue({
      overall_keyword_score: keyword,
      total_matches: 2
    } as any);

    mockBehavioralService.analyzeBehavioralPatterns.mockResolvedValue({
      composite_behavioral_score: behavioral,
      patterns_detected: [{ type: 'minor_pattern' }]
    } as any);
  }

  function mockLowFraudScoreComponents(context: number, keyword: number, behavioral: number, transaction: number) {
    mockContextService.analyzeContext.mockResolvedValue({
      overall_context_score: context,
      confidence_level: 0.9
    } as any);

    mockKeywordService.detectKeywords.mockResolvedValue({
      overall_keyword_score: keyword,
      total_matches: 0
    } as any);

    mockBehavioralService.analyzeBehavioralPatterns.mockResolvedValue({
      composite_behavioral_score: behavioral,
      patterns_detected: []
    } as any);
  }
});

/**
 * Test Edge Cases
 */
describe('FraudScoringService Edge Cases', () => {
  let fraudScoringService: FraudScoringService;

  beforeEach(() => {
    jest.clearAllMocks();
    fraudScoringService = new FraudScoringService();
  });

  test('should handle empty input data gracefully', async () => {
    // Arrange
    const emptyRequest: CompositeFraudRequest = {
      phone_hash: '',
      call_transcript: '',
      feedback_content: '',
      call_history: [],
      time_window_start: '',
      time_window_end: ''
    };

    // Mock services to return minimal data
    (ContextAnalysisService.prototype.analyzeContext as jest.Mock).mockResolvedValue({
      overall_context_score: 0,
      confidence_level: 0.5
    });

    (KeywordDetectionService.prototype.detectKeywords as jest.Mock).mockResolvedValue({
      overall_keyword_score: 0,
      total_matches: 0
    });

    (BehavioralPatternService.prototype.analyzeBehavioralPatterns as jest.Mock).mockResolvedValue({
      composite_behavioral_score: 0,
      patterns_detected: []
    });

    MockFraudScoreModel.create.mockResolvedValue({ id: 'test-id' } as any);

    // Act
    const result = await fraudScoringService.generateFraudScore(emptyRequest);

    // Assert
    expect(result.composite_score).toBe(0);
    expect(result.risk_level).toBe('low');
    expect(result.fraud_decision.is_fraud).toBe(false);
    expect(result.fraud_decision.recommendation).toBe('allow');
  });

  test('should maintain precision in score calculations', async () => {
    // Arrange
    const mockRequest = {
      phone_hash: 'precision-test',
      call_transcript: 'Test',
      feedback_content: 'Test',
      call_history: [],
      time_window_start: '2025-01-01T00:00:00Z',
      time_window_end: '2025-01-01T23:59:59Z'
    };

    // Use decimal values that might cause floating point precision issues
    (ContextAnalysisService.prototype.analyzeContext as jest.Mock).mockResolvedValue({
      overall_context_score: 33.33,
      confidence_level: 0.9
    });

    (KeywordDetectionService.prototype.detectKeywords as jest.Mock).mockResolvedValue({
      overall_keyword_score: 66.66,
      total_matches: 2
    });

    (BehavioralPatternService.prototype.analyzeBehavioralPatterns as jest.Mock).mockResolvedValue({
      composite_behavioral_score: 77.77,
      patterns_detected: []
    });

    MockFraudScoreModel.create.mockResolvedValue({ id: 'precision-test-id' } as any);

    // Act
    const result = await fraudScoringService.generateFraudScore(mockRequest);

    // Assert
    // Expected: (33.33 * 0.4) + (66.66 * 0.2) + (77.77 * 0.3) + (0 * 0.1)
    // = 13.332 + 13.332 + 23.331 + 0 = 49.995 ≈ 50.00
    expect(result.composite_score).toBeCloseTo(50.0, 2);
    expect(typeof result.composite_score).toBe('number');
  });
});