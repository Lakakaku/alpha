import { Router } from 'express';
import { z } from 'zod';
import type { 
  SupportTicket,
  SupportTicketMessage,
  SupportTicketStatus,
  SupportTicketPriority,
  SupportChannel
} from '@vocilia/types';
import { 
  SupportTicketModel,
  SupportTicketMessageModel 
} from '@vocilia/database';
import { SupportTicketManagerService } from '../../services/communication/support-ticket-manager.js';

const router = Router();
const supportManager = new SupportTicketManagerService();

// Validation schemas
const createTicketSchema = z.object({
  customer_id: z.string().uuid().optional(),
  business_id: z.string().uuid().optional(),
  subject: z.string().min(5).max(200),
  description: z.string().min(10).max(2000),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  channel: z.enum(['phone', 'email', 'chat', 'web']),
  contact_email: z.string().email().optional(),
  contact_phone: z.string().optional(),
  category: z.string().optional()
}).refine(data => data.customer_id || data.business_id, {
  message: "Either customer_id or business_id must be provided"
});

const updateTicketSchema = z.object({
  status: z.enum(['open', 'in_progress', 'awaiting_response', 'resolved', 'closed']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assigned_to: z.string().uuid().optional(),
  resolution_notes: z.string().optional()
});

const addMessageSchema = z.object({
  content: z.string().min(1).max(2000),
  is_internal: z.boolean().default(false),
  attachments: z.array(z.string()).optional()
});

const assignTicketSchema = z.object({
  admin_id: z.string().uuid()
});

const ticketFiltersSchema = z.object({
  status: z.enum(['open', 'in_progress', 'awaiting_response', 'resolved', 'closed']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assigned_to: z.string().uuid().optional(),
  channel: z.enum(['phone', 'email', 'chat', 'web']).optional(),
  category: z.string().optional(),
  sla_violation: z.boolean().optional(),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20)
});

/**
 * POST /api/admin/support/tickets
 * Create a new support ticket
 */
router.post('/tickets', async (req, res) => {
  try {
    const validatedData = createTicketSchema.parse(req.body);

    const ticket = await supportManager.createTicket(validatedData);

    res.status(201).json({
      success: true,
      data: ticket
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    }

    console.error('Failed to create ticket:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/admin/support/tickets
 * Get tickets with filtering and pagination
 */
router.get('/tickets', async (req, res) => {
  try {
    const filters = ticketFiltersSchema.parse(req.query);

    const tickets = await SupportTicketModel.getWithFilters({
      status: filters.status as SupportTicketStatus,
      priority: filters.priority as SupportTicketPriority,
      assigned_to: filters.assigned_to,
      channel: filters.channel as SupportChannel,
      category: filters.category,
      sla_violation: filters.sla_violation,
      date_from: filters.date_from,
      date_to: filters.date_to,
      page: filters.page,
      limit: filters.limit
    });

    const total = await SupportTicketModel.getCountWithFilters({
      status: filters.status as SupportTicketStatus,
      priority: filters.priority as SupportTicketPriority,
      assigned_to: filters.assigned_to,
      channel: filters.channel as SupportChannel,
      category: filters.category,
      sla_violation: filters.sla_violation,
      date_from: filters.date_from,
      date_to: filters.date_to
    });

    res.json({
      success: true,
      data: tickets,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        pages: Math.ceil(total / filters.limit)
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    }

    console.error('Failed to get tickets:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/admin/support/tickets/:id
 * Get ticket by ID with messages
 */
router.get('/tickets/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const ticket = await SupportTicketModel.getById(id);
    if (!ticket) {
      return res.status(404).json({
        error: 'Ticket not found'
      });
    }

    const messages = await SupportTicketMessageModel.getByTicketId(id);

    res.json({
      success: true,
      data: {
        ticket,
        messages
      }
    });

  } catch (error) {
    console.error('Failed to get ticket:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * PUT /api/admin/support/tickets/:id
 * Update ticket
 */
router.put('/tickets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const validatedData = updateTicketSchema.parse(req.body);
    const adminId = req.user?.id || 'admin'; // Assuming admin ID from auth middleware

    const ticket = await SupportTicketModel.getById(id);
    if (!ticket) {
      return res.status(404).json({
        error: 'Ticket not found'
      });
    }

    let updatedTicket = ticket;

    if (validatedData.status) {
      updatedTicket = await supportManager.updateTicketStatus(
        id, 
        validatedData.status, 
        adminId,
        validatedData.resolution_notes
      );
    }

    if (validatedData.priority) {
      updatedTicket = await SupportTicketModel.updatePriority(id, validatedData.priority);
    }

    if (validatedData.assigned_to) {
      updatedTicket = await supportManager.assignTicket(id, validatedData.assigned_to, adminId);
    }

    res.json({
      success: true,
      data: updatedTicket
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    }

    console.error('Failed to update ticket:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/admin/support/tickets/:id/messages
 * Add message to ticket
 */
router.post('/tickets/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    const validatedData = addMessageSchema.parse(req.body);
    const adminId = req.user?.id || 'admin'; // Assuming admin ID from auth middleware

    const ticket = await SupportTicketModel.getById(id);
    if (!ticket) {
      return res.status(404).json({
        error: 'Ticket not found'
      });
    }

    const message = await supportManager.addMessage(
      id,
      adminId,
      'admin',
      validatedData.content,
      validatedData.is_internal,
      validatedData.attachments
    );

    res.status(201).json({
      success: true,
      data: message
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    }

    console.error('Failed to add message:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/admin/support/tickets/:id/assign
 * Assign ticket to admin
 */
router.post('/tickets/:id/assign', async (req, res) => {
  try {
    const { id } = req.params;
    const validatedData = assignTicketSchema.parse(req.body);
    const assignedBy = req.user?.id || 'admin'; // Assuming admin ID from auth middleware

    const ticket = await SupportTicketModel.getById(id);
    if (!ticket) {
      return res.status(404).json({
        error: 'Ticket not found'
      });
    }

    const updatedTicket = await supportManager.assignTicket(id, validatedData.admin_id, assignedBy);

    res.json({
      success: true,
      data: updatedTicket
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    }

    console.error('Failed to assign ticket:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/admin/support/tickets/sla-violations
 * Get tickets with SLA violations
 */
router.get('/tickets/sla-violations', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const violations = await SupportTicketModel.getSLAViolations(page, limit);

    res.json({
      success: true,
      data: violations
    });

  } catch (error) {
    console.error('Failed to get SLA violations:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/admin/support/check-sla
 * Trigger SLA violation check and escalation
 */
router.post('/check-sla', async (req, res) => {
  try {
    await supportManager.checkSLAViolations();

    res.json({
      success: true,
      message: 'SLA violation check completed'
    });

  } catch (error) {
    console.error('Failed to check SLA violations:', error);
    res.status(500).json({
      error: 'Failed to check SLA violations'
    });
  }
});

/**
 * GET /api/admin/support/stats
 * Get support statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 7;

    const stats = await supportManager.getTicketStats(days);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Failed to get support stats:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/admin/support/customer/:id/tickets
 * Get tickets for specific customer
 */
router.get('/customer/:id/tickets', async (req, res) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const tickets = await SupportTicketModel.getByCustomer(id, page, limit);

    res.json({
      success: true,
      data: tickets
    });

  } catch (error) {
    console.error('Failed to get customer tickets:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/admin/support/business/:id/tickets
 * Get tickets for specific business
 */
router.get('/business/:id/tickets', async (req, res) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const tickets = await SupportTicketModel.getByBusiness(id, page, limit);

    res.json({
      success: true,
      data: tickets
    });

  } catch (error) {
    console.error('Failed to get business tickets:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/admin/support/admin/:id/tickets
 * Get tickets assigned to specific admin
 */
router.get('/admin/:id/tickets', async (req, res) => {
  try {
    const { id } = req.params;
    const status = req.query.status as SupportTicketStatus;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const tickets = await SupportTicketModel.getByAssignedAdmin(id, status, page, limit);

    res.json({
      success: true,
      data: tickets
    });

  } catch (error) {
    console.error('Failed to get admin tickets:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

export default router;