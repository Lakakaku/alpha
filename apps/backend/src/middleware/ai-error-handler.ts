import { Request, Response, NextFunction } from 'express';
import { loggingService } from '../services/loggingService.js';

export interface AIError extends Error {
  code?: string;
  statusCode?: number;
  context?: Record<string, any>;
  retryable?: boolean;
}

export class AIServiceError extends Error implements AIError {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public context: Record<string, any> = {},
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'AIServiceError';
  }
}

export class OpenAIError extends AIServiceError {
  constructor(message: string, code: string, context?: Record<string, any>) {
    super(message, `OPENAI_${code}`, 502, context, true);
    this.name = 'OpenAIError';
  }
}

export class PhoneServiceError extends AIServiceError {
  constructor(message: string, code: string, context?: Record<string, any>) {
    super(message, `PHONE_${code}`, 502, context, true);
    this.name = 'PhoneServiceError';
  }
}

export class ConversationError extends AIServiceError {
  constructor(message: string, code: string, context?: Record<string, any>) {
    super(message, `CONVERSATION_${code}`, 400, context, false);
    this.name = 'ConversationError';
  }
}

export class AnalysisError extends AIServiceError {
  constructor(message: string, code: string, context?: Record<string, any>) {
    super(message, `ANALYSIS_${code}`, 422, context, false);
    this.name = 'AnalysisError';
  }
}

export const aiErrorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Type guard for AI errors
  const isAIError = (err: Error): err is AIError => {
    return 'code' in err && 'statusCode' in err;
  };

  let statusCode = 500;
  let errorCode = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred';
  let context: Record<string, any> = {};
  let retryable = false;

  if (isAIError(error)) {
    statusCode = error.statusCode || 500;
    errorCode = error.code || 'AI_ERROR';
    message = error.message;
    context = error.context || {};
    retryable = error.retryable || false;
  }

  // Log error with appropriate level
  const logLevel = statusCode >= 500 ? 'error' : 'warn';
  loggingService.log(logLevel, 'AI service error', {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: errorCode,
      statusCode,
      retryable
    },
    request: {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
      params: req.params,
      query: req.query
    },
    context,
    timestamp: new Date().toISOString()
  });

  // Send structured error response
  res.status(statusCode).json({
    error: {
      code: errorCode,
      message,
      timestamp: new Date().toISOString(),
      retryable,
      ...(process.env.NODE_ENV !== 'production' && {
        stack: error.stack,
        context
      })
    }
  });
};

export const handleOpenAIError = (error: any): never => {
  const context = {
    type: error.type,
    param: error.param,
    code: error.code
  };

  if (error.code === 'rate_limit_exceeded') {
    throw new OpenAIError('OpenAI rate limit exceeded', 'RATE_LIMIT', context);
  }
  
  if (error.code === 'insufficient_quota') {
    throw new OpenAIError('OpenAI quota exceeded', 'QUOTA_EXCEEDED', context);
  }
  
  if (error.code === 'invalid_request_error') {
    throw new OpenAIError('Invalid OpenAI request', 'INVALID_REQUEST', context);
  }
  
  if (error.code === 'model_not_found') {
    throw new OpenAIError('OpenAI model not found', 'MODEL_NOT_FOUND', context);
  }

  // Generic OpenAI error
  throw new OpenAIError(
    error.message || 'OpenAI API error',
    'API_ERROR',
    context
  );
};

export const handlePhoneError = (error: any): never => {
  const context = {
    httpStatus: error.response?.status,
    data: error.response?.data
  };

  if (error.response?.status === 429) {
    throw new PhoneServiceError('Phone service rate limit', 'RATE_LIMIT', context);
  }
  
  if (error.response?.status === 402) {
    throw new PhoneServiceError('Insufficient phone service credits', 'INSUFFICIENT_CREDITS', context);
  }
  
  if (error.response?.status >= 400 && error.response?.status < 500) {
    throw new PhoneServiceError('Invalid phone service request', 'INVALID_REQUEST', context);
  }

  // Generic phone service error
  throw new PhoneServiceError(
    error.message || 'Phone service error',
    'SERVICE_ERROR',
    context
  );
};

export const handleConversationError = (message: string, code: string, context?: Record<string, any>): never => {
  throw new ConversationError(message, code, context);
};

export const handleAnalysisError = (message: string, code: string, context?: Record<string, any>): never => {
  throw new AnalysisError(message, code, context);
};

export const withAIErrorHandling = <T extends any[], R>(
  fn: (...args: T) => Promise<R>
) => {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      // Re-throw AI errors as-is
      if (error instanceof AIServiceError) {
        throw error;
      }

      // Handle OpenAI errors
      if (error && typeof error === 'object' && 'type' in error) {
        handleOpenAIError(error);
      }

      // Handle HTTP errors from phone service
      if (error && typeof error === 'object' && 'response' in error) {
        handlePhoneError(error);
      }

      // Generic error
      throw new AIServiceError(
        error instanceof Error ? error.message : 'Unknown error',
        'UNKNOWN_ERROR',
        500,
        { originalError: error },
        false
      );
    }
  };
};