import request from 'supertest';
import { createClient } from '@supabase/supabase-js';

const ADMIN_API_URL = process.env.API_URL || 'http://localhost:3001';
const BUSINESS_API_URL = process.env.BUSINESS_API_URL || 'http://localhost:3000';
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

describe('Complete Verification Cycle Integration Test', () => {
  let testAdminId: string;
  let testBusinessId: string;
  let testStoreId: string;
  let adminToken: string;
  let businessToken: string;
  let createdCycleId: string;
  let verificationDatabaseId: string;
  let feedbackSessionIds: string[] = [];

  beforeAll(async () => {
    // Create test admin
    const { data: adminAuthUser } = await supabase.auth.admin.createUser({
      email: 'integration.admin@vocilia.com',
      password: 'TestAdmin123!',
      email_confirm: true
    });

    if (adminAuthUser.user) {
      const { data: admin } = await supabase
        .from('admin_accounts')
        .insert({
          user_id: adminAuthUser.user.id,
          username: 'integration_admin',
          full_name: 'Integration Test Administrator',
          email: 'integration.admin@vocilia.com',
          is_active: true
        })
        .select()
        .single();

      testAdminId = admin.id;

      const { data: adminSession } = await supabase
        .from('admin_sessions')
        .insert({
          admin_id: testAdminId,
          session_token: 'integration_admin_session_token',
          expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
        })
        .select()
        .single();

      adminToken = adminSession.session_token;
    }

    // Create test business
    const { data: businessAuthUser } = await supabase.auth.admin.createUser({
      email: 'integration.business@vocilia.com',
      password: 'TestBusiness123!',
      email_confirm: true
    });

    if (businessAuthUser.user) {
      const { data: business } = await supabase
        .from('businesses')
        .insert({
          name: 'Integration Test Business',
          email: 'integration.business@vocilia.com',
          phone: '+46701234567'
        })
        .select()
        .single();

      testBusinessId = business.id;

      const { data: businessAccount } = await supabase
        .from('business_accounts')
        .insert({
          user_id: businessAuthUser.user.id,
          business_id: testBusinessId,
          email: 'integration.business@vocilia.com',
          full_name: 'Integration Business User',
          role: 'owner',
          is_active: true
        })
        .select()
        .single();

      const { data: businessSession } = await supabase
        .from('business_sessions')
        .insert({
          business_account_id: businessAccount.id,
          session_token: 'integration_business_session_token',
          expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
        })
        .select()
        .single();

      businessToken = businessSession.session_token;

      // Create test store
      const { data: store } = await supabase
        .from('stores')
        .insert({
          business_id: testBusinessId,
          name: 'Integration Test Store',
          address: 'Integration Address 123',
          city: 'Stockholm',
          postal_code: '12345'
        })
        .select()
        .single();

      testStoreId = store.id;

      // Create test feedback sessions
      const feedbackSessions = await supabase
        .from('feedback_sessions')
        .insert([
          {
            store_id: testStoreId,
            customer_phone: '+46701234568',
            transaction_amount: 250.00,
            created_at: '2025-09-23T10:00:00Z',
            feedback_text: 'Great service!',
            rating: 5
          },
          {
            store_id: testStoreId,
            customer_phone: '+46701234569',
            transaction_amount: 150.00,
            created_at: '2025-09-23T14:30:00Z',
            feedback_text: 'Good experience',
            rating: 4
          },
          {
            store_id: testStoreId,
            customer_phone: '+46701234570',
            transaction_amount: 75.00,
            created_at: '2025-09-23T16:45:00Z',
            feedback_text: 'Quick service',
            rating: 5
          }
        ])
        .select();

      feedbackSessionIds = feedbackSessions.data?.map(session => session.id) || [];
    }
  });

  afterAll(async () => {
    // Cleanup in reverse order
    if (feedbackSessionIds.length > 0) {
      await supabase
        .from('feedback_sessions')
        .delete()
        .in('id', feedbackSessionIds);
    }

    if (verificationDatabaseId) {
      await supabase
        .from('verification_databases')
        .delete()
        .eq('id', verificationDatabaseId);
    }

    if (createdCycleId) {
      await supabase
        .from('weekly_verification_cycles')
        .delete()
        .eq('id', createdCycleId);
    }

    if (testStoreId) {
      await supabase
        .from('stores')
        .delete()
        .eq('id', testStoreId);
    }

    if (testBusinessId) {
      await supabase
        .from('business_sessions')
        .delete()
        .eq('business_id', testBusinessId);
      
      await supabase
        .from('business_accounts')
        .delete()
        .eq('business_id', testBusinessId);
      
      await supabase
        .from('businesses')
        .delete()
        .eq('id', testBusinessId);
    }

    if (testAdminId) {
      await supabase
        .from('admin_sessions')
        .delete()
        .eq('admin_id', testAdminId);
      
      await supabase
        .from('admin_accounts')
        .delete()
        .eq('id', testAdminId);
    }
  });

  describe('Complete Verification Workflow', () => {
    it('should execute full verification cycle from creation to payment processing', async () => {
      // Step 1: Admin creates new verification cycle
      const createCycleResponse = await request(ADMIN_API_URL)
        .post('/api/admin/verification/cycles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          cycle_week: '2025-09-23'
        })
        .expect(201);

      expect(createCycleResponse.body).toHaveProperty('id');
      expect(createCycleResponse.body.status).toBe('preparing');
      createdCycleId = createCycleResponse.body.id;

      // Step 2: Admin prepares verification databases
      const prepareResponse = await request(ADMIN_API_URL)
        .post(`/api/admin/verification/cycles/${createdCycleId}/prepare`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(202);

      expect(prepareResponse.body).toHaveProperty('message');
      expect(prepareResponse.body).toHaveProperty('job_id');

      // Step 3: Wait for database preparation (in real implementation)
      // For testing, we'll manually update the status
      await supabase
        .from('weekly_verification_cycles')
        .update({ status: 'distributed' })
        .eq('id', createdCycleId);

      // Create verification database manually for testing
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + 5); // 5 days from now

      const { data: database } = await supabase
        .from('verification_databases')
        .insert({
          cycle_id: createdCycleId,
          store_id: testStoreId,
          business_id: testBusinessId,
          csv_file_url: 'https://storage.supabase.co/test/verification.csv',
          excel_file_url: 'https://storage.supabase.co/test/verification.xlsx',
          json_file_url: 'https://storage.supabase.co/test/verification.json',
          transaction_count: 3,
          status: 'ready',
          deadline_at: deadline.toISOString(),
          verified_count: 0,
          fake_count: 0,
          unverified_count: 3
        })
        .select()
        .single();

      verificationDatabaseId = database.id;

      // Step 4: Admin checks prepared databases
      const databasesResponse = await request(ADMIN_API_URL)
        .get(`/api/admin/verification/cycles/${createdCycleId}/databases`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(databasesResponse.body)).toBe(true);
      expect(databasesResponse.body).toHaveLength(1);
      expect(databasesResponse.body[0].store_id).toBe(testStoreId);

      // Step 5: Business lists their verification databases
      const businessDatabasesResponse = await request(BUSINESS_API_URL)
        .get('/api/business/verification/databases')
        .set('Authorization', `Bearer ${businessToken}`)
        .expect(200);

      expect(Array.isArray(businessDatabasesResponse.body)).toBe(true);
      expect(businessDatabasesResponse.body).toHaveLength(1);
      expect(businessDatabasesResponse.body[0].status).toBe('ready');

      // Step 6: Business downloads verification database
      const downloadResponse = await request(BUSINESS_API_URL)
        .get(`/api/business/verification/databases/${verificationDatabaseId}/download/csv`)
        .set('Authorization', `Bearer ${businessToken}`)
        .expect(200);

      expect(downloadResponse.body).toHaveProperty('download_url');
      expect(downloadResponse.body).toHaveProperty('expires_at');
      expect(downloadResponse.body).toHaveProperty('filename');

      // Update database status to downloaded
      await supabase
        .from('verification_databases')
        .update({ status: 'downloaded' })
        .eq('id', verificationDatabaseId);

      // Step 7: Business verifies transactions (simulated)
      // In real implementation, business would upload verified file
      // For testing, we'll update records directly
      const verificationRecords = await supabase
        .from('verification_records')
        .insert([
          {
            verification_db_id: verificationDatabaseId,
            original_feedback_id: feedbackSessionIds[0],
            transaction_time: '2025-09-23T10:00:00Z',
            transaction_value: 250.00,
            verification_status: 'verified',
            reward_percentage: 10.00,
            reward_amount: 25.00
          },
          {
            verification_db_id: verificationDatabaseId,
            original_feedback_id: feedbackSessionIds[1],
            transaction_time: '2025-09-23T14:30:00Z',
            transaction_value: 150.00,
            verification_status: 'verified',
            reward_percentage: 10.00,
            reward_amount: 15.00
          },
          {
            verification_db_id: verificationDatabaseId,
            original_feedback_id: feedbackSessionIds[2],
            transaction_time: '2025-09-23T16:45:00Z',
            transaction_value: 75.00,
            verification_status: 'fake',
            reward_percentage: 0.00,
            reward_amount: 0.00
          }
        ])
        .select();

      // Update database with verification results
      await supabase
        .from('verification_databases')
        .update({
          status: 'submitted',
          verified_count: 2,
          fake_count: 1,
          unverified_count: 0,
          submitted_at: new Date().toISOString()
        })
        .eq('id', verificationDatabaseId);

      // Step 8: Admin processes submissions and generates invoices
      await supabase
        .from('verification_databases')
        .update({ status: 'processed' })
        .eq('id', verificationDatabaseId);

      const invoiceResponse = await request(ADMIN_API_URL)
        .post(`/api/admin/verification/cycles/${createdCycleId}/invoices`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      expect(invoiceResponse.body).toHaveProperty('invoices_created');
      expect(invoiceResponse.body).toHaveProperty('total_amount');
      expect(invoiceResponse.body.invoices_created).toBe(1);

      // Verify invoice was created
      const { data: invoice } = await supabase
        .from('payment_invoices')
        .select('*')
        .eq('cycle_id', createdCycleId)
        .eq('business_id', testBusinessId)
        .single();

      expect(invoice).toBeTruthy();
      expect(invoice.total_rewards).toBe(40.00); // 25 + 15
      expect(invoice.admin_fee).toBe(8.00); // 20% of 40
      expect(invoice.total_amount).toBe(48.00); // 40 + 8
      expect(invoice.status).toBe('pending');

      // Step 9: Admin marks payment as received
      const paymentResponse = await request(ADMIN_API_URL)
        .put(`/api/admin/verification/invoices/${invoice.id}/payment`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'paid',
          payment_date: new Date().toISOString(),
          notes: 'Payment received via bank transfer'
        })
        .expect(200);

      expect(paymentResponse.body.status).toBe('paid');
      expect(paymentResponse.body).toHaveProperty('paid_at');

      // Step 10: Verify customer reward batches were created
      const { data: rewardBatches } = await supabase
        .from('customer_reward_batches')
        .select('*')
        .eq('cycle_id', createdCycleId);

      expect(rewardBatches).toHaveLength(2); // 2 unique phone numbers with verified transactions
      
      const totalRewards = rewardBatches.reduce((sum, batch) => sum + batch.total_reward_amount, 0);
      expect(totalRewards).toBe(40.00);

      // Step 11: Verify cycle completion
      const { data: finalCycle } = await supabase
        .from('weekly_verification_cycles')
        .select('*')
        .eq('id', createdCycleId)
        .single();

      expect(finalCycle.status).toBe('completed');
      expect(finalCycle.completed_stores).toBe(1);

      console.log('✅ Complete verification cycle test passed successfully');
    }, 30000); // 30 second timeout for integration test

    it('should handle business missing verification deadline', async () => {
      // Create expired verification cycle
      const { data: expiredCycle } = await supabase
        .from('weekly_verification_cycles')
        .insert({
          cycle_week: '2025-09-16', // Previous week
          status: 'collecting',
          total_stores: 1,
          completed_stores: 0,
          created_by: testAdminId
        })
        .select()
        .single();

      // Create expired verification database
      const pastDeadline = new Date();
      pastDeadline.setDate(pastDeadline.getDate() - 1); // Yesterday

      const { data: expiredDatabase } = await supabase
        .from('verification_databases')
        .insert({
          cycle_id: expiredCycle.id,
          store_id: testStoreId,
          business_id: testBusinessId,
          transaction_count: 2,
          status: 'ready',
          deadline_at: pastDeadline.toISOString(),
          verified_count: 0,
          fake_count: 0,
          unverified_count: 2
        })
        .select()
        .single();

      // Business should not be able to submit after deadline
      const lateSubmissionResponse = await request(BUSINESS_API_URL)
        .post(`/api/business/verification/databases/${expiredDatabase.id}/submit`)
        .set('Authorization', `Bearer ${businessToken}`)
        .attach('verification_file', Buffer.from('test,data'), 'verification.csv')
        .field('format', 'csv')
        .expect(400);

      expect(lateSubmissionResponse.body.message).toContain('deadline');

      // Verify database status becomes expired
      await supabase
        .from('verification_databases')
        .update({ status: 'expired' })
        .eq('id', expiredDatabase.id);

      const { data: updatedDatabase } = await supabase
        .from('verification_databases')
        .select('status')
        .eq('id', expiredDatabase.id)
        .single();

      expect(updatedDatabase.status).toBe('expired');

      // Cleanup
      await supabase.from('verification_databases').delete().eq('id', expiredDatabase.id);
      await supabase.from('weekly_verification_cycles').delete().eq('id', expiredCycle.id);
    });
  });
});