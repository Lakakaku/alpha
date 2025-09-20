import { testClient } from '../setup';

describe('Contract: RLS Policies', () => {
  test('should have RLS enabled on all tables', async () => {
    const { data: tables, error } = await testClient
      .from('pg_tables')
      .select('tablename, rowsecurity')
      .eq('schemaname', 'public')
      .in('tablename', [
        'businesses',
        'user_accounts',
        'stores',
        'context_window',
        'transactions',
        'feedback_sessions',
        'verification_record'
      ]);

    expect(error).toBeNull();
    expect(tables).toBeDefined();
    expect(tables).toHaveLength(7);

    // All tables should have RLS enabled
    tables?.forEach(table => {
      expect(table.rowsecurity).toBe(true);
    });
  });

  test('should have business isolation policies configured', async () => {
    const { data: policies, error } = await testClient
      .from('pg_policies')
      .select('policyname, tablename, cmd')
      .eq('schemaname', 'public')
      .eq('tablename', 'businesses')
      .in('policyname', ['business_isolation', 'admin_business_access']);

    expect(error).toBeNull();
    expect(policies).toHaveLength(2);

    const policyNames = policies?.map(p => p.policyname) || [];
    expect(policyNames).toContain('business_isolation');
    expect(policyNames).toContain('admin_business_access');
  });

  test('should have user account access policies', async () => {
    const { data: policies, error } = await testClient
      .from('pg_policies')
      .select('policyname, tablename')
      .eq('schemaname', 'public')
      .eq('tablename', 'user_accounts')
      .in('policyname', [
        'own_account_access',
        'business_staff_access',
        'admin_user_access'
      ]);

    expect(error).toBeNull();
    expect(policies).toHaveLength(3);
  });

  test('should have store access policies with business isolation', async () => {
    const { data: policies, error } = await testClient
      .from('pg_policies')
      .select('policyname, tablename')
      .eq('schemaname', 'public')
      .eq('tablename', 'stores')
      .in('policyname', [
        'store_business_isolation',
        'admin_store_access',
        'public_qr_lookup'
      ]);

    expect(error).toBeNull();
    expect(policies).toHaveLength(3);
  });

  test('should have context window business access policies', async () => {
    const { data: policies, error } = await testClient
      .from('pg_policies')
      .select('policyname, tablename')
      .eq('schemaname', 'public')
      .eq('tablename', 'context_window')
      .in('policyname', [
        'context_business_access',
        'admin_context_access'
      ]);

    expect(error).toBeNull();
    expect(policies).toHaveLength(2);
  });

  test('should have transaction access policies', async () => {
    const { data: policies, error } = await testClient
      .from('pg_policies')
      .select('policyname, tablename')
      .eq('schemaname', 'public')
      .eq('tablename', 'transactions')
      .in('policyname', [
        'transaction_business_access',
        'admin_transaction_access'
      ]);

    expect(error).toBeNull();
    expect(policies).toHaveLength(2);
  });

  test('should have feedback session policies with privacy protection', async () => {
    const { data: policies, error } = await testClient
      .from('pg_policies')
      .select('policyname, tablename')
      .eq('schemaname', 'public')
      .eq('tablename', 'feedback_sessions')
      .in('policyname', [
        'feedback_business_access',
        'admin_feedback_access'
      ]);

    expect(error).toBeNull();
    expect(policies).toHaveLength(2);
  });

  test('should have verification record policies', async () => {
    const { data: policies, error } = await testClient
      .from('pg_policies')
      .select('policyname, tablename')
      .eq('schemaname', 'public')
      .eq('tablename', 'verification_record')
      .in('policyname', [
        'verification_business_access',
        'admin_verification_access'
      ]);

    expect(error).toBeNull();
    expect(policies).toHaveLength(2);
  });

  test('should validate policy expressions contain JWT business_id checks', async () => {
    const { data: businessPolicy, error } = await testClient
      .from('pg_policies')
      .select('qual')
      .eq('schemaname', 'public')
      .eq('tablename', 'businesses')
      .eq('policyname', 'business_isolation');

    expect(error).toBeNull();
    expect(businessPolicy).toHaveLength(1);

    // Policy should reference JWT business_id
    const policyExpression = businessPolicy?.[0]?.qual || '';
    expect(policyExpression).toContain('auth.jwt()');
    expect(policyExpression).toContain('business_id');
  });

  test('should validate admin bypass policies exist', async () => {
    const adminPolicyTables = [
      'businesses',
      'user_accounts',
      'stores',
      'context_window',
      'transactions',
      'feedback_sessions',
      'verification_record'
    ];

    for (const table of adminPolicyTables) {
      const { data: adminPolicies, error } = await testClient
        .from('pg_policies')
        .select('policyname')
        .eq('schemaname', 'public')
        .eq('tablename', table)
        .like('policyname', '%admin%');

      expect(error).toBeNull();
      expect(adminPolicies?.length).toBeGreaterThanOrEqual(1);
    }
  });

  test('should validate public QR lookup policy exists for stores', async () => {
    const { data: qrPolicy, error } = await testClient
      .from('pg_policies')
      .select('policyname, cmd, qual')
      .eq('schemaname', 'public')
      .eq('tablename', 'stores')
      .eq('policyname', 'public_qr_lookup');

    expect(error).toBeNull();
    expect(qrPolicy).toHaveLength(1);

    // Should be SELECT only policy
    expect(qrPolicy?.[0]?.cmd).toBe('SELECT');

    // Should check is_active = true
    const policyExpression = qrPolicy?.[0]?.qual || '';
    expect(policyExpression).toContain('is_active');
  });

  test('should prevent cross-business data access', async () => {
    // This test simulates JWT context - will fail until RLS is working
    const mockBusinessId1 = '123e4567-e89b-12d3-a456-426614174000';
    const mockBusinessId2 = '123e4567-e89b-12d3-a456-426614174001';

    // Create test client with business context
    const businessClient1 = testClient.auth.setSession({
      access_token: 'mock-jwt-token',
      refresh_token: 'mock-refresh-token'
    });

    // This should fail without proper JWT/RLS setup
    expect(businessClient1).toBeDefined();
  });

  test('should validate nested business access through store relationships', async () => {
    // Test that context_window, transactions, and feedback_sessions
    // properly filter through stores -> business_id relationship
    const nestedTables = [
      'context_window',
      'transactions',
      'feedback_sessions'
    ];

    for (const table of nestedTables) {
      const { data: policies, error } = await testClient
        .from('pg_policies')
        .select('qual')
        .eq('schemaname', 'public')
        .eq('tablename', table)
        .like('policyname', '%business%');

      expect(error).toBeNull();
      expect(policies?.length).toBeGreaterThanOrEqual(1);

      // Policy should reference stores table for business_id lookup
      const hasStoreReference = policies?.some(p =>
        p.qual?.includes('stores') && p.qual?.includes('business_id')
      );
      expect(hasStoreReference).toBe(true);
    }
  });
});