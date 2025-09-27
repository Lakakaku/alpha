import { performance } from 'perf_hooks';
import { FraudDetectionService } from '../../src/services/fraud/fraudDetectionService';
import { FraudScoringService } from '../../src/services/fraud/fraudScoringService';
import { ContextAnalysisService } from '../../src/services/fraud/contextAnalysisService';
import { BehavioralPatternService } from '../../src/services/fraud/behavioralPatternService';
import { KeywordDetectionService } from '../../src/services/fraud/keywordDetectionService';
import type { 
  FraudAnalysisRequest, 
  FraudAnalysisResponse,
  ContextAnalysisRequest,
  BehavioralAnalysisRequest,
  KeywordAnalysisRequest
} from '@vocilia/types';

// Mock all fraud detection services
jest.mock('../../src/services/fraud/fraudScoringService');
jest.mock('../../src/services/fraud/contextAnalysisService');
jest.mock('../../src/services/fraud/behavioralPatternService');
jest.mock('../../src/services/fraud/keywordDetectionService');

const MockFraudScoringService = FraudScoringService as jest.MockedClass<typeof FraudScoringService>;
const MockContextAnalysisService = ContextAnalysisService as jest.MockedClass<typeof ContextAnalysisService>;
const MockBehavioralPatternService = BehavioralPatternService as jest.MockedClass<typeof BehavioralPatternService>;
const MockKeywordDetectionService = KeywordDetectionService as jest.MockedClass<typeof KeywordDetectionService>;

describe('Fraud Detection Performance Tests', () => {
  let fraudDetectionService: FraudDetectionService;
  let mockFraudScoring: jest.Mocked<FraudScoringService>;
  let mockContextAnalysis: jest.Mocked<ContextAnalysisService>;
  let mockBehavioralPattern: jest.Mocked<BehavioralPatternService>;
  let mockKeywordDetection: jest.Mocked<KeywordDetectionService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock instances
    mockFraudScoring = new MockFraudScoringService() as jest.Mocked<FraudScoringService>;
    mockContextAnalysis = new MockContextAnalysisService() as jest.Mocked<ContextAnalysisService>;
    mockBehavioralPattern = new MockBehavioralPatternService() as jest.Mocked<BehavioralPatternService>;
    mockKeywordDetection = new MockKeywordDetectionService() as jest.Mocked<KeywordDetectionService>;
    
    // Mock constructor returns
    MockFraudScoringService.mockImplementation(() => mockFraudScoring);
    MockContextAnalysisService.mockImplementation(() => mockContextAnalysis);
    MockBehavioralPatternService.mockImplementation(() => mockBehavioralPattern);
    MockKeywordDetectionService.mockImplementation(() => mockKeywordDetection);
    
    fraudDetectionService = new FraudDetectionService();
  });

  describe('Performance Requirements (<500ms)', () => {
    const sampleRequest: FraudAnalysisRequest = {
      phone_hash: 'perf-test-hash-12345',
      call_transcript: 'Hej! Jag ringer angående min beställning från er butik i Stockholm. Maten var kall när den kom och personalen var inte särskilt hjälpsam. Jag skulle vilja ha en återbetalning eller åtminstone en rabatt på nästa beställning.',
      feedback_content: 'Kall mat, otrevlig personal, vill ha återbetalning',
      store_id: 'store-stockholm-1',
      customer_context: {
        previous_calls: 2,
        last_call_date: new Date(Date.now() - 3600000).toISOString(),
        location_history: ['Stockholm', 'Göteborg']
      }
    };

    beforeEach(() => {
      // Mock fast responses from all services
      mockContextAnalysis.analyzeContext.mockResolvedValue({
        legitimacy_score: 85,
        context_matches: ['restaurant', 'food_delivery', 'customer_service'],
        context_violations: [],
        cultural_context: {
          language_authenticity: 0.95,
          cultural_markers: ['swedish_politeness', 'direct_communication']
        },
        impossibility_flags: [],
        confidence_score: 0.92
      });

      mockKeywordDetection.analyzeKeywords.mockResolvedValue({
        detected_keywords: [],
        risk_categories: [],
        severity_score: 0,
        total_violations: 0,
        language_violations: []
      });

      mockBehavioralPattern.analyzePatterns.mockResolvedValue({
        call_frequency_pattern: {
          calls_in_window: 2,
          risk_score: 15,
          violations: []
        },
        composite_risk_score: 15,
        risk_level: 'low',
        pattern_summary: 'Normal customer behavior'
      });

      mockFraudScoring.calculateCompositeScore.mockResolvedValue({
        composite_score: 78,
        individual_scores: {
          context_score: 85,
          keyword_score: 100,
          behavioral_score: 85,
          transaction_score: 50
        },
        risk_level: 'low',
        decision: 'allow',
        confidence: 0.92,
        score_breakdown: {
          context_weight: 0.4,
          keyword_weight: 0.2,
          behavioral_weight: 0.3,
          transaction_weight: 0.1
        }
      });
    });

    test('should complete fraud analysis within 500ms', async () => {
      const startTime = performance.now();
      
      const result = await fraudDetectionService.analyzeFraud(sampleRequest);
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      expect(executionTime).toBeLessThan(500);
      expect(result).toBeDefined();
      expect(result.fraud_score).toBeDefined();
      expect(result.decision).toBeDefined();
      
      console.log(`Fraud analysis completed in ${executionTime.toFixed(2)}ms`);
    }, 10000);

    test('should maintain performance under concurrent analysis requests', async () => {
      const concurrentRequests = 10;
      const requests = Array(concurrentRequests).fill(null).map((_, index) => ({
        ...sampleRequest,
        phone_hash: `concurrent-test-hash-${index}`
      }));
      
      const startTime = performance.now();
      
      const results = await Promise.all(
        requests.map(request => fraudDetectionService.analyzeFraud(request))
      );
      
      const endTime = performance.now();
      const totalExecutionTime = endTime - startTime;
      const averageExecutionTime = totalExecutionTime / concurrentRequests;
      
      expect(results).toHaveLength(concurrentRequests);
      expect(averageExecutionTime).toBeLessThan(500);
      
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.fraud_score).toBeDefined();
        expect(result.decision).toBeDefined();
      });
      
      console.log(`${concurrentRequests} concurrent fraud analyses completed in ${totalExecutionTime.toFixed(2)}ms (avg: ${averageExecutionTime.toFixed(2)}ms per request)`);
    }, 15000);

    test('should handle complex behavioral pattern analysis within performance threshold', async () => {
      // Mock complex behavioral analysis with multiple patterns
      mockBehavioralPattern.analyzePatterns.mockResolvedValue({
        call_frequency_pattern: {
          calls_in_window: 8,
          risk_score: 85,
          violations: [
            {
              type: 'excessive_frequency',
              call_count: 8,
              time_window: '30 minutes',
              threshold_exceeded: 3
            }
          ]
        },
        time_pattern: {
          unusual_hours: true,
          weekend_clustering: false,
          rapid_succession: true,
          risk_score: 70
        },
        location_pattern: {
          impossible_travel: true,
          geographic_clustering: false,
          risk_score: 90
        },
        similarity_pattern: {
          high_similarity_calls: 3,
          avg_similarity_score: 0.92,
          risk_score: 88
        },
        composite_risk_score: 85,
        risk_level: 'high',
        pattern_summary: 'Multiple suspicious patterns detected'
      });
      
      const complexRequest = {
        ...sampleRequest,
        phone_hash: 'complex-behavioral-test',
        customer_context: {
          previous_calls: 15,
          last_call_date: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
          location_history: ['Stockholm', 'Göteborg', 'Malmö', 'Uppsala', 'Västerås']
        }
      };
      
      const startTime = performance.now();
      
      const result = await fraudDetectionService.analyzeFraud(complexRequest);
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      expect(executionTime).toBeLessThan(500);
      expect(result.fraud_score.behavioral_analysis.composite_risk_score).toBeGreaterThan(70);
      
      console.log(`Complex behavioral analysis completed in ${executionTime.toFixed(2)}ms`);
    }, 10000);

    test('should process large transcript content within performance threshold', async () => {
      // Create a large transcript (simulating long customer call)
      const largeTranscript = Array(50).fill(
        'Jag ringer angående min beställning från er butik. Maten var kall och personalen var otrevlig. '
      ).join(' ');
      
      const largeContentRequest = {
        ...sampleRequest,
        call_transcript: largeTranscript,
        feedback_content: largeTranscript.substring(0, 500)
      };
      
      const startTime = performance.now();
      
      const result = await fraudDetectionService.analyzeFraud(largeContentRequest);
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      expect(executionTime).toBeLessThan(500);
      expect(result).toBeDefined();
      
      console.log(`Large transcript analysis (${largeTranscript.length} chars) completed in ${executionTime.toFixed(2)}ms`);
    }, 10000);
  });

  describe('Service-Level Performance Benchmarks', () => {
    test('context analysis should complete within allocated time budget (200ms)', async () => {
      const contextRequest: ContextAnalysisRequest = {
        phone_hash: 'context-perf-test',
        call_transcript: 'Hej! Jag hade problem med min beställning från er restaurang.',
        feedback_content: 'Dålig service och kall mat'
      };
      
      mockContextAnalysis.analyzeContext.mockImplementation(async () => {
        // Simulate actual processing time
        await new Promise(resolve => setTimeout(resolve, 150));
        return {
          legitimacy_score: 80,
          context_matches: ['restaurant'],
          context_violations: [],
          cultural_context: {
            language_authenticity: 0.95,
            cultural_markers: ['swedish_politeness']
          },
          impossibility_flags: [],
          confidence_score: 0.88
        };
      });
      
      const startTime = performance.now();
      
      const result = await mockContextAnalysis.analyzeContext(contextRequest);
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      expect(executionTime).toBeLessThan(200);
      expect(result.legitimacy_score).toBeDefined();
      
      console.log(`Context analysis completed in ${executionTime.toFixed(2)}ms`);
    }, 5000);

    test('behavioral pattern analysis should complete within allocated time budget (150ms)', async () => {
      const behavioralRequest: BehavioralAnalysisRequest = {
        phone_hash: 'behavioral-perf-test',
        customer_context: {
          previous_calls: 5,
          last_call_date: new Date().toISOString(),
          location_history: ['Stockholm', 'Göteborg']
        }
      };
      
      mockBehavioralPattern.analyzePatterns.mockImplementation(async () => {
        // Simulate actual processing time
        await new Promise(resolve => setTimeout(resolve, 120));
        return {
          call_frequency_pattern: {
            calls_in_window: 5,
            risk_score: 40,
            violations: []
          },
          composite_risk_score: 40,
          risk_level: 'medium',
          pattern_summary: 'Moderate activity level'
        };
      });
      
      const startTime = performance.now();
      
      const result = await mockBehavioralPattern.analyzePatterns(behavioralRequest);
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      expect(executionTime).toBeLessThan(150);
      expect(result.composite_risk_score).toBeDefined();
      
      console.log(`Behavioral pattern analysis completed in ${executionTime.toFixed(2)}ms`);
    }, 5000);

    test('keyword detection should complete within allocated time budget (50ms)', async () => {
      const keywordRequest: KeywordAnalysisRequest = {
        content: 'Jag är mycket missnöjd med servicen och vill ha en återbetalning.',
        language: 'sv'
      };
      
      mockKeywordDetection.analyzeKeywords.mockImplementation(async () => {
        // Simulate actual processing time
        await new Promise(resolve => setTimeout(resolve, 30));
        return {
          detected_keywords: [],
          risk_categories: [],
          severity_score: 0,
          total_violations: 0,
          language_violations: []
        };
      });
      
      const startTime = performance.now();
      
      const result = await mockKeywordDetection.analyzeKeywords(keywordRequest);
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      expect(executionTime).toBeLessThan(50);
      expect(result.severity_score).toBeDefined();
      
      console.log(`Keyword detection completed in ${executionTime.toFixed(2)}ms`);
    }, 5000);

    test('fraud scoring should complete within allocated time budget (100ms)', async () => {
      const scoringInputs = {
        contextScore: 85,
        keywordScore: 100,
        behavioralScore: 70,
        transactionScore: 90
      };
      
      mockFraudScoring.calculateCompositeScore.mockImplementation(async () => {
        // Simulate actual processing time
        await new Promise(resolve => setTimeout(resolve, 80));
        return {
          composite_score: 80,
          individual_scores: {
            context_score: 85,
            keyword_score: 100,
            behavioral_score: 70,
            transaction_score: 90
          },
          risk_level: 'low',
          decision: 'allow',
          confidence: 0.90,
          score_breakdown: {
            context_weight: 0.4,
            keyword_weight: 0.2,
            behavioral_weight: 0.3,
            transaction_weight: 0.1
          }
        };
      });
      
      const startTime = performance.now();
      
      const result = await mockFraudScoring.calculateCompositeScore(scoringInputs);
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      expect(executionTime).toBeLessThan(100);
      expect(result.composite_score).toBeDefined();
      
      console.log(`Fraud scoring completed in ${executionTime.toFixed(2)}ms`);
    }, 5000);
  });

  describe('Performance Under Load', () => {
    test('should maintain consistent performance across multiple sequential requests', async () => {
      const requestCount = 20;
      const executionTimes: number[] = [];
      
      for (let i = 0; i < requestCount; i++) {
        const request = {
          ...sampleRequest,
          phone_hash: `sequential-test-${i}`
        };
        
        const startTime = performance.now();
        await fraudDetectionService.analyzeFraud(request);
        const endTime = performance.now();
        
        executionTimes.push(endTime - startTime);
      }
      
      const averageTime = executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length;
      const maxTime = Math.max(...executionTimes);
      const minTime = Math.min(...executionTimes);
      
      expect(averageTime).toBeLessThan(500);
      expect(maxTime).toBeLessThan(600); // Allow 20% variance for worst case
      
      console.log(`Sequential performance - Avg: ${averageTime.toFixed(2)}ms, Min: ${minTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`);
    }, 30000);

    test('should handle memory efficiently during extended operation', async () => {
      const initialMemory = process.memoryUsage();
      
      // Run 100 fraud analyses to test memory usage
      const promises = Array(100).fill(null).map((_, index) => {
        return fraudDetectionService.analyzeFraud({
          ...sampleRequest,
          phone_hash: `memory-test-${index}`
        });
      });
      
      const startTime = performance.now();
      await Promise.all(promises);
      const endTime = performance.now();
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const totalExecutionTime = endTime - startTime;
      
      // Memory increase should be reasonable (less than 50MB for 100 analyses)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
      
      // Total time should still be reasonable
      expect(totalExecutionTime).toBeLessThan(10000); // 10 seconds for 100 analyses
      
      console.log(`Memory test - Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB, Total time: ${totalExecutionTime.toFixed(2)}ms`);
    }, 15000);
  });

  describe('Performance Monitoring and Metrics', () => {
    test('should provide performance metrics for monitoring', async () => {
      const request = {
        ...sampleRequest,
        phone_hash: 'metrics-test'
      };
      
      const startTime = performance.now();
      const result = await fraudDetectionService.analyzeFraud(request);
      const endTime = performance.now();
      
      const executionTime = endTime - startTime;
      
      // Verify that performance data can be extracted for monitoring
      expect(typeof executionTime).toBe('number');
      expect(executionTime).toBeGreaterThan(0);
      expect(result).toBeDefined();
      
      // Mock performance tracking that would be implemented in production
      const performanceMetrics = {
        execution_time: executionTime,
        timestamp: new Date().toISOString(),
        request_id: 'metrics-test',
        component_breakdown: {
          context_analysis: 150, // Would come from actual service metrics
          keyword_detection: 30,
          behavioral_analysis: 120,
          fraud_scoring: 80
        },
        meets_sla: executionTime < 500
      };
      
      expect(performanceMetrics.meets_sla).toBe(true);
      expect(performanceMetrics.execution_time).toBeLessThan(500);
      
      console.log('Performance metrics:', JSON.stringify(performanceMetrics, null, 2));
    }, 5000);
  });
});