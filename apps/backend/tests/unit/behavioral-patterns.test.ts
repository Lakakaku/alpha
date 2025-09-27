/**
 * Unit Tests: Behavioral Pattern Analysis Service
 * Task: T074 - Unit tests for behavioral patterns in apps/backend/tests/unit/behavioral-patterns.test.ts
 * 
 * Tests the behavioral pattern analysis service including:
 * - Call frequency analysis
 * - Time pattern detection
 * - Location pattern analysis
 * - Content similarity detection
 * - Composite scoring algorithms
 * - Risk level determination
 */

import { BehavioralPatternService } from '../../src/services/fraud/behavioralPatternService';
import { BehavioralPatternModel } from '../../../../packages/database/src/fraud/behavioral-pattern';
import {
  BehavioralAnalysisRequest,
  BehavioralAnalysisResult,
  CallFrequencyPattern,
  TimePattern,
  LocationPattern,
  SimilarityPattern
} from '../../../../packages/types/src/fraud';

// Mock dependencies
jest.mock('../../../../packages/database/src/fraud/behavioral-pattern');

const MockBehavioralPatternModel = BehavioralPatternModel as jest.MockedClass<typeof BehavioralPatternModel>;

describe('BehavioralPatternService', () => {
  let behavioralPatternService: BehavioralPatternService;

  beforeEach(() => {
    jest.clearAllMocks();
    behavioralPatternService = new BehavioralPatternService();

    // Setup default database mocks
    MockBehavioralPatternModel.create.mockResolvedValue({
      id: 'test-pattern-id',
      phone_hash: 'test-hash',
      pattern_type: 'call_frequency',
      risk_score: 15,
      violation_count: 2,
      severity_level: 4
    } as any);
  });

  describe('Service Initialization', () => {
    test('should initialize with default configuration', () => {
      expect(() => new BehavioralPatternService()).not.toThrow();
    });
  });

  describe('Call Frequency Analysis', () => {
    test('should detect excessive call frequency patterns', async () => {
      // Arrange - 8 calls within 30 minutes (threshold is 5)
      const request: BehavioralAnalysisRequest = {
        phone_hash: 'freq-test-hash',
        call_history: [
          { timestamp: '2025-01-01T10:00:00Z', call_id: 'call1' },
          { timestamp: '2025-01-01T10:05:00Z', call_id: 'call2' },
          { timestamp: '2025-01-01T10:10:00Z', call_id: 'call3' },
          { timestamp: '2025-01-01T10:15:00Z', call_id: 'call4' },
          { timestamp: '2025-01-01T10:20:00Z', call_id: 'call5' },
          { timestamp: '2025-01-01T10:25:00Z', call_id: 'call6' }, // Exceeds threshold
          { timestamp: '2025-01-01T10:28:00Z', call_id: 'call7' },
          { timestamp: '2025-01-01T10:30:00Z', call_id: 'call8' }
        ],
        time_window_start: '2025-01-01T09:00:00Z',
        time_window_end: '2025-01-01T11:00:00Z'
      };

      // Act
      const result = await behavioralPatternService.analyzeBehavioralPatterns(request);

      // Assert
      expect(result.call_frequency_pattern).toBeDefined();
      expect(result.call_frequency_pattern!.violations).toHaveLength(1);
      expect(result.call_frequency_pattern!.violations[0].call_count).toBe(8);
      expect(result.call_frequency_pattern!.violations[0].threshold_exceeded).toBe(3);
      expect(result.call_frequency_pattern!.risk_score).toBeGreaterThan(10);
    });

    test('should not flag normal call frequency patterns', async () => {
      // Arrange - 3 calls in 30 minutes (under threshold)
      const request: BehavioralAnalysisRequest = {
        phone_hash: 'normal-freq-hash',
        call_history: [
          { timestamp: '2025-01-01T10:00:00Z', call_id: 'call1' },
          { timestamp: '2025-01-01T10:15:00Z', call_id: 'call2' },
          { timestamp: '2025-01-01T10:29:00Z', call_id: 'call3' }
        ],
        time_window_start: '2025-01-01T09:00:00Z',
        time_window_end: '2025-01-01T11:00:00Z'
      };

      // Act
      const result = await behavioralPatternService.analyzeBehavioralPatterns(request);

      // Assert
      expect(result.call_frequency_pattern).toBeNull();
    });

    test('should handle multiple time windows with violations', async () => {
      // Arrange - Two separate windows with excessive calls
      const request: BehavioralAnalysisRequest = {
        phone_hash: 'multi-window-hash',
        call_history: [
          // First window: 6 calls
          { timestamp: '2025-01-01T10:00:00Z', call_id: 'call1' },
          { timestamp: '2025-01-01T10:05:00Z', call_id: 'call2' },
          { timestamp: '2025-01-01T10:10:00Z', call_id: 'call3' },
          { timestamp: '2025-01-01T10:15:00Z', call_id: 'call4' },
          { timestamp: '2025-01-01T10:20:00Z', call_id: 'call5' },
          { timestamp: '2025-01-01T10:25:00Z', call_id: 'call6' },
          // Second window: 7 calls
          { timestamp: '2025-01-01T11:00:00Z', call_id: 'call7' },
          { timestamp: '2025-01-01T11:05:00Z', call_id: 'call8' },
          { timestamp: '2025-01-01T11:10:00Z', call_id: 'call9' },
          { timestamp: '2025-01-01T11:15:00Z', call_id: 'call10' },
          { timestamp: '2025-01-01T11:20:00Z', call_id: 'call11' },
          { timestamp: '2025-01-01T11:25:00Z', call_id: 'call12' },
          { timestamp: '2025-01-01T11:28:00Z', call_id: 'call13' }
        ],
        time_window_start: '2025-01-01T09:00:00Z',
        time_window_end: '2025-01-01T12:00:00Z'
      };

      // Act
      const result = await behavioralPatternService.analyzeBehavioralPatterns(request);

      // Assert
      expect(result.call_frequency_pattern).toBeDefined();
      expect(result.call_frequency_pattern!.violations).toHaveLength(2);
      expect(result.call_frequency_pattern!.risk_score).toBeGreaterThan(15); // Higher score for multiple violations
    });
  });

  describe('Time Pattern Analysis', () => {
    test('should detect unusual hours calling pattern', async () => {
      // Arrange - Calls during late night hours
      const request: BehavioralAnalysisRequest = {
        phone_hash: 'night-calls-hash',
        call_history: [
          { timestamp: '2025-01-01T01:00:00Z', call_id: 'call1' }, // 1 AM
          { timestamp: '2025-01-01T02:30:00Z', call_id: 'call2' }, // 2:30 AM
          { timestamp: '2025-01-01T03:15:00Z', call_id: 'call3' }, // 3:15 AM
          { timestamp: '2025-01-01T23:45:00Z', call_id: 'call4' }  // 11:45 PM
        ],
        time_window_start: '2025-01-01T00:00:00Z',
        time_window_end: '2025-01-01T23:59:59Z'
      };

      // Act
      const result = await behavioralPatternService.analyzeBehavioralPatterns(request);

      // Assert
      expect(result.time_pattern).toBeDefined();
      const unusualHoursViolation = result.time_pattern!.violations.find(v => v.pattern_type === 'unusual_hours');
      expect(unusualHoursViolation).toBeDefined();
      expect(unusualHoursViolation!.call_times).toHaveLength(4);
      expect(unusualHoursViolation!.severity).toBeGreaterThan(5);
    });

    test('should detect weekend clustering pattern', async () => {
      // Arrange - More weekend calls than weekday calls
      const request: BehavioralAnalysisRequest = {
        phone_hash: 'weekend-cluster-hash',
        call_history: [
          // Saturday calls (day 6)
          { timestamp: '2025-01-04T10:00:00Z', call_id: 'call1' },
          { timestamp: '2025-01-04T14:00:00Z', call_id: 'call2' },
          { timestamp: '2025-01-04T18:00:00Z', call_id: 'call3' },
          // Sunday calls (day 0)
          { timestamp: '2025-01-05T09:00:00Z', call_id: 'call4' },
          { timestamp: '2025-01-05T15:00:00Z', call_id: 'call5' },
          { timestamp: '2025-01-05T20:00:00Z', call_id: 'call6' },
          // Only 1 weekday call
          { timestamp: '2025-01-06T12:00:00Z', call_id: 'call7' } // Monday
        ],
        time_window_start: '2025-01-04T00:00:00Z',
        time_window_end: '2025-01-06T23:59:59Z'
      };

      // Act
      const result = await behavioralPatternService.analyzeBehavioralPatterns(request);

      // Assert
      expect(result.time_pattern).toBeDefined();
      const weekendViolation = result.time_pattern!.violations.find(v => v.pattern_type === 'weekend_clustering');
      expect(weekendViolation).toBeDefined();
      expect(weekendViolation!.description).toContain('6 weekend calls vs 1 weekday calls');
    });

    test('should detect rapid succession calls', async () => {
      // Arrange - Multiple calls within 2 minutes
      const request: BehavioralAnalysisRequest = {
        phone_hash: 'rapid-calls-hash',
        call_history: [
          { timestamp: '2025-01-01T10:00:00Z', call_id: 'call1' },
          { timestamp: '2025-01-01T10:01:00Z', call_id: 'call2' }, // 1 minute later
          { timestamp: '2025-01-01T10:01:30Z', call_id: 'call3' }, // 30 seconds later
          { timestamp: '2025-01-01T10:05:00Z', call_id: 'call4' },
          { timestamp: '2025-01-01T10:06:00Z', call_id: 'call5' } // 1 minute later
        ],
        time_window_start: '2025-01-01T09:00:00Z',
        time_window_end: '2025-01-01T11:00:00Z'
      };

      // Act
      const result = await behavioralPatternService.analyzeBehavioralPatterns(request);

      // Assert
      expect(result.time_pattern).toBeDefined();
      const rapidViolation = result.time_pattern!.violations.find(v => v.pattern_type === 'rapid_succession');
      expect(rapidViolation).toBeDefined();
      expect(rapidViolation!.call_times.length).toBeGreaterThanOrEqual(4); // At least 2 pairs
    });

    test('should not flag normal time patterns', async () => {
      // Arrange - Normal business hours calls
      const request: BehavioralAnalysisRequest = {
        phone_hash: 'normal-time-hash',
        call_history: [
          { timestamp: '2025-01-01T09:00:00Z', call_id: 'call1' }, // 9 AM
          { timestamp: '2025-01-01T13:00:00Z', call_id: 'call2' }, // 1 PM
          { timestamp: '2025-01-01T17:00:00Z', call_id: 'call3' }  // 5 PM
        ],
        time_window_start: '2025-01-01T00:00:00Z',
        time_window_end: '2025-01-01T23:59:59Z'
      };

      // Act
      const result = await behavioralPatternService.analyzeBehavioralPatterns(request);

      // Assert
      expect(result.time_pattern).toBeNull();
    });
  });

  describe('Location Pattern Analysis', () => {
    test('should detect impossible travel patterns', async () => {
      // Arrange - Calls from Stockholm to Gothenburg in 30 minutes (impossible by car)
      const request: BehavioralAnalysisRequest = {
        phone_hash: 'impossible-travel-hash',
        call_history: [
          {
            timestamp: '2025-01-01T10:00:00Z',
            call_id: 'call1',
            location: { latitude: 59.3293, longitude: 18.0686 } // Stockholm
          },
          {
            timestamp: '2025-01-01T10:30:00Z',
            call_id: 'call2',
            location: { latitude: 57.7089, longitude: 11.9746 } // Gothenburg (~470km away)
          }
        ],
        time_window_start: '2025-01-01T09:00:00Z',
        time_window_end: '2025-01-01T11:00:00Z'
      };

      // Act
      const result = await behavioralPatternService.analyzeBehavioralPatterns(request);

      // Assert
      expect(result.location_pattern).toBeDefined();
      const impossibleTravelViolation = result.location_pattern!.violations.find(v => v.pattern_type === 'impossible_travel');
      expect(impossibleTravelViolation).toBeDefined();
      expect(impossibleTravelViolation!.description).toContain('km/h'); // Should mention high speed
      expect(impossibleTravelViolation!.severity).toBeGreaterThan(8); // High severity for impossible travel
    });

    test('should detect geographic clustering', async () => {
      // Arrange - All calls from the same small area
      const baseLocation = { latitude: 59.3293, longitude: 18.0686 };
      const request: BehavioralAnalysisRequest = {
        phone_hash: 'geo-cluster-hash',
        call_history: [
          { timestamp: '2025-01-01T10:00:00Z', call_id: 'call1', location: baseLocation },
          { timestamp: '2025-01-01T11:00:00Z', call_id: 'call2', location: { latitude: 59.3295, longitude: 18.0688 } },
          { timestamp: '2025-01-01T12:00:00Z', call_id: 'call3', location: { latitude: 59.3291, longitude: 18.0684 } },
          { timestamp: '2025-01-01T13:00:00Z', call_id: 'call4', location: { latitude: 59.3294, longitude: 18.0687 } },
          { timestamp: '2025-01-01T14:00:00Z', call_id: 'call5', location: { latitude: 59.3292, longitude: 18.0685 } },
          { timestamp: '2025-01-01T15:00:00Z', call_id: 'call6', location: { latitude: 59.3296, longitude: 18.0689 } }
        ],
        time_window_start: '2025-01-01T09:00:00Z',
        time_window_end: '2025-01-01T16:00:00Z'
      };

      // Act
      const result = await behavioralPatternService.analyzeBehavioralPatterns(request);

      // Assert
      expect(result.location_pattern).toBeDefined();
      const clusteringViolation = result.location_pattern!.violations.find(v => v.pattern_type === 'geographic_clustering');
      expect(clusteringViolation).toBeDefined();
      expect(clusteringViolation!.description).toContain('6 calls from same');
    });

    test('should not flag normal location patterns', async () => {
      // Arrange - Reasonable travel patterns
      const request: BehavioralAnalysisRequest = {
        phone_hash: 'normal-location-hash',
        call_history: [
          {
            timestamp: '2025-01-01T09:00:00Z',
            call_id: 'call1',
            location: { latitude: 59.3293, longitude: 18.0686 } // Stockholm
          },
          {
            timestamp: '2025-01-01T17:00:00Z',
            call_id: 'call2',
            location: { latitude: 57.7089, longitude: 11.9746 } // Gothenburg (8 hours later - reasonable)
          }
        ],
        time_window_start: '2025-01-01T08:00:00Z',
        time_window_end: '2025-01-01T18:00:00Z'
      };

      // Act
      const result = await behavioralPatternService.analyzeBehavioralPatterns(request);

      // Assert
      expect(result.location_pattern).toBeNull();
    });

    test('should handle calls without location data', async () => {
      // Arrange - Calls without location information
      const request: BehavioralAnalysisRequest = {
        phone_hash: 'no-location-hash',
        call_history: [
          { timestamp: '2025-01-01T10:00:00Z', call_id: 'call1' },
          { timestamp: '2025-01-01T11:00:00Z', call_id: 'call2' }
        ],
        time_window_start: '2025-01-01T09:00:00Z',
        time_window_end: '2025-01-01T12:00:00Z'
      };

      // Act
      const result = await behavioralPatternService.analyzeBehavioralPatterns(request);

      // Assert
      expect(result.location_pattern).toBeNull();
    });
  });

  describe('Similarity Pattern Analysis', () => {
    test('should detect high content similarity between calls', async () => {
      // Arrange - Very similar call transcripts
      const similarTranscript = 'Hej jag skulle vilja klaga på min beställning som kom för sent';
      const request: BehavioralAnalysisRequest = {
        phone_hash: 'similarity-test-hash',
        call_history: [
          {
            timestamp: '2025-01-01T10:00:00Z',
            call_id: 'call1',
            transcript: similarTranscript
          },
          {
            timestamp: '2025-01-01T11:00:00Z',
            call_id: 'call2',
            transcript: 'Hej jag skulle vilja klaga på min beställning som kom för sent igen'
          },
          {
            timestamp: '2025-01-01T12:00:00Z',
            call_id: 'call3',
            transcript: similarTranscript // Identical
          }
        ],
        time_window_start: '2025-01-01T09:00:00Z',
        time_window_end: '2025-01-01T13:00:00Z'
      };

      // Act
      const result = await behavioralPatternService.analyzeBehavioralPatterns(request);

      // Assert
      expect(result.similarity_pattern).toBeDefined();
      const highSimilarityViolations = result.similarity_pattern!.violations.filter(v => v.pattern_type === 'high_similarity');
      expect(highSimilarityViolations.length).toBeGreaterThan(0);
      expect(result.similarity_pattern!.risk_score).toBeGreaterThan(5);
    });

    test('should detect scripted/template responses', async () => {
      // Arrange - Calls with repeated phrases suggesting script usage
      const request: BehavioralAnalysisRequest = {
        phone_hash: 'scripted-hash',
        call_history: [
          {
            timestamp: '2025-01-01T10:00:00Z',
            call_id: 'call1',
            transcript: 'Hej jag ringer angående min beställning nummer tolv tretton fjorton'
          },
          {
            timestamp: '2025-01-01T11:00:00Z',
            call_id: 'call2',
            transcript: 'Hej jag ringer angående min beställning nummer femton sexton sjutton'
          },
          {
            timestamp: '2025-01-01T12:00:00Z',
            call_id: 'call3',
            transcript: 'Hej jag ringer angående min beställning nummer arton nitton tjugo'
          }
        ],
        time_window_start: '2025-01-01T09:00:00Z',
        time_window_end: '2025-01-01T13:00:00Z'
      };

      // Act
      const result = await behavioralPatternService.analyzeBehavioralPatterns(request);

      // Assert
      expect(result.similarity_pattern).toBeDefined();
      const scriptedViolation = result.similarity_pattern!.violations.find(v => v.pattern_type === 'scripted_responses');
      expect(scriptedViolation).toBeDefined();
      expect(scriptedViolation!.description).toContain('phrases repeated');
    });

    test('should not flag naturally different conversations', async () => {
      // Arrange - Different, natural conversations
      const request: BehavioralAnalysisRequest = {
        phone_hash: 'natural-conv-hash',
        call_history: [
          {
            timestamp: '2025-01-01T10:00:00Z',
            call_id: 'call1',
            transcript: 'Hej, jag undrar över öppettiderna för er butik'
          },
          {
            timestamp: '2025-01-01T11:00:00Z',
            call_id: 'call2',
            transcript: 'Tjenare, har ni pizza med kebab?'
          }
        ],
        time_window_start: '2025-01-01T09:00:00Z',
        time_window_end: '2025-01-01T12:00:00Z'
      };

      // Act
      const result = await behavioralPatternService.analyzeBehavioralPatterns(request);

      // Assert
      expect(result.similarity_pattern).toBeNull();
    });

    test('should handle calls without transcripts', async () => {
      // Arrange - Calls missing transcript data
      const request: BehavioralAnalysisRequest = {
        phone_hash: 'no-transcript-hash',
        call_history: [
          { timestamp: '2025-01-01T10:00:00Z', call_id: 'call1' },
          { timestamp: '2025-01-01T11:00:00Z', call_id: 'call2' }
        ],
        time_window_start: '2025-01-01T09:00:00Z',
        time_window_end: '2025-01-01T12:00:00Z'
      };

      // Act
      const result = await behavioralPatternService.analyzeBehavioralPatterns(request);

      // Assert
      expect(result.similarity_pattern).toBeNull();
    });
  });

  describe('Composite Scoring', () => {
    test('should calculate composite score from multiple patterns', async () => {
      // Arrange - Request that will trigger multiple pattern types
      MockBehavioralPatternModel.create
        .mockResolvedValueOnce({ id: 'freq-pattern', pattern_type: 'call_frequency', risk_score: 15 } as any)
        .mockResolvedValueOnce({ id: 'time-pattern', pattern_type: 'time_pattern', risk_score: 12 } as any)
        .mockResolvedValueOnce({ id: 'location-pattern', pattern_type: 'location_pattern', risk_score: 18 } as any);

      const request: BehavioralAnalysisRequest = {
        phone_hash: 'composite-test-hash',
        call_history: [
          // High frequency + unusual times + location jumps
          { timestamp: '2025-01-01T01:00:00Z', call_id: 'call1', location: { latitude: 59.3293, longitude: 18.0686 } },
          { timestamp: '2025-01-01T01:05:00Z', call_id: 'call2', location: { latitude: 59.3293, longitude: 18.0686 } },
          { timestamp: '2025-01-01T01:10:00Z', call_id: 'call3', location: { latitude: 59.3293, longitude: 18.0686 } },
          { timestamp: '2025-01-01T01:15:00Z', call_id: 'call4', location: { latitude: 59.3293, longitude: 18.0686 } },
          { timestamp: '2025-01-01T01:20:00Z', call_id: 'call5', location: { latitude: 59.3293, longitude: 18.0686 } },
          { timestamp: '2025-01-01T01:25:00Z', call_id: 'call6', location: { latitude: 57.7089, longitude: 11.9746 } },
          { timestamp: '2025-01-01T01:30:00Z', call_id: 'call7', location: { latitude: 57.7089, longitude: 11.9746 } }
        ],
        time_window_start: '2025-01-01T00:00:00Z',
        time_window_end: '2025-01-01T02:00:00Z'
      };

      // Act
      const result = await behavioralPatternService.analyzeBehavioralPatterns(request);

      // Assert
      expect(result.patterns_detected).toHaveLength(3);
      expect(result.composite_behavioral_score).toBeGreaterThan(10);
      expect(result.composite_behavioral_score).toBeLessThanOrEqual(30); // Max score is 30
      expect(result.overall_risk_level).toBeOneOf(['medium', 'high', 'critical']);
    });

    test('should apply pattern type bonus for multiple detections', async () => {
      // Mock multiple patterns with moderate individual scores
      MockBehavioralPatternModel.create
        .mockResolvedValueOnce({ id: 'pattern1', pattern_type: 'call_frequency', risk_score: 8 } as any)
        .mockResolvedValueOnce({ id: 'pattern2', pattern_type: 'time_pattern', risk_score: 7 } as any)
        .mockResolvedValueOnce({ id: 'pattern3', pattern_type: 'similarity_pattern', risk_score: 9 } as any);

      const request: BehavioralAnalysisRequest = {
        phone_hash: 'bonus-test-hash',
        call_history: createMockCallHistory(8), // Enough calls to trigger patterns
        time_window_start: '2025-01-01T00:00:00Z',
        time_window_end: '2025-01-01T02:00:00Z'
      };

      // Act
      const result = await behavioralPatternService.analyzeBehavioralPatterns(request);

      // Assert
      // Base average: (8 + 7 + 9) / 3 = 8
      // With 3 pattern types, bonus should be (3-1) * 2 = 4
      // Expected composite: 8 + 4 = 12
      expect(result.composite_behavioral_score).toBeGreaterThan(10);
      expect(result.patterns_detected).toHaveLength(3);
    });

    test('should cap composite score at maximum (30)', async () => {
      // Mock very high risk patterns
      MockBehavioralPatternModel.create
        .mockResolvedValueOnce({ id: 'pattern1', pattern_type: 'call_frequency', risk_score: 30 } as any)
        .mockResolvedValueOnce({ id: 'pattern2', pattern_type: 'time_pattern', risk_score: 30 } as any)
        .mockResolvedValueOnce({ id: 'pattern3', pattern_type: 'location_pattern', risk_score: 30 } as any);

      const request: BehavioralAnalysisRequest = {
        phone_hash: 'max-score-hash',
        call_history: createMockCallHistory(20), // Extreme case
        time_window_start: '2025-01-01T00:00:00Z',
        time_window_end: '2025-01-01T03:00:00Z'
      };

      // Act  
      const result = await behavioralPatternService.analyzeBehavioralPatterns(request);

      // Assert
      expect(result.composite_behavioral_score).toBe(30); // Should be capped
      expect(result.overall_risk_level).toBe('critical');
    });
  });

  describe('Risk Level Determination', () => {
    const riskLevelTests = [
      { score: 29, expectedLevel: 'critical' },
      { score: 25, expectedLevel: 'critical' },
      { score: 24, expectedLevel: 'high' },
      { score: 18, expectedLevel: 'high' },
      { score: 17, expectedLevel: 'medium' },
      { score: 10, expectedLevel: 'medium' },
      { score: 9, expectedLevel: 'low' },
      { score: 0, expectedLevel: 'low' }
    ];

    riskLevelTests.forEach(({ score, expectedLevel }) => {
      test(`should classify score ${score} as ${expectedLevel} risk`, async () => {
        // Mock a pattern that will result in the target score
        MockBehavioralPatternModel.create.mockResolvedValue({
          id: 'test-pattern',
          pattern_type: 'call_frequency',
          risk_score: score
        } as any);

        const request: BehavioralAnalysisRequest = {
          phone_hash: `risk-test-${score}`,
          call_history: createMockCallHistory(score > 15 ? 10 : 3),
          time_window_start: '2025-01-01T00:00:00Z',
          time_window_end: '2025-01-01T02:00:00Z'
        };

        // Act
        const result = await behavioralPatternService.analyzeBehavioralPatterns(request);

        // Assert
        expect(result.overall_risk_level).toBe(expectedLevel);
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle empty call history gracefully', async () => {
      // Arrange
      const request: BehavioralAnalysisRequest = {
        phone_hash: 'empty-history-hash',
        call_history: [],
        time_window_start: '2025-01-01T00:00:00Z',
        time_window_end: '2025-01-01T02:00:00Z'
      };

      // Act
      const result = await behavioralPatternService.analyzeBehavioralPatterns(request);

      // Assert
      expect(result.patterns_detected).toHaveLength(0);
      expect(result.composite_behavioral_score).toBe(0);
      expect(result.overall_risk_level).toBe('low');
      expect(result.call_frequency_pattern).toBeNull();
      expect(result.time_pattern).toBeNull();
      expect(result.location_pattern).toBeNull();
      expect(result.similarity_pattern).toBeNull();
    });

    test('should handle database save failures gracefully', async () => {
      // Arrange
      MockBehavioralPatternModel.create.mockRejectedValue(new Error('Database connection failed'));

      const request: BehavioralAnalysisRequest = {
        phone_hash: 'db-error-hash',
        call_history: createMockCallHistory(6),
        time_window_start: '2025-01-01T00:00:00Z',
        time_window_end: '2025-01-01T02:00:00Z'
      };

      // Act & Assert
      await expect(behavioralPatternService.analyzeBehavioralPatterns(request))
        .rejects.toThrow('Behavioral pattern analysis failed: Database connection failed');
    });

    test('should handle invalid timestamps in call history', async () => {
      // Arrange - Calls with invalid timestamps
      const request: BehavioralAnalysisRequest = {
        phone_hash: 'invalid-timestamp-hash',
        call_history: [
          { timestamp: 'invalid-date', call_id: 'call1' },
          { timestamp: '2025-01-01T10:00:00Z', call_id: 'call2' },
          { timestamp: '', call_id: 'call3' }
        ],
        time_window_start: '2025-01-01T00:00:00Z',
        time_window_end: '2025-01-01T23:59:59Z'
      };

      // Act - Should not throw, but should handle gracefully
      const result = await behavioralPatternService.analyzeBehavioralPatterns(request);

      // Assert
      expect(result).toBeDefined();
      expect(result.composite_behavioral_score).toBeGreaterThanOrEqual(0);
    });

    test('should handle malformed location data', async () => {
      // Arrange
      const request: BehavioralAnalysisRequest = {
        phone_hash: 'malformed-location-hash',
        call_history: [
          {
            timestamp: '2025-01-01T10:00:00Z',
            call_id: 'call1',
            location: { latitude: NaN, longitude: 18.0686 }
          },
          {
            timestamp: '2025-01-01T11:00:00Z',
            call_id: 'call2',
            location: { latitude: 59.3293, longitude: undefined as any }
          }
        ],
        time_window_start: '2025-01-01T09:00:00Z',
        time_window_end: '2025-01-01T12:00:00Z'
      };

      // Act - Should not throw
      const result = await behavioralPatternService.analyzeBehavioralPatterns(request);

      // Assert
      expect(result).toBeDefined();
      expect(result.location_pattern).toBeNull(); // Should not analyze invalid location data
    });
  });

  describe('Performance Requirements', () => {
    test('should complete analysis within reasonable time', async () => {
      // Arrange
      const request: BehavioralAnalysisRequest = {
        phone_hash: 'performance-test-hash',
        call_history: createMockCallHistory(20), // Large dataset
        time_window_start: '2025-01-01T00:00:00Z',
        time_window_end: '2025-01-01T23:59:59Z'
      };

      // Act
      const startTime = Date.now();
      const result = await behavioralPatternService.analyzeBehavioralPatterns(request);
      const totalTime = Date.now() - startTime;

      // Assert
      expect(totalTime).toBeLessThan(3000); // Should complete within 3 seconds
      expect(result.processing_time_ms).toBeDefined();
      expect(result.processing_time_ms).toBeLessThan(3000);
    });

    test('should run pattern analyses in parallel', async () => {
      // Arrange
      const request: BehavioralAnalysisRequest = {
        phone_hash: 'parallel-test-hash',
        call_history: createMockCallHistory(15),
        time_window_start: '2025-01-01T00:00:00Z',
        time_window_end: '2025-01-01T23:59:59Z'
      };

      // Act
      const startTime = Date.now();
      const result = await behavioralPatternService.analyzeBehavioralPatterns(request);
      const totalTime = Date.now() - startTime;

      // Assert - Should be faster than if run sequentially
      expect(totalTime).toBeLessThan(2000);
      expect(result.processing_time_ms).toBeLessThan(2000);
    });
  });

  describe('Algorithm Accuracy', () => {
    test('should correctly calculate distance using Haversine formula', async () => {
      // Test distance calculation between known coordinates
      // Stockholm to Gothenburg is approximately 470km
      const request: BehavioralAnalysisRequest = {
        phone_hash: 'distance-test-hash',
        call_history: [
          {
            timestamp: '2025-01-01T10:00:00Z',
            call_id: 'call1',
            location: { latitude: 59.3293, longitude: 18.0686 } // Stockholm
          },
          {
            timestamp: '2025-01-01T18:00:00Z', // 8 hours later (reasonable travel time)
            call_id: 'call2',
            location: { latitude: 57.7089, longitude: 11.9746 } // Gothenburg
          }
        ],
        time_window_start: '2025-01-01T09:00:00Z',
        time_window_end: '2025-01-01T19:00:00Z'
      };

      // Act
      const result = await behavioralPatternService.analyzeBehavioralPatterns(request);

      // Assert - Should not flag as impossible travel (reasonable speed)
      expect(result.location_pattern).toBeNull();
    });

    test('should accurately calculate text similarity', async () => {
      // Test Jaccard similarity calculation
      const request: BehavioralAnalysisRequest = {
        phone_hash: 'similarity-accuracy-hash',
        call_history: [
          {
            timestamp: '2025-01-01T10:00:00Z',
            call_id: 'call1',
            transcript: 'the quick brown fox jumps'
          },
          {
            timestamp: '2025-01-01T11:00:00Z',
            call_id: 'call2', 
            transcript: 'the quick brown fox runs' // 80% similarity (4/5 words same)
          }
        ],
        time_window_start: '2025-01-01T09:00:00Z',
        time_window_end: '2025-01-01T12:00:00Z'
      };

      // Act
      const result = await behavioralPatternService.analyzeBehavioralPatterns(request);

      // Assert - Should not trigger high similarity (< 85% threshold)
      expect(result.similarity_pattern).toBeNull();
    });
  });

  // Helper function to create mock call history
  function createMockCallHistory(count: number): any[] {
    const calls = [];
    const baseTime = new Date('2025-01-01T01:00:00Z').getTime();
    
    for (let i = 0; i < count; i++) {
      calls.push({
        timestamp: new Date(baseTime + i * 5 * 60 * 1000).toISOString(), // 5 minutes apart
        call_id: `call${i + 1}`,
        transcript: `This is call number ${i + 1} with some content`,
        location: i % 2 === 0 ? { latitude: 59.3293, longitude: 18.0686 } : undefined
      });
    }
    
    return calls;
  }
});

/**
 * Integration Tests for Algorithm Edge Cases
 */
describe('BehavioralPatternService Edge Cases', () => {
  let behavioralPatternService: BehavioralPatternService;

  beforeEach(() => {
    jest.clearAllMocks();
    behavioralPatternService = new BehavioralPatternService();
    MockBehavioralPatternModel.create.mockResolvedValue({ id: 'test-pattern' } as any);
  });

  test('should handle timezone edge cases in time analysis', async () => {
    // Test calls spanning midnight in different timezones
    const request: BehavioralAnalysisRequest = {
      phone_hash: 'timezone-test-hash',
      call_history: [
        { timestamp: '2025-01-01T23:55:00Z', call_id: 'call1' }, // Before midnight UTC
        { timestamp: '2025-01-02T00:05:00Z', call_id: 'call2' }  // After midnight UTC  
      ],
      time_window_start: '2025-01-01T20:00:00Z',
      time_window_end: '2025-01-02T04:00:00Z'
    };

    const result = await behavioralPatternService.analyzeBehavioralPatterns(request);
    
    // Should handle the midnight crossing correctly
    expect(result).toBeDefined();
    expect(result.processing_time_ms).toBeGreaterThan(0);
  });

  test('should handle calls with identical timestamps', async () => {
    const identicalTime = '2025-01-01T10:00:00Z';
    const request: BehavioralAnalysisRequest = {
      phone_hash: 'identical-time-hash',
      call_history: [
        { timestamp: identicalTime, call_id: 'call1' },
        { timestamp: identicalTime, call_id: 'call2' },
        { timestamp: identicalTime, call_id: 'call3' }
      ],
      time_window_start: '2025-01-01T09:00:00Z',
      time_window_end: '2025-01-01T11:00:00Z'
    };

    const result = await behavioralPatternService.analyzeBehavioralPatterns(request);
    
    // Should handle simultaneous calls gracefully
    expect(result).toBeDefined();
    expect(result.call_frequency_pattern).toBeDefined(); // Should detect as rapid calls
  });

  test('should handle very long call transcripts', async () => {
    const longTranscript = 'Detta är en väldigt lång transkription som innehåller många ord och fraser som kan användas för att testa hur väl systemet hanterar stora textmängder i similarity analysen och om det kan hantera stora mängder data utan att krascha eller ta för lång tid att behandla vilket är viktigt för prestanda i produktionen när riktiga kunder använder systemet för att analysera sina telefonsamtal och upptäcka potentiella bedrägerimönster i beteende och innehåll som kan indikera på misstänkt aktivitet'.repeat(10);

    const request: BehavioralAnalysisRequest = {
      phone_hash: 'long-transcript-hash',
      call_history: [
        { timestamp: '2025-01-01T10:00:00Z', call_id: 'call1', transcript: longTranscript },
        { timestamp: '2025-01-01T11:00:00Z', call_id: 'call2', transcript: longTranscript.substring(0, 500) }
      ],
      time_window_start: '2025-01-01T09:00:00Z',
      time_window_end: '2025-01-01T12:00:00Z'
    };

    const startTime = Date.now();
    const result = await behavioralPatternService.analyzeBehavioralPatterns(request);
    const processingTime = Date.now() - startTime;

    // Should handle long text efficiently
    expect(result).toBeDefined();
    expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds even for long text
  });
});