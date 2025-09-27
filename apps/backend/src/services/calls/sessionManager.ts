import Redis from 'ioredis';

interface ConversationState {
  sessionId: string;
  storeId: string;
  customerId: string;
  phoneNumber: string;
  status: 'initializing' | 'active' | 'paused' | 'completed' | 'failed';
  openaiSessionId?: string;
  conversationHistory: ConversationMessage[];
  businessContext: BusinessContext;
  currentQuestion?: string;
  questionCount: number;
  qualityMetrics: QualityMetrics;
  createdAt: string;
  lastActivity: string;
  expiresAt: string;
}

interface ConversationMessage {
  speaker: 'ai' | 'customer';
  content: string;
  timestamp: string;
  messageOrder: number;
  confidence?: number;
}

interface BusinessContext {
  storeName: string;
  departments: string[];
  currentCampaigns: Record<string, any>;
  operatingHours: Record<string, any>;
  customQuestions: Array<{
    question: string;
    category: string;
    frequency: number;
  }>;
}

interface QualityMetrics {
  responseCount: number;
  averageResponseTime: number;
  coherenceScore: number;
  engagementLevel: number;
  lastUpdated: string;
}

class SessionManager {
  private redis: Redis;
  private readonly SESSION_PREFIX = 'conversation:';
  private readonly ACTIVE_SESSIONS_KEY = 'active_conversations';
  private readonly DEFAULT_EXPIRY_HOURS = 2;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      maxRetriesPerRequest: 3,
      db: 0, // Use database 0 for session data
    });

    this.redis.on('error', (error) => {
      console.error('Redis Session Manager error:', error);
    });

    this.redis.on('connect', () => {
      console.log('Redis Session Manager connected');
    });
  }

  // Create new conversation session
  async createSession(
    sessionId: string,
    storeId: string,
    customerId: string,
    phoneNumber: string,
    businessContext: BusinessContext
  ): Promise<ConversationState> {
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + (this.DEFAULT_EXPIRY_HOURS * 60 * 60 * 1000)).toISOString();

    const session: ConversationState = {
      sessionId,
      storeId,
      customerId,
      phoneNumber,
      status: 'initializing',
      conversationHistory: [],
      businessContext,
      questionCount: 0,
      qualityMetrics: {
        responseCount: 0,
        averageResponseTime: 0,
        coherenceScore: 0,
        engagementLevel: 0,
        lastUpdated: now
      },
      createdAt: now,
      lastActivity: now,
      expiresAt
    };

    const key = this.getSessionKey(sessionId);
    await this.redis.setex(key, this.DEFAULT_EXPIRY_HOURS * 3600, JSON.stringify(session));
    
    // Add to active sessions index
    await this.redis.sadd(this.ACTIVE_SESSIONS_KEY, sessionId);
    
    console.log(`Created conversation session: ${sessionId}`);
    return session;
  }

  // Retrieve conversation session
  async getSession(sessionId: string): Promise<ConversationState | null> {
    const key = this.getSessionKey(sessionId);
    const sessionData = await this.redis.get(key);
    
    if (!sessionData) {
      return null;
    }

    return JSON.parse(sessionData) as ConversationState;
  }

  // Update session status
  async updateSessionStatus(
    sessionId: string,
    status: ConversationState['status'],
    openaiSessionId?: string
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.status = status;
    session.lastActivity = new Date().toISOString();
    
    if (openaiSessionId) {
      session.openaiSessionId = openaiSessionId;
    }

    await this.saveSession(session);
    console.log(`Updated session ${sessionId} status to: ${status}`);
  }

  // Add message to conversation history
  async addMessage(
    sessionId: string,
    speaker: 'ai' | 'customer',
    content: string,
    confidence?: number
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const message: ConversationMessage = {
      speaker,
      content,
      timestamp: new Date().toISOString(),
      messageOrder: session.conversationHistory.length + 1,
      confidence
    };

    session.conversationHistory.push(message);
    session.lastActivity = new Date().toISOString();

    // Update quality metrics for customer responses
    if (speaker === 'customer') {
      session.qualityMetrics.responseCount++;
      session.qualityMetrics.lastUpdated = new Date().toISOString();
    }

    await this.saveSession(session);
    console.log(`Added ${speaker} message to session ${sessionId}`);
  }

  // Update current question being asked
  async setCurrentQuestion(sessionId: string, question: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.currentQuestion = question;
    session.questionCount++;
    session.lastActivity = new Date().toISOString();

    await this.saveSession(session);
    console.log(`Set current question for session ${sessionId}: ${question.substring(0, 50)}...`);
  }

  // Update quality metrics
  async updateQualityMetrics(
    sessionId: string,
    metrics: Partial<QualityMetrics>
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.qualityMetrics = {
      ...session.qualityMetrics,
      ...metrics,
      lastUpdated: new Date().toISOString()
    };
    session.lastActivity = new Date().toISOString();

    await this.saveSession(session);
  }

  // Get conversation history
  async getConversationHistory(sessionId: string): Promise<ConversationMessage[]> {
    const session = await this.getSession(sessionId);
    return session?.conversationHistory || [];
  }

  // Get business context for session
  async getBusinessContext(sessionId: string): Promise<BusinessContext | null> {
    const session = await this.getSession(sessionId);
    return session?.businessContext || null;
  }

  // Complete session and mark for cleanup
  async completeSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.status = 'completed';
    session.lastActivity = new Date().toISOString();

    // Save final state
    await this.saveSession(session);
    
    // Remove from active sessions
    await this.redis.srem(this.ACTIVE_SESSIONS_KEY, sessionId);
    
    // Set shorter expiry for completed sessions (1 hour)
    const key = this.getSessionKey(sessionId);
    await this.redis.expire(key, 3600);
    
    console.log(`Completed session: ${sessionId}`);
  }

  // Delete session immediately
  async deleteSession(sessionId: string): Promise<void> {
    const key = this.getSessionKey(sessionId);
    await this.redis.del(key);
    await this.redis.srem(this.ACTIVE_SESSIONS_KEY, sessionId);
    
    console.log(`Deleted session: ${sessionId}`);
  }

  // Get all active session IDs
  async getActiveSessions(): Promise<string[]> {
    return await this.redis.smembers(this.ACTIVE_SESSIONS_KEY);
  }

  // Cleanup expired sessions
  async cleanupExpiredSessions(): Promise<number> {
    const activeSessions = await this.getActiveSessions();
    const now = new Date();
    let cleanedCount = 0;

    for (const sessionId of activeSessions) {
      const session = await this.getSession(sessionId);
      
      if (!session || new Date(session.expiresAt) < now) {
        await this.deleteSession(sessionId);
        cleanedCount++;
      }
    }

    console.log(`Cleaned up ${cleanedCount} expired sessions`);
    return cleanedCount;
  }

  // Extend session expiry
  async extendSession(sessionId: string, additionalHours: number = 1): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const newExpiry = new Date(Date.now() + (additionalHours * 60 * 60 * 1000));
    session.expiresAt = newExpiry.toISOString();
    
    const key = this.getSessionKey(sessionId);
    await this.redis.expire(key, additionalHours * 3600);
    await this.saveSession(session);
    
    console.log(`Extended session ${sessionId} by ${additionalHours} hours`);
  }

  // Get session statistics
  async getSessionStats(): Promise<{
    activeSessions: number;
    totalSessions: number;
    averageSessionDuration: number;
  }> {
    const activeCount = await this.redis.scard(this.ACTIVE_SESSIONS_KEY);
    const allKeys = await this.redis.keys(`${this.SESSION_PREFIX}*`);
    
    return {
      activeSessions: activeCount,
      totalSessions: allKeys.length,
      averageSessionDuration: 0 // Calculate if needed
    };
  }

  // Private helper methods
  private getSessionKey(sessionId: string): string {
    return `${this.SESSION_PREFIX}${sessionId}`;
  }

  private async saveSession(session: ConversationState): Promise<void> {
    const key = this.getSessionKey(session.sessionId);
    const expirySeconds = Math.max(1, Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000));
    
    await this.redis.setex(key, expirySeconds, JSON.stringify(session));
  }

  // Graceful shutdown
  async disconnect(): Promise<void> {
    await this.redis.disconnect();
    console.log('Session Manager disconnected from Redis');
  }
}

// Export singleton instance
export const sessionManager = new SessionManager();
export type { ConversationState, ConversationMessage, BusinessContext, QualityMetrics };