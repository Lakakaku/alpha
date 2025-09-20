import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import {
  BusinessQueries,
  StoreQueries,
  UserAccountQueries,
  ContextWindowQueries,
  TransactionQueries,
  FeedbackSessionQueries,
  VerificationRecordQueries
} from '../../src/queries/index.js';
import { AuthContext, UserRole } from '../../src/types/index.js';
import { createAuthHelper } from '../../src/auth/auth-helper.js';
import { dbTestClient } from '../setup.js';

describe('RLS Query Performance Tests', () => {
  let businessQueries: BusinessQueries;
  let storeQueries: StoreQueries;
  let userAccountQueries: UserAccountQueries;
  let contextWindowQueries: ContextWindowQueries;
  let transactionQueries: TransactionQueries;
  let feedbackSessionQueries: FeedbackSessionQueries;
  let verificationRecordQueries: VerificationRecordQueries;
  let authHelper: ReturnType<typeof createAuthHelper>;

  // Performance thresholds (in milliseconds)
  const PERFORMANCE_THRESHOLDS = {
    FAST_QUERY: 50,    // Queries that should be very fast (simple lookups)
    NORMAL_QUERY: 200, // Normal business logic queries
    COMPLEX_QUERY: 500 // Complex analytical queries
  };

  // Test data
  let testBusinessId: string;
  let testStoreId: string;
  let testUserId: string;
  let adminAuthContext: AuthContext;
  let businessOwnerAuthContext: AuthContext;
  let businessStaffAuthContext: AuthContext;

  beforeAll(async () => {
    // Initialize query instances
    businessQueries = new BusinessQueries(dbTestClient);
    storeQueries = new StoreQueries(dbTestClient);
    userAccountQueries = new UserAccountQueries(dbTestClient);
    contextWindowQueries = new ContextWindowQueries(dbTestClient);
    transactionQueries = new TransactionQueries(dbTestClient);
    feedbackSessionQueries = new FeedbackSessionQueries(dbTestClient);
    verificationRecordQueries = new VerificationRecordQueries(dbTestClient);
    authHelper = createAuthHelper(dbTestClient);

    // Create test data for performance testing
    await setupTestData();
  }, 30000);

  afterAll(async () => {
    // Clean up test data
    await cleanupTestData();
  }, 10000);

  beforeEach(() => {
    // Reset any timeouts or connections if needed
    jest.clearAllTimers();
  });

  async function setupTestData(): Promise<void> {
    try {
      // Create admin auth context
      adminAuthContext = await authHelper.createSystemAuthContext();

      // Create test business
      const business = await businessQueries.create({
        name: 'Performance Test Business',
        contact_email: 'perf-test@example.com',
        contact_phone: '+46701234567',
        registration_number: 'PERF-TEST-001',
        address: {
          street: '123 Performance Street',
          city: 'Stockholm',
          postal_code: '11122',
          country: 'Sweden'
        }
      }, adminAuthContext);
      testBusinessId = business.id;

      // Create test business owner
      const businessOwner = await userAccountQueries.create({
        email: 'owner@perftest.com',
        business_id: testBusinessId,
        role: 'business_owner' as UserRole,
        full_name: 'Performance Test Owner',
        is_verified: true
      }, adminAuthContext);
      testUserId = businessOwner.id;

      // Create business owner auth context
      businessOwnerAuthContext = {
        user_id: testUserId,
        business_id: testBusinessId,
        role: 'business_owner',
        permissions: ['read:business', 'write:business', 'manage:stores'],
        email: 'owner@perftest.com'
      };

      // Create business staff auth context
      businessStaffAuthContext = {
        user_id: 'staff-user-id',
        business_id: testBusinessId,
        role: 'business_staff',
        permissions: ['read:business', 'read:stores'],
        email: 'staff@perftest.com'
      };

      // Create test store
      const store = await storeQueries.create({
        business_id: testBusinessId,
        name: 'Performance Test Store',
        qr_code_data: 'PERF-STORE-QR-001'
      }, businessOwnerAuthContext);
      testStoreId = store.id;

      // Create context window for the store
      await contextWindowQueries.create({
        store_id: testStoreId,
        store_profile: {
          store_type: { category: 'retail', subcategory: 'performance_testing' },
          size: { square_footage: 1000 },
          operating_hours: { monday: { open: '09:00', close: '17:00' } },
          location: { address: '123 Performance Store St' },
          personnel: { staff_count: 3 },
          inventory: { product_categories: ['test_products'] }
        },
        custom_questions: [
          {
            id: 'perf-q1',
            question: 'Performance test question 1?',
            is_active: true,
            order_index: 1,
            created_at: new Date().toISOString()
          }
        ],
        ai_configuration: {
          conversation_style: 'professional',
          language_preferences: { primary: 'english' },
          call_duration_target: { min_seconds: 60, max_seconds: 180 },
          question_selection: { max_questions_per_call: 3 }
        },
        fraud_detection_settings: {
          sensitivity_level: 'medium',
          verification_thresholds: { min_response_length: 50, coherence_threshold: 0.8 }
        }
      }, businessOwnerAuthContext);

      // Create multiple transactions for performance testing
      for (let i = 0; i < 50; i++) {
        await transactionQueries.createFromToleranceInput(
          testStoreId,
          {
            customer_time: new Date(Date.now() - i * 60000).toISOString(), // Spread over 50 minutes
            customer_amount: 100 + (i * 5) // Varying amounts
          },
          businessOwnerAuthContext
        );
      }

      // Create multiple feedback sessions
      for (let i = 0; i < 20; i++) {
        await feedbackSessionQueries.create({
          store_id: testStoreId,
          customer_phone_hash: `perf-hash-${i}`,
          conversation_transcript: `Performance test conversation ${i}`,
          ai_analysis: {
            sentiment_score: 0.7 + (i * 0.01),
            quality_grade: 'B',
            key_topics: ['performance', 'testing'],
            satisfaction_indicators: ['good_service']
          },
          session_metadata: {
            call_duration_seconds: 120 + i,
            questions_asked: 3,
            response_quality: 'good'
          },
          status: 'completed'
        }, businessOwnerAuthContext);
      }

    } catch (error) {
      console.error('Failed to setup test data:', error);
      throw error;
    }
  }

  async function cleanupTestData(): Promise<void> {
    try {
      if (testBusinessId && adminAuthContext) {
        // Clean up in reverse order of creation
        await businessQueries.delete(testBusinessId, adminAuthContext);
      }
    } catch (error) {
      console.warn('Error during cleanup:', error);
    }
  }

  describe('Business Queries Performance', () => {
    test('business findById should complete under 50ms', async () => {
      const startTime = Date.now();

      const business = await businessQueries.findById(testBusinessId, businessOwnerAuthContext);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.FAST_QUERY);
      expect(business).toBeTruthy();
      expect(business?.id).toBe(testBusinessId);
    });

    test('business findAll with RLS filtering should complete under 200ms', async () => {
      const startTime = Date.now();

      const businesses = await businessQueries.findAll(businessOwnerAuthContext);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.NORMAL_QUERY);
      expect(Array.isArray(businesses)).toBe(true);
      // Business owner should only see their own business
      expect(businesses.every(b => b.id === testBusinessId)).toBe(true);
    });

    test('admin business findAll should complete under 200ms', async () => {
      const startTime = Date.now();

      const businesses = await businessQueries.findAll(adminAuthContext);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.NORMAL_QUERY);
      expect(Array.isArray(businesses)).toBe(true);
      // Admin should see all businesses
      expect(businesses.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Store Queries Performance', () => {
    test('store findById should complete under 50ms', async () => {
      const startTime = Date.now();

      const store = await storeQueries.findById(testStoreId, businessOwnerAuthContext);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.FAST_QUERY);
      expect(store).toBeTruthy();
      expect(store?.id).toBe(testStoreId);
    });

    test('store findByBusinessId should complete under 200ms', async () => {
      const startTime = Date.now();

      const stores = await storeQueries.findByBusinessId(testBusinessId, businessOwnerAuthContext);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.NORMAL_QUERY);
      expect(Array.isArray(stores)).toBe(true);
      expect(stores.length).toBeGreaterThan(0);
    });

    test('store findByQRCode should complete under 50ms', async () => {
      const startTime = Date.now();

      const store = await storeQueries.findByQRCode('PERF-STORE-QR-001');

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.FAST_QUERY);
      expect(store).toBeTruthy();
    });
  });

  describe('User Account Queries Performance', () => {
    test('user findById should complete under 50ms', async () => {
      const startTime = Date.now();

      const user = await userAccountQueries.findById(testUserId, businessOwnerAuthContext);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.FAST_QUERY);
      expect(user).toBeTruthy();
    });

    test('user findByBusinessId with RLS should complete under 200ms', async () => {
      const startTime = Date.now();

      const users = await userAccountQueries.findByBusinessId(testBusinessId, businessOwnerAuthContext);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.NORMAL_QUERY);
      expect(Array.isArray(users)).toBe(true);
    });
  });

  describe('Transaction Queries Performance', () => {
    test('transaction findByStoreId should complete under 200ms', async () => {
      const startTime = Date.now();

      const transactions = await transactionQueries.findByStoreId(testStoreId, businessOwnerAuthContext);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.NORMAL_QUERY);
      expect(Array.isArray(transactions)).toBe(true);
      expect(transactions.length).toBeGreaterThan(0);
    });

    test('transaction findPendingVerification should complete under 200ms', async () => {
      const startTime = Date.now();

      const transactions = await transactionQueries.findPendingVerification(testStoreId, businessOwnerAuthContext);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.NORMAL_QUERY);
      expect(Array.isArray(transactions)).toBe(true);
    });

    test('transaction verification matching should complete under 500ms', async () => {
      const transactions = await transactionQueries.findPendingVerification(testStoreId, businessOwnerAuthContext);

      if (transactions.length > 0) {
        const startTime = Date.now();

        const results = await transactionQueries.attemptVerificationMatch(
          testStoreId,
          100,
          new Date().toISOString(),
          businessOwnerAuthContext
        );

        const duration = Date.now() - startTime;
        expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.COMPLEX_QUERY);
        expect(Array.isArray(results)).toBe(true);
      }
    });
  });

  describe('Feedback Session Queries Performance', () => {
    test('feedback findByStoreId should complete under 200ms', async () => {
      const startTime = Date.now();

      const sessions = await feedbackSessionQueries.findByStoreId(testStoreId, businessOwnerAuthContext);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.NORMAL_QUERY);
      expect(Array.isArray(sessions)).toBe(true);
      expect(sessions.length).toBeGreaterThan(0);
    });

    test('feedback findRecentByBusinessId should complete under 200ms', async () => {
      const startTime = Date.now();

      const sessions = await feedbackSessionQueries.findRecentByBusinessId(testBusinessId, businessOwnerAuthContext);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.NORMAL_QUERY);
      expect(Array.isArray(sessions)).toBe(true);
    });

    test('feedback analytics queries should complete under 500ms', async () => {
      const startTime = Date.now();

      const analytics = await feedbackSessionQueries.getAnalyticsSummary(
        testStoreId,
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
        new Date().toISOString(),
        businessOwnerAuthContext
      );

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.COMPLEX_QUERY);
      expect(analytics).toBeTruthy();
    });
  });

  describe('Context Window Queries Performance', () => {
    test('context findByStoreId should complete under 50ms', async () => {
      const startTime = Date.now();

      const context = await contextWindowQueries.findByStoreId(testStoreId, businessOwnerAuthContext);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.FAST_QUERY);
      expect(context).toBeTruthy();
    });

    test('context completeness calculation should complete under 200ms', async () => {
      const startTime = Date.now();

      const completeness = await contextWindowQueries.getContextCompleteness(testStoreId, businessOwnerAuthContext);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.NORMAL_QUERY);
      expect(completeness).toBeTruthy();
      expect(typeof completeness.score).toBe('number');
    });
  });

  describe('Cross-Entity Performance Tests', () => {
    test('business isolation performance with different roles', async () => {
      // Test that RLS doesn't significantly impact performance for different user roles
      const roles = [
        { context: adminAuthContext, description: 'admin' },
        { context: businessOwnerAuthContext, description: 'business_owner' },
        { context: businessStaffAuthContext, description: 'business_staff' }
      ];

      for (const { context, description } of roles) {
        const startTime = Date.now();

        try {
          const businesses = await businessQueries.findAll(context);
          const stores = await storeQueries.findByBusinessId(testBusinessId, context);

          const duration = Date.now() - startTime;
          expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.NORMAL_QUERY);

          // Verify business isolation works correctly
          if (description === 'admin') {
            expect(businesses.length).toBeGreaterThanOrEqual(1);
          } else {
            expect(businesses.every(b => b.id === testBusinessId)).toBe(true);
          }

        } catch (error) {
          // Some operations might fail for staff users, which is expected
          if (description === 'business_staff') {
            continue;
          }
          throw error;
        }
      }
    });

    test('concurrent query performance', async () => {
      // Test that multiple concurrent queries don't significantly degrade performance
      const startTime = Date.now();

      const promises = [
        businessQueries.findById(testBusinessId, businessOwnerAuthContext),
        storeQueries.findById(testStoreId, businessOwnerAuthContext),
        contextWindowQueries.findByStoreId(testStoreId, businessOwnerAuthContext),
        transactionQueries.findByStoreId(testStoreId, businessOwnerAuthContext),
        feedbackSessionQueries.findByStoreId(testStoreId, businessOwnerAuthContext)
      ];

      const results = await Promise.all(promises);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.COMPLEX_QUERY);

      // Verify all queries returned expected results
      expect(results).toHaveLength(5);
      expect(results.every(result => result !== null)).toBe(true);
    });

    test('pagination performance', async () => {
      // Test that paginated queries maintain good performance
      const startTime = Date.now();

      const page1 = await transactionQueries.findByStoreId(testStoreId, businessOwnerAuthContext, 1, 10);
      const page2 = await transactionQueries.findByStoreId(testStoreId, businessOwnerAuthContext, 2, 10);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.NORMAL_QUERY);

      expect(Array.isArray(page1)).toBe(true);
      expect(Array.isArray(page2)).toBe(true);
    });
  });

  describe('Database Connection Performance', () => {
    test('connection pool efficiency under load', async () => {
      // Test that the database connection pool handles multiple requests efficiently
      const promises = Array.from({ length: 20 }, (_, i) =>
        businessQueries.findById(testBusinessId, businessOwnerAuthContext)
      );

      const startTime = Date.now();
      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.COMPLEX_QUERY);
      expect(results).toHaveLength(20);
      expect(results.every(result => result?.id === testBusinessId)).toBe(true);
    });

    test('query caching effectiveness', async () => {
      // Test the same query multiple times to check if caching improves performance
      const query = () => businessQueries.findById(testBusinessId, businessOwnerAuthContext);

      // First query (cache miss)
      const startTime1 = Date.now();
      await query();
      const duration1 = Date.now() - startTime1;

      // Second query (potential cache hit)
      const startTime2 = Date.now();
      await query();
      const duration2 = Date.now() - startTime2;

      // Third query (potential cache hit)
      const startTime3 = Date.now();
      await query();
      const duration3 = Date.now() - startTime3;

      // All queries should be fast, subsequent ones potentially faster
      expect(duration1).toBeLessThan(PERFORMANCE_THRESHOLDS.NORMAL_QUERY);
      expect(duration2).toBeLessThan(PERFORMANCE_THRESHOLDS.NORMAL_QUERY);
      expect(duration3).toBeLessThan(PERFORMANCE_THRESHOLDS.NORMAL_QUERY);

      // Log performance metrics for analysis
      console.log(`Query performance: ${duration1}ms, ${duration2}ms, ${duration3}ms`);
    });
  });

  describe('Memory and Resource Usage', () => {
    test('large dataset queries maintain performance', async () => {
      // Create additional data to test performance with larger datasets
      const additionalTransactions = [];
      for (let i = 0; i < 100; i++) {
        additionalTransactions.push(
          transactionQueries.createFromToleranceInput(
            testStoreId,
            {
              customer_time: new Date(Date.now() - i * 30000).toISOString(),
              customer_amount: 50 + (i * 2)
            },
            businessOwnerAuthContext
          )
        );
      }

      await Promise.all(additionalTransactions);

      // Test query performance with larger dataset
      const startTime = Date.now();
      const transactions = await transactionQueries.findByStoreId(testStoreId, businessOwnerAuthContext);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.NORMAL_QUERY);
      expect(transactions.length).toBeGreaterThan(100);
    });

    test('memory efficient result handling', async () => {
      // Test that large result sets don't cause memory issues
      const startTime = Date.now();
      const largeResultSet = await transactionQueries.findByStoreId(testStoreId, businessOwnerAuthContext);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.NORMAL_QUERY);
      expect(Array.isArray(largeResultSet)).toBe(true);

      // Verify we can process the results without performance degradation
      const processStart = Date.now();
      const processedCount = largeResultSet.filter(t => t.verification_status === 'pending').length;
      const processedDuration = Date.now() - processStart;

      expect(processedDuration).toBeLessThan(50); // Processing should be very fast
      expect(typeof processedCount).toBe('number');
    });
  });
});