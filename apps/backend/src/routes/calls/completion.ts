// Call completion confirmation endpoint for Customer Interface Polish
// Handles customer confirmation of call completion and satisfaction ratings

import { Request, Response } from 'express';
import { CallSession } from '../../models/CallSession';
import type { 
  CallCompletionConfirmRequest,
  CallCompletionConfirmResponse 
} from '@vocilia/types';

export const confirmCallCompletion = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;
    const {
      customer_confirmed,
      satisfaction_rating,
      quality_rating,
      feedback_text
    }: CallCompletionConfirmRequest = req.body;

    if (!sessionId) {
      res.status(400).json({
        error: 'Session ID is required'
      });
      return;
    }

    if (typeof customer_confirmed !== 'boolean') {
      res.status(400).json({
        error: 'customer_confirmed must be a boolean value'
      });
      return;
    }

    // Validate satisfaction rating if provided
    if (satisfaction_rating !== undefined && 
        (!Number.isInteger(satisfaction_rating) || satisfaction_rating < 1 || satisfaction_rating > 5)) {
      res.status(400).json({
        error: 'satisfaction_rating must be an integer between 1 and 5'
      });
      return;
    }

    // Validate quality rating if provided
    if (quality_rating !== undefined && 
        (!Number.isInteger(quality_rating) || quality_rating < 1 || quality_rating > 10)) {
      res.status(400).json({
        error: 'quality_rating must be an integer between 1 and 10'
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

    // Check if call is completed
    if (session.status !== 'completed') {
      res.status(400).json({
        error: 'Call must be completed before confirmation',
        current_status: session.status
      });
      return;
    }

    // Check if already confirmed
    if (session.completion_confirmed_at) {
      res.status(409).json({
        error: 'Call completion already confirmed',
        confirmed_at: session.completion_confirmed_at
      });
      return;
    }

    // Update call session with confirmation data
    const confirmationTimestamp = new Date().toISOString();
    const updateData: any = {
      completion_confirmed_at: confirmationTimestamp,
      completion_method: 'customer_confirmed',
      updated_at: confirmationTimestamp
    };

    if (satisfaction_rating !== undefined) {
      updateData.customer_satisfaction_rating = satisfaction_rating;
    }

    if (quality_rating !== undefined) {
      updateData.quality_rating = quality_rating;
    }

    if (feedback_text && feedback_text.trim()) {
      // Store feedback text in metadata or separate feedback table
      updateData.feedback_notes = feedback_text.trim();
    }

    // Mark when reward timeline was shown to customer
    if (customer_confirmed) {
      updateData.reward_timeline_shown_at = confirmationTimestamp;
    }

    const updatedSession = await CallSession.update(sessionId, updateData);
    if (!updatedSession) {
      res.status(500).json({
        error: 'Failed to update call session'
      });
      return;
    }

    // Calculate reward information
    const rewardInfo = calculateRewardDetails(updatedSession);

    // Determine next steps for customer
    const nextSteps = [
      'Din belöning behandlas nu',
      'Du kommer att få ett SMS när belöningen är tillgänglig',
      'Belöningen kommer att vara tillgänglig inom 24-48 timmar'
    ];

    if (satisfaction_rating && satisfaction_rating <= 3) {
      nextSteps.push('Tack för din feedback - vi arbetar för att förbättra vår tjänst');
    }

    // Build response
    const response: CallCompletionConfirmResponse = {
      success: true,
      confirmation_timestamp: confirmationTimestamp,
      reward_info: rewardInfo,
      next_steps: nextSteps
    };

    // Log the completion confirmation
    console.log(`Call completion confirmed for session ${sessionId}`, {
      customer_confirmed,
      satisfaction_rating,
      quality_rating,
      reward_amount: rewardInfo.reward_amount_sek
    });

    res.json(response);

  } catch (error) {
    console.error('Failed to confirm call completion:', error);

    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Calculate reward details based on call session
 */
function calculateRewardDetails(session: any): {
  reward_amount_sek: number;
  reward_available_at: string;
  reward_reference: string;
} {
  // Base reward calculation
  const baseReward = 50; // 50 SEK base
  const questionBonus = (session.questions_asked?.length || 0) * 10; // 10 SEK per question
  
  // Quality bonus based on ratings
  let qualityBonus = 0;
  if (session.customer_satisfaction_rating >= 4) {
    qualityBonus += 10; // High satisfaction bonus
  }
  if (session.quality_rating >= 8) {
    qualityBonus += 5; // High quality bonus
  }

  const totalReward = baseReward + questionBonus + qualityBonus;

  // Calculate availability date (24-48 hours from confirmation)
  const availableDate = new Date(session.completion_confirmed_at);
  availableDate.setHours(availableDate.getHours() + 24); // 24 hours processing time

  // Generate unique reward reference
  const rewardReference = `VR-${session.id.slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

  return {
    reward_amount_sek: totalReward,
    reward_available_at: availableDate.toISOString(),
    reward_reference: rewardReference
  };
}

/**
 * Get call completion statistics (admin endpoint)
 */
export const getCompletionStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const { businessId } = req.query;
    const { days = 30 } = req.query;

    // Build date filter
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days as string));

    // Get completion statistics
    const stats = await CallSession.getCompletionStats({
      businessId: businessId as string,
      startDate: startDate.toISOString(),
      endDate: new Date().toISOString()
    });

    res.json({
      success: true,
      period: {
        days: parseInt(days as string),
        start_date: startDate.toISOString(),
        end_date: new Date().toISOString()
      },
      statistics: stats
    });

  } catch (error) {
    console.error('Failed to get completion stats:', error);

    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};