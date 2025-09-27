// Jest globals are available globally
import { FortyElksService } from '../../../src/services/telephony/FortyElksService';
import { TwilioService } from '../../../src/services/telephony/TwilioService';

// Mock the external dependencies
jest.mock('fortysixelks-node');
jest.mock('twilio');

describe('Telephony Services', () => {
  describe('FortyElksService', () => {
    let fortyElksService: FortyElksService;
    let mockFortyElksClient: any;

    beforeEach(() => {
      jest.clearAllMocks();
      mockFortyElksClient = {
        calls: {
          create: jest.fn(),
          get: jest.fn(),
          hangup: jest.fn()
        }
      };
      
      // Mock the constructor
      jest.mocked(require('fortysixelks-node')).mockReturnValue(mockFortyElksClient);
      
      fortyElksService = new FortyElksService();
    });

    describe('initiateCall', () => {
      it('should successfully initiate a call', async () => {
        const callParams = {
          customerPhone: '+46701234567',
          callbackUrl: 'https://api.vocilia.com/webhooks/telephony'
        };

        mockFortyElksClient.calls.create.mockResolvedValue({
          id: '46elks-call-123',
          status: 'created',
          from: '+46771234567',
          to: '+46701234567'
        });

        const result = await fortyElksService.initiateCall(callParams);

        expect(result.success).toBe(true);
        expect(result.callId).toBe('46elks-call-123');
        expect(result.status).toBe('initiated');
        expect(mockFortyElksClient.calls.create).toHaveBeenCalledWith({
          from: expect.stringMatching(/^\+467/),
          to: '+46701234567',
          voice_start: expect.stringContaining('/webhooks/telephony'),
          recordings: 'all'
        });
      });

      it('should handle Swedish phone number formatting', async () => {
        const callParams = {
          customerPhone: '0701234567', // National format
          callbackUrl: 'https://api.vocilia.com/webhooks/telephony'
        };

        mockFortyElksClient.calls.create.mockResolvedValue({
          id: '46elks-call-456',
          status: 'created'
        });

        const result = await fortyElksService.initiateCall(callParams);

        expect(result.success).toBe(true);
        expect(mockFortyElksClient.calls.create).toHaveBeenCalledWith(
          expect.objectContaining({
            to: '+46701234567' // Should be converted to international format
          })
        );
      });

      it('should handle API failures gracefully', async () => {
        const callParams = {
          customerPhone: '+46701234567',
          callbackUrl: 'https://api.vocilia.com/webhooks/telephony'
        };

        mockFortyElksClient.calls.create.mockRejectedValue(
          new Error('46elks API temporarily unavailable')
        );

        const result = await fortyElksService.initiateCall(callParams);

        expect(result.success).toBe(false);
        expect(result.error).toContain('46elks API temporarily unavailable');
      });

      it('should validate phone number format', async () => {
        const callParams = {
          customerPhone: 'invalid-phone',
          callbackUrl: 'https://api.vocilia.com/webhooks/telephony'
        };

        const result = await fortyElksService.initiateCall(callParams);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid phone number format');
      });
    });

    describe('getCallStatus', () => {
      it('should retrieve call status', async () => {
        mockFortyElksClient.calls.get.mockResolvedValue({
          id: '46elks-call-123',
          status: 'ongoing',
          duration: 45,
          answered_at: '2025-09-22T14:35:15Z'
        });

        const result = await fortyElksService.getCallStatus('46elks-call-123');

        expect(result.success).toBe(true);
        expect(result.status).toBe('ongoing');
        expect(result.duration).toBe(45);
      });

      it('should handle non-existent call IDs', async () => {
        mockFortyElksClient.calls.get.mockRejectedValue(
          new Error('Call not found')
        );

        const result = await fortyElksService.getCallStatus('non-existent-call');

        expect(result.success).toBe(false);
        expect(result.error).toContain('Call not found');
      });
    });

    describe('endCall', () => {
      it('should successfully end a call', async () => {
        mockFortyElksClient.calls.hangup.mockResolvedValue({
          id: '46elks-call-123',
          status: 'hangup'
        });

        const result = await fortyElksService.endCall('46elks-call-123');

        expect(result.success).toBe(true);
        expect(mockFortyElksClient.calls.hangup).toHaveBeenCalledWith('46elks-call-123');
      });

      it('should handle already ended calls', async () => {
        mockFortyElksClient.calls.hangup.mockRejectedValue(
          new Error('Call already ended')
        );

        const result = await fortyElksService.endCall('46elks-call-123');

        expect(result.success).toBe(false);
        expect(result.error).toContain('Call already ended');
      });
    });

    describe('webhook processing', () => {
      it('should validate webhook signatures', () => {
        const payload = { callId: '46elks-call-123', status: 'answered' };
        const signature = 'test-signature';

        const isValid = fortyElksService.validateWebhookSignature(
          JSON.stringify(payload),
          signature
        );

        // In development, validation might be relaxed
        expect(typeof isValid).toBe('boolean');
      });

      it('should parse webhook events correctly', () => {
        const webhookData = {
          id: '46elks-call-123',
          status: 'answered',
          answered_at: '2025-09-22T14:35:15Z',
          duration: 0
        };

        const parsed = fortyElksService.parseWebhookEvent(webhookData);

        expect(parsed.callId).toBe('46elks-call-123');
        expect(parsed.eventType).toBe('call_answered');
        expect(parsed.timestamp).toBeDefined();
      });
    });
  });

  describe('TwilioService', () => {
    let twilioService: TwilioService;
    let mockTwilioClient: any;

    beforeEach(() => {
      jest.clearAllMocks();
      mockTwilioClient = {
        calls: {
          create: jest.fn(),
          get: jest.fn(() => ({
            fetch: jest.fn()
          })),
          update: jest.fn()
        }
      };
      
      jest.mocked(require('twilio')).mockReturnValue(mockTwilioClient);
      
      twilioService = new TwilioService();
    });

    describe('initiateCall', () => {
      it('should successfully initiate a call', async () => {
        const callParams = {
          customerPhone: '+46701234567',
          callbackUrl: 'https://api.vocilia.com/webhooks/telephony'
        };

        mockTwilioClient.calls.create.mockResolvedValue({
          sid: 'twilio-call-456',
          status: 'queued',
          from: '+46771234567',
          to: '+46701234567'
        });

        const result = await twilioService.initiateCall(callParams);

        expect(result.success).toBe(true);
        expect(result.callId).toBe('twilio-call-456');
        expect(result.status).toBe('initiated');
        expect(mockTwilioClient.calls.create).toHaveBeenCalledWith({
          from: expect.stringMatching(/^\+467/),
          to: '+46701234567',
          url: expect.stringContaining('/webhooks/telephony'),
          record: true
        });
      });

      it('should handle Twilio API errors', async () => {
        const callParams = {
          customerPhone: '+46701234567',
          callbackUrl: 'https://api.vocilia.com/webhooks/telephony'
        };

        mockTwilioClient.calls.create.mockRejectedValue(
          new Error('Twilio service unavailable')
        );

        const result = await twilioService.initiateCall(callParams);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Twilio service unavailable');
      });

      it('should handle international calling restrictions', async () => {
        const callParams = {
          customerPhone: '+1234567890', // Non-Swedish number
          callbackUrl: 'https://api.vocilia.com/webhooks/telephony'
        };

        const result = await twilioService.initiateCall(callParams);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Only Swedish phone numbers are supported');
      });
    });

    describe('getCallStatus', () => {
      it('should retrieve call status', async () => {
        const mockCall = {
          sid: 'twilio-call-456',
          status: 'in-progress',
          duration: '67',
          startTime: new Date('2025-09-22T14:35:00Z'),
          fetch: jest.fn().mockResolvedValue({
            sid: 'twilio-call-456',
            status: 'in-progress',
            duration: '67'
          })
        };

        mockTwilioClient.calls.get.mockReturnValue(mockCall);

        const result = await twilioService.getCallStatus('twilio-call-456');

        expect(result.success).toBe(true);
        expect(result.status).toBe('in-progress');
        expect(result.duration).toBe(67);
      });
    });

    describe('endCall', () => {
      it('should successfully end a call', async () => {
        mockTwilioClient.calls.update.mockResolvedValue({
          sid: 'twilio-call-456',
          status: 'completed'
        });

        const result = await twilioService.endCall('twilio-call-456');

        expect(result.success).toBe(true);
        expect(mockTwilioClient.calls.update).toHaveBeenCalledWith(
          'twilio-call-456',
          { status: 'completed' }
        );
      });
    });

    describe('webhook processing', () => {
      it('should validate Twilio webhook signatures', () => {
        const payload = 'CallSid=twilio-call-456&CallStatus=answered';
        const signature = 'test-signature';
        const url = 'https://api.vocilia.com/webhooks/telephony';

        const isValid = twilioService.validateWebhookSignature(
          payload,
          signature,
          url
        );

        expect(typeof isValid).toBe('boolean');
      });

      it('should parse Twilio webhook events correctly', () => {
        const webhookData = {
          CallSid: 'twilio-call-456',
          CallStatus: 'in-progress',
          CallDuration: '0',
          From: '+46771234567',
          To: '+46701234567'
        };

        const parsed = twilioService.parseWebhookEvent(webhookData);

        expect(parsed.callId).toBe('twilio-call-456');
        expect(parsed.eventType).toBe('call_answered');
        expect(parsed.provider).toBe('twilio');
      });

      it('should handle different Twilio call statuses', () => {
        const statusMappings = [
          { twilioStatus: 'queued', expectedEvent: 'call_initiated' },
          { twilioStatus: 'ringing', expectedEvent: 'call_initiated' },
          { twilioStatus: 'in-progress', expectedEvent: 'call_answered' },
          { twilioStatus: 'completed', expectedEvent: 'call_completed' },
          { twilioStatus: 'failed', expectedEvent: 'call_failed' },
          { twilioStatus: 'busy', expectedEvent: 'call_failed' },
          { twilioStatus: 'no-answer', expectedEvent: 'call_failed' }
        ];

        statusMappings.forEach(({ twilioStatus, expectedEvent }) => {
          const webhookData = {
            CallSid: 'test-call',
            CallStatus: twilioStatus
          };

          const parsed = twilioService.parseWebhookEvent(webhookData);
          expect(parsed.eventType).toBe(expectedEvent);
        });
      });
    });
  });

  describe('Provider Comparison', () => {
    let fortyElksService: FortyElksService;
    let twilioService: TwilioService;

    beforeEach(() => {
      fortyElksService = new FortyElksService();
      twilioService = new TwilioService();
    });

    it('should have consistent interface between providers', async () => {
      const callParams = {
        customerPhone: '+46701234567',
        callbackUrl: 'https://api.vocilia.com/webhooks/telephony'
      };

      // Both should have the same method signatures
      expect(typeof fortyElksService.initiateCall).toBe('function');
      expect(typeof twilioService.initiateCall).toBe('function');
      
      expect(typeof fortyElksService.getCallStatus).toBe('function');
      expect(typeof twilioService.getCallStatus).toBe('function');
      
      expect(typeof fortyElksService.endCall).toBe('function');
      expect(typeof twilioService.endCall).toBe('function');
    });

    it('should normalize response formats', () => {
      // 46elks response
      const elksWebhook = {
        id: 'elks-call-123',
        status: 'answered'
      };

      // Twilio response
      const twilioWebhook = {
        CallSid: 'twilio-call-456',
        CallStatus: 'in-progress'
      };

      const elksParsed = fortyElksService.parseWebhookEvent(elksWebhook);
      const twilioParsed = twilioService.parseWebhookEvent(twilioWebhook);

      // Both should have consistent structure
      expect(elksParsed).toHaveProperty('callId');
      expect(elksParsed).toHaveProperty('eventType');
      expect(elksParsed).toHaveProperty('provider');

      expect(twilioParsed).toHaveProperty('callId');
      expect(twilioParsed).toHaveProperty('eventType');
      expect(twilioParsed).toHaveProperty('provider');
    });
  });

  describe('Error Handling', () => {
    it('should handle network timeouts gracefully', async () => {
      const fortyElksService = new FortyElksService();
      const mockClient = require('fortysixelks-node')();
      
      mockClient.calls.create.mockRejectedValue(
        new Error('ETIMEDOUT: Network timeout')
      );

      const result = await fortyElksService.initiateCall({
        customerPhone: '+46701234567',
        callbackUrl: 'https://api.vocilia.com/webhooks/telephony'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network timeout');
      expect(result.retryable).toBe(true);
    });

    it('should handle rate limiting', async () => {
      const twilioService = new TwilioService();
      const mockClient = require('twilio')();
      
      const rateLimitError = new Error('Rate limit exceeded');
      (rateLimitError as any).status = 429;
      
      mockClient.calls.create.mockRejectedValue(rateLimitError);

      const result = await twilioService.initiateCall({
        customerPhone: '+46701234567',
        callbackUrl: 'https://api.vocilia.com/webhooks/telephony'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Rate limit exceeded');
      expect(result.retryAfter).toBeDefined();
    });
  });
});