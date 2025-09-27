/**
 * Security Vulnerabilities API Endpoints
 *
 * @description GET /api/security/vulnerabilities endpoint for listing discovered vulnerabilities
 * @constitutional_requirement Admin-only access, risk assessment tracking, TypeScript strict
 * @performance_target <500ms response time, <2s for large result sets
 */

import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { VulnerabilityAssessmentService } from '../../services/security/VulnerabilityAssessmentService';
import { adminAuthMiddleware } from '../../middleware/admin-auth';
import { errorHandler } from '../../middleware/error-handler';
import { auditLogger } from '../../services/audit/auditLogger';

const router = Router();

// Input validation schemas
const GetVulnerabilitiesQuerySchema = z.object({
  severity: z.enum(['critical', 'high', 'medium', 'low', 'info']).optional(),
  status: z.enum(['open', 'in_progress', 'fixed', 'accepted', 'wont_fix']).optional(),
  component: z.string().min(1).max(100).optional(),
  page: z.coerce.number().min(1).default(1).optional(),
  limit: z.coerce.number().min(1).max(100).default(20).optional()
});

/**
 * GET /api/security/vulnerabilities
 *
 * Lists discovered vulnerabilities with filtering and pagination
 * Includes risk assessment and remediation tracking
 */
router.get('/vulnerabilities', adminAuthMiddleware, async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    // Validate query parameters
    const query = GetVulnerabilitiesQuerySchema.parse(req.query);

    // Audit log the vulnerability data access
    await auditLogger.logVulnerabilityAccess({
      admin_id: req.user?.id || 'unknown',
      action: 'list_vulnerabilities',
      severity_filter: query.severity,
      status_filter: query.status,
      component_filter: query.component,
      timestamp: new Date().toISOString(),
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });

    // Get vulnerability assessment service instance
    const vulnerabilityService = new VulnerabilityAssessmentService();

    // Retrieve vulnerabilities with filtering
    const result = await vulnerabilityService.getVulnerabilities({
      severity: query.severity,
      status: query.status,
      component: query.component,
      page: query.page || 1,
      limit: query.limit || 20
    });

    // Validate constitutional performance requirement
    const responseTime = Date.now() - startTime;
    const isLargeResultSet = (query.limit || 20) > 50;
    const performanceLimit = isLargeResultSet ? 2000 : 500;

    if (responseTime > performanceLimit) {
      console.warn(`Vulnerabilities endpoint exceeded ${performanceLimit}ms: ${responseTime}ms`);
    }

    // Format vulnerabilities according to contract
    const formattedVulnerabilities = result.vulnerabilities.map(vuln => {
      // Calculate remediation deadline based on constitutional requirements
      let remediationDeadline: string | undefined;
      if (vuln.remediation_status === 'open' || vuln.remediation_status === 'in_progress') {
        const discoveryDate = new Date(vuln.discovery_date);
        let hoursToAdd: number;

        switch (vuln.severity) {
          case 'critical':
            hoursToAdd = 24; // 24 hours for critical (constitutional requirement)
            break;
          case 'high':
            hoursToAdd = 72; // 72 hours for high (constitutional requirement)
            break;
          case 'medium':
            hoursToAdd = 168; // 1 week for medium
            break;
          case 'low':
            hoursToAdd = 720; // 30 days for low
            break;
          default:
            hoursToAdd = 720; // Default 30 days
        }

        remediationDeadline = new Date(
          discoveryDate.getTime() + (hoursToAdd * 60 * 60 * 1000)
        ).toISOString();
      }

      return {
        id: vuln.id,
        type: vuln.vulnerability_type,
        severity: vuln.severity,
        cve_reference: vuln.cve_reference,
        title: vuln.title || `${vuln.vulnerability_type} in ${vuln.affected_component}`,
        description: vuln.description,
        affected_component: vuln.affected_component,
        discovery_date: vuln.discovery_date,
        remediation_status: vuln.remediation_status,
        remediation_deadline: remediationDeadline,
        risk_score: vuln.risk_score
      };
    });

    // Return formatted response according to contract
    res.status(200).json({
      vulnerabilities: formattedVulnerabilities,
      pagination: {
        page: query.page || 1,
        limit: query.limit || 20,
        total: result.total_count,
        has_next: ((query.page || 1) * (query.limit || 20)) < result.total_count
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorField = error.errors[0]?.path[0];
      let errorMessage = 'Invalid query parameters';

      if (errorField === 'severity') {
        errorMessage = 'Invalid severity value. Must be one of: critical, high, medium, low, info';
      } else if (errorField === 'status') {
        errorMessage = 'Invalid status value. Must be one of: open, in_progress, fixed, accepted, wont_fix';
      }

      return res.status(400).json({
        error: errorMessage,
        details: error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
      });
    }

    // Log vulnerability access errors
    await auditLogger.logSecurityEvent({
      event_type: 'vulnerability_access_error',
      admin_id: req.user?.id || 'unknown',
      error_message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      ip_address: req.ip
    });

    throw error; // Let error handler middleware handle it
  }
});

export default router;