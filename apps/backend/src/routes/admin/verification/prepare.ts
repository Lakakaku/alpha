import { Router, Request, Response } from 'express';
import { DatabasePreparationService } from '../../../services/verification/databasePreparationService';
import { VerificationCycleService } from '../../../services/verification/verificationCycleService';
import { adminAuthMiddleware } from '../../../middleware/admin-auth';

const router = Router();
const databasePreparationService = new DatabasePreparationService();
const verificationCycleService = new VerificationCycleService();

// Apply admin authentication to all routes
router.use(adminAuthMiddleware);

/**
 * POST /api/admin/verification/cycles/:cycleId/prepare
 * Initiate database preparation for a verification cycle
 */
router.post('/:cycleId', async (req: Request, res: Response) => {
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

    // Check if cycle is in correct status for preparation
    if (cycle.status !== 'preparing') {
      return res.status(409).json({
        error: 'Invalid cycle status',
        message: `Cycle status is '${cycle.status}', expected 'preparing'`
      });
    }

    // Check if preparation is already in progress
    const isPreparationInProgress = await databasePreparationService.isPreparationInProgress(cycleId);
    if (isPreparationInProgress) {
      return res.status(409).json({
        error: 'Preparation already in progress',
        message: 'Database preparation is already running for this cycle'
      });
    }

    // Start database preparation (background job)
    const jobId = await databasePreparationService.startPreparation(cycleId);

    res.status(202).json({
      message: 'Database preparation started',
      job_id: jobId,
      cycle_id: cycleId
    });
  } catch (error) {
    console.error('Error starting database preparation:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to start database preparation'
    });
  }
});

/**
 * GET /api/admin/verification/cycles/:cycleId/prepare/status
 * Get database preparation status for a cycle
 */
router.get('/:cycleId/status', async (req: Request, res: Response) => {
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

    const status = await databasePreparationService.getPreparationStatus(cycleId);
    if (!status) {
      return res.status(404).json({
        error: 'Preparation status not found',
        message: `No preparation status found for cycle ${cycleId}`
      });
    }

    res.json(status);
  } catch (error) {
    console.error('Error getting preparation status:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get preparation status'
    });
  }
});

export default router;