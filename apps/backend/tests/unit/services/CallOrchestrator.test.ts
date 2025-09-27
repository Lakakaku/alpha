// Jest globals are available globally
import { CallOrchestrator } from '../../../src/services/calls/CallOrchestrator';
import { QuestionSelector } from '../../../src/services/calls/QuestionSelector';
import { FortyElksService } from '../../../src/services/telephony/FortyElksService';
import { TwilioService } from '../../../src/services/telephony/TwilioService';
import { OpenAIVoiceService } from '../../../src/services/ai/OpenAIVoiceService';
import { CallLogger } from '../../../src/services/calls/CallLogger';
import { CostTracker } from '../../../src/services/calls/CostTracker';

// Mock all dependencies
jest.mock('../../../src/services/calls/QuestionSelector');
jest.mock('../../../src/services/telephony/FortyElksService');
jest.mock('../../../src/services/telephony/TwilioService');
jest.mock('../../../src/services/ai/OpenAIVoiceService');
jest.mock('../../../src/services/calls/CallLogger');
jest.mock('../../../src/services/calls/CostTracker');
jest.mock('../../../src/config/database', () => ({
  supabase: {
    from: jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn()
        }))
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn()
          }))
        }))
      })),
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn()
        }))
      }))
    }))
  }
}));

describe('CallOrchestrator', () => {
  let orchestrator: CallOrchestrator;
  let mockQuestionSelector: jest.Mocked<QuestionSelector>;
  let mockFortyElksService: jest.Mocked<FortyElksService>;
  let mockTwilioService: jest.Mocked<TwilioService>;
  let mockOpenAIService: jest.Mocked<OpenAIVoiceService>;
  let mockCallLogger: jest.Mocked<CallLogger>;
  let mockCostTracker: jest.Mocked<CostTracker>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mocked instances
    mockQuestionSelector = new QuestionSelector() as jest.Mocked<QuestionSelector>;
    mockFortyElksService = new FortyElksService() as jest.Mocked<FortyElksService>;
    mockTwilioService = new TwilioService() as jest.Mocked<TwilioService>;
    mockOpenAIService = new OpenAIVoiceService() as jest.Mocked<OpenAIVoiceService>;
    mockCallLogger = new CallLogger() as jest.Mocked<CallLogger>;
    mockCostTracker = new CostTracker() as jest.Mocked<CostTracker>;

    orchestrator = new CallOrchestrator(
      mockQuestionSelector,
      mockFortyElksService,
      mockTwilioService,
      mockOpenAIService,
      mockCallLogger,
      mockCostTracker
    );
  });

  describe('initiateCall', () => {
    const mockCallRequest = {
      verificationId: '550e8400-e29b-41d4-a716-446655440001',
      businessId: '550e8400-e29b-41d4-a716-446655440000',
      customerPhone: '+46701234567',
      priority: 'normal' as const
    };

    it('should successfully initiate a call with 46elks', async () => {
      // Mock question selection
      mockQuestionSelector.selectQuestions.mockResolvedValue({
        selectedQuestions: [
          {
            id: 'q1',
            questionText: 'Hur var din upplevelse?',
            priority: 'high',
            maxResponseTime: 30
          }
        ],
        estimatedDuration: 60,
        selectionCriteria: { frequency: true }
      });

      // Mock 46elks service
      mockFortyElksService.initiateCall.mockResolvedValue({
        success: true,
        callId: '46elks-call-123',
        status: 'initiated'
      });

      // Mock cost tracking
      mockCostTracker.estimateCallCost.mockResolvedValue(0.12);

      const result = await orchestrator.initiateCall(mockCallRequest);

      expect(result.success).toBe(true);
      expect(result.callSession).toBeDefined();
      expect(result.callSession?.status).toBe('initiated');
      expect(mockQuestionSelector.selectQuestions).toHaveBeenCalledWith({
        businessId: mockCallRequest.businessId,
        customerCount: expect.any(Number),
        timeBudgetSeconds: 90
      });
      expect(mockFortyElksService.initiateCall).toHaveBeenCalledWith({
        customerPhone: mockCallRequest.customerPhone,
        callbackUrl: expect.stringContaining('/webhooks/telephony')
      });
    });

    it('should fallback to Twilio if 46elks fails', async () => {
      // Mock question selection
      mockQuestionSelector.selectQuestions.mockResolvedValue({
        selectedQuestions: [],
        estimatedDuration: 0,
        selectionCriteria: {}
      });

      // Mock 46elks failure
      mockFortyElksService.initiateCall.mockResolvedValue({
        success: false,
        error: 'Service unavailable'
      });

      // Mock Twilio success
      mockTwilioService.initiateCall.mockResolvedValue({
        success: true,
        callId: 'twilio-call-456',
        status: 'initiated'
      });

      const result = await orchestrator.initiateCall(mockCallRequest);

      expect(result.success).toBe(true);
      expect(mockFortyElksService.initiateCall).toHaveBeenCalled();
      expect(mockTwilioService.initiateCall).toHaveBeenCalled();
      expect(mockCallLogger.logEvent).toHaveBeenCalledWith(
        expect.any(String),
        'failed',
        expect.objectContaining({
          provider: '46elks',
          fallbackUsed: true
        })
      );
    });

    it('should handle complete telephony failure', async () => {
      // Mock question selection
      mockQuestionSelector.selectQuestions.mockResolvedValue({
        selectedQuestions: [],
        estimatedDuration: 0,
        selectionCriteria: {}
      });

      // Mock both providers failing
      mockFortyElksService.initiateCall.mockResolvedValue({
        success: false,
        error: 'Service unavailable'
      });

      mockTwilioService.initiateCall.mockResolvedValue({
        success: false,
        error: 'Network error'
      });

      const result = await orchestrator.initiateCall(mockCallRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('All telephony providers failed');
    });

    it('should validate call prerequisites', async () => {
      const invalidRequest = {
        ...mockCallRequest,
        customerPhone: 'invalid-phone'
      };

      const result = await orchestrator.initiateCall(invalidRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid phone number format');
    });
  });

  describe('handleCallAnswered', () => {
    const mockSessionId = '550e8400-e29b-41d4-a716-446655440002';

    it('should start AI conversation when call is answered', async () => {
      // Mock AI service
      mockOpenAIService.startSession.mockResolvedValue({
        success: true,
        sessionId: 'openai-session-123'
      });

      const result = await orchestrator.handleCallAnswered(mockSessionId, {
        callId: '46elks-call-123',
        answeredAt: new Date()
      });

      expect(result.success).toBe(true);
      expect(mockOpenAIService.startSession).toHaveBeenCalledWith({
        sessionId: mockSessionId,
        language: 'sv',
        voice: 'alloy',
        instructions: expect.stringContaining('svensk')
      });
    });

    it('should handle AI service failure gracefully', async () => {
      mockOpenAIService.startSession.mockResolvedValue({
        success: false,
        error: 'OpenAI API unavailable'
      });

      const result = await orchestrator.handleCallAnswered(mockSessionId, {
        callId: '46elks-call-123',
        answeredAt: new Date()
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to start AI session');
    });
  });

  describe('handleCallCompleted', () => {
    const mockSessionId = '550e8400-e29b-41d4-a716-446655440002';

    it('should process call completion and calculate costs', async () => {
      const completionData = {
        callId: '46elks-call-123',
        endedAt: new Date(),
        duration: 85,
        transcript: 'Customer feedback conversation transcript'
      };

      mockCostTracker.calculateFinalCost.mockResolvedValue({
        totalCost: 0.14,
        breakdown: {
          telephony: 0.08,
          ai: 0.06
        }
      });

      const result = await orchestrator.handleCallCompleted(mockSessionId, completionData);

      expect(result.success).toBe(true);
      expect(mockCostTracker.calculateFinalCost).toHaveBeenCalledWith(
        mockSessionId,
        completionData.duration
      );
      expect(mockCallLogger.logEvent).toHaveBeenCalledWith(
        mockSessionId,
        'completed',
        expect.objectContaining({
          duration: 85,
          totalCost: 0.14
        })
      );
    });

    it('should handle timeout scenarios', async () => {
      const timeoutData = {
        callId: '46elks-call-123',
        endedAt: new Date(),
        duration: 120,
        reason: 'timeout'
      };

      const result = await orchestrator.handleCallCompleted(mockSessionId, timeoutData);

      expect(result.success).toBe(true);
      expect(mockCallLogger.logEvent).toHaveBeenCalledWith(
        mockSessionId,
        'timeout',
        expect.objectContaining({
          reason: 'timeout',
          duration: 120
        })
      );
    });
  });

  describe('monitorCallDuration', () => {
    const mockSessionId = '550e8400-e29b-41d4-a716-446655440002';

    it('should send warning at 90 seconds', async () => {
      mockOpenAIService.sendInstruction.mockResolvedValue({
        success: true
      });

      const result = await orchestrator.monitorCallDuration(mockSessionId, 90);

      expect(result.warningIssued).toBe(true);
      expect(mockOpenAIService.sendInstruction).toHaveBeenCalledWith(
        expect.any(String),
        {
          type: 'time_warning',
          message: expect.stringContaining('tid för en sista'),
          timeRemaining: 30
        }
      );
    });

    it('should force end call at 120 seconds', async () => {
      mockFortyElksService.endCall.mockResolvedValue({
        success: true
      });

      const result = await orchestrator.monitorCallDuration(mockSessionId, 120);

      expect(result.callEnded).toBe(true);
      expect(mockFortyElksService.endCall).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle database connection errors', async () => {
      const mockCallRequest = {
        verificationId: '550e8400-e29b-41d4-a716-446655440001',
        businessId: '550e8400-e29b-41d4-a716-446655440000',
        customerPhone: '+46701234567',
        priority: 'normal' as const
      };

      // Mock database error
      jest.mocked(require('../../../src/config/database').supabase.from).mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const result = await orchestrator.initiateCall(mockCallRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database error');
    });

    it('should handle invalid session IDs', async () => {
      const result = await orchestrator.handleCallAnswered('invalid-session-id', {
        callId: 'test-call',
        answeredAt: new Date()
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid session ID');
    });
  });

  describe('cost optimization', () => {
    it('should track token usage and optimize for cost', async () => {
      const mockSessionId = '550e8400-e29b-41d4-a716-446655440002';

      mockCostTracker.getCurrentUsage.mockResolvedValue({
        tokens: 800,
        cost: 0.08,
        estimatedRemaining: 0.04
      });

      const result = await orchestrator.checkCostThreshold(mockSessionId);

      expect(result.withinBudget).toBe(true);
      expect(result.remainingBudget).toBe(0.04);
    });

    it('should issue cost warning when approaching budget limit', async () => {
      const mockSessionId = '550e8400-e29b-41d4-a716-446655440002';

      mockCostTracker.getCurrentUsage.mockResolvedValue({
        tokens: 1400,
        cost: 0.20,
        estimatedRemaining: 0.05
      });

      const result = await orchestrator.checkCostThreshold(mockSessionId);

      expect(result.warningIssued).toBe(true);
      expect(mockOpenAIService.sendInstruction).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          type: 'conclusion_prompt'
        })
      );
    });
  });
});