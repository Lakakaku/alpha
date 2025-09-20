import winston from 'winston';
import { createClient } from '@alpha/database';

export interface LogEntry {
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  timestamp: string;
  userId?: string;
  requestId?: string;
  metadata?: Record<string, any>;
}

export interface AuditLogEntry {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  details: Record<string, any>;
  ip_address: string;
  user_agent: string;
  timestamp: string;
}

export interface SecurityEvent {
  type: 'auth_failure' | 'unauthorized_access' | 'suspicious_activity' | 'rate_limit_exceeded';
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  user_id?: string;
  timestamp: string;
}

export class LoggingService {
  private logger: winston.Logger;
  private supabase = createClient();

  constructor() {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: {
        service: 'vocilia-backend',
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
      },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          ),
        }),
      ],
    });

    // Add file transports in production
    if (process.env.NODE_ENV === 'production') {
      this.logger.add(
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
          maxsize: 10485760, // 10MB
          maxFiles: 5,
        })
      );
      
      this.logger.add(
        new winston.transports.File({
          filename: 'logs/combined.log',
          maxsize: 10485760, // 10MB
          maxFiles: 5,
        })
      );

      this.logger.add(
        new winston.transports.File({
          filename: 'logs/audit.log',
          level: 'info',
          maxsize: 50485760, // 50MB
          maxFiles: 10,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          ),
        })
      );
    }
  }

  // Basic logging methods
  debug(message: string, metadata?: Record<string, any>, userId?: string, requestId?: string): void {
    this.logger.debug(message, {
      userId,
      requestId,
      metadata,
    });
  }

  info(message: string, metadata?: Record<string, any>, userId?: string, requestId?: string): void {
    this.logger.info(message, {
      userId,
      requestId,
      metadata,
    });
  }

  warn(message: string, metadata?: Record<string, any>, userId?: string, requestId?: string): void {
    this.logger.warn(message, {
      userId,
      requestId,
      metadata,
    });
  }

  error(message: string, error?: Error, metadata?: Record<string, any>, userId?: string, requestId?: string): void {
    this.logger.error(message, {
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
      userId,
      requestId,
      metadata,
    });
  }

  // Audit logging
  async logAuditEvent(
    userId: string,
    action: string,
    resourceType: string,
    resourceId: string,
    details: Record<string, any>,
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    const auditEntry: Omit<AuditLogEntry, 'id'> = {
      user_id: userId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      details,
      ip_address: ipAddress,
      user_agent: userAgent,
      timestamp: new Date().toISOString(),
    };

    // Log to Winston
    this.logger.info('Audit Event', {
      type: 'audit',
      ...auditEntry,
    });

    // Store in database for querying
    try {
      const { error } = await this.supabase
        .from('audit_logs')
        .insert(auditEntry);

      if (error) {
        this.logger.error('Failed to store audit log in database', {
          error: error.message,
          auditEntry,
        });
      }
    } catch (err) {
      this.logger.error('Error storing audit log', {
        error: err instanceof Error ? err.message : 'Unknown error',
        auditEntry,
      });
    }
  }

  // Security event logging
  async logSecurityEvent(event: Omit<SecurityEvent, 'timestamp'>): Promise<void> {
    const securityEvent: SecurityEvent = {
      ...event,
      timestamp: new Date().toISOString(),
    };

    // Log to Winston with appropriate level
    const logLevel = securityEvent.severity === 'critical' ? 'error' :
                    securityEvent.severity === 'high' ? 'error' :
                    securityEvent.severity === 'medium' ? 'warn' : 'info';

    this.logger.log(logLevel, 'Security Event', {
      type: 'security',
      ...securityEvent,
    });

    // Store critical and high severity events in database
    if (securityEvent.severity === 'critical' || securityEvent.severity === 'high') {
      try {
        const { error } = await this.supabase
          .from('security_events')
          .insert(securityEvent);

        if (error) {
          this.logger.error('Failed to store security event in database', {
            error: error.message,
            securityEvent,
          });
        }
      } catch (err) {
        this.logger.error('Error storing security event', {
          error: err instanceof Error ? err.message : 'Unknown error',
          securityEvent,
        });
      }
    }
  }

  // Business logic logging
  logUserLogin(userId: string, ipAddress: string, userAgent: string, success: boolean): void {
    this.info('User login attempt', {
      success,
      ipAddress,
      userAgent,
    }, userId);

    if (!success) {
      this.logSecurityEvent({
        type: 'auth_failure',
        severity: 'medium',
        details: {
          reason: 'invalid_credentials',
          ipAddress,
          userAgent,
        },
        ip_address: ipAddress,
        user_agent: userAgent,
        user_id: userId,
      });
    }
  }

  logBusinessCreated(userId: string, businessId: string, businessName: string, ipAddress: string, userAgent: string): void {
    this.logAuditEvent(
      userId,
      'create',
      'business',
      businessId,
      { name: businessName },
      ipAddress,
      userAgent
    );
  }

  logBusinessUpdated(userId: string, businessId: string, changes: Record<string, any>, ipAddress: string, userAgent: string): void {
    this.logAuditEvent(
      userId,
      'update',
      'business',
      businessId,
      { changes },
      ipAddress,
      userAgent
    );
  }

  logStoreCreated(userId: string, storeId: string, storeName: string, businessId: string, ipAddress: string, userAgent: string): void {
    this.logAuditEvent(
      userId,
      'create',
      'store',
      storeId,
      { name: storeName, businessId },
      ipAddress,
      userAgent
    );
  }

  logUnauthorizedAccess(userId: string | undefined, resource: string, ipAddress: string, userAgent: string): void {
    this.logSecurityEvent({
      type: 'unauthorized_access',
      severity: 'high',
      details: {
        resource,
        userId,
      },
      ip_address: ipAddress,
      user_agent: userAgent,
      user_id: userId,
    });
  }

  logRateLimitExceeded(ipAddress: string, userAgent: string, endpoint: string, userId?: string): void {
    this.logSecurityEvent({
      type: 'rate_limit_exceeded',
      severity: 'medium',
      details: {
        endpoint,
        ipAddress,
        userAgent,
      },
      ip_address: ipAddress,
      user_agent: userAgent,
      user_id: userId,
    });
  }

  logSuspiciousActivity(description: string, details: Record<string, any>, ipAddress: string, userAgent: string, userId?: string): void {
    this.logSecurityEvent({
      type: 'suspicious_activity',
      severity: 'high',
      details: {
        description,
        ...details,
      },
      ip_address: ipAddress,
      user_agent: userAgent,
      user_id: userId,
    });
  }

  // API request logging
  logApiRequest(
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    userId?: string,
    requestId?: string,
    ipAddress?: string
  ): void {
    this.info('API Request', {
      method,
      url,
      statusCode,
      duration,
      ipAddress,
    }, userId, requestId);
  }

  // Database operation logging
  logDatabaseError(operation: string, table: string, error: Error, userId?: string, requestId?: string): void {
    this.error(`Database ${operation} failed on ${table}`, error, {
      operation,
      table,
    }, userId, requestId);
  }

  // Performance logging
  logSlowQuery(query: string, duration: number, userId?: string, requestId?: string): void {
    this.warn('Slow database query detected', {
      query,
      duration,
      threshold: 1000, // 1 second threshold
    }, userId, requestId);
  }

  logHighMemoryUsage(memoryUsage: NodeJS.MemoryUsage): void {
    this.warn('High memory usage detected', {
      memoryUsage,
      heapUsedMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(memoryUsage.heapTotal / 1024 / 1024),
    });
  }

  // Health check logging
  logHealthCheckFailed(check: string, error: Error): void {
    this.error(`Health check failed: ${check}`, error, {
      healthCheck: check,
    });
  }

  // System events
  logServerStartup(port: number, environment: string): void {
    this.info('Server started', {
      port,
      environment,
      nodeVersion: process.version,
      processId: process.pid,
    });
  }

  logServerShutdown(reason: string): void {
    this.info('Server shutdown initiated', {
      reason,
      uptime: process.uptime(),
    });
  }

  // Get the winston logger instance for custom logging
  getLogger(): winston.Logger {
    return this.logger;
  }

  // Query audit logs (for admin interface)
  async getAuditLogs(
    userId?: string,
    resourceType?: string,
    action?: string,
    limit = 100,
    offset = 0
  ): Promise<AuditLogEntry[]> {
    let query = this.supabase
      .from('audit_logs')
      .select('*')
      .order('timestamp', { ascending: false });

    if (userId) {
      query = query.eq('user_id', userId);
    }

    if (resourceType) {
      query = query.eq('resource_type', resourceType);
    }

    if (action) {
      query = query.eq('action', action);
    }

    query = query.range(offset, offset + limit - 1);

    const { data: logs, error } = await query;

    if (error) {
      this.error('Failed to fetch audit logs', error);
      throw new Error(`Failed to fetch audit logs: ${error.message}`);
    }

    return logs || [];
  }

  // Query security events (for admin interface)
  async getSecurityEvents(
    type?: SecurityEvent['type'],
    severity?: SecurityEvent['severity'],
    limit = 100,
    offset = 0
  ): Promise<SecurityEvent[]> {
    let query = this.supabase
      .from('security_events')
      .select('*')
      .order('timestamp', { ascending: false });

    if (type) {
      query = query.eq('type', type);
    }

    if (severity) {
      query = query.eq('severity', severity);
    }

    query = query.range(offset, offset + limit - 1);

    const { data: events, error } = await query;

    if (error) {
      this.error('Failed to fetch security events', error);
      throw new Error(`Failed to fetch security events: ${error.message}`);
    }

    return events || [];
  }
}

// Singleton instance
export const loggingService = new LoggingService();