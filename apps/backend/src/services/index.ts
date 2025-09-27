// QR Verification System Services
export { QRSessionManager } from './qr/session-management';
export { FraudDetector } from './qr/fraud-detection';
export { VerificationValidator } from './validation-scoring';
export { CustomerVerificationService } from './questions/customer-verification';

// Database and Models
export { 
  QRDatabase,
  VerificationSessionModel,
  CustomerVerificationModel,
  FraudDetectionLogModel
} from '../models';

// Utilities
export { DatabaseValidator } from '../utils/database-validation';
export { DatabaseHealthChecker, databaseHealthChecker } from '../utils/database-health';

// Re-export types for convenience
export type {
  VerificationSession,
  CustomerVerification,
  FraudDetectionLog,
  VerificationSessionStatus,
  VerificationStatus,
  ValidationResults,
  QRVerificationRequest,
  QRVerificationResponse,
  VerificationSubmissionRequest,
  VerificationSubmissionResponse,
  SessionDetailsResponse
} from '@vocilia/types';