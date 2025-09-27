"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentFailureQueries = void 0;
class PaymentFailureQueries {
    client;
    constructor(client) {
        this.client = client;
    }
    async create(data) {
        const { data: failure, error } = await this.client
            .from('payment_failures')
            .insert(data)
            .select()
            .single();
        if (error)
            throw error;
        return failure;
    }
    async findByPaymentTransactionId(paymentTransactionId) {
        const { data, error } = await this.client
            .from('payment_failures')
            .select('*')
            .eq('payment_transaction_id', paymentTransactionId)
            .order('attempt_number', { ascending: true });
        if (error)
            throw error;
        return data || [];
    }
    async findPendingRetries() {
        const now = new Date().toISOString();
        const { data, error } = await this.client
            .from('payment_failures')
            .select('*')
            .eq('resolution_status', 'retrying')
            .lte('retry_scheduled_at', now)
            .order('retry_scheduled_at', { ascending: true });
        if (error)
            throw error;
        return data || [];
    }
    async findByStatus(status, limit = 100, offset = 0) {
        const { data, error, count } = await this.client
            .from('payment_failures')
            .select('*, payment_transactions:payment_transaction_id(*)', { count: 'exact' })
            .eq('resolution_status', status)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);
        if (error)
            throw error;
        return { failures: data || [], total: count || 0 };
    }
    async update(id, data) {
        const { data: failure, error } = await this.client
            .from('payment_failures')
            .update(data)
            .eq('id', id)
            .select()
            .single();
        if (error)
            throw error;
        return failure;
    }
}
exports.PaymentFailureQueries = PaymentFailureQueries;
//# sourceMappingURL=payment-failure.js.map