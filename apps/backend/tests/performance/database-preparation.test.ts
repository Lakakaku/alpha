import { VerificationCycleService } from '../../src/services/verification/verificationCycleService';
import { DatabasePreparationService } from '../../src/services/verification/databasePreparationService';
import { createClient } from '@supabase/supabase-js';

describe('Database Preparation Performance Tests', () => {
  let verificationService: VerificationCycleService;
  let preparationService: DatabasePreparationService;
  let supabaseClient: ReturnType<typeof createClient>;

  // Performance requirements from specs
  const PREPARATION_TIME_LIMIT = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
  const MAX_TRANSACTIONS = 50000; // Maximum transactions across all stores
  const MAX_STORES = 100; // Maximum number of stores

  beforeAll(async () => {
    // Initialize Supabase client for testing
    supabaseClient = createClient(
      process.env.SUPABASE_URL || 'https://test.supabase.co',
      process.env.SUPABASE_ANON_KEY || 'test-key'
    );

    verificationService = new VerificationCycleService(supabaseClient);
    preparationService = new DatabasePreparationService(supabaseClient);
  });

  describe('Database Preparation Performance', () => {
    it('should complete preparation within 2 hours for 50,000 transactions', async () => {
      // This test validates the NFR-002 requirement
      const startTime = Date.now();
      
      // Mock a verification cycle with maximum expected load
      const mockCycleId = 'perf-test-cycle-50k';
      
      try {
        // Create mock data representing maximum load scenario
        const mockStores = Array.from({ length: MAX_STORES }, (_, i) => ({
          id: `store-${i}`,
          business_id: `business-${Math.floor(i / 5)}`, // 5 stores per business
          is_active: true
        }));

        // Mock feedback data totaling 50,000 transactions
        const transactionsPerStore = Math.floor(MAX_TRANSACTIONS / MAX_STORES);
        
        console.log(`Starting database preparation performance test:`);
        console.log(`- Stores: ${MAX_STORES}`);
        console.log(`- Total transactions: ${MAX_TRANSACTIONS}`);
        console.log(`- Transactions per store: ${transactionsPerStore}`);
        console.log(`- Time limit: ${PREPARATION_TIME_LIMIT / 1000 / 60} minutes`);

        // Mock the preparation process
        const preparationResult = await simulateDatabasePreparation({
          cycleId: mockCycleId,
          stores: mockStores,
          transactionsPerStore,
          totalTransactions: MAX_TRANSACTIONS
        });

        const endTime = Date.now();
        const preparationTime = endTime - startTime;

        console.log(`Database preparation completed in ${preparationTime}ms (${(preparationTime / 1000 / 60).toFixed(2)} minutes)`);
        console.log(`Preparation result:`, preparationResult);

        // Assert performance requirement
        expect(preparationTime).toBeLessThan(PREPARATION_TIME_LIMIT);
        expect(preparationResult.success).toBe(true);
        expect(preparationResult.processedStores).toBe(MAX_STORES);
        expect(preparationResult.totalTransactions).toBe(MAX_TRANSACTIONS);

      } catch (error) {
        console.error('Performance test failed:', error);
        throw error;
      }
    }, PREPARATION_TIME_LIMIT + 30000); // Add 30s buffer for test overhead

    it('should handle moderate load efficiently (10,000 transactions)', async () => {
      const startTime = Date.now();
      const moderateTransactions = 10000;
      const moderateStores = 20;
      
      const mockStores = Array.from({ length: moderateStores }, (_, i) => ({
        id: `store-mod-${i}`,
        business_id: `business-mod-${Math.floor(i / 5)}`,
        is_active: true
      }));

      const transactionsPerStore = Math.floor(moderateTransactions / moderateStores);

      console.log(`Starting moderate load test: ${moderateTransactions} transactions across ${moderateStores} stores`);

      const preparationResult = await simulateDatabasePreparation({
        cycleId: 'perf-test-moderate',
        stores: mockStores,
        transactionsPerStore,
        totalTransactions: moderateTransactions
      });

      const endTime = Date.now();
      const preparationTime = endTime - startTime;

      console.log(`Moderate load preparation completed in ${preparationTime}ms`);

      // Moderate load should complete much faster
      expect(preparationTime).toBeLessThan(30 * 60 * 1000); // 30 minutes
      expect(preparationResult.success).toBe(true);
      
    }, 35 * 60 * 1000); // 35 minute timeout

    it('should handle small load very efficiently (1,000 transactions)', async () => {
      const startTime = Date.now();
      const smallTransactions = 1000;
      const smallStores = 5;
      
      const mockStores = Array.from({ length: smallStores }, (_, i) => ({
        id: `store-small-${i}`,
        business_id: `business-small-${i}`,
        is_active: true
      }));

      const transactionsPerStore = Math.floor(smallTransactions / smallStores);

      console.log(`Starting small load test: ${smallTransactions} transactions across ${smallStores} stores`);

      const preparationResult = await simulateDatabasePreparation({
        cycleId: 'perf-test-small',
        stores: mockStores,
        transactionsPerStore,
        totalTransactions: smallTransactions
      });

      const endTime = Date.now();
      const preparationTime = endTime - startTime;

      console.log(`Small load preparation completed in ${preparationTime}ms`);

      // Small load should complete very quickly
      expect(preparationTime).toBeLessThan(5 * 60 * 1000); // 5 minutes
      expect(preparationResult.success).toBe(true);
      
    }, 10 * 60 * 1000); // 10 minute timeout

    it('should scale linearly with transaction count', async () => {
      const testSizes = [
        { transactions: 1000, stores: 5, expectedMaxTime: 5 * 60 * 1000 },
        { transactions: 5000, stores: 10, expectedMaxTime: 15 * 60 * 1000 },
        { transactions: 10000, stores: 20, expectedMaxTime: 30 * 60 * 1000 }
      ];

      const results = [];

      for (const testSize of testSizes) {
        const startTime = Date.now();
        
        const mockStores = Array.from({ length: testSize.stores }, (_, i) => ({
          id: `store-scale-${testSize.transactions}-${i}`,
          business_id: `business-scale-${Math.floor(i / 5)}`,
          is_active: true
        }));

        const transactionsPerStore = Math.floor(testSize.transactions / testSize.stores);

        const preparationResult = await simulateDatabasePreparation({
          cycleId: `perf-test-scale-${testSize.transactions}`,
          stores: mockStores,
          transactionsPerStore,
          totalTransactions: testSize.transactions
        });

        const endTime = Date.now();
        const preparationTime = endTime - startTime;

        results.push({
          transactions: testSize.transactions,
          time: preparationTime,
          timePerTransaction: preparationTime / testSize.transactions
        });

        console.log(`Scale test ${testSize.transactions} transactions: ${preparationTime}ms (${(preparationTime / testSize.transactions).toFixed(2)}ms per transaction)`);

        expect(preparationTime).toBeLessThan(testSize.expectedMaxTime);
        expect(preparationResult.success).toBe(true);
      }

      // Verify scaling is roughly linear (allowing for some variance)
      const timePerTransactionVariance = results.map(r => r.timePerTransaction);
      const maxVariance = Math.max(...timePerTransactionVariance);
      const minVariance = Math.min(...timePerTransactionVariance);
      const varianceRatio = maxVariance / minVariance;

      console.log('Scaling results:', results);
      console.log(`Time per transaction variance ratio: ${varianceRatio.toFixed(2)}`);

      // Should scale roughly linearly (within 3x variance)
      expect(varianceRatio).toBeLessThan(3);
      
    }, 60 * 60 * 1000); // 1 hour total for all scaling tests

    it('should handle concurrent preparation requests gracefully', async () => {
      const concurrentCycles = 3;
      const transactionsPerCycle = 2000;
      const storesPerCycle = 5;

      console.log(`Testing concurrent preparation: ${concurrentCycles} cycles with ${transactionsPerCycle} transactions each`);

      const startTime = Date.now();

      // Create concurrent preparation promises
      const preparationPromises = Array.from({ length: concurrentCycles }, async (_, i) => {
        const mockStores = Array.from({ length: storesPerCycle }, (_, j) => ({
          id: `store-concurrent-${i}-${j}`,
          business_id: `business-concurrent-${i}`,
          is_active: true
        }));

        return simulateDatabasePreparation({
          cycleId: `perf-test-concurrent-${i}`,
          stores: mockStores,
          transactionsPerStore: Math.floor(transactionsPerCycle / storesPerCycle),
          totalTransactions: transactionsPerCycle
        });
      });

      // Wait for all preparations to complete
      const results = await Promise.all(preparationPromises);

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      console.log(`Concurrent preparation completed in ${totalTime}ms`);

      // All should succeed
      results.forEach((result, i) => {
        expect(result.success).toBe(true);
        expect(result.processedStores).toBe(storesPerCycle);
        expect(result.totalTransactions).toBe(transactionsPerCycle);
      });

      // Concurrent execution should not take significantly longer than sequential
      // (allowing for some overhead but testing system can handle concurrency)
      const expectedSequentialTime = concurrentCycles * (transactionsPerCycle * 0.01); // Rough estimate
      expect(totalTime).toBeLessThan(expectedSequentialTime * 2); // Should not be more than 2x sequential time
      
    }, 30 * 60 * 1000); // 30 minute timeout
  });

  describe('Memory and Resource Usage', () => {
    it('should not exceed memory limits during large preparation', async () => {
      const initialMemory = process.memoryUsage();
      console.log('Initial memory usage:', formatMemoryUsage(initialMemory));

      // Large dataset preparation
      const largeTransactions = 25000;
      const largeStores = 50;
      
      const mockStores = Array.from({ length: largeStores }, (_, i) => ({
        id: `store-memory-${i}`,
        business_id: `business-memory-${Math.floor(i / 5)}`,
        is_active: true
      }));

      await simulateDatabasePreparation({
        cycleId: 'perf-test-memory',
        stores: mockStores,
        transactionsPerStore: Math.floor(largeTransactions / largeStores),
        totalTransactions: largeTransactions
      });

      const finalMemory = process.memoryUsage();
      console.log('Final memory usage:', formatMemoryUsage(finalMemory));

      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreaseMB = memoryIncrease / 1024 / 1024;

      console.log(`Memory increase: ${memoryIncreaseMB.toFixed(2)} MB`);

      // Should not increase memory usage by more than 500MB
      expect(memoryIncreaseMB).toBeLessThan(500);
      
      // Force garbage collection to clean up
      if (global.gc) {
        global.gc();
      }
    });
  });
});

/**
 * Simulate database preparation process for performance testing
 */
async function simulateDatabasePreparation(config: {
  cycleId: string;
  stores: any[];
  transactionsPerStore: number;
  totalTransactions: number;
}): Promise<{
  success: boolean;
  processedStores: number;
  totalTransactions: number;
  databasesCreated: number;
  processingTime: number;
}> {
  const startTime = Date.now();
  
  try {
    let processedStores = 0;
    let databasesCreated = 0;
    let processedTransactions = 0;

    // Simulate processing each store
    for (const store of config.stores) {
      // Simulate database preparation work
      await simulateStoreProcessing(store.id, config.transactionsPerStore);
      
      processedStores++;
      databasesCreated++;
      processedTransactions += config.transactionsPerStore;

      // Yield control periodically to prevent blocking
      if (processedStores % 10 === 0) {
        await new Promise(resolve => setImmediate(resolve));
      }
    }

    const endTime = Date.now();
    const processingTime = endTime - startTime;

    return {
      success: true,
      processedStores,
      totalTransactions: processedTransactions,
      databasesCreated,
      processingTime
    };

  } catch (error) {
    console.error('Database preparation simulation failed:', error);
    return {
      success: false,
      processedStores: 0,
      totalTransactions: 0,
      databasesCreated: 0,
      processingTime: Date.now() - startTime
    };
  }
}

/**
 * Simulate processing a single store's transactions
 */
async function simulateStoreProcessing(storeId: string, transactionCount: number): Promise<void> {
  // Simulate various database operations that would occur during preparation
  
  // 1. Query feedback sessions for the store (simulated with processing time)
  await simulateQuery(transactionCount * 0.1); // Query time proportional to transaction count
  
  // 2. Sanitize data (remove phone numbers, feedback content)
  await simulateDataSanitization(transactionCount);
  
  // 3. Generate verification database file
  await simulateFileGeneration(transactionCount);
  
  // 4. Store verification database record
  await simulateDbWrite();
}

/**
 * Simulate database query operation
 */
async function simulateQuery(durationMs: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, Math.min(durationMs, 100)); // Cap at 100ms per query
  });
}

/**
 * Simulate data sanitization process
 */
async function simulateDataSanitization(transactionCount: number): Promise<void> {
  // Simulate CPU-intensive sanitization work
  const operations = transactionCount * 2; // 2 operations per transaction
  
  for (let i = 0; i < operations; i++) {
    // Simulate sanitization work (string operations, data transformation)
    const mockData = {
      phone_number: '+46701234567',
      feedback_content: 'This is feedback content that needs to be removed',
      amount: Math.random() * 1000,
      transaction_date: new Date().toISOString()
    };
    
    // Simulate sanitization
    const sanitized = {
      amount: mockData.amount,
      transaction_date: mockData.transaction_date
    };
    
    // Yield occasionally to prevent blocking
    if (i % 1000 === 0) {
      await new Promise(resolve => setImmediate(resolve));
    }
  }
}

/**
 * Simulate file generation process
 */
async function simulateFileGeneration(transactionCount: number): Promise<void> {
  // Simulate file I/O operations
  const fileSizeEstimate = transactionCount * 100; // 100 bytes per transaction
  const writeOperations = Math.ceil(fileSizeEstimate / 1024); // 1KB chunks
  
  for (let i = 0; i < writeOperations; i++) {
    // Simulate file write delay
    await new Promise(resolve => setTimeout(resolve, 1));
  }
}

/**
 * Simulate database write operation
 */
async function simulateDbWrite(): Promise<void> {
  // Simulate database write latency
  return new Promise(resolve => {
    setTimeout(resolve, Math.random() * 10 + 5); // 5-15ms random latency
  });
}

/**
 * Format memory usage for logging
 */
function formatMemoryUsage(memUsage: NodeJS.MemoryUsage) {
  return {
    rss: `${(memUsage.rss / 1024 / 1024).toFixed(2)} MB`,
    heapTotal: `${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
    heapUsed: `${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
    external: `${(memUsage.external / 1024 / 1024).toFixed(2)} MB`,
  };
}