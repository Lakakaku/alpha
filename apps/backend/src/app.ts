import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import corsMiddleware from './middleware/cors';
import { authMiddleware } from './middleware/auth';
import rateLimiterMiddleware from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
import { loggingMiddleware } from './middleware/logging';

import { healthRoutes } from './routes/health';
import { authRoutes } from './routes/auth';
import { businessRoutes } from './routes/businesses';
import { storeRoutes } from './routes/stores';
import { permissionRoutes } from './routes/permissions';

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

  // API routes with authentication
  app.use('/auth', authRoutes);
  app.use('/businesses', authMiddleware, businessRoutes);
  app.use('/stores', authMiddleware, storeRoutes);
  app.use('/permissions', authMiddleware, permissionRoutes);

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

export default createApp();