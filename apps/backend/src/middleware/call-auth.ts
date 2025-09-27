import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { CallSession } from '../models/CallSession';

export interface CallAuthRequest extends Request {
  callSession?: any;
  businessId?: string;
}

/**
 * Middleware to authenticate call-related requests
 * Validates that the business has permission to access the call session
 */
export const authenticateCall = async (req: CallAuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { sessionId } = req.params;
    const businessId = req.headers['x-business-id'] as string;
    const authToken = req.headers.authorization?.replace('Bearer ', '');

    if (!authToken) {
      res.status(401).json({
        error: 'Authorization token required'
      });
      return;
    }

    if (!businessId) {
      res.status(400).json({
        error: 'Business ID header required'
      });
      return;
    }

    // Verify the auth token with Supabase
    const { data: user, error: authError } = await supabase.auth.getUser(authToken);
    
    if (authError || !user.user) {
      res.status(401).json({
        error: 'Invalid or expired token'
      });
      return;
    }

    // Verify business association
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id, owner_id')
      .eq('id', businessId)
      .single();

    if (businessError || !business) {
      res.status(404).json({
        error: 'Business not found'
      });
      return;
    }

    // Check if user owns the business
    if (business.owner_id !== user.user.id) {
      res.status(403).json({
        error: 'Access denied to this business'
      });
      return;
    }

    // If sessionId is provided, verify session belongs to business
    if (sessionId) {
      const session = await CallSession.findById(sessionId);
      
      if (!session) {
        res.status(404).json({
          error: 'Call session not found'
        });
        return;
      }

      if (session.businessId !== businessId) {
        res.status(403).json({
          error: 'Access denied to this call session'
        });
        return;
      }

      req.callSession = session;
    }

    req.businessId = businessId;
    next();

  } catch (error) {
    console.error('Call authentication error:', error);
    res.status(500).json({
      error: 'Authentication failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Middleware to validate QR verification for call initiation
 */
export const validateQRVerification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { verificationId, businessId } = req.body;

    if (!verificationId || !businessId) {
      res.status(400).json({
        error: 'Verification ID and Business ID are required'
      });
      return;
    }

    // Check if verification exists and is valid
    const { data: verification, error } = await supabase
      .from('qr_verifications')
      .select('*')
      .eq('id', verificationId)
      .eq('business_id', businessId)
      .eq('verified', true)
      .single();

    if (error || !verification) {
      res.status(404).json({
        error: 'Invalid or expired QR verification'
      });
      return;
    }

    // Check if verification is recent (within 5 minutes)
    const verificationTime = new Date(verification.verified_at);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    if (verificationTime < fiveMinutesAgo) {
      res.status(400).json({
        error: 'QR verification expired. Please scan the QR code again.'
      });
      return;
    }

    // Check if verification was already used for a call
    const { data: existingCall } = await supabase
      .from('call_sessions')
      .select('id')
      .eq('verification_id', verificationId)
      .single();

    if (existingCall) {
      res.status(409).json({
        error: 'QR verification already used for a call'
      });
      return;
    }

    next();

  } catch (error) {
    console.error('QR verification error:', error);
    res.status(500).json({
      error: 'Verification failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Middleware to check call rate limits
 */
export const checkCallRateLimit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { businessId, customerPhone } = req.body;

    if (!businessId || !customerPhone) {
      next();
      return;
    }

    // Check for recent calls to the same customer
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const { data: recentCalls, error } = await supabase
      .from('call_sessions')
      .select('id, created_at, status')
      .eq('business_id', businessId)
      .eq('customer_phone', customerPhone)
      .gte('created_at', oneHourAgo.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Rate limit check failed:', error);
      next();
      return;
    }

    // Allow max 3 calls per hour to same customer
    if (recentCalls && recentCalls.length >= 3) {
      res.status(429).json({
        error: 'Rate limit exceeded. Maximum 3 calls per hour per customer.',
        nextCallAvailable: new Date(new Date(recentCalls[2].created_at).getTime() + 60 * 60 * 1000)
      });
      return;
    }

    // Check for business daily call limit
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: todayCalls, error: dailyError } = await supabase
      .from('call_sessions')
      .select('id')
      .eq('business_id', businessId)
      .gte('created_at', todayStart.toISOString());

    if (dailyError) {
      console.error('Daily limit check failed:', dailyError);
      next();
      return;
    }

    // Allow max 100 calls per day per business
    if (todayCalls && todayCalls.length >= 100) {
      res.status(429).json({
        error: 'Daily call limit exceeded. Maximum 100 calls per day.',
        nextCallAvailable: new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)
      });
      return;
    }

    next();

  } catch (error) {
    console.error('Rate limit check error:', error);
    next(); // Continue on error to avoid blocking legitimate calls
  }
};