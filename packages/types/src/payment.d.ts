import type { Dinero } from 'dinero.js';
export type SEKAmount = Dinero<number>;
export interface PaymentTransactionInsert {
    batch_id: string;
    customer_phone: string;
    amount_ore: number;
    status?: 'pending' | 'processing' | 'successful' | 'failed' | 'cancelled';
    swish_transaction_id?: string | null;
    retry_count?: number;
}
export interface PaymentTransactionUpdate {
    status?: 'pending' | 'processing' | 'successful' | 'failed' | 'cancelled';
    swish_transaction_id?: string | null;
    retry_count?: number;
    processed_at?: string | null;
}
export interface PaymentTransaction {
    id: string;
    batch_id: string;
    customer_phone: string;
    amount_ore: number;
    status: 'pending' | 'processing' | 'successful' | 'failed' | 'cancelled';
    swish_transaction_id?: string | null;
    retry_count: number;
    created_at: string;
    processed_at?: string | null;
    updated_at: string;
}
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
export interface PaymentBatchInsert {
    batch_week: string;
    status?: 'pending' | 'processing' | 'completed' | 'partial' | 'failed';
    total_customers?: number;
    total_amount_sek?: number;
    successful_payments?: number;
    failed_payments?: number;
}
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
export interface PaymentBatch {
    id: string;
    batch_week: string;
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
export interface PaymentFailureInsert {
    payment_transaction_id: string;
    failure_reason: string;
    swish_error_code?: string | null;
    attempt_number: number;
    retry_scheduled_at?: string | null;
    resolution_status?: 'pending' | 'retrying' | 'manual_review' | 'resolved' | 'abandoned';
}
export interface PaymentFailureUpdate {
    retry_scheduled_at?: string | null;
    resolution_status?: 'pending' | 'retrying' | 'manual_review' | 'resolved' | 'abandoned';
    admin_notes?: string | null;
    resolved_by?: string | null;
    resolved_at?: string | null;
}
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
export interface ReconciliationReport {
    id: string;
    batch_id: string;
    report_period: string;
    total_rewards_paid_sek: number;
    admin_fees_collected_sek: number;
    total_business_invoices_sek: number;
    payment_success_count: number;
    payment_failure_count: number;
    payment_success_rate: number;
    discrepancies?: any | null;
    created_at: string;
    updated_at: string;
}
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
export interface BusinessInvoiceUpdate {
    payment_status?: 'pending' | 'paid' | 'overdue' | 'disputed';
    paid_at?: string | null;
}
export interface BusinessInvoice {
    id: string;
    batch_id: string;
    business_id: string;
    invoice_period: string;
    stores: string[];
    total_reward_amount_sek: number;
    admin_fee_sek: number;
    total_invoice_amount_sek: number;
    payment_status: 'pending' | 'paid' | 'overdue' | 'disputed';
    due_date: string;
    paid_at?: string | null;
    created_at: string;
    updated_at: string;
}
export interface SwishPaymentRequest {
    payeeAlias: string;
    amount: string;
    currency: 'SEK';
    payerAlias: string;
    payeePaymentReference: string;
    callbackUrl: string;
    message?: string;
}
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
export declare class SwishError extends Error {
    code: string;
    message: string;
    additionalInformation?: string | undefined;
    constructor(code: string, message: string, additionalInformation?: string | undefined);
}
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
export interface CalculateRewardsRequest {
    feedbackIds: string[];
}
export interface CalculateRewardsResponse {
    rewards: RewardCalculation[];
    totalRewards: number;
    qualifiedCount: number;
    disqualifiedCount: number;
    averageQualityScore: number;
}
export interface ProcessBatchRequest {
    batchWeek?: string;
    forceReprocess?: boolean;
}
export interface ProcessBatchResponse {
    batchId: string;
    batchWeek: string;
    status: string;
    message: string;
}
export interface FailedPaymentsQuery {
    status?: 'pending' | 'manual_review';
    limit?: number;
    offset?: number;
}
export interface RetryPaymentRequest {
    updatedPhone?: string;
    adminNotes?: string;
    force?: boolean;
}
export interface CustomerHistoryQuery {
    limit?: number;
    offset?: number;
    startDate?: string;
    endDate?: string;
}
//# sourceMappingURL=payment.d.ts.map