import http from 'http';
import app from './app';
import { config } from './config';
import { logger } from './middleware/logging';
import { closeDatabase, testDatabaseConnection } from './config/database';
import { alertProcessor, dataAggregator } from './services/monitoring';
// Temporarily disabled jobs due to TypeScript compilation errors
// import { startWeeklyPaymentBatchJob } from './jobs/weekly-payment-batch';
// import { startMaterializedViewRefreshJob } from './jobs/refresh-materialized-views';

const server = http.createServer(app);

// Keep track of active connections for graceful shutdown
const connections = new Set<any>();

server.on('connection', (connection) => {
  connections.add(connection);
  connection.on('close', () => {
    connections.delete(connection);
  });
});

// Health check function
async function performHealthCheck(): Promise<boolean> {
  try {
    await testDatabaseConnection();
    return true;
  } catch (error) {
    logger.error('Health check failed:', error);
    return false;
  }
}

// Graceful shutdown function
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  // Stop accepting new connections
  server.close((err) => {
    if (err) {
      logger.error('Error closing server:', err);
      process.exit(1);
    }
    logger.info('HTTP server closed');
  });

  // Set a timeout for force shutdown
  const forceShutdownTimeout = setTimeout(() => {
    logger.error('Force shutdown timeout reached. Exiting...');
    process.exit(1);
  }, 30000); // 30 seconds default

  try {
    // Stop background monitoring services
    logger.info('Stopping background monitoring services...');
    await Promise.all([
      alertProcessor.stop().catch(err => logger.error('Error stopping alert processor:', err)),
      dataAggregator.stop().catch(err => logger.error('Error stopping data aggregator:', err))
    ]);

    // Close all active connections
    logger.info(`Closing ${connections.size} active connections...`);
    for (const connection of connections) {
      connection.destroy();
    }
    connections.clear();

    // Close database connections
    logger.info('Closing database connections...');
    await closeDatabase();

    // Clear the force shutdown timeout
    clearTimeout(forceShutdownTimeout);

    logger.info('Graceful shutdown completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    clearTimeout(forceShutdownTimeout);
    process.exit(1);
  }
}

// Start server
async function startServer(): Promise<void> {
  try {
    // Perform initial health check
    logger.info('Performing initial health check...');
    const isHealthy = await performHealthCheck();
    
    if (!isHealthy) {
      logger.error('Initial health check failed. Exiting...');
      process.exit(1);
    }

    // Start listening
    server.listen(config.port, async () => {
      logger.info(`Server running on port ${config.port} in ${config.env} mode`);
      logger.info(`Process ID: ${process.pid}`);

      // Log configuration summary
      logger.info('Configuration summary:', {
        port: config.port,
        environment: config.env,
        database: {
          url: config.supabase.url ? 'configured' : 'missing'
        },
        auth: {
          supabaseUrl: config.supabase.url ? 'configured' : 'missing'
        }
      });

      // Start background monitoring services
      logger.info('Starting background monitoring services...');
      try {
        await Promise.all([
          alertProcessor.start().catch(err => {
            logger.error('Failed to start alert processor:', err);
            return Promise.resolve();
          }),
          dataAggregator.start().catch(err => {
            logger.error('Failed to start data aggregator:', err);
            return Promise.resolve();
          })
        ]);
        logger.info('Background monitoring services started successfully');

        // Temporarily disabled jobs due to TypeScript compilation errors
        // TODO: Fix TypeScript errors in job files and re-enable
        // // Start weekly payment batch cron job
        // logger.info('Starting weekly payment batch cron job...');
        // startWeeklyPaymentBatchJob();
        // logger.info('Weekly payment batch cron job started successfully');
        //
        // // Start materialized view refresh cron job
        // logger.info('Starting materialized view refresh cron job...');
        // startMaterializedViewRefreshJob();
        // logger.info('Materialized view refresh cron job started successfully');
      } catch (error) {
        logger.error('Error starting background monitoring services:', error);
        // Don't exit - continue without background services
      }
    });

    // Handle server errors
    server.on('error', (error: any) => {
      if (error.syscall !== 'listen') {
        throw error;
      }

      const bind = typeof config.port === 'string'
        ? 'Pipe ' + config.port
        : 'Port ' + config.port;

      switch (error.code) {
        case 'EACCES':
          logger.error(`${bind} requires elevated privileges`);
          process.exit(1);
          break;
        case 'EADDRINUSE':
          logger.error(`${bind} is already in use`);
          process.exit(1);
          break;
        default:
          throw error;
      }
    });

    // Setup graceful shutdown handlers
    const signals = ['SIGTERM', 'SIGINT', 'SIGQUIT'] as const;
    
    for (const signal of signals) {
      process.on(signal, () => gracefulShutdown(signal));
    }

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      gracefulShutdown('uncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      gracefulShutdown('unhandledRejection');
    });

    // Periodic health check (every 5 minutes)
    setInterval(async () => {
      const isHealthy = await performHealthCheck();
      if (!isHealthy) {
        logger.warn('Periodic health check failed');
      }

      // Check background service health
      try {
        const [alertProcessorHealth, dataAggregatorHealth] = await Promise.all([
          alertProcessor.healthCheck().catch(() => ({ healthy: false, issues: ['Service unavailable'] })),
          dataAggregator.healthCheck().catch(() => ({ healthy: false, issues: ['Service unavailable'] }))
        ]);

        if (!alertProcessorHealth.healthy) {
          logger.warn('Alert processor health check failed:', alertProcessorHealth.issues);
        }

        if (!dataAggregatorHealth.healthy) {
          logger.warn('Data aggregator health check failed:', dataAggregatorHealth.issues);
        }
      } catch (error) {
        logger.error('Error checking background service health:', error);
      }
    }, 5 * 60 * 1000);

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle process warnings
process.on('warning', (warning) => {
  logger.warn('Process warning:', {
    name: warning.name,
    message: warning.message,
    stack: warning.stack
  });
});

// Start the server
if (require.main === module) {
  startServer().catch((error) => {
    logger.error('Fatal error starting server:', error);
    process.exit(1);
  });
}

export { server, startServer, gracefulShutdown };