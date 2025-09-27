import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { SmsProvider } from '../../src/services/communication/sms-provider';
import { TwilioSmsClient } from '../../src/services/communication/twilio-sms-client';

// Mock Twilio client
jest.mock('../../src/services/communication/twilio-sms-client');

interface MockTwilioClient {
  sendSms: jest.MockedFunction<any>;
  validatePhoneNumber: jest.MockedFunction<any>;
  getDeliveryStatus: jest.MockedFunction<any>;
  handleWebhook: jest.MockedFunction<any>;
}

describe('SmsProvider', () => {
  let smsProvider: SmsProvider;
  let mockTwilioClient: MockTwilioClient;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock Twilio client
    mockTwilioClient = {
      sendSms: jest.fn(),
      validatePhoneNumber: jest.fn(),
      getDeliveryStatus: jest.fn(),
      handleWebhook: jest.fn()
    };

    // Mock TwilioSmsClient constructor
    (TwilioSmsClient as jest.MockedClass<typeof TwilioSmsClient>).mockImplementation(() => mockTwilioClient as any);

    smsProvider = new SmsProvider();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('sendSms', () => {
    it('should send SMS successfully with valid Swedish phone number', async () => {
      const mockResponse = {
        messageId: 'msg_123',
        status: 'sent',
        cost: 0.50,
        timestamp: new Date().toISOString()
      };

      mockTwilioClient.sendSms.mockResolvedValue(mockResponse);

      const result = await smsProvider.sendSms({
        to: '+46701234567',
        message: 'Hej! Ditt belöning på 45 SEK har skickats via Swish.',
        type: 'reward_notification'
      });

      expect(result).toEqual(mockResponse);
      expect(mockTwilioClient.sendSms).toHaveBeenCalledWith({
        to: '+46701234567',
        message: 'Hej! Ditt belöning på 45 SEK har skickats via Swish.',
        type: 'reward_notification'
      });
    });

    it('should handle SMS sending failure', async () => {
      const mockError = new Error('Twilio API error: Invalid phone number');
      mockTwilioClient.sendSms.mockRejectedValue(mockError);

      await expect(smsProvider.sendSms({
        to: '+46701234567',
        message: 'Test message',
        type: 'payment_confirmation'
      })).rejects.toThrow('Twilio API error: Invalid phone number');
    });

    it('should validate phone number format before sending', async () => {
      mockTwilioClient.validatePhoneNumber.mockReturnValue(false);

      await expect(smsProvider.sendSms({
        to: '070123456', // Invalid format - missing country code
        message: 'Test message',
        type: 'system_alert'
      })).rejects.toThrow('Invalid phone number format');

      expect(mockTwilioClient.sendSms).not.toHaveBeenCalled();
    });

    it('should enforce Swedish character limits (160 chars for single SMS)', async () => {
      const longMessage = 'Detta är ett mycket långt meddelande som överstiger den tillåtna gränsen för ett enda SMS och kommer därför att delas upp i flera delar vilket kan vara dyrt för företaget och förvirrande för kunden.';
      
      mockTwilioClient.sendSms.mockResolvedValue({
        messageId: 'msg_123',
        status: 'sent',
        cost: 1.50, // Higher cost for multi-part SMS
        timestamp: new Date().toISOString(),
        parts: 2
      });

      const result = await smsProvider.sendSms({
        to: '+46701234567',
        message: longMessage,
        type: 'verification_request'
      });

      expect(result.parts).toBe(2);
      expect(result.cost).toBe(1.50);
    });

    it('should add automatic Swedish signature to business messages', async () => {
      mockTwilioClient.sendSms.mockResolvedValue({
        messageId: 'msg_123',
        status: 'sent',
        cost: 0.50,
        timestamp: new Date().toISOString()
      });

      await smsProvider.sendSms({
        to: '+46701234567',
        message: 'Din verifiering måste slutföras inom 5 arbetsdagar.',
        type: 'verification_request'
      });

      expect(mockTwilioClient.sendSms).toHaveBeenCalledWith({
        to: '+46701234567',
        message: 'Din verifiering måste slutföras inom 5 arbetsdagar.\n\n- Vocilia',
        type: 'verification_request'
      });
    });
  });

  describe('validatePhoneNumber', () => {
    it('should validate Swedish mobile numbers', () => {
      mockTwilioClient.validatePhoneNumber.mockReturnValue(true);

      const validNumbers = [
        '+46701234567',
        '+46731234567',
        '+46761234567'
      ];

      validNumbers.forEach(number => {
        const result = smsProvider.validatePhoneNumber(number);
        expect(result).toBe(true);
      });
    });

    it('should reject invalid phone numbers', () => {
      mockTwilioClient.validatePhoneNumber.mockReturnValue(false);

      const invalidNumbers = [
        '070123456',      // Missing country code
        '+4670123456',    // Too short
        '+467012345678',  // Too long
        '+45701234567',   // Denmark country code
        '46701234567',    // Missing +
        ''                // Empty string
      ];

      invalidNumbers.forEach(number => {
        const result = smsProvider.validatePhoneNumber(number);
        expect(result).toBe(false);
      });
    });
  });

  describe('retry mechanism', () => {
    it('should retry failed SMS delivery with exponential backoff', async () => {
      // First attempt fails
      mockTwilioClient.sendSms
        .mockRejectedValueOnce(new Error('Temporary network error'))
        .mockRejectedValueOnce(new Error('Rate limit exceeded'))
        .mockResolvedValueOnce({
          messageId: 'msg_123',
          status: 'sent',
          cost: 0.50,
          timestamp: new Date().toISOString(),
          attempt: 3
        });

      const result = await smsProvider.sendSmsWithRetry({
        to: '+46701234567',
        message: 'Retry test message',
        type: 'payment_reminder'
      }, {
        maxAttempts: 3,
        initialDelay: 100,
        maxDelay: 1000
      });

      expect(result.attempt).toBe(3);
      expect(mockTwilioClient.sendSms).toHaveBeenCalledTimes(3);
    });

    it('should fail after maximum retry attempts', async () => {
      mockTwilioClient.sendSms.mockRejectedValue(new Error('Persistent failure'));

      await expect(smsProvider.sendSmsWithRetry({
        to: '+46701234567',
        message: 'Test message',
        type: 'system_alert'
      }, {
        maxAttempts: 3,
        initialDelay: 100,
        maxDelay: 1000
      })).rejects.toThrow('Failed to send SMS after 3 attempts');

      expect(mockTwilioClient.sendSms).toHaveBeenCalledTimes(3);
    });
  });

  describe('delivery status tracking', () => {
    it('should track message delivery status', async () => {
      const messageId = 'msg_123';
      const mockStatus = {
        messageId,
        status: 'delivered',
        deliveredAt: new Date().toISOString(),
        errorCode: null,
        errorMessage: null
      };

      mockTwilioClient.getDeliveryStatus.mockResolvedValue(mockStatus);

      const result = await smsProvider.getDeliveryStatus(messageId);

      expect(result).toEqual(mockStatus);
      expect(mockTwilioClient.getDeliveryStatus).toHaveBeenCalledWith(messageId);
    });

    it('should handle failed delivery status', async () => {
      const messageId = 'msg_456';
      const mockStatus = {
        messageId,
        status: 'failed',
        deliveredAt: null,
        errorCode: 30008,
        errorMessage: 'Unknown destination handset'
      };

      mockTwilioClient.getDeliveryStatus.mockResolvedValue(mockStatus);

      const result = await smsProvider.getDeliveryStatus(messageId);

      expect(result.status).toBe('failed');
      expect(result.errorCode).toBe(30008);
      expect(result.errorMessage).toBe('Unknown destination handset');
    });
  });

  describe('webhook handling', () => {
    it('should process Twilio delivery status webhooks', async () => {
      const webhookData = {
        MessageSid: 'msg_123',
        MessageStatus: 'delivered',
        To: '+46701234567',
        From: '+46701234568',
        MessageBody: 'Test message',
        ErrorCode: null
      };

      const mockProcessedWebhook = {
        messageId: 'msg_123',
        status: 'delivered',
        to: '+46701234567',
        timestamp: new Date().toISOString(),
        errorCode: null
      };

      mockTwilioClient.handleWebhook.mockReturnValue(mockProcessedWebhook);

      const result = smsProvider.processWebhook(webhookData);

      expect(result).toEqual(mockProcessedWebhook);
      expect(mockTwilioClient.handleWebhook).toHaveBeenCalledWith(webhookData);
    });

    it('should handle webhook validation failures', () => {
      const invalidWebhookData = {
        invalidField: 'invalid data'
      };

      mockTwilioClient.handleWebhook.mockImplementation(() => {
        throw new Error('Invalid webhook signature');
      });

      expect(() => smsProvider.processWebhook(invalidWebhookData)).toThrow('Invalid webhook signature');
    });
  });

  describe('cost calculation', () => {
    it('should calculate SMS costs accurately for Swedish numbers', async () => {
      // Single part SMS
      mockTwilioClient.sendSms.mockResolvedValue({
        messageId: 'msg_123',
        status: 'sent',
        cost: 0.50,
        timestamp: new Date().toISOString(),
        parts: 1
      });

      const shortMessage = 'Kort meddelande'; // Under 160 chars
      const result = await smsProvider.sendSms({
        to: '+46701234567',
        message: shortMessage,
        type: 'reward_notification'
      });

      expect(result.cost).toBe(0.50);
      expect(result.parts).toBe(1);
    });

    it('should calculate higher costs for multi-part SMS', async () => {
      // Multi-part SMS
      mockTwilioClient.sendSms.mockResolvedValue({
        messageId: 'msg_456',
        status: 'sent',
        cost: 1.50,
        timestamp: new Date().toISOString(),
        parts: 3
      });

      const longMessage = 'Detta är ett mycket långt meddelande som kommer att delas upp i flera delar eftersom det överstiger den maximala längden för ett enda SMS-meddelande och därför kommer att kosta mer pengar att skicka till mottagaren vilket vi måste ta hänsyn till i vår kostnadsberäkning.';
      
      const result = await smsProvider.sendSms({
        to: '+46701234567',
        message: longMessage,
        type: 'verification_request'
      });

      expect(result.cost).toBe(1.50);
      expect(result.parts).toBe(3);
    });
  });

  describe('rate limiting', () => {
    it('should respect SMS rate limits', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      mockTwilioClient.sendSms.mockRejectedValue(rateLimitError);

      await expect(smsProvider.sendSms({
        to: '+46701234567',
        message: 'Rate limit test',
        type: 'system_alert'
      })).rejects.toThrow('Rate limit exceeded');
    });

    it('should implement queue for rate-limited requests', async () => {
      // Mock multiple requests that would exceed rate limit
      const requests = Array.from({ length: 5 }, (_, i) => ({
        to: `+4670123456${i}`,
        message: `Message ${i}`,
        type: 'reward_notification' as const
      }));

      // First 3 succeed, last 2 are rate limited
      mockTwilioClient.sendSms
        .mockResolvedValueOnce({ messageId: 'msg_1', status: 'sent', cost: 0.50, timestamp: new Date().toISOString() })
        .mockResolvedValueOnce({ messageId: 'msg_2', status: 'sent', cost: 0.50, timestamp: new Date().toISOString() })
        .mockResolvedValueOnce({ messageId: 'msg_3', status: 'sent', cost: 0.50, timestamp: new Date().toISOString() })
        .mockRejectedValueOnce(new Error('Rate limit exceeded'))
        .mockRejectedValueOnce(new Error('Rate limit exceeded'));

      const results = await Promise.allSettled(
        requests.map(req => smsProvider.sendSms(req))
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      expect(successful).toBe(3);
      expect(failed).toBe(2);
    });
  });

  describe('Swedish language support', () => {
    it('should handle Swedish characters correctly', async () => {
      const swedishMessage = 'Hej! Din belöning på 45 SEK är på väg. Mvh Företaget';
      
      mockTwilioClient.sendSms.mockResolvedValue({
        messageId: 'msg_123',
        status: 'sent',
        cost: 0.50,
        timestamp: new Date().toISOString()
      });

      await smsProvider.sendSms({
        to: '+46701234567',
        message: swedishMessage,
        type: 'payment_confirmation'
      });

      expect(mockTwilioClient.sendSms).toHaveBeenCalledWith({
        to: '+46701234567',
        message: swedishMessage,
        type: 'payment_confirmation'
      });
    });

    it('should count Swedish characters correctly for length limits', () => {
      // Swedish characters like å, ä, ö count as single characters
      const swedishText = 'Kära kund, ditt köp på 150 SEK är bekräftat. Tack för att du handlar hos oss! Betygsätt gärna ditt besök på vår hemsida.';
      
      const characterCount = smsProvider.calculateMessageLength(swedishText);
      expect(characterCount).toBe(swedishText.length);
    });
  });
});