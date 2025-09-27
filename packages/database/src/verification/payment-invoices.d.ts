import type { PaymentInvoice, PaymentStatus, SwishStatus } from '@vocilia/types/verification';
export declare class PaymentInvoiceModel {
    private static getSupabaseClient;
    /**
     * Create a new payment invoice
     */
    static create(data: {
        weekly_verification_cycle_id: string;
        business_id: string;
        phone_number: string;
        total_amount: number;
        transaction_count: number;
        due_date: string;
        payment_details: Record<string, any>;
    }): Promise<PaymentInvoice>;
    /**
     * Get payment invoices by cycle ID
     */
    static getByCycleId(cycleId: string, options?: {
        payment_status?: PaymentStatus;
        swish_status?: SwishStatus;
        limit?: number;
        offset?: number;
    }): Promise<PaymentInvoice[]>;
    /**
     * Get payment invoice by ID
     */
    static getById(id: string): Promise<PaymentInvoice | null>;
    /**
     * Get invoices by business ID
     */
    static getByBusinessId(businessId: string, options?: {
        payment_status?: PaymentStatus;
        limit?: number;
        offset?: number;
    }): Promise<PaymentInvoice[]>;
    /**
     * Update payment status
     */
    static updatePaymentStatus(id: string, paymentStatus: PaymentStatus, paymentDetails?: Record<string, any>): Promise<PaymentInvoice>;
    /**
     * Update Swish status
     */
    static updateSwishStatus(id: string, swishStatus: SwishStatus, swishReference?: string): Promise<PaymentInvoice>;
    /**
     * Get overdue invoices
     */
    static getOverdueInvoices(currentDate: Date): Promise<PaymentInvoice[]>;
    /**
     * Get payment statistics for a cycle
     */
    static getPaymentStatistics(cycleId: string): Promise<{
        total_invoices: number;
        total_amount: number;
        paid_invoices: number;
        paid_amount: number;
        pending_invoices: number;
        pending_amount: number;
        overdue_invoices: number;
        overdue_amount: number;
    }>;
    /**
     * Bulk create payment invoices
     */
    static bulkCreate(invoices: Array<{
        weekly_verification_cycle_id: string;
        business_id: string;
        phone_number: string;
        total_amount: number;
        transaction_count: number;
        due_date: string;
        payment_details: Record<string, any>;
    }>): Promise<PaymentInvoice[]>;
    /**
     * Delete payment invoice
     */
    static delete(id: string): Promise<void>;
    /**
     * Get invoices by phone number
     */
    static getByPhoneNumber(phoneNumber: string): Promise<PaymentInvoice[]>;
}
//# sourceMappingURL=payment-invoices.d.ts.map