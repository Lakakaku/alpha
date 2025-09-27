/**
 * Security Test Execution Status API Endpoints
 *
 * @description GET /api/security/executions/{executionId} endpoint for monitoring test execution progress
 * @constitutional_requirement Admin-only access, real-time status tracking, TypeScript strict
 * @performance_target <500ms response time for status queries
 */

import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { SecurityTestingService } from '../../services/security/SecurityTestingService';
import { adminAuthMiddleware } from '../../middleware/admin-auth';
import { errorHandler } from '../../middleware/error-handler';
import { auditLogger } from '../../services/audit/auditLogger';

const router = Router();

// Input validation schemas
const GetExecutionStatusParamsSchema = z.object({
  executionId: z.string().uuid('Execution ID must be a valid UUID')
});

/**
 * GET /api/security/executions/{executionId}
 *
 * Retrieves current status and results of a security test execution
 * Provides real-time progress monitoring for admin users
 */
router.get('/executions/:executionId', adminAuthMiddleware, async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    // Validate execution ID parameter
    const params = GetExecutionStatusParamsSchema.parse(req.params);

    // Audit log the execution status query
    await auditLogger.logSecurityTestStatusQuery({
      admin_id: req.user?.id || 'unknown',
      action: 'query_security_test_execution_status',
      execution_id: params.executionId,
      timestamp: new Date().toISOString(),
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });

    // Get security testing service instance
    const securityTestingService = new SecurityTestingService();

    // Retrieve execution status and details
    const execution = await securityTestingService.getExecutionStatus(params.executionId);

    if (!execution) {
      return res.status(404).json({
        error: 'Test execution not found',
        resource_id: params.executionId
      });
    }

    // Validate constitutional performance requirement (<500ms)
    const responseTime = Date.now() - startTime;
    if (responseTime > 500) {
      console.warn(`Security execution status endpoint exceeded 500ms: ${responseTime}ms`);
    }

    // Format response according to contract
    const response: any = {
      id: execution.execution_id,
      suite_id: execution.test_suite_id,
      status: execution.status,
      started_at: execution.started_at,
      performance_impact: execution.performance_impact.total_overhead_percent
    };

    // Include completion timestamp for finished executions
    if (execution.status === 'completed' || execution.status === 'failed' || execution.status === 'cancelled') {
      response.completed_at = execution.completed_at;
    }

    // Include test results for completed executions
    if (execution.status === 'completed') {
      response.test_results = execution.test_results ? Object.keys(execution.test_results).map(testId => ({
        test_id: testId,
        test_name: execution.test_results[testId].test_name,
        status: execution.test_results[testId].status,
        execution_time: execution.test_results[testId].execution_time,
        attack_vector: execution.test_results[testId].attack_vector,
        expected_defense: execution.test_results[testId].expected_defense,
        actual_result: execution.test_results[testId].actual_result,
        error_message: execution.test_results[testId].error_message,
        artifacts: execution.test_results[testId].artifacts || []
      })) : [];

      // Include execution summary
      response.summary = {
        total_tests: execution.test_results.total_tests,
        passed: execution.test_results.passed_tests,
        failed: execution.test_results.failed_tests,
        skipped: execution.test_results.skipped_tests
      };
    }

    // Include running test progress for active executions
    if (execution.status === 'running' && execution.test_results) {
      response.test_results = execution.test_results ? Object.keys(execution.test_results).map(testId => ({
        test_id: testId,
        test_name: execution.test_results[testId].test_name,
        status: execution.test_results[testId].status,
        execution_time: execution.test_results[testId].execution_time || 0,
        attack_vector: execution.test_results[testId].attack_vector,
        expected_defense: execution.test_results[testId].expected_defense,
        actual_result: execution.test_results[testId].actual_result || 'In progress...'
      })) : [];
    }

    res.status(200).json(response);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid execution ID format',
        details: ['executionId: Must be a valid UUID format']
      });
    }

    // Log security test status query errors
    await auditLogger.logSecurityEvent({
      event_type: 'security_test_status_query_error',
      admin_id: req.user?.id || 'unknown',
      execution_id: req.params.executionId,
      error_message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      ip_address: req.ip
    });

    throw error; // Let error handler middleware handle it
  }
});

export default router;