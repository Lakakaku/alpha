"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BusinessInvoiceQueries = void 0;
class BusinessInvoiceQueries {
    client;
    constructor(client) {
        this.client = client;
    }
    async create(data) {
        const { data: invoice, error } = await this.client
            .from('business_invoices')
            .insert(data)
            .select()
            .single();
        if (error)
            throw error;
        return invoice;
    }
    async createMany(data) {
        const { data: invoices, error } = await this.client
            .from('business_invoices')
            .insert(data)
            .select();
        if (error)
            throw error;
        return invoices || [];
    }
    async findByBusinessId(businessId) {
        const { data, error } = await this.client
            .from('business_invoices')
            .select('*')
            .eq('business_id', businessId)
            .order('created_at', { ascending: false });
        if (error)
            throw error;
        return data || [];
    }
    async findByBatchId(batchId) {
        const { data, error } = await this.client
            .from('business_invoices')
            .select('*')
            .eq('batch_id', batchId)
            .order('created_at', { ascending: false });
        if (error)
            throw error;
        return data || [];
    }
    async findByPaymentStatus(status, limit = 100, offset = 0) {
        const { data, error, count } = await this.client
            .from('business_invoices')
            .select('*, businesses:business_id(name, email)', { count: 'exact' })
            .eq('payment_status', status)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);
        if (error)
            throw error;
        return { invoices: data || [], total: count || 0 };
    }
    async update(id, data) {
        const { data: invoice, error } = await this.client
            .from('business_invoices')
            .update(data)
            .eq('id', id)
            .select()
            .single();
        if (error)
            throw error;
        return invoice;
    }
}
exports.BusinessInvoiceQueries = BusinessInvoiceQueries;
//# sourceMappingURL=business-invoice.js.map