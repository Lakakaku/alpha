import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { PaymentProcessingService } from '../../../services/verification/paymentProcessingService';
import { adminAuthMiddleware } from '../../../middleware/admin-auth';
import { validateRequest } from '../../../middleware/request-validation';

const router = Router();
const paymentProcessingService = new PaymentProcessingService();

// Validation schemas
const updatePaymentSchema = z.object({
  params: z.object({
    invoiceId: z.string().uuid('Invalid invoice ID format')
  }),
  body: z.object({
    status: z.enum(['paid', 'disputed', 'cancelled'], {
      errorMap: () => ({ message: 'Status must be one of: paid, disputed, cancelled' })
    }),
    payment_date: z.string().datetime().optional(),
    notes: z.string().optional()
  }).refine((data) => {
    // Require payment_date when status is 'paid'
    if (data.status === 'paid' && !data.payment_date) {
      return false;
    }
    return true;
  }, {
    message: 'payment_date is required when status is "paid"',
    path: ['payment_date']
  })
});

// Apply admin authentication to all routes
router.use(adminAuthMiddleware);

/**
 * PUT /api/admin/verification/invoices/:invoiceId/payment
 * Update payment status and trigger delivery when paid
 */
router.put('/:invoiceId', validateRequest(updatePaymentSchema), async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.params;
    const { status, payment_date, notes } = req.body;

    // Get current invoice
    const invoice = await paymentProcessingService.getInvoiceById(invoiceId);
    if (!invoice) {
      return res.status(404).json({
        error: 'Invoice not found',
        message: `Payment invoice with ID ${invoiceId} not found`
      });
    }

    // Validate state transitions
    const validTransitions = {
      'pending': ['paid', 'disputed', 'cancelled'],
      'disputed': ['paid', 'cancelled'],
      'overdue': ['paid', 'disputed', 'cancelled'],
      'paid': [], // No transitions from paid state
      'cancelled': [] // No transitions from cancelled state
    };

    const allowedStatuses = validTransitions[invoice.status as keyof typeof validTransitions];
    if (!allowedStatuses.includes(status)) {
      return res.status(409).json({
        error: 'Invalid status transition',
        message: `Cannot change status from '${invoice.status}' to '${status}'`
      });
    }

    // Update payment status
    const updatedInvoice = await paymentProcessingService.updatePaymentStatus(invoiceId, {
      status,
      payment_date: payment_date ? new Date(payment_date) : undefined,
      notes
    });

    // If marked as paid, trigger feedback database delivery
    if (status === 'paid') {
      try {
        await paymentProcessingService.deliverFeedbackDatabase(invoiceId);
        console.log(`Feedback database delivered for invoice ${invoiceId}`);
      } catch (deliveryError) {
        console.error('Error delivering feedback database:', deliveryError);
        // Don't fail the payment update, but log the error
      }

      // Create customer reward batches for Swish payments
      try {
        await paymentProcessingService.createCustomerRewardBatches(invoice.cycle_id, invoice.business_id);
        console.log(`Customer reward batches created for cycle ${invoice.cycle_id}`);
      } catch (rewardError) {
        console.error('Error creating customer reward batches:', rewardError);
        // Don't fail the payment update, but log the error
      }
    }

    res.json(updatedInvoice);
  } catch (error) {
    console.error('Error updating payment status:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update payment status'
    });
  }
});

/**
 * POST /api/admin/verification/invoices/:invoiceId/resend
 * Resend invoice notification to business
 */
router.post('/:invoiceId/resend', async (req: Request, res: Response) => {
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

    // Only allow resending for pending or overdue invoices
    if (!['pending', 'overdue'].includes(invoice.status)) {
      return res.status(409).json({
        error: 'Cannot resend invoice',
        message: `Cannot resend invoice with status '${invoice.status}'`
      });
    }

    await paymentProcessingService.resendInvoiceNotification(invoiceId);

    res.json({
      message: 'Invoice notification resent successfully',
      invoice_id: invoiceId
    });
  } catch (error) {
    console.error('Error resending invoice:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to resend invoice'
    });
  }
});

/**
 * GET /api/admin/verification/invoices/:invoiceId/payment-history
 * Get payment history for an invoice
 */
router.get('/:invoiceId/payment-history', async (req: Request, res: Response) => {
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

    const history = await paymentProcessingService.getPaymentHistory(invoiceId);
    res.json(history);
  } catch (error) {
    console.error('Error getting payment history:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get payment history'
    });
  }
});

export default router;