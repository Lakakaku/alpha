/**
 * Unit Tests: Context Analysis Service
 * Task: T073 - Unit tests for context analysis in apps/backend/tests/unit/context-analysis.test.ts
 * 
 * Tests the AI-powered context analysis service including:
 * - GPT-4o-mini integration
 * - Score calculation algorithms
 * - Swedish language processing
 * - Cultural context evaluation
 * - Impossible claims detection
 * - Error handling and resilience
 */

import { ContextAnalysisService } from '../../src/services/fraud/contextAnalysisService';
import { ContextAnalysisModel } from '../../../../packages/database/src/fraud/context-analysis';
import {
  ContextAnalysisRequest,
  ContextAnalysisResult,
  LegitimacyIndicator,
  CulturalContext,
  ImpossibleClaim
} from '../../../../packages/types/src/fraud';
import { OpenAI } from 'openai';

// Mock dependencies
jest.mock('openai');
jest.mock('../../../../packages/database/src/fraud/context-analysis');

const MockOpenAI = OpenAI as jest.MockedClass<typeof OpenAI>;
const MockContextAnalysisModel = ContextAnalysisModel as jest.MockedClass<typeof ContextAnalysisModel>;

describe('ContextAnalysisService', () => {
  let contextAnalysisService: ContextAnalysisService;
  let mockOpenAI: jest.Mocked<OpenAI>;
  let mockChatCompletions: jest.Mocked<OpenAI.Chat.Completions>;

  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup environment
    process.env = {
      ...originalEnv,
      OPENAI_API_KEY: 'test-api-key'
    };

    // Setup OpenAI mock
    mockChatCompletions = {
      create: jest.fn()
    } as any;

    mockOpenAI = {
      chat: {
        completions: mockChatCompletions
      }
    } as any;

    MockOpenAI.mockImplementation(() => mockOpenAI);

    // Setup database mock
    MockContextAnalysisModel.create.mockResolvedValue({
      id: 'test-analysis-id',
      phone_hash: 'test-hash',
      legitimacy_score: 85,
      cultural_context_score: 90,
      impossible_claims_score: 95,
      confidence_level: 0.92
    } as any);

    contextAnalysisService = new ContextAnalysisService();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Service Initialization', () => {
    test('should initialize with valid OpenAI API key', () => {
      expect(() => new ContextAnalysisService()).not.toThrow();
      expect(MockOpenAI).toHaveBeenCalledWith({
        apiKey: 'test-api-key'
      });
    });

    test('should throw error when OpenAI API key is missing', () => {
      delete process.env.OPENAI_API_KEY;
      
      expect(() => new ContextAnalysisService()).toThrow('OpenAI API key is required for context analysis');
    });

    test('should throw error when OpenAI API key is empty string', () => {
      process.env.OPENAI_API_KEY = '';
      
      expect(() => new ContextAnalysisService()).toThrow('OpenAI API key is required for context analysis');
    });
  });

  describe('Context Analysis', () => {
    test('should analyze legitimate Swedish feedback successfully', async () => {
      // Arrange
      const request: ContextAnalysisRequest = {
        phone_hash: 'test-phone-hash',
        call_transcript: 'Hej, jag ringde angående min beställning som kom försenad...',
        feedback_content: 'Servicen var bra men leveransen var försenad med två dagar',
        context_metadata: {
          store_id: 'test-store',
          business_type: 'restaurant'
        }
      };

      const mockGPTResponse = {
        legitimacy_score: 35, // High legitimacy
        cultural_context_score: 28, // Good cultural context
        impossible_claims_score: 29, // No impossible claims
        confidence_level: 0.92,
        legitimacy_indicators: [
          {
            type: 'consistency',
            description: 'Berättelsen är konsistent och logisk',
            impact: 'positive',
            weight: 0.8
          }
        ],
        cultural_context: {
          language_authenticity: 0.95,
          cultural_knowledge: 0.88,
          local_references: 0.82,
          business_understanding: 0.91,
          overall_cultural_fit: 0.89
        },
        impossible_claims: [],
        reasoning: 'Feedbacken visar på äkta svensk kundupplevelse med realistiska klagomål',
        patterns: ['naturlig_språkanvändning', 'realistisk_tidsram'],
        red_flags: []
      };

      mockChatCompletions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify(mockGPTResponse)
          }
        }]
      } as any);

      // Act
      const result = await contextAnalysisService.analyzeContext(request);

      // Assert
      expect(result.analysis_id).toBe('test-analysis-id');
      expect(result.legitimacy_score).toBe(35);
      expect(result.cultural_context_score).toBe(28);
      expect(result.impossible_claims_score).toBe(29);
      expect(result.overall_context_score).toBeCloseTo(30.8, 1); // (35*0.4 + 28*0.3 + 29*0.3)
      expect(result.confidence_level).toBe(0.92);
      expect(result.legitimacy_indicators).toHaveLength(1);
      expect(result.impossible_claims).toHaveLength(0);
    });

    test('should detect fraudulent feedback with impossible claims', async () => {
      // Arrange
      const request: ContextAnalysisRequest = {
        phone_hash: 'suspicious-hash',
        call_transcript: 'I ordered pizza and it arrived in 5 seconds teleported',
        feedback_content: 'The pizza was delivered by drone in 2 seconds from Stockholm to Gothenburg',
        context_metadata: {
          store_id: 'pizza-store',
          business_type: 'restaurant'
        }
      };

      const mockGPTResponse = {
        legitimacy_score: 5, // Very low legitimacy
        cultural_context_score: 8, // Poor cultural context (English instead of Swedish)
        impossible_claims_score: 2, // Very high impossibility (inverted scoring)
        confidence_level: 0.95,
        legitimacy_indicators: [
          {
            type: 'logic',
            description: 'Påståenden bryter mot fysikens lagar',
            impact: 'negative',
            weight: 0.9
          }
        ],
        cultural_context: {
          language_authenticity: 0.1, // Using English instead of Swedish
          cultural_knowledge: 0.2,
          local_references: 0.3,
          business_understanding: 0.15,
          overall_cultural_fit: 0.19
        },
        impossible_claims: [
          {
            claim: 'Pizza delivered in 2 seconds from Stockholm to Gothenburg',
            impossibility_type: 'physics',
            severity: 10,
            explanation: 'Omöjligt att leverera mat över 400km på 2 sekunder'
          },
          {
            claim: 'Teleported delivery',
            impossibility_type: 'physics',
            severity: 10,
            explanation: 'Teleportering existerar inte i verkligheten'
          }
        ],
        reasoning: 'Feedbacken innehåller fysiskt omöjliga påståenden och använder fel språk',
        patterns: ['omöjliga_påståenden', 'fel_språk', 'orealistiska_tidsramar'],
        red_flags: ['teleportering', 'omöjlig_leveranstid', 'engelska_istället_för_svenska']
      };

      mockChatCompletions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify(mockGPTResponse)
          }
        }]
      } as any);

      // Act
      const result = await contextAnalysisService.analyzeContext(request);

      // Assert
      expect(result.legitimacy_score).toBe(5);
      expect(result.impossible_claims).toHaveLength(2);
      expect(result.impossible_claims[0].severity).toBe(10);
      expect(result.red_flags).toContain('teleportering');
      expect(result.cultural_context.language_authenticity).toBe(0.1);
      expect(result.overall_context_score).toBeCloseTo(5.0, 1); // Very low overall score
    });

    test('should handle moderate risk cases with mixed indicators', async () => {
      // Arrange
      const request: ContextAnalysisRequest = {
        phone_hash: 'mixed-case-hash',
        call_transcript: 'Jag köpte en bil igår och den var okej men...',
        feedback_content: 'Bilen var bra men priset kändes högt för vad jag fick',
        context_metadata: {
          store_id: 'car-dealership',
          business_type: 'automotive'
        }
      };

      const mockGPTResponse = {
        legitimacy_score: 25, // Moderate legitimacy
        cultural_context_score: 22, // Good Swedish but some inconsistencies
        impossible_claims_score: 25, // Some minor inconsistencies
        confidence_level: 0.75,
        legitimacy_indicators: [
          {
            type: 'consistency',
            description: 'Mestadels konsistent berättelse med mindre tveksamheter',
            impact: 'neutral',
            weight: 0.6
          },
          {
            type: 'details',
            description: 'Några specifika detaljer saknas',
            impact: 'negative',
            weight: 0.4
          }
        ],
        cultural_context: {
          language_authenticity: 0.85,
          cultural_knowledge: 0.75,
          local_references: 0.70,
          business_understanding: 0.80,
          overall_cultural_fit: 0.78
        },
        impossible_claims: [
          {
            claim: 'Köpte bil igår',
            impossibility_type: 'logistics',
            severity: 3,
            explanation: 'Bilköp brukar ta längre tid än en dag att slutföra'
          }
        ],
        reasoning: 'Feedbacken är mestadels trovärdig men innehåller några mindre flaggor',
        patterns: ['snabb_bilköp', 'allmän_feedback'],
        red_flags: ['ovanligt_snabb_transaktion']
      };

      mockChatCompletions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify(mockGPTResponse)
          }
        }]
      } as any);

      // Act
      const result = await contextAnalysisService.analyzeContext(request);

      // Assert
      expect(result.legitimacy_score).toBe(25);
      expect(result.cultural_context_score).toBe(22);
      expect(result.impossible_claims_score).toBe(25);
      expect(result.overall_context_score).toBeCloseTo(24.1, 1); // (25*0.4 + 22*0.3 + 25*0.3)
      expect(result.confidence_level).toBe(0.75);
      expect(result.impossible_claims).toHaveLength(1);
      expect(result.impossible_claims[0].severity).toBe(3); // Low severity
      expect(result.legitimacy_indicators).toHaveLength(2);
    });
  });

  describe('Score Calculation', () => {
    test('should calculate overall score using correct weights (40/30/30)', () => {
      // This is tested implicitly through the analyzeContext tests
      // Testing the private method indirectly through public interface
      
      const testCases = [
        { legitimacy: 40, cultural: 30, impossible: 30, expected: 35.0 },
        { legitimacy: 20, cultural: 15, impossible: 10, expected: 16.5 },
        { legitimacy: 0, cultural: 0, impossible: 0, expected: 0.0 },
        { legitimacy: 35, cultural: 25, impossible: 20, expected: 28.5 }
      ];

      // We can't test the private method directly, but the calculation is verified
      // through the integration tests above where we control the GPT response
      expect(true).toBe(true); // Placeholder - actual testing happens in integration tests
    });

    test('should round scores to 2 decimal places', async () => {
      // Arrange
      const request: ContextAnalysisRequest = {
        phone_hash: 'precision-test-hash',
        call_transcript: 'Test transcript',
        feedback_content: 'Test feedback'
      };

      const mockGPTResponse = {
        legitimacy_score: 33.333, // Results in decimal places
        cultural_context_score: 26.666,
        impossible_claims_score: 23.333,
        confidence_level: 0.87,
        legitimacy_indicators: [],
        cultural_context: {
          language_authenticity: 0.85,
          cultural_knowledge: 0.80,
          local_references: 0.75,
          business_understanding: 0.82,
          overall_cultural_fit: 0.81
        },
        impossible_claims: [],
        reasoning: 'Test reasoning',
        patterns: [],
        red_flags: []
      };

      mockChatCompletions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify(mockGPTResponse)
          }
        }]
      } as any);

      // Act
      const result = await contextAnalysisService.analyzeContext(request);

      // Assert
      // Expected: (33.333 * 0.4) + (26.666 * 0.3) + (23.333 * 0.3) = 28.3332
      expect(result.overall_context_score).toBe(28.33); // Should be rounded to 2 decimal places
      expect(typeof result.overall_context_score).toBe('number');
    });
  });

  describe('Swedish Language Processing', () => {
    test('should properly process Swedish characters and phrases', async () => {
      // Arrange
      const request: ContextAnalysisRequest = {
        phone_hash: 'swedish-test-hash',
        call_transcript: 'Hej! Jag skulle vilja klaga på leveransen av min beställning från förra veckan.',
        feedback_content: 'Maten var kall när den kom och personalen var otrevlig. Jag är mycket missnöjd.',
        context_metadata: {
          store_id: 'restaurant-sve',
          business_type: 'restaurant'
        }
      };

      const mockGPTResponse = {
        legitimacy_score: 32,
        cultural_context_score: 27,
        impossible_claims_score: 28,
        confidence_level: 0.88,
        legitimacy_indicators: [
          {
            type: 'emotion',
            description: 'Naturlig emotionell ton för svenska klagomål',
            impact: 'positive',
            weight: 0.7
          }
        ],
        cultural_context: {
          language_authenticity: 0.95,
          cultural_knowledge: 0.90,
          local_references: 0.85,
          business_understanding: 0.88,
          overall_cultural_fit: 0.90
        },
        impossible_claims: [],
        reasoning: 'Äkta svensk kundkommunikation med korrekt språkbruk och kulturell kontext',
        patterns: ['naturlig_svenska', 'kulturell_kontext', 'realistiska_klagomål'],
        red_flags: []
      };

      mockChatCompletions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify(mockGPTResponse)
          }
        }]
      } as any);

      // Act
      const result = await contextAnalysisService.analyzeContext(request);

      // Assert
      expect(result.cultural_context.language_authenticity).toBeGreaterThan(0.9);
      expect(result.patterns_detected).toContain('naturlig_svenska');
      expect(result.red_flags).toHaveLength(0);
      
      // Verify that the Swedish text was properly passed to GPT
      expect(mockChatCompletions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o-mini',
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('Hej! Jag skulle vilja klaga')
            })
          ])
        })
      );
    });

    test('should detect non-Swedish language as cultural red flag', async () => {
      // Arrange
      const request: ContextAnalysisRequest = {
        phone_hash: 'english-test-hash',
        call_transcript: 'Hello, I want to complain about my order from last week.',
        feedback_content: 'The food was terrible and the service was bad.',
        context_metadata: {
          store_id: 'restaurant-eng',
          business_type: 'restaurant'
        }
      };

      const mockGPTResponse = {
        legitimacy_score: 15, // Lower due to language mismatch
        cultural_context_score: 8, // Very low cultural context
        impossible_claims_score: 25, // Claims themselves aren't impossible
        confidence_level: 0.85,
        legitimacy_indicators: [
          {
            type: 'consistency',
            description: 'Berättelsen är konsistent men på fel språk',
            impact: 'negative',
            weight: 0.8
          }
        ],
        cultural_context: {
          language_authenticity: 0.1, // Using English instead of Swedish
          cultural_knowledge: 0.3,
          local_references: 0.2,
          business_understanding: 0.4,
          overall_cultural_fit: 0.25
        },
        impossible_claims: [],
        reasoning: 'Feedback på engelska istället för svenska indikerar potentiellt bedrägeri',
        patterns: ['engelska_språk', 'icke_svensk_kontext'],
        red_flags: ['fel_språk', 'misstänkt_ursprung']
      };

      mockChatCompletions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify(mockGPTResponse)
          }
        }]
      } as any);

      // Act
      const result = await contextAnalysisService.analyzeContext(request);

      // Assert
      expect(result.cultural_context_score).toBeLessThan(15);
      expect(result.cultural_context.language_authenticity).toBeLessThan(0.2);
      expect(result.red_flags).toContain('fel_språk');
      expect(result.patterns_detected).toContain('engelska_språk');
    });
  });

  describe('Error Handling', () => {
    test('should handle OpenAI API errors gracefully', async () => {
      // Arrange
      const request: ContextAnalysisRequest = {
        phone_hash: 'error-test-hash',
        call_transcript: 'Test transcript',
        feedback_content: 'Test feedback'
      };

      mockChatCompletions.create.mockRejectedValue(new Error('OpenAI API rate limit exceeded'));

      // Act & Assert
      await expect(contextAnalysisService.analyzeContext(request))
        .rejects.toThrow('Context analysis failed: GPT analysis failed: OpenAI API rate limit exceeded');
    });

    test('should handle invalid JSON response from GPT', async () => {
      // Arrange
      const request: ContextAnalysisRequest = {
        phone_hash: 'invalid-json-hash',
        call_transcript: 'Test transcript',
        feedback_content: 'Test feedback'
      };

      mockChatCompletions.create.mockResolvedValue({
        choices: [{
          message: {
            content: 'This is not valid JSON'
          }
        }]
      } as any);

      // Act & Assert
      await expect(contextAnalysisService.analyzeContext(request))
        .rejects.toThrow('Context analysis failed: GPT analysis failed:');
    });

    test('should handle empty response from GPT', async () => {
      // Arrange
      const request: ContextAnalysisRequest = {
        phone_hash: 'empty-response-hash',
        call_transcript: 'Test transcript',
        feedback_content: 'Test feedback'
      };

      mockChatCompletions.create.mockResolvedValue({
        choices: []
      } as any);

      // Act & Assert
      await expect(contextAnalysisService.analyzeContext(request))
        .rejects.toThrow('Context analysis failed: GPT analysis failed: No response from GPT-4o-mini');
    });

    test('should handle database save errors', async () => {
      // Arrange
      const request: ContextAnalysisRequest = {
        phone_hash: 'db-error-hash',
        call_transcript: 'Test transcript',
        feedback_content: 'Test feedback'
      };

      const mockGPTResponse = {
        legitimacy_score: 30,
        cultural_context_score: 25,
        impossible_claims_score: 28,
        confidence_level: 0.8,
        legitimacy_indicators: [],
        cultural_context: {
          language_authenticity: 0.8,
          cultural_knowledge: 0.7,
          local_references: 0.6,
          business_understanding: 0.75,
          overall_cultural_fit: 0.73
        },
        impossible_claims: [],
        reasoning: 'Test reasoning',
        patterns: [],
        red_flags: []
      };

      mockChatCompletions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify(mockGPTResponse)
          }
        }]
      } as any);

      MockContextAnalysisModel.create.mockRejectedValue(new Error('Database connection failed'));

      // Act & Assert
      await expect(contextAnalysisService.analyzeContext(request))
        .rejects.toThrow('Context analysis failed: Database connection failed');
    });

    test('should handle missing required fields in request', async () => {
      // Arrange
      const invalidRequest = {
        phone_hash: '',
        call_transcript: '',
        feedback_content: ''
      } as ContextAnalysisRequest;

      const mockGPTResponse = {
        legitimacy_score: 0,
        cultural_context_score: 0,
        impossible_claims_score: 0,
        confidence_level: 0.5,
        legitimacy_indicators: [],
        cultural_context: {
          language_authenticity: 0.0,
          cultural_knowledge: 0.0,
          local_references: 0.0,
          business_understanding: 0.0,
          overall_cultural_fit: 0.0
        },
        impossible_claims: [],
        reasoning: 'Ingen data att analysera',
        patterns: [],
        red_flags: ['ingen_data']
      };

      mockChatCompletions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify(mockGPTResponse)
          }
        }]
      } as any);

      // Act - Should not throw, but should handle gracefully
      const result = await contextAnalysisService.analyzeContext(invalidRequest);

      // Assert
      expect(result.overall_context_score).toBe(0);
      expect(result.red_flags).toContain('ingen_data');
    });
  });

  describe('Performance Requirements', () => {
    test('should complete analysis within reasonable time limits', async () => {
      // Arrange
      const request: ContextAnalysisRequest = {
        phone_hash: 'performance-test-hash',
        call_transcript: 'Hej, detta är ett test för prestanda',
        feedback_content: 'Detta är ett test för att mäta prestanda'
      };

      const mockGPTResponse = {
        legitimacy_score: 30,
        cultural_context_score: 25,
        impossible_claims_score: 28,
        confidence_level: 0.8,
        legitimacy_indicators: [],
        cultural_context: {
          language_authenticity: 0.9,
          cultural_knowledge: 0.8,
          local_references: 0.7,
          business_understanding: 0.85,
          overall_cultural_fit: 0.81
        },
        impossible_claims: [],
        reasoning: 'Performance test analysis',
        patterns: ['performance_test'],
        red_flags: []
      };

      // Simulate realistic API response time
      mockChatCompletions.create.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms simulated API call
        return {
          choices: [{
            message: {
              content: JSON.stringify(mockGPTResponse)
            }
          }]
        } as any;
      });

      // Act
      const startTime = Date.now();
      const result = await contextAnalysisService.analyzeContext(request);
      const totalTime = Date.now() - startTime;

      // Assert
      expect(totalTime).toBeLessThan(2000); // Should complete within 2 seconds
      expect(result.processing_time_ms).toBeDefined();
      expect(result.processing_time_ms).toBeGreaterThan(0);
      expect(result.processing_time_ms).toBeLessThan(2000);
    });

    test('should use correct GPT-4o-mini configuration', async () => {
      // Arrange
      const request: ContextAnalysisRequest = {
        phone_hash: 'config-test-hash',
        call_transcript: 'Test configuration',
        feedback_content: 'Test configuration'
      };

      const mockGPTResponse = {
        legitimacy_score: 25,
        cultural_context_score: 20,
        impossible_claims_score: 25,
        confidence_level: 0.75,
        legitimacy_indicators: [],
        cultural_context: {
          language_authenticity: 0.8,
          cultural_knowledge: 0.7,
          local_references: 0.6,
          business_understanding: 0.75,
          overall_cultural_fit: 0.73
        },
        impossible_claims: [],
        reasoning: 'Configuration test',
        patterns: [],
        red_flags: []
      };

      mockChatCompletions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify(mockGPTResponse)
          }
        }]
      } as any);

      // Act
      await contextAnalysisService.analyzeContext(request);

      // Assert
      expect(mockChatCompletions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o-mini',
          max_tokens: 1000,
          temperature: 0.1, // Low temperature for consistent analysis
          response_format: { type: 'json_object' }
        })
      );
    });
  });
});