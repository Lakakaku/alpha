import request from 'supertest';
import { app } from '../../src/app';
import { supabase } from '../../src/services/database';

describe('Business Verification Submission Integration', () => {
  let businessToken: string;
  let adminToken: string;
  let cycleId: string;
  let databaseId: string;
  let testBusinessId: string;
  let testStoreId: string;
  let verificationRecords: any[] = [];

  beforeAll(async () => {
    // Setup test data
    const { data: business } = await supabase
      .from('businesses')
      .insert({
        name: 'Test Business Submission',
        email: 'submission-test@example.com',
        phone: '+46701234567'
      })
      .select()
      .single();
    
    testBusinessId = business.id;

    const { data: store } = await supabase
      .from('stores')
      .insert({
        business_id: testBusinessId,
        name: 'Test Store Submission',
        address: 'Test Address 789',
        city: 'Stockholm',
        postal_code: '11144'
      })
      .select()
      .single();
    
    testStoreId = store.id;

    // Create sample feedback data
    const feedbackData = [];
    for (let i = 0; i < 5; i++) {
      feedbackData.push({
        store_id: testStoreId,
        phone_number: `+4670987654${i}`,
        transaction_time: new Date(Date.now() - (i * 24 * 60 * 60 * 1000)).toISOString(),
        transaction_value: 150 + (i * 30),
        ai_processed: true,
        feedback_content: `Submission test feedback ${i}`,
        created_at: new Date().toISOString()
      });
    }

    const { data: feedback } = await supabase
      .from('feedback_sessions')
      .insert(feedbackData)
      .select();

    // Create verification cycle and database
    const { data: cycle } = await supabase
      .from('weekly_verification_cycles')
      .insert({
        cycle_week: '2024-01-01',
        status: 'ready',
        total_stores: 1,
        completed_stores: 0
      })
      .select()
      .single();
    
    cycleId = cycle.id;

    const { data: database } = await supabase
      .from('verification_databases')
      .insert({
        cycle_id: cycleId,
        store_id: testStoreId,
        business_id: testBusinessId,
        transaction_count: 5,
        status: 'ready',
        deadline_at: new Date(Date.now() + (5 * 24 * 60 * 60 * 1000)).toISOString()
      })
      .select()
      .single();
    
    databaseId = database.id;

    // Create verification records
    const recordData = feedback.map(f => ({
      verification_db_id: databaseId,
      original_feedback_id: f.id,
      transaction_time: f.transaction_time,
      transaction_value: f.transaction_value,
      verification_status: 'pending'
    }));

    const { data: records } = await supabase
      .from('verification_records')
      .insert(recordData)
      .select();
    
    verificationRecords = records;
  });

  beforeEach(async () => {
    // Get tokens
    const businessLoginResponse = await request(app)
      .post('/api/business/auth/login')
      .send({
        email: 'submission-test@example.com',
        password: 'business123'
      });
    
    businessToken = businessLoginResponse.body.token;

    const adminLoginResponse = await request(app)
      .post('/api/admin/auth/login')
      .send({
        email: 'admin@vocilia.com',
        password: 'admin123'
      });
    
    adminToken = adminLoginResponse.body.token;
  });

  afterAll(async () => {
    // Cleanup test data
    await supabase.from('verification_records').delete().match({ verification_db_id: databaseId });
    await supabase.from('verification_databases').delete().match({ id: databaseId });
    await supabase.from('weekly_verification_cycles').delete().match({ id: cycleId });
    await supabase.from('feedback_sessions').delete().match({ store_id: testStoreId });
    await supabase.from('stores').delete().match({ id: testStoreId });
    await supabase.from('businesses').delete().match({ id: testBusinessId });
  });

  describe('Complete Business Verification Flow', () => {
    it('should allow business to view, verify, and submit records', async () => {
      // Step 1: Business lists available verification databases
      const listResponse = await request(app)
        .get('/api/business/verification/databases')
        .set('Authorization', `Bearer ${businessToken}`);

      expect(listResponse.status).toBe(200);
      expect(Array.isArray(listResponse.body)).toBe(true);
      
      const database = listResponse.body.find(db => db.id === databaseId);
      expect(database).toBeDefined();
      expect(database.status).toBe('ready');

      // Step 2: Business downloads verification file
      const downloadResponse = await request(app)
        .get(`/api/business/verification/databases/${databaseId}/download/csv`)
        .set('Authorization', `Bearer ${businessToken}`);

      expect(downloadResponse.status).toBe(200);
      expect(downloadResponse.body).toHaveProperty('download_url');

      // Step 3: Business views individual records
      const recordsResponse = await request(app)
        .get(`/api/business/verification/databases/${databaseId}/records`)
        .set('Authorization', `Bearer ${businessToken}`);

      expect(recordsResponse.status).toBe(200);
      expect(recordsResponse.body).toHaveProperty('records');
      expect(recordsResponse.body.records.length).toBe(5);

      // Step 4: Business updates verification status for individual records
      const updateResponse = await request(app)
        .patch(`/api/business/verification/databases/${databaseId}/records`)
        .set('Authorization', `Bearer ${businessToken}`)
        .send({
          records: [
            {
              record_id: verificationRecords[0].id,
              verification_status: 'verified'
            },
            {
              record_id: verificationRecords[1].id,
              verification_status: 'verified'
            },
            {
              record_id: verificationRecords[2].id,
              verification_status: 'fake'
            }
          ]
        });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.updated_count).toBe(3);

      // Step 5: Business submits verification via file upload
      const csvContent = `id,verification_status,reward_percentage
${verificationRecords[0].id},verified,5.00
${verificationRecords[1].id},verified,7.50
${verificationRecords[2].id},fake,0.00
${verificationRecords[3].id},verified,6.00
${verificationRecords[4].id},verified,4.50`;

      const submitResponse = await request(app)
        .post(`/api/business/verification/databases/${databaseId}/submit`)
        .set('Authorization', `Bearer ${businessToken}`)
        .attach('verification_file', Buffer.from(csvContent), 'verification.csv')
        .field('format', 'csv');

      expect(submitResponse.status).toBe(200);
      expect(submitResponse.body.verified_count).toBe(4);
      expect(submitResponse.body.fake_count).toBe(1);
      expect(submitResponse.body.total_processed).toBe(5);

      // Step 6: Verify database status updated to 'submitted'
      const updatedDatabase = await request(app)
        .get(`/api/business/verification/databases/${databaseId}`)
        .set('Authorization', `Bearer ${businessToken}`);

      expect(updatedDatabase.status).toBe('submitted');
    });

    it('should calculate reward amounts correctly', async () => {
      // Reset records to pending
      await supabase
        .from('verification_records')
        .update({ verification_status: 'pending' })
        .match({ verification_db_id: databaseId });

      // Submit verification with specific reward percentages
      const csvContent = `id,verification_status,reward_percentage
${verificationRecords[0].id},verified,5.00
${verificationRecords[1].id},verified,10.00
${verificationRecords[2].id},fake,0.00
${verificationRecords[3].id},verified,15.00
${verificationRecords[4].id},verified,2.00`;

      const submitResponse = await request(app)
        .post(`/api/business/verification/databases/${databaseId}/submit`)
        .set('Authorization', `Bearer ${businessToken}`)
        .attach('verification_file', Buffer.from(csvContent), 'verification.csv')
        .field('format', 'csv');

      expect(submitResponse.status).toBe(200);

      // Verify reward calculations in database
      const { data: updatedRecords } = await supabase
        .from('verification_records')
        .select('*')
        .eq('verification_db_id', databaseId)
        .eq('verification_status', 'verified');

      expect(updatedRecords.length).toBe(4);

      // Check specific reward amounts
      const record1 = updatedRecords.find(r => r.id === verificationRecords[0].id);
      expect(record1.reward_percentage).toBe(5.00);
      expect(record1.reward_amount).toBe(150 * 0.05); // 150 * 5%

      const record4 = updatedRecords.find(r => r.id === verificationRecords[3].id);
      expect(record4.reward_percentage).toBe(15.00);
      expect(record4.reward_amount).toBe(240 * 0.15); // 240 * 15%
    });

    it('should enforce deadline restrictions', async () => {
      // Create expired database
      const { data: expiredDatabase } = await supabase
        .from('verification_databases')
        .insert({
          cycle_id: cycleId,
          store_id: testStoreId,
          business_id: testBusinessId,
          transaction_count: 1,
          status: 'ready',
          deadline_at: new Date(Date.now() - (24 * 60 * 60 * 1000)).toISOString() // Yesterday
        })
        .select()
        .single();

      // Try to submit to expired database
      const csvContent = `id,verification_status,reward_percentage
${verificationRecords[0].id},verified,5.00`;

      const submitResponse = await request(app)
        .post(`/api/business/verification/databases/${expiredDatabase.id}/submit`)
        .set('Authorization', `Bearer ${businessToken}`)
        .attach('verification_file', Buffer.from(csvContent), 'verification.csv')
        .field('format', 'csv');

      expect(submitResponse.status).toBe(400);
      expect(submitResponse.body.error).toMatch(/deadline/i);

      // Cleanup
      await supabase.from('verification_databases').delete().match({ id: expiredDatabase.id });
    });

    it('should prevent double submission', async () => {
      // Reset database status
      await supabase
        .from('verification_databases')
        .update({ status: 'ready' })
        .match({ id: databaseId });

      const csvContent = `id,verification_status,reward_percentage
${verificationRecords[0].id},verified,5.00`;

      // First submission
      const firstSubmitResponse = await request(app)
        .post(`/api/business/verification/databases/${databaseId}/submit`)
        .set('Authorization', `Bearer ${businessToken}`)
        .attach('verification_file', Buffer.from(csvContent), 'verification.csv')
        .field('format', 'csv');

      expect(firstSubmitResponse.status).toBe(200);

      // Second submission should fail
      const secondSubmitResponse = await request(app)
        .post(`/api/business/verification/databases/${databaseId}/submit`)
        .set('Authorization', `Bearer ${businessToken}`)
        .attach('verification_file', Buffer.from(csvContent), 'verification.csv')
        .field('format', 'csv');

      expect(secondSubmitResponse.status).toBe(409);
      expect(secondSubmitResponse.body.error).toMatch(/already submitted/i);
    });
  });

  describe('File Format Validation', () => {
    it('should validate CSV file structure and content', async () => {
      // Reset database
      await supabase
        .from('verification_databases')
        .update({ status: 'ready' })
        .match({ id: databaseId });

      // Test invalid CSV structure
      const invalidCsv = `wrong,headers,here
some,data,values`;

      const response = await request(app)
        .post(`/api/business/verification/databases/${databaseId}/submit`)
        .set('Authorization', `Bearer ${businessToken}`)
        .attach('verification_file', Buffer.from(invalidCsv), 'invalid.csv')
        .field('format', 'csv');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('validation_errors');
      expect(Array.isArray(response.body.validation_errors)).toBe(true);
    });

    it('should validate reward percentage limits', async () => {
      // Reset database
      await supabase
        .from('verification_databases')
        .update({ status: 'ready' })
        .match({ id: databaseId });

      // Test invalid reward percentage (above 15%)
      const invalidCsv = `id,verification_status,reward_percentage
${verificationRecords[0].id},verified,20.00`;

      const response = await request(app)
        .post(`/api/business/verification/databases/${databaseId}/submit`)
        .set('Authorization', `Bearer ${businessToken}`)
        .attach('verification_file', Buffer.from(invalidCsv), 'invalid.csv')
        .field('format', 'csv');

      expect(response.status).toBe(400);
      expect(response.body.validation_errors).toBeDefined();
      
      const error = response.body.validation_errors.find(e => e.field === 'reward_percentage');
      expect(error).toBeDefined();
      expect(error.message).toMatch(/15.*%/);
    });

    it('should handle Excel file format', async () => {
      // Reset database
      await supabase
        .from('verification_databases')
        .update({ status: 'ready' })
        .match({ id: databaseId });

      // Mock Excel file (in practice would be actual Excel binary)
      const mockExcelContent = Buffer.from('mock-excel-binary-content');

      const response = await request(app)
        .post(`/api/business/verification/databases/${databaseId}/submit`)
        .set('Authorization', `Bearer ${businessToken}`)
        .attach('verification_file', mockExcelContent, 'verification.xlsx')
        .field('format', 'excel');

      // Should accept Excel format (implementation will parse binary)
      expect(response.status).not.toBe(400);
    });
  });

  describe('Security and Access Control', () => {
    it('should prevent access to other business databases', async () => {
      // Create another business and database
      const { data: otherBusiness } = await supabase
        .from('businesses')
        .insert({
          name: 'Other Business',
          email: 'other@example.com',
          phone: '+46709876543'
        })
        .select()
        .single();

      const { data: otherDatabase } = await supabase
        .from('verification_databases')
        .insert({
          cycle_id: cycleId,
          store_id: testStoreId,
          business_id: otherBusiness.id,
          transaction_count: 1,
          status: 'ready',
          deadline_at: new Date(Date.now() + (5 * 24 * 60 * 60 * 1000)).toISOString()
        })
        .select()
        .single();

      // Try to access other business's database
      const accessResponse = await request(app)
        .get(`/api/business/verification/databases/${otherDatabase.id}`)
        .set('Authorization', `Bearer ${businessToken}`);

      expect([403, 404]).toContain(accessResponse.status);

      // Try to submit to other business's database
      const submitResponse = await request(app)
        .post(`/api/business/verification/databases/${otherDatabase.id}/submit`)
        .set('Authorization', `Bearer ${businessToken}`)
        .attach('verification_file', Buffer.from('test'), 'test.csv')
        .field('format', 'csv');

      expect([403, 404]).toContain(submitResponse.status);

      // Cleanup
      await supabase.from('verification_databases').delete().match({ id: otherDatabase.id });
      await supabase.from('businesses').delete().match({ id: otherBusiness.id });
    });

    it('should track submission metadata and audit trail', async () => {
      // Reset database
      await supabase
        .from('verification_databases')
        .update({ status: 'ready' })
        .match({ id: databaseId });

      const csvContent = `id,verification_status,reward_percentage
${verificationRecords[0].id},verified,5.00`;

      const response = await request(app)
        .post(`/api/business/verification/databases/${databaseId}/submit`)
        .set('Authorization', `Bearer ${businessToken}`)
        .attach('verification_file', Buffer.from(csvContent), 'verification.csv')
        .field('format', 'csv');

      expect(response.status).toBe(200);

      // Verify audit trail was created
      const { data: database } = await supabase
        .from('verification_databases')
        .select('*')
        .eq('id', databaseId)
        .single();

      expect(database.submitted_at).toBeTruthy();
      expect(database.status).toBe('submitted');

      // Verify verification records have metadata
      const { data: records } = await supabase
        .from('verification_records')
        .select('*')
        .eq('verification_db_id', databaseId)
        .eq('verification_status', 'verified');

      expect(records.length).toBeGreaterThan(0);
      records.forEach(record => {
        expect(record.verified_at).toBeTruthy();
        expect(record.verified_by).toBeTruthy();
      });
    });
  });
});