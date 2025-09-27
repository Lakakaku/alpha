import { Request, Response } from 'express';
import { CallOrchestrator } from '../../services/calls/CallOrchestrator';
import { CallEvent } from '../../models/CallEvent';
import { supabase } from '../../config/supabase';

export interface InitiateCallRequest {
  verificationId: string;
  businessId: string;
  customerPhone: string;
  preferredProvider?: 'fortyelks' | 'twilio';
  maxDurationMinutes?: number;
  questionCount?: number;
}

export interface InitiateCallResponse {
  sessionId: string;
  status: 'initiated' | 'failed';
  estimatedDuration: number;
  estimatedCost: number;
  callId?: string;
  providerId?: string;
  error?: string;
}

export const initiateCall = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      verificationId,
      businessId,
      customerPhone,
      preferredProvider = 'fortyelks',
      maxDurationMinutes = 2,
      questionCount = 3
    }: InitiateCallRequest = req.body;

    // Validate required fields
    if (!verificationId || !businessId || !customerPhone) {
      res.status(400).json({
        error: 'Missing required fields: verificationId, businessId, customerPhone'
      });
      return;
    }

    // Validate phone number format (Swedish numbers)
    const phoneRegex = /^\+46[0-9]{8,9}$/;
    if (!phoneRegex.test(customerPhone)) {
      res.status(400).json({
        error: 'Invalid phone number format. Must be Swedish format (+46XXXXXXXXX)'
      });
      return;
    }

    // Verify that the verification exists and is valid
    const { data: verification, error: verificationError } = await supabase
      .from('qr_verifications')
      .select('*')
      .eq('id', verificationId)
      .eq('business_id', businessId)
      .eq('verified', true)
      .single();

    if (verificationError || !verification) {
      res.status(404).json({
        error: 'Invalid or expired verification'
      });
      return;
    }

    // Check if verification was used recently (prevent spam)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (new Date(verification.verified_at) < fiveMinutesAgo) {
      res.status(400).json({
        error: 'Verification expired. Please scan QR code again.'
      });
      return;
    }

    // Check for existing active calls for this customer
    const { data: existingCalls } = await supabase
      .from('call_sessions')
      .select('*')
      .eq('business_id', businessId)
      .eq('customer_phone', customerPhone)
      .in('status', ['initiated', 'connecting', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(1);

    if (existingCalls && existingCalls.length > 0) {
      res.status(409).json({
        error: 'Call already in progress for this customer',
        sessionId: existingCalls[0].id
      });
      return;
    }

    // Initialize call orchestrator
    const orchestrator = new CallOrchestrator();

    // Initiate the call
    const callResponse = await orchestrator.initiateCall({
      verificationId,
      businessId,
      customerPhone,
      preferredProvider,
      maxDurationMinutes,
      questionCount
    });

    if (!callResponse.success) {
      res.status(500).json({
        error: callResponse.error || 'Failed to initiate call'
      });
      return;
    }

    // Log successful initiation
    await CallEvent.create({
      sessionId: callResponse.sessionId,
      eventType: 'api_call_initiated',
      providerId: 'system',
      eventData: {
        endpoint: '/api/calls/initiate',
        businessId,
        customerPhone,
        preferredProvider,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      }
    });

    // Return successful response
    const response: InitiateCallResponse = {
      sessionId: callResponse.sessionId,
      status: 'initiated',
      estimatedDuration: callResponse.estimatedDuration,
      estimatedCost: callResponse.estimatedCost,
      callId: callResponse.callId,
      providerId: callResponse.providerId
    };

    res.status(201).json(response);

  } catch (error) {
    console.error('Call initiation failed:', error);

    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};