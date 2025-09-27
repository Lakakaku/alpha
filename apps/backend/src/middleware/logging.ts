import { Request, Response, NextFunction } from 'express';
import winston from 'winston';
import { QuestionContextRequest } from './questionContext';

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

// Add file transport in production
if (process.env.NODE_ENV === 'production') {
  logger.add(
    new winston.transports.File({
      filename: 'logs/access.log',
      level: 'info',
    })
  );
}

export function loggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  
  // Generate request ID if not present
  const requestId = req.headers['x-request-id'] as string || 
                   Math.random().toString(36).substring(2, 15);
  
  // Add request ID to headers for tracking
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);

  // Log request
  logger.info('Request started', {
    requestId,
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: req.user?.id,
  });

  // Override res.end to log response
  const originalEnd = res.end.bind(res);
  res.end = function(chunk?: any, encoding?: BufferEncoding | (() => void), cb?: () => void): Response {
    const duration = Date.now() - start;
    
    logger.info('Request completed', {
      requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      userId: req.user?.id,
    });
    
    return originalEnd(chunk, encoding as BufferEncoding, cb);
  };

  next();
}

// Questions API specific logging middleware
export function questionApiLogging(req: QuestionContextRequest, res: Response, next: NextFunction): void {
  const start = Date.now();
  const requestId = req.headers['x-request-id'] as string || 
                   Math.random().toString(36).substring(2, 15);
  
  // Ensure request ID is set
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);

  // Extract question-specific information
  const questionId = req.params.questionId;
  const categoryId = req.params.categoryId;
  const questionContext = req.questionContext;

  // Log request with question context
  logger.info('Questions API request started', {
    requestId,
    method: req.method,
    url: req.url,
    path: req.path,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    questionId,
    categoryId,
    businessId: questionContext?.metadata.businessId,
    storeId: questionContext?.metadata.storeId,
    userId: questionContext?.metadata.userId,
    isAdmin: questionContext?.metadata.isAdmin,
    permissions: questionContext?.permissions,
    bodySize: req.get('content-length'),
    timestamp: new Date().toISOString(),
  });

  // Capture request body for specific operations (excluding sensitive data)
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
    const sanitizedBody = { ...req.body };
    
    // Remove sensitive fields
    delete sanitizedBody.password;
    delete sanitizedBody.token;
    delete sanitizedBody.secret;
    
    logger.debug('Questions API request body', {
      requestId,
      body: sanitizedBody,
      contentType: req.get('content-type'),
    });
  }

  // Capture response data
  const originalSend = res.send;
  const originalJson = res.json;
  let responseBody: any = null;

  res.send = function(body: any) {
    responseBody = body;
    return originalSend.call(this, body);
  };

  res.json = function(body: any) {
    responseBody = body;
    return originalJson.call(this, body);
  };

  // Override res.end to log response
  const originalEnd = res.end.bind(res);
  res.end = function(chunk?: any, encoding?: BufferEncoding | (() => void), cb?: () => void): Response {
    const duration = Date.now() - start;
    const responseSize = res.get('content-length');
    
    // Determine log level based on status code
    const logLevel = res.statusCode >= 500 ? 'error' : 
                    res.statusCode >= 400 ? 'warn' : 'info';

    // Log response completion
    logger.log(logLevel, 'Questions API request completed', {
      requestId,
      method: req.method,
      url: req.url,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      responseSize,
      questionId,
      categoryId,
      businessId: questionContext?.metadata.businessId,
      storeId: questionContext?.metadata.storeId,
      userId: questionContext?.metadata.userId,
      isAdmin: questionContext?.metadata.isAdmin,
      timestamp: new Date().toISOString(),
    });

    // Log error responses with more detail
    if (res.statusCode >= 400 && responseBody) {
      try {
        const errorData = typeof responseBody === 'string' ? 
          JSON.parse(responseBody) : responseBody;
        
        logger.error('Questions API error response', {
          requestId,
          statusCode: res.statusCode,
          error: {
            message: errorData.message,
            code: errorData.code,
            errors: errorData.errors,
            stack: errorData.stack,
          },
          questionId,
          categoryId,
          businessId: questionContext?.metadata.businessId,
          userId: questionContext?.metadata.userId,
        });
      } catch (e) {
        // Ignore JSON parse errors
      }
    }

    // Log performance metrics for slow requests
    if (duration > 1000) { // Requests taking more than 1 second
      logger.warn('Questions API slow request', {
        requestId,
        method: req.method,
        url: req.url,
        duration,
        statusCode: res.statusCode,
        questionId,
        categoryId,
        businessId: questionContext?.metadata.businessId,
        userId: questionContext?.metadata.userId,
      });
    }

    // Log successful operations with specific data
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const operation = getOperationType(req.method, req.path);
      if (operation) {
        logger.info(`Questions API ${operation} success`, {
          requestId,
          operation,
          questionId,
          categoryId,
          businessId: questionContext?.metadata.businessId,
          userId: questionContext?.metadata.userId,
          duration,
        });
      }
    }
    
    return originalEnd(chunk, encoding as BufferEncoding, cb);
  };

  next();
}

// Helper function to determine operation type
function getOperationType(method: string, path: string): string | null {
  const pathSegments = path.split('/').filter(Boolean);
  
  if (pathSegments.includes('questions')) {
    if (pathSegments.includes('preview')) {
      return 'question_preview';
    } else if (pathSegments.includes('activate')) {
      return method === 'POST' ? 'question_activation' : null;
    } else if (pathSegments.includes('categories')) {
      switch (method) {
        case 'GET': return 'category_list';
        case 'POST': return 'category_create';
        case 'PUT': return 'category_update';
        case 'DELETE': return 'category_delete';
      }
    } else if (pathSegments.includes('bulk')) {
      return 'question_bulk_operation';
    } else {
      switch (method) {
        case 'GET': return pathSegments.length > 2 ? 'question_get' : 'question_list';
        case 'POST': return 'question_create';
        case 'PUT': return 'question_update';
        case 'DELETE': return 'question_delete';
      }
    }
  }
  
  return null;
}

// Enhanced analytics logging for questions
export function logQuestionAnalytics(req: QuestionContextRequest, data: any): void {
  const requestId = req.headers['x-request-id'] as string;
  const questionContext = req.questionContext;

  logger.info('Questions API analytics event', {
    requestId,
    event: 'analytics_query',
    businessId: questionContext?.metadata.businessId,
    storeId: questionContext?.metadata.storeId,
    userId: questionContext?.metadata.userId,
    analytics: {
      queryType: data.queryType,
      dateRange: data.dateRange,
      categoryFilter: data.categoryFilter,
      resultCount: data.resultCount,
      processingTime: data.processingTime,
    },
    timestamp: new Date().toISOString(),
  });
}

// Log question frequency events
export function logQuestionFrequency(req: QuestionContextRequest, data: any): void {
  const requestId = req.headers['x-request-id'] as string;
  const questionContext = req.questionContext;

  logger.info('Questions API frequency event', {
    requestId,
    event: 'frequency_check',
    questionId: data.questionId,
    businessId: questionContext?.metadata.businessId,
    storeId: questionContext?.metadata.storeId,
    frequency: {
      window: data.window,
      currentCount: data.currentCount,
      maxPresentations: data.maxPresentations,
      canPresent: data.canPresent,
      cooldownRemaining: data.cooldownRemaining,
    },
    timestamp: new Date().toISOString(),
  });
}

// Log trigger evaluation events
export function logTriggerEvaluation(req: QuestionContextRequest, data: any): void {
  const requestId = req.headers['x-request-id'] as string;
  const questionContext = req.questionContext;

  logger.info('Questions API trigger evaluation', {
    requestId,
    event: 'trigger_evaluation',
    questionId: data.questionId,
    triggerId: data.triggerId,
    businessId: questionContext?.metadata.businessId,
    storeId: questionContext?.metadata.storeId,
    evaluation: {
      triggerType: data.triggerType,
      conditionCount: data.conditionCount,
      conditionsPassed: data.conditionsPassed,
      evaluationResult: data.evaluationResult,
      evaluationTime: data.evaluationTime,
    },
    timestamp: new Date().toISOString(),
  });
}

// Log security events
export function logSecurityEvent(req: QuestionContextRequest, event: string, details: any): void {
  const requestId = req.headers['x-request-id'] as string;
  const questionContext = req.questionContext;

  logger.warn('Questions API security event', {
    requestId,
    event,
    securityEvent: true,
    businessId: questionContext?.metadata.businessId,
    storeId: questionContext?.metadata.storeId,
    userId: questionContext?.metadata.userId,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    details,
    timestamp: new Date().toISOString(),
  });
}

// Audit logging for data changes
export function logDataChange(req: QuestionContextRequest, operation: string, resourceType: string, resourceId: string, changes: any): void {
  const requestId = req.headers['x-request-id'] as string;
  const questionContext = req.questionContext;

  logger.info('Questions API data change', {
    requestId,
    event: 'data_change',
    audit: true,
    operation, // create, update, delete, activate, deactivate
    resourceType, // question, category, trigger
    resourceId,
    businessId: questionContext?.metadata.businessId,
    storeId: questionContext?.metadata.storeId,
    userId: questionContext?.metadata.userId,
    changes,
    timestamp: new Date().toISOString(),
  });
}

export { logger };