import { Request, Response, NextFunction } from 'express';
import { CallSession } from '../models/CallSession';
import { CallEvent } from '../models/CallEvent';

export interface DurationMonitoringRequest extends Request {
  callSession?: any;
  startTime?: Date;
}

/**
 * Middleware to monitor call duration and enforce limits
 */
export const monitorCallDuration = async (req: DurationMonitoringRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    req.startTime = new Date();
    
    // Log request start for call-related endpoints
    if (req.path.includes('/calls/') && req.callSession) {
      await CallEvent.create({
        sessionId: req.callSession.id,
        eventType: 'api_request_start',
        providerId: 'system',
        eventData: {
          endpoint: req.originalUrl,
          method: req.method,
          userAgent: req.get('User-Agent'),
          ip: req.ip,
          timestamp: req.startTime.toISOString()
        }
      });
    }

    next();

  } catch (error) {
    console.error('Duration monitoring setup error:', error);
    next(); // Continue on error
  }
};

/**
 * Response middleware to log request completion and check for long-running operations
 */
export const logRequestCompletion = (req: DurationMonitoringRequest, res: Response, next: NextFunction): void => {
  const originalSend = res.send;

  res.send = function(body: any) {
    const endTime = new Date();
    const duration = req.startTime ? endTime.getTime() - req.startTime.getTime() : 0;

    // Log completion for call-related endpoints
    if (req.path.includes('/calls/') && req.callSession && duration > 0) {
      CallEvent.create({
        sessionId: req.callSession.id,
        eventType: 'api_request_complete',
        providerId: 'system',
        eventData: {
          endpoint: req.originalUrl,
          method: req.method,
          statusCode: res.statusCode,
          duration,
          timestamp: endTime.toISOString()
        }
      }).catch(error => {
        console.error('Failed to log request completion:', error);
      });
    }

    // Warn about slow requests
    if (duration > 5000) {
      console.warn(`Slow request detected: ${req.method} ${req.originalUrl} took ${duration}ms`);
    }

    return originalSend.call(this, body);
  };

  next();
};

/**
 * Middleware to enforce maximum call duration limits
 */
export const enforceCallTimeouts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      next();
      return;
    }

    const session = await CallSession.findById(sessionId);
    if (!session) {
      next();
      return;
    }

    // Check if call has exceeded maximum duration (2 minutes)
    const maxDurationMs = (session.maxDuration || 120) * 1000;
    const sessionAge = Date.now() - new Date(session.createdAt).getTime();

    if (sessionAge > maxDurationMs && ['initiated', 'connecting', 'in_progress'].includes(session.status)) {
      // Mark call as timed out
      await session.updateStatus('timeout', {
        actualDuration: Math.floor(sessionAge / 1000)
      });

      await CallEvent.create({
        sessionId: session.id,
        eventType: 'call_timeout_enforced',
        providerId: 'system',
        eventData: {
          maxDurationSeconds: session.maxDuration || 120,
          actualDurationSeconds: Math.floor(sessionAge / 1000),
          previousStatus: session.status,
          endpoint: req.originalUrl
        }
      });

      res.status(408).json({
        error: 'Call session has timed out',
        sessionId: session.id,
        maxDuration: session.maxDuration || 120,
        actualDuration: Math.floor(sessionAge / 1000)
      });
      return;
    }

    next();

  } catch (error) {
    console.error('Call timeout enforcement error:', error);
    next(); // Continue on error
  }
};

/**
 * Background job to monitor and cleanup long-running calls
 */
export class CallDurationMonitor {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  start(): void {
    if (this.isRunning) {
      return;
    }

    console.log('Starting call duration monitor...');
    this.isRunning = true;

    // Check every 30 seconds
    this.intervalId = setInterval(async () => {
      try {
        await this.checkForTimeouts();
      } catch (error) {
        console.error('Call duration monitor error:', error);
      }
    }, 30000);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('Call duration monitor stopped');
  }

  private async checkForTimeouts(): Promise<void> => {
    // Find all active calls that may have timed out
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    
    const activeCalls = await CallSession.findByStatus(['initiated', 'connecting', 'in_progress']);
    
    for (const call of activeCalls) {
      const callStartTime = new Date(call.createdAt);
      const maxDuration = (call.maxDuration || 120) * 1000;
      
      if (Date.now() - callStartTime.getTime() > maxDuration) {
        console.log(`Auto-timing out call ${call.id} after ${maxDuration / 1000} seconds`);
        
        await call.updateStatus('timeout', {
          actualDuration: Math.floor((Date.now() - callStartTime.getTime()) / 1000)
        });

        await CallEvent.create({
          sessionId: call.id,
          eventType: 'call_auto_timeout',
          providerId: 'system',
          eventData: {
            maxDurationSeconds: call.maxDuration || 120,
            actualDurationSeconds: Math.floor((Date.now() - callStartTime.getTime()) / 1000),
            previousStatus: call.status,
            reason: 'automatic_cleanup'
          }
        });
      }
    }
  }

  isMonitorRunning(): boolean {
    return this.isRunning;
  }
}

// Export singleton instance
export const callDurationMonitor = new CallDurationMonitor();