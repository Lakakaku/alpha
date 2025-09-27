/**
 * Security Test Suites API Endpoints
 *
 * @description GET /api/security/test-suites endpoint for listing security test suites
 * @constitutional_requirement Admin-only access, performance monitoring, TypeScript strict
 * @performance_target <500ms response time for CRUD operations
 */

import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { SecurityTestingService } from '../../services/security/SecurityTestingService';
import { adminAuthMiddleware } from '../../middleware/admin-auth';
import { errorHandler } from '../../middleware/error-handler';
import { auditLogger } from '../../services/audit/auditLogger';

const router = Router();

// Input validation schemas
const GetTestSuitesQuerySchema = z.object({
  category: z.enum(['authentication', 'authorization', 'privacy', 'gdpr', 'vulnerability', 'fraud']).optional(),
  status: z.enum(['active', 'maintenance', 'deprecated']).optional(),
  page: z.coerce.number().min(1).default(1).optional(),
  limit: z.coerce.number().min(1).max(100).default(20).optional()
});

/**
 * GET /api/security/test-suites
 *
 * Lists all available security test suites with filtering and pagination
 * Requires admin authentication per constitutional requirements
 */
router.get('/test-suites', adminAuthMiddleware, async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    // Validate query parameters
    const query = GetTestSuitesQuerySchema.parse(req.query);

    // Audit log the security test access
    await auditLogger.logSecurityTestAccess({
      admin_id: req.user?.id || 'unknown',
      action: 'list_security_test_suites',
      category_filter: query.category,
      status_filter: query.status,
      timestamp: new Date().toISOString(),
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });

    // Get security testing service instance
    const securityTestingService = new SecurityTestingService();

    // Retrieve test suites with filtering
    const result = await securityTestingService.getTestSuites({
      category: query.category,
      status: query.status,
      page: query.page || 1,
      limit: query.limit || 20
    });

    // Validate constitutional performance requirement (<500ms)
    const responseTime = Date.now() - startTime;
    if (responseTime > 500) {
      console.warn(`Security test suites endpoint exceeded 500ms: ${responseTime}ms`);
    }

    // Return formatted response according to contract
    res.status(200).json({
      test_suites: result.test_suites.map(suite => ({
        id: suite.id,
        name: suite.name,
        description: suite.description,
        category: suite.category,
        test_count: suite.test_count,
        estimated_duration: suite.estimated_duration,
        last_execution: suite.last_execution,
        status: suite.status
      })),
      total_count: result.total_count,
      pagination: {
        page: query.page || 1,
        limit: query.limit || 20,
        total: result.total_count,
        has_next: ((query.page || 1) * (query.limit || 20)) < result.total_count
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
      });
    }

    // Log security test access errors
    await auditLogger.logSecurityEvent({
      event_type: 'security_test_access_error',
      admin_id: req.user?.id || 'unknown',
      error_message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      ip_address: req.ip
    });

    throw error; // Let error handler middleware handle it
  }
});

export default router;