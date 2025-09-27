import type { Dinero } from 'dinero.js';

// Currency type alias for Swedish Kronor using dinero.js
export type SEKAmount = Dinero<number>;

// Insert type for creating payment transactions
export interface PaymentTransactionInsert {
  batch_id: string;
  customer_phone: string;
  amount_ore: number;
  status?: 'pending' | 'processing' | 'successful' | 'failed' | 'cancelled';
  swish_transaction_id?: string | null;
  retry_count?: number;
}

// Update type for payment transactions
export interface PaymentTransactionUpdate {
  status?: 'pending' | 'processing' | 'successful' | 'failed' | 'cancelled';
  swish_transaction_id?: string | null;
  retry_count?: number;
  processed_at?: string | null;
}

// Payment transaction record for Swish payments
export interface PaymentTransaction {
  id: string;
  batch_id: string;
  customer_phone: string;
  amount_ore: number; // Amount in öre (1 SEK = 100 öre)
  status: 'pending' | 'processing' | 'successful' | 'failed' | 'cancelled';
  swish_transaction_id?: string | null;
  retry_count: number;
  created_at: string;
  processed_at?: string | null;
  updated_at: string;
}

// Reward calculation for feedback quality
export interface RewardCalculation {
  id: string;
  feedback_id: string;
  customer_phone: string;
  store_id: string;
  business_id: string;
  transaction_id: string;
  transaction_amount_sek: number;
  quality_score: number;
  reward_percentage: number;
  reward_amount_sek: number;
  verified_by_business: boolean;
  payment_transaction_id?: string | null;
  created_at: string;
  updated_at: string;
}

// Insert type for creating reward calculations
export interface RewardCalculationInsert {
  feedback_id: string;
  customer_phone: string;
  store_id: string;
  business_id?: string;
  transaction_id: string;
  transaction_amount_sek: number;
  quality_score: number;
  reward_percentage: number;
  reward_amount_sek: number;
  verified_by_business: boolean;
  verified_at?: string;
  payment_transaction_id?: string | null;
}

// Insert type for creating payment batches
export interface PaymentBatchInsert {
  batch_week: string;
  status?: 'pending' | 'processing' | 'completed' | 'partial' | 'failed';
  total_customers?: number;
  total_amount_sek?: number;
  successful_payments?: number;
  failed_payments?: number;
}

// Update type for payment batches
export interface PaymentBatchUpdate {
  status?: 'pending' | 'processing' | 'completed' | 'partial' | 'failed';
  total_customers?: number;
  total_amount_sek?: number;
  successful_payments?: number;
  failed_payments?: number;
  job_lock_key?: string | null;
  job_locked_at?: string | null;
  job_locked_by?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
}

// Weekly payment batch processing
export interface PaymentBatch {
  id: string;
  batch_week: string; // ISO week format: '2025-W09'
  status: 'pending' | 'processing' | 'completed' | 'partial' | 'failed';
  total_customers: number;
  total_amount_sek: number;
  successful_payments: number;
  failed_payments: number;
  job_lock_key?: string | null;
  job_locked_at?: string | null;
  job_locked_by?: string | null;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
  updated_at: string;
}

// Insert type for creating payment failures
export interface PaymentFailureInsert {
  payment_transaction_id: string;
  failure_reason: string;
  swish_error_code?: string | null;
  attempt_number: number;
  retry_scheduled_at?: string | null;
  resolution_status?: 'pending' | 'retrying' | 'manual_review' | 'resolved' | 'abandoned';
}

// Update type for payment failures
export interface PaymentFailureUpdate {
  retry_scheduled_at?: string | null;
  resolution_status?: 'pending' | 'retrying' | 'manual_review' | 'resolved' | 'abandoned';
  admin_notes?: string | null;
  resolved_by?: string | null;
  resolved_at?: string | null;
}

// Payment failure tracking for retry handling
export interface PaymentFailure {
  id: string;
  payment_transaction_id: string;
  failure_reason: string;
  swish_error_code?: string | null;
  attempt_number: number;
  retry_scheduled_at?: string | null;
  resolution_status: 'pending' | 'retrying' | 'manual_review' | 'resolved' | 'abandoned';
  admin_notes?: string | null;
  resolved_by?: string | null;
  resolved_at?: string | null;
  created_at: string;
  updated_at: string;
}

// Insert type for creating reconciliation reports
export interface ReconciliationReportInsert {
  batch_id: string;
  report_period: string;
  total_rewards_paid_sek: number;
  admin_fees_collected_sek: number;
  total_business_invoices_sek: number;
  payment_success_count: number;
  payment_failure_count: number;
  payment_success_rate: number;
  discrepancies?: any | null;
}

// Weekly reconciliation report
export interface ReconciliationReport {
  id: string;
  batch_id: string;
  report_period: string; // ISO week format: '2025-W09'
  total_rewards_paid_sek: number;
  admin_fees_collected_sek: number;
  total_business_invoices_sek: number;
  payment_success_count: number;
  payment_failure_count: number;
  payment_success_rate: number;
  discrepancies?: any | null; // JSON object for tracking discrepancies
  created_at: string;
  updated_at: string;
}

// Insert type for creating business invoices
export interface BusinessInvoiceInsert {
  batch_id: string;
  business_id: string;
  invoice_period: string;
  stores: string[];
  total_reward_amount_sek: number;
  admin_fee_sek: number;
  total_invoice_amount_sek: number;
  payment_status?: 'pending' | 'paid' | 'overdue' | 'disputed';
  due_date: string;
}

// Update type for business invoices
export interface BusinessInvoiceUpdate {
  payment_status?: 'pending' | 'paid' | 'overdue' | 'disputed';
  paid_at?: string | null;
}

// Business invoice for weekly billing
export interface BusinessInvoice {
  id: string;
  batch_id: string;
  business_id: string;
  invoice_period: string; // ISO week format: '2025-W09'
  stores: string[]; // Array of store IDs
  total_reward_amount_sek: number;
  admin_fee_sek: number;
  total_invoice_amount_sek: number;
  payment_status: 'pending' | 'paid' | 'overdue' | 'disputed';
  due_date: string;
  paid_at?: string | null;
  created_at: string;
  updated_at: string;
}

// Swish API request format
export interface SwishPaymentRequest {
  payeeAlias: string;          // Merchant Swish number
  amount: string;              // SEK amount (e.g., "100.00")
  currency: 'SEK';
  payerAlias: string;          // Customer phone number (467XXXXXXXX)
  payeePaymentReference: string; // Unique reference ID
  callbackUrl: string;         // HTTPS callback for status updates
  message?: string;            // Optional payment description
}

// Swish API response format
export interface SwishPaymentResponse {
  id: string;
  status: 'CREATED' | 'PAID' | 'DECLINED' | 'ERROR' | 'CANCELLED';
  paymentReference: string;
  payeePaymentReference?: string;
  amount?: string;
  currency?: string;
  payerAlias?: string;
  payeeAlias?: string;
  message?: string;
  errorCode?: string;
  errorMessage?: string;
  additionalInformation?: string;
  dateCreated?: string;
  datePaid?: string;
}

// Swish error structure
export class SwishError extends Error {
  constructor(
    public code: string,
    public message: string,
    public additionalInformation?: string
  ) {
    super(message);
    this.name = 'SwishError';
  }
}

// Store breakdown for reconciliation
export interface StoreBreakdown {
  store_id: string;
  store_name: string;
  business_id: string;
  business_name: string;
  feedback_count: number;
  verified_count: number;
  average_quality_score: number;
  total_rewards_sek: number;
  successful_payments: number;
  failed_payments: number;
}

// Customer payment history summary
export interface CustomerPaymentSummary {
  customer_phone: string;
  total_payments: number;
  total_amount_sek: number;
  successful_payments: number;
  failed_payments: number;
  pending_amount_sek: number;
  first_payment_date?: string;
  last_payment_date?: string;
  average_reward_percentage: number;
  stores_visited: number;
}

// Payment stats for admin dashboard
export interface PaymentStats {
  totalPaymentsThisWeek: number;
  successRatePercent: number;
  totalAmountPaidSek: number;
  failedPaymentsCount: number;
  pendingRewardsCount: number;
  pendingRewardsSek: number;
  averageRewardSek: number;
  lastBatchProcessedAt?: string;
}

// Admin payment calculation request
export interface CalculateRewardsRequest {
  feedbackIds: string[];
}

// Admin payment calculation response
export interface CalculateRewardsResponse {
  rewards: RewardCalculation[];
  totalRewards: number;
  qualifiedCount: number;
  disqualifiedCount: number;
  averageQualityScore: number;
}

// Process batch request
export interface ProcessBatchRequest {
  batchWeek?: string; // Optional, defaults to previous week
  forceReprocess?: boolean;
}

// Process batch response
export interface ProcessBatchResponse {
  batchId: string;
  batchWeek: string;
  status: string;
  message: string;
}

// Failed payments query params
export interface FailedPaymentsQuery {
  status?: 'pending' | 'manual_review';
  limit?: number;
  offset?: number;
}

// Retry payment request
export interface RetryPaymentRequest {
  updatedPhone?: string;
  adminNotes?: string;
  force?: boolean;
}

// Customer history query params
export interface CustomerHistoryQuery {
  limit?: number;
  offset?: number;
  startDate?: string;
  endDate?: string;
}