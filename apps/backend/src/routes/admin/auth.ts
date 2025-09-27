import { Router, Request, Response } from 'express';
import { AdminAuthService } from '../../services/admin/auth';
import { AdminSessionService } from '../../services/admin/session';
import { adminAuth } from '../../middleware/admin-auth';
import { rateLimiter } from '../../middleware/rateLimiter';

const router = Router();

interface AdminAuthRequest extends Request {
  body: {
    username: string;
    password: string;
  };
}

interface AdminSessionRequest extends Request {
  admin?: {
    id: string;
    username: string;
    fullName: string;
    email: string;
  };
  sessionToken?: string;
}

/**
 * POST /admin/auth/login
 * Admin authentication endpoint
 */
router.post('/login', rateLimiter(5, 15), async (req: AdminAuthRequest, res: Response) => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required'
      });
    }

    // Get client info
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';

    // Authenticate
    const result = await AdminAuthService.login({
      username: username.trim(),
      password,
      ipAddress,
      userAgent
    });

    if (!result.success) {
      return res.status(401).json(result);
    }

    // Set secure cookie with token
    res.cookie('admin_token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 2 * 60 * 60 * 1000 // 2 hours
    });

    res.json({
      success: true,
      admin: result.admin,
      expiresAt: result.expiresAt
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /admin/auth/logout
 * Admin logout endpoint
 */
router.post('/logout', adminAuth, async (req: AdminSessionRequest, res: Response) => {
  try {
    const sessionToken = req.sessionToken;
    if (!sessionToken) {
      return res.status(400).json({
        success: false,
        error: 'No active session'
      });
    }

    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';

    const success = await AdminAuthService.logout(sessionToken, ipAddress, userAgent);

    // Clear cookie
    res.clearCookie('admin_token');

    res.json({
      success,
      message: success ? 'Logged out successfully' : 'Logout failed'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /admin/auth/me
 * Get current admin user info
 */
router.get('/me', adminAuth, async (req: AdminSessionRequest, res: Response) => {
  try {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    res.json({
      success: true,
      admin: req.admin
    });
  } catch (error) {
    console.error('Get admin info error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /admin/auth/refresh
 * Refresh admin session
 */
router.post('/refresh', adminAuth, async (req: AdminSessionRequest, res: Response) => {
  try {
    const sessionToken = req.sessionToken;
    if (!sessionToken) {
      return res.status(400).json({
        success: false,
        error: 'No active session'
      });
    }

    const result = await AdminAuthService.refreshSession(sessionToken);

    if (!result.success) {
      return res.status(401).json({
        success: false,
        error: 'Failed to refresh session'
      });
    }

    // Update cookie expiration
    res.cookie('admin_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 2 * 60 * 60 * 1000 // 2 hours
    });

    res.json({
      success: true,
      expiresAt: result.expiresAt
    });
  } catch (error) {
    console.error('Session refresh error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /admin/auth/sessions
 * Get active sessions for current admin
 */
router.get('/sessions', adminAuth, async (req: AdminSessionRequest, res: Response) => {
  try {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    const sessions = await AdminSessionService.getSessionsForAdmin(req.admin.id, 20);

    res.json({
      success: true,
      sessions: sessions.map(session => ({
        id: session.id,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        createdAt: session.createdAt,
        lastActivityAt: session.lastActivityAt,
        expiresAt: session.expiresAt,
        isActive: session.isActive
      }))
    });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * DELETE /admin/auth/sessions/:sessionId
 * End specific session
 */
router.delete('/sessions/:sessionId', adminAuth, async (req: AdminSessionRequest, res: Response) => {
  try {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    const { sessionId } = req.params;
    const success = await AdminSessionService.endSessionById(sessionId);

    res.json({
      success,
      message: success ? 'Session ended successfully' : 'Failed to end session'
    });
  } catch (error) {
    console.error('End session error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * DELETE /admin/auth/sessions
 * End all sessions for current admin (except current)
 */
router.delete('/sessions', adminAuth, async (req: AdminSessionRequest, res: Response) => {
  try {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    // End all sessions except current
    const currentSessionId = req.sessionToken;
    const sessions = await AdminSessionService.getSessionsForAdmin(req.admin.id);
    
    let endedCount = 0;
    for (const session of sessions) {
      if (session.sessionToken !== currentSessionId && session.isActive) {
        const success = await AdminSessionService.endSessionById(session.id);
        if (success) endedCount++;
      }
    }

    res.json({
      success: true,
      message: `Ended ${endedCount} sessions`,
      endedCount
    });
  } catch (error) {
    console.error('End all sessions error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /admin/auth/validate
 * Validate current session
 */
router.post('/validate', async (req: Request, res: Response) => {
  try {
    const token = req.cookies.admin_token || req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }

    const validation = await AdminAuthService.validateSession(token);

    if (!validation.isValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid session'
      });
    }

    res.json({
      success: true,
      admin: validation.admin
    });
  } catch (error) {
    console.error('Session validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /admin/auth/session-stats
 * Get session statistics (admin only)
 */
router.get('/session-stats', adminAuth, async (req: AdminSessionRequest, res: Response) => {
  try {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    const stats = await AdminSessionService.getSessionStatistics(7);

    res.json({
      success: true,
      statistics: stats
    });
  } catch (error) {
    console.error('Get session stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;