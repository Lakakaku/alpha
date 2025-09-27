import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { VerificationCycleService } from '../../../services/verification/verificationCycleService';
import { FileExportService } from '../../../services/verification/fileExportService';
import { businessAuthMiddleware } from '../../../middleware/auth';
import { validateRequest } from '../../../middleware/request-validation';

const router = Router();
const verificationCycleService = new VerificationCycleService();
const fileExportService = new FileExportService();

// Validation schemas
const listDatabasesSchema = z.object({
  query: z.object({
    status: z.enum(['ready', 'downloaded', 'submitted', 'processed', 'expired']).optional(),
    cycle_week: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format').optional()
  })
});

const getDatabaseSchema = z.object({
  params: z.object({
    databaseId: z.string().uuid('Invalid database ID format')
  })
});

// Apply business authentication to all routes
router.use(businessAuthMiddleware);

/**
 * GET /api/business/verification/databases
 * List verification databases for the authenticated business
 */
router.get('/', validateRequest(listDatabasesSchema), async (req: Request, res: Response) => {
  try {
    const businessId = req.user?.business_id;
    if (!businessId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Business ID not found in request'
      });
    }

    const { status, cycle_week } = req.query as any;

    const databases = await verificationCycleService.getBusinessDatabases(businessId, {
      status,
      cycle_week
    });

    // Transform databases to include store name and hide sensitive data
    const transformedDatabases = databases.map(db => ({
      id: db.id,
      store_id: db.store_id,
      store_name: db.store_name,
      transaction_count: db.transaction_count,
      status: db.status,
      deadline_at: db.deadline_at,
      created_at: db.created_at
    }));

    res.json(transformedDatabases);
  } catch (error) {
    console.error('Error listing verification databases:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to list verification databases'
    });
  }
});

/**
 * GET /api/business/verification/databases/:databaseId
 * Get details of a specific verification database
 */
router.get('/:databaseId', validateRequest(getDatabaseSchema), async (req: Request, res: Response) => {
  try {
    const { databaseId } = req.params;
    const businessId = req.user?.business_id;

    if (!businessId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Business ID not found in request'
      });
    }

    const database = await verificationCycleService.getDatabaseById(databaseId);
    if (!database) {
      return res.status(404).json({
        error: 'Database not found',
        message: `Verification database with ID ${databaseId} not found`
      });
    }

    // Check if database belongs to this business (RLS should handle this, but double-check)
    if (database.business_id !== businessId) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have access to this verification database'
      });
    }

    // Return detailed information including verification counts
    const detailResponse = {
      ...database,
      available_formats: ['csv', 'excel', 'json']
    };

    res.json(detailResponse);
  } catch (error) {
    console.error('Error getting verification database:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get verification database'
    });
  }
});

/**
 * GET /api/business/verification/databases/:databaseId/records
 * Get verification records for a database with pagination
 */
router.get('/:databaseId/records', async (req: Request, res: Response) => {
  try {
    const { databaseId } = req.params;
    const businessId = req.user?.business_id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100); // Max 100 per page

    if (!businessId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Business ID not found in request'
      });
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(databaseId)) {
      return res.status(400).json({
        error: 'Invalid ID format',
        message: 'Database ID must be a valid UUID'
      });
    }

    // Verify database belongs to business
    const database = await verificationCycleService.getDatabaseById(databaseId);
    if (!database || database.business_id !== businessId) {
      return res.status(404).json({
        error: 'Database not found',
        message: `Verification database with ID ${databaseId} not found`
      });
    }

    const result = await verificationCycleService.getVerificationRecords(databaseId, {
      page,
      limit
    });

    res.json({
      records: result.records,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        total_pages: result.totalPages
      }
    });
  } catch (error) {
    console.error('Error getting verification records:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get verification records'
    });
  }
});

export default router;