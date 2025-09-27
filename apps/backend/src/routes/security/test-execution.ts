/**
 * Security Test Execution API Endpoints
 *
 * @description POST /api/security/test-suites/{suiteId}/execute endpoint for executing security test suites
 * @constitutional_requirement Admin-only access, ≤10% performance limit enforcement, TypeScript strict
 * @performance_target <2s for test execution initiation
 */

import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { SecurityTestingService } from '../../services/security/SecurityTestingService';
import { adminAuthMiddleware } from '../../middleware/admin-auth';
import { errorHandler } from '../../middleware/error-handler';
import { auditLogger } from '../../services/audit/auditLogger';

const router = Router();

// Input validation schemas
const ExecuteTestSuiteParamsSchema = z.object({
  suiteId: z.string().uuid('Suite ID must be a valid UUID')
});

const ExecuteTestSuiteBodySchema = z.object({
  performance_limit: z.number()
    .min(1, 'Performance limit must be at least 1%')
    .max(10, 'Performance limit cannot exceed 10% (constitutional requirement)'),
  target_environment: z.enum(['staging', 'production']),
  notification_settings: z.object({
    email_alerts: z.boolean(),
    slack_webhook: z.string().url().optional()
  }).optional()
});

/**
 * POST /api/security/test-suites/{suiteId}/execute
 *
 * Executes a specific security test suite with performance monitoring
 * Enforces constitutional ≤10% performance limit
 */
router.post('/test-suites/:suiteId/execute', adminAuthMiddleware, async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    // Validate parameters and body
    const params = ExecuteTestSuiteParamsSchema.parse(req.params);
    const body = ExecuteTestSuiteBodySchema.parse(req.body);

    // Constitutional enforcement: Performance limit ≤10%
    if (body.performance_limit > 10) {
      return res.status(400).json({
        error: 'Performance limit exceeds constitutional requirement',
        details: ['Performance limit must be ≤10% to comply with constitutional requirements']
      });
    }

    // Validate Slack webhook URL format if provided
    if (body.notification_settings?.slack_webhook) {
      try {
        new URL(body.notification_settings.slack_webhook);
        if (!body.notification_settings.slack_webhook.includes('hooks.slack.com')) {
          return res.status(400).json({
            error: 'Invalid Slack webhook URL format',
            details: ['Slack webhook must be a valid hooks.slack.com URL']
          });
        }
      } catch {
        return res.status(400).json({
          error: 'Invalid Slack webhook URL format',
          details: ['Slack webhook must be a valid URL']
        });
      }
    }

    // Audit log the security test execution initiation
    await auditLogger.logSecurityTestExecution({
      admin_id: req.user?.id || 'unknown',
      action: 'initiate_security_test_execution',
      suite_id: params.suiteId,
      performance_limit: body.performance_limit,
      target_environment: body.target_environment,
      timestamp: new Date().toISOString(),
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });

    // Get security testing service instance
    const securityTestingService = new SecurityTestingService();

    // Check if test suite exists
    const testSuite = await securityTestingService.getTestSuite(params.suiteId);
    if (!testSuite) {
      return res.status(404).json({
        error: 'Test suite not found',
        resource_id: params.suiteId
      });
    }

    // Initiate test suite execution
    const executionResult = await securityTestingService.executeTestSuite({
      suite_id: params.suiteId,
      performance_limit: body.performance_limit,
      target_environment: body.target_environment,
      notification_settings: body.notification_settings,
      initiated_by: req.user?.id || 'unknown'
    });

    // Validate response time for execution initiation
    const responseTime = Date.now() - startTime;
    if (responseTime > 2000) {
      console.warn(`Security test execution initiation exceeded 2s: ${responseTime}ms`);
    }

    // Return execution response according to contract (202 Accepted for async processing)
    res.status(202).json({
      execution_id: executionResult.execution_id,
      estimated_duration: executionResult.estimated_duration,
      status: executionResult.status
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request parameters or body',
        details: error.errors.map(err => {
          if (err.path.includes('suiteId')) {
            return 'suiteId: Must be a valid UUID format';
          }
          if (err.path.includes('performance_limit')) {
            return `performance_limit: ${err.message}`;
          }
          if (err.path.includes('target_environment')) {
            return 'target_environment: Must be either "staging" or "production"';
          }
          return `${err.path.join('.')}: ${err.message}`;
        })
      });
    }

    // Log security test execution errors
    await auditLogger.logSecurityEvent({
      event_type: 'security_test_execution_error',
      admin_id: req.user?.id || 'unknown',
      suite_id: req.params.suiteId,
      error_message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      ip_address: req.ip
    });

    throw error; // Let error handler middleware handle it
  }
});

export default router;