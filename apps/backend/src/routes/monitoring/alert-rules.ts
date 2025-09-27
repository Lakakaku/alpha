import { Router, Request, Response } from 'express';
import { requireAdminAuth, AdminRequest } from '../../middleware/admin-auth';
import { alertService } from '../../services/monitoring/alert-service';
import { ValidationError, NotFoundError } from '../../middleware/errorHandler';
import { loggingService } from '../../services/loggingService';

const router = Router();

interface CreateAlertRuleRequest extends AdminRequest {
  body: {
    rule_name: string;
    metric_type: string;
    threshold_value: number;
    comparison_operator: '>' | '<' | '>=' | '<=' | '=';
    notification_channels: ('email' | 'dashboard' | 'sms')[];
  };
}

interface UpdateAlertRuleRequest extends AdminRequest {
  body: {
    rule_name?: string;
    threshold_value?: number;
    comparison_operator?: '>' | '<' | '>=' | '<=' | '=';
    notification_channels?: ('email' | 'dashboard' | 'sms')[];
    is_active?: boolean;
  };
  params: {
    rule_id: string;
  };
}

interface DeleteAlertRuleRequest extends AdminRequest {
  params: {
    rule_id: string;
  };
}

/**
 * GET /api/monitoring/alerts/rules
 * Get alert rules with filtering
 */
router.get('/', requireAdminAuth, async (req: AdminRequest, res: Response) => {
  try {
    // Get all alert rules (pagination could be added if needed)
    const result = await alertService.getAlertRules();

    // Log successful alert rules retrieval
    loggingService.info('Alert rules retrieved', {
      adminId: req.admin?.id,
      adminUsername: req.admin?.username,
      resultCount: result.rules.length,
    });

    res.json(result);
  } catch (error) {
    loggingService.error('Error retrieving alert rules', error as Error, {
      adminId: req.admin?.id,
    });

    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve alert rules'
    });
  }
});

/**
 * POST /api/monitoring/alerts/rules
 * Create a new alert rule
 */
router.post('/', requireAdminAuth, async (req: CreateAlertRuleRequest, res: Response) => {
  try {
    const {
      rule_name,
      metric_type,
      threshold_value,
      comparison_operator,
      notification_channels
    } = req.body;

    // Validate request body
    const validationErrors: Array<{ field: string; message: string }> = [];

    if (!rule_name || typeof rule_name !== 'string' || rule_name.trim().length === 0) {
      validationErrors.push({
        field: 'rule_name',
        message: 'Rule name is required and must be a non-empty string'
      });
    } else if (rule_name.length > 100) {
      validationErrors.push({
        field: 'rule_name',
        message: 'Rule name cannot exceed 100 characters'
      });
    }

    if (!metric_type || typeof metric_type !== 'string') {
      validationErrors.push({
        field: 'metric_type',
        message: 'Metric type is required'
      });
    }

    if (typeof threshold_value !== 'number' || threshold_value < 0) {
      validationErrors.push({
        field: 'threshold_value',
        message: 'Threshold value must be a non-negative number'
      });
    }

    if (!comparison_operator || !['>', '<', '>=', '<=', '='].includes(comparison_operator)) {
      validationErrors.push({
        field: 'comparison_operator',
        message: 'Invalid comparison operator'
      });
    }

    if (!Array.isArray(notification_channels) || notification_channels.length === 0) {
      validationErrors.push({
        field: 'notification_channels',
        message: 'At least one notification channel is required'
      });
    } else {
      const validChannels = ['email', 'dashboard', 'sms'];
      const invalidChannels = notification_channels.filter(channel => !validChannels.includes(channel));
      if (invalidChannels.length > 0) {
        validationErrors.push({
          field: 'notification_channels',
          message: `Invalid notification channels: ${invalidChannels.join(', ')}`
        });
      }
    }

    if (validationErrors.length > 0) {
      return res.status(422).json({
        error: 'Validation failed',
        details: validationErrors
      });
    }

    // Create alert rule using alert service
    const alertRule = await alertService.createAlertRule(req.body, req.admin!.id);

    // Log successful alert rule creation
    loggingService.info('Alert rule created', {
      adminId: req.admin?.id,
      adminUsername: req.admin?.username,
      ruleId: alertRule.id,
      ruleName: alertRule.rule_name,
    });

    res.status(201).json(alertRule);
  } catch (error) {
    loggingService.error('Error creating alert rule', error as Error, {
      adminId: req.admin?.id,
      body: req.body,
    });

    if (error instanceof ValidationError) {
      return res.status(422).json({
        error: 'Validation failed',
        details: [{
          field: 'general',
          message: error.message
        }]
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create alert rule'
    });
  }
});

/**
 * PUT /api/monitoring/alerts/rules/:rule_id
 * Update an existing alert rule
 */
router.put('/:rule_id', requireAdminAuth, async (req: UpdateAlertRuleRequest, res: Response) => {
  try {
    const { rule_id } = req.params;
    const updates = req.body;

    // Validate rule_id UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(rule_id)) {
      return res.status(422).json({
        error: 'Validation failed',
        details: [{
          field: 'rule_id',
          message: 'Invalid UUID format'
        }]
      });
    }

    // Validate update fields if provided
    const validationErrors: Array<{ field: string; message: string }> = [];

    if (updates.rule_name !== undefined) {
      if (typeof updates.rule_name !== 'string' || updates.rule_name.trim().length === 0) {
        validationErrors.push({
          field: 'rule_name',
          message: 'Rule name must be a non-empty string'
        });
      } else if (updates.rule_name.length > 100) {
        validationErrors.push({
          field: 'rule_name',
          message: 'Rule name cannot exceed 100 characters'
        });
      }
    }

    if (updates.threshold_value !== undefined) {
      if (typeof updates.threshold_value !== 'number' || updates.threshold_value < 0) {
        validationErrors.push({
          field: 'threshold_value',
          message: 'Threshold value must be a non-negative number'
        });
      }
    }

    if (updates.comparison_operator !== undefined) {
      if (!['>', '<', '>=', '<=', '='].includes(updates.comparison_operator)) {
        validationErrors.push({
          field: 'comparison_operator',
          message: 'Invalid comparison operator'
        });
      }
    }

    if (updates.notification_channels !== undefined) {
      if (!Array.isArray(updates.notification_channels)) {
        validationErrors.push({
          field: 'notification_channels',
          message: 'Notification channels must be an array'
        });
      } else {
        const validChannels = ['email', 'dashboard', 'sms'];
        const invalidChannels = updates.notification_channels.filter(channel => !validChannels.includes(channel));
        if (invalidChannels.length > 0) {
          validationErrors.push({
            field: 'notification_channels',
            message: `Invalid notification channels: ${invalidChannels.join(', ')}`
          });
        }
      }
    }

    if (updates.is_active !== undefined && typeof updates.is_active !== 'boolean') {
      validationErrors.push({
        field: 'is_active',
        message: 'is_active must be a boolean'
      });
    }

    if (validationErrors.length > 0) {
      return res.status(422).json({
        error: 'Validation failed',
        details: validationErrors
      });
    }

    try {
      // Update alert rule using alert service
      const updatedRule = await alertService.updateAlertRule(rule_id, updates, req.admin!.id);

      // Log successful alert rule update
      loggingService.info('Alert rule updated', {
        adminId: req.admin?.id,
        adminUsername: req.admin?.username,
        ruleId: rule_id,
        updates: Object.keys(updates),
      });

      res.json(updatedRule);
    } catch (serviceError: any) {
      if (serviceError instanceof NotFoundError ||
          (serviceError.message && serviceError.message.includes('not found'))) {
        return res.status(404).json({
          error: 'Alert rule not found',
          message: 'The specified alert rule could not be found'
        });
      }
      throw serviceError;
    }
  } catch (error) {
    loggingService.error('Error updating alert rule', error as Error, {
      adminId: req.admin?.id,
      ruleId: req.params.rule_id,
      body: req.body,
    });

    if (error instanceof ValidationError) {
      return res.status(422).json({
        error: 'Validation failed',
        details: [{
          field: 'general',
          message: error.message
        }]
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update alert rule'
    });
  }
});

/**
 * DELETE /api/monitoring/alerts/rules/:rule_id
 * Delete an alert rule (marks as inactive)
 */
router.delete('/:rule_id', requireAdminAuth, async (req: DeleteAlertRuleRequest, res: Response) => {
  try {
    const { rule_id } = req.params;

    // Validate rule_id UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(rule_id)) {
      return res.status(422).json({
        error: 'Validation failed',
        details: [{
          field: 'rule_id',
          message: 'Invalid UUID format'
        }]
      });
    }

    try {
      // Delete alert rule using alert service
      await alertService.deleteAlertRule(rule_id, req.admin!.id);

      // Log successful alert rule deletion
      loggingService.info('Alert rule deleted', {
        adminId: req.admin?.id,
        adminUsername: req.admin?.username,
        ruleId: rule_id,
      });

      res.status(204).send();
    } catch (serviceError: any) {
      if (serviceError instanceof NotFoundError ||
          (serviceError.message && serviceError.message.includes('not found'))) {
        return res.status(404).json({
          error: 'Alert rule not found',
          message: 'The specified alert rule could not be found'
        });
      }
      throw serviceError;
    }
  } catch (error) {
    loggingService.error('Error deleting alert rule', error as Error, {
      adminId: req.admin?.id,
      ruleId: req.params.rule_id,
    });

    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete alert rule'
    });
  }
});

export default router;