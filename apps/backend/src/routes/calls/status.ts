import { Request, Response } from 'express';
import { CallSession } from '../../models/CallSession';
import { CallEvent } from '../../models/CallEvent';
import { CallResponse } from '../../models/CallResponse';
import type { 
  CallStatusResponse, 
  CallTimelineEvent,
  CallSessionStatus 
} from '@vocilia/types';

// Enhanced CallStatusResponse is now imported from @vocilia/types

export const getCallStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;
    const { includeTimeline } = req.query;

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

    // Get call events
    const events = await CallEvent.findBySessionId(sessionId);

    // Calculate progress information
    const progress = calculateCallProgress(session, events);

    // Build timeline if requested
    let timeline: CallTimelineEvent[] | undefined;
    if (includeTimeline === 'true') {
      timeline = buildCallTimeline(events);
    }

    // Determine if customer can confirm completion
    const canConfirmCompletion = session.status === 'completed' && 
                                !session.completion_confirmed_at;

    // Calculate reward information
    const rewardInfo = calculateRewardInfo(session);

    // Build enhanced response
    const statusResponse: CallStatusResponse = {
      sessionId: session.id,
      status: session.status as CallSessionStatus,
      progress,
      timeline,
      can_confirm_completion: canConfirmCompletion,
      reward_info: rewardInfo
    };

    res.json(statusResponse);

  } catch (error) {
    console.error('Failed to get call status:', error);

    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Calculate call progress information
 */
function calculateCallProgress(session: any, events: any[]): {
  current_step: 'connecting' | 'questions' | 'completion' | 'finished';
  total_steps: number;
  completed_steps: number;
  estimated_remaining_seconds: number | null;
} {
  const totalSteps = 4; // connecting, questions, completion, finished
  let currentStep: 'connecting' | 'questions' | 'completion' | 'finished';
  let completedSteps = 0;

  // Determine current step based on status and events
  switch (session.status) {
    case 'initiated':
    case 'connecting':
      currentStep = 'connecting';
      completedSteps = 0;
      break;
    case 'in_progress':
      currentStep = 'questions';
      completedSteps = 1;
      break;
    case 'completed':
      if (session.completion_confirmed_at) {
        currentStep = 'finished';
        completedSteps = 4;
      } else {
        currentStep = 'completion';
        completedSteps = 2;
      }
      break;
    default:
      currentStep = 'finished';
      completedSteps = 4;
  }

  // Estimate remaining time based on typical call duration
  let estimatedRemainingSeconds: number | null = null;
  if (currentStep === 'connecting') {
    estimatedRemainingSeconds = 90; // 1.5 minutes typical call duration
  } else if (currentStep === 'questions') {
    const startEvent = events.find(e => e.eventType === 'call_initiated');
    if (startEvent) {
      const elapsed = Math.floor((Date.now() - new Date(startEvent.createdAt).getTime()) / 1000);
      estimatedRemainingSeconds = Math.max(0, 120 - elapsed); // 2 minute max
    }
  }

  return {
    current_step: currentStep,
    total_steps: totalSteps,
    completed_steps: completedSteps,
    estimated_remaining_seconds: estimatedRemainingSeconds
  };
}

/**
 * Build call timeline from events
 */
function buildCallTimeline(events: any[]): CallTimelineEvent[] {
  const timelineMap: { [key: string]: CallTimelineEvent } = {
    'call_initiated': {
      timestamp: '',
      event: 'Call Initiated',
      description: 'Din samtal har startats',
      status: 'completed'
    },
    'call_connecting': {
      timestamp: '',
      event: 'Connecting',
      description: 'Ansluter till ditt telefonnummer',
      status: 'completed'
    },
    'call_answered': {
      timestamp: '',
      event: 'Call Answered',
      description: 'Samtalet besvarades',
      status: 'completed'
    },
    'questions_started': {
      timestamp: '',
      event: 'Questions Started',
      description: 'Frågor ställs',
      status: 'completed'
    },
    'call_completed': {
      timestamp: '',
      event: 'Call Completed',
      description: 'Samtalet avslutades',
      status: 'completed'
    }
  };

  // Populate timeline with actual event timestamps
  events.forEach(event => {
    if (timelineMap[event.eventType]) {
      timelineMap[event.eventType].timestamp = event.createdAt;
    }
  });

  // Return timeline in chronological order, only including events that occurred
  return Object.values(timelineMap)
    .filter(item => item.timestamp !== '')
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

/**
 * Calculate reward information
 */
function calculateRewardInfo(session: any): {
  estimated_reward_sek: number;
  reward_timeline: string;
  reward_status: 'pending' | 'processing' | 'available';
} | undefined {
  if (session.status !== 'completed') {
    return undefined;
  }

  // Calculate reward amount (example: 50 SEK base + 10 SEK per question answered)
  const baseReward = 50;
  const questionBonus = (session.questions_asked?.length || 0) * 10;
  const estimatedReward = baseReward + questionBonus;

  // Calculate when reward will be available (typically 24-48 hours)
  const rewardDate = new Date(session.ended_at || session.updated_at);
  rewardDate.setHours(rewardDate.getHours() + 24); // 24 hours later

  // Determine reward status
  let rewardStatus: 'pending' | 'processing' | 'available';
  if (session.completion_confirmed_at) {
    const now = new Date();
    rewardStatus = now >= rewardDate ? 'available' : 'processing';
  } else {
    rewardStatus = 'pending';
  }

  return {
    estimated_reward_sek: estimatedReward,
    reward_timeline: rewardDate.toISOString(),
    reward_status: rewardStatus
  };
}