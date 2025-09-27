import { Router } from 'express';
import { z } from 'zod';
import { TestRunService } from '../../services/testing/test-run-service.js';
import { authenticateAdmin } from '../../middleware/admin-auth.js';

const router = Router();
const testRunService = new TestRunService();

// Validation schemas
const createTestRunSchema = z.object({
  triggerType: z.enum(['commit', 'pull-request', 'scheduled', 'manual']),
  triggerReference: z.string().min(1),
  branch: z.string().min(1),
  environmentId: z.string().min(1),
  suiteIds: z.array(z.string()).optional()
});

const querySchema = z.object({
  triggerType: z.enum(['commit', 'pull-request', 'scheduled', 'manual']).optional(),
  branch: z.string().optional(),
  status: z.enum(['pending', 'running', 'passed', 'failed', 'cancelled']).optional(),
  environmentId: z.string().optional(),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(20)
});

// GET /api/test/runs - List test runs with filtering and pagination
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const query = querySchema.parse(req.query);
    
    const filters = {
      triggerType: query.triggerType,
      branch: query.branch,
      status: query.status,
      environmentId: query.environmentId
    };

    const { runs, total } = await testRunService.getTestRuns(filters, {
      page: query.page,
      limit: query.limit
    });

    res.json({
      data: runs,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        pages: Math.ceil(total / query.limit)
      }
    });
  } catch (error) {
    console.error('Error fetching test runs:', error);
    res.status(500).json({ error: 'Failed to fetch test runs' });
  }
});

// POST /api/test/runs - Create and start new test run
router.post('/', authenticateAdmin, async (req, res) => {
  try {
    const runData = createTestRunSchema.parse(req.body);
    
    const run = await testRunService.createTestRun(runData);
    
    // Start test execution asynchronously
    testRunService.executeTestRun(run.id).catch(error => {
      console.error('Test run execution failed:', error);
    });
    
    res.status(201).json({
      data: run,
      message: 'Test run created and started successfully'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: error.errors 
      });
    }
    
    console.error('Error creating test run:', error);
    res.status(500).json({ error: 'Failed to create test run' });
  }
});

// GET /api/test/runs/:id - Get test run by ID with detailed results
router.get('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const run = await testRunService.getTestRunById(id);
    
    if (!run) {
      return res.status(404).json({ error: 'Test run not found' });
    }
    
    res.json({ data: run });
  } catch (error) {
    console.error('Error fetching test run:', error);
    res.status(500).json({ error: 'Failed to fetch test run' });
  }
});

// DELETE /api/test/runs/:id - Cancel test run
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const cancelled = await testRunService.cancelTestRun(id);
    
    if (!cancelled) {
      return res.status(404).json({ error: 'Test run not found or cannot be cancelled' });
    }
    
    res.json({ message: 'Test run cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling test run:', error);
    res.status(500).json({ error: 'Failed to cancel test run' });
  }
});

export default router;