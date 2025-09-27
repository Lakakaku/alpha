import { SupabaseClient } from '@supabase/supabase-js';
import type { BusinessInvoice, BusinessInvoiceInsert, BusinessInvoiceUpdate } from '@vocilia/types';
export declare class BusinessInvoiceQueries {
    private client;
    constructor(client: SupabaseClient);
    create(data: BusinessInvoiceInsert): Promise<BusinessInvoice>;
    createMany(data: BusinessInvoiceInsert[]): Promise<BusinessInvoice[]>;
    findByBusinessId(businessId: string): Promise<BusinessInvoice[]>;
    findByBatchId(batchId: string): Promise<BusinessInvoice[]>;
    findByPaymentStatus(status: string, limit?: number, offset?: number): Promise<{
        invoices: BusinessInvoice[];
        total: number;
    }>;
    update(id: string, data: BusinessInvoiceUpdate): Promise<BusinessInvoice>;
}
//# sourceMappingURL=business-invoice.d.ts.map