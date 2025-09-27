import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';
import { DatabasePreparationService } from '../services/verification/databasePreparationService';
import { VerificationCycleService } from '../services/verification/verificationCycleService';
import { FileExportService } from '../services/verification/fileExportService';
import { NotificationService } from '../services/verification/notificationService';

interface DatabasePreparationJob {
  id: string;
  cycleId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  progress: {
    totalStores: number;
    processedStores: number;
    currentStore?: string;
  };
}

interface FeedbackData {
  id: string;
  store_id: string;
  business_id: string;
  created_at: string;
  transaction_value: number;
  phone_number: string;
}

export class DatabasePreparationJobProcessor {
  private supabase;
  private databasePreparationService: DatabasePreparationService;
  private verificationCycleService: VerificationCycleService;
  private fileExportService: FileExportService;
  private notificationService: NotificationService;
  private runningJobs: Map<string, DatabasePreparationJob> = new Map();

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    this.databasePreparationService = new DatabasePreparationService();
    this.verificationCycleService = new VerificationCycleService();
    this.fileExportService = new FileExportService();
    this.notificationService = new NotificationService();
  }

  async startPreparation(cycleId: string): Promise<string> {
    const jobId = uuidv4();
    
    const job: DatabasePreparationJob = {
      id: jobId,
      cycleId,
      status: 'pending',
      progress: {
        totalStores: 0,
        processedStores: 0
      }
    };

    this.runningJobs.set(jobId, job);

    // Start the job in background
    this.processJob(jobId).catch(error => {
      console.error(`Database preparation job ${jobId} failed:`, error);
      this.updateJobStatus(jobId, 'failed', error.message);
    });

    return jobId;
  }

  getJobStatus(jobId: string): DatabasePreparationJob | null {
    return this.runningJobs.get(jobId) || null;
  }

  private async processJob(jobId: string): Promise<void> {
    const job = this.runningJobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    try {
      // Update job status to running
      this.updateJobStatus(jobId, 'running');

      // Get cycle details
      const cycle = await this.verificationCycleService.getCycleById(job.cycleId);
      if (!cycle) {
        throw new Error(`Verification cycle ${job.cycleId} not found`);
      }

      // Validate cycle status
      if (cycle.status !== 'preparing') {
        throw new Error(`Cycle status is '${cycle.status}', expected 'preparing'`);
      }

      // Get all stores that need verification databases
      const stores = await this.getActiveStores();
      job.progress.totalStores = stores.length;

      console.log(`Starting database preparation for ${stores.length} stores in cycle ${job.cycleId}`);

      // Process each store
      for (const store of stores) {
        job.progress.currentStore = store.name;
        
        console.log(`Processing store: ${store.name} (${store.id})`);
        
        // Get feedback data for the cycle week
        const feedbackData = await this.getFeedbackDataForStore(store.id, cycle.cycle_week);
        
        if (feedbackData.length === 0) {
          console.log(`No feedback data found for store ${store.name}, skipping`);
          job.progress.processedStores++;
          continue;
        }

        // Create verification database entry
        const verificationDatabase = await this.createVerificationDatabase(
          job.cycleId,
          store.id,
          store.business_id,
          feedbackData.length
        );

        // Generate verification files (CSV, Excel, JSON)
        await this.generateVerificationFiles(verificationDatabase.id, feedbackData);

        // Create verification records
        await this.createVerificationRecords(verificationDatabase.id, feedbackData);

        job.progress.processedStores++;
        
        console.log(`Completed processing store: ${store.name} (${job.progress.processedStores}/${job.progress.totalStores})`);
      }

      // Update cycle status to ready
      await this.verificationCycleService.updateCycleStatus(job.cycleId, 'ready');

      // Send notifications to businesses
      await this.notificationService.sendVerificationAvailableNotifications(job.cycleId);

      // Mark job as completed
      this.updateJobStatus(jobId, 'completed');

      console.log(`Database preparation job ${jobId} completed successfully`);

    } catch (error) {
      console.error(`Database preparation job ${jobId} failed:`, error);
      this.updateJobStatus(jobId, 'failed', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  private updateJobStatus(jobId: string, status: DatabasePreparationJob['status'], error?: string): void {
    const job = this.runningJobs.get(jobId);
    if (!job) return;

    job.status = status;
    job.error = error;

    if (status === 'running' && !job.startedAt) {
      job.startedAt = new Date();
    }

    if (status === 'completed' || status === 'failed') {
      job.completedAt = new Date();
    }

    this.runningJobs.set(jobId, job);
  }

  private async getActiveStores(): Promise<Array<{ id: string; name: string; business_id: string }>> {
    const { data, error } = await this.supabase
      .from('stores')
      .select('id, name, business_id')
      .eq('status', 'active');

    if (error) {
      throw new Error(`Failed to get active stores: ${error.message}`);
    }

    return data || [];
  }

  private async getFeedbackDataForStore(storeId: string, cycleWeek: string): Promise<FeedbackData[]> {
    // Calculate the week range (Monday to Sunday)
    const startDate = new Date(cycleWeek);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);

    const { data, error } = await this.supabase
      .from('feedback_sessions')
      .select(`
        id,
        store_id,
        business_id,
        created_at,
        transaction_value,
        phone_number
      `)
      .eq('store_id', storeId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .eq('status', 'completed')
      .not('transaction_value', 'is', null)
      .not('phone_number', 'is', null);

    if (error) {
      throw new Error(`Failed to get feedback data for store ${storeId}: ${error.message}`);
    }

    return data || [];
  }

  private async createVerificationDatabase(
    cycleId: string,
    storeId: string,
    businessId: string,
    transactionCount: number
  ): Promise<{ id: string }> {
    // Calculate deadline (5 business days from now)
    const deadline = new Date();
    let businessDays = 0;
    while (businessDays < 5) {
      deadline.setDate(deadline.getDate() + 1);
      if (deadline.getDay() !== 0 && deadline.getDay() !== 6) { // Not weekend
        businessDays++;
      }
    }

    const { data, error } = await this.supabase
      .from('verification_databases')
      .insert({
        cycle_id: cycleId,
        store_id: storeId,
        business_id: businessId,
        transaction_count: transactionCount,
        deadline_at: deadline.toISOString(),
        status: 'preparing'
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to create verification database: ${error.message}`);
    }

    return data;
  }

  private async generateVerificationFiles(databaseId: string, feedbackData: FeedbackData[]): Promise<void> {
    // Sanitize data for business verification (remove sensitive info)
    const sanitizedData = feedbackData.map(item => ({
      transaction_id: item.id,
      transaction_time: item.created_at,
      transaction_value: item.transaction_value,
      verification_status: 'pending' // Default status for verification
    }));

    try {
      // Generate files in all formats
      const csvUrl = await this.fileExportService.generateCsvFile(databaseId, sanitizedData);
      const excelUrl = await this.fileExportService.generateExcelFile(databaseId, sanitizedData);
      const jsonUrl = await this.fileExportService.generateJsonFile(databaseId, sanitizedData);

      // Update database record with file URLs
      const { error } = await this.supabase
        .from('verification_databases')
        .update({
          csv_file_url: csvUrl,
          excel_file_url: excelUrl,
          json_file_url: jsonUrl,
          status: 'ready'
        })
        .eq('id', databaseId);

      if (error) {
        throw new Error(`Failed to update verification database with file URLs: ${error.message}`);
      }

    } catch (error) {
      console.error(`Failed to generate verification files for database ${databaseId}:`, error);
      throw error;
    }
  }

  private async createVerificationRecords(databaseId: string, feedbackData: FeedbackData[]): Promise<void> {
    const records = feedbackData.map(item => ({
      verification_db_id: databaseId,
      original_feedback_id: item.id,
      transaction_time: item.created_at,
      transaction_value: item.transaction_value,
      verification_status: 'pending',
      // Calculate potential reward (example: 5% of transaction value)
      reward_percentage: 5.00,
      reward_amount: item.transaction_value * 0.05
    }));

    const { error } = await this.supabase
      .from('verification_records')
      .insert(records);

    if (error) {
      throw new Error(`Failed to create verification records: ${error.message}`);
    }

    console.log(`Created ${records.length} verification records for database ${databaseId}`);
  }

  // Cleanup completed jobs (call periodically)
  cleanupCompletedJobs(olderThanHours: number = 24): void {
    const cutoffTime = new Date(Date.now() - (olderThanHours * 60 * 60 * 1000));
    
    for (const [jobId, job] of this.runningJobs.entries()) {
      if ((job.status === 'completed' || job.status === 'failed') && 
          job.completedAt && 
          job.completedAt < cutoffTime) {
        this.runningJobs.delete(jobId);
      }
    }
  }
}

// Export singleton instance
export const databasePreparationProcessor = new DatabasePreparationJobProcessor();