import { Router, Request, Response } from 'express';
import { VerificationCycleService } from '../../../services/verification/verificationCycleService';
import { FileExportService } from '../../../services/verification/fileExportService';
import { adminAuthMiddleware } from '../../../middleware/admin-auth';

const router = Router();
const verificationCycleService = new VerificationCycleService();
const fileExportService = new FileExportService();

// Apply admin authentication to all routes
router.use(adminAuthMiddleware);

/**
 * GET /api/admin/verification/cycles/:cycleId/databases
 * List verification databases for a specific cycle
 */
router.get('/:cycleId', async (req: Request, res: Response) => {
  try {
    const { cycleId } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(cycleId)) {
      return res.status(400).json({
        error: 'Invalid ID format',
        message: 'Cycle ID must be a valid UUID'
      });
    }

    // Check if cycle exists
    const cycle = await verificationCycleService.getCycleById(cycleId);
    if (!cycle) {
      return res.status(404).json({
        error: 'Cycle not found',
        message: `Verification cycle with ID ${cycleId} not found`
      });
    }

    // Get verification databases for the cycle
    const databases = await verificationCycleService.getDatabasesByCycle(cycleId);

    res.json(databases);
  } catch (error) {
    console.error('Error listing verification databases:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to list verification databases'
    });
  }
});

/**
 * GET /api/admin/verification/databases/:databaseId
 * Get details of a specific verification database
 */
router.get('/database/:databaseId', async (req: Request, res: Response) => {
  try {
    const { databaseId } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(databaseId)) {
      return res.status(400).json({
        error: 'Invalid ID format',
        message: 'Database ID must be a valid UUID'
      });
    }

    const database = await verificationCycleService.getDatabaseById(databaseId);
    if (!database) {
      return res.status(404).json({
        error: 'Database not found',
        message: `Verification database with ID ${databaseId} not found`
      });
    }

    res.json(database);
  } catch (error) {
    console.error('Error getting verification database:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get verification database'
    });
  }
});

/**
 * GET /api/admin/verification/databases/:databaseId/download/:format
 * Get signed download URL for verification database file
 */
router.get('/database/:databaseId/download/:format', async (req: Request, res: Response) => {
  try {
    const { databaseId, format } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(databaseId)) {
      return res.status(400).json({
        error: 'Invalid ID format',
        message: 'Database ID must be a valid UUID'
      });
    }

    // Validate format
    const validFormats = ['csv', 'excel', 'json'];
    if (!validFormats.includes(format)) {
      return res.status(400).json({
        error: 'Invalid format',
        message: `Format must be one of: ${validFormats.join(', ')}`
      });
    }

    // Check if database exists
    const database = await verificationCycleService.getDatabaseById(databaseId);
    if (!database) {
      return res.status(404).json({
        error: 'Database not found',
        message: `Verification database with ID ${databaseId} not found`
      });
    }

    // Check if database is ready for download
    if (database.status === 'preparing') {
      return res.status(400).json({
        error: 'Database not ready',
        message: 'Database is still being prepared'
      });
    }

    // Get signed download URL
    const downloadUrl = await fileExportService.getSignedDownloadUrl(databaseId, format);
    const expiresAt = new Date(Date.now() + (60 * 60 * 1000)); // 1 hour from now

    res.json({
      download_url: downloadUrl,
      expires_at: expiresAt.toISOString()
    });
  } catch (error) {
    console.error('Error getting download URL:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get download URL'
    });
  }
});

/**
 * POST /api/admin/verification/databases/:databaseId/regenerate
 * Regenerate files for a specific verification database
 */
router.post('/database/:databaseId/regenerate', async (req: Request, res: Response) => {
  try {
    const { databaseId } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(databaseId)) {
      return res.status(400).json({
        error: 'Invalid ID format',
        message: 'Database ID must be a valid UUID'
      });
    }

    // Check if database exists
    const database = await verificationCycleService.getDatabaseById(databaseId);
    if (!database) {
      return res.status(404).json({
        error: 'Database not found',
        message: `Verification database with ID ${databaseId} not found`
      });
    }

    // Check if database can be regenerated
    if (database.status === 'submitted' || database.status === 'processed') {
      return res.status(409).json({
        error: 'Cannot regenerate',
        message: 'Cannot regenerate database that has been submitted or processed'
      });
    }

    // Start regeneration process
    const jobId = await fileExportService.regenerateDatabase(databaseId);

    res.status(202).json({
      message: 'Database regeneration started',
      job_id: jobId,
      database_id: databaseId
    });
  } catch (error) {
    console.error('Error regenerating database:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to regenerate database'
    });
  }
});

export default router;