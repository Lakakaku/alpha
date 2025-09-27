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
const downloadSchema = z.object({
  params: z.object({
    databaseId: z.string().uuid('Invalid database ID format'),
    format: z.enum(['csv', 'excel', 'json'], {
      errorMap: () => ({ message: 'Format must be one of: csv, excel, json' })
    })
  })
});

// Apply business authentication to all routes
router.use(businessAuthMiddleware);

/**
 * GET /api/business/verification/databases/:databaseId/download/:format
 * Download verification database file in specified format
 */
router.get('/:databaseId/:format', validateRequest(downloadSchema), async (req: Request, res: Response) => {
  try {
    const { databaseId, format } = req.params;
    const businessId = req.user?.business_id;

    if (!businessId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Business ID not found in request'
      });
    }

    // Get database and verify access
    const database = await verificationCycleService.getDatabaseById(databaseId);
    if (!database) {
      return res.status(404).json({
        error: 'Database not found',
        message: `Verification database with ID ${databaseId} not found`
      });
    }

    // Check if database belongs to this business
    if (database.business_id !== businessId) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have access to this verification database'
      });
    }

    // Check if database is ready for download
    if (database.status === 'preparing') {
      return res.status(400).json({
        error: 'Database not ready',
        message: 'Database is still being prepared and is not ready for download'
      });
    }

    // Generate signed download URL
    const downloadUrl = await fileExportService.getBusinessDownloadUrl(databaseId, format);
    const expiresAt = new Date(Date.now() + (60 * 60 * 1000)); // 1 hour from now
    
    // Generate filename based on store and cycle info
    const filename = fileExportService.generateFilename(database, format);

    // Update database status to 'downloaded' if it was 'ready'
    if (database.status === 'ready') {
      await verificationCycleService.updateDatabaseStatus(databaseId, 'downloaded');
    }

    // Log download access for audit purposes
    await verificationCycleService.logDatabaseAccess(databaseId, businessId, 'download', format);

    res.json({
      download_url: downloadUrl,
      expires_at: expiresAt.toISOString(),
      filename: filename
    });
  } catch (error) {
    console.error('Error generating download URL:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to generate download URL'
    });
  }
});

/**
 * POST /api/business/verification/databases/:databaseId/download/request
 * Request a new download link (useful if previous one expired)
 */
router.post('/:databaseId/request', async (req: Request, res: Response) => {
  try {
    const { databaseId } = req.params;
    const businessId = req.user?.business_id;
    const { format = 'csv' } = req.body;

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

    // Validate format
    const validFormats = ['csv', 'excel', 'json'];
    if (!validFormats.includes(format)) {
      return res.status(400).json({
        error: 'Invalid format',
        message: `Format must be one of: ${validFormats.join(', ')}`
      });
    }

    // Get database and verify access
    const database = await verificationCycleService.getDatabaseById(databaseId);
    if (!database || database.business_id !== businessId) {
      return res.status(404).json({
        error: 'Database not found',
        message: `Verification database with ID ${databaseId} not found`
      });
    }

    // Check if database is available for download
    if (database.status === 'preparing') {
      return res.status(400).json({
        error: 'Database not ready',
        message: 'Database is still being prepared'
      });
    }

    // Generate new download URL
    const downloadUrl = await fileExportService.getBusinessDownloadUrl(databaseId, format);
    const expiresAt = new Date(Date.now() + (60 * 60 * 1000)); // 1 hour from now
    const filename = fileExportService.generateFilename(database, format);

    // Log download request
    await verificationCycleService.logDatabaseAccess(databaseId, businessId, 'download_request', format);

    res.json({
      download_url: downloadUrl,
      expires_at: expiresAt.toISOString(),
      filename: filename,
      message: 'New download link generated successfully'
    });
  } catch (error) {
    console.error('Error requesting download:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to generate download link'
    });
  }
});

/**
 * GET /api/business/verification/databases/:databaseId/download/status
 * Check download status and availability
 */
router.get('/:databaseId/status', async (req: Request, res: Response) => {
  try {
    const { databaseId } = req.params;
    const businessId = req.user?.business_id;

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

    const database = await verificationCycleService.getDatabaseById(databaseId);
    if (!database || database.business_id !== businessId) {
      return res.status(404).json({
        error: 'Database not found',
        message: `Verification database with ID ${databaseId} not found`
      });
    }

    const status = {
      database_id: databaseId,
      status: database.status,
      ready_for_download: !['preparing'].includes(database.status),
      available_formats: ['csv', 'excel', 'json'],
      deadline_at: database.deadline_at,
      transaction_count: database.transaction_count
    };

    res.json(status);
  } catch (error) {
    console.error('Error getting download status:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get download status'
    });
  }
});

export default router;