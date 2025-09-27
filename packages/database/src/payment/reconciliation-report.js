"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReconciliationReportQueries = void 0;
class ReconciliationReportQueries {
    client;
    constructor(client) {
        this.client = client;
    }
    async create(data) {
        const { data: report, error } = await this.client
            .from('reconciliation_reports')
            .insert(data)
            .select()
            .single();
        if (error)
            throw error;
        return report;
    }
    async findByBatchId(batchId) {
        const { data, error } = await this.client
            .from('reconciliation_reports')
            .select('*')
            .eq('batch_id', batchId)
            .single();
        if (error) {
            if (error.code === 'PGRST116')
                return null;
            throw error;
        }
        return data;
    }
    async findByReportPeriod(reportPeriod) {
        const { data, error } = await this.client
            .from('reconciliation_reports')
            .select('*')
            .eq('report_period', reportPeriod)
            .single();
        if (error) {
            if (error.code === 'PGRST116')
                return null;
            throw error;
        }
        return data;
    }
    async generateStoreBreakdown(batchId) {
        const { data, error } = await this.client
            .rpc('generate_store_breakdown', { batch_id: batchId });
        if (error)
            throw error;
        return data || [];
    }
    async calculateDiscrepancies(batchId) {
        const { data, error } = await this.client
            .rpc('calculate_batch_discrepancies', { batch_id: batchId });
        if (error)
            throw error;
        return data || { count: 0, amountSek: 0 };
    }
}
exports.ReconciliationReportQueries = ReconciliationReportQueries;
//# sourceMappingURL=reconciliation-report.js.map