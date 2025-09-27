import { AdminSessionModel } from '@vocilia/database/admin/admin-session';
import { AdminAccountModel } from '@vocilia/database/admin/admin-account';

export interface SessionInfo {
  id: string;
  adminId: string;
  sessionToken: string;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
  lastActivityAt: string;
  expiresAt: string;
  isActive: boolean;
  admin?: {
    username: string;
    fullName: string;
    email: string;
  };
}

export interface SessionActivity {
  sessionId: string;
  adminId: string;
  action: string;
  timestamp: string;
  ipAddress: string;
  userAgent: string;
}

export class AdminSessionService {
  /**
   * Get all active sessions
   */
  static async getActiveSessions(): Promise<SessionInfo[]> {
    try {
      const activeSessions = await AdminSessionModel.getActiveByAdminId(''); // Get all active
      
      const sessionsWithAdmin = await Promise.all(
        activeSessions.map(async (session) => {
          const admin = await AdminAccountModel.getByUserId(session.admin_id);
          return {
            id: session.id,
            adminId: session.admin_id,
            sessionToken: session.session_token,
            ipAddress: session.ip_address,
            userAgent: session.user_agent,
            createdAt: session.created_at,
            lastActivityAt: session.last_activity_at,
            expiresAt: session.expires_at,
            isActive: session.is_active,
            admin: admin ? {
              username: admin.username,
              fullName: admin.full_name,
              email: admin.email
            } : undefined
          };
        })
      );

      return sessionsWithAdmin;
    } catch (error) {
      console.error('Error getting active sessions:', error);
      return [];
    }
  }

  /**
   * Get sessions for specific admin
   */
  static async getSessionsForAdmin(adminId: string, limit = 50): Promise<SessionInfo[]> {
    try {
      const sessions = await AdminSessionModel.getAllForAdmin(adminId, limit);
      const admin = await AdminAccountModel.getByUserId(adminId);

      return sessions.map(session => ({
        id: session.id,
        adminId: session.admin_id,
        sessionToken: session.session_token,
        ipAddress: session.ip_address,
        userAgent: session.user_agent,
        createdAt: session.created_at,
        lastActivityAt: session.last_activity_at,
        expiresAt: session.expires_at,
        isActive: session.is_active,
        admin: admin ? {
          username: admin.username,
          fullName: admin.full_name,
          email: admin.email
        } : undefined
      }));
    } catch (error) {
      console.error('Error getting sessions for admin:', error);
      return [];
    }
  }

  /**
   * Get session details by token
   */
  static async getSessionByToken(sessionToken: string): Promise<SessionInfo | null> {
    try {
      const sessionWithAdmin = await AdminSessionModel.getWithAdmin(sessionToken);
      if (!sessionWithAdmin) {
        return null;
      }

      return {
        id: sessionWithAdmin.id,
        adminId: sessionWithAdmin.admin_id,
        sessionToken: sessionWithAdmin.session_token,
        ipAddress: sessionWithAdmin.ip_address,
        userAgent: sessionWithAdmin.user_agent,
        createdAt: sessionWithAdmin.created_at,
        lastActivityAt: sessionWithAdmin.last_activity_at,
        expiresAt: sessionWithAdmin.expires_at,
        isActive: sessionWithAdmin.is_active,
        admin: sessionWithAdmin.admin_account ? {
          username: sessionWithAdmin.admin_account.username,
          fullName: sessionWithAdmin.admin_account.full_name,
          email: sessionWithAdmin.admin_account.email
        } : undefined
      };
    } catch (error) {
      console.error('Error getting session by token:', error);
      return null;
    }
  }

  /**
   * Update session activity
   */
  static async updateActivity(sessionToken: string): Promise<boolean> {
    try {
      return await AdminSessionModel.updateActivity(sessionToken);
    } catch (error) {
      console.error('Error updating session activity:', error);
      return false;
    }
  }

  /**
   * End session
   */
  static async endSession(sessionToken: string): Promise<boolean> {
    try {
      return await AdminSessionModel.end(sessionToken);
    } catch (error) {
      console.error('Error ending session:', error);
      return false;
    }
  }

  /**
   * End session by ID (admin action)
   */
  static async endSessionById(sessionId: string): Promise<boolean> {
    try {
      const session = await AdminSessionModel.getByToken(''); // We need the token
      // This would require a new method in AdminSessionModel to get by ID
      // For now, we'll implement it here
      const { error } = await AdminSessionModel['supabase']
        .from('admin_sessions')
        .update({ 
          is_active: false,
          ended_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      return !error;
    } catch (error) {
      console.error('Error ending session by ID:', error);
      return false;
    }
  }

  /**
   * End all sessions for admin
   */
  static async endAllSessionsForAdmin(adminId: string): Promise<boolean> {
    try {
      return await AdminSessionModel.endAllForAdmin(adminId);
    } catch (error) {
      console.error('Error ending all sessions for admin:', error);
      return false;
    }
  }

  /**
   * Check if session is about to expire (within warning threshold)
   */
  static async getExpiringSessionsWarning(minutesThreshold = 15): Promise<SessionInfo[]> {
    try {
      const warningTime = new Date();
      warningTime.setMinutes(warningTime.getMinutes() + minutesThreshold);

      // This would require a custom query
      // For now, we'll get all active sessions and filter
      const allSessions = await this.getActiveSessions();
      
      return allSessions.filter(session => {
        const expiresAt = new Date(session.expiresAt);
        return expiresAt <= warningTime && expiresAt > new Date();
      });
    } catch (error) {
      console.error('Error getting expiring sessions:', error);
      return [];
    }
  }

  /**
   * Get session statistics
   */
  static async getSessionStatistics(days = 7): Promise<{
    totalSessions: number;
    activeSessions: number;
    expiredSessions: number;
    avgSessionDuration: number;
    uniqueAdmins: number;
    sessionsToday: number;
  }> {
    try {
      const since = new Date();
      since.setDate(since.getDate() - days);

      // Get all sessions in the timeframe
      const allSessions = await this.getAllSessionsSince(since);
      const activeSessions = await this.getActiveSessions();

      const totalSessions = allSessions.length;
      const activeCount = activeSessions.length;
      const expiredSessions = totalSessions - activeCount;

      // Calculate average session duration for completed sessions
      const completedSessions = allSessions.filter(s => !s.isActive && s.endedAt);
      const avgDuration = completedSessions.length > 0
        ? completedSessions.reduce((sum, session) => {
            const duration = new Date(session.endedAt!).getTime() - new Date(session.createdAt).getTime();
            return sum + duration;
          }, 0) / completedSessions.length
        : 0;

      // Get unique admins
      const uniqueAdmins = new Set(allSessions.map(s => s.adminId)).size;

      // Get sessions created today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const sessionsToday = allSessions.filter(s => new Date(s.createdAt) >= today).length;

      return {
        totalSessions,
        activeSessions: activeCount,
        expiredSessions,
        avgSessionDuration: avgDuration,
        uniqueAdmins,
        sessionsToday
      };
    } catch (error) {
      console.error('Error getting session statistics:', error);
      return {
        totalSessions: 0,
        activeSessions: 0,
        expiredSessions: 0,
        avgSessionDuration: 0,
        uniqueAdmins: 0,
        sessionsToday: 0
      };
    }
  }

  /**
   * Cleanup expired sessions
   */
  static async cleanupExpiredSessions(): Promise<number> {
    try {
      return await AdminSessionModel.cleanupExpired();
    } catch (error) {
      console.error('Error cleaning up expired sessions:', error);
      return 0;
    }
  }

  /**
   * Validate session and get admin info
   */
  static async validateAndGetAdmin(sessionToken: string): Promise<{
    isValid: boolean;
    admin?: any;
    session?: SessionInfo;
  }> {
    try {
      const isValid = await AdminSessionModel.isValid(sessionToken);
      if (!isValid) {
        return { isValid: false };
      }

      const session = await this.getSessionByToken(sessionToken);
      if (!session) {
        return { isValid: false };
      }

      // Update activity
      await this.updateActivity(sessionToken);

      return {
        isValid: true,
        admin: session.admin,
        session
      };
    } catch (error) {
      console.error('Error validating session:', error);
      return { isValid: false };
    }
  }

  /**
   * Get sessions by IP address (security monitoring)
   */
  static async getSessionsByIP(ipAddress: string, hours = 24): Promise<SessionInfo[]> {
    try {
      const since = new Date();
      since.setHours(since.getHours() - hours);

      const sessions = await this.getAllSessionsSince(since);
      return sessions.filter(session => session.ipAddress === ipAddress);
    } catch (error) {
      console.error('Error getting sessions by IP:', error);
      return [];
    }
  }

  /**
   * Get suspicious session activity
   */
  static async getSuspiciousActivity(): Promise<{
    multipleIPSessions: SessionInfo[];
    rapidLoginAttempts: SessionInfo[];
    longRunningSessions: SessionInfo[];
  }> {
    try {
      const activeSessions = await this.getActiveSessions();
      
      // Group sessions by admin
      const sessionsByAdmin = new Map<string, SessionInfo[]>();
      activeSessions.forEach(session => {
        if (!sessionsByAdmin.has(session.adminId)) {
          sessionsByAdmin.set(session.adminId, []);
        }
        sessionsByAdmin.get(session.adminId)!.push(session);
      });

      // Find admins with sessions from multiple IPs
      const multipleIPSessions: SessionInfo[] = [];
      sessionsByAdmin.forEach(sessions => {
        const uniqueIPs = new Set(sessions.map(s => s.ipAddress));
        if (uniqueIPs.size > 1) {
          multipleIPSessions.push(...sessions);
        }
      });

      // Find rapid login attempts (multiple sessions created within short time)
      const rapidLoginAttempts: SessionInfo[] = [];
      const recentSessions = activeSessions.filter(s => {
        const createdAt = new Date(s.createdAt);
        const oneHourAgo = new Date();
        oneHourAgo.setHours(oneHourAgo.getHours() - 1);
        return createdAt > oneHourAgo;
      });

      if (recentSessions.length > 3) {
        rapidLoginAttempts.push(...recentSessions);
      }

      // Find long running sessions (>12 hours)
      const twelveHoursAgo = new Date();
      twelveHoursAgo.setHours(twelveHoursAgo.getHours() - 12);
      const longRunningSessions = activeSessions.filter(s => {
        return new Date(s.createdAt) < twelveHoursAgo;
      });

      return {
        multipleIPSessions,
        rapidLoginAttempts,
        longRunningSessions
      };
    } catch (error) {
      console.error('Error getting suspicious activity:', error);
      return {
        multipleIPSessions: [],
        rapidLoginAttempts: [],
        longRunningSessions: []
      };
    }
  }

  /**
   * Helper method to get all sessions since a date
   */
  private static async getAllSessionsSince(since: Date): Promise<(SessionInfo & { endedAt?: string })[]> {
    // This would require a new method in AdminSessionModel
    // For now, we'll return empty array
    return [];
  }
}