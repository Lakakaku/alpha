import cors from 'cors';
import { Request } from 'express';

// Define allowed origins for the three frontend applications
const allowedOrigins = [
  // Production URLs
  'https://customer.vocilia.se',
  'https://business.vocilia.se', 
  'https://admin.vocilia.se',
  
  // Staging URLs
  'https://customer-staging.vocilia.se',
  'https://business-staging.vocilia.se',
  'https://admin-staging.vocilia.se',
  
  // Development URLs
  'http://localhost:3000',
  'http://localhost:3001', 
  'http://localhost:3002',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3002',
  
  // Vercel preview URLs pattern (for deployment previews)
  /^https:\/\/.*\.vercel\.app$/,
];

// CORS configuration
const corsOptions: cors.CorsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) {
      return callback(null, true);
    }

    // Check if origin is in allowed list
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      if (typeof allowedOrigin === 'string') {
        return allowedOrigin === origin;
      } else if (allowedOrigin instanceof RegExp) {
        return allowedOrigin.test(origin);
      }
      return false;
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`CORS: Blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS policy'), false);
    }
  },
  
  // Allow specific HTTP methods
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  
  // Allow specific headers
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'X-API-Version',
    'X-Request-ID',
  ],
  
  // Allow credentials (cookies, authorization headers)
  credentials: true,
  
  // Cache preflight response for 24 hours
  maxAge: 86400,
  
  // Handle preflight requests
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

// Export configured CORS middleware
export const corsMiddleware = cors(corsOptions);

// Custom CORS middleware for development environment
export const developmentCorsMiddleware = cors({
  origin: true, // Allow all origins in development
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'X-API-Version',
    'X-Request-ID',
  ],
  credentials: true,
  maxAge: 86400,
  preflightContinue: false,
  optionsSuccessStatus: 204,
});

// Environment-aware CORS middleware selector
export const getEnvironmentCorsMiddleware = () => {
  const env = process.env.NODE_ENV || 'development';
  
  if (env === 'development' || env === 'test') {
    console.log('CORS: Using development CORS configuration (allows all origins)');
    return developmentCorsMiddleware;
  }
  
  console.log('CORS: Using production CORS configuration (restricted origins)');
  return corsMiddleware;
};

// Default export uses environment-aware configuration
export default getEnvironmentCorsMiddleware();