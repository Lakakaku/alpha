// GET /qr/stores/{storeId}/download - Download QR code as PDF
// Generates customizable PDF templates for printing QR codes

import { Request, Response } from 'express';
import { z } from 'zod';
import { QRManagementService } from '../../services/qr/qr-management.service';
import { QRValidationError, QRPermissionError } from '@vocilia/types/qr';
import type { QRDownloadRequest, QRDownloadResponse, PageSize } from '@vocilia/types/qr';

// Request validation schemas
const DownloadQRParamsSchema = z.object({
  storeId: z.string().uuid('Invalid store ID format')
});

const DownloadQRQuerySchema = z.object({
  template_id: z.string().uuid('Invalid template ID format').optional(),
  page_size: z.enum(['A4', 'letter', 'business_card', 'label_sheet']).optional(),
  format: z.enum(['pdf', 'png', 'svg']).optional().default('pdf'),
  // Custom template options (for one-off customizations)
  qr_size: z.number().int().min(50).max(300).optional(),
  include_logo: z.enum(['true', 'false']).optional(),
  custom_text: z.string().max(200).optional(),
  text_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color format').optional(),
  background_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color format').optional(),
  border_style: z.enum(['none', 'thin', 'thick', 'dashed']).optional()
});

// Response interface
interface DownloadQRAPIResponse {
  success: boolean;
  data?: QRDownloadResponse;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
}

export async function downloadQR(
  req: Request,
  res: Response<DownloadQRAPIResponse>
): Promise<void> {
  try {
    // Validate request parameters
    const paramsValidation = DownloadQRParamsSchema.safeParse(req.params);
    if (!paramsValidation.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PARAMS',
          message: 'Invalid request parameters',
          details: paramsValidation.error.format()
        }
      });
      return;
    }

    const queryValidation = DownloadQRQuerySchema.safeParse(req.query);
    if (!queryValidation.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_QUERY',
          message: 'Invalid query parameters',
          details: queryValidation.error.format()
        }
      });
      return;
    }

    const { storeId } = paramsValidation.data;
    const queryParams = queryValidation.data;

    // Get business ID from authenticated context
    const businessId = req.user?.business_id;
    if (!businessId) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Business authentication required'
        }
      });
      return;
    }

    // Get QR management service
    const qrService = req.app.locals.qrManagementService as QRManagementService;
    if (!qrService) {
      res.status(500).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'QR management service not available'
        }
      });
      return;
    }

    // Build download request
    const downloadRequest: QRDownloadRequest = {
      template_id: queryParams.template_id,
      page_size: queryParams.page_size as PageSize,
      custom_options: {}
    };

    // Add custom options if provided
    if (queryParams.qr_size !== undefined) {
      downloadRequest.custom_options!.qr_size = queryParams.qr_size;
    }
    if (queryParams.include_logo !== undefined) {
      downloadRequest.custom_options!.include_logo = queryParams.include_logo === 'true';
    }
    if (queryParams.custom_text !== undefined) {
      downloadRequest.custom_options!.custom_text = queryParams.custom_text;
    }
    if (queryParams.text_color !== undefined) {
      downloadRequest.custom_options!.text_color = queryParams.text_color;
    }
    if (queryParams.background_color !== undefined) {
      downloadRequest.custom_options!.background_color = queryParams.background_color;
    }
    if (queryParams.border_style !== undefined) {
      downloadRequest.custom_options!.border_style = queryParams.border_style as any;
    }

    // Handle different format requests
    if (queryParams.format === 'png' || queryParams.format === 'svg') {
      // For non-PDF formats, generate QR code directly
      const result = await handleNonPDFDownload(
        qrService,
        storeId,
        businessId,
        queryParams.format,
        queryParams.qr_size || 512
      );
      
      res.status(200).json({
        success: true,
        data: result
      });
      return;
    }

    // Generate PDF download
    const result = await qrService.downloadQR(storeId, businessId, downloadRequest);

    // Log download request for analytics
    console.log('QR download requested:', {
      storeId,
      businessId,
      format: queryParams.format,
      templateId: queryParams.template_id,
      pageSize: queryParams.page_size,
      hasCustomOptions: Object.keys(downloadRequest.custom_options || {}).length > 0,
      timestamp: new Date().toISOString()
    });

    res.status(200).json({
      success: true,
      data: result
    });

  } catch (error: any) {
    console.error('Error in downloadQR:', error);

    // Handle specific error types
    if (error instanceof QRValidationError) {
      let statusCode = 400;
      
      switch (error.code) {
        case 'STORE_NOT_FOUND':
          statusCode = 404;
          break;
        case 'TEMPLATE_NOT_FOUND':
          statusCode = 404;
          break;
        case 'PDF_GENERATION_FAILED':
          statusCode = 500;
          break;
        case 'DOWNLOAD_GENERATION_FAILED':
          statusCode = 500;
          break;
        default:
          statusCode = 400;
      }

      res.status(statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        }
      });
      return;
    }

    if (error instanceof QRPermissionError) {
      res.status(403).json({
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: error.message,
          details: { storeId: error.storeId }
        }
      });
      return;
    }

    // Generic error response
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An internal error occurred while generating QR download'
      }
    });
  }
}

// Helper function for non-PDF downloads
async function handleNonPDFDownload(
  qrService: QRManagementService,
  storeId: string,
  businessId: string,
  format: 'png' | 'svg',
  size: number
): Promise<QRDownloadResponse> {
  // Get store information
  const storeInfo = await qrService.getStoreQR(storeId, businessId, false);
  
  // Get QR generator from management service
  const qrGenerator = (qrService as any).qrGenerator;
  
  let qrData: string;
  let fileName: string;
  let mimeType: string;

  if (format === 'svg') {
    qrData = await qrGenerator.generateQRCodeSVG(storeId);
    fileName = `qr-code-${storeInfo.store.name.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().slice(0, 10)}.svg`;
    mimeType = 'image/svg+xml';
  } else {
    qrData = await qrGenerator.generateQRCode(storeId);
    fileName = `qr-code-${storeInfo.store.name.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().slice(0, 10)}.png`;
    mimeType = 'image/png';
  }

  // In a real implementation, you'd upload to cloud storage and return a signed URL
  const downloadUrl = `/api/qr/download/${storeId}/temp/${Date.now()}.${format}`;
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

  return {
    success: true,
    download_url: downloadUrl,
    file_name: fileName,
    file_size: qrData.length,
    expires_at: expiresAt
  };
}

// Route handler configuration
export const downloadQRRouteConfig = {
  path: '/qr/stores/:storeId/download',
  method: 'GET' as const,
  handler: downloadQR,
  middleware: [
    'authenticateToken',      // Verify JWT token
    'requireBusinessAuth',    // Ensure business authentication
    'validateStoreAccess'     // Validate store belongs to business
  ],
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50,                  // Limit to 50 downloads per 15 minutes per business
    keyGenerator: (req: Request) => `qr_download:${req.user?.business_id}`,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many download requests. Please wait before downloading again.'
      }
    }
  },
  cache: {
    ttl: 300,                 // Cache for 5 minutes
    key: (req: Request) => {
      const query = new URLSearchParams(req.query as any).toString();
      return `qr_download:${req.params.storeId}:${query}`;
    }
  }
};

// OpenAPI specification
export const downloadQROpenAPISpec = {
  '/qr/stores/{storeId}/download': {
    get: {
      tags: ['QR Management'],
      summary: 'Download QR code as PDF, PNG, or SVG',
      description: 'Generates a downloadable QR code file with customizable templates and formatting options',
      security: [{ BearerAuth: [] }],
      parameters: [
        {
          name: 'storeId',
          in: 'path',
          required: true,
          description: 'UUID of the store',
          schema: {
            type: 'string',
            format: 'uuid',
            example: '123e4567-e89b-12d3-a456-426614174000'
          }
        },
        {
          name: 'template_id',
          in: 'query',
          required: false,
          description: 'UUID of the PDF template to use (PDF format only)',
          schema: {
            type: 'string',
            format: 'uuid'
          }
        },
        {
          name: 'page_size',
          in: 'query',
          required: false,
          description: 'Page size for PDF generation',
          schema: {
            type: 'string',
            enum: ['A4', 'letter', 'business_card', 'label_sheet'],
            default: 'A4'
          }
        },
        {
          name: 'format',
          in: 'query',
          required: false,
          description: 'Output format for the QR code',
          schema: {
            type: 'string',
            enum: ['pdf', 'png', 'svg'],
            default: 'pdf'
          }
        },
        {
          name: 'qr_size',
          in: 'query',
          required: false,
          description: 'QR code size in pixels (50-300)',
          schema: {
            type: 'integer',
            minimum: 50,
            maximum: 300,
            default: 200
          }
        },
        {
          name: 'include_logo',
          in: 'query',
          required: false,
          description: 'Whether to include business logo in PDF',
          schema: {
            type: 'string',
            enum: ['true', 'false'],
            default: 'false'
          }
        },
        {
          name: 'custom_text',
          in: 'query',
          required: false,
          description: 'Custom text to include in PDF (max 200 characters)',
          schema: {
            type: 'string',
            maxLength: 200,
            example: 'Scan to leave feedback'
          }
        },
        {
          name: 'text_color',
          in: 'query',
          required: false,
          description: 'Text color in hex format',
          schema: {
            type: 'string',
            pattern: '^#[0-9A-Fa-f]{6}$',
            example: '#000000'
          }
        },
        {
          name: 'background_color',
          in: 'query',
          required: false,
          description: 'Background color in hex format',
          schema: {
            type: 'string',
            pattern: '^#[0-9A-Fa-f]{6}$',
            example: '#FFFFFF'
          }
        },
        {
          name: 'border_style',
          in: 'query',
          required: false,
          description: 'Border style for PDF',
          schema: {
            type: 'string',
            enum: ['none', 'thin', 'thick', 'dashed'],
            default: 'thin'
          }
        }
      ],
      responses: {
        200: {
          description: 'Download URL generated successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  data: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      download_url: { 
                        type: 'string', 
                        format: 'uri',
                        example: 'https://api.vocilia.com/qr/download/temp/abc123.pdf'
                      },
                      file_name: { 
                        type: 'string', 
                        example: 'qr-code-downtown-store-2024-12-20.pdf'
                      },
                      file_size: { 
                        type: 'integer', 
                        description: 'File size in bytes',
                        example: 156240
                      },
                      expires_at: { 
                        type: 'string', 
                        format: 'date-time',
                        description: 'When the download URL expires',
                        example: '2024-12-20T16:30:00Z'
                      }
                    }
                  }
                }
              }
            }
          }
        },
        400: {
          description: 'Invalid request parameters'
        },
        401: {
          description: 'Unauthorized - Business authentication required'
        },
        403: {
          description: 'Forbidden - Access denied to store'
        },
        404: {
          description: 'Store or template not found'
        },
        429: {
          description: 'Rate limited - Too many download requests'
        },
        500: {
          description: 'Internal server error'
        }
      }
    }
  }
};