import { Request, Response, NextFunction } from 'express';
import { QuestionCombinationEngine } from '../../services/questions/combination-engine';
import {
  getQuestionCombinationRules,
  createQuestionCombinationRule,
  updateQuestionCombinationRule,
  deleteQuestionCombinationRule
} from '@vocilia/database/questions/combination-rules';
import { loggingService } from '../../services/loggingService';
import { ValidationError, NotFoundError, AuthenticationError } from '../../middleware/errorHandler';

export interface CombinationRuleRequest extends Request {
  body: {
    ruleName?: string;
    maxCallDurationSeconds?: number;
    priorityThresholds?: {
      critical?: number;
      high?: number;
      medium?: number;
      low?: number;
    };
    isActive?: boolean;
    optimizationStrategy?: 'greedy' | 'dynamic_programming' | 'weighted_selection' | 'time_based_priority';
  };
  params: {
    ruleId?: string;
  };
  query: {
    isActive?: string;
    limit?: string;
    offset?: string;
  };
}

/**
 * GET /api/questions/combinations/rules
 * List all combination rules for the authenticated business
 */
export async function getCombinationRules(
  req: CombinationRuleRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const businessId = req.user?.businessId;
    if (!businessId) {
      throw new AuthenticationError('Business ID required');
    }

    const filters: any = {};
    if (req.query.isActive !== undefined) {
      filters.isActive = req.query.isActive === 'true';
    }

    const limit = req.query.limit ? parseInt(req.query.limit, 10) : undefined;
    const offset = req.query.offset ? parseInt(req.query.offset, 10) : undefined;

    const rules = await getQuestionCombinationRules(businessId, filters, limit, offset);

    await loggingService.logInfo('Combination rules retrieved', {
      businessId,
      rulesCount: rules.length,
      filters,
      userId: req.user?.id
    });

    res.json({
      success: true,
      data: rules,
      pagination: {
        limit,
        offset,
        total: rules.length
      }
    });

  } catch (error) {
    await loggingService.logError('Failed to retrieve combination rules', {
      businessId: req.user?.businessId,
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id
    });
    next(error);
  }
}

/**
 * POST /api/questions/combinations/rules
 * Create a new combination rule
 */
export async function createCombinationRule(
  req: CombinationRuleRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const businessId = req.user?.businessId;
    if (!businessId) {
      throw new AuthenticationError('Business ID required');
    }

    const {
      ruleName,
      maxCallDurationSeconds,
      priorityThresholds,
      isActive = true,
      optimizationStrategy = 'weighted_selection'
    } = req.body;

    // Validation
    if (!ruleName || typeof ruleName !== 'string' || ruleName.trim().length === 0) {
      throw new ValidationError('Rule name is required and must be a non-empty string');
    }

    if (!maxCallDurationSeconds || typeof maxCallDurationSeconds !== 'number' || maxCallDurationSeconds <= 0) {
      throw new ValidationError('Max call duration must be a positive number');
    }

    if (maxCallDurationSeconds > 300) { // 5 minutes maximum
      throw new ValidationError('Max call duration cannot exceed 300 seconds');
    }

    if (!priorityThresholds || typeof priorityThresholds !== 'object') {
      throw new ValidationError('Priority thresholds are required');
    }

    const requiredThresholds = ['critical', 'high', 'medium', 'low'];
    for (const threshold of requiredThresholds) {
      if (!(threshold in priorityThresholds) || typeof priorityThresholds[threshold as keyof typeof priorityThresholds] !== 'number') {
        throw new ValidationError(`Priority threshold '${threshold}' is required and must be a number`);
      }
    }

    // Create combination rule using service
    const combinationEngine = new QuestionCombinationEngine(businessId, loggingService);
    const newRule = await combinationEngine.createCombinationRule({
      ruleName: ruleName.trim(),
      maxCallDurationSeconds,
      priorityThresholds: {
        critical: priorityThresholds.critical!,
        high: priorityThresholds.high!,
        medium: priorityThresholds.medium!,
        low: priorityThresholds.low!
      }
    });

    // Update activation status if needed
    if (!isActive) {
      await updateQuestionCombinationRule(newRule.id, { is_active: false });
      newRule.is_active = false;
    }

    await loggingService.logInfo('Combination rule created', {
      businessId,
      ruleId: newRule.id,
      ruleName,
      maxCallDurationSeconds,
      userId: req.user?.id
    });

    res.status(201).json({
      success: true,
      data: newRule,
      message: 'Combination rule created successfully'
    });

  } catch (error) {
    await loggingService.logError('Failed to create combination rule', {
      businessId: req.user?.businessId,
      error: error instanceof Error ? error.message : 'Unknown error',
      requestBody: req.body,
      userId: req.user?.id
    });
    next(error);
  }
}

/**
 * PUT /api/questions/combinations/rules/:ruleId
 * Update an existing combination rule
 */
export async function updateCombinationRule(
  req: CombinationRuleRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const businessId = req.user?.businessId;
    const ruleId = req.params.ruleId;

    if (!businessId) {
      throw new AuthenticationError('Business ID required');
    }

    if (!ruleId) {
      throw new ValidationError('Rule ID is required');
    }

    const {
      ruleName,
      maxCallDurationSeconds,
      priorityThresholds,
      isActive
    } = req.body;

    // Validate that the rule exists and belongs to the business
    const existingRules = await getQuestionCombinationRules(businessId);
    const existingRule = existingRules.find(rule => rule.id === ruleId);

    if (!existingRule) {
      throw new NotFoundError('Combination rule not found');
    }

    // Validate updates
    const updates: any = {};

    if (ruleName !== undefined) {
      if (typeof ruleName !== 'string' || ruleName.trim().length === 0) {
        throw new ValidationError('Rule name must be a non-empty string');
      }
      updates.ruleName = ruleName.trim();
    }

    if (maxCallDurationSeconds !== undefined) {
      if (typeof maxCallDurationSeconds !== 'number' || maxCallDurationSeconds <= 0) {
        throw new ValidationError('Max call duration must be a positive number');
      }
      if (maxCallDurationSeconds > 300) {
        throw new ValidationError('Max call duration cannot exceed 300 seconds');
      }
      updates.maxCallDurationSeconds = maxCallDurationSeconds;
    }

    if (priorityThresholds !== undefined) {
      if (typeof priorityThresholds !== 'object') {
        throw new ValidationError('Priority thresholds must be an object');
      }

      const validatedThresholds: any = {};
      const thresholdKeys = ['critical', 'high', 'medium', 'low'];
      
      for (const key of thresholdKeys) {
        if (key in priorityThresholds) {
          if (typeof priorityThresholds[key as keyof typeof priorityThresholds] !== 'number') {
            throw new ValidationError(`Priority threshold '${key}' must be a number`);
          }
          validatedThresholds[key] = priorityThresholds[key as keyof typeof priorityThresholds];
        }
      }

      if (Object.keys(validatedThresholds).length > 0) {
        updates.priorityThresholds = validatedThresholds;
      }
    }

    if (isActive !== undefined) {
      if (typeof isActive !== 'boolean') {
        throw new ValidationError('isActive must be a boolean');
      }
      updates.isActive = isActive;
    }

    if (Object.keys(updates).length === 0) {
      throw new ValidationError('No valid updates provided');
    }

    // Update using service
    const combinationEngine = new QuestionCombinationEngine(businessId, loggingService);
    const updatedRule = await combinationEngine.updateCombinationRule(ruleId, updates);

    await loggingService.logInfo('Combination rule updated', {
      businessId,
      ruleId,
      updates,
      userId: req.user?.id
    });

    res.json({
      success: true,
      data: updatedRule,
      message: 'Combination rule updated successfully'
    });

  } catch (error) {
    await loggingService.logError('Failed to update combination rule', {
      businessId: req.user?.businessId,
      ruleId: req.params.ruleId,
      error: error instanceof Error ? error.message : 'Unknown error',
      requestBody: req.body,
      userId: req.user?.id
    });
    next(error);
  }
}

/**
 * DELETE /api/questions/combinations/rules/:ruleId
 * Delete a combination rule
 */
export async function deleteCombinationRule(
  req: CombinationRuleRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const businessId = req.user?.businessId;
    const ruleId = req.params.ruleId;

    if (!businessId) {
      throw new AuthenticationError('Business ID required');
    }

    if (!ruleId) {
      throw new ValidationError('Rule ID is required');
    }

    // Validate that the rule exists and belongs to the business
    const existingRules = await getQuestionCombinationRules(businessId);
    const existingRule = existingRules.find(rule => rule.id === ruleId);

    if (!existingRule) {
      throw new NotFoundError('Combination rule not found');
    }

    // Check if this is the only active rule (prevent deletion)
    const activeRules = existingRules.filter(rule => rule.is_active);
    if (activeRules.length === 1 && existingRule.is_active) {
      throw new ValidationError('Cannot delete the last active combination rule. Create another active rule first.');
    }

    // Delete the rule
    await deleteQuestionCombinationRule(ruleId);

    await loggingService.logInfo('Combination rule deleted', {
      businessId,
      ruleId,
      ruleName: existingRule.rule_name,
      userId: req.user?.id
    });

    res.json({
      success: true,
      message: 'Combination rule deleted successfully'
    });

  } catch (error) {
    await loggingService.logError('Failed to delete combination rule', {
      businessId: req.user?.businessId,
      ruleId: req.params.ruleId,
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id
    });
    next(error);
  }
}

/**
 * POST /api/questions/combinations/rules/:ruleId/test
 * Test a combination rule with sample data
 */
export async function testCombinationRule(
  req: CombinationRuleRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const businessId = req.user?.businessId;
    const ruleId = req.params.ruleId;

    if (!businessId) {
      throw new AuthenticationError('Business ID required');
    }

    if (!ruleId) {
      throw new ValidationError('Rule ID is required');
    }

    // Validate that the rule exists
    const existingRules = await getQuestionCombinationRules(businessId);
    const existingRule = existingRules.find(rule => rule.id === ruleId);

    if (!existingRule) {
      throw new NotFoundError('Combination rule not found');
    }

    // Run performance validation
    const combinationEngine = new QuestionCombinationEngine(businessId, loggingService);
    const isPerformant = await combinationEngine.validatePerformanceRequirement();

    const testResult = {
      ruleId,
      ruleName: existingRule.rule_name,
      performanceTest: {
        meetsRequirement: isPerformant,
        threshold: '500ms',
        status: isPerformant ? 'PASS' : 'FAIL'
      },
      ruleConfiguration: {
        maxDuration: existingRule.max_call_duration_seconds,
        priorityThresholds: {
          critical: existingRule.priority_threshold_critical,
          high: existingRule.priority_threshold_high,
          medium: existingRule.priority_threshold_medium,
          low: existingRule.priority_threshold_low
        },
        isActive: existingRule.is_active
      }
    };

    await loggingService.logInfo('Combination rule tested', {
      businessId,
      ruleId,
      testResult,
      userId: req.user?.id
    });

    res.json({
      success: true,
      data: testResult,
      message: 'Combination rule test completed'
    });

  } catch (error) {
    await loggingService.logError('Failed to test combination rule', {
      businessId: req.user?.businessId,
      ruleId: req.params.ruleId,
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id
    });
    next(error);
  }
}