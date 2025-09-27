import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { QRManagementService } from '../../services/qr/qr-management.service.js';
import { AppError } from '../../utils/error-handler.js';
import { logger } from '../../utils/logger.js';
import { validateRequest } from '../../middleware/validation.js';
import { requireAuth, requireBusinessAccess } from '../../middleware/auth.js';

/**
 * QR Print Template Management Routes
 * 
 * Handles CRUD operations for custom QR code print templates.
 * Allows businesses to create, manage, and customize their
 * printable QR code designs.
 * 
 * Features:
 * - Template CRUD operations
 * - Custom branding and layouts
 * - Multiple page sizes support
 * - Template validation
 * - Business-specific templates
 * - Template sharing capabilities
 */

const router = Router();

// Rate limiting for template operations
const templateRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 template operations per 15 minutes
  message: {
    error: 'Too many template operations. Please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Template validation schemas
const templateConfigSchema = z.object({
  pageSize: z.enum(['A4', 'Letter', 'A5', 'A6']),
  qrSize: z.number().min(50).max(500),
  qrPosition: z.object({
    x: z.number().min(0),
    y: z.number().min(0)
  }),
  showStoreName: z.boolean(),
  showInstructions: z.boolean(),
  showLogo: z.boolean(),
  customText: z.string().max(500).optional(),
  colors: z.object({
    background: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    qr: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    text: z.string().regex(/^#[0-9A-Fa-f]{6}$/)
  }),
  fonts: z.object({
    storeName: z.object({
      family: z.string(),
      size: z.number().min(8).max(72),
      weight: z.enum(['normal', 'bold'])
    }),
    instructions: z.object({
      family: z.string(),
      size: z.number().min(6).max(48),
      weight: z.enum(['normal', 'bold'])
    }),
    customText: z.object({
      family: z.string(),
      size: z.number().min(6).max(48),
      weight: z.enum(['normal', 'bold'])
    })
  }),
  margins: z.object({
    top: z.number().min(0).max(100),
    right: z.number().min(0).max(100),
    bottom: z.number().min(0).max(100),
    left: z.number().min(0).max(100)
  }),
  layout: z.enum(['single', 'grid-2x2', 'grid-3x3', 'strip']),
  logoUrl: z.string().url().optional()
});

const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  config: templateConfigSchema,
  isPublic: z.boolean().default(false),
  tags: z.array(z.string()).max(10).optional()
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  config: templateConfigSchema.optional(),
  isPublic: z.boolean().optional(),
  tags: z.array(z.string()).max(10).optional()
});

const queryTemplatesSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  tags: z.string().optional(),
  isPublic: z.coerce.boolean().optional(),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt', 'usageCount']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

/**
 * @openapi
 * /qr/templates:
 *   get:
 *     summary: List QR print templates
 *     description: Get paginated list of QR print templates with filtering options
 *     tags:
 *       - QR Templates
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in template names and descriptions
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *         description: Comma-separated list of tags to filter by
 *       - in: query
 *         name: isPublic
 *         schema:
 *           type: boolean
 *         description: Filter by public/private templates
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [name, createdAt, updatedAt, usageCount]
 *           default: createdAt
 *         description: Sort field
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Templates retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 templates:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/QRTemplate'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 */
router.get('/', 
  requireAuth,
  templateRateLimit,
  validateRequest(queryTemplatesSchema, 'query'),
  async (req, res, next) => {
    try {
      const { page, limit, search, tags, isPublic, sortBy, sortOrder } = req.query;
      const businessId = req.user.businessId;

      const filters = {
        businessId,
        search,
        tags: tags ? tags.split(',').map(tag => tag.trim()) : undefined,
        isPublic,
        sortBy,
        sortOrder,
        page,
        limit
      };

      logger.info('Fetching QR templates', {
        businessId,
        filters: { ...filters, businessId: undefined }
      });

      const qrService = await QRManagementService.create();
      const result = await qrService.getTemplates(filters);

      res.status(200).json(result);

    } catch (error) {
      logger.error('Error fetching templates', {
        error: error.message,
        businessId: req.user?.businessId
      });

      if (error instanceof AppError) {
        return next(error);
      }

      next(new AppError(
        'Failed to fetch templates',
        500,
        'TEMPLATE_FETCH_ERROR',
        { originalError: error.message }
      ));
    }
  }
);

/**
 * @openapi
 * /qr/templates:
 *   post:
 *     summary: Create new QR print template
 *     description: Create a new custom QR print template for the business
 *     tags:
 *       - QR Templates
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateQRTemplate'
 *     responses:
 *       201:
 *         description: Template created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/QRTemplate'
 */
router.post('/', 
  requireAuth,
  templateRateLimit,
  validateRequest(createTemplateSchema),
  async (req, res, next) => {
    try {
      const { name, description, config, isPublic, tags } = req.body;
      const businessId = req.user.businessId;
      const userId = req.user.id;

      const templateData = {
        name,
        description,
        config,
        isPublic,
        tags,
        businessId,
        createdBy: userId
      };

      logger.info('Creating QR template', {
        businessId,
        name,
        isPublic
      });

      const qrService = await QRManagementService.create();
      const template = await qrService.createTemplate(templateData);

      res.status(201).json(template);

    } catch (error) {
      logger.error('Error creating template', {
        error: error.message,
        businessId: req.user?.businessId,
        templateName: req.body?.name
      });

      if (error instanceof AppError) {
        return next(error);
      }

      next(new AppError(
        'Failed to create template',
        500,
        'TEMPLATE_CREATE_ERROR',
        { originalError: error.message }
      ));
    }
  }
);

/**
 * @openapi
 * /qr/templates/{templateId}:
 *   get:
 *     summary: Get QR template by ID
 *     description: Retrieve a specific QR print template
 *     tags:
 *       - QR Templates
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Template ID
 *     responses:
 *       200:
 *         description: Template retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/QRTemplate'
 */
router.get('/:templateId', 
  requireAuth,
  templateRateLimit,
  async (req, res, next) => {
    try {
      const { templateId } = req.params;
      const businessId = req.user.businessId;

      logger.info('Fetching QR template', {
        templateId,
        businessId
      });

      const qrService = await QRManagementService.create();
      const template = await qrService.getTemplate(templateId, businessId);

      if (!template) {
        throw new AppError(
          'Template not found',
          404,
          'TEMPLATE_NOT_FOUND'
        );
      }

      res.status(200).json(template);

    } catch (error) {
      logger.error('Error fetching template', {
        error: error.message,
        templateId: req.params?.templateId,
        businessId: req.user?.businessId
      });

      if (error instanceof AppError) {
        return next(error);
      }

      next(new AppError(
        'Failed to fetch template',
        500,
        'TEMPLATE_FETCH_ERROR',
        { originalError: error.message }
      ));
    }
  }
);

/**
 * @openapi
 * /qr/templates/{templateId}:
 *   put:
 *     summary: Update QR template
 *     description: Update an existing QR print template
 *     tags:
 *       - QR Templates
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Template ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateQRTemplate'
 *     responses:
 *       200:
 *         description: Template updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/QRTemplate'
 */
router.put('/:templateId', 
  requireAuth,
  templateRateLimit,
  validateRequest(updateTemplateSchema),
  async (req, res, next) => {
    try {
      const { templateId } = req.params;
      const updateData = req.body;
      const businessId = req.user.businessId;
      const userId = req.user.id;

      logger.info('Updating QR template', {
        templateId,
        businessId,
        updatedBy: userId
      });

      const qrService = await QRManagementService.create();
      const template = await qrService.updateTemplate(templateId, {
        ...updateData,
        updatedBy: userId
      }, businessId);

      res.status(200).json(template);

    } catch (error) {
      logger.error('Error updating template', {
        error: error.message,
        templateId: req.params?.templateId,
        businessId: req.user?.businessId
      });

      if (error instanceof AppError) {
        return next(error);
      }

      next(new AppError(
        'Failed to update template',
        500,
        'TEMPLATE_UPDATE_ERROR',
        { originalError: error.message }
      ));
    }
  }
);

/**
 * @openapi
 * /qr/templates/{templateId}:
 *   delete:
 *     summary: Delete QR template
 *     description: Delete a QR print template (soft delete)
 *     tags:
 *       - QR Templates
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Template ID
 *     responses:
 *       200:
 *         description: Template deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Template deleted successfully"
 */
router.delete('/:templateId', 
  requireAuth,
  templateRateLimit,
  async (req, res, next) => {
    try {
      const { templateId } = req.params;
      const businessId = req.user.businessId;
      const userId = req.user.id;

      logger.info('Deleting QR template', {
        templateId,
        businessId,
        deletedBy: userId
      });

      const qrService = await QRManagementService.create();
      await qrService.deleteTemplate(templateId, businessId, userId);

      res.status(200).json({
        success: true,
        message: 'Template deleted successfully'
      });

    } catch (error) {
      logger.error('Error deleting template', {
        error: error.message,
        templateId: req.params?.templateId,
        businessId: req.user?.businessId
      });

      if (error instanceof AppError) {
        return next(error);
      }

      next(new AppError(
        'Failed to delete template',
        500,
        'TEMPLATE_DELETE_ERROR',
        { originalError: error.message }
      ));
    }
  }
);

/**
 * @openapi
 * /qr/templates/{templateId}/duplicate:
 *   post:
 *     summary: Duplicate QR template
 *     description: Create a copy of an existing QR print template
 *     tags:
 *       - QR Templates
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Template ID to duplicate
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: New template name (optional)
 *     responses:
 *       201:
 *         description: Template duplicated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/QRTemplate'
 */
router.post('/:templateId/duplicate', 
  requireAuth,
  templateRateLimit,
  async (req, res, next) => {
    try {
      const { templateId } = req.params;
      const { name } = req.body;
      const businessId = req.user.businessId;
      const userId = req.user.id;

      logger.info('Duplicating QR template', {
        templateId,
        businessId,
        newName: name,
        createdBy: userId
      });

      const qrService = await QRManagementService.create();
      const template = await qrService.duplicateTemplate(templateId, businessId, {
        name,
        createdBy: userId
      });

      res.status(201).json(template);

    } catch (error) {
      logger.error('Error duplicating template', {
        error: error.message,
        templateId: req.params?.templateId,
        businessId: req.user?.businessId
      });

      if (error instanceof AppError) {
        return next(error);
      }

      next(new AppError(
        'Failed to duplicate template',
        500,
        'TEMPLATE_DUPLICATE_ERROR',
        { originalError: error.message }
      ));
    }
  }
);

/**
 * @openapi
 * /qr/templates/{templateId}/preview:
 *   post:
 *     summary: Preview QR template
 *     description: Generate a preview of the QR template without saving
 *     tags:
 *       - QR Templates
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Template ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               storeId:
 *                 type: string
 *                 format: uuid
 *                 description: Store ID for preview context
 *               format:
 *                 type: string
 *                 enum: [pdf, png, svg]
 *                 default: png
 *                 description: Preview format
 *     responses:
 *       200:
 *         description: Template preview generated
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *           image/png:
 *             schema:
 *               type: string
 *               format: binary
 *           image/svg+xml:
 *             schema:
 *               type: string
 */
router.post('/:templateId/preview', 
  requireAuth,
  templateRateLimit,
  async (req, res, next) => {
    try {
      const { templateId } = req.params;
      const { storeId, format = 'png' } = req.body;
      const businessId = req.user.businessId;

      logger.info('Generating template preview', {
        templateId,
        storeId,
        format,
        businessId
      });

      const qrService = await QRManagementService.create();
      const preview = await qrService.previewTemplate(templateId, {
        storeId,
        format,
        businessId
      });

      // Set appropriate content type
      const contentTypes = {
        pdf: 'application/pdf',
        png: 'image/png',
        svg: 'image/svg+xml'
      };

      res.setHeader('Content-Type', contentTypes[format]);
      res.setHeader('Content-Disposition', `inline; filename="template-preview.${format}"`);
      
      if (format === 'svg') {
        res.send(preview);
      } else {
        res.send(Buffer.from(preview, 'base64'));
      }

    } catch (error) {
      logger.error('Error generating template preview', {
        error: error.message,
        templateId: req.params?.templateId,
        businessId: req.user?.businessId
      });

      if (error instanceof AppError) {
        return next(error);
      }

      next(new AppError(
        'Failed to generate template preview',
        500,
        'TEMPLATE_PREVIEW_ERROR',
        { originalError: error.message }
      ));
    }
  }
);

export default router;