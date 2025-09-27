// QR Verification System Models
export { VerificationSessionModel } from './VerificationSession';
export { CustomerVerificationModel } from './CustomerVerification';
export { FraudDetectionLogModel } from './FraudDetectionLog';
export { StoreModel } from './Store';

// Database Configuration
export { QRDatabase } from '../config/qr-database';

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