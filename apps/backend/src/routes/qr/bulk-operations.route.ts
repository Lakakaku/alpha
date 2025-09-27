// POST /qr/bulk/regenerate - Bulk QR operations for multiple stores
// Handles bulk regeneration, activation, and deactivation operations

import { Request, Response } from 'express';
import { z } from 'zod';
import { QRManagementService } from '../../services/qr/qr-management.service';
import { QRValidationError, QRPermissionError } from '@vocilia/types/qr';
import type { QRBulkRequest, QRBulkResponse } from '@vocilia/types/qr';

// Request validation schemas
const BulkOperationBodySchema = z.object({
  store_ids: z.array(z.string().uuid('Invalid store ID format'))
    .min(1, 'At least one store ID is required')
    .max(50, 'Maximum 50 stores allowed per bulk operation'),
  operation: z.enum(['regenerate', 'activate', 'deactivate'], {
    errorMap: () => ({ message: 'Operation must be regenerate, activate, or deactivate' })
  }),
  reason: z.string()
    .min(5, 'Reason must be at least 5 characters')
    .max(500, 'Reason must be less than 500 characters'),
  transition_hours: z.number()
    .int('Transition hours must be an integer')
    .min(1, 'Transition period must be at least 1 hour')
    .max(168, 'Transition period cannot exceed 168 hours (1 week)')
    .optional()
    .default(24),
  batch_size: z.number()
    .int('Batch size must be an integer')
    .min(1, 'Batch size must be at least 1')
    .max(10, 'Batch size cannot exceed 10 for safety')
    .optional()
    .default(5),
  delay_between_batches: z.number()
    .int('Delay must be an integer')
    .min(0, 'Delay cannot be negative')
    .max(60, 'Delay cannot exceed 60 seconds')
    .optional()
    .default(2)
});

// Response interface
interface BulkOperationAPIResponse {
  success: boolean;
  data?: QRBulkResponse & {
    processing_info: {
      batch_size: number;
      total_batches: number;
      estimated_duration_seconds: number;
      started_at: string;
      completed_at?: string;
    };
    detailed_results?: Array<{
      store_id: string;
      store_name?: string;
      success: boolean;
      error_message?: string;
      new_qr_version?: number;
      processing_time_ms?: number;
    }>;
  };
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
}

export async function bulkQROperation(
  req: Request,
  res: Response<BulkOperationAPIResponse>
): Promise<void> {
  const startTime = new Date();
  
  try {
    // Validate request body
    const bodyValidation = BulkOperationBodySchema.safeParse(req.body);
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

    const bulkRequest: QRBulkRequest & {
      batch_size?: number;
      delay_between_batches?: number;
    } = bodyValidation.data;

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

    // Check rate limiting for bulk operations
    const rateLimitKey = `bulk_qr:${businessId}`;
    const recentBulkOps = await checkRecentBulkOperations(rateLimitKey);
    
    if (recentBulkOps >= 3) {
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many bulk operations. Please wait before starting another bulk operation.',
          details: { 
            maxBulkOpsPerHour: 3,
            resetTime: new Date(Date.now() + 60 * 60 * 1000).toISOString()
          }
        }
      });
      return;
    }

    // Validate operation-specific constraints
    if (bulkRequest.operation === 'regenerate' && bulkRequest.store_ids.length > 20) {
      res.status(400).json({
        success: false,
        error: {
          code: 'OPERATION_LIMIT_EXCEEDED',
          message: 'Bulk regenerate operation limited to 20 stores per request for safety',
          details: { maxStoresForRegenerate: 20, requestedStores: bulkRequest.store_ids.length }
        }
      });
      return;
    }

    // Calculate processing estimates
    const totalBatches = Math.ceil(bulkRequest.store_ids.length / bulkRequest.batch_size!);
    const estimatedDurationSeconds = (totalBatches * 5) + ((totalBatches - 1) * bulkRequest.delay_between_batches!);

    console.log('Starting bulk QR operation:', {
      operation: bulkRequest.operation,
      storeCount: bulkRequest.store_ids.length,
      businessId,
      userId,
      batchSize: bulkRequest.batch_size,
      estimatedDuration: estimatedDurationSeconds,
      timestamp: startTime.toISOString()
    });

    // For large operations, consider using background processing
    if (bulkRequest.store_ids.length > 10) {
      // In a real implementation, this would start a background job
      console.log('Large bulk operation detected, consider background processing');
    }

    // Execute bulk operation
    const result = await qrService.bulkQROperation(
      bulkRequest,
      businessId,
      userId
    );

    // Get detailed store information for enhanced response
    const detailedResults = await enrichResultsWithStoreInfo(qrService, result, businessId);

    // Update rate limiting counter
    await incrementBulkOperationCounter(rateLimitKey);

    const completedAt = new Date();
    const actualDurationMs = completedAt.getTime() - startTime.getTime();

    // Build enhanced response
    const enhancedResponse: BulkOperationAPIResponse['data'] = {
      ...result,
      processing_info: {
        batch_size: bulkRequest.batch_size!,
        total_batches: totalBatches,
        estimated_duration_seconds: estimatedDurationSeconds,
        started_at: startTime.toISOString(),
        completed_at: completedAt.toISOString()
      },
      detailed_results: detailedResults
    };

    // Log completion
    console.log('Bulk QR operation completed:', {
      operation: bulkRequest.operation,
      batchId: result.batch_operation_id,
      successful: result.successful_operations,
      failed: result.failed_operations,
      actualDurationMs,
      businessId,
      userId
    });

    res.status(200).json({
      success: true,
      data: enhancedResponse
    });

  } catch (error: any) {
    console.error('Error in bulkQROperation:', error);

    // Handle specific error types
    if (error instanceof QRValidationError) {
      let statusCode = 400;
      
      switch (error.code) {
        case 'BULK_OPERATION_FAILED':
          statusCode = 500;
          break;
        case 'INVALID_OPERATION':
          statusCode = 400;
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
        message: 'An internal error occurred while executing bulk QR operation'
      }
    });
  }
}

// Helper functions
async function checkRecentBulkOperations(rateLimitKey: string): Promise<number> {
  // In a real implementation, this would use Redis or similar
  // For now, return a mock value
  return 0;
}

async function incrementBulkOperationCounter(rateLimitKey: string): Promise<void> {
  // In a real implementation, this would increment a Redis counter with TTL
  console.log(`Incrementing bulk operation counter for key: ${rateLimitKey}`);
}

async function enrichResultsWithStoreInfo(
  qrService: QRManagementService,
  result: QRBulkResponse,
  businessId: string
): Promise<Array<{
  store_id: string;
  store_name?: string;
  success: boolean;
  error_message?: string;
  new_qr_version?: number;
  processing_time_ms?: number;
}>> {
  try {
    // Get business stores for name mapping
    const businessStores = await qrService.getBusinessStores(businessId);
    const storeNameMap = new Map(businessStores.stores.map(s => [s.id, s.name]));

    return result.results.map(r => ({
      store_id: r.store_id,
      store_name: storeNameMap.get(r.store_id),
      success: r.success,
      error_message: r.error_message,
      new_qr_version: r.new_qr_version,
      processing_time_ms: Math.floor(Math.random() * 1000) + 100 // Mock processing time
    }));
  } catch (error) {
    // Return basic results if enrichment fails
    return result.results.map(r => ({
      store_id: r.store_id,
      success: r.success,
      error_message: r.error_message,
      new_qr_version: r.new_qr_version
    }));
  }
}

// Route handler configuration
export const bulkOperationRouteConfig = {
  path: '/qr/bulk/regenerate',
  method: 'POST' as const,
  handler: bulkQROperation,
  middleware: [
    'authenticateToken',      // Verify JWT token
    'requireBusinessAuth',    // Ensure business authentication
    'requireBulkQRPermissions', // Ensure user has bulk operation permissions
    'validateBusinessStores'  // Pre-validate store access
  ],
  rateLimit: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3,                   // Limit to 3 bulk operations per hour per business
    keyGenerator: (req: Request) => `bulk_qr:${req.user?.business_id}`,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many bulk QR operations. Please wait before starting another bulk operation.'
      }
    }
  },
  timeout: 300000, // 5 minutes timeout for bulk operations
  validation: {
    body: BulkOperationBodySchema
  }
};

// OpenAPI specification
export const bulkOperationOpenAPISpec = {
  '/qr/bulk/regenerate': {
    post: {
      tags: ['QR Management'],
      summary: 'Execute bulk QR operations',
      description: 'Performs bulk regeneration, activation, or deactivation of QR codes for multiple stores',
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['store_ids', 'operation', 'reason'],
              properties: {
                store_ids: {
                  type: 'array',
                  items: { type: 'string', format: 'uuid' },
                  minItems: 1,
                  maxItems: 50,
                  description: 'Array of store UUIDs to operate on',
                  example: [
                    '123e4567-e89b-12d3-a456-426614174000',
                    '987fcdeb-51a2-43d1-9f45-123456789abc'
                  ]
                },
                operation: {
                  type: 'string',
                  enum: ['regenerate', 'activate', 'deactivate'],
                  description: 'Bulk operation to perform',
                  example: 'regenerate'
                },
                reason: {
                  type: 'string',
                  minLength: 5,
                  maxLength: 500,
                  description: 'Reason for the bulk operation',
                  example: 'Monthly security update - regenerating all QR codes'
                },
                transition_hours: {
                  type: 'integer',
                  minimum: 1,
                  maximum: 168,
                  default: 24,
                  description: 'Hours to maintain both old and new QR codes (regenerate only)',
                  example: 48
                },
                batch_size: {
                  type: 'integer',
                  minimum: 1,
                  maximum: 10,
                  default: 5,
                  description: 'Number of stores to process in each batch',
                  example: 5
                },
                delay_between_batches: {
                  type: 'integer',
                  minimum: 0,
                  maximum: 60,
                  default: 2,
                  description: 'Delay in seconds between processing batches',
                  example: 3
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Bulk operation completed successfully',
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
                      total_stores: { type: 'integer', example: 15 },
                      successful_operations: { type: 'integer', example: 13 },
                      failed_operations: { type: 'integer', example: 2 },
                      batch_operation_id: { 
                        type: 'string', 
                        format: 'uuid',
                        description: 'Unique identifier for this bulk operation'
                      },
                      message: { 
                        type: 'string', 
                        example: 'Bulk operation completed: 13 successful, 2 failed'
                      },
                      processing_info: {
                        type: 'object',
                        properties: {
                          batch_size: { type: 'integer', example: 5 },
                          total_batches: { type: 'integer', example: 3 },
                          estimated_duration_seconds: { type: 'integer', example: 19 },
                          started_at: { type: 'string', format: 'date-time' },
                          completed_at: { type: 'string', format: 'date-time' }
                        }
                      },
                      results: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            store_id: { type: 'string', format: 'uuid' },
                            success: { type: 'boolean' },
                            error_message: { type: 'string', nullable: true },
                            new_qr_version: { type: 'integer', nullable: true }
                          }
                        }
                      },
                      detailed_results: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            store_id: { type: 'string', format: 'uuid' },
                            store_name: { type: 'string', nullable: true },
                            success: { type: 'boolean' },
                            error_message: { type: 'string', nullable: true },
                            new_qr_version: { type: 'integer', nullable: true },
                            processing_time_ms: { type: 'integer', nullable: true }
                          }
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
          description: 'Invalid request body or operation limits exceeded',
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
                        enum: ['INVALID_BODY', 'OPERATION_LIMIT_EXCEEDED'],
                        example: 'OPERATION_LIMIT_EXCEEDED'
                      },
                      message: { 
                        type: 'string', 
                        example: 'Bulk regenerate operation limited to 20 stores per request for safety'
                      },
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
          description: 'Forbidden - Insufficient permissions for bulk operations'
        },
        429: {
          description: 'Rate limited - Too many bulk operations',
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
                        example: 'Too many bulk operations. Please wait before starting another bulk operation.'
                      },
                      details: {
                        type: 'object',
                        properties: {
                          maxBulkOpsPerHour: { type: 'integer', example: 3 },
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