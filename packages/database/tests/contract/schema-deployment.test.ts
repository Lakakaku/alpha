import { testClient } from '../setup';

describe('Contract: Schema Deployment', () => {
  test('should have all 7 required tables deployed', async () => {
    const { data: tables, error } = await testClient
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', [
        'businesses',
        'user_accounts',
        'stores',
        'context_window',
        'transactions',
        'feedback_sessions',
        'verification_record'
      ]);

    expect(error).toBeNull();
    expect(tables).toHaveLength(7);

    const tableNames = tables?.map(t => t.table_name) || [];
    expect(tableNames).toContain('businesses');
    expect(tableNames).toContain('user_accounts');
    expect(tableNames).toContain('stores');
    expect(tableNames).toContain('context_window');
    expect(tableNames).toContain('transactions');
    expect(tableNames).toContain('feedback_sessions');
    expect(tableNames).toContain('verification_record');
  });

  test('should have required extensions enabled', async () => {
    const { data: extensions, error } = await testClient
      .rpc('pg_extension_installed', { extension_name: 'uuid-ossp' });

    expect(error).toBeNull();
    expect(extensions).toBe(true);

    const { data: gistExtension, error: gistError } = await testClient
      .rpc('pg_extension_installed', { extension_name: 'btree_gist' });

    expect(gistError).toBeNull();
    expect(gistExtension).toBe(true);
  });

  test('should have all required custom types', async () => {
    const { data: types, error } = await testClient
      .from('information_schema.user_defined_types')
      .select('type_name')
      .eq('type_schema', 'public')
      .in('type_name', [
        'user_role',
        'feedback_status',
        'verification_status',
        'weekly_verification_status'
      ]);

    expect(error).toBeNull();
    expect(types).toHaveLength(4);
  });

  test('should have required utility functions', async () => {
    const { data: functions, error } = await testClient
      .from('information_schema.routines')
      .select('routine_name')
      .eq('routine_schema', 'public')
      .in('routine_name', [
        'create_time_tolerance',
        'create_amount_tolerance',
        'calculate_context_score',
        'update_context_score',
        'update_updated_at_column'
      ]);

    expect(error).toBeNull();
    expect(functions).toHaveLength(5);
  });

  test('should have performance indexes deployed', async () => {
    const { data: indexes, error } = await testClient
      .from('pg_indexes')
      .select('indexname')
      .eq('schemaname', 'public')
      .in('indexname', [
        'idx_stores_business_id',
        'idx_stores_qr_code',
        'idx_stores_active',
        'idx_user_accounts_business',
        'idx_transactions_tolerance',
        'idx_feedback_sessions_store_time',
        'idx_verification_business_week'
      ]);

    expect(error).toBeNull();
    expect(indexes?.length).toBeGreaterThanOrEqual(7);
  });

  test('should have triggers configured', async () => {
    const { data: triggers, error } = await testClient
      .from('information_schema.triggers')
      .select('trigger_name')
      .eq('trigger_schema', 'public')
      .in('trigger_name', [
        'context_score_update',
        'update_businesses_updated_at',
        'update_user_accounts_updated_at',
        'update_stores_updated_at'
      ]);

    expect(error).toBeNull();
    expect(triggers).toHaveLength(4);
  });

  test('should validate tolerance range constraints', async () => {
    // Test time range constraint (4 minutes = 240 seconds)
    const { error: timeError } = await testClient
      .from('transactions')
      .insert({
        store_id: '123e4567-e89b-12d3-a456-426614174000',
        customer_time_range: '[2023-01-01 10:00:00, 2023-01-01 10:03:00)', // 3 minutes - should fail
        customer_amount_range: '[100.0, 104.0]',
        verification_status: 'pending'
      });

    expect(timeError).not.toBeNull();
    expect(timeError?.message).toContain('valid_time_range');

    // Test amount range constraint (4 SEK)
    const { error: amountError } = await testClient
      .from('transactions')
      .insert({
        store_id: '123e4567-e89b-12d3-a456-426614174000',
        customer_time_range: '[2023-01-01 10:00:00, 2023-01-01 10:04:00)',
        customer_amount_range: '[100.0, 103.0]', // 3 SEK - should fail
        verification_status: 'pending'
      });

    expect(amountError).not.toBeNull();
    expect(amountError?.message).toContain('valid_amount_range');
  });
});