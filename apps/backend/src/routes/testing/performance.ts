import { Router } from 'express';
import { z } from 'zod';
import { PerformanceService } from '../../services/testing/performance-service.js';
import { authenticateAdmin } from '../../middleware/admin-auth.js';

const router = Router();
const performanceService = new PerformanceService();

// Validation schemas
const createBenchmarkSchema = z.object({
  operation: z.string().min(1).max(255),
  component: z.string().min(1).max(255),
  metric: z.enum(['response-time', 'page-load', 'throughput', 'error-rate']),
  target: z.number().positive(),
  unit: z.string().min(1).max(50),
  threshold: z.object({
    warning: z.number().positive(),
    critical: z.number().positive()
  }),
  environment: z.string().min(1).max(100),
  enabled: z.boolean().optional().default(true)
});

const querySchema = z.object({
  component: z.string().optional(),
  metric: z.enum(['response-time', 'page-load', 'throughput', 'error-rate']).optional(),
  environment: z.string().optional(),
  enabled: z.boolean().optional(),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(20)
});

// GET /api/test/performance/benchmarks - List performance benchmarks
router.get('/benchmarks', authenticateAdmin, async (req, res) => {
  try {
    const query = querySchema.parse(req.query);
    
    const filters = {
      component: query.component,
      metric: query.metric,
      environment: query.environment,
      enabled: query.enabled
    };

    const { benchmarks, total } = await performanceService.getBenchmarks(filters, {
      page: query.page,
      limit: query.limit
    });

    res.json({
      data: benchmarks,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        pages: Math.ceil(total / query.limit)
      }
    });
  } catch (error) {
    console.error('Error fetching performance benchmarks:', error);
    res.status(500).json({ error: 'Failed to fetch performance benchmarks' });
  }
});

// POST /api/test/performance/benchmarks - Create performance benchmark
router.post('/benchmarks', authenticateAdmin, async (req, res) => {
  try {
    const benchmarkData = createBenchmarkSchema.parse(req.body);
    
    // Validate threshold values
    if (benchmarkData.threshold.warning >= benchmarkData.threshold.critical) {
      return res.status(400).json({ 
        error: 'Warning threshold must be less than critical threshold' 
      });
    }
    
    const benchmark = await performanceService.createBenchmark(benchmarkData);
    
    res.status(201).json({
      data: benchmark,
      message: 'Performance benchmark created successfully'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: error.errors 
      });
    }
    
    console.error('Error creating performance benchmark:', error);
    res.status(500).json({ error: 'Failed to create performance benchmark' });
  }
});

export default router;