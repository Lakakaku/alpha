import { Router, Request, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { VerificationCycleService } from '../../../services/verification/verificationCycleService';
import { FileExportService } from '../../../services/verification/fileExportService';
import { businessAuthMiddleware } from '../../../middleware/auth';
import { validateRequest } from '../../../middleware/request-validation';

const router = Router();
const verificationCycleService = new VerificationCycleService();
const fileExportService = new FileExportService();

// Configure multer for file upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (allowedMimes.includes(file.mimetype) || file.originalname.endsWith('.csv') || file.originalname.endsWith('.xlsx')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV and Excel files are allowed.'));
    }
  }
});

// Validation schemas
const submitSchema = z.object({
  params: z.object({
    databaseId: z.string().uuid('Invalid database ID format')
  }),
  body: z.object({
    format: z.enum(['csv', 'excel'], {
      errorMap: () => ({ message: 'Format must be either csv or excel' })
    })
  })
});

// Apply business authentication to all routes
router.use(businessAuthMiddleware);

/**
 * POST /api/business/verification/databases/:databaseId/submit
 * Submit verification results via file upload
 */
router.post('/:databaseId', upload.single('verification_file'), validateRequest(submitSchema), async (req: Request, res: Response) => {
  try {
    const { databaseId } = req.params;
    const { format } = req.body;
    const businessId = req.user?.business_id;
    const file = req.file;

    if (!businessId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Business ID not found in request'
      });
    }

    if (!file) {
      return res.status(400).json({
        error: 'Missing file',
        message: 'verification_file is required'
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

    // Check if database can be submitted
    if (database.status === 'submitted' || database.status === 'processed') {
      return res.status(409).json({
        error: 'Already submitted',
        message: 'Verification has already been submitted for this database'
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

    // Validate and process the uploaded file
    let validationResult;
    try {
      validationResult = await fileExportService.validateSubmissionFile(file.buffer, format, databaseId);
    } catch (validationError: any) {
      return res.status(400).json({
        error: 'File validation failed',
        message: validationError.message,
        validation_errors: validationError.errors || []
      });
    }

    // Process the submission
    const submissionResult = await verificationCycleService.processVerificationSubmission(
      databaseId,
      validationResult.records,
      businessId
    );

    // Update database status to submitted
    await verificationCycleService.updateDatabaseStatus(databaseId, 'submitted', {
      submitted_at: new Date(),
      verified_count: submissionResult.verified_count,
      fake_count: submissionResult.fake_count,
      unverified_count: submissionResult.unverified_count
    });

    // Log submission for audit
    await verificationCycleService.logDatabaseAccess(databaseId, businessId, 'submission', format);

    res.json({
      message: 'Verification submitted successfully',
      verified_count: submissionResult.verified_count,
      fake_count: submissionResult.fake_count,
      total_processed: submissionResult.total_processed
    });
  } catch (error) {
    console.error('Error processing verification submission:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process verification submission'
    });
  }
});

/**
 * GET /api/business/verification/databases/:databaseId/submit/status
 * Check submission status and requirements
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

    const deadline = new Date(database.deadline_at);
    const now = new Date();
    const timeRemaining = deadline.getTime() - now.getTime();
    const isExpired = timeRemaining <= 0;

    const status = {
      database_id: databaseId,
      status: database.status,
      can_submit: !['submitted', 'processed'].includes(database.status) && !isExpired,
      deadline_at: database.deadline_at,
      time_remaining_ms: Math.max(0, timeRemaining),
      is_expired: isExpired,
      transaction_count: database.transaction_count,
      verified_count: database.verified_count || 0,
      fake_count: database.fake_count || 0,
      submission_requirements: {
        required_fields: ['id', 'verification_status', 'reward_percentage'],
        valid_statuses: ['verified', 'fake'],
        reward_percentage_range: { min: 2.00, max: 15.00 },
        accepted_formats: ['csv', 'excel']
      }
    };

    res.json(status);
  } catch (error) {
    console.error('Error getting submission status:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get submission status'
    });
  }
});

/**
 * POST /api/business/verification/databases/:databaseId/submit/validate
 * Validate submission file without actually submitting
 */
router.post('/:databaseId/validate', upload.single('verification_file'), async (req: Request, res: Response) => {
  try {
    const { databaseId } = req.params;
    const { format } = req.body;
    const businessId = req.user?.business_id;
    const file = req.file;

    if (!businessId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Business ID not found in request'
      });
    }

    if (!file) {
      return res.status(400).json({
        error: 'Missing file',
        message: 'verification_file is required'
      });
    }

    // Validate format
    if (!['csv', 'excel'].includes(format)) {
      return res.status(400).json({
        error: 'Invalid format',
        message: 'Format must be either csv or excel'
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

    // Validate the file structure and content
    try {
      const validationResult = await fileExportService.validateSubmissionFile(file.buffer, format, databaseId);
      
      res.json({
        valid: true,
        message: 'File validation passed',
        record_count: validationResult.records.length,
        summary: {
          verified_count: validationResult.records.filter(r => r.verification_status === 'verified').length,
          fake_count: validationResult.records.filter(r => r.verification_status === 'fake').length
        }
      });
    } catch (validationError: any) {
      res.status(400).json({
        valid: false,
        error: 'File validation failed',
        message: validationError.message,
        validation_errors: validationError.errors || []
      });
    }
  } catch (error) {
    console.error('Error validating submission file:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to validate submission file'
    });
  }
});

export default router;