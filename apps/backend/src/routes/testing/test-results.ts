import { Router } from 'express';
import { z } from 'zod';
import { TestRunService } from '../../services/testing/test-run-service.js';
import { authenticateAdmin } from '../../middleware/admin-auth.js';

const router = Router();
const testRunService = new TestRunService();

// Validation schemas
const querySchema = z.object({
  status: z.enum(['passed', 'failed', 'skipped', 'timeout', 'error']).optional(),
  suiteId: z.string().optional(),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(50)
});

// GET /api/test/runs/:id/results - Get test results for a specific run
router.get('/:id/results', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const query = querySchema.parse(req.query);
    
    // First verify the test run exists
    const run = await testRunService.getTestRunById(id);
    if (!run) {
      return res.status(404).json({ error: 'Test run not found' });
    }
    
    const filters = {
      status: query.status,
      suiteId: query.suiteId
    };

    const { results, total } = await testRunService.getTestResults(id, filters, {
      page: query.page,
      limit: query.limit
    });

    // Calculate summary statistics
    const summary = {
      total: results.length,
      passed: results.filter(r => r.status === 'passed').length,
      failed: results.filter(r => r.status === 'failed').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      timeout: results.filter(r => r.status === 'timeout').length,
      error: results.filter(r => r.status === 'error').length
    };

    res.json({
      data: results,
      summary,
      testRun: {
        id: run.id,
        status: run.status,
        branch: run.branch,
        duration: run.duration
      },
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        pages: Math.ceil(total / query.limit)
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: error.errors 
      });
    }
    
    console.error('Error fetching test results:', error);
    res.status(500).json({ error: 'Failed to fetch test results' });
  }
});

export default router;