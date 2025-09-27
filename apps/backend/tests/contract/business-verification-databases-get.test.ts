import request from 'supertest';
import { createClient } from '@supabase/supabase-js';

const API_URL = process.env.API_URL || 'http://localhost:3000';
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

describe('Business Verification Databases GET API Contract', () => {
  let testBusinessId: string;
  let testStoreId: string;
  let testCycleId: string;
  let testDatabaseId: string;
  let validBusinessToken: string;

  beforeAll(async () => {
    // Create test business account
    const { data: authUser } = await supabase.auth.admin.createUser({
      email: 'test.business.verification@vocilia.com',
      password: 'TestBusiness123!',
      email_confirm: true
    });

    if (authUser.user) {
      // Create business
      const { data: business } = await supabase
        .from('businesses')
        .insert({
          name: 'Test Verification Business',
          email: 'test.business.verification@vocilia.com',
          phone: '+46701234567'
        })
        .select()
        .single();

      testBusinessId = business.id;

      // Create business account
      const { data: businessAccount } = await supabase
        .from('business_accounts')
        .insert({
          user_id: authUser.user.id,
          business_id: testBusinessId,
          email: 'test.business.verification@vocilia.com',
          full_name: 'Test Business User',
          role: 'owner',
          is_active: true
        })
        .select()
        .single();

      // Create business session
      const { data: session } = await supabase
        .from('business_sessions')
        .insert({
          business_account_id: businessAccount.id,
          session_token: 'test_business_verification_session_token',
          expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
        })
        .select()
        .single();

      validBusinessToken = session.session_token;

      // Create test store
      const { data: store } = await supabase
        .from('stores')
        .insert({
          business_id: testBusinessId,
          name: 'Test Verification Store',
          address: 'Test Address 123',
          city: 'Stockholm',
          postal_code: '12345'
        })
        .select()
        .single();

      testStoreId = store.id;

      // Create test verification cycle
      const { data: cycle } = await supabase
        .from('weekly_verification_cycles')
        .insert({
          cycle_week: '2025-09-23',
          status: 'distributed',
          total_stores: 1,
          completed_stores: 0
        })
        .select()
        .single();

      testCycleId = cycle.id;

      // Create test verification database
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + 3); // 3 days from now

      const { data: database } = await supabase
        .from('verification_databases')
        .insert({
          cycle_id: testCycleId,
          store_id: testStoreId,
          business_id: testBusinessId,
          csv_file_url: 'https://storage.supabase.co/test/verification.csv',
          excel_file_url: 'https://storage.supabase.co/test/verification.xlsx',
          json_file_url: 'https://storage.supabase.co/test/verification.json',
          transaction_count: 5,
          status: 'ready',
          deadline_at: deadline.toISOString(),
          verified_count: 0,
          fake_count: 0,
          unverified_count: 5
        })
        .select()
        .single();

      testDatabaseId = database.id;
    }
  });

  afterAll(async () => {
    // Cleanup test data
    if (testDatabaseId) {
      await supabase
        .from('verification_databases')
        .delete()
        .eq('id', testDatabaseId);
    }
    
    if (testCycleId) {
      await supabase
        .from('weekly_verification_cycles')
        .delete()
        .eq('id', testCycleId);
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
  });

  describe('GET /api/business/verification/databases', () => {
    it('should return 401 without valid session token', async () => {
      const response = await request(API_URL)
        .get('/api/business/verification/databases')
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Unauthorized');
    });

    it('should return 401 with invalid session token', async () => {
      const response = await request(API_URL)
        .get('/api/business/verification/databases')
        .set('Authorization', 'Bearer invalid_token')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should return verification databases list for authenticated business', async () => {
      const response = await request(API_URL)
        .get('/api/business/verification/databases')
        .set('Authorization', `Bearer ${validBusinessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      if (response.body.length > 0) {
        const database = response.body[0];
        expect(database).toHaveProperty('id');
        expect(database).toHaveProperty('store_id');
        expect(database).toHaveProperty('store_name');
        expect(database).toHaveProperty('transaction_count');
        expect(database).toHaveProperty('status');
        expect(database).toHaveProperty('deadline_at');
        expect(database).toHaveProperty('created_at');
        
        // Should not expose internal IDs
        expect(database).not.toHaveProperty('business_id');
        expect(database).not.toHaveProperty('cycle_id');
      }
    });

    it('should support status filtering', async () => {
      const response = await request(API_URL)
        .get('/api/business/verification/databases?status=ready')
        .set('Authorization', `Bearer ${validBusinessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      // All returned databases should have the filtered status
      response.body.forEach((database: any) => {
        expect(database.status).toBe('ready');
      });
    });

    it('should support cycle_week filtering', async () => {
      const response = await request(API_URL)
        .get('/api/business/verification/databases?cycle_week=2025-09-23')
        .set('Authorization', `Bearer ${validBusinessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should return 400 for invalid status filter', async () => {
      const response = await request(API_URL)
        .get('/api/business/verification/databases?status=invalid_status')
        .set('Authorization', `Bearer ${validBusinessToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.message).toContain('status');
    });

    it('should return 400 for invalid date format', async () => {
      const response = await request(API_URL)
        .get('/api/business/verification/databases?cycle_week=invalid-date')
        .set('Authorization', `Bearer ${validBusinessToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.message).toContain('date');
    });

    it('should return empty array when no databases exist', async () => {
      // Create another business with no databases
      const { data: authUser2 } = await supabase.auth.admin.createUser({
        email: 'test.business.empty@vocilia.com',
        password: 'TestBusiness123!',
        email_confirm: true
      });

      const { data: business2 } = await supabase
        .from('businesses')
        .insert({
          name: 'Empty Business',
          email: 'test.business.empty@vocilia.com',
          phone: '+46701234568'
        })
        .select()
        .single();

      const { data: businessAccount2 } = await supabase
        .from('business_accounts')
        .insert({
          user_id: authUser2.user!.id,
          business_id: business2.id,
          email: 'test.business.empty@vocilia.com',
          full_name: 'Empty Business User',
          role: 'owner',
          is_active: true
        })
        .select()
        .single();

      const { data: session2 } = await supabase
        .from('business_sessions')
        .insert({
          business_account_id: businessAccount2.id,
          session_token: 'test_empty_business_session_token',
          expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
        })
        .select()
        .single();

      const response = await request(API_URL)
        .get('/api/business/verification/databases')
        .set('Authorization', `Bearer ${session2.session_token}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(0);

      // Cleanup
      await supabase.from('business_sessions').delete().eq('id', session2.id);
      await supabase.from('business_accounts').delete().eq('id', businessAccount2.id);
      await supabase.from('businesses').delete().eq('id', business2.id);
      await supabase.auth.admin.deleteUser(authUser2.user!.id);
    });
  });
});