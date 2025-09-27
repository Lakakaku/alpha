/**
 * Enhanced Call Status Middleware for Vocilia Customer Interface
 * 
 * Provides real-time call status tracking and validation middleware
 * for customer call completion workflows.
 * 
 * Features:
 * - Call session validation and status checks
 * - Real-time status updates and caching
 * - Customer authentication for call access
 * - Call completion confirmation validation
 * - Status polling rate limiting
 * - Call session timeout handling
 */

import { Request, Response, NextFunction } from 'express';
import { database } from '@vocilia/database';
import type { CallSession, CallStatus } from '@vocilia/types';

// Cache for call status to reduce database queries
const callStatusCache = new Map<string, {
  status: CallStatus;
  lastUpdated: number;
  ttl: number;
}>();

const CACHE_TTL = 30000; // 30 seconds
const MAX_POLLING_RATE = 5000; // 5 seconds minimum between polls

// Extend Request interface for call session context
declare global {
  namespace Express {
    interface Request {
      callSession?: CallSession;
      callStatus?: CallStatus;
      customerVerified?: boolean;
    }
  }
}

// === MAIN MIDDLEWARE FUNCTIONS ===

/**
 * Validates call session exists and customer has access
 */
export async function validateCallSession(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { sessionId } = req.params;
    
    if (!sessionId) {
      return res.status(400).json({
        error: 'MISSING_SESSION_ID',
        message: 'Call session ID is required'
      });
    }

    // Check cache first
    const cached = callStatusCache.get(sessionId);
    if (cached && (Date.now() - cached.lastUpdated) < cached.ttl) {
      req.callStatus = cached.status;
      return next();
    }

    // Query database for call session
    const { data: callSession, error } = await database
      .from('call_sessions')
      .select(`
        *,
        businesses!inner(id, name, active),
        stores!inner(id, name, business_id)
      `)
      .eq('id', sessionId)
      .single();

    if (error || !callSession) {
      return res.status(404).json({
        error: 'CALL_SESSION_NOT_FOUND',
        message: 'Call session not found or has expired'
      });
    }

    // Verify call session is valid and accessible
    if (callSession.status === 'expired' || callSession.status === 'cancelled') {
      return res.status(410).json({
        error: 'CALL_SESSION_EXPIRED',
        message: 'Call session has expired or been cancelled'
      });
    }

    // Check if business/store is still active
    if (!callSession.businesses.active) {
      return res.status(403).json({
        error: 'BUSINESS_INACTIVE',
        message: 'Business account is no longer active'
      });
    }

    // Attach session to request
    req.callSession = callSession;
    req.callStatus = callSession.status;

    // Update cache
    callStatusCache.set(sessionId, {
      status: callSession.status,
      lastUpdated: Date.now(),
      ttl: CACHE_TTL
    });

    next();
  } catch (error) {
    console.error('Call session validation error:', error);
    res.status(500).json({
      error: 'VALIDATION_ERROR',
      message: 'Failed to validate call session'
    });
  }
}

/**
 * Validates customer has permission to access this call session
 */
export async function validateCustomerAccess(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const callSession = req.callSession;
    if (!callSession) {
      return res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Call session not loaded'
      });
    }

    // Get customer identifier from request
    const customerPhone = req.headers['x-customer-phone'] as string;
    const customerEmail = req.headers['x-customer-email'] as string;
    const qrSessionToken = req.headers['x-qr-session'] as string;

    // For QR-based access, validate the QR session
    if (qrSessionToken) {
      const { data: qrSession, error } = await database
        .from('qr_verification_sessions')
        .select('*')
        .eq('session_token', qrSessionToken)
        .eq('store_id', callSession.store_id)
        .eq('status', 'active')
        .gte('expires_at', new Date().toISOString())
        .single();

      if (error || !qrSession) {
        return res.status(403).json({
          error: 'INVALID_QR_SESSION',
          message: 'QR session is invalid or has expired'
        });
      }

      req.customerVerified = true;
      return next();
    }

    // For phone/email based access, validate against call session
    if (customerPhone && callSession.customer_phone === customerPhone) {
      req.customerVerified = true;
      return next();
    }

    if (customerEmail && callSession.customer_email === customerEmail) {
      req.customerVerified = true;
      return next();
    }

    // If no valid customer identification found
    return res.status(403).json({
      error: 'CUSTOMER_ACCESS_DENIED',
      message: 'Customer not authorized to access this call session'
    });

  } catch (error) {
    console.error('Customer access validation error:', error);
    res.status(500).json({
      error: 'ACCESS_VALIDATION_ERROR',
      message: 'Failed to validate customer access'
    });
  }
}

/**
 * Rate limits status polling to prevent excessive requests
 */
export function rateLimitStatusPolling(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const sessionId = req.params.sessionId;
  const clientId = req.ip || 'unknown';
  const key = `${sessionId}:${clientId}`;
  
  const lastPoll = statusPollTracker.get(key);
  const now = Date.now();
  
  if (lastPoll && (now - lastPoll) < MAX_POLLING_RATE) {
    return res.status(429).json({
      error: 'POLLING_TOO_FREQUENT',
      message: 'Status polling too frequent. Please wait before next request.',
      retryAfter: Math.ceil((MAX_POLLING_RATE - (now - lastPoll)) / 1000)
    });
  }
  
  statusPollTracker.set(key, now);
  
  // Clean up old entries
  statusPollTracker.forEach((timestamp, trackingKey) => {
    if (now - timestamp > MAX_POLLING_RATE * 2) {
      statusPollTracker.delete(trackingKey);
    }
  });
  
  next();
}

/**
 * Validates call completion requests
 */
export async function validateCallCompletion(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const callSession = req.callSession;
    if (!callSession) {
      return res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Call session not loaded'
      });
    }

    // Check if call is in a state that allows completion
    const validCompletionStates: CallStatus[] = ['in_progress', 'completed', 'ending'];
    
    if (!validCompletionStates.includes(callSession.status)) {
      return res.status(400).json({
        error: 'INVALID_CALL_STATE',
        message: `Call cannot be completed from status: ${callSession.status}`,
        allowedStates: validCompletionStates
      });
    }

    // Check if call has already been confirmed by customer
    if (callSession.customer_confirmed_at) {
      return res.status(409).json({
        error: 'ALREADY_CONFIRMED',
        message: 'Call completion has already been confirmed by customer',
        confirmedAt: callSession.customer_confirmed_at
      });
    }

    // Validate completion data in request body
    const { rating, feedback, issues } = req.body;
    
    if (rating !== undefined) {
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({
          error: 'INVALID_RATING',
          message: 'Rating must be an integer between 1 and 5'
        });
      }
    }

    if (feedback !== undefined) {
      if (typeof feedback !== 'string' || feedback.length > 1000) {
        return res.status(400).json({
          error: 'INVALID_FEEDBACK',
          message: 'Feedback must be a string with maximum 1000 characters'
        });
      }
    }

    if (issues !== undefined) {
      if (!Array.isArray(issues) || issues.some(issue => typeof issue !== 'string')) {
        return res.status(400).json({
          error: 'INVALID_ISSUES',
          message: 'Issues must be an array of strings'
        });
      }
    }

    next();
  } catch (error) {
    console.error('Call completion validation error:', error);
    res.status(500).json({
      error: 'COMPLETION_VALIDATION_ERROR',
      message: 'Failed to validate call completion request'
    });
  }
}

/**
 * Updates call status in database and cache
 */
export async function updateCallStatus(
  sessionId: string,
  newStatus: CallStatus,
  additionalData?: Record<string, any>
): Promise<boolean> {
  try {
    const updateData = {
      status: newStatus,
      updated_at: new Date().toISOString(),
      ...additionalData
    };

    const { error } = await database
      .from('call_sessions')
      .update(updateData)
      .eq('id', sessionId);

    if (error) {
      console.error('Failed to update call status:', error);
      return false;
    }

    // Update cache
    const cached = callStatusCache.get(sessionId);
    if (cached) {
      cached.status = newStatus;
      cached.lastUpdated = Date.now();
    }

    // Broadcast status update via real-time channels if available
    await broadcastStatusUpdate(sessionId, newStatus, additionalData);

    return true;
  } catch (error) {
    console.error('Call status update error:', error);
    return false;
  }
}

/**
 * Middleware to handle call session timeouts
 */
export async function checkCallTimeout(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const callSession = req.callSession;
    if (!callSession) {
      return next();
    }

    const now = new Date();
    const callStarted = new Date(callSession.created_at);
    const maxCallDuration = 30 * 60 * 1000; // 30 minutes

    // Check if call has exceeded maximum duration
    if (now.getTime() - callStarted.getTime() > maxCallDuration) {
      // Auto-expire the call
      await updateCallStatus(callSession.id, 'expired', {
        expired_reason: 'timeout',
        expired_at: now.toISOString()
      });

      return res.status(410).json({
        error: 'CALL_EXPIRED',
        message: 'Call session has expired due to timeout',
        expiredAt: now.toISOString()
      });
    }

    next();
  } catch (error) {
    console.error('Call timeout check error:', error);
    next();
  }
}

/**
 * Real-time status update broadcasting
 */
async function broadcastStatusUpdate(
  sessionId: string,
  status: CallStatus,
  additionalData?: Record<string, any>
): Promise<void> {
  try {
    // If using Supabase real-time
    const payload = {
      session_id: sessionId,
      status,
      timestamp: new Date().toISOString(),
      ...additionalData
    };

    // Broadcast to call_status_updates channel
    await database.channel('call_status_updates').send({
      type: 'broadcast',
      event: 'status_update',
      payload
    });

  } catch (error) {
    console.error('Failed to broadcast status update:', error);
    // Don't throw error as this is not critical
  }
}

// === UTILITY FUNCTIONS ===

/**
 * Clears cached call status
 */
export function clearCallStatusCache(sessionId: string): void {
  callStatusCache.delete(sessionId);
}

/**
 * Gets cached call status
 */
export function getCachedCallStatus(sessionId: string): CallStatus | null {
  const cached = callStatusCache.get(sessionId);
  if (cached && (Date.now() - cached.lastUpdated) < cached.ttl) {
    return cached.status;
  }
  return null;
}

/**
 * Health check for call status middleware
 */
export function getCallStatusHealthMetrics(): {
  cacheSize: number;
  activePollTrackers: number;
  memoryUsage: number;
} {
  return {
    cacheSize: callStatusCache.size,
    activePollTrackers: statusPollTracker.size,
    memoryUsage: process.memoryUsage().heapUsed
  };
}

// === INTERNAL STATE ===

// Status polling tracker to prevent excessive requests
const statusPollTracker = new Map<string, number>();

// Clean up tracking data periodically
setInterval(() => {
  const now = Date.now();
  statusPollTracker.forEach((timestamp, key) => {
    if (now - timestamp > MAX_POLLING_RATE * 5) {
      statusPollTracker.delete(key);
    }
  });
}, 60000); // Clean up every minute

// Clean up cache periodically
setInterval(() => {
  const now = Date.now();
  callStatusCache.forEach((cached, key) => {
    if (now - cached.lastUpdated > cached.ttl * 2) {
      callStatusCache.delete(key);
    }
  });
}, 60000); // Clean up every minute

// === EXPORTS ===

export {
  validateCallSession,
  validateCustomerAccess,
  rateLimitStatusPolling,
  validateCallCompletion,
  updateCallStatus,
  checkCallTimeout,
  clearCallStatusCache,
  getCachedCallStatus,
  getCallStatusHealthMetrics
};

// Type exports
export type { CallSession, CallStatus };