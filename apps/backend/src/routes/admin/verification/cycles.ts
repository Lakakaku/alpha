import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { VerificationCycleService } from '../../../services/verification/verificationCycleService';
import { adminAuthMiddleware } from '../../../middleware/admin-auth';
import { validateRequest } from '../../../middleware/request-validation';

const router = Router();
const verificationCycleService = new VerificationCycleService();

// Validation schemas
const createCycleSchema = z.object({
  body: z.object({
    cycle_week: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format, expected YYYY-MM-DD')
  })
});

const listCyclesSchema = z.object({
  query: z.object({
    page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
    limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 20),
    status: z.enum(['preparing', 'ready', 'distributed', 'collecting', 'processing', 'invoicing', 'completed', 'expired']).optional()
  })
});

// Apply admin authentication to all routes
router.use(adminAuthMiddleware);

/**
 * GET /api/admin/verification/cycles
 * List verification cycles with pagination and filtering
 */
router.get('/', validateRequest(listCyclesSchema), async (req: Request, res: Response) => {
  try {
    const { page, limit, status } = req.query as any;

    const result = await verificationCycleService.listCycles({
      page,
      limit,
      status
    });

    res.json({
      cycles: result.cycles,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        total_pages: result.totalPages
      }
    });
  } catch (error) {
    console.error('Error listing verification cycles:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to list verification cycles'
    });
  }
});

/**
 * POST /api/admin/verification/cycles
 * Create a new weekly verification cycle
 */
router.post('/', validateRequest(createCycleSchema), async (req: Request, res: Response) => {
  try {
    const { cycle_week } = req.body;
    const adminId = req.user?.id;

    if (!adminId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Admin ID not found in request'
      });
    }

    // Validate that cycle_week is a Monday
    const cycleDate = new Date(cycle_week);
    if (cycleDate.getDay() !== 1) {
      return res.status(400).json({
        error: 'Invalid cycle week',
        message: 'Cycle week must be a Monday'
      });
    }

    // Check if cycle already exists for this week
    const existingCycle = await verificationCycleService.getCycleByWeek(cycle_week);
    if (existingCycle) {
      return res.status(409).json({
        error: 'Cycle already exists',
        message: `Verification cycle already exists for week ${cycle_week}`
      });
    }

    const cycle = await verificationCycleService.createCycle({
      cycle_week,
      created_by: adminId
    });

    res.status(201).json(cycle);
  } catch (error) {
    console.error('Error creating verification cycle:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create verification cycle'
    });
  }
});

/**
 * GET /api/admin/verification/cycles/:id
 * Get details of a specific verification cycle
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        error: 'Invalid ID format',
        message: 'Cycle ID must be a valid UUID'
      });
    }

    const cycle = await verificationCycleService.getCycleById(id);
    if (!cycle) {
      return res.status(404).json({
        error: 'Cycle not found',
        message: `Verification cycle with ID ${id} not found`
      });
    }

    res.json(cycle);
  } catch (error) {
    console.error('Error getting verification cycle:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get verification cycle'
    });
  }
});

export default router;