// GET /qr/stores/{storeId} - Get QR code information for a store
// Returns store QR data, statistics, and analytics summary

import { Request, Response } from 'express';
import { z } from 'zod';
import { QRManagementService } from '../../services/qr/qr-management.service';
import { QRValidationError, QRPermissionError } from '@vocilia/types/qr';

// Request validation schemas
const GetStoreQRParamsSchema = z.object({
  storeId: z.string().uuid('Invalid store ID format')
});

const GetStoreQRQuerySchema = z.object({
  include_analytics: z.enum(['true', 'false']).optional().default('true'),
  analytics_period: z.enum(['day', 'week', 'month']).optional().default('week')
});

// Response interfaces
interface GetStoreQRResponse {
  success: boolean;
  data?: {
    store: {
      id: string;
      business_id: string;
      name: string;
      qr_code_data: string;
      qr_status: string;
      qr_generated_at: string;
      qr_version: number;
      qr_transition_until: string | null;
      verification_status: string;
    };
    qr_stats: {
      current_version: number;
      total_regenerations: number;
      last_regenerated: string | null;
      qr_data_size: number;
      status: string;
      transition_active: boolean;
      transition_until: string | null;
    };
    analytics_summary?: {
      today_scans: number;
      week_scans: number;
      unique_sessions_week: number;
      trend: 'up' | 'down' | 'stable';
    };
  };
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
}

export async function getStoreQR(
  req: Request,
  res: Response<GetStoreQRResponse>
): Promise<void> {
  try {
    // Validate request parameters
    const paramsValidation = GetStoreQRParamsSchema.safeParse(req.params);
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

    const queryValidation = GetStoreQRQuerySchema.safeParse(req.query);
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
    const { include_analytics } = queryValidation.data;

    // Get business ID from authenticated user context
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

    // Get QR management service from request context
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

    // Get store QR information
    const includeAnalytics = include_analytics === 'true';
    const result = await qrService.getStoreQR(storeId, businessId, includeAnalytics);

    // Transform response data
    const responseData = {
      store: {
        id: result.store.id,
        business_id: result.store.business_id,
        name: result.store.name,
        qr_code_data: result.store.qr_code_data,
        qr_status: result.store.qr_status,
        qr_generated_at: result.store.qr_generated_at,
        qr_version: result.store.qr_version,
        qr_transition_until: result.store.qr_transition_until,
        verification_status: result.store.verification_status
      },
      qr_stats: result.qr_stats,
      analytics_summary: result.analytics_summary
    };

    res.status(200).json({
      success: true,
      data: responseData
    });

  } catch (error: any) {
    console.error('Error in getStoreQR:', error);

    // Handle specific error types
    if (error instanceof QRValidationError) {
      const statusCode = error.code === 'STORE_NOT_FOUND' ? 404 : 400;
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
        message: 'An internal error occurred while retrieving store QR information'
      }
    });
  }
}

// Route handler configuration
export const storeQRRouteConfig = {
  path: '/qr/stores/:storeId',
  method: 'GET' as const,
  handler: getStoreQR,
  middleware: [
    'authenticateToken',      // Verify JWT token
    'requireBusinessAuth',    // Ensure business authentication
    'validateStoreAccess'     // Validate store belongs to business
  ],
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100                   // Limit each business to 100 requests per windowMs
  },
  cache: {
    ttl: 60,                  // Cache for 60 seconds
    key: (req: Request) => `store_qr:${req.params.storeId}:${req.user?.business_id}`
  }
};

// OpenAPI specification for documentation
export const storeQROpenAPISpec = {
  '/qr/stores/{storeId}': {
    get: {
      tags: ['QR Management'],
      summary: 'Get QR code information for a store',
      description: 'Retrieves QR code data, statistics, and optional analytics summary for a specific store',
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
          name: 'include_analytics',
          in: 'query',
          required: false,
          description: 'Whether to include analytics summary',
          schema: {
            type: 'string',
            enum: ['true', 'false'],
            default: 'true'
          }
        },
        {
          name: 'analytics_period',
          in: 'query',
          required: false,
          description: 'Period for analytics summary',
          schema: {
            type: 'string',
            enum: ['day', 'week', 'month'],
            default: 'week'
          }
        }
      ],
      responses: {
        200: {
          description: 'Store QR information retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  data: {
                    type: 'object',
                    properties: {
                      store: {
                        type: 'object',
                        properties: {
                          id: { type: 'string', format: 'uuid' },
                          business_id: { type: 'string', format: 'uuid' },
                          name: { type: 'string', example: 'Downtown Store' },
                          qr_code_data: { type: 'string', description: 'Base64 QR code image data' },
                          qr_status: { type: 'string', enum: ['active', 'inactive', 'pending_regeneration'] },
                          qr_generated_at: { type: 'string', format: 'date-time' },
                          qr_version: { type: 'integer', example: 3 },
                          qr_transition_until: { type: 'string', format: 'date-time', nullable: true },
                          verification_status: { type: 'string', example: 'verified' }
                        }
                      },
                      qr_stats: {
                        type: 'object',
                        properties: {
                          current_version: { type: 'integer', example: 3 },
                          total_regenerations: { type: 'integer', example: 2 },
                          last_regenerated: { type: 'string', format: 'date-time', nullable: true },
                          qr_data_size: { type: 'integer', example: 15420 },
                          status: { type: 'string', example: 'active' },
                          transition_active: { type: 'boolean', example: false },
                          transition_until: { type: 'string', format: 'date-time', nullable: true }
                        }
                      },
                      analytics_summary: {
                        type: 'object',
                        nullable: true,
                        properties: {
                          today_scans: { type: 'integer', example: 12 },
                          week_scans: { type: 'integer', example: 85 },
                          unique_sessions_week: { type: 'integer', example: 67 },
                          trend: { type: 'string', enum: ['up', 'down', 'stable'], example: 'up' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        400: {
          description: 'Invalid request parameters',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  error: {
                    type: 'object',
                    properties: {
                      code: { type: 'string', example: 'INVALID_PARAMS' },
                      message: { type: 'string', example: 'Invalid request parameters' },
                      details: { type: 'object' }
                    }
                  }
                }
              }
            }
          }
        },
        401: {
          description: 'Unauthorized - Business authentication required',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  error: {
                    type: 'object',
                    properties: {
                      code: { type: 'string', example: 'UNAUTHORIZED' },
                      message: { type: 'string', example: 'Business authentication required' }
                    }
                  }
                }
              }
            }
          }
        },
        403: {
          description: 'Forbidden - Access denied to store',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  error: {
                    type: 'object',
                    properties: {
                      code: { type: 'string', example: 'PERMISSION_DENIED' },
                      message: { type: 'string', example: 'Access denied to store' },
                      details: {
                        type: 'object',
                        properties: {
                          storeId: { type: 'string', format: 'uuid' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        404: {
          description: 'Store not found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  error: {
                    type: 'object',
                    properties: {
                      code: { type: 'string', example: 'STORE_NOT_FOUND' },
                      message: { type: 'string', example: 'Store not found' }
                    }
                  }
                }
              }
            }
          }
        },
        500: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  error: {
                    type: 'object',
                    properties: {
                      code: { type: 'string', example: 'INTERNAL_ERROR' },
                      message: { type: 'string', example: 'An internal error occurred while retrieving store QR information' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
};