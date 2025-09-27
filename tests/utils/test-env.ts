/**
 * Test Environment Utilities
 * Database cleanup, setup, and test environment management
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { faker } from '@faker-js/faker';

// Load test environment variables
config({ path: '.env.test' });

export interface TestEnvironmentConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceKey?: string;
  databaseUrl?: string;
  apiBaseUrl: string;
  frontendUrls: {
    customer: string;
    business: string;
    admin: string;
  };
  enableCleanup: boolean;
  testTimeout: number;
  maxRetries: number;
}

export interface TestDatabaseState {
  tables: string[];
  seedData: boolean;
  migrations: string[];
  rls: boolean;
}

export interface TestMetrics {
  testsRun: number;
  testsPassed: number;
  testsFailed: number;
  totalDuration: number;
  averageTestDuration: number;
  coveragePercentage?: number;
}

export class TestEnvironmentManager {
  private supabase: SupabaseClient;
  private config: TestEnvironmentConfig;
  private state: TestDatabaseState;
  private metrics: TestMetrics;
  private cleanupQueue: Array<() => Promise<void>>;

  constructor(config?: Partial<TestEnvironmentConfig>) {
    this.config = {
      supabaseUrl: process.env.SUPABASE_URL || 'http://localhost:54321',
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || 'test-anon-key',
      supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3333',
      frontendUrls: {
        customer: process.env.CUSTOMER_APP_URL || 'http://localhost:3000',
        business: process.env.BUSINESS_APP_URL || 'http://localhost:3001',
        admin: process.env.ADMIN_APP_URL || 'http://localhost:3002',
      },
      enableCleanup: process.env.ENABLE_TEST_CLEANUP !== 'false',
      testTimeout: parseInt(process.env.TEST_TIMEOUT || '30000'),
      maxRetries: parseInt(process.env.TEST_MAX_RETRIES || '3'),
      ...config
    };

    this.supabase = createClient(this.config.supabaseUrl, this.config.supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    this.state = {
      tables: [],
      seedData: false,
      migrations: [],
      rls: false
    };

    this.metrics = {
      testsRun: 0,
      testsPassed: 0,
      testsFailed: 0,
      totalDuration: 0,
      averageTestDuration: 0
    };

    this.cleanupQueue = [];
  }

  /**
   * Initialize test environment
   */
  async initialize(): Promise<void> {
    console.log('🚀 Initializing test environment...');
    
    try {
      // Verify database connection
      await this.verifyDatabaseConnection();
      
      // Check database state
      await this.checkDatabaseState();
      
      // Set Swedish timezone for consistent test data
      process.env.TZ = 'Europe/Stockholm';
      
      // Configure faker for Swedish locale
      faker.setLocale('sv');
      faker.seed(42); // Deterministic seed for reproducible tests
      
      console.log('✅ Test environment initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize test environment:', error);
      throw error;
    }
  }

  /**
   * Clean up test environment
   */
  async cleanup(): Promise<void> {
    if (!this.config.enableCleanup) {
      console.log('🔄 Test cleanup disabled, skipping...');
      return;
    }

    console.log('🧹 Cleaning up test environment...');
    
    try {
      // Execute cleanup queue in reverse order
      for (const cleanupFn of this.cleanupQueue.reverse()) {
        await cleanupFn();
      }
      
      // Clear test data from database
      await this.clearTestData();
      
      // Reset authentication
      await this.supabase.auth.signOut();
      
      console.log('✅ Test environment cleanup completed');
    } catch (error) {
      console.warn('⚠️ Test cleanup encountered errors:', error);
    }
  }

  /**
   * Verify database connection
   */
  private async verifyDatabaseConnection(): Promise<void> {
    try {
      const { data, error } = await this.supabase.from('stores').select('count').limit(1);
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = relation doesn't exist
        throw new Error(`Database connection failed: ${error.message}`);
      }
      
      console.log('✅ Database connection verified');
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      throw error;
    }
  }

  /**
   * Check current database state
   */
  private async checkDatabaseState(): Promise<void> {
    try {
      // Get list of tables
      const { data: tables, error: tablesError } = await this.supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public');

      if (!tablesError && tables) {
        this.state.tables = tables.map(t => t.table_name);
      }

      // Check if RLS is enabled (try accessing protected table)
      const { error: rlsError } = await this.supabase
        .from('admin_accounts')
        .select('count')
        .limit(1);

      this.state.rls = rlsError?.code === 'PGRST301'; // Row level security violation

      console.log(`📊 Database state: ${this.state.tables.length} tables, RLS: ${this.state.rls ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.warn('⚠️ Could not check database state:', error);
    }
  }

  /**
   * Clear test data from database
   */
  private async clearTestData(): Promise<void> {
    if (!this.config.enableCleanup) return;

    try {
      // Tables to clear (in dependency order)
      const tablesToClear = [
        'test_results',
        'test_runs',
        'test_cases',
        'test_suites',
        'test_environments',
        'test_data_records',
        'test_data_sets',
        'performance_results',
        'performance_benchmarks',
        'test_reports',
        // Only clear test data, not production tables
      ];

      for (const tableName of tablesToClear) {
        try {
          // Only delete records that are clearly test data
          await this.supabase
            .from(tableName)
            .delete()
            .or(`id.like.test_%,name.like.Test %,description.like.Test %`);
            
          console.log(`🧹 Cleared test data from ${tableName}`);
        } catch (error) {
          // Table might not exist, which is OK
          console.log(`⚠️ Could not clear ${tableName}:`, error);
        }
      }
    } catch (error) {
      console.warn('⚠️ Error during test data cleanup:', error);
    }
  }

  /**
   * Create test user with authentication
   */
  async createTestUser(userData: {
    email: string;
    password: string;
    metadata?: Record<string, any>;
  }): Promise<{ user: any; session: any }> {
    const { data, error } = await this.supabase.auth.signUp({
      email: userData.email,
      password: userData.password,
      options: {
        data: userData.metadata || {}
      }
    });

    if (error) {
      throw new Error(`Failed to create test user: ${error.message}`);
    }

    // Add cleanup for this user
    this.addCleanupTask(async () => {
      if (data.user?.id) {
        await this.supabase.auth.admin.deleteUser(data.user.id);
      }
    });

    return data;
  }

  /**
   * Authenticate as test user
   */
  async authenticateTestUser(email: string, password: string): Promise<{ user: any; session: any }> {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      throw new Error(`Failed to authenticate test user: ${error.message}`);
    }

    return data;
  }

  /**
   * Create test admin user
   */
  async createTestAdmin(adminData: {
    email: string;
    name: string;
    role: 'admin' | 'super_admin' | 'support';
    permissions: string[];
  }): Promise<any> {
    // Insert into admin_accounts table
    const { data, error } = await this.supabase
      .from('admin_accounts')
      .insert({
        id: faker.datatype.uuid(),
        email: adminData.email,
        name: adminData.name,
        role: adminData.role,
        permissions: adminData.permissions,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create test admin: ${error.message}`);
    }

    // Add cleanup for this admin
    this.addCleanupTask(async () => {
      if (data?.id) {
        await this.supabase
          .from('admin_accounts')
          .delete()
          .eq('id', data.id);
      }
    });

    return data;
  }

  /**
   * Create test store
   */
  async createTestStore(storeData: {
    name: string;
    businessId: string;
    location?: string;
    coordinates?: { lat: number; lng: number };
  }): Promise<any> {
    const { data, error } = await this.supabase
      .from('stores')
      .insert({
        id: faker.datatype.uuid(),
        name: storeData.name,
        business_id: storeData.businessId,
        location: storeData.location || 'Test Location',
        coordinates: storeData.coordinates || { lat: 59.3293, lng: 18.0686 },
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create test store: ${error.message}`);
    }

    // Add cleanup for this store
    this.addCleanupTask(async () => {
      if (data?.id) {
        await this.supabase
          .from('stores')
          .delete()
          .eq('id', data.id);
      }
    });

    return data;
  }

  /**
   * Create test business
   */
  async createTestBusiness(businessData: {
    name: string;
    orgNumber?: string;
    contactEmail?: string;
  }): Promise<any> {
    const { data, error } = await this.supabase
      .from('businesses')
      .insert({
        id: faker.datatype.uuid(),
        name: businessData.name,
        org_number: businessData.orgNumber || `55${Math.floor(Math.random() * 10000000).toString().padStart(8, '0')}`,
        contact_email: businessData.contactEmail || faker.internet.email(),
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create test business: ${error.message}`);
    }

    // Add cleanup for this business
    this.addCleanupTask(async () => {
      if (data?.id) {
        await this.supabase
          .from('businesses')
          .delete()
          .eq('id', data.id);
      }
    });

    return data;
  }

  /**
   * Wait for async operations to complete
   */
  async waitForAsync(ms: number = 100): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Retry a function with exponential backoff
   */
  async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = this.config.maxRetries,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) {
          break;
        }

        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`⏳ Retry ${attempt + 1}/${maxRetries} in ${delay}ms...`);
        await this.waitForAsync(delay);
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  /**
   * Add cleanup task to queue
   */
  addCleanupTask(task: () => Promise<void>): void {
    this.cleanupQueue.push(task);
  }

  /**
   * Record test metrics
   */
  recordTestResult(passed: boolean, duration: number): void {
    this.metrics.testsRun++;
    if (passed) {
      this.metrics.testsPassed++;
    } else {
      this.metrics.testsFailed++;
    }
    this.metrics.totalDuration += duration;
    this.metrics.averageTestDuration = this.metrics.totalDuration / this.metrics.testsRun;
  }

  /**
   * Get test metrics
   */
  getMetrics(): TestMetrics {
    return { ...this.metrics };
  }

  /**
   * Get test environment configuration
   */
  getConfig(): TestEnvironmentConfig {
    return { ...this.config };
  }

  /**
   * Get database state
   */
  getDatabaseState(): TestDatabaseState {
    return { ...this.state };
  }

  /**
   * Health check for test environment
   */
  async healthCheck(): Promise<{
    database: boolean;
    api: boolean;
    frontend: boolean;
    overall: boolean;
  }> {
    const results = {
      database: false,
      api: false,
      frontend: false,
      overall: false
    };

    try {
      // Check database
      await this.verifyDatabaseConnection();
      results.database = true;
    } catch (error) {
      console.warn('❌ Database health check failed:', error);
    }

    try {
      // Check API (if available)
      const response = await fetch(`${this.config.apiBaseUrl}/api/health`);
      results.api = response.ok;
    } catch (error) {
      console.warn('❌ API health check failed:', error);
    }

    try {
      // Check frontend (if available)
      const response = await fetch(this.config.frontendUrls.customer);
      results.frontend = response.ok;
    } catch (error) {
      console.warn('❌ Frontend health check failed:', error);
    }

    results.overall = results.database && (results.api || results.frontend);
    return results;
  }
}

// Global test environment instance
let globalTestEnv: TestEnvironmentManager | null = null;

/**
 * Get or create global test environment
 */
export function getTestEnvironment(config?: Partial<TestEnvironmentConfig>): TestEnvironmentManager {
  if (!globalTestEnv) {
    globalTestEnv = new TestEnvironmentManager(config);
  }
  return globalTestEnv;
}

/**
 * Setup test environment (call in beforeAll)
 */
export async function setupTestEnvironment(config?: Partial<TestEnvironmentConfig>): Promise<TestEnvironmentManager> {
  const testEnv = getTestEnvironment(config);
  await testEnv.initialize();
  return testEnv;
}

/**
 * Cleanup test environment (call in afterAll)
 */
export async function cleanupTestEnvironment(): Promise<void> {
  if (globalTestEnv) {
    await globalTestEnv.cleanup();
    globalTestEnv = null;
  }
}

/**
 * Test data factory helpers
 */
export class TestDataFactory {
  static createTestEmail(prefix: string = 'test'): string {
    return `${prefix}.${faker.datatype.uuid().slice(0, 8)}@test.vocilia.se`;
  }

  static createTestPassword(): string {
    return `Test123!${faker.datatype.number({ min: 1000, max: 9999 })}`;
  }

  static createSwedishPhone(): string {
    const prefix = '+46 7';
    const secondDigit = faker.helpers.arrayElement(['0', '1', '2', '3', '4', '5', '6', '7', '8']);
    const remaining = faker.datatype.number({ min: 1000000, max: 9999999 }).toString();
    return `${prefix}${secondDigit} ${remaining.slice(0, 3)} ${remaining.slice(3, 5)} ${remaining.slice(5)}`;
  }

  static createSwedishOrgNumber(): string {
    const first6 = faker.datatype.number({ min: 100000, max: 999999 }).toString();
    const last4 = faker.datatype.number({ min: 1000, max: 9999 }).toString();
    return `${first6}-${last4}`;
  }

  static createTestId(prefix: string = 'test'): string {
    return `${prefix}_${Date.now()}_${faker.datatype.uuid().slice(0, 8)}`;
  }
}

// Export types
export type { TestEnvironmentConfig, TestDatabaseState, TestMetrics };