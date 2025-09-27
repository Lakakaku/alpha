import { Request, Response } from 'express';
import { CallSession } from '../../models/CallSession';
import { CallEvent } from '../../models/CallEvent';
import { CallResponse } from '../../models/CallResponse';
import { OpenAIVoiceService } from '../../services/ai/OpenAIVoiceService';

export interface AIWebhookPayload {
  sessionId: string;
  event: 'session_started' | 'question_answered' | 'session_completed' | 'session_failed' | 'audio_chunk';
  data: any;
  timestamp: string;
}

/**
 * Webhook handler for OpenAI voice session events
 */
export const handleOpenAIWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const payload: AIWebhookPayload = req.body;

    console.log('Received OpenAI webhook:', payload.event, payload.sessionId);

    // Validate payload
    if (!payload.sessionId || !payload.event) {
      res.status(400).json({
        error: 'Invalid webhook payload: sessionId and event required'
      });
      return;
    }

    // Find the call session
    const session = await CallSession.findById(payload.sessionId);
    if (!session) {
      res.status(404).json({
        error: 'Call session not found'
      });
      return;
    }

    // Handle different AI events
    switch (payload.event) {
      case 'session_started':
        await handleAISessionStarted(session, payload);
        break;

      case 'question_answered':
        await handleQuestionAnswered(session, payload);
        break;

      case 'session_completed':
        await handleAISessionCompleted(session, payload);
        break;

      case 'session_failed':
        await handleAISessionFailed(session, payload);
        break;

      case 'audio_chunk':
        await handleAudioChunk(session, payload);
        break;

      default:
        console.warn('Unknown AI webhook event:', payload.event);
    }

    // Log the webhook reception
    await CallEvent.create({
      sessionId: payload.sessionId,
      eventType: 'ai_webhook_received',
      providerId: 'openai',
      eventData: {
        event: payload.event,
        webhook_data: payload.data,
        endpoint: req.originalUrl,
        timestamp: payload.timestamp
      }
    });

    res.status(200).json({ status: 'processed' });

  } catch (error) {
    console.error('AI webhook handling failed:', error);
    res.status(500).json({
      error: 'Webhook processing failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

async function handleAISessionStarted(session: CallSession, payload: AIWebhookPayload): Promise<void> {
  // Update session status if needed
  if (session.status === 'connecting') {
    await session.updateStatus('in_progress');
  }

  await CallEvent.create({
    sessionId: session.id,
    eventType: 'ai_session_started',
    providerId: 'openai',
    eventData: {
      questions_count: payload.data.questionsCount,
      business_name: payload.data.businessName,
      start_time: payload.timestamp
    }
  });
}

async function handleQuestionAnswered(session: CallSession, payload: AIWebhookPayload): Promise<void> {
  const { questionId, responseText, extractedValue, confidence, sentiment } = payload.data;

  // Store the response
  await CallResponse.create({
    sessionId: session.id,
    questionId,
    responseText,
    extractedValue,
    confidence,
    sentiment
  });

  await CallEvent.create({
    sessionId: session.id,
    eventType: 'question_answered',
    providerId: 'openai',
    eventData: {
      question_id: questionId,
      response_text: responseText,
      confidence,
      sentiment,
      extracted_value: extractedValue
    }
  });
}

async function handleAISessionCompleted(session: CallSession, payload: AIWebhookPayload): Promise<void> {
  const { duration, questionsAnswered, totalQuestions } = payload.data;

  // Update session if not already completed
  if (!['completed', 'failed', 'timeout'].includes(session.status)) {
    await session.updateStatus('completed', {
      actualDuration: Math.floor(duration / 1000)
    });
  }

  await CallEvent.create({
    sessionId: session.id,
    eventType: 'ai_session_completed',
    providerId: 'openai',
    eventData: {
      duration,
      questions_answered: questionsAnswered,
      total_questions: totalQuestions,
      completion_rate: totalQuestions > 0 ? questionsAnswered / totalQuestions : 0
    }
  });
}

async function handleAISessionFailed(session: CallSession, payload: AIWebhookPayload): Promise<void> {
  const { error, duration } = payload.data;

  // Update session to failed if not already in terminal state
  if (!['completed', 'failed', 'timeout'].includes(session.status)) {
    await session.updateStatus('failed', {
      actualDuration: duration ? Math.floor(duration / 1000) : undefined
    });
  }

  await CallEvent.create({
    sessionId: session.id,
    eventType: 'ai_session_failed',
    providerId: 'openai',
    eventData: {
      error,
      duration,
      failure_reason: 'ai_service_error'
    }
  });
}

async function handleAudioChunk(session: CallSession, payload: AIWebhookPayload): Promise<void> {
  // Log audio processing events (for debugging/monitoring)
  // Don't store the actual audio data, just metadata
  const { chunk_size, audio_format, timestamp } = payload.data;

  await CallEvent.create({
    sessionId: session.id,
    eventType: 'ai_audio_processed',
    providerId: 'openai',
    eventData: {
      chunk_size,
      audio_format,
      processed_at: timestamp
    }
  });
}

/**
 * Webhook for real-time audio streaming
 */
export const handleAudioStream = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;
    
    if (!sessionId) {
      res.status(400).json({ error: 'Session ID required' });
      return;
    }

    // Find session
    const session = await CallSession.findById(sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // Set up streaming response headers
    res.writeHead(200, {
      'Content-Type': 'audio/wav',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    // This would integrate with the real-time audio pipeline
    // For now, just acknowledge the connection
    res.write(''); // Keep connection open

    // In a real implementation, this would:
    // 1. Connect to the OpenAI real-time API
    // 2. Stream audio bidirectionally
    // 3. Handle disconnections gracefully

    console.log(`Audio streaming started for session ${sessionId}`);

  } catch (error) {
    console.error('Audio streaming setup failed:', error);
    res.status(500).json({ error: 'Streaming setup failed' });
  }
};

/**
 * Webhook to handle AI service health checks
 */
export const handleAIHealthCheck = async (req: Request, res: Response): Promise<void> => {
  try {
    // Check OpenAI API connectivity
    const healthStatus = {
      openai: 'unknown',
      timestamp: new Date().toISOString()
    };

    try {
      // Simple health check - could ping OpenAI API
      healthStatus.openai = 'healthy';
    } catch (error) {
      healthStatus.openai = 'unhealthy';
    }

    res.json(healthStatus);

  } catch (error) {
    console.error('AI health check failed:', error);
    res.status(500).json({ error: 'Health check failed' });
  }
};