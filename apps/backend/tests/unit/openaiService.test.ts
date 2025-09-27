import { openaiService } from '../../src/services/ai/openaiService';

// Mock OpenAI client
jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn()
      }
    },
    audio: {
      transcriptions: {
        create: jest.fn()
      }
    }
  }))
}));

describe('OpenAI Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OPENAI_API_KEY = 'test-key';
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  describe('analyzeFeedbackQuality', () => {
    it('should analyze feedback quality and return structured assessment', async () => {
      const mockOpenAI = require('openai').OpenAI;
      const mockInstance = new mockOpenAI();
      
      mockInstance.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              legitimacy_score: 0.85,
              depth_score: 0.72,
              usefulness_score: 0.68,
              overall_quality_score: 0.75,
              reward_percentage: 11.25,
              is_fraudulent: false,
              analysis_summary: 'Positive feedback about store service',
              business_actionable_items: ['Improve checkout speed', 'Train staff on product knowledge']
            })
          }
        }]
      });

      const conversationTranscript = [
        { speaker: 'ai', content: 'How was your experience?', timestamp: '2025-01-01T10:00:00Z' },
        { speaker: 'customer', content: 'Great service, friendly staff', timestamp: '2025-01-01T10:00:05Z' }
      ];

      const businessContext = {
        storeName: 'Test Store',
        departments: ['Electronics', 'Clothing'],
        operatingHours: { monday: '9-18' }
      };

      const result = await openaiService.analyzeFeedbackQuality(
        conversationTranscript,
        businessContext
      );

      expect(result).toMatchObject({
        legitimacy_score: expect.any(Number),
        depth_score: expect.any(Number),
        usefulness_score: expect.any(Number),
        overall_quality_score: expect.any(Number),
        reward_percentage: expect.any(Number),
        is_fraudulent: expect.any(Boolean),
        analysis_summary: expect.any(String),
        business_actionable_items: expect.any(Array)
      });

      expect(result.legitimacy_score).toBeGreaterThanOrEqual(0);
      expect(result.legitimacy_score).toBeLessThanOrEqual(1);
      expect(result.reward_percentage).toBeGreaterThanOrEqual(2);
      expect(result.reward_percentage).toBeLessThanOrEqual(15);
    });

    it('should handle invalid JSON response from OpenAI', async () => {
      const mockOpenAI = require('openai').OpenAI;
      const mockInstance = new mockOpenAI();
      
      mockInstance.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: 'Invalid JSON response'
          }
        }]
      });

      const conversationTranscript = [
        { speaker: 'customer', content: 'Test feedback', timestamp: '2025-01-01T10:00:00Z' }
      ];

      const businessContext = { storeName: 'Test Store' };

      await expect(
        openaiService.analyzeFeedbackQuality(conversationTranscript, businessContext)
      ).rejects.toThrow('Failed to parse OpenAI response');
    });

    it('should handle OpenAI API errors', async () => {
      const mockOpenAI = require('openai').OpenAI;
      const mockInstance = new mockOpenAI();
      
      mockInstance.chat.completions.create.mockRejectedValue(
        new Error('OpenAI API error')
      );

      const conversationTranscript = [
        { speaker: 'customer', content: 'Test feedback', timestamp: '2025-01-01T10:00:00Z' }
      ];

      const businessContext = { storeName: 'Test Store' };

      await expect(
        openaiService.analyzeFeedbackQuality(conversationTranscript, businessContext)
      ).rejects.toThrow('OpenAI API error');
    });
  });

  describe('detectFraud', () => {
    it('should detect potential fraud in feedback', async () => {
      const mockOpenAI = require('openai').OpenAI;
      const mockInstance = new mockOpenAI();
      
      mockInstance.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              is_suspicious: true,
              confidence_level: 0.82,
              fraud_indicators: ['Generic responses', 'Timing inconsistencies'],
              context_violations: ['Mentioned products not sold at store'],
              decision_reasoning: 'Customer mentioned products not available at this store location'
            })
          }
        }]
      });

      const conversationTranscript = [
        { speaker: 'customer', content: 'I bought expensive watches there', timestamp: '2025-01-01T10:00:00Z' }
      ];

      const businessContext = {
        storeName: 'Electronics Store',
        departments: ['Computers', 'Phones'],
        baseline_facts: { products: ['laptops', 'smartphones'] }
      };

      const result = await openaiService.detectFraud(
        conversationTranscript,
        businessContext
      );

      expect(result).toMatchObject({
        is_suspicious: true,
        confidence_level: expect.any(Number),
        fraud_indicators: expect.any(Array),
        context_violations: expect.any(Array),
        decision_reasoning: expect.any(String)
      });

      expect(result.confidence_level).toBeGreaterThanOrEqual(0);
      expect(result.confidence_level).toBeLessThanOrEqual(1);
    });
  });

  describe('generateConversationSummary', () => {
    it('should generate a concise conversation summary', async () => {
      const mockOpenAI = require('openai').OpenAI;
      const mockInstance = new mockOpenAI();
      
      mockInstance.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: 'Customer praised the helpful staff and quick service at the electronics department. Suggested improving parking availability.'
          }
        }]
      });

      const conversationTranscript = [
        { speaker: 'ai', content: 'How was your visit?', timestamp: '2025-01-01T10:00:00Z' },
        { speaker: 'customer', content: 'Staff was very helpful in electronics, service was quick. Parking was hard to find though.', timestamp: '2025-01-01T10:00:05Z' }
      ];

      const result = await openaiService.generateConversationSummary(conversationTranscript);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(10);
      expect(result.length).toBeLessThan(500);
    });
  });

  describe('Swedish language handling', () => {
    it('should process Swedish conversation correctly', async () => {
      const mockOpenAI = require('openai').OpenAI;
      const mockInstance = new mockOpenAI();
      
      mockInstance.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              legitimacy_score: 0.80,
              depth_score: 0.70,
              usefulness_score: 0.65,
              overall_quality_score: 0.72,
              reward_percentage: 10.8,
              is_fraudulent: false,
              analysis_summary: 'Positiv feedback om butikens service',
              business_actionable_items: ['Förbättra kassaflödet', 'Utbilda personal']
            })
          }
        }]
      });

      const swedishTranscript = [
        { speaker: 'ai', content: 'Hur var din upplevelse?', timestamp: '2025-01-01T10:00:00Z' },
        { speaker: 'customer', content: 'Mycket bra service, trevlig personal', timestamp: '2025-01-01T10:00:05Z' }
      ];

      const businessContext = {
        storeName: 'Testbutik',
        departments: ['Elektronik', 'Kläder']
      };

      const result = await openaiService.analyzeFeedbackQuality(
        swedishTranscript,
        businessContext
      );

      expect(result).toMatchObject({
        overall_quality_score: expect.any(Number),
        analysis_summary: expect.stringContaining('feedback')
      });
    });
  });

  describe('Configuration validation', () => {
    it('should throw error when OpenAI API key is missing', () => {
      delete process.env.OPENAI_API_KEY;

      expect(() => {
        // This would reinitialize the service
        jest.resetModules();
        require('../../src/services/ai/openaiService');
      }).toThrow();
    });
  });
});