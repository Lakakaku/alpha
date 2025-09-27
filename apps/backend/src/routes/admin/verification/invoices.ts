import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { PaymentProcessingService } from '../../../services/verification/paymentProcessingService';
import { VerificationCycleService } from '../../../services/verification/verificationCycleService';
import { adminAuthMiddleware } from '../../../middleware/admin-auth';
import { validateRequest } from '../../../middleware/request-validation';

const router = Router();
const paymentProcessingService = new PaymentProcessingService();
const verificationCycleService = new VerificationCycleService();

// Validation schemas
const generateInvoicesSchema = z.object({
  params: z.object({
    cycleId: z.string().uuid('Invalid cycle ID format')
  })
});

// Apply admin authentication to all routes
router.use(adminAuthMiddleware);

/**
 * POST /api/admin/verification/cycles/:cycleId/invoices
 * Generate payment invoices for all verified feedback in a cycle
 */
router.post('/:cycleId', validateRequest(generateInvoicesSchema), async (req: Request, res: Response) => {
  try {
    const { cycleId } = req.params;

    // Check if cycle exists
    const cycle = await verificationCycleService.getCycleById(cycleId);
    if (!cycle) {
      return res.status(404).json({
        error: 'Cycle not found',
        message: `Verification cycle with ID ${cycleId} not found`
      });
    }

    // Check if cycle is in correct status for invoice generation
    if (cycle.status !== 'processing') {
      return res.status(409).json({
        error: 'Invalid cycle status',
        message: `Cycle status is '${cycle.status}', expected 'processing'`
      });
    }

    // Check if invoices have already been generated
    const existingInvoices = await paymentProcessingService.getInvoicesByCycle(cycleId);
    if (existingInvoices.length > 0) {
      return res.status(409).json({
        error: 'Invoices already generated',
        message: 'Payment invoices have already been generated for this cycle'
      });
    }

    // Generate invoices
    const result = await paymentProcessingService.generateInvoices(cycleId);

    // Update cycle status to invoicing
    await verificationCycleService.updateCycleStatus(cycleId, 'invoicing');

    res.status(201).json({
      invoices_created: result.invoicesCreated,
      total_amount: result.totalAmount,
      businesses_invoiced: result.businessesInvoiced
    });
  } catch (error) {
    console.error('Error generating invoices:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to generate invoices'
    });
  }
});

/**
 * GET /api/admin/verification/cycles/:cycleId/invoices
 * List payment invoices for a verification cycle
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

    const invoices = await paymentProcessingService.getInvoicesByCycle(cycleId);
    res.json(invoices);
  } catch (error) {
    console.error('Error listing invoices:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to list invoices'
    });
  }
});

/**
 * GET /api/admin/verification/invoices/:invoiceId
 * Get details of a specific payment invoice
 */
router.get('/invoice/:invoiceId', async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(invoiceId)) {
      return res.status(400).json({
        error: 'Invalid ID format',
        message: 'Invoice ID must be a valid UUID'
      });
    }

    const invoice = await paymentProcessingService.getInvoiceById(invoiceId);
    if (!invoice) {
      return res.status(404).json({
        error: 'Invoice not found',
        message: `Payment invoice with ID ${invoiceId} not found`
      });
    }

    res.json(invoice);
  } catch (error) {
    console.error('Error getting invoice:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get invoice'
    });
  }
});

export default router;