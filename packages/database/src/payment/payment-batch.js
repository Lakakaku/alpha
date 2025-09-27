"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentBatchQueries = void 0;
class PaymentBatchQueries {
    client;
    constructor(client) {
        this.client = client;
    }
    async create(data) {
        const { data: batch, error } = await this.client
            .from('payment_batches')
            .insert(data)
            .select()
            .single();
        if (error)
            throw error;
        return batch;
    }
    async findById(id) {
        const { data, error } = await this.client
            .from('payment_batches')
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
    async findByWeek(batchWeek) {
        const { data, error } = await this.client
            .from('payment_batches')
            .select('*')
            .eq('batch_week', batchWeek)
            .single();
        if (error) {
            if (error.code === 'PGRST116')
                return null;
            throw error;
        }
        return data;
    }
    async update(id, data) {
        const { data: batch, error } = await this.client
            .from('payment_batches')
            .update(data)
            .eq('id', id)
            .select()
            .single();
        if (error)
            throw error;
        return batch;
    }
    async acquireJobLock(batchId, lockKey, lockedBy) {
        const { data, error } = await this.client
            .from('payment_batches')
            .update({
            job_lock_key: lockKey,
            job_locked_at: new Date().toISOString(),
            job_locked_by: lockedBy
        })
            .eq('id', batchId)
            .is('job_lock_key', null)
            .select()
            .single();
        if (error || !data)
            return false;
        return true;
    }
    async releaseJobLock(batchId) {
        const { error } = await this.client
            .from('payment_batches')
            .update({
            job_lock_key: null,
            job_locked_at: null,
            job_locked_by: null
        })
            .eq('id', batchId);
        if (error)
            throw error;
    }
}
exports.PaymentBatchQueries = PaymentBatchQueries;
//# sourceMappingURL=payment-batch.js.map