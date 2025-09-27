import { Router } from 'express';
import { z } from 'zod';
import { TestSuiteService } from '../../services/testing/test-suite-service.js';
import { authenticateAdmin } from '../../middleware/admin-auth.js';

const router = Router();
const testSuiteService = new TestSuiteService();

// Validation schemas
const createTestSuiteSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['unit', 'integration', 'e2e', 'performance']),
  component: z.string().min(1).max(255),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  coverageTarget: z.number().min(0).max(100),
  enabled: z.boolean().optional().default(true)
});

const updateTestSuiteSchema = createTestSuiteSchema.partial();

const querySchema = z.object({
  type: z.enum(['unit', 'integration', 'e2e', 'performance']).optional(),
  component: z.string().optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  enabled: z.boolean().optional(),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(20)
});

// GET /api/test/suites - List test suites with filtering and pagination
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const query = querySchema.parse(req.query);
    
    const filters = {
      type: query.type,
      component: query.component,
      priority: query.priority,
      enabled: query.enabled
    };

    const { suites, total } = await testSuiteService.getTestSuites(filters, {
      page: query.page,
      limit: query.limit
    });

    res.json({
      data: suites,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        pages: Math.ceil(total / query.limit)
      }
    });
  } catch (error) {
    console.error('Error fetching test suites:', error);
    res.status(500).json({ error: 'Failed to fetch test suites' });
  }
});

// POST /api/test/suites - Create new test suite
router.post('/', authenticateAdmin, async (req, res) => {
  try {
    const suiteData = createTestSuiteSchema.parse(req.body);
    
    const suite = await testSuiteService.createTestSuite(suiteData);
    
    res.status(201).json({
      data: suite,
      message: 'Test suite created successfully'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: error.errors 
      });
    }
    
    console.error('Error creating test suite:', error);
    res.status(500).json({ error: 'Failed to create test suite' });
  }
});

// GET /api/test/suites/:id - Get test suite by ID
router.get('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const suite = await testSuiteService.getTestSuiteById(id);
    
    if (!suite) {
      return res.status(404).json({ error: 'Test suite not found' });
    }
    
    res.json({ data: suite });
  } catch (error) {
    console.error('Error fetching test suite:', error);
    res.status(500).json({ error: 'Failed to fetch test suite' });
  }
});

// PUT /api/test/suites/:id - Update test suite
router.put('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = updateTestSuiteSchema.parse(req.body);
    
    const suite = await testSuiteService.updateTestSuite(id, updateData);
    
    if (!suite) {
      return res.status(404).json({ error: 'Test suite not found' });
    }
    
    res.json({
      data: suite,
      message: 'Test suite updated successfully'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: error.errors 
      });
    }
    
    console.error('Error updating test suite:', error);
    res.status(500).json({ error: 'Failed to update test suite' });
  }
});

export default router;