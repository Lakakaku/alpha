"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentTransactionQueries = void 0;
class PaymentTransactionQueries {
    client;
    constructor(client) {
        this.client = client;
    }
    async create(data) {
        const { data: transaction, error } = await this.client
            .from('payment_transactions')
            .insert(data)
            .select()
            .single();
        if (error)
            throw error;
        return transaction;
    }
    async findById(id) {
        const { data, error } = await this.client
            .from('payment_transactions')
            .select('*')
            .eq('id', id)
            .single();
        if (error) {
            if (error.code === 'PGRST116')
                return null;
            throw error;
        }
        return data;
    }
    async findByBatchId(batchId) {
        const { data, error } = await this.client
            .from('payment_transactions')
            .select('*')
            .eq('batch_id', batchId)
            .order('created_at', { ascending: false });
        if (error)
            throw error;
        return data || [];
    }
    async findByCustomerPhone(customerPhone) {
        const { data, error } = await this.client
            .from('payment_transactions')
            .select('*')
            .eq('customer_phone', customerPhone)
            .order('created_at', { ascending: false });
        if (error)
            throw error;
        return data || [];
    }
    async findByStatus(status) {
        const { data, error } = await this.client
            .from('payment_transactions')
            .select('*')
            .eq('status', status)
            .order('created_at', { ascending: false });
        if (error)
            throw error;
        return data || [];
    }
    async update(id, data) {
        const { data: transaction, error } = await this.client
            .from('payment_transactions')
            .update(data)
            .eq('id', id)
            .select()
            .single();
        if (error)
            throw error;
        return transaction;
    }
    async aggregateByCustomerForBatch(batchWeek) {
        const { data, error } = await this.client
            .rpc('aggregate_pending_rewards_by_customer', { batch_week: batchWeek });
        if (error)
            throw error;
        const aggregated = new Map();
        if (data) {
            data.forEach((row) => {
                aggregated.set(row.customer_phone, row.total_amount_sek);
            });
        }
        return aggregated;
    }
}
exports.PaymentTransactionQueries = PaymentTransactionQueries;
//# sourceMappingURL=payment-transaction.js.map