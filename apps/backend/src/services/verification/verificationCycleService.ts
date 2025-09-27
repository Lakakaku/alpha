import { createClient } from '@supabase/supabase-js';
import { WeeklyVerificationCycleModel } from '@vocilia/database/verification/weekly-verification-cycles';
import { VerificationDatabaseModel } from '@vocilia/database/verification/verification-databases';
import { WeeklyVerificationCycle, VerificationCycleStatus, getVerificationDeadline } from '@vocilia/types/verification';
import { AuditLogger } from '../audit/auditLogger';

export class VerificationCycleService {
  private supabase: ReturnType<typeof createClient>;
  private cycleModel: WeeklyVerificationCycleModel;
  private databaseModel: VerificationDatabaseModel;
  private auditLogger: AuditLogger;

  constructor(supabaseClient: ReturnType<typeof createClient>) {
    this.supabase = supabaseClient;
    this.cycleModel = new WeeklyVerificationCycleModel(supabaseClient);
    this.databaseModel = new VerificationDatabaseModel(supabaseClient);
    this.auditLogger = new AuditLogger(supabaseClient);
  }

  async createCycle(data: {
    cycle_week: string;
    created_by: string;
  }): Promise<WeeklyVerificationCycle> {
    // Validate cycle week format and constraints
    this.validateCycleWeek(data.cycle_week);

    // Check if cycle already exists
    const existingCycle = await this.cycleModel.findByWeek(data.cycle_week);
    if (existingCycle) {
      throw new Error('Verification cycle for this week already exists');
    }

    const cycle = await this.cycleModel.create(data);

    // Log cycle creation
    await this.auditLogger.log({
      action: 'verification_cycle_created',
      entity_type: 'weekly_verification_cycle',
      entity_id: cycle.id,
      admin_id: data.created_by,
      details: {
        cycle_week: data.cycle_week,
        status: cycle.status
      }
    });

    return cycle;
  }

  async getCycles(options: {
    page?: number;
    limit?: number;
    status?: VerificationCycleStatus;
  } = {}): Promise<{
    cycles: WeeklyVerificationCycle[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      total_pages: number;
    };
  }> {
    // Validate pagination parameters
    if (options.page && options.page < 1) {
      throw new Error('Page number must be 1 or greater');
    }
    if (options.limit && (options.limit < 1 || options.limit > 100)) {
      throw new Error('Limit must be between 1 and 100');
    }

    // Validate status filter
    if (options.status) {
      this.validateCycleStatus(options.status);
    }

    return this.cycleModel.list(options);
  }

  async getCycle(id: string): Promise<WeeklyVerificationCycle> {
    const cycle = await this.cycleModel.findById(id);
    if (!cycle) {
      throw new Error('Verification cycle not found');
    }
    return cycle;
  }

  async prepareDatabases(cycleId: string, adminId: string): Promise<{
    message: string;
    job_id: string;
  }> {
    const cycle = await this.getCycle(cycleId);

    // Validate cycle can be prepared
    if (cycle.status === 'preparing') {
      throw new Error('Cycle is currently being prepared');
    }

    if (['distributed', 'collecting', 'processing', 'invoicing', 'completed', 'expired'].includes(cycle.status)) {
      throw new Error('Cycle has already been prepared');
    }

    // Update cycle status to preparing
    await this.cycleModel.updateStatus(cycleId, 'preparing');

    // Get all active stores for the cycle
    const { data: stores, error } = await this.supabase
      .from('stores')
      .select('id, business_id')
      .eq('is_active', true);

    if (error) {
      throw new Error(`Failed to get stores: ${error.message}`);
    }

    if (!stores || stores.length === 0) {
      throw new Error('No active stores found for verification cycle');
    }

    // Update total stores count
    await this.cycleModel.updateStoreCount(cycleId, stores.length, 0);

    // Generate job ID for tracking
    const jobId = `prep_${cycleId}_${Date.now()}`;

    // Log preparation start
    await this.auditLogger.log({
      action: 'verification_preparation_started',
      entity_type: 'weekly_verification_cycle',
      entity_id: cycleId,
      admin_id: adminId,
      details: {
        total_stores: stores.length,
        job_id: jobId
      }
    });

    // In a real implementation, this would trigger a background job
    // For now, we'll simulate the preparation process
    this.simulatePreparationProcess(cycleId, stores, adminId, jobId);

    return {
      message: 'Database preparation started',
      job_id: jobId
    };
  }

  async getCycleDatabases(cycleId: string): Promise<any[]> {
    const cycle = await this.getCycle(cycleId);
    
    const databases = await this.databaseModel.findByCycle(cycleId);
    
    // Enhance with store information
    const enhancedDatabases = await Promise.all(
      databases.map(async (db) => {
        const { data: store } = await this.supabase
          .from('stores')
          .select('name, address, city')
          .eq('id', db.store_id)
          .single();

        const { data: business } = await this.supabase
          .from('businesses')
          .select('name, email')
          .eq('id', db.business_id)
          .single();

        return {
          ...db,
          store_name: store?.name,
          store_address: store?.address,
          store_city: store?.city,
          business_name: business?.name,
          business_email: business?.email
        };
      })
    );

    return enhancedDatabases;
  }

  async generateInvoices(cycleId: string, adminId: string): Promise<{
    invoices_created: number;
    total_amount: number;
  }> {
    const cycle = await this.getCycle(cycleId);

    // Validate cycle is ready for invoicing
    if (!['processing', 'invoicing'].includes(cycle.status)) {
      throw new Error('Cycle is not ready for invoicing');
    }

    // Get all processed verification databases
    const databases = await this.databaseModel.findByCycle(cycleId);
    const processedDatabases = databases.filter(db => db.status === 'processed');

    if (processedDatabases.length === 0) {
      throw new Error('No processed verification databases found');
    }

    let totalInvoices = 0;
    let totalAmount = 0;

    // Group by business and create invoices
    const businessGroups = processedDatabases.reduce((groups, db) => {
      if (!groups[db.business_id]) {
        groups[db.business_id] = [];
      }
      groups[db.business_id].push(db);
      return groups;
    }, {} as Record<string, typeof processedDatabases>);

    for (const [businessId, businessDatabases] of Object.entries(businessGroups)) {
      // Calculate total rewards for this business
      const totalRewards = businessDatabases.reduce((sum, db) => {
        // In real implementation, this would come from verification_records
        return sum + (db.verified_count * 10); // Simplified calculation
      }, 0);

      if (totalRewards > 0) {
        const adminFee = totalRewards * 0.2; // 20%
        const invoiceTotal = totalRewards + adminFee;

        // Create invoice (simplified - would use PaymentInvoiceModel)
        const { data: invoice, error } = await this.supabase
          .from('payment_invoices')
          .insert({
            cycle_id: cycleId,
            business_id: businessId,
            total_rewards: totalRewards,
            admin_fee: adminFee,
            total_amount: invoiceTotal,
            status: 'pending',
            invoice_date: new Date().toISOString().split('T')[0],
            due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 14 days
            feedback_database_delivered: false
          })
          .select()
          .single();

        if (error) {
          throw new Error(`Failed to create invoice for business ${businessId}: ${error.message}`);
        }

        totalInvoices++;
        totalAmount += invoiceTotal;
      }
    }

    // Update cycle status
    await this.cycleModel.updateStatus(cycleId, 'invoicing');

    // Log invoice generation
    await this.auditLogger.log({
      action: 'verification_invoices_generated',
      entity_type: 'weekly_verification_cycle',
      entity_id: cycleId,
      admin_id: adminId,
      details: {
        invoices_created: totalInvoices,
        total_amount: totalAmount
      }
    });

    return {
      invoices_created: totalInvoices,
      total_amount: totalAmount
    };
  }

  private validateCycleWeek(cycle_week: string): void {
    const date = new Date(cycle_week);
    
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date format for cycle_week');
    }

    if (date.getDay() !== 1) { // Monday = 1
      throw new Error('Cycle week must start on a Monday');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) {
      throw new Error('Cannot create cycle for past dates');
    }
  }

  private validateCycleStatus(status: string): void {
    const validStatuses: VerificationCycleStatus[] = [
      'preparing', 'ready', 'distributed', 'collecting', 
      'processing', 'invoicing', 'completed', 'expired'
    ];

    if (!validStatuses.includes(status as VerificationCycleStatus)) {
      throw new Error(`Invalid cycle status: ${status}`);
    }
  }

  private async simulatePreparationProcess(
    cycleId: string, 
    stores: any[], 
    adminId: string, 
    jobId: string
  ): Promise<void> {
    // In a real implementation, this would be a background job
    // For demonstration, we'll use a timeout to simulate async processing
    setTimeout(async () => {
      try {
        const cycleDate = new Date();
        const deadline = getVerificationDeadline(cycleDate);

        // Create verification databases for each store
        for (const store of stores) {
          // Get feedback count for this store in the cycle week
          const { count } = await this.supabase
            .from('feedback_sessions')
            .select('*', { count: 'exact', head: true })
            .eq('store_id', store.id)
            .gte('created_at', cycleDate.toISOString().split('T')[0])
            .lt('created_at', new Date(cycleDate.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

          if (count && count > 0) {
            await this.databaseModel.create({
              cycle_id: cycleId,
              store_id: store.id,
              business_id: store.business_id,
              deadline_at: deadline.toISOString(),
              transaction_count: count
            });
          }
        }

        // Update cycle status to ready
        await this.cycleModel.updateStatus(cycleId, 'ready');

        // Log completion
        await this.auditLogger.log({
          action: 'verification_preparation_completed',
          entity_type: 'weekly_verification_cycle',
          entity_id: cycleId,
          admin_id: adminId,
          details: {
            job_id: jobId,
            databases_created: stores.length
          }
        });

      } catch (error) {
        // Log error and update cycle status
        await this.auditLogger.log({
          action: 'verification_preparation_failed',
          entity_type: 'weekly_verification_cycle',
          entity_id: cycleId,
          admin_id: adminId,
          details: {
            job_id: jobId,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        });

        // Reset cycle status
        await this.cycleModel.updateStatus(cycleId, 'ready');
      }
    }, 1000); // 1 second delay for simulation
  }
}