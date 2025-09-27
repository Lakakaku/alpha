"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RewardCalculationQueries = void 0;
class RewardCalculationQueries {
    client;
    constructor(client) {
        this.client = client;
    }
    async create(data) {
        const { data: reward, error } = await this.client
            .from('reward_calculations')
            .insert(data)
            .select()
            .single();
        if (error)
            throw error;
        return reward;
    }
    async createMany(data) {
        const { data: rewards, error } = await this.client
            .from('reward_calculations')
            .insert(data)
            .select();
        if (error)
            throw error;
        return rewards || [];
    }
    async findByFeedbackId(feedbackId) {
        const { data, error } = await this.client
            .from('reward_calculations')
            .select('*')
            .eq('feedback_id', feedbackId)
            .single();
        if (error) {
            if (error.code === 'PGRST116')
                return null;
            throw error;
        }
        return data;
    }
    async findByCustomerPhone(customerPhone) {
        const { data, error } = await this.client
            .from('reward_calculations')
            .select('*')
            .eq('customer_phone', customerPhone)
            .order('created_at', { ascending: false });
        if (error)
            throw error;
        return data || [];
    }
    async findPendingRewards() {
        const { data, error } = await this.client
            .from('reward_calculations')
            .select('*')
            .eq('verified_by_business', true)
            .is('payment_transaction_id', null)
            .order('created_at', { ascending: true });
        if (error)
            throw error;
        return data || [];
    }
    async updatePaymentTransactionId(feedbackId, paymentTransactionId) {
        const { error } = await this.client
            .from('reward_calculations')
            .update({ payment_transaction_id: paymentTransactionId })
            .eq('feedback_id', feedbackId);
        if (error)
            throw error;
    }
    async aggregateByCustomer(customerPhone) {
        const { data, error } = await this.client
            .from('reward_calculations')
            .select('reward_amount_sek')
            .eq('customer_phone', customerPhone)
            .eq('verified_by_business', true)
            .is('payment_transaction_id', null);
        if (error)
            throw error;
        const total = data?.reduce((sum, row) => sum + row.reward_amount_sek, 0) || 0;
        return total;
    }
}
exports.RewardCalculationQueries = RewardCalculationQueries;
//# sourceMappingURL=reward-calculation.js.map