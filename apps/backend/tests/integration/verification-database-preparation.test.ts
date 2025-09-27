import request from 'supertest';
import { app } from '../../src/app';
import { supabase } from '../../src/services/database';

describe('Database Preparation Workflow Integration', () => {
  let adminToken: string;
  let cycleId: string;
  let testBusinessId: string;
  let testStoreId: string;

  beforeAll(async () => {
    // Setup test data
    // Create test business and store
    const { data: business } = await supabase
      .from('businesses')
      .insert({
        name: 'Test Business Integration',
        email: 'integration-test@example.com',
        phone: '+46701234567'
      })
      .select()
      .single();
    
    testBusinessId = business.id;

    const { data: store } = await supabase
      .from('stores')
      .insert({
        business_id: testBusinessId,
        name: 'Test Store Integration',
        address: 'Test Address 123',
        city: 'Stockholm',
        postal_code: '11122'
      })
      .select()
      .single();
    
    testStoreId = store.id;

    // Create sample feedback data for the store
    const feedbackData = [];
    for (let i = 0; i < 10; i++) {
      feedbackData.push({
        store_id: testStoreId,
        phone_number: `+4670123456${i}`,
        transaction_time: new Date(Date.now() - (i * 24 * 60 * 60 * 1000)).toISOString(),
        transaction_value: 100 + (i * 25),
        ai_processed: true,
        feedback_content: `Test feedback ${i}`,
        created_at: new Date().toISOString()
      });
    }

    await supabase
      .from('feedback_sessions')
      .insert(feedbackData);
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
    await supabase.from('verification_records').delete().match({ verification_db_id: cycleId });
    await supabase.from('verification_databases').delete().match({ cycle_id: cycleId });
    await supabase.from('weekly_verification_cycles').delete().match({ id: cycleId });
    await supabase.from('feedback_sessions').delete().match({ store_id: testStoreId });
    await supabase.from('stores').delete().match({ id: testStoreId });
    await supabase.from('businesses').delete().match({ id: testBusinessId });
  });

  describe('Complete Database Preparation Flow', () => {
    it('should create cycle, prepare databases, and generate files', async () => {
      // Step 1: Create verification cycle
      const cycleResponse = await request(app)
        .post('/api/admin/verification/cycles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          cycle_week: '2024-01-01'
        });

      expect(cycleResponse.status).toBe(201);
      expect(cycleResponse.body).toHaveProperty('id');
      expect(cycleResponse.body.status).toBe('preparing');
      
      cycleId = cycleResponse.body.id;

      // Step 2: Initiate database preparation
      const prepareResponse = await request(app)
        .post(`/api/admin/verification/cycles/${cycleId}/prepare`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(prepareResponse.status).toBe(202);
      expect(prepareResponse.body).toHaveProperty('job_id');
      expect(prepareResponse.body.message).toMatch(/preparation started/i);

      // Step 3: Wait for preparation to complete (polling simulation)
      let preparationComplete = false;
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds max wait

      while (!preparationComplete && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        
        const statusResponse = await request(app)
          .get(`/api/admin/verification/cycles/${cycleId}`)
          .set('Authorization', `Bearer ${adminToken}`);

        if (statusResponse.body.status === 'ready') {
          preparationComplete = true;
        }
        attempts++;
      }

      expect(preparationComplete).toBe(true);

      // Step 4: Verify databases were created
      const databasesResponse = await request(app)
        .get(`/api/admin/verification/cycles/${cycleId}/databases`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(databasesResponse.status).toBe(200);
      expect(Array.isArray(databasesResponse.body)).toBe(true);
      expect(databasesResponse.body.length).toBeGreaterThan(0);

      // Verify database contains our test store
      const testDatabase = databasesResponse.body.find(db => db.store_id === testStoreId);
      expect(testDatabase).toBeDefined();
      expect(testDatabase.business_id).toBe(testBusinessId);
      expect(testDatabase.transaction_count).toBe(10);
      expect(testDatabase.status).toBe('ready');

      // Step 5: Verify file exports are available
      const downloadResponse = await request(app)
        .get(`/api/admin/verification/databases/${testDatabase.id}/download/csv`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(downloadResponse.status).toBe(200);
      expect(downloadResponse.body).toHaveProperty('download_url');
      expect(downloadResponse.body).toHaveProperty('expires_at');
    });

    it('should handle stores with no feedback data', async () => {
      // Create store with no feedback
      const { data: emptyStore } = await supabase
        .from('stores')
        .insert({
          business_id: testBusinessId,
          name: 'Empty Store',
          address: 'Empty Address 456',
          city: 'Stockholm',
          postal_code: '11133'
        })
        .select()
        .single();

      // Create verification cycle
      const cycleResponse = await request(app)
        .post('/api/admin/verification/cycles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          cycle_week: '2024-01-08'
        });

      cycleId = cycleResponse.body.id;

      // Prepare databases
      const prepareResponse = await request(app)
        .post(`/api/admin/verification/cycles/${cycleId}/prepare`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(prepareResponse.status).toBe(202);

      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify databases were created even for empty stores
      const databasesResponse = await request(app)
        .get(`/api/admin/verification/cycles/${cycleId}/databases`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(databasesResponse.status).toBe(200);
      
      const emptyDatabase = databasesResponse.body.find(db => db.store_id === emptyStore.id);
      expect(emptyDatabase).toBeDefined();
      expect(emptyDatabase.transaction_count).toBe(0);
      expect(emptyDatabase.status).toBe('ready');

      // Cleanup
      await supabase.from('stores').delete().match({ id: emptyStore.id });
    });

    it('should handle large dataset preparation within time limits', async () => {
      // Create large dataset (simulate 1000 transactions)
      const largeFeedbackData = [];
      for (let i = 0; i < 1000; i++) {
        largeFeedbackData.push({
          store_id: testStoreId,
          phone_number: `+46701${String(i).padStart(6, '0')}`,
          transaction_time: new Date(Date.now() - (i * 60 * 60 * 1000)).toISOString(),
          transaction_value: 50 + (i % 500),
          ai_processed: true,
          feedback_content: `Large dataset feedback ${i}`,
          created_at: new Date().toISOString()
        });
      }

      await supabase
        .from('feedback_sessions')
        .insert(largeFeedbackData);

      const startTime = Date.now();

      // Create and prepare cycle
      const cycleResponse = await request(app)
        .post('/api/admin/verification/cycles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          cycle_week: '2024-01-15'
        });

      cycleId = cycleResponse.body.id;

      const prepareResponse = await request(app)
        .post(`/api/admin/verification/cycles/${cycleId}/prepare`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(prepareResponse.status).toBe(202);

      // Wait for completion with timeout
      let preparationComplete = false;
      const maxWaitTime = 120 * 1000; // 2 minutes max

      while (!preparationComplete && (Date.now() - startTime) < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const statusResponse = await request(app)
          .get(`/api/admin/verification/cycles/${cycleId}`)
          .set('Authorization', `Bearer ${adminToken}`);

        if (statusResponse.body.status === 'ready') {
          preparationComplete = true;
        }
      }

      const totalTime = Date.now() - startTime;

      expect(preparationComplete).toBe(true);
      expect(totalTime).toBeLessThan(120 * 1000); // Should complete within 2 minutes

      // Verify large dataset was processed correctly
      const databasesResponse = await request(app)
        .get(`/api/admin/verification/cycles/${cycleId}/databases`)
        .set('Authorization', `Bearer ${adminToken}`);

      const largeDatabase = databasesResponse.body.find(db => db.store_id === testStoreId);
      expect(largeDatabase.transaction_count).toBe(1010); // Original 10 + new 1000

      // Cleanup large dataset
      await supabase
        .from('feedback_sessions')
        .delete()
        .in('phone_number', largeFeedbackData.map(f => f.phone_number));
    });

    it('should maintain data privacy in prepared databases', async () => {
      // Create cycle and prepare
      const cycleResponse = await request(app)
        .post('/api/admin/verification/cycles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          cycle_week: '2024-01-22'
        });

      cycleId = cycleResponse.body.id;

      await request(app)
        .post(`/api/admin/verification/cycles/${cycleId}/prepare`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Get database and download CSV
      const databasesResponse = await request(app)
        .get(`/api/admin/verification/cycles/${cycleId}/databases`)
        .set('Authorization', `Bearer ${adminToken}`);

      const testDatabase = databasesResponse.body.find(db => db.store_id === testStoreId);
      
      const downloadResponse = await request(app)
        .get(`/api/admin/verification/databases/${testDatabase.id}/download/csv`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(downloadResponse.status).toBe(200);
      
      // TODO: Verify downloaded file content doesn't contain sensitive data
      // This would require actually fetching the signed URL and checking content
      // For now, we verify the endpoint structure
      expect(downloadResponse.body.download_url).toMatch(/^https:/);
    });
  });

  describe('Error Handling in Database Preparation', () => {
    it('should handle preparation failures gracefully', async () => {
      // Create cycle
      const cycleResponse = await request(app)
        .post('/api/admin/verification/cycles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          cycle_week: '2024-01-29'
        });

      cycleId = cycleResponse.body.id;

      // Try to prepare twice (should fail second time)
      await request(app)
        .post(`/api/admin/verification/cycles/${cycleId}/prepare`)
        .set('Authorization', `Bearer ${adminToken}`);

      const secondPrepareResponse = await request(app)
        .post(`/api/admin/verification/cycles/${cycleId}/prepare`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(secondPrepareResponse.status).toBe(409);
      expect(secondPrepareResponse.body.error).toMatch(/already prepared/i);
    });

    it('should handle invalid cycle states', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      
      const response = await request(app)
        .post(`/api/admin/verification/cycles/${fakeId}/prepare`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Performance Validation', () => {
    it('should meet preparation time targets for moderate datasets', async () => {
      const startTime = Date.now();

      // Create cycle with existing test data
      const cycleResponse = await request(app)
        .post('/api/admin/verification/cycles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          cycle_week: '2024-02-05'
        });

      cycleId = cycleResponse.body.id;

      const prepareResponse = await request(app)
        .post(`/api/admin/verification/cycles/${cycleId}/prepare`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(prepareResponse.status).toBe(202);

      // Monitor preparation completion
      let completed = false;
      while (!completed && (Date.now() - startTime) < 30000) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const statusResponse = await request(app)
          .get(`/api/admin/verification/cycles/${cycleId}`)
          .set('Authorization', `Bearer ${adminToken}`);

        if (statusResponse.body.status === 'ready') {
          completed = true;
        }
      }

      const totalTime = Date.now() - startTime;
      
      expect(completed).toBe(true);
      expect(totalTime).toBeLessThan(30000); // Should complete within 30 seconds for small dataset
    });
  });
});