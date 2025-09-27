import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { supabase } from '../../../../packages/database/src/client/supabase';
import { callManagerService } from '../../services/calls/callManagerService';

const router = express.Router();

interface FortySearchParamsWebhookPayload {
  id: string;
  to: string;
  from: string;
  created: string;
  direction: 'inbound' | 'outbound';
  state: 'ringing' | 'ongoing' | 'busy' | 'no-answer' | 'failed' | 'completed';
  duration?: number;
  cost?: number;
  legs?: Array<{
    id: string;
    to: string;
    from: string;
    state: string;
    duration?: number;
  }>;
  // Custom fields we include
  session_id?: string;
  store_id?: string;
}

// Verify webhook signature from 46elks
const verifyWebhookSignature = (payload: string, signature: string): boolean => {
  const expectedSignature = crypto
    .createHmac('sha1', process.env.FORTYSIXELKS_WEBHOOK_SECRET || '')
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(`sha1=${expectedSignature}`),
    Buffer.from(signature)
  );
};

// Handle incoming call events from 46elks
router.post('/phone/events', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  try {
    const signature = req.get('X-46elks-Signature') || '';
    const payload = req.body.toString();

    // Verify webhook authenticity
    if (!verifyWebhookSignature(payload, signature)) {
      console.error('Invalid webhook signature');
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    const event: FortySearchParamsWebhookPayload = JSON.parse(payload);
    
    console.log('Received 46elks webhook:', {
      id: event.id,
      state: event.state,
      direction: event.direction,
      sessionId: event.session_id,
      duration: event.duration
    });

    // Only process outbound calls (our AI calls)
    if (event.direction !== 'outbound') {
      res.status(200).json({ message: 'Inbound call ignored' });
      return;
    }

    // Extract session ID from custom fields
    const sessionId = event.session_id;
    if (!sessionId) {
      console.warn('No session_id in webhook payload');
      res.status(200).json({ message: 'No session ID found' });
      return;
    }

    // Find the feedback call session
    const { data: callSession, error: sessionError } = await supabase
      .from('feedback_call_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError || !callSession) {
      console.error('Call session not found:', sessionId);
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // Process different call states
    switch (event.state) {
      case 'ringing':
        await handleCallRinging(sessionId, event);
        break;
      
      case 'ongoing':
        await handleCallConnected(sessionId, event);
        break;
      
      case 'completed':
        await handleCallCompleted(sessionId, event);
        break;
      
      case 'busy':
      case 'no-answer':
      case 'failed':
        await handleCallFailed(sessionId, event);
        break;
      
      default:
        console.warn('Unknown call state:', event.state);
    }

    res.status(200).json({ message: 'Webhook processed successfully' });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Handle call ringing state
async function handleCallRinging(sessionId: string, event: FortySearchParamsWebhookPayload): Promise<void> {
  console.log(`Call ${sessionId} is ringing`);
  
  // Update session status to indicate call is attempting to connect
  await supabase
    .from('feedback_call_sessions')
    .update({
      session_status: 'in_progress',
      call_initiated_at: new Date(event.created).toISOString()
    })
    .eq('id', sessionId);
}

// Handle call connected state
async function handleCallConnected(sessionId: string, event: FortySearchParamsWebhookPayload): Promise<void> {
  console.log(`Call ${sessionId} connected`);
  
  // Update session to show connection established
  await supabase
    .from('feedback_call_sessions')
    .update({
      session_status: 'in_progress',
      call_connected_at: new Date().toISOString()
    })
    .eq('id', sessionId);

  // Start OpenAI real-time session for conversation
  try {
    await callManagerService.startConversation(sessionId);
  } catch (error) {
    console.error('Failed to start OpenAI conversation:', error);
    
    // Update session with failure
    await supabase
      .from('feedback_call_sessions')
      .update({
        session_status: 'failed',
        failure_reason: 'OpenAI connection failed'
      })
      .eq('id', sessionId);
  }
}

// Handle call completed state
async function handleCallCompleted(sessionId: string, event: FortySearchParamsWebhookPayload): Promise<void> {
  console.log(`Call ${sessionId} completed, duration: ${event.duration}s`);
  
  // Update session with completion details
  await supabase
    .from('feedback_call_sessions')
    .update({
      session_status: 'completed',
      call_ended_at: new Date().toISOString(),
      duration_seconds: event.duration || 0
    })
    .eq('id', sessionId);

  // Store call quality metrics
  const qualityData = {
    call_session_id: sessionId,
    connection_quality: event.duration && event.duration > 30 ? 'good' : 'poor',
    audio_clarity_score: event.duration && event.duration > 30 ? 0.85 : 0.60,
    technical_errors: event.cost === 0 ? { connection_issues: true } : null,
    measured_at: new Date().toISOString()
  };

  await supabase
    .from('call_quality_metrics')
    .insert(qualityData);

  // Trigger conversation analysis if call was substantial
  if (event.duration && event.duration > 10) {
    try {
      await callManagerService.processCallComplete(sessionId);
    } catch (error) {
      console.error('Failed to process call completion:', error);
    }
  }
}

// Handle call failed states
async function handleCallFailed(sessionId: string, event: FortySearchParamsWebhookPayload): Promise<void> {
  console.log(`Call ${sessionId} failed: ${event.state}`);
  
  // Get current retry count
  const { data: session } = await supabase
    .from('feedback_call_sessions')
    .select('retry_count')
    .eq('id', sessionId)
    .single();

  const retryCount = session?.retry_count || 0;
  const maxRetries = 2; // Maximum of 3 total attempts (original + 2 retries)

  if (retryCount < maxRetries) {
    // Schedule retry
    console.log(`Scheduling retry ${retryCount + 1} for call ${sessionId}`);
    
    await supabase
      .from('feedback_call_sessions')
      .update({
        session_status: 'pending',
        retry_count: retryCount + 1,
        failure_reason: `Previous attempt: ${event.state}`
      })
      .eq('id', sessionId);

    // Schedule retry with exponential backoff (2^retry_count minutes)
    const retryDelayMinutes = Math.pow(2, retryCount);
    setTimeout(async () => {
      try {
        await callManagerService.retryCall(sessionId);
      } catch (error) {
        console.error('Retry failed:', error);
      }
    }, retryDelayMinutes * 60 * 1000);
    
  } else {
    // Mark as permanently failed after max retries
    await supabase
      .from('feedback_call_sessions')
      .update({
        session_status: 'failed',
        failure_reason: `Final attempt failed: ${event.state}`,
        call_ended_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    console.log(`Call ${sessionId} permanently failed after ${maxRetries + 1} attempts`);
  }
}

// Health check endpoint for webhook monitoring
router.get('/phone/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    service: '46elks webhook handler',
    timestamp: new Date().toISOString()
  });
});

export default router;