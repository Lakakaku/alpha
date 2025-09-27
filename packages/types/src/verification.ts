// Weekly Verification Workflow Types
// Feature: 014-step-4-2

export type VerificationCycleStatus = 
  | 'preparing'     // Data aggregation in progress
  | 'ready'         // Databases prepared, ready for distribution
  | 'distributed'   // Sent to businesses
  | 'collecting'    // Waiting for business submissions
  | 'processing'    // Processing submitted verifications
  | 'invoicing'     // Generating invoices
  | 'completed'     // All payments processed
  | 'expired';      // Deadline passed with incomplete submissions

export type VerificationDbStatus = 
  | 'preparing'     // Database being generated
  | 'ready'         // Ready for business download
  | 'downloaded'    // Business has accessed files
  | 'submitted'     // Business has submitted verification
  | 'processed'     // Admin has processed submission
  | 'expired';      // Deadline passed without submission

export type VerificationStatus = 
  | 'pending'       // Awaiting business verification
  | 'verified'      // Confirmed as legitimate transaction
  | 'fake'          // Marked as fraudulent by business
  | 'expired';      // Not verified before deadline

export type PaymentStatus = 
  | 'pending'       // Invoice generated, awaiting payment
  | 'paid'          // Payment received and confirmed
  | 'overdue'       // Past due date
  | 'disputed'      // Business has disputed charges
  | 'cancelled';    // Invoice cancelled by admin

export type SwishStatus = 
  | 'pending'       // Ready for Swish payment
  | 'processing'    // Payment initiated with Swish
  | 'completed'     // Payment successful
  | 'failed'        // Payment failed
  | 'invalid_number'; // Phone number invalid for Swish

export interface WeeklyVerificationCycle {
  id: string;
  cycle_week: string; // ISO date string for Monday of the week
  status: VerificationCycleStatus;
  total_stores: number;
  completed_stores: number;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface VerificationDatabase {
  id: string;
  cycle_id: string;
  store_id: string;
  business_id: string;
  
  // File information
  csv_file_url?: string;
  excel_file_url?: string;
  json_file_url?: string;
  transaction_count: number;
  
  // Status tracking
  status: VerificationDbStatus;
  deadline_at: string;
  submitted_at?: string;
  
  // Verification results
  verified_count: number;
  fake_count: number;
  unverified_count: number;
  
  created_at: string;
  updated_at: string;
}

export interface VerificationRecord {
  id: string;
  verification_db_id: string;
  
  // Original transaction reference
  original_feedback_id: string;
  transaction_time: string;
  transaction_value: number;
  
  // Verification result
  verification_status: VerificationStatus;
  verified_by?: string;
  verified_at?: string;
  
  // Rewards calculation
  reward_percentage?: number; // 2.00 to 15.00
  reward_amount?: number;
  
  created_at: string;
  updated_at: string;
}

export interface PaymentInvoice {
  id: string;
  cycle_id: string;
  business_id: string;
  
  // Financial details
  total_rewards: number;
  admin_fee: number; // 20% of rewards
  total_amount: number; // rewards + fee
  
  // Payment tracking
  status: PaymentStatus;
  invoice_date: string;
  due_date: string;
  paid_at?: string;
  
  // File delivery
  feedback_database_delivered: boolean;
  delivered_at?: string;
  
  created_at: string;
  updated_at: string;
}

export interface CustomerRewardBatch {
  id: string;
  cycle_id: string;
  phone_number: string;
  
  // Reward aggregation
  total_reward_amount: number;
  transaction_count: number;
  
  // Payment processing
  swish_payment_status: SwishStatus;
  swish_payment_id?: string;
  paid_at?: string;
  failure_reason?: string;
  
  created_at: string;
  updated_at: string;
}

// API Request/Response types

export interface CreateVerificationCycleRequest {
  cycle_week: string; // ISO date string for Monday
}

export interface PrepareVerificationDatabasesRequest {
  cycle_id: string;
  store_ids?: string[]; // Optional: specific stores, otherwise all stores
}

export interface SubmitVerificationRequest {
  verification_db_id: string;
  records: Array<{
    id: string;
    verification_status: 'verified' | 'fake';
  }>;
}

export interface UpdatePaymentStatusRequest {
  invoice_id: string;
  status: PaymentStatus;
  payment_date?: string;
}

export interface VerificationExportFormat {
  format: 'csv' | 'excel' | 'json';
}

export interface VerificationDashboardStats {
  current_cycle?: WeeklyVerificationCycle;
  total_pending_verifications: number;
  total_pending_payments: number;
  total_overdue_submissions: number;
  recent_cycles: WeeklyVerificationCycle[];
}

export interface BusinessVerificationSummary {
  database: VerificationDatabase;
  total_transactions: number;
  verified_transactions: number;
  fake_transactions: number;
  pending_transactions: number;
  deadline_remaining_hours: number;
  invoice?: PaymentInvoice;
}

// Validation helpers
export const VERIFICATION_CONSTANTS = {
  MIN_REWARD_PERCENTAGE: 2.00,
  MAX_REWARD_PERCENTAGE: 15.00,
  ADMIN_FEE_PERCENTAGE: 20.00,
  VERIFICATION_DEADLINE_DAYS: 5, // Business days
  MAX_TRANSACTIONS_PER_STORE: 1000,
  EXPORT_FORMATS: ['csv', 'excel', 'json'] as const,
} as const;

export function calculateAdminFee(totalRewards: number): number {
  return totalRewards * (VERIFICATION_CONSTANTS.ADMIN_FEE_PERCENTAGE / 100);
}

export function calculateRewardAmount(transactionValue: number, rewardPercentage: number): number {
  return transactionValue * (rewardPercentage / 100);
}

export function isValidRewardPercentage(percentage: number): boolean {
  return percentage >= VERIFICATION_CONSTANTS.MIN_REWARD_PERCENTAGE && 
         percentage <= VERIFICATION_CONSTANTS.MAX_REWARD_PERCENTAGE;
}

export function getVerificationDeadline(cycleStartDate: Date): Date {
  const deadline = new Date(cycleStartDate);
  let businessDaysAdded = 0;
  
  while (businessDaysAdded < VERIFICATION_CONSTANTS.VERIFICATION_DEADLINE_DAYS) {
    deadline.setDate(deadline.getDate() + 1);
    // Skip weekends (0 = Sunday, 6 = Saturday)
    if (deadline.getDay() !== 0 && deadline.getDay() !== 6) {
      businessDaysAdded++;
    }
  }
  
  return deadline;
}