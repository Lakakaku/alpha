import { Router } from 'express';
import { z } from 'zod';
import type { 
  CommunicationTemplate,
  NotificationType,
  CommunicationChannel,
  TemplateStatus
} from '@vocilia/types';
import { CommunicationTemplateModel } from '@vocilia/database';
import { 
  TemplateManagerService,
  TemplateValidatorService,
  TemplateRendererService
} from '../../services/communication/index.js';

const router = Router();
const templateManager = new TemplateManagerService();
const templateValidator = new TemplateValidatorService();
const templateRenderer = new TemplateRendererService();

// Validation schemas
const createTemplateSchema = z.object({
  name: z.string().min(3).max(100),
  notification_type: z.enum([
    'reward_earned',
    'payment_confirmation', 
    'verification_request',
    'support_ticket_created',
    'payment_overdue',
    'weekly_summary',
    'fraud_alert',
    'payment_failed',
    'verification_failed',
    'system_maintenance',
    'support_message_received',
    'support_ticket_updated'
  ]),
  channel: z.enum(['sms', 'email']),
  language: z.enum(['sv', 'en']).default('sv'),
  subject: z.string().max(200).optional(),
  content: z.string().min(10).max(2000),
  variables: z.array(z.string()),
  is_default: z.boolean().default(false)
});

const updateTemplateSchema = z.object({
  subject: z.string().max(200).optional(),
  content: z.string().min(10).max(2000).optional(),
  variables: z.array(z.string()).optional()
});

const templateFiltersSchema = z.object({
  notification_type: z.string().optional(),
  channel: z.enum(['sms', 'email']).optional(),
  language: z.enum(['sv', 'en']).optional(),
  status: z.enum(['draft', 'active', 'inactive', 'archived']).optional(),
  search: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20)
});

const renderTestSchema = z.object({
  data: z.record(z.any()).optional()
});

const duplicateTemplateSchema = z.object({
  new_name: z.string().min(3).max(100)
});

const importTemplatesSchema = z.object({
  templates: z.array(z.object({
    name: z.string(),
    notification_type: z.string(),
    channel: z.string(),
    language: z.string(),
    subject: z.string().optional(),
    content: z.string(),
    variables: z.array(z.string())
  }))
});

/**
 * POST /api/admin/templates
 * Create a new template
 */
router.post('/', async (req, res) => {
  try {
    const validatedData = createTemplateSchema.parse(req.body);
    const createdBy = req.user?.id || 'admin'; // Assuming admin ID from auth middleware

    // Validate template before creation
    const validation = await templateValidator.validateTemplate(validatedData);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Template validation failed',
        details: validation.errors,
        warnings: validation.warnings
      });
    }

    const template = await templateManager.createTemplate({
      ...validatedData,
      created_by: createdBy
    });

    res.status(201).json({
      success: true,
      data: template,
      validation: {
        score: validation.score,
        warnings: validation.warnings
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    }

    console.error('Failed to create template:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/admin/templates
 * Get templates with filtering and pagination
 */
router.get('/', async (req, res) => {
  try {
    const filters = templateFiltersSchema.parse(req.query);

    const templates = await CommunicationTemplateModel.getWithFilters({
      notification_type: filters.notification_type as NotificationType,
      channel: filters.channel as CommunicationChannel,
      language: filters.language,
      status: filters.status as TemplateStatus,
      search: filters.search,
      page: filters.page,
      limit: filters.limit
    });

    const total = await CommunicationTemplateModel.getCountWithFilters({
      notification_type: filters.notification_type as NotificationType,
      channel: filters.channel as CommunicationChannel,
      language: filters.language,
      status: filters.status as TemplateStatus,
      search: filters.search
    });

    res.json({
      success: true,
      data: templates,
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

    console.error('Failed to get templates:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/admin/templates/:id
 * Get template by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const template = await CommunicationTemplateModel.getById(id);
    if (!template) {
      return res.status(404).json({
        error: 'Template not found'
      });
    }

    res.json({
      success: true,
      data: template
    });

  } catch (error) {
    console.error('Failed to get template:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * PUT /api/admin/templates/:id
 * Update template (creates new version)
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const validatedData = updateTemplateSchema.parse(req.body);
    const updatedBy = req.user?.id || 'admin'; // Assuming admin ID from auth middleware

    const template = await CommunicationTemplateModel.getById(id);
    if (!template) {
      return res.status(404).json({
        error: 'Template not found'
      });
    }

    // Validate updated template
    const templateData = {
      ...template,
      ...validatedData
    };
    const validation = await templateValidator.validateTemplate(templateData);
    
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Template validation failed',
        details: validation.errors,
        warnings: validation.warnings
      });
    }

    const updatedTemplate = await templateManager.updateTemplate(id, validatedData, updatedBy);

    res.json({
      success: true,
      data: updatedTemplate,
      validation: {
        score: validation.score,
        warnings: validation.warnings
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    }

    console.error('Failed to update template:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/admin/templates/:id/activate
 * Activate template version
 */
router.post('/:id/activate', async (req, res) => {
  try {
    const { id } = req.params;
    const activatedBy = req.user?.id || 'admin'; // Assuming admin ID from auth middleware

    const template = await CommunicationTemplateModel.getById(id);
    if (!template) {
      return res.status(404).json({
        error: 'Template not found'
      });
    }

    const activatedTemplate = await templateManager.activateTemplate(id, activatedBy);

    res.json({
      success: true,
      data: activatedTemplate
    });

  } catch (error) {
    console.error('Failed to activate template:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/admin/templates/:id/deactivate
 * Deactivate template
 */
router.post('/:id/deactivate', async (req, res) => {
  try {
    const { id } = req.params;

    const template = await CommunicationTemplateModel.getById(id);
    if (!template) {
      return res.status(404).json({
        error: 'Template not found'
      });
    }

    const deactivatedTemplate = await templateManager.deactivateTemplate(id);

    res.json({
      success: true,
      data: deactivatedTemplate
    });

  } catch (error) {
    console.error('Failed to deactivate template:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/admin/templates/:id/duplicate
 * Duplicate template with new name
 */
router.post('/:id/duplicate', async (req, res) => {
  try {
    const { id } = req.params;
    const validatedData = duplicateTemplateSchema.parse(req.body);
    const createdBy = req.user?.id || 'admin'; // Assuming admin ID from auth middleware

    const template = await CommunicationTemplateModel.getById(id);
    if (!template) {
      return res.status(404).json({
        error: 'Template not found'
      });
    }

    const duplicatedTemplate = await templateManager.duplicateTemplate(
      id, 
      validatedData.new_name, 
      createdBy
    );

    res.status(201).json({
      success: true,
      data: duplicatedTemplate
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    }

    console.error('Failed to duplicate template:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/admin/templates/:id/validate
 * Validate template content
 */
router.post('/:id/validate', async (req, res) => {
  try {
    const { id } = req.params;

    const template = await CommunicationTemplateModel.getById(id);
    if (!template) {
      return res.status(404).json({
        error: 'Template not found'
      });
    }

    const validation = await templateValidator.validateTemplate(template);

    res.json({
      success: true,
      data: validation
    });

  } catch (error) {
    console.error('Failed to validate template:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/admin/templates/:id/preview
 * Preview template with sample data
 */
router.post('/:id/preview', async (req, res) => {
  try {
    const { id } = req.params;
    const validatedData = renderTestSchema.parse(req.body);

    const template = await CommunicationTemplateModel.getById(id);
    if (!template) {
      return res.status(404).json({
        error: 'Template not found'
      });
    }

    let result;
    if (validatedData.data) {
      result = await templateRenderer.renderTemplateById(id, validatedData.data);
    } else {
      result = await templateRenderer.previewTemplate(id);
    }

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    }

    console.error('Failed to preview template:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/admin/templates/:id/versions
 * Get all versions of a template
 */
router.get('/:id/versions', async (req, res) => {
  try {
    const { id } = req.params;

    const template = await CommunicationTemplateModel.getById(id);
    if (!template) {
      return res.status(404).json({
        error: 'Template not found'
      });
    }

    const versions = await CommunicationTemplateModel.getVersionHistory(template.id);

    res.json({
      success: true,
      data: versions
    });

  } catch (error) {
    console.error('Failed to get template versions:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/admin/templates/:id/stats
 * Get template usage statistics
 */
router.get('/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;
    const days = parseInt(req.query.days as string) || 30;

    const template = await CommunicationTemplateModel.getById(id);
    if (!template) {
      return res.status(404).json({
        error: 'Template not found'
      });
    }

    const stats = await templateManager.getTemplateStats(id, days);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Failed to get template stats:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/admin/templates/import
 * Import multiple templates from JSON
 */
router.post('/import', async (req, res) => {
  try {
    const validatedData = importTemplatesSchema.parse(req.body);
    const importedBy = req.user?.id || 'admin'; // Assuming admin ID from auth middleware

    const result = await templateManager.importTemplates(validatedData.templates, importedBy);

    res.status(201).json({
      success: true,
      data: result
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    }

    console.error('Failed to import templates:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * DELETE /api/admin/templates/:id
 * Archive template (soft delete)
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const template = await CommunicationTemplateModel.getById(id);
    if (!template) {
      return res.status(404).json({
        error: 'Template not found'
      });
    }

    if (template.status === 'active') {
      return res.status(400).json({
        error: 'Cannot archive active template. Deactivate first.'
      });
    }

    const archivedTemplate = await templateManager.archiveTemplate(id);

    res.json({
      success: true,
      data: archivedTemplate
    });

  } catch (error) {
    console.error('Failed to archive template:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

export default router;