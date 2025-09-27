import { sessionManager, ConversationState } from '../../src/services/calls/sessionManager';

// Mock Redis
jest.mock('ioredis', () => {
  const mRedis = {
    setex: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    sadd: jest.fn(),
    srem: jest.fn(),
    smembers: jest.fn(),
    scard: jest.fn(),
    keys: jest.fn(),
    expire: jest.fn(),
    on: jest.fn(),
    disconnect: jest.fn()
  };
  return jest.fn(() => mRedis);
});

describe('Session Manager', () => {
  let mockRedis: any;

  beforeEach(() => {
    jest.clearAllMocks();
    const Redis = require('ioredis');
    mockRedis = new Redis();
    
    // Setup default mock responses
    mockRedis.setex.mockResolvedValue('OK');
    mockRedis.sadd.mockResolvedValue(1);
    mockRedis.srem.mockResolvedValue(1);
    mockRedis.del.mockResolvedValue(1);
    mockRedis.expire.mockResolvedValue(1);
  });

  describe('createSession', () => {
    it('should create a new conversation session', async () => {
      const sessionId = 'test-session-123';
      const storeId = 'store-456';
      const customerId = 'customer-789';
      const phoneNumber = '+46701234567';
      const businessContext = {
        storeName: 'Test Store',
        departments: ['Electronics'],
        currentCampaigns: {},
        operatingHours: {},
        customQuestions: []
      };

      const session = await sessionManager.createSession(
        sessionId,
        storeId,
        customerId,
        phoneNumber,
        businessContext
      );

      expect(session).toMatchObject({
        sessionId,
        storeId,
        customerId,
        phoneNumber,
        status: 'initializing',
        conversationHistory: [],
        businessContext,
        questionCount: 0,
        qualityMetrics: expect.objectContaining({
          responseCount: 0,
          averageResponseTime: 0,
          coherenceScore: 0,
          engagementLevel: 0
        })
      });

      expect(mockRedis.setex).toHaveBeenCalledWith(
        `conversation:${sessionId}`,
        7200, // 2 hours in seconds
        expect.any(String)
      );

      expect(mockRedis.sadd).toHaveBeenCalledWith(
        'active_conversations',
        sessionId
      );
    });
  });

  describe('getSession', () => {
    it('should retrieve an existing session', async () => {
      const sessionId = 'test-session-123';
      const mockSessionData: ConversationState = {
        sessionId,
        storeId: 'store-456',
        customerId: 'customer-789',
        phoneNumber: '+46701234567',
        status: 'active',
        conversationHistory: [],
        businessContext: {
          storeName: 'Test Store',
          departments: ['Electronics'],
          currentCampaigns: {},
          operatingHours: {},
          customQuestions: []
        },
        questionCount: 0,
        qualityMetrics: {
          responseCount: 0,
          averageResponseTime: 0,
          coherenceScore: 0,
          engagementLevel: 0,
          lastUpdated: '2025-01-01T10:00:00Z'
        },
        createdAt: '2025-01-01T10:00:00Z',
        lastActivity: '2025-01-01T10:00:00Z',
        expiresAt: '2025-01-01T12:00:00Z'
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(mockSessionData));

      const result = await sessionManager.getSession(sessionId);

      expect(result).toEqual(mockSessionData);
      expect(mockRedis.get).toHaveBeenCalledWith(`conversation:${sessionId}`);
    });

    it('should return null for non-existent session', async () => {
      const sessionId = 'non-existent-session';
      mockRedis.get.mockResolvedValue(null);

      const result = await sessionManager.getSession(sessionId);

      expect(result).toBeNull();
    });
  });

  describe('updateSessionStatus', () => {
    it('should update session status', async () => {
      const sessionId = 'test-session-123';
      const existingSession: ConversationState = {
        sessionId,
        storeId: 'store-456',
        customerId: 'customer-789',
        phoneNumber: '+46701234567',
        status: 'initializing',
        conversationHistory: [],
        businessContext: {
          storeName: 'Test Store',
          departments: [],
          currentCampaigns: {},
          operatingHours: {},
          customQuestions: []
        },
        questionCount: 0,
        qualityMetrics: {
          responseCount: 0,
          averageResponseTime: 0,
          coherenceScore: 0,
          engagementLevel: 0,
          lastUpdated: '2025-01-01T10:00:00Z'
        },
        createdAt: '2025-01-01T10:00:00Z',
        lastActivity: '2025-01-01T10:00:00Z',
        expiresAt: '2025-01-01T12:00:00Z'
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(existingSession));

      await sessionManager.updateSessionStatus(sessionId, 'active', 'openai-session-456');

      expect(mockRedis.setex).toHaveBeenCalledWith(
        `conversation:${sessionId}`,
        expect.any(Number),
        expect.stringContaining('"status":"active"')
      );

      expect(mockRedis.setex).toHaveBeenCalledWith(
        `conversation:${sessionId}`,
        expect.any(Number),
        expect.stringContaining('"openaiSessionId":"openai-session-456"')
      );
    });

    it('should throw error for non-existent session', async () => {
      const sessionId = 'non-existent-session';
      mockRedis.get.mockResolvedValue(null);

      await expect(
        sessionManager.updateSessionStatus(sessionId, 'active')
      ).rejects.toThrow(`Session not found: ${sessionId}`);
    });
  });

  describe('addMessage', () => {
    it('should add message to conversation history', async () => {
      const sessionId = 'test-session-123';
      const existingSession: ConversationState = {
        sessionId,
        storeId: 'store-456',
        customerId: 'customer-789',
        phoneNumber: '+46701234567',
        status: 'active',
        conversationHistory: [
          {
            speaker: 'ai',
            content: 'Hello!',
            timestamp: '2025-01-01T10:00:00Z',
            messageOrder: 1
          }
        ],
        businessContext: {
          storeName: 'Test Store',
          departments: [],
          currentCampaigns: {},
          operatingHours: {},
          customQuestions: []
        },
        questionCount: 0,
        qualityMetrics: {
          responseCount: 0,
          averageResponseTime: 0,
          coherenceScore: 0,
          engagementLevel: 0,
          lastUpdated: '2025-01-01T10:00:00Z'
        },
        createdAt: '2025-01-01T10:00:00Z',
        lastActivity: '2025-01-01T10:00:00Z',
        expiresAt: '2025-01-01T12:00:00Z'
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(existingSession));

      await sessionManager.addMessage(
        sessionId,
        'customer',
        'Great service!',
        0.95
      );

      const savedData = mockRedis.setex.mock.calls[0][2];
      const savedSession = JSON.parse(savedData);

      expect(savedSession.conversationHistory).toHaveLength(2);
      expect(savedSession.conversationHistory[1]).toMatchObject({
        speaker: 'customer',
        content: 'Great service!',
        messageOrder: 2,
        confidence: 0.95
      });

      expect(savedSession.qualityMetrics.responseCount).toBe(1);
    });
  });

  describe('completeSession', () => {
    it('should complete session and update expiry', async () => {
      const sessionId = 'test-session-123';
      const existingSession: ConversationState = {
        sessionId,
        storeId: 'store-456',
        customerId: 'customer-789',
        phoneNumber: '+46701234567',
        status: 'active',
        conversationHistory: [],
        businessContext: {
          storeName: 'Test Store',
          departments: [],
          currentCampaigns: {},
          operatingHours: {},
          customQuestions: []
        },
        questionCount: 0,
        qualityMetrics: {
          responseCount: 0,
          averageResponseTime: 0,
          coherenceScore: 0,
          engagementLevel: 0,
          lastUpdated: '2025-01-01T10:00:00Z'
        },
        createdAt: '2025-01-01T10:00:00Z',
        lastActivity: '2025-01-01T10:00:00Z',
        expiresAt: '2025-01-01T12:00:00Z'
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(existingSession));

      await sessionManager.completeSession(sessionId);

      expect(mockRedis.srem).toHaveBeenCalledWith('active_conversations', sessionId);
      expect(mockRedis.expire).toHaveBeenCalledWith(`conversation:${sessionId}`, 3600);

      const savedData = mockRedis.setex.mock.calls[0][2];
      const savedSession = JSON.parse(savedData);
      expect(savedSession.status).toBe('completed');
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should cleanup expired sessions', async () => {
      const activeSessions = ['session-1', 'session-2', 'session-3'];
      mockRedis.smembers.mockResolvedValue(activeSessions);

      // Session 1: active (not expired)
      const activeSession = {
        sessionId: 'session-1',
        expiresAt: new Date(Date.now() + 3600000).toISOString() // 1 hour from now
      };

      // Session 2: expired
      const expiredSession = {
        sessionId: 'session-2',
        expiresAt: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
      };

      // Session 3: not found (null)
      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify(activeSession))
        .mockResolvedValueOnce(JSON.stringify(expiredSession))
        .mockResolvedValueOnce(null);

      const cleanedCount = await sessionManager.cleanupExpiredSessions();

      expect(cleanedCount).toBe(2); // session-2 and session-3
      expect(mockRedis.del).toHaveBeenCalledTimes(2);
      expect(mockRedis.srem).toHaveBeenCalledTimes(2);
    });
  });

  describe('getSessionStats', () => {
    it('should return session statistics', async () => {
      mockRedis.scard.mockResolvedValue(5); // 5 active sessions
      mockRedis.keys.mockResolvedValue(['conversation:1', 'conversation:2', 'conversation:3']); // 3 total sessions

      const stats = await sessionManager.getSessionStats();

      expect(stats).toEqual({
        activeSessions: 5,
        totalSessions: 3,
        averageSessionDuration: 0
      });

      expect(mockRedis.scard).toHaveBeenCalledWith('active_conversations');
      expect(mockRedis.keys).toHaveBeenCalledWith('conversation:*');
    });
  });

  describe('Error handling', () => {
    it('should handle Redis connection errors gracefully', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));

      await expect(
        sessionManager.getSession('test-session')
      ).rejects.toThrow('Redis connection failed');
    });
  });
});