import { CallEvent } from '../models/CallEvent';
import { CallSession } from '../models/CallSession';

export enum ErrorType {
  TELEPHONY_ERROR = 'telephony_error',
  AI_SERVICE_ERROR = 'ai_service_error',
  DATABASE_ERROR = 'database_error',
  AUTHENTICATION_ERROR = 'auth_error',
  VALIDATION_ERROR = 'validation_error',
  NETWORK_ERROR = 'network_error',
  TIMEOUT_ERROR = 'timeout_error',
  RATE_LIMIT_ERROR = 'rate_limit_error',
  CONFIGURATION_ERROR = 'config_error'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ErrorContext {
  sessionId?: string;
  businessId?: string;
  providerId?: string;
  userId?: string;
  requestId?: string;
  endpoint?: string;
  userAgent?: string;
  ip?: string;
  additionalData?: Record<string, any>;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: ErrorType[];
}

export class VociliaError extends Error {
  public readonly type: ErrorType;
  public readonly severity: ErrorSeverity;
  public readonly code: string;
  public readonly context: ErrorContext;
  public readonly timestamp: Date;
  public readonly retryable: boolean;

  constructor(
    type: ErrorType,
    message: string,
    options: {
      severity?: ErrorSeverity;
      code?: string;
      context?: ErrorContext;
      cause?: Error;
      retryable?: boolean;
    } = {}
  ) {
    super(message);
    this.name = 'VociliaError';
    this.type = type;
    this.severity = options.severity || ErrorSeverity.MEDIUM;
    this.code = options.code || type;
    this.context = options.context || {};
    this.timestamp = new Date();
    this.retryable = options.retryable ?? this.isRetryableByDefault(type);

    if (options.cause) {
      this.cause = options.cause;
      this.stack = `${this.stack}\nCaused by: ${options.cause.stack}`;
    }
  }

  private isRetryableByDefault(type: ErrorType): boolean {
    return [
      ErrorType.NETWORK_ERROR,
      ErrorType.TIMEOUT_ERROR,
      ErrorType.TELEPHONY_ERROR
    ].includes(type);
  }

  toJSON() {
    return {
      name: this.name,
      type: this.type,
      severity: this.severity,
      code: this.code,
      message: this.message,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
      retryable: this.retryable,
      stack: this.stack
    };
  }
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorHandlers: Map<ErrorType, (error: VociliaError) => Promise<void>>;

  constructor() {
    this.errorHandlers = new Map();
    this.setupDefaultHandlers();
  }

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Handle an error with logging and recovery attempts
   */
  async handleError(error: Error | VociliaError, context?: ErrorContext): Promise<void> {
    let vociliaError: VociliaError;

    if (error instanceof VociliaError) {
      vociliaError = error;
      // Merge additional context
      if (context) {
        Object.assign(vociliaError.context, context);
      }
    } else {
      // Convert generic error to VociliaError
      vociliaError = this.classifyError(error, context);
    }

    // Log the error
    await this.logError(vociliaError);

    // Execute type-specific handler
    const handler = this.errorHandlers.get(vociliaError.type);
    if (handler) {
      try {
        await handler(vociliaError);
      } catch (handlerError) {
        console.error('Error handler failed:', handlerError);
      }
    }

    // Alert if critical
    if (vociliaError.severity === ErrorSeverity.CRITICAL) {
      await this.sendAlert(vociliaError);
    }
  }

  /**
   * Retry a function with exponential backoff
   */
  async retry<T>(
    fn: () => Promise<T>,
    config: Partial<RetryConfig> = {},
    context?: ErrorContext
  ): Promise<T> {
    const retryConfig: RetryConfig = {
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
      retryableErrors: [
        ErrorType.NETWORK_ERROR,
        ErrorType.TIMEOUT_ERROR,
        ErrorType.TELEPHONY_ERROR
      ],
      ...config
    };

    let lastError: Error;
    let attempt = 0;

    while (attempt <= retryConfig.maxRetries) {
      try {
        if (attempt > 0) {
          const delay = Math.min(
            retryConfig.baseDelayMs * Math.pow(retryConfig.backoffMultiplier, attempt - 1),
            retryConfig.maxDelayMs
          );
          
          console.log(`Retry attempt ${attempt}/${retryConfig.maxRetries} after ${delay}ms delay`);
          await this.sleep(delay);
        }

        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        attempt++;

        // Check if error is retryable
        if (error instanceof VociliaError && !error.retryable) {
          throw error;
        }

        if (error instanceof VociliaError && !retryConfig.retryableErrors.includes(error.type)) {
          throw error;
        }

        // Log retry attempt
        await this.logError(
          new VociliaError(
            ErrorType.NETWORK_ERROR,
            `Retry attempt ${attempt}/${retryConfig.maxRetries} failed`,
            {
              context: {
                ...context,
                originalError: lastError.message,
                attempt,
                maxRetries: retryConfig.maxRetries
              }
            }
          )
        );

        if (attempt > retryConfig.maxRetries) {
          break;
        }
      }
    }

    // All retries exhausted
    const finalError = new VociliaError(
      ErrorType.NETWORK_ERROR,
      `Operation failed after ${retryConfig.maxRetries} retries`,
      {
        severity: ErrorSeverity.HIGH,
        context: {
          ...context,
          finalError: lastError.message,
          totalAttempts: attempt
        }
      }
    );

    await this.handleError(finalError);
    throw finalError;
  }

  /**
   * Create a circuit breaker for a service
   */
  createCircuitBreaker<T>(
    serviceName: string,
    fn: () => Promise<T>,
    options: {
      failureThreshold?: number;
      resetTimeoutMs?: number;
      monitoringPeriodMs?: number;
    } = {}
  ): () => Promise<T> {
    const config = {
      failureThreshold: 5,
      resetTimeoutMs: 60000,
      monitoringPeriodMs: 60000,
      ...options
    };

    let failures = 0;
    let lastFailureTime = 0;
    let state: 'closed' | 'open' | 'half-open' = 'closed';

    return async (): Promise<T> => {
      const now = Date.now();

      // Check if we should reset after timeout
      if (state === 'open' && now - lastFailureTime > config.resetTimeoutMs) {
        state = 'half-open';
        failures = 0;
      }

      // If circuit is open, reject immediately
      if (state === 'open') {
        throw new VociliaError(
          ErrorType.NETWORK_ERROR,
          `Circuit breaker open for ${serviceName}`,
          {
            severity: ErrorSeverity.HIGH,
            context: {
              serviceName,
              state,
              failures,
              lastFailureTime: new Date(lastFailureTime).toISOString()
            }
          }
        );
      }

      try {
        const result = await fn();
        
        // Success - reset failure count and close circuit
        if (state === 'half-open') {
          state = 'closed';
          failures = 0;
        }
        
        return result;
      } catch (error) {
        failures++;
        lastFailureTime = now;

        // Open circuit if threshold exceeded
        if (failures >= config.failureThreshold) {
          state = 'open';
          
          await this.handleError(
            new VociliaError(
              ErrorType.NETWORK_ERROR,
              `Circuit breaker opened for ${serviceName}`,
              {
                severity: ErrorSeverity.HIGH,
                context: {
                  serviceName,
                  failures,
                  threshold: config.failureThreshold
                }
              }
            )
          );
        }

        throw error;
      }
    };
  }

  /**
   * Register custom error handler
   */
  registerHandler(type: ErrorType, handler: (error: VociliaError) => Promise<void>): void {
    this.errorHandlers.set(type, handler);
  }

  private setupDefaultHandlers(): void {
    // Telephony error handler
    this.registerHandler(ErrorType.TELEPHONY_ERROR, async (error) => {
      if (error.context.sessionId) {
        const session = await CallSession.findById(error.context.sessionId);
        if (session && !['completed', 'failed', 'timeout'].includes(session.status)) {
          await session.updateStatus('failed');
        }
      }
    });

    // AI service error handler
    this.registerHandler(ErrorType.AI_SERVICE_ERROR, async (error) => {
      if (error.context.sessionId) {
        // Try to gracefully end the call
        const session = await CallSession.findById(error.context.sessionId);
        if (session && session.status === 'in_progress') {
          await session.updateStatus('failed');
        }
      }
    });

    // Database error handler
    this.registerHandler(ErrorType.DATABASE_ERROR, async (error) => {
      // Database errors are usually not recoverable at the call level
      console.error('Database error requiring attention:', error.toJSON());
    });
  }

  private classifyError(error: Error, context?: ErrorContext): VociliaError {
    const message = error.message.toLowerCase();

    // Classify by error message content
    if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
      return new VociliaError(ErrorType.NETWORK_ERROR, error.message, {
        severity: ErrorSeverity.MEDIUM,
        context,
        cause: error
      });
    }

    if (message.includes('timeout')) {
      return new VociliaError(ErrorType.TIMEOUT_ERROR, error.message, {
        severity: ErrorSeverity.MEDIUM,
        context,
        cause: error
      });
    }

    if (message.includes('auth') || message.includes('unauthorized') || message.includes('forbidden')) {
      return new VociliaError(ErrorType.AUTHENTICATION_ERROR, error.message, {
        severity: ErrorSeverity.HIGH,
        context,
        cause: error,
        retryable: false
      });
    }

    if (message.includes('rate limit') || message.includes('too many')) {
      return new VociliaError(ErrorType.RATE_LIMIT_ERROR, error.message, {
        severity: ErrorSeverity.MEDIUM,
        context,
        cause: error
      });
    }

    // Default classification
    return new VociliaError(ErrorType.NETWORK_ERROR, error.message, {
      severity: ErrorSeverity.MEDIUM,
      context,
      cause: error
    });
  }

  private async logError(error: VociliaError): Promise<void> {
    try {
      // Log to console
      console.error(`[${error.severity.toUpperCase()}] ${error.type}:`, error.message, error.context);

      // Log to database if we have a session ID
      if (error.context.sessionId) {
        await CallEvent.create({
          sessionId: error.context.sessionId,
          eventType: 'error_logged',
          providerId: 'system',
          eventData: {
            errorType: error.type,
            severity: error.severity,
            message: error.message,
            code: error.code,
            context: error.context,
            timestamp: error.timestamp.toISOString(),
            stack: error.stack
          }
        });
      }
    } catch (loggingError) {
      console.error('Failed to log error:', loggingError);
    }
  }

  private async sendAlert(error: VociliaError): Promise<void> {
    try {
      // In production, this would send alerts via email, Slack, etc.
      console.error('CRITICAL ERROR ALERT:', error.toJSON());
      
      // Could integrate with monitoring services like Sentry, DataDog, etc.
      // await this.notificationService.sendCriticalAlert(error);
    } catch (alertError) {
      console.error('Failed to send alert:', alertError);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance();

// Convenience functions for common error types
export const createTelephonyError = (message: string, context?: ErrorContext) =>
  new VociliaError(ErrorType.TELEPHONY_ERROR, message, { context });

export const createAIServiceError = (message: string, context?: ErrorContext) =>
  new VociliaError(ErrorType.AI_SERVICE_ERROR, message, { context });

export const createValidationError = (message: string, context?: ErrorContext) =>
  new VociliaError(ErrorType.VALIDATION_ERROR, message, { 
    context, 
    retryable: false,
    severity: ErrorSeverity.LOW 
  });

export const createAuthError = (message: string, context?: ErrorContext) =>
  new VociliaError(ErrorType.AUTHENTICATION_ERROR, message, { 
    context, 
    retryable: false,
    severity: ErrorSeverity.HIGH 
  });