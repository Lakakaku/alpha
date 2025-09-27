import { Request, Response } from 'express';
import { CallSession } from '../../models/CallSession';
import { CallEvent } from '../../models/CallEvent';
import { CallResponse } from '../../models/CallResponse';
import { OpenAIVoiceService } from '../../services/ai/OpenAIVoiceService';
import { FortyElksService } from '../../services/telephony/FortyElksService';
import { TwilioService } from '../../services/telephony/TwilioService';

export interface CompleteCallRequest {
  reason?: 'manual' | 'timeout' | 'customer_hangup' | 'error';
  finalCost?: number;
  finalDuration?: number;
  summary?: string;
}

export interface CompleteCallResponse {
  sessionId: string;
  status: 'completed' | 'failed';
  finalDuration: number;
  finalCost: number;
  questionsAnswered: number;
  summary: {
    totalQuestions: number;
    successfulResponses: number;
    averageConfidence: number;
    sentiment: {
      positive: number;
      neutral: number;
      negative: number;
    };
  };
}

export const completeCall = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;
    const {
      reason = 'manual',
      finalCost,
      finalDuration,
      summary
    }: CompleteCallRequest = req.body;

    if (!sessionId) {
      res.status(400).json({
        error: 'Session ID is required'
      });
      return;
    }

    // Get the call session
    const session = await CallSession.findById(sessionId);
    if (!session) {
      res.status(404).json({
        error: 'Call session not found'
      });
      return;
    }

    // Check if call is already completed or failed
    if (['completed', 'failed', 'timeout'].includes(session.status)) {
      res.status(400).json({
        error: `Call is already ${session.status}`
      });
      return;
    }

    // End the telephony call if still active
    if (session.providerCallId && session.providerId) {
      try {
        if (session.providerId === 'fortyelks') {
          const service = new FortyElksService();
          await service.endCall(session.providerCallId);
        } else if (session.providerId === 'twilio') {
          const service = new TwilioService();
          await service.endCall(session.providerCallId);
        }
      } catch (error) {
        console.warn('Failed to end telephony call:', error);
        // Continue with completion even if we can't end the call
      }
    }

    // Calculate actual duration if not provided
    let actualDuration = finalDuration;
    if (!actualDuration) {
      const events = await CallEvent.findBySessionId(sessionId);
      const startEvent = events.find(e => e.eventType === 'call_initiated');
      if (startEvent) {
        actualDuration = Math.floor((Date.now() - new Date(startEvent.createdAt).getTime()) / 1000);
      } else {
        actualDuration = 0;
      }
    }

    // Calculate actual cost if not provided
    let actualCost = finalCost;
    if (!actualCost && actualDuration > 0) {
      // Estimate cost based on provider and duration
      const costPerMinute = session.providerId === 'fortyelks' ? 0.09 : 0.12;
      const durationMinutes = Math.ceil(actualDuration / 60);
      actualCost = costPerMinute * durationMinutes;
    }

    // Get all responses for summary
    const responses = await CallResponse.findBySessionId(sessionId);

    // Calculate response statistics
    const successfulResponses = responses.filter(r => r.confidence && r.confidence > 0.5).length;
    const averageConfidence = responses.length > 0 
      ? responses.reduce((sum, r) => sum + (r.confidence || 0), 0) / responses.length 
      : 0;

    // Calculate sentiment distribution
    const sentimentCounts = responses.reduce(
      (acc, r) => {
        const sentiment = r.sentiment || 'neutral';
        acc[sentiment] = (acc[sentiment] || 0) + 1;
        return acc;
      },
      { positive: 0, neutral: 0, negative: 0 }
    );

    // Update session status
    const newStatus = reason === 'error' ? 'failed' : 'completed';
    await session.updateStatus(newStatus, {
      actualDuration,
      actualCost
    });

    // Log completion event
    await CallEvent.create({
      sessionId,
      eventType: 'call_completed',
      providerId: 'system',
      eventData: {
        reason,
        finalDuration: actualDuration,
        finalCost: actualCost,
        questionsAnswered: responses.length,
        successfulResponses,
        summary,
        endpoint: '/api/calls/complete'
      }
    });

    // Build response
    const completeResponse: CompleteCallResponse = {
      sessionId,
      status: newStatus,
      finalDuration: actualDuration,
      finalCost: actualCost || 0,
      questionsAnswered: responses.length,
      summary: {
        totalQuestions: session.expectedQuestions,
        successfulResponses,
        averageConfidence: Math.round(averageConfidence * 100) / 100,
        sentiment: sentimentCounts
      }
    };

    res.json(completeResponse);

  } catch (error) {
    console.error('Failed to complete call:', error);

    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};