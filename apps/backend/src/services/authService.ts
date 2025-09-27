import { database } from '@vocilia/database';
import { ValidationError, AuthenticationError, NotFoundError } from '../middleware/errorHandler';
import { userService, UserProfile } from './userService';
import { loggingService } from './loggingService';

export interface AuthenticateRequest {
  email: string;
  password: string;
  ipAddress: string;
  userAgent: string;
}

export interface AuthenticateResponse {
  access_token: string;
  refresh_token: string;
  token_type: 'bearer';
  expires_in: number;
  user: UserProfile;
}

export interface RefreshTokenRequest {
  refresh_token: string;
  ipAddress: string;
  userAgent: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name?: string;
  role: 'business_account' | 'admin_account';
  business_id?: string;
  ipAddress: string;
  userAgent: string;
}

export interface ChangePasswordRequest {
  userId: string;
  currentPassword: string;
  newPassword: string;
  ipAddress: string;
  userAgent: string;
}

export interface ResetPasswordRequest {
  email: string;
  ipAddress: string;
  userAgent: string;
}

export class AuthService {
  private supabase = database.createClient();

  async authenticate(request: AuthenticateRequest): Promise<AuthenticateResponse> {
    const { email, password, ipAddress, userAgent } = request;

    // Validate input
    if (!email || !password) {
      throw new ValidationError('Email and password are required', {
        email: !email ? 'Email is required' : undefined,
        password: !password ? 'Password is required' : undefined,
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new ValidationError('Invalid email format');
    }

    try {
      // Authenticate with Supabase
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        loggingService.logUserLogin('unknown', ipAddress, userAgent, false);
        throw new AuthenticationError('Invalid email or password');
      }

      if (!data.user || !data.session) {
        loggingService.logUserLogin('unknown', ipAddress, userAgent, false);
        throw new AuthenticationError('Authentication failed');
      }

      // Get user profile
      const profile = await userService.getUserById(data.user.id);

      // Log successful login
      loggingService.logUserLogin(data.user.id, ipAddress, userAgent, true);

      // Audit log the login
      await loggingService.logAuditEvent(
        data.user.id,
        'login',
        'user',
        data.user.id,
        { email },
        ipAddress,
        userAgent
      );

      return {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        token_type: 'bearer',
        expires_in: data.session.expires_in || 3600,
        user: profile,
      };
    } catch (error) {
      if (error instanceof ValidationError || error instanceof AuthenticationError) {
        throw error;
      }
      loggingService.error('Authentication error', error as Error);
      throw new AuthenticationError('Authentication service error');
    }
  }

  async refreshToken(request: RefreshTokenRequest): Promise<AuthenticateResponse> {
    const { refresh_token, ipAddress, userAgent } = request;

    if (!refresh_token) {
      throw new ValidationError('Refresh token is required');
    }

    try {
      const { data, error } = await this.supabase.auth.refreshSession({
        refresh_token,
      });

      if (error) {
        loggingService.logSecurityEvent({
          type: 'auth_failure',
          severity: 'medium',
          details: {
            reason: 'invalid_refresh_token',
            ipAddress,
            userAgent,
          },
          ip_address: ipAddress,
          user_agent: userAgent,
        });
        throw new AuthenticationError('Invalid or expired refresh token');
      }

      if (!data.user || !data.session) {
        throw new AuthenticationError('Failed to refresh session');
      }

      // Get updated user profile
      const profile = await userService.getUserById(data.user.id);

      // Log token refresh
      loggingService.info('Token refreshed', { userId: data.user.id, ipAddress, userAgent });

      return {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        token_type: 'bearer',
        expires_in: data.session.expires_in || 3600,
        user: profile,
      };
    } catch (error) {
      if (error instanceof ValidationError || error instanceof AuthenticationError) {
        throw error;
      }
      loggingService.error('Token refresh error', error as Error);
      throw new AuthenticationError('Token refresh service error');
    }
  }

  async logout(accessToken: string, ipAddress: string, userAgent: string): Promise<void> {
    try {
      // Get user info from token first
      const { data: { user }, error: userError } = await this.supabase.auth.getUser(accessToken);

      // Sign out from Supabase
      const { error } = await this.supabase.auth.signOut();

      if (error) {
        loggingService.error('Logout error', error);
        throw new Error('Failed to logout');
      }

      // Log logout if we have user info
      if (user && !userError) {
        loggingService.info('User logged out', { userId: user.id, ipAddress, userAgent });
        
        await loggingService.logAuditEvent(
          user.id,
          'logout',
          'user',
          user.id,
          {},
          ipAddress,
          userAgent
        );
      }
    } catch (error) {
      loggingService.error('Logout service error', error as Error);
      throw new Error('Logout service error');
    }
  }

  async register(request: RegisterRequest): Promise<UserProfile> {
    const { email, password, full_name, role, business_id, ipAddress, userAgent } = request;

    // Validate input
    if (!email || !password || !role) {
      throw new ValidationError('Email, password, and role are required', {
        email: !email ? 'Email is required' : undefined,
        password: !password ? 'Password is required' : undefined,
        role: !role ? 'Role is required' : undefined,
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new ValidationError('Invalid email format');
    }

    // Validate password strength
    if (password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters long');
    }

    // Validate role
    if (!['business_account', 'admin_account'].includes(role)) {
      throw new ValidationError('Invalid role');
    }

    // If business role, ensure business_id is provided
    if (role === 'business_account' && !business_id) {
      throw new ValidationError('Business ID is required for business accounts');
    }

    try {
      // Register with Supabase Auth
      const { data, error } = await this.supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: full_name || null,
            role,
            business_id: business_id || null,
          },
        },
      });

      if (error) {
        if (error.message.includes('already registered')) {
          throw new ValidationError('Email already registered');
        }
        throw new Error(`Registration failed: ${error.message}`);
      }

      if (!data.user) {
        throw new Error('Registration failed: No user returned');
      }

      // Create user profile
      const profile = await userService.createUser({
        id: data.user.id,
        email,
        full_name,
        role,
        business_id,
      });

      // Log registration
      loggingService.info('User registered', {
        userId: data.user.id,
        email,
        role,
        ipAddress,
        userAgent,
      });

      await loggingService.logAuditEvent(
        data.user.id,
        'register',
        'user',
        data.user.id,
        { email, role, business_id },
        ipAddress,
        userAgent
      );

      return profile;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      loggingService.error('Registration error', error as Error);
      throw new Error('Registration service error');
    }
  }

  async changePassword(request: ChangePasswordRequest): Promise<void> {
    const { userId, currentPassword, newPassword, ipAddress, userAgent } = request;

    // Validate input
    if (!userId || !currentPassword || !newPassword) {
      throw new ValidationError('User ID, current password, and new password are required');
    }

    // Validate new password strength
    if (newPassword.length < 8) {
      throw new ValidationError('New password must be at least 8 characters long');
    }

    try {
      // Get user email for verification
      const profile = await userService.getUserById(userId);

      // Verify current password by attempting to sign in
      const { error: verifyError } = await this.supabase.auth.signInWithPassword({
        email: profile.email,
        password: currentPassword,
      });

      if (verifyError) {
        throw new AuthenticationError('Current password is incorrect');
      }

      // Update password
      const { error } = await this.supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        throw new Error(`Password change failed: ${error.message}`);
      }

      // Log password change
      loggingService.info('Password changed', { userId, ipAddress, userAgent });

      await loggingService.logAuditEvent(
        userId,
        'change_password',
        'user',
        userId,
        {},
        ipAddress,
        userAgent
      );
    } catch (error) {
      if (error instanceof ValidationError || error instanceof AuthenticationError) {
        throw error;
      }
      loggingService.error('Password change error', error as Error);
      throw new Error('Password change service error');
    }
  }

  async resetPassword(request: ResetPasswordRequest): Promise<void> {
    const { email, ipAddress, userAgent } = request;

    // Validate input
    if (!email) {
      throw new ValidationError('Email is required');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new ValidationError('Invalid email format');
    }

    try {
      // Send password reset email
      const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.FRONTEND_URL}/reset-password`,
      });

      if (error) {
        throw new Error(`Password reset failed: ${error.message}`);
      }

      // Log password reset request
      loggingService.info('Password reset requested', { email, ipAddress, userAgent });

      // Don't throw error if user doesn't exist to prevent email enumeration
      try {
        const profile = await userService.getUserByEmail(email);
        
        await loggingService.logAuditEvent(
          profile.id,
          'reset_password_request',
          'user',
          profile.id,
          { email },
          ipAddress,
          userAgent
        );
      } catch (userError) {
        // User doesn't exist, but don't reveal this
        loggingService.info('Password reset requested for non-existent user', { email, ipAddress });
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      loggingService.error('Password reset error', error as Error);
      throw new Error('Password reset service error');
    }
  }

  async verifyToken(token: string): Promise<UserProfile> {
    if (!token) {
      throw new ValidationError('Token is required');
    }

    try {
      const { data: { user }, error } = await this.supabase.auth.getUser(token);

      if (error || !user) {
        throw new AuthenticationError('Invalid or expired token');
      }

      // Get user profile
      const profile = await userService.getUserById(user.id);

      return profile;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof AuthenticationError) {
        throw error;
      }
      loggingService.error('Token verification error', error as Error);
      throw new AuthenticationError('Token verification service error');
    }
  }

  async getUserSessions(userId: string): Promise<any[]> {
    if (!userId) {
      throw new ValidationError('User ID is required');
    }

    try {
      // Note: Supabase doesn't provide a direct way to get all user sessions
      // This would typically be implemented with a custom sessions table
      // For now, we'll return an empty array and log the request
      
      loggingService.info('User sessions requested', { userId });
      
      return [];
    } catch (error) {
      loggingService.error('Get user sessions error', error as Error);
      throw new Error('Failed to get user sessions');
    }
  }

  async revokeAllSessions(userId: string, ipAddress: string, userAgent: string): Promise<void> {
    if (!userId) {
      throw new ValidationError('User ID is required');
    }

    try {
      // This would typically revoke all sessions for a user
      // Supabase doesn't provide this directly, so we'll sign out the current session
      const { error } = await this.supabase.auth.signOut();

      if (error) {
        throw new Error(`Failed to revoke sessions: ${error.message}`);
      }

      // Log session revocation
      loggingService.info('All sessions revoked', { userId, ipAddress, userAgent });

      await loggingService.logAuditEvent(
        userId,
        'revoke_all_sessions',
        'user',
        userId,
        {},
        ipAddress,
        userAgent
      );
    } catch (error) {
      loggingService.error('Revoke sessions error', error as Error);
      throw new Error('Failed to revoke sessions');
    }
  }
}

// Singleton instance
export const authService = new AuthService();