import { WeeklyVerificationCycleModel, VerificationDatabaseModel, VerificationRecordModel } from '@vocilia/database';
import { BusinessQueries, StoreQueries, TransactionQueries } from '@vocilia/database';
import { supabase } from '@vocilia/database/client/supabase';
import type { 
  VerificationDatabase, 
  VerificationRecord, 
  VerificationDbStatus 
} from '@vocilia/types/verification';

export class DatabasePreparationService {
  private businessQueries: BusinessQueries;
  private storeQueries: StoreQueries;
  private transactionQueries: TransactionQueries;

  constructor() {
    this.businessQueries = new BusinessQueries(supabase);
    this.storeQueries = new StoreQueries(supabase);
    this.transactionQueries = new TransactionQueries(supabase);
  }

  /**
   * Prepare verification databases for all businesses in a cycle
   */
  async prepareDatabases(cycleId: string): Promise<{
    success: boolean;
    databases: VerificationDatabase[];
    errors: string[];
  }> {
    const errors: string[] = [];
    const databases: VerificationDatabase[] = [];

    try {
      // Get the verification cycle
      const cycle = await WeeklyVerificationCycleModel.getById(cycleId);
      if (!cycle) {
        throw new Error('Verification cycle not found');
      }

      if (cycle.status !== 'active') {
        throw new Error('Cycle must be active to prepare databases');
      }

      // Get all businesses
      const businesses = await this.businessQueries.getAll();
      
      for (const business of businesses) {
        try {
          // Get stores for this business
          const stores = await this.storeQueries.getByBusinessId(business.id);
          
          for (const store of stores) {
            const database = await this.prepareDatabaseForStore(cycleId, business.id, store.id);
            databases.push(database);
          }
        } catch (error) {
          const errorMsg = `Failed to prepare database for business ${business.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          console.error(errorMsg, error);
        }
      }

      // Update cycle status if no errors
      if (errors.length === 0) {
        await WeeklyVerificationCycleModel.updateStatus(cycleId, 'databases_prepared');
      }

      return {
        success: errors.length === 0,
        databases,
        errors
      };

    } catch (error) {
      const errorMsg = `Failed to prepare databases: ${error instanceof Error ? error.message : 'Unknown error'}`;
      errors.push(errorMsg);
      console.error(errorMsg, error);

      return {
        success: false,
        databases,
        errors
      };
    }
  }

  /**
   * Prepare verification database for a specific store
   */
  private async prepareDatabaseForStore(
    cycleId: string, 
    businessId: string, 
    storeId: string
  ): Promise<VerificationDatabase> {
    // Calculate date range for the verification cycle
    const cycle = await WeeklyVerificationCycleModel.getById(cycleId);
    if (!cycle) {
      throw new Error('Verification cycle not found');
    }

    const startDate = new Date(cycle.start_date);
    const endDate = new Date(cycle.end_date);

    // Get transactions for the date range
    const transactions = await this.transactionQueries.getByStoreAndDateRange(
      storeId,
      startDate,
      endDate
    );

    // Create verification database
    const database = await VerificationDatabaseModel.create({
      weekly_verification_cycle_id: cycleId,
      business_id: businessId,
      store_id: storeId,
      transaction_count: transactions.length,
      deadline_date: this.calculateDeadline(cycle.start_date),
      store_context: await this.buildStoreContext(storeId)
    });

    // Create verification records for each transaction
    const verificationRecords = [];
    for (const transaction of transactions) {
      try {
        const record = await VerificationRecordModel.create({
          verification_database_id: database.id,
          phone_number: this.sanitizePhoneNumber(transaction.phone_number),
          amount: transaction.amount,
          transaction_date: transaction.transaction_date,
          store_context: {
            store_name: transaction.store_name,
            location: transaction.store_location,
            category: transaction.category
          },
          original_transaction_id: transaction.id
        });
        verificationRecords.push(record);
      } catch (error) {
        console.error(`Failed to create verification record for transaction ${transaction.id}:`, error);
        // Continue with other records even if one fails
      }
    }

    // Update database with actual record count
    await VerificationDatabaseModel.updateRecordCount(database.id, verificationRecords.length);

    return database;
  }

  /**
   * Calculate verification deadline (5 business days from cycle start)
   */
  private calculateDeadline(startDate: string): string {
    const start = new Date(startDate);
    let businessDays = 0;
    let current = new Date(start);

    while (businessDays < 5) {
      current.setDate(current.getDate() + 1);
      
      // Skip weekends (Saturday = 6, Sunday = 0)
      if (current.getDay() !== 0 && current.getDay() !== 6) {
        businessDays++;
      }
    }

    return current.toISOString();
  }

  /**
   * Build store context for verification
   */
  private async buildStoreContext(storeId: string): Promise<Record<string, any>> {
    const store = await this.storeQueries.getById(storeId);
    if (!store) {
      throw new Error(`Store ${storeId} not found`);
    }

    return {
      store_id: store.id,
      store_name: store.name,
      location: store.location,
      business_type: store.business_type,
      contact_info: store.contact_info,
      verification_preferences: store.verification_preferences || {},
      created_at: store.created_at
    };
  }

  /**
   * Sanitize phone number for verification (remove sensitive digits)
   */
  private sanitizePhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    if (cleaned.length >= 10) {
      // Keep first 3 and last 2 digits, mask the middle
      const first = cleaned.substring(0, 3);
      const last = cleaned.substring(cleaned.length - 2);
      const masked = '*'.repeat(cleaned.length - 5);
      return `${first}${masked}${last}`;
    }
    
    // For shorter numbers, mask all but first and last digit
    if (cleaned.length >= 3) {
      const first = cleaned.substring(0, 1);
      const last = cleaned.substring(cleaned.length - 1);
      const masked = '*'.repeat(cleaned.length - 2);
      return `${first}${masked}${last}`;
    }
    
    // For very short numbers, mask completely
    return '*'.repeat(cleaned.length);
  }

  /**
   * Get preparation status for a cycle
   */
  async getPreparationStatus(cycleId: string): Promise<{
    total_databases: number;
    prepared_databases: number;
    failed_databases: number;
    total_records: number;
    progress_percentage: number;
  }> {
    const databases = await VerificationDatabaseModel.getByCycleId(cycleId);
    
    const stats = {
      total_databases: databases.length,
      prepared_databases: databases.filter(db => db.status === 'ready').length,
      failed_databases: databases.filter(db => db.status === 'failed').length,
      total_records: databases.reduce((sum, db) => sum + db.transaction_count, 0),
      progress_percentage: 0
    };

    if (stats.total_databases > 0) {
      stats.progress_percentage = Math.round(
        (stats.prepared_databases / stats.total_databases) * 100
      );
    }

    return stats;
  }

  /**
   * Regenerate a failed database
   */
  async regenerateDatabase(databaseId: string): Promise<VerificationDatabase> {
    const database = await VerificationDatabaseModel.getById(databaseId);
    if (!database) {
      throw new Error('Verification database not found');
    }

    if (database.status !== 'failed') {
      throw new Error('Can only regenerate failed databases');
    }

    // Update status to preparing
    await VerificationDatabaseModel.updateStatus(databaseId, 'preparing');

    try {
      // Delete existing records
      const existingRecords = await VerificationRecordModel.getByDatabaseId(databaseId);
      for (const record of existingRecords) {
        await VerificationRecordModel.delete(record.id);
      }

      // Regenerate the database
      const updatedDatabase = await this.prepareDatabaseForStore(
        database.weekly_verification_cycle_id,
        database.business_id,
        database.store_id
      );

      return updatedDatabase;

    } catch (error) {
      // Mark as failed again
      await VerificationDatabaseModel.updateStatus(databaseId, 'failed');
      throw error;
    }
  }

  /**
   * Validate database preparation is complete
   */
  async validatePreparation(cycleId: string): Promise<{
    isValid: boolean;
    issues: string[];
    statistics: {
      total_databases: number;
      total_records: number;
      businesses_covered: number;
      stores_covered: number;
    };
  }> {
    const issues: string[] = [];
    
    const databases = await VerificationDatabaseModel.getByCycleId(cycleId);
    const businessIds = new Set(databases.map(db => db.business_id));
    const storeIds = new Set(databases.map(db => db.store_id));
    
    // Check if all databases are ready
    const notReadyDatabases = databases.filter(db => db.status !== 'ready');
    if (notReadyDatabases.length > 0) {
      issues.push(`${notReadyDatabases.length} databases are not ready`);
    }

    // Check for databases with no records
    const emptyDatabases = databases.filter(db => db.transaction_count === 0);
    if (emptyDatabases.length > 0) {
      issues.push(`${emptyDatabases.length} databases have no transactions`);
    }

    // Check deadline compliance
    const now = new Date();
    const expiredDatabases = databases.filter(db => new Date(db.deadline_date) < now);
    if (expiredDatabases.length > 0) {
      issues.push(`${expiredDatabases.length} databases have expired deadlines`);
    }

    const statistics = {
      total_databases: databases.length,
      total_records: databases.reduce((sum, db) => sum + db.transaction_count, 0),
      businesses_covered: businessIds.size,
      stores_covered: storeIds.size
    };

    return {
      isValid: issues.length === 0,
      issues,
      statistics
    };
  }
}