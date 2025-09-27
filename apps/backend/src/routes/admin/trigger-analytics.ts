import express from 'express';
import { z } from 'zod';
import { adminAuthMiddleware } from '../../middleware/admin-auth';
import { TriggerActivationLogService } from '../../services/questions/activation-logs-service';
import { DynamicTriggerService } from '../../services/questions/trigger-engine';

const router = express.Router();

const AnalyticsQuerySchema = z.object({
  business_context_id: z.string().uuid().optional(),
  trigger_id: z.string().uuid().optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  group_by: z.enum(['trigger', 'business', 'day', 'week']).default('trigger'),
  limit: z.number().int().min(1).max(1000).default(100),
  offset: z.number().int().min(0).default(0)
});

// GET /api/admin/triggers/effectiveness
router.get('/effectiveness', adminAuthMiddleware, async (req, res) => {
  try {
    const queryResult = AnalyticsQuerySchema.safeParse(req.query);
    
    if (!queryResult.success) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: queryResult.error.errors
      });
    }

    const {
      business_context_id,
      trigger_id,
      start_date,
      end_date,
      group_by,
      limit,
      offset
    } = queryResult.data;

    // Set default date range to last 30 days if not specified
    const endDateTime = end_date ? new Date(end_date) : new Date();
    const startDateTime = start_date ? new Date(start_date) : new Date(endDateTime.getTime() - 30 * 24 * 60 * 60 * 1000);

    const effectiveness = await getTriggerEffectiveness({
      businessContextId: business_context_id,
      triggerId: trigger_id,
      startDate: startDateTime,
      endDate: endDateTime,
      groupBy: group_by,
      limit,
      offset
    });

    res.json({
      data: effectiveness,
      metadata: {
        start_date: startDateTime.toISOString(),
        end_date: endDateTime.toISOString(),
        group_by,
        total_records: effectiveness.length,
        limit,
        offset
      }
    });
  } catch (error) {
    console.error('Error fetching trigger effectiveness:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Failed to fetch trigger effectiveness'
    });
  }
});

// GET /api/admin/triggers/effectiveness/summary
router.get('/effectiveness/summary', adminAuthMiddleware, async (req, res) => {
  try {
    const queryResult = z.object({
      business_context_id: z.string().uuid().optional(),
      start_date: z.string().datetime().optional(),
      end_date: z.string().datetime().optional()
    }).safeParse(req.query);

    if (!queryResult.success) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: queryResult.error.errors
      });
    }

    const { business_context_id, start_date, end_date } = queryResult.data;

    const endDateTime = end_date ? new Date(end_date) : new Date();
    const startDateTime = start_date ? new Date(start_date) : new Date(endDateTime.getTime() - 30 * 24 * 60 * 60 * 1000);

    const summary = await getTriggerEffectivenessSummary({
      businessContextId: business_context_id,
      startDate: startDateTime,
      endDate: endDateTime
    });

    res.json(summary);
  } catch (error) {
    console.error('Error fetching trigger effectiveness summary:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Failed to fetch trigger effectiveness summary'
    });
  }
});

// Helper function to calculate trigger effectiveness
async function getTriggerEffectiveness(params: {
  businessContextId?: string;
  triggerId?: string;
  startDate: Date;
  endDate: Date;
  groupBy: 'trigger' | 'business' | 'day' | 'week';
  limit: number;
  offset: number;
}) {
  const {
    businessContextId,
    triggerId,
    startDate,
    endDate,
    groupBy,
    limit,
    offset
  } = params;

  // Get activation logs
  const activationLogs = await TriggerActivationLogService.getAnalytics({
    businessContextId,
    triggerId,
    startDate,
    endDate,
    limit,
    offset
  });

  // Group and calculate effectiveness based on groupBy parameter
  const groupedData = new Map();

  for (const log of activationLogs) {
    let groupKey: string;
    
    switch (groupBy) {
      case 'trigger':
        groupKey = log.trigger_id;
        break;
      case 'business':
        groupKey = log.business_context_id || 'unknown';
        break;
      case 'day':
        groupKey = log.activation_timestamp.toISOString().split('T')[0];
        break;
      case 'week':
        const weekStart = new Date(log.activation_timestamp);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        groupKey = weekStart.toISOString().split('T')[0];
        break;
    }

    if (!groupedData.has(groupKey)) {
      groupedData.set(groupKey, {
        group_key: groupKey,
        total_activations: 0,
        questions_asked: 0,
        questions_skipped: 0,
        effectiveness_score: 0,
        triggers: new Set(),
        businesses: new Set()
      });
    }

    const group = groupedData.get(groupKey);
    group.total_activations++;
    group.triggers.add(log.trigger_id);
    if (log.business_context_id) {
      group.businesses.add(log.business_context_id);
    }

    if (log.was_asked) {
      group.questions_asked++;
    } else {
      group.questions_skipped++;
    }
  }

  // Calculate effectiveness scores and format response
  const result = Array.from(groupedData.values()).map(group => {
    const effectiveness = group.total_activations > 0 
      ? group.questions_asked / group.total_activations 
      : 0;

    return {
      group_key: group.group_key,
      group_type: groupBy,
      total_activations: group.total_activations,
      questions_asked: group.questions_asked,
      questions_skipped: group.questions_skipped,
      effectiveness_score: Math.round(effectiveness * 100) / 100,
      unique_triggers: group.triggers.size,
      unique_businesses: group.businesses.size,
      skip_reasons: [] // TODO: Aggregate skip reasons from logs
    };
  });

  // Sort by effectiveness score descending
  return result.sort((a, b) => b.effectiveness_score - a.effectiveness_score);
}

// Helper function to get overall effectiveness summary
async function getTriggerEffectivenessSummary(params: {
  businessContextId?: string;
  startDate: Date;
  endDate: Date;
}) {
  const { businessContextId, startDate, endDate } = params;

  // Get overall statistics
  const [
    totalTriggers,
    totalActivations,
    questionsAsked,
    questionsSkipped
  ] = await Promise.all([
    DynamicTriggerService.countActiveTriggers(businessContextId),
    TriggerActivationLogService.countActivations({
      businessContextId,
      startDate,
      endDate
    }),
    TriggerActivationLogService.countQuestionsAsked({
      businessContextId,
      startDate,
      endDate
    }),
    TriggerActivationLogService.countQuestionsSkipped({
      businessContextId,
      startDate,
      endDate
    })
  ]);

  const overallEffectiveness = totalActivations > 0 
    ? questionsAsked / totalActivations 
    : 0;

  return {
    summary: {
      total_active_triggers: totalTriggers,
      total_activations: totalActivations,
      questions_asked: questionsAsked,
      questions_skipped: questionsSkipped,
      overall_effectiveness_score: Math.round(overallEffectiveness * 100) / 100,
      period: {
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        days: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      }
    },
    top_performers: await getTriggerEffectiveness({
      businessContextId,
      startDate,
      endDate,
      groupBy: 'trigger',
      limit: 10,
      offset: 0
    }),
    performance_trends: await getPerformanceTrends({
      businessContextId,
      startDate,
      endDate
    })
  };
}

// Helper function to get performance trends over time
async function getPerformanceTrends(params: {
  businessContextId?: string;
  startDate: Date;
  endDate: Date;
}) {
  const { businessContextId, startDate, endDate } = params;

  const dailyTrends = await getTriggerEffectiveness({
    businessContextId,
    startDate,
    endDate,
    groupBy: 'day',
    limit: 1000,
    offset: 0
  });

  return dailyTrends.map(trend => ({
    date: trend.group_key,
    effectiveness_score: trend.effectiveness_score,
    total_activations: trend.total_activations,
    questions_asked: trend.questions_asked
  }));
}

export default router;