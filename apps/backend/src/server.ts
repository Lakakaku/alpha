import http from 'http';
import app from './app';
import { config } from './config';
import { logger } from './middleware/logging';
import { closeDatabase, testDatabaseConnection } from './config/database';

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
  }, config.server.shutdownTimeout || 30000); // 30 seconds default

  try {
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
    server.listen(config.server.port, () => {
      logger.info(`Server running on port ${config.server.port} in ${config.server.env} mode`);
      logger.info(`API Base URL: ${config.server.baseUrl}`);
      logger.info(`Process ID: ${process.pid}`);
      
      // Log configuration summary
      logger.info('Configuration summary:', {
        port: config.server.port,
        environment: config.server.env,
        cors: config.cors.origins,
        database: {
          url: config.database.url ? 'configured' : 'missing',
          poolSize: config.database.poolConfig?.max
        },
        auth: {
          supabaseUrl: config.supabase.url ? 'configured' : 'missing'
        }
      });
    });

    // Handle server errors
    server.on('error', (error: any) => {
      if (error.syscall !== 'listen') {
        throw error;
      }

      const bind = typeof config.server.port === 'string'
        ? 'Pipe ' + config.server.port
        : 'Port ' + config.server.port;

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