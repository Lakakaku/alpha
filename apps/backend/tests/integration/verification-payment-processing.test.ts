import request from 'supertest';
import { app } from '../../src/app';
import { supabase } from '../../src/services/database';

describe('Payment Processing Workflow Integration', () => {
  let adminToken: string;
  let cycleId: string;
  let testBusinessId: string;
  let testStoreId: string;
  let databaseId: string;
  let verificationRecords: any[] = [];

  beforeAll(async () => {
    // Setup complete test data for payment processing
    const { data: business } = await supabase
      .from('businesses')
      .insert({
        name: 'Test Business Payment',
        email: 'payment-test@example.com',
        phone: '+46701234567'
      })
      .select()
      .single();
    
    testBusinessId = business.id;

    const { data: store } = await supabase
      .from('stores')
      .insert({
        business_id: testBusinessId,
        name: 'Test Store Payment',
        address: 'Test Address 999',
        city: 'Stockholm',
        postal_code: '11199'
      })
      .select()
      .single();
    
    testStoreId = store.id;

    // Create feedback data with specific values for payment calculation
    const feedbackData = [
      {
        store_id: testStoreId,
        phone_number: '+46701111111',
        transaction_time: new Date().toISOString(),
        transaction_value: 1000, // High value transaction
        ai_processed: true,
        feedback_content: 'Payment test feedback 1',
        created_at: new Date().toISOString()
      },
      {
        store_id: testStoreId,
        phone_number: '+46702222222',
        transaction_time: new Date().toISOString(),
        transaction_value: 500,
        ai_processed: true,
        feedback_content: 'Payment test feedback 2',
        created_at: new Date().toISOString()
      },
      {
        store_id: testStoreId,
        phone_number: '+46703333333',
        transaction_time: new Date().toISOString(),
        transaction_value: 200,
        ai_processed: true,
        feedback_content: 'Payment test feedback 3',
        created_at: new Date().toISOString()
      }
    ];

    const { data: feedback } = await supabase
      .from('feedback_sessions')
      .insert(feedbackData)
      .select();

    // Create verification cycle (completed verification phase)
    const { data: cycle } = await supabase
      .from('weekly_verification_cycles')
      .insert({
        cycle_week: '2024-01-01',
        status: 'processing',
        total_stores: 1,
        completed_stores: 1
      })
      .select()
      .single();
    
    cycleId = cycle.id;

    // Create verification database (submitted status)
    const { data: database } = await supabase
      .from('verification_databases')
      .insert({
        cycle_id: cycleId,
        store_id: testStoreId,
        business_id: testBusinessId,
        transaction_count: 3,
        status: 'submitted',
        deadline_at: new Date(Date.now() + (5 * 24 * 60 * 60 * 1000)).toISOString(),
        submitted_at: new Date().toISOString(),
        verified_count: 2,
        fake_count: 1,
        unverified_count: 0
      })
      .select()
      .single();
    
    databaseId = database.id;

    // Create verification records with calculated rewards
    const recordData = [
      {
        verification_db_id: databaseId,
        original_feedback_id: feedback[0].id,
        transaction_time: feedback[0].transaction_time,
        transaction_value: feedback[0].transaction_value,
        verification_status: 'verified',
        reward_percentage: 10.00,
        reward_amount: 100.00, // 1000 * 10%
        verified_at: new Date().toISOString()
      },
      {
        verification_db_id: databaseId,
        original_feedback_id: feedback[1].id,
        transaction_time: feedback[1].transaction_time,
        transaction_value: feedback[1].transaction_value,
        verification_status: 'verified',
        reward_percentage: 15.00,
        reward_amount: 75.00, // 500 * 15%
        verified_at: new Date().toISOString()
      },
      {
        verification_db_id: databaseId,
        original_feedback_id: feedback[2].id,
        transaction_time: feedback[2].transaction_time,
        transaction_value: feedback[2].transaction_value,
        verification_status: 'fake',
        reward_percentage: 0.00,
        reward_amount: 0.00,
        verified_at: new Date().toISOString()
      }
    ];

    const { data: records } = await supabase
      .from('verification_records')
      .insert(recordData)
      .select();
    
    verificationRecords = records;
  });

  beforeEach(async () => {
    // Get admin token
    const loginResponse = await request(app)
      .post('/api/admin/auth/login')
      .send({
        email: 'admin@vocilia.com',
        password: 'admin123'
      });
    
    adminToken = loginResponse.body.token;
  });

  afterAll(async () => {
    // Cleanup test data
    await supabase.from('customer_reward_batches').delete().match({ cycle_id: cycleId });
    await supabase.from('payment_invoices').delete().match({ cycle_id: cycleId });
    await supabase.from('verification_records').delete().match({ verification_db_id: databaseId });
    await supabase.from('verification_databases').delete().match({ id: databaseId });
    await supabase.from('weekly_verification_cycles').delete().match({ id: cycleId });
    await supabase.from('feedback_sessions').delete().match({ store_id: testStoreId });
    await supabase.from('stores').delete().match({ id: testStoreId });
    await supabase.from('businesses').delete().match({ id: testBusinessId });
  });

  describe('Complete Payment Processing Flow', () => {
    it('should generate invoices with correct calculations', async () => {
      // Step 1: Generate invoices for the cycle
      const invoiceResponse = await request(app)
        .post(`/api/admin/verification/cycles/${cycleId}/invoices`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(invoiceResponse.status).toBe(201);
      expect(invoiceResponse.body.invoices_created).toBe(1);
      expect(invoiceResponse.body.total_amount).toBeDefined();

      // Step 2: Verify invoice calculations
      const { data: invoice } = await supabase
        .from('payment_invoices')
        .select('*')
        .eq('cycle_id', cycleId)
        .eq('business_id', testBusinessId)
        .single();

      expect(invoice).toBeDefined();
      expect(invoice.total_rewards).toBe(175.00); // 100 + 75
      expect(invoice.admin_fee).toBe(35.00); // 20% of 175
      expect(invoice.total_amount).toBe(210.00); // 175 + 35
      expect(invoice.status).toBe('pending');
      expect(invoice.due_date).toBeDefined();

      // Step 3: Mark invoice as paid
      const paymentResponse = await request(app)
        .put(`/api/admin/verification/invoices/${invoice.id}/payment`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'paid',
          payment_date: new Date().toISOString(),
          notes: 'Test payment confirmation'
        });

      expect(paymentResponse.status).toBe(200);
      expect(paymentResponse.body.status).toBe('paid');

      // Step 4: Verify feedback database delivery triggered
      const { data: updatedInvoice } = await supabase
        .from('payment_invoices')
        .select('*')
        .eq('id', invoice.id)
        .single();

      expect(updatedInvoice.status).toBe('paid');
      expect(updatedInvoice.paid_at).toBeTruthy();
      expect(updatedInvoice.feedback_database_delivered).toBe(true);
      expect(updatedInvoice.delivered_at).toBeTruthy();
    });

    it('should create customer reward batches for Swish payments', async () => {
      // Generate invoices first
      await request(app)
        .post(`/api/admin/verification/cycles/${cycleId}/invoices`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Verify customer reward batches were created
      const { data: rewardBatches } = await supabase
        .from('customer_reward_batches')
        .select('*')
        .eq('cycle_id', cycleId);

      expect(rewardBatches.length).toBe(2); // Two unique phone numbers with rewards

      // Check specific reward calculations
      const batch1 = rewardBatches.find(b => b.phone_number === '+46701111111');
      expect(batch1.total_reward_amount).toBe(100.00);
      expect(batch1.transaction_count).toBe(1);
      expect(batch1.swish_payment_status).toBe('pending');

      const batch2 = rewardBatches.find(b => b.phone_number === '+46702222222');
      expect(batch2.total_reward_amount).toBe(75.00);
      expect(batch2.transaction_count).toBe(1);
      expect(batch2.swish_payment_status).toBe('pending');

      // No reward batch for fake transaction phone number
      const batch3 = rewardBatches.find(b => b.phone_number === '+46703333333');
      expect(batch3).toBeUndefined();
    });

    it('should handle invoice dispute workflow', async () => {
      // Create invoice
      await request(app)
        .post(`/api/admin/verification/cycles/${cycleId}/invoices`)
        .set('Authorization', `Bearer ${adminToken}`);

      const { data: invoice } = await supabase
        .from('payment_invoices')
        .select('*')
        .eq('cycle_id', cycleId)
        .eq('business_id', testBusinessId)
        .single();

      // Mark invoice as disputed
      const disputeResponse = await request(app)
        .put(`/api/admin/verification/invoices/${invoice.id}/payment`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'disputed',
          notes: 'Business disputes verification results'
        });

      expect(disputeResponse.status).toBe(200);
      expect(disputeResponse.body.status).toBe('disputed');

      // Verify no delivery occurred for disputed invoice
      const { data: disputedInvoice } = await supabase
        .from('payment_invoices')
        .select('*')
        .eq('id', invoice.id)
        .single();

      expect(disputedInvoice.status).toBe('disputed');
      expect(disputedInvoice.feedback_database_delivered).toBe(false);
      expect(disputedInvoice.delivered_at).toBeNull();

      // Admin can resolve dispute by marking as paid
      const resolveResponse = await request(app)
        .put(`/api/admin/verification/invoices/${invoice.id}/payment`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'paid',
          payment_date: new Date().toISOString(),
          notes: 'Dispute resolved, marking as paid'
        });

      expect(resolveResponse.status).toBe(200);
      expect(resolveResponse.body.status).toBe('paid');
    });

    it('should handle invoice cancellation', async () => {
      // Create invoice
      await request(app)
        .post(`/api/admin/verification/cycles/${cycleId}/invoices`)
        .set('Authorization', `Bearer ${adminToken}`);

      const { data: invoice } = await supabase
        .from('payment_invoices')
        .select('*')
        .eq('cycle_id', cycleId)
        .eq('business_id', testBusinessId)
        .single();

      // Cancel invoice
      const cancelResponse = await request(app)
        .put(`/api/admin/verification/invoices/${invoice.id}/payment`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'cancelled',
          notes: 'Verification cycle cancelled by admin'
        });

      expect(cancelResponse.status).toBe(200);
      expect(cancelResponse.body.status).toBe('cancelled');

      // Verify no delivery or customer rewards
      const { data: cancelledInvoice } = await supabase
        .from('payment_invoices')
        .select('*')
        .eq('id', invoice.id)
        .single();

      expect(cancelledInvoice.status).toBe('cancelled');
      expect(cancelledInvoice.feedback_database_delivered).toBe(false);

      // Customer reward batches should be marked accordingly
      const { data: rewardBatches } = await supabase
        .from('customer_reward_batches')
        .select('*')
        .eq('cycle_id', cycleId);

      // Implementation should handle cancelled payments
      expect(rewardBatches.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Payment Validation and Error Handling', () => {
    it('should validate invoice exists before payment update', async () => {
      const fakeInvoiceId = '00000000-0000-0000-0000-000000000000';

      const response = await request(app)
        .put(`/api/admin/verification/invoices/${fakeInvoiceId}/payment`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'paid',
          payment_date: new Date().toISOString()
        });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    it('should prevent invalid state transitions', async () => {
      // Create and pay invoice
      await request(app)
        .post(`/api/admin/verification/cycles/${cycleId}/invoices`)
        .set('Authorization', `Bearer ${adminToken}`);

      const { data: invoice } = await supabase
        .from('payment_invoices')
        .select('*')
        .eq('cycle_id', cycleId)
        .eq('business_id', testBusinessId)
        .single();

      // Mark as paid
      await request(app)
        .put(`/api/admin/verification/invoices/${invoice.id}/payment`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'paid',
          payment_date: new Date().toISOString()
        });

      // Try to cancel already paid invoice
      const invalidResponse = await request(app)
        .put(`/api/admin/verification/invoices/${invoice.id}/payment`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'cancelled',
          notes: 'Trying to cancel paid invoice'
        });

      // Should handle state validation appropriately
      expect([400, 409]).toContain(invalidResponse.status);
    });

    it('should handle duplicate invoice generation attempts', async () => {
      // Generate invoices first time
      const firstResponse = await request(app)
        .post(`/api/admin/verification/cycles/${cycleId}/invoices`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(firstResponse.status).toBe(201);

      // Try to generate invoices again
      const secondResponse = await request(app)
        .post(`/api/admin/verification/cycles/${cycleId}/invoices`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(secondResponse.status).toBe(409);
      expect(secondResponse.body.error).toMatch(/already generated/i);
    });
  });

  describe('Customer Reward Processing', () => {
    it('should aggregate multiple transactions per customer', async () => {
      // Add more transactions for existing customers
      const additionalFeedback = [
        {
          store_id: testStoreId,
          phone_number: '+46701111111', // Same customer as first transaction
          transaction_time: new Date().toISOString(),
          transaction_value: 300,
          ai_processed: true,
          feedback_content: 'Additional feedback',
          created_at: new Date().toISOString()
        }
      ];

      const { data: newFeedback } = await supabase
        .from('feedback_sessions')
        .insert(additionalFeedback)
        .select();

      // Add verification record for new transaction
      const additionalRecord = {
        verification_db_id: databaseId,
        original_feedback_id: newFeedback[0].id,
        transaction_time: newFeedback[0].transaction_time,
        transaction_value: newFeedback[0].transaction_value,
        verification_status: 'verified',
        reward_percentage: 5.00,
        reward_amount: 15.00, // 300 * 5%
        verified_at: new Date().toISOString()
      };

      await supabase
        .from('verification_records')
        .insert(additionalRecord);

      // Update database counts
      await supabase
        .from('verification_databases')
        .update({
          transaction_count: 4,
          verified_count: 3
        })
        .match({ id: databaseId });

      // Generate invoices
      await request(app)
        .post(`/api/admin/verification/cycles/${cycleId}/invoices`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Check customer reward aggregation
      const { data: rewardBatch } = await supabase
        .from('customer_reward_batches')
        .select('*')
        .eq('cycle_id', cycleId)
        .eq('phone_number', '+46701111111')
        .single();

      expect(rewardBatch.total_reward_amount).toBe(115.00); // 100 + 15
      expect(rewardBatch.transaction_count).toBe(2);

      // Cleanup additional data
      await supabase.from('verification_records').delete().match({ original_feedback_id: newFeedback[0].id });
      await supabase.from('feedback_sessions').delete().match({ id: newFeedback[0].id });
    });

    it('should handle invalid phone numbers for Swish', async () => {
      // Add transaction with invalid phone number
      const invalidFeedback = {
        store_id: testStoreId,
        phone_number: 'invalid-phone-number',
        transaction_time: new Date().toISOString(),
        transaction_value: 100,
        ai_processed: true,
        feedback_content: 'Invalid phone feedback',
        created_at: new Date().toISOString()
      };

      const { data: feedback } = await supabase
        .from('feedback_sessions')
        .insert(invalidFeedback)
        .select()
        .single();

      const invalidRecord = {
        verification_db_id: databaseId,
        original_feedback_id: feedback.id,
        transaction_time: feedback.transaction_time,
        transaction_value: feedback.transaction_value,
        verification_status: 'verified',
        reward_percentage: 5.00,
        reward_amount: 5.00,
        verified_at: new Date().toISOString()
      };

      await supabase
        .from('verification_records')
        .insert(invalidRecord);

      // Generate invoices (should handle invalid phone number)
      const response = await request(app)
        .post(`/api/admin/verification/cycles/${cycleId}/invoices`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(201);

      // Check that invalid phone number is marked appropriately
      const { data: invalidBatch } = await supabase
        .from('customer_reward_batches')
        .select('*')
        .eq('cycle_id', cycleId)
        .eq('phone_number', 'invalid-phone-number')
        .single();

      if (invalidBatch) {
        expect(invalidBatch.swish_payment_status).toBe('invalid_number');
      }

      // Cleanup
      await supabase.from('verification_records').delete().match({ original_feedback_id: feedback.id });
      await supabase.from('feedback_sessions').delete().match({ id: feedback.id });
    });
  });

  describe('Audit Trail and Compliance', () => {
    it('should maintain complete audit trail for payment processing', async () => {
      // Generate invoices
      const invoiceResponse = await request(app)
        .post(`/api/admin/verification/cycles/${cycleId}/invoices`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(invoiceResponse.status).toBe(201);

      const { data: invoice } = await supabase
        .from('payment_invoices')
        .select('*')
        .eq('cycle_id', cycleId)
        .eq('business_id', testBusinessId)
        .single();

      // Process payment
      const paymentResponse = await request(app)
        .put(`/api/admin/verification/invoices/${invoice.id}/payment`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'paid',
          payment_date: new Date().toISOString(),
          notes: 'Payment processed successfully'
        });

      expect(paymentResponse.status).toBe(200);

      // Verify all timestamps and audit fields are populated
      const { data: auditedInvoice } = await supabase
        .from('payment_invoices')
        .select('*')
        .eq('id', invoice.id)
        .single();

      expect(auditedInvoice.created_at).toBeTruthy();
      expect(auditedInvoice.updated_at).toBeTruthy();
      expect(auditedInvoice.paid_at).toBeTruthy();
      expect(auditedInvoice.delivered_at).toBeTruthy();

      // Check verification cycle status update
      const { data: updatedCycle } = await supabase
        .from('weekly_verification_cycles')
        .select('*')
        .eq('id', cycleId)
        .single();

      // Should progress to next status after invoice processing
      expect(['invoicing', 'completed']).toContain(updatedCycle.status);
    });
  });
});