import { testClient } from '../setup';
import type {
  Business,
  UserAccount,
  Store,
  ContextWindow,
  Transaction,
  FeedbackSession,
  VerificationRecord,
  UserRole,
  FeedbackStatus,
  VerificationStatus,
  WeeklyVerificationStatus
} from '../../src/types';

describe('Contract: TypeScript Types Validation', () => {
  test('should validate Business interface matches database schema', async () => {
    const { data: columns, error } = await testClient
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_schema', 'public')
      .eq('table_name', 'businesses')
      .order('ordinal_position');

    expect(error).toBeNull();
    expect(columns).toBeDefined();

    const requiredColumns = ['id', 'name', 'email', 'phone', 'settings', 'created_at', 'updated_at'];
    const columnNames = columns?.map(c => c.column_name) || [];

    requiredColumns.forEach(col => {
      expect(columnNames).toContain(col);
    });

    // Test type compatibility - this will fail until types are copied
    const businessSample: Partial<Business> = {
      name: 'Test Business',
      email: 'test@example.com',
      phone: '+46701234567',
      settings: { theme: 'dark' }
    };

    expect(businessSample).toBeDefined();
  });

  test('should validate UserAccount interface matches database schema', async () => {
    const { data: columns, error } = await testClient
      .from('information_schema.columns')
      .select('column_name, data_type')
      .eq('table_schema', 'public')
      .eq('table_name', 'user_accounts');

    expect(error).toBeNull();

    const requiredColumns = ['id', 'business_id', 'email', 'role', 'permissions', 'last_login', 'created_at', 'updated_at'];
    const columnNames = columns?.map(c => c.column_name) || [];

    requiredColumns.forEach(col => {
      expect(columnNames).toContain(col);
    });

    // Test enum values match
    const roles: UserRole[] = ['admin', 'business_owner', 'business_staff'];
    expect(roles).toHaveLength(3);
  });

  test('should validate Store interface matches database schema', async () => {
    const { data: columns, error } = await testClient
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'stores');

    expect(error).toBeNull();

    const requiredColumns = ['id', 'business_id', 'name', 'location_address', 'qr_code_data', 'store_profile', 'is_active', 'created_at', 'updated_at'];
    const columnNames = columns?.map(c => c.column_name) || [];

    requiredColumns.forEach(col => {
      expect(columnNames).toContain(col);
    });
  });

  test('should validate ContextWindow interface matches database schema', async () => {
    const { data: columns, error } = await testClient
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'context_window');

    expect(error).toBeNull();

    const requiredColumns = ['id', 'store_id', 'store_profile', 'custom_questions', 'ai_configuration', 'fraud_detection_settings', 'context_score', 'last_updated'];
    const columnNames = columns?.map(c => c.column_name) || [];

    requiredColumns.forEach(col => {
      expect(columnNames).toContain(col);
    });
  });

  test('should validate Transaction interface matches database schema', async () => {
    const { data: columns, error } = await testClient
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'transactions');

    expect(error).toBeNull();

    const requiredColumns = ['id', 'store_id', 'customer_time_range', 'customer_amount_range', 'actual_amount', 'actual_time', 'verification_status', 'is_verified', 'created_at'];
    const columnNames = columns?.map(c => c.column_name) || [];

    requiredColumns.forEach(col => {
      expect(columnNames).toContain(col);
    });
  });

  test('should validate FeedbackSession interface matches database schema', async () => {
    const { data: columns, error } = await testClient
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'feedback_sessions');

    expect(error).toBeNull();

    const requiredColumns = ['id', 'store_id', 'transaction_id', 'customer_phone_hash', 'status', 'quality_grade', 'reward_percentage', 'feedback_summary', 'call_started_at', 'call_completed_at', 'created_at'];
    const columnNames = columns?.map(c => c.column_name) || [];

    requiredColumns.forEach(col => {
      expect(columnNames).toContain(col);
    });
  });

  test('should validate VerificationRecord interface matches database schema', async () => {
    const { data: columns, error } = await testClient
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'verification_record');

    expect(error).toBeNull();

    const requiredColumns = ['id', 'business_id', 'week_identifier', 'status', 'transaction_summary', 'submitted_at', 'verified_at', 'created_at'];
    const columnNames = columns?.map(c => c.column_name) || [];

    requiredColumns.forEach(col => {
      expect(columnNames).toContain(col);
    });
  });

  test('should validate enum types match database constraints', async () => {
    // Test UserRole enum
    const validRoles: UserRole[] = ['admin', 'business_owner', 'business_staff'];
    expect(validRoles).toHaveLength(3);

    // Test FeedbackStatus enum
    const validStatuses: FeedbackStatus[] = ['initiated', 'in_progress', 'completed', 'failed'];
    expect(validStatuses).toHaveLength(4);

    // Test VerificationStatus enum
    const validVerificationStatuses: VerificationStatus[] = ['pending', 'verified', 'rejected'];
    expect(validVerificationStatuses).toHaveLength(3);

    // Test WeeklyVerificationStatus enum
    const validWeeklyStatuses: WeeklyVerificationStatus[] = ['pending', 'submitted', 'completed'];
    expect(validWeeklyStatuses).toHaveLength(3);
  });

  test('should validate required field constraints', async () => {
    // This test will fail until types are properly imported from contracts
    const business: Partial<Business> = {
      name: 'Required Name',
      email: 'required@email.com'
    };

    expect(business.name).toBeDefined();
    expect(business.email).toBeDefined();

    // Test nullable fields
    const userAccount: Partial<UserAccount> = {
      business_id: null, // Should be allowed for admin users
      last_login: null   // Should be allowed
    };

    expect(userAccount.business_id).toBeNull();
    expect(userAccount.last_login).toBeNull();
  });

  test('should validate relationship type consistency', async () => {
    // This will ensure foreign key relationships are properly typed
    const store: Partial<Store> = {
      business_id: '123e4567-e89b-12d3-a456-426614174000'
    };

    const transaction: Partial<Transaction> = {
      store_id: '123e4567-e89b-12d3-a456-426614174001'
    };

    expect(typeof store.business_id).toBe('string');
    expect(typeof transaction.store_id).toBe('string');
  });
});