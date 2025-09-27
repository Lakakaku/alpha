import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import corsMiddleware from './middleware/cors';
import { authMiddleware } from './middleware/auth';
import rateLimiterMiddleware from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
import { loggingMiddleware } from './middleware/logging';

// Communication middleware
import { adminAuth, customerAuth, businessAuth } from './middleware/communication-auth';
import { generalRateLimit, smsRateLimit, supportTicketRateLimit } from './middleware/communication-rate-limiter';

import { healthRoutes } from './routes/health';
import { authRoutes } from './routes/auth';
import { businessRoutes } from './routes/businesses';
import { storeRoutes } from './routes/stores';
import { permissionRoutes } from './routes/permissions';
import { qrVerificationRouter } from './routes/qr/verification';
import { verificationSubmissionRouter } from './routes/qr/submission';
import adminVerificationStatsRoutes from './routes/admin/verification-stats';
import paymentsRoutes from './routes/admin/payments';

// Communication routes
import notificationsRoutes from './routes/admin/notifications';
import supportRoutes from './routes/admin/support';
import templatesRoutes from './routes/admin/templates';
import twilioWebhookRouter from './routes/webhooks/twilio-delivery-status';

// Testing webhook routes
import testResultsWebhook from './webhooks/test-results';

// Monitoring routes
import { metricsRoutes } from './routes/monitoring/metrics';
import { errorsRoutes } from './routes/monitoring/errors';
import { usageRoutes } from './routes/monitoring/usage';
import { alertRulesRoutes } from './routes/monitoring/alert-rules';
import { fraudReportsRoutes } from './routes/monitoring/fraud-reports';
import { revenueAnalyticsRoutes } from './routes/monitoring/revenue-analytics';
import { businessPerformanceRoutes } from './routes/monitoring/business-performance';
import { exportRoutes } from './routes/monitoring/export';
import { healthMonitoringRoutes } from './routes/monitoring/health';
import { backgroundServicesRoutes } from './routes/monitoring/background-services';

export function createApp(): express.Application {
  const app = express();

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'", "https://api.vocilia.se", "https://api-staging.vocilia.se"],
        imgSrc: ["'self'", "data:", "https:"],
        fontSrc: ["'self'", "https:", "data:"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));

  // CORS configuration
  app.use(corsMiddleware);

  // Rate limiting
  app.use(rateLimiterMiddleware);

  // Request parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Logging middleware
  app.use(loggingMiddleware);

  // Health check routes (no auth required)
  app.use('/health', healthRoutes);

  // QR verification routes (no auth required for customers)
  app.use('/api/v1/qr', qrVerificationRouter);
  app.use('/api/v1/verification', verificationSubmissionRouter);

  // API routes with authentication
  app.use('/auth', authRoutes);
  app.use('/businesses', authMiddleware, businessRoutes);
  app.use('/stores', authMiddleware, storeRoutes);
  app.use('/permissions', authMiddleware, permissionRoutes);

  // Communication API routes (admin auth required)
  app.use('/api/admin/notifications', adminAuth, generalRateLimit, notificationsRoutes);
  app.use('/api/admin/support', adminAuth, supportTicketRateLimit, supportRoutes);
  app.use('/api/admin/templates', adminAuth, generalRateLimit, templatesRoutes);

  // Communication webhook routes (webhook auth required)
  app.use('/api/webhooks/twilio', twilioWebhookRouter);
  app.use('/api/webhooks', testResultsWebhook);

  // Admin routes (auth required)
  app.use('/api/v1/admin/verification', authMiddleware, adminVerificationStatsRoutes);
  app.use('/api/admin/payments', paymentsRoutes);

  // Monitoring routes (admin auth required)
  app.use('/api/monitoring/metrics', metricsRoutes);
  app.use('/api/monitoring/errors', errorsRoutes);
  app.use('/api/monitoring/usage', usageRoutes);
  app.use('/api/monitoring/alerts/rules', alertRulesRoutes);
  app.use('/api/monitoring/fraud-reports', fraudReportsRoutes);
  app.use('/api/monitoring/revenue-analytics', revenueAnalyticsRoutes);
  app.use('/api/monitoring/business-performance', businessPerformanceRoutes);
  app.use('/api/monitoring/export', exportRoutes);
  app.use('/api/monitoring/health', healthMonitoringRoutes);
  app.use('/api/monitoring/background-services', backgroundServicesRoutes);

  // 404 handler for undefined routes
  app.use('*', (req, res) => {
    res.status(404).json({
      error: 'NOT_FOUND',
      message: `Route ${req.originalUrl} not found`,
    });
  });

  // Global error handler (must be last)
  app.use(errorHandler);

  return app;
}

export const app = createApp();
export default app;