// GET /qr/analytics/{storeId} - Get QR code analytics for a store
// Returns scan analytics with time filtering and trend analysis

import { Request, Response } from 'express';
import { z } from 'zod';
import { QRManagementService } from '../../services/qr/qr-management.service';
import { QRValidationError, QRPermissionError } from '@vocilia/types/qr';
import type { QRAnalyticsRequest, QRAnalyticsResponse } from '@vocilia/types/qr';

// Request validation schemas
const AnalyticsParamsSchema = z.object({
  storeId: z.string().uuid('Invalid store ID format')
});

const AnalyticsQuerySchema = z.object({
  period: z.enum(['hour', 'day', 'week', 'month']).default('week'),
  start_date: z.string().datetime({ offset: true }).optional(),
  end_date: z.string().datetime({ offset: true }).optional(),
  timezone: z.string().optional().default('UTC'),
  include_trend: z.enum(['true', 'false']).optional().default('true'),
  include_comparison: z.enum(['true', 'false']).optional().default('false'),
  granularity: z.enum(['5min', 'hourly', 'daily']).optional()
});

// Extended response interface with additional analytics
interface AnalyticsAPIResponse {
  success: boolean;
  data?: QRAnalyticsResponse & {
    metadata: {
      period: string;
      timezone: string;
      data_points_count: number;
      time_range: {
        start: string;
        end: string;
      };
    };
    trend?: {
      direction: 'up' | 'down' | 'stable';
      change_percent: number;
      confidence: 'high' | 'medium' | 'low';
    };
    comparison?: {
      previous_period: {
        total_scans: number;
        unique_sessions: number;
        change_percent: number;
      };
    };
    insights?: Array<{
      type: 'peak_time' | 'trend' | 'anomaly' | 'recommendation';
      message: string;
      data?: Record<string, any>;
    }>;
  };
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
}

export async function getAnalytics(
  req: Request,
  res: Response<AnalyticsAPIResponse>
): Promise<void> {
  try {
    // Validate request parameters
    const paramsValidation = AnalyticsParamsSchema.safeParse(req.params);
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

    const queryValidation = AnalyticsQuerySchema.safeParse(req.query);
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

    // Build analytics request
    const analyticsRequest: QRAnalyticsRequest = {
      period: queryParams.period,
      start_date: queryParams.start_date,
      end_date: queryParams.end_date
    };

    // Apply timezone conversion if needed
    if (queryParams.timezone !== 'UTC') {
      analyticsRequest.start_date = convertToTimezone(analyticsRequest.start_date, queryParams.timezone);
      analyticsRequest.end_date = convertToTimezone(analyticsRequest.end_date, queryParams.timezone);
    }

    // Get base analytics
    const analytics = await qrService.getAnalytics(storeId, businessId, analyticsRequest);

    // Build metadata
    const metadata = {
      period: queryParams.period,
      timezone: queryParams.timezone,
      data_points_count: analytics.data_points.length,
      time_range: {
        start: analyticsRequest.start_date || calculateDefaultStartDate(queryParams.period),
        end: analyticsRequest.end_date || new Date().toISOString()
      }
    };

    // Enhanced response with optional features
    const enhancedResponse: AnalyticsAPIResponse['data'] = {
      ...analytics,
      metadata
    };

    // Add trend analysis if requested
    if (queryParams.include_trend === 'true') {
      enhancedResponse.trend = await calculateTrendAnalysis(analytics);
    }

    // Add comparison with previous period if requested
    if (queryParams.include_comparison === 'true') {
      enhancedResponse.comparison = await calculatePeriodComparison(
        qrService,
        storeId,
        businessId,
        analyticsRequest,
        queryParams.period
      );
    }

    // Generate insights
    enhancedResponse.insights = generateInsights(analytics, enhancedResponse.trend);

    // Log analytics request for usage tracking
    console.log('Analytics requested:', {
      storeId,
      businessId,
      period: queryParams.period,
      dataPoints: analytics.data_points.length,
      totalScans: analytics.total_scans,
      timezone: queryParams.timezone,
      timestamp: new Date().toISOString()
    });

    res.status(200).json({
      success: true,
      data: enhancedResponse
    });

  } catch (error: any) {
    console.error('Error in getAnalytics:', error);

    // Handle specific error types
    if (error instanceof QRValidationError) {
      let statusCode = 400;
      
      switch (error.code) {
        case 'STORE_NOT_FOUND':
          statusCode = 404;
          break;
        case 'ANALYTICS_RETRIEVAL_FAILED':
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
        message: 'An internal error occurred while retrieving analytics'
      }
    });
  }
}

// Helper functions
function convertToTimezone(dateString: string | undefined, timezone: string): string | undefined {
  if (!dateString) return undefined;
  
  // In a real implementation, use a proper timezone library like date-fns-tz
  // For now, return the original string
  return dateString;
}

function calculateDefaultStartDate(period: string): string {
  const now = new Date();
  switch (period) {
    case 'hour':
      return new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    case 'day':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    case 'week':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    case 'month':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    default:
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  }
}

async function calculateTrendAnalysis(analytics: QRAnalyticsResponse): Promise<{
  direction: 'up' | 'down' | 'stable';
  change_percent: number;
  confidence: 'high' | 'medium' | 'low';
}> {
  if (analytics.data_points.length < 4) {
    return {
      direction: 'stable',
      change_percent: 0,
      confidence: 'low'
    };
  }

  const dataPoints = analytics.data_points;
  const midPoint = Math.floor(dataPoints.length / 2);
  
  const firstHalf = dataPoints.slice(0, midPoint);
  const secondHalf = dataPoints.slice(midPoint);

  const firstHalfAvg = firstHalf.reduce((sum, p) => sum + p.scan_count, 0) / firstHalf.length;
  const secondHalfAvg = secondHalf.reduce((sum, p) => sum + p.scan_count, 0) / secondHalf.length;

  const changePercent = firstHalfAvg > 0 ? 
    Math.round(((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100) : 0;

  let direction: 'up' | 'down' | 'stable' = 'stable';
  if (Math.abs(changePercent) >= 5) {
    direction = changePercent > 0 ? 'up' : 'down';
  }

  // Determine confidence based on data consistency and sample size
  let confidence: 'high' | 'medium' | 'low' = 'medium';
  if (dataPoints.length >= 20) {
    confidence = 'high';
  } else if (dataPoints.length < 10) {
    confidence = 'low';
  }

  return {
    direction,
    change_percent: Math.abs(changePercent),
    confidence
  };
}

async function calculatePeriodComparison(
  qrService: QRManagementService,
  storeId: string,
  businessId: string,
  currentRequest: QRAnalyticsRequest,
  period: string
): Promise<{
  previous_period: {
    total_scans: number;
    unique_sessions: number;
    change_percent: number;
  };
}> {
  try {
    // Calculate previous period dates
    const currentStart = new Date(currentRequest.start_date || calculateDefaultStartDate(period));
    const currentEnd = new Date(currentRequest.end_date || new Date());
    const periodLength = currentEnd.getTime() - currentStart.getTime();

    const previousEnd = new Date(currentStart.getTime());
    const previousStart = new Date(currentStart.getTime() - periodLength);

    const previousRequest: QRAnalyticsRequest = {
      period: currentRequest.period,
      start_date: previousStart.toISOString(),
      end_date: previousEnd.toISOString()
    };

    const previousAnalytics = await qrService.getAnalytics(storeId, businessId, previousRequest);

    const currentScans = await qrService.getAnalytics(storeId, businessId, currentRequest);
    const changePercent = previousAnalytics.total_scans > 0 ? 
      Math.round(((currentScans.total_scans - previousAnalytics.total_scans) / previousAnalytics.total_scans) * 100) : 0;

    return {
      previous_period: {
        total_scans: previousAnalytics.total_scans,
        unique_sessions: previousAnalytics.unique_sessions,
        change_percent: changePercent
      }
    };
  } catch (error) {
    // Return empty comparison on error
    return {
      previous_period: {
        total_scans: 0,
        unique_sessions: 0,
        change_percent: 0
      }
    };
  }
}

function generateInsights(
  analytics: QRAnalyticsResponse,
  trend?: { direction: string; change_percent: number; confidence: string }
): Array<{
  type: 'peak_time' | 'trend' | 'anomaly' | 'recommendation';
  message: string;
  data?: Record<string, any>;
}> {
  const insights = [];

  // Peak time insight
  if (analytics.peak_activity.scan_count > 0) {
    const peakTime = new Date(analytics.peak_activity.time);
    insights.push({
      type: 'peak_time' as const,
      message: `Peak activity occurred at ${peakTime.toLocaleTimeString()} with ${analytics.peak_activity.scan_count} scans`,
      data: {
        peak_time: analytics.peak_activity.time,
        peak_scans: analytics.peak_activity.scan_count
      }
    });
  }

  // Trend insight
  if (trend && trend.direction !== 'stable') {
    const trendMessage = trend.direction === 'up' ? 
      `Scans are trending upward by ${trend.change_percent}%` :
      `Scans are trending downward by ${trend.change_percent}%`;
    
    insights.push({
      type: 'trend' as const,
      message: `${trendMessage} (${trend.confidence} confidence)`,
      data: {
        direction: trend.direction,
        change_percent: trend.change_percent,
        confidence: trend.confidence
      }
    });
  }

  // Low activity recommendation
  if (analytics.total_scans < 10 && analytics.data_points.length > 0) {
    insights.push({
      type: 'recommendation' as const,
      message: 'Low scan activity detected. Consider promoting your QR code or checking its placement.',
      data: {
        total_scans: analytics.total_scans,
        suggestion: 'promotion_needed'
      }
    });
  }

  // High engagement insight
  if (analytics.unique_sessions > 0 && analytics.total_scans / analytics.unique_sessions > 1.5) {
    insights.push({
      type: 'recommendation' as const,
      message: 'High repeat scan rate indicates strong engagement with your feedback system.',
      data: {
        repeat_rate: Math.round((analytics.total_scans / analytics.unique_sessions) * 100) / 100
      }
    });
  }

  return insights;
}

// Route handler configuration
export const analyticsRouteConfig = {
  path: '/qr/analytics/:storeId',
  method: 'GET' as const,
  handler: getAnalytics,
  middleware: [
    'authenticateToken',      // Verify JWT token
    'requireBusinessAuth',    // Ensure business authentication
    'validateStoreAccess'     // Validate store belongs to business
  ],
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200,                 // Limit to 200 analytics requests per 15 minutes per business
    keyGenerator: (req: Request) => `qr_analytics:${req.user?.business_id}`,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many analytics requests. Please wait before requesting again.'
      }
    }
  },
  cache: {
    ttl: 300,                 // Cache for 5 minutes
    key: (req: Request) => {
      const query = new URLSearchParams(req.query as any).toString();
      return `qr_analytics:${req.params.storeId}:${query}`;
    }
  }
};

// OpenAPI specification
export const analyticsOpenAPISpec = {
  '/qr/analytics/{storeId}': {
    get: {
      tags: ['QR Analytics'],
      summary: 'Get QR code analytics for a store',
      description: 'Retrieves scan analytics with time filtering, trend analysis, and insights',
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
          name: 'period',
          in: 'query',
          required: false,
          description: 'Time period for analytics aggregation',
          schema: {
            type: 'string',
            enum: ['hour', 'day', 'week', 'month'],
            default: 'week'
          }
        },
        {
          name: 'start_date',
          in: 'query',
          required: false,
          description: 'Start date for analytics (ISO 8601 format)',
          schema: {
            type: 'string',
            format: 'date-time',
            example: '2024-12-13T00:00:00Z'
          }
        },
        {
          name: 'end_date',
          in: 'query',
          required: false,
          description: 'End date for analytics (ISO 8601 format)',
          schema: {
            type: 'string',
            format: 'date-time',
            example: '2024-12-20T23:59:59Z'
          }
        },
        {
          name: 'timezone',
          in: 'query',
          required: false,
          description: 'Timezone for date calculations',
          schema: {
            type: 'string',
            default: 'UTC',
            example: 'America/New_York'
          }
        },
        {
          name: 'include_trend',
          in: 'query',
          required: false,
          description: 'Include trend analysis in response',
          schema: {
            type: 'string',
            enum: ['true', 'false'],
            default: 'true'
          }
        },
        {
          name: 'include_comparison',
          in: 'query',
          required: false,
          description: 'Include comparison with previous period',
          schema: {
            type: 'string',
            enum: ['true', 'false'],
            default: 'false'
          }
        }
      ],
      responses: {
        200: {
          description: 'Analytics retrieved successfully',
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
                      period: { type: 'string', example: 'week' },
                      total_scans: { type: 'integer', example: 142 },
                      unique_sessions: { type: 'integer', example: 98 },
                      peak_activity: {
                        type: 'object',
                        properties: {
                          time: { type: 'string', format: 'date-time' },
                          scan_count: { type: 'integer', example: 23 }
                        }
                      },
                      data_points: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            time: { type: 'string', format: 'date-time' },
                            scan_count: { type: 'integer' },
                            unique_sessions: { type: 'integer' }
                          }
                        }
                      },
                      metadata: {
                        type: 'object',
                        properties: {
                          period: { type: 'string' },
                          timezone: { type: 'string' },
                          data_points_count: { type: 'integer' },
                          time_range: {
                            type: 'object',
                            properties: {
                              start: { type: 'string', format: 'date-time' },
                              end: { type: 'string', format: 'date-time' }
                            }
                          }
                        }
                      },
                      trend: {
                        type: 'object',
                        nullable: true,
                        properties: {
                          direction: { type: 'string', enum: ['up', 'down', 'stable'] },
                          change_percent: { type: 'number' },
                          confidence: { type: 'string', enum: ['high', 'medium', 'low'] }
                        }
                      },
                      insights: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            type: { type: 'string', enum: ['peak_time', 'trend', 'anomaly', 'recommendation'] },
                            message: { type: 'string' },
                            data: { type: 'object' }
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
          description: 'Invalid request parameters'
        },
        401: {
          description: 'Unauthorized - Business authentication required'
        },
        403: {
          description: 'Forbidden - Access denied to store'
        },
        404: {
          description: 'Store not found'
        },
        429: {
          description: 'Rate limited - Too many analytics requests'
        },
        500: {
          description: 'Internal server error'
        }
      }
    }
  }
};