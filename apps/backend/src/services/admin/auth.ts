import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { AdminAccountModel } from '@vocilia/database/admin/admin-account';
import { AdminSessionModel } from '@vocilia/database/admin/admin-session';
import { AuditLogModel } from '@vocilia/database/admin/audit-log';

export interface LoginRequest {
  username: string;
  password: string;
  ipAddress: string;
  userAgent: string;
}

export interface LoginResponse {
  success: boolean;
  token?: string;
  admin?: {
    id: string;
    username: string;
    fullName: string;
    email: string;
  };
  expiresAt?: string;
  error?: string;
}

export interface SessionValidation {
  isValid: boolean;
  admin?: {
    id: string;
    username: string;
    fullName: string;
    email: string;
  };
  sessionId?: string;
}

export class AdminAuthService {
  private static supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  /**
   * Authenticate admin user
   */
  static async login(request: LoginRequest): Promise<LoginResponse> {
    try {
      // Find admin account by username
      const adminAccount = await AdminAccountModel.getByUsername(request.username);
      if (!adminAccount) {
        // Log failed attempt
        await this.logFailedLogin(request.username, request.ipAddress, request.userAgent, 'Invalid username');
        return {
          success: false,
          error: 'Invalid username or password'
        };
      }

      // Get auth user from Supabase
      const { data: authUser, error: authError } = await this.supabase.auth.admin.getUserById(
        adminAccount.user_id
      );

      if (authError || !authUser.user) {
        await this.logFailedLogin(request.username, request.ipAddress, request.userAgent, 'Auth user not found');
        return {
          success: false,
          error: 'Invalid username or password'
        };
      }

      // Sign in with Supabase Auth
      const { data: signInData, error: signInError } = await this.supabase.auth.signInWithPassword({
        email: adminAccount.email,
        password: request.password
      });

      if (signInError || !signInData.session) {
        await this.logFailedLogin(request.username, request.ipAddress, request.userAgent, 'Invalid password');
        return {
          success: false,
          error: 'Invalid username or password'
        };
      }

      // Create admin session record
      const session = await AdminSessionModel.create({
        admin_id: adminAccount.id,
        session_token: signInData.session.access_token,
        ip_address: request.ipAddress,
        user_agent: request.userAgent
      });

      if (!session) {
        return {
          success: false,
          error: 'Failed to create session'
        };
      }

      // Update last login
      await AdminAccountModel.updateLastLogin(adminAccount.id);

      // Log successful login
      await AuditLogModel.logLogin(
        adminAccount.id,
        request.ipAddress,
        request.userAgent,
        true
      );

      return {
        success: true,
        token: signInData.session.access_token,
        admin: {
          id: adminAccount.id,
          username: adminAccount.username,
          fullName: adminAccount.full_name,
          email: adminAccount.email
        },
        expiresAt: session.expires_at
      };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: 'Internal server error'
      };
    }
  }

  /**
   * Logout admin user
   */
  static async logout(sessionToken: string, ipAddress: string, userAgent: string): Promise<boolean> {
    try {
      // Get session with admin info
      const sessionWithAdmin = await AdminSessionModel.getWithAdmin(sessionToken);
      if (!sessionWithAdmin) {
        return false;
      }

      // End session
      await AdminSessionModel.end(sessionToken);

      // Sign out from Supabase Auth
      await this.supabase.auth.signOut();

      // Log logout
      await AuditLogModel.logLogout(
        sessionWithAdmin.admin_id,
        ipAddress,
        userAgent
      );

      return true;
    } catch (error) {
      console.error('Logout error:', error);
      return false;
    }
  }

  /**
   * Validate session token
   */
  static async validateSession(sessionToken: string): Promise<SessionValidation> {
    try {
      // Check if session is valid
      const isValid = await AdminSessionModel.isValid(sessionToken);
      if (!isValid) {
        return { isValid: false };
      }

      // Get session with admin details
      const sessionWithAdmin = await AdminSessionModel.getWithAdmin(sessionToken);
      if (!sessionWithAdmin || !sessionWithAdmin.admin_account) {
        return { isValid: false };
      }

      // Update session activity
      await AdminSessionModel.updateActivity(sessionToken);

      return {
        isValid: true,
        admin: {
          id: sessionWithAdmin.admin_account.id,
          username: sessionWithAdmin.admin_account.username,
          fullName: sessionWithAdmin.admin_account.full_name,
          email: sessionWithAdmin.admin_account.email
        },
        sessionId: sessionWithAdmin.id
      };
    } catch (error) {
      console.error('Session validation error:', error);
      return { isValid: false };
    }
  }

  /**
   * Refresh session (extend expiration)
   */
  static async refreshSession(sessionToken: string): Promise<{ success: boolean; expiresAt?: string }> {
    try {
      const session = await AdminSessionModel.getByToken(sessionToken);
      if (!session) {
        return { success: false };
      }

      // Create new session with extended expiration
      const newExpiresAt = new Date();
      newExpiresAt.setHours(newExpiresAt.getHours() + 2);

      // Update current session expiration and activity
      const { error } = await this.supabase
        .from('admin_sessions')
        .update({
          expires_at: newExpiresAt.toISOString(),
          last_activity_at: new Date().toISOString()
        })
        .eq('session_token', sessionToken);

      if (error) {
        console.error('Error refreshing session:', error);
        return { success: false };
      }

      return {
        success: true,
        expiresAt: newExpiresAt.toISOString()
      };
    } catch (error) {
      console.error('Session refresh error:', error);
      return { success: false };
    }
  }

  /**
   * End all sessions for admin
   */
  static async logoutAllSessions(adminId: string): Promise<boolean> {
    try {
      return await AdminSessionModel.endAllForAdmin(adminId);
    } catch (error) {
      console.error('Error ending all sessions:', error);
      return false;
    }
  }

  /**
   * Get admin by session token
   */
  static async getAdminBySession(sessionToken: string) {
    try {
      const sessionWithAdmin = await AdminSessionModel.getWithAdmin(sessionToken);
      return sessionWithAdmin?.admin_account || null;
    } catch (error) {
      console.error('Error getting admin by session:', error);
      return null;
    }
  }

  /**
   * Check if user has admin privileges
   */
  static async isAdmin(userId: string): Promise<boolean> {
    try {
      return await AdminAccountModel.validateExists(userId);
    } catch (error) {
      console.error('Error checking admin status:', error);
      return false;
    }
  }

  /**
   * Get active sessions for admin
   */
  static async getActiveSessions(adminId: string) {
    try {
      return await AdminSessionModel.getActiveByAdminId(adminId);
    } catch (error) {
      console.error('Error getting active sessions:', error);
      return [];
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
   * Create admin account
   */
  static async createAdminAccount(data: {
    username: string;
    email: string;
    password: string;
    fullName: string;
  }) {
    try {
      // Create auth user in Supabase
      const { data: authUser, error: authError } = await this.supabase.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true
      });

      if (authError || !authUser.user) {
        return { success: false, error: authError?.message || 'Failed to create auth user' };
      }

      // Create admin account record
      const adminAccount = await AdminAccountModel.create({
        user_id: authUser.user.id,
        username: data.username,
        email: data.email,
        full_name: data.fullName
      });

      if (!adminAccount) {
        // Cleanup auth user if admin account creation fails
        await this.supabase.auth.admin.deleteUser(authUser.user.id);
        return { success: false, error: 'Failed to create admin account' };
      }

      return { success: true, adminAccount };
    } catch (error) {
      console.error('Error creating admin account:', error);
      return { success: false, error: 'Internal server error' };
    }
  }

  /**
   * Log failed login attempt
   */
  private static async logFailedLogin(
    username: string,
    ipAddress: string,
    userAgent: string,
    reason: string
  ) {
    try {
      // Try to get admin account for logging (might not exist)
      const adminAccount = await AdminAccountModel.getByUsername(username);
      const adminId = adminAccount?.id || 'unknown';

      await AuditLogModel.logLogin(
        adminId,
        ipAddress,
        userAgent,
        false,
        `Failed login for username '${username}': ${reason}`
      );
    } catch (error) {
      console.error('Error logging failed login:', error);
    }
  }

  /**
   * Validate password strength
   */
  static validatePassword(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*]/.test(password)) {
      errors.push('Password must contain at least one special character (!@#$%^&*)');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}