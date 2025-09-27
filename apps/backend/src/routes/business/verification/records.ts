import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { VerificationCycleService } from '../../../services/verification/verificationCycleService';
import { businessAuthMiddleware } from '../../../middleware/auth';
import { validateRequest } from '../../../middleware/request-validation';

const router = Router();
const verificationCycleService = new VerificationCycleService();

// Validation schemas
const updateRecordsSchema = z.object({
  params: z.object({
    databaseId: z.string().uuid('Invalid database ID format')
  }),
  body: z.object({
    records: z.array(z.object({
      record_id: z.string().uuid('Invalid record ID format'),
      verification_status: z.enum(['verified', 'fake'], {
        errorMap: () => ({ message: 'Status must be either verified or fake' })
      })
    })).min(1, 'At least one record is required')
  })
});

// Apply business authentication to all routes
router.use(businessAuthMiddleware);

/**
 * PATCH /api/business/verification/databases/:databaseId/records
 * Update verification status for individual records
 */
router.patch('/:databaseId', validateRequest(updateRecordsSchema), async (req: Request, res: Response) => {
  try {
    const { databaseId } = req.params;
    const { records } = req.body;
    const businessId = req.user?.business_id;
    const userId = req.user?.id;

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

    // Check if database can be updated
    if (database.status === 'submitted' || database.status === 'processed') {
      return res.status(409).json({
        error: 'Already submitted',
        message: 'Cannot update records after verification has been submitted'
      });
    }

    // Check deadline
    const deadline = new Date(database.deadline_at);
    const now = new Date();
    if (now > deadline) {
      return res.status(400).json({
        error: 'Deadline passed',
        message: 'The verification deadline has passed'
      });
    }

    // Validate that all record IDs belong to this database
    const validRecordIds = await verificationCycleService.getValidRecordIds(databaseId);
    const invalidRecords = records.filter(r => !validRecordIds.includes(r.record_id));
    
    if (invalidRecords.length > 0) {
      return res.status(400).json({
        error: 'Invalid record IDs',
        message: 'Some record IDs do not belong to this database',
        invalid_records: invalidRecords.map(r => r.record_id)
      });
    }

    // Update verification records
    const updateResult = await verificationCycleService.updateVerificationRecords(
      databaseId,
      records.map(r => ({
        record_id: r.record_id,
        verification_status: r.verification_status,
        verified_by: userId,
        verified_at: new Date()
      }))
    );

    // Log the update for audit purposes
    await verificationCycleService.logDatabaseAccess(
      databaseId, 
      businessId, 
      'record_update', 
      `Updated ${updateResult.updated_count} records`
    );

    res.json({
      updated_count: updateResult.updated_count,
      message: `Successfully updated ${updateResult.updated_count} verification records`
    });
  } catch (error) {
    console.error('Error updating verification records:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update verification records'
    });
  }
});

/**
 * GET /api/business/verification/databases/:databaseId/records/summary
 * Get summary of verification record statuses
 */
router.get('/:databaseId/summary', async (req: Request, res: Response) => {
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

    // Verify database access
    const database = await verificationCycleService.getDatabaseById(databaseId);
    if (!database || database.business_id !== businessId) {
      return res.status(404).json({
        error: 'Database not found',
        message: `Verification database with ID ${databaseId} not found`
      });
    }

    // Get verification summary
    const summary = await verificationCycleService.getVerificationSummary(databaseId);

    res.json({
      database_id: databaseId,
      total_records: summary.total_records,
      verified_count: summary.verified_count,
      fake_count: summary.fake_count,
      pending_count: summary.pending_count,
      completion_percentage: summary.completion_percentage,
      last_updated: summary.last_updated
    });
  } catch (error) {
    console.error('Error getting verification summary:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get verification summary'
    });
  }
});

/**
 * POST /api/business/verification/databases/:databaseId/records/bulk-update
 * Bulk update all pending records with the same status
 */
router.post('/:databaseId/bulk-update', async (req: Request, res: Response) => {
  try {
    const { databaseId } = req.params;
    const { verification_status, filter_criteria } = req.body;
    const businessId = req.user?.business_id;
    const userId = req.user?.id;

    if (!businessId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Business ID not found in request'
      });
    }

    // Validate inputs
    if (!['verified', 'fake'].includes(verification_status)) {
      return res.status(400).json({
        error: 'Invalid status',
        message: 'Status must be either verified or fake'
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

    // Verify database access
    const database = await verificationCycleService.getDatabaseById(databaseId);
    if (!database || database.business_id !== businessId) {
      return res.status(404).json({
        error: 'Database not found',
        message: `Verification database with ID ${databaseId} not found`
      });
    }

    // Check if database can be updated
    if (database.status === 'submitted' || database.status === 'processed') {
      return res.status(409).json({
        error: 'Already submitted',
        message: 'Cannot update records after verification has been submitted'
      });
    }

    // Check deadline
    const deadline = new Date(database.deadline_at);
    const now = new Date();
    if (now > deadline) {
      return res.status(400).json({
        error: 'Deadline passed',
        message: 'The verification deadline has passed'
      });
    }

    // Perform bulk update
    const updateResult = await verificationCycleService.bulkUpdateVerificationRecords(
      databaseId,
      verification_status,
      {
        verified_by: userId,
        verified_at: new Date(),
        filter_criteria
      }
    );

    // Log the bulk update
    await verificationCycleService.logDatabaseAccess(
      databaseId,
      businessId,
      'bulk_update',
      `Bulk updated ${updateResult.updated_count} records to ${verification_status}`
    );

    res.json({
      updated_count: updateResult.updated_count,
      message: `Successfully updated ${updateResult.updated_count} records to ${verification_status}`,
      filter_applied: filter_criteria || 'none'
    });
  } catch (error) {
    console.error('Error performing bulk update:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to perform bulk update'
    });
  }
});

/**
 * DELETE /api/business/verification/databases/:databaseId/records/reset
 * Reset all verification records to pending status
 */
router.delete('/:databaseId/reset', async (req: Request, res: Response) => {
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

    // Verify database access
    const database = await verificationCycleService.getDatabaseById(databaseId);
    if (!database || database.business_id !== businessId) {
      return res.status(404).json({
        error: 'Database not found',
        message: `Verification database with ID ${databaseId} not found`
      });
    }

    // Check if database can be reset
    if (database.status === 'submitted' || database.status === 'processed') {
      return res.status(409).json({
        error: 'Already submitted',
        message: 'Cannot reset records after verification has been submitted'
      });
    }

    // Check deadline
    const deadline = new Date(database.deadline_at);
    const now = new Date();
    if (now > deadline) {
      return res.status(400).json({
        error: 'Deadline passed',
        message: 'The verification deadline has passed'
      });
    }

    // Reset all records to pending
    const resetResult = await verificationCycleService.resetVerificationRecords(databaseId);

    // Log the reset action
    await verificationCycleService.logDatabaseAccess(
      databaseId,
      businessId,
      'reset_records',
      `Reset ${resetResult.reset_count} records to pending`
    );

    res.json({
      reset_count: resetResult.reset_count,
      message: `Successfully reset ${resetResult.reset_count} records to pending status`
    });
  } catch (error) {
    console.error('Error resetting verification records:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to reset verification records'
    });
  }
});

export default router;