// POST /qr/stores/{storeId}/regenerate - Regenerate QR code for a store
// Handles QR code regeneration with transition period and audit logging

import { Request, Response } from 'express';
import { z } from 'zod';
import { QRManagementService } from '../../services/qr/qr-management.service';
import { QRValidationError, QRPermissionError } from '@vocilia/types/qr';
import type { QRRegenerateRequest, QRRegenerateResponse } from '@vocilia/types/qr';

// Request validation schemas
const RegenerateQRParamsSchema = z.object({
  storeId: z.string().uuid('Invalid store ID format')
});

const RegenerateQRBodySchema = z.object({
  reason: z.string()
    .min(5, 'Reason must be at least 5 characters')
    .max(500, 'Reason must be less than 500 characters'),
  transition_hours: z.number()
    .int('Transition hours must be an integer')
    .min(1, 'Transition period must be at least 1 hour')
    .max(168, 'Transition period cannot exceed 168 hours (1 week)')
    .optional()
    .default(24)
});

// Response interface
interface RegenerateQRAPIResponse {
  success: boolean;
  data?: QRRegenerateResponse;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
}

export async function regenerateQR(
  req: Request,
  res: Response<RegenerateQRAPIResponse>
): Promise<void> {
  try {
    // Validate request parameters
    const paramsValidation = RegenerateQRParamsSchema.safeParse(req.params);
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

    const bodyValidation = RegenerateQRBodySchema.safeParse(req.body);
    if (!bodyValidation.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_BODY',
          message: 'Invalid request body',
          details: bodyValidation.error.format()
        }
      });
      return;
    }

    const { storeId } = paramsValidation.data;
    const regenerateRequest: QRRegenerateRequest = bodyValidation.data;

    // Get business ID and user ID from authenticated context
    const businessId = req.user?.business_id;
    const userId = req.user?.id;

    if (!businessId || !userId) {
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

    // Check rate limiting for regeneration requests
    const rateLimitKey = `qr_regen:${businessId}:${storeId}`;
    const recentRegenerations = await checkRecentRegenerations(rateLimitKey);
    
    if (recentRegenerations >= 3) {
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many regeneration requests. Please wait before regenerating again.',
          details: { 
            maxRegenPerHour: 3,
            resetTime: new Date(Date.now() + 60 * 60 * 1000).toISOString()
          }
        }
      });
      return;
    }

    // Regenerate QR code
    const result = await qrService.regenerateStoreQR(
      storeId,
      businessId,
      regenerateRequest,
      userId
    );

    // Update rate limiting counter
    await incrementRegenerationCounter(rateLimitKey);

    // Log regeneration for audit
    console.log('QR code regenerated successfully:', {
      storeId,
      businessId,
      userId,
      newVersion: result.new_qr_version,
      reason: regenerateRequest.reason,
      transitionHours: regenerateRequest.transition_hours,
      timestamp: new Date().toISOString()
    });

    res.status(200).json({
      success: true,
      data: result
    });

  } catch (error: any) {
    console.error('Error in regenerateQR:', error);

    // Handle specific error types
    if (error instanceof QRValidationError) {
      let statusCode = 400;
      
      // Map specific error codes to appropriate HTTP status codes
      switch (error.code) {
        case 'STORE_NOT_FOUND':
          statusCode = 404;
          break;
        case 'QR_PENDING_REGENERATION':
          statusCode = 409; // Conflict
          break;
        case 'QR_REGENERATION_FAILED':
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
        message: 'An internal error occurred while regenerating QR code'
      }
    });
  }
}

// Helper functions for rate limiting
async function checkRecentRegenerations(rateLimitKey: string): Promise<number> {
  // In a real implementation, this would use Redis or similar
  // For now, return a mock value
  return 0;
}

async function incrementRegenerationCounter(rateLimitKey: string): Promise<void> {
  // In a real implementation, this would increment a Redis counter with TTL
  console.log(`Incrementing regeneration counter for key: ${rateLimitKey}`);
}

// Route handler configuration
export const regenerateQRRouteConfig = {
  path: '/qr/stores/:storeId/regenerate',
  method: 'POST' as const,
  handler: regenerateQR,
  middleware: [
    'authenticateToken',      // Verify JWT token
    'requireBusinessAuth',    // Ensure business authentication
    'validateStoreAccess',    // Validate store belongs to business
    'requireQRPermissions'    // Ensure user has QR management permissions
  ],
  rateLimit: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,                   // Limit to 5 regenerations per hour per business
    keyGenerator: (req: Request) => `qr_regen:${req.user?.business_id}`,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many QR regeneration requests. Please wait before trying again.'
      }
    }
  },
  validation: {
    body: RegenerateQRBodySchema,
    params: RegenerateQRParamsSchema
  }
};

// OpenAPI specification
export const regenerateQROpenAPISpec = {
  '/qr/stores/{storeId}/regenerate': {
    post: {
      tags: ['QR Management'],
      summary: 'Regenerate QR code for a store',
      description: 'Creates a new QR code version with a transition period for seamless updates',
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
        }
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['reason'],
              properties: {
                reason: {
                  type: 'string',
                  minLength: 5,
                  maxLength: 500,
                  description: 'Reason for regenerating the QR code',
                  example: 'Security update - potential compromise detected'
                },
                transition_hours: {
                  type: 'integer',
                  minimum: 1,
                  maximum: 168,
                  default: 24,
                  description: 'Hours to maintain both old and new QR codes (1-168 hours)',
                  example: 48
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'QR code regenerated successfully',
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
                      store_id: { type: 'string', format: 'uuid' },
                      new_qr_version: { type: 'integer', example: 4 },
                      new_qr_data: { 
                        type: 'string', 
                        description: 'Base64 encoded QR code image data',
                        example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...'
                      },
                      transition_until: { 
                        type: 'string', 
                        format: 'date-time',
                        example: '2024-12-20T15:30:00Z'
                      },
                      message: { 
                        type: 'string', 
                        example: 'QR code regenerated successfully'
                      }
                    }
                  }
                }
              }
            }
          }
        },
        400: {
          description: 'Invalid request parameters or body',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  error: {
                    type: 'object',
                    properties: {
                      code: { 
                        type: 'string', 
                        enum: ['INVALID_PARAMS', 'INVALID_BODY'],
                        example: 'INVALID_BODY'
                      },
                      message: { type: 'string', example: 'Invalid request body' },
                      details: { type: 'object' }
                    }
                  }
                }
              }
            }
          }
        },
        401: {
          description: 'Unauthorized - Business authentication required'
        },
        403: {
          description: 'Forbidden - Access denied to store or insufficient permissions'
        },
        404: {
          description: 'Store not found'
        },
        409: {
          description: 'Conflict - QR code regeneration already in progress',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  error: {
                    type: 'object',
                    properties: {
                      code: { type: 'string', example: 'QR_PENDING_REGENERATION' },
                      message: { 
                        type: 'string', 
                        example: 'Store QR code is already pending regeneration'
                      },
                      details: {
                        type: 'object',
                        properties: {
                          storeId: { type: 'string', format: 'uuid' },
                          currentStatus: { type: 'string', example: 'pending_regeneration' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        429: {
          description: 'Rate limited - Too many regeneration requests',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  error: {
                    type: 'object',
                    properties: {
                      code: { type: 'string', example: 'RATE_LIMITED' },
                      message: { 
                        type: 'string', 
                        example: 'Too many regeneration requests. Please wait before regenerating again.'
                      },
                      details: {
                        type: 'object',
                        properties: {
                          maxRegenPerHour: { type: 'integer', example: 3 },
                          resetTime: { type: 'string', format: 'date-time' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        500: {
          description: 'Internal server error'
        }
      }
    }
  }
};