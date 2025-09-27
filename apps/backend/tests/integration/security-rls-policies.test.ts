import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { supabase, adminSupabase } from '../../src/config/supabase';
import { createTestUser, createTestAdmin, createTestStore } from '../utils/test-helpers';
import { RLSPolicyService } from '../../src/services/security/rlsPolicyService';

describe('RLS Policy Enforcement Integration', () => {
  let testUser: any;
  let testAdmin: any;
  let testStore: any;
  let rlsPolicyService: RLSPolicyService;

  beforeAll(async () => {
    rlsPolicyService = new RLSPolicyService();
    testAdmin = await createTestAdmin();
    testUser = await createTestUser();
    testStore = await createTestStore(testAdmin.id);
  });

  afterAll(async () => {
    // Cleanup test data
    await adminSupabase.from('stores').delete().eq('id', testStore.id);
    await adminSupabase.from('customers').delete().eq('id', testUser.id);
    await adminSupabase.from('admin_accounts').delete().eq('id', testAdmin.id);
  });

  beforeEach(async () => {
    // Reset any modified policies
  });

  describe('Customer Data Access Policies', () => {
    it('should enforce customer can only access their own feedback', async () => {
      // Create feedback for test user
      const { data: feedback } = await adminSupabase
        .from('feedback_submissions')
        .insert({
          customer_id: testUser.id,
          store_id: testStore.id,
          feedback_content: 'Test feedback',
          feedback_type: 'improvement'
        })
        .select()
        .single();

      // Create feedback for another user
      const anotherUser = await createTestUser();
      const { data: otherFeedback } = await adminSupabase
        .from('feedback_submissions')
        .insert({
          customer_id: anotherUser.id,
          store_id: testStore.id,
          feedback_content: 'Other user feedback',
          feedback_type: 'improvement'
        })
        .select()
        .single();

      // Test user should only see their own feedback
      const userClient = supabase.from('feedback_submissions');
      await userClient.auth.signInWithPassword({
        email: testUser.email,
        password: testUser.password
      });

      const { data: userFeedback, error } = await userClient
        .select('*')
        .eq('customer_id', testUser.id);

      expect(error).toBeNull();
      expect(userFeedback).toHaveLength(1);
      expect(userFeedback[0].id).toBe(feedback.id);

      // Should not be able to access other user's feedback
      const { data: otherUserData } = await userClient
        .select('*')
        .eq('customer_id', anotherUser.id);

      expect(otherUserData).toHaveLength(0);

      // Cleanup
      await adminSupabase.from('customers').delete().eq('id', anotherUser.id);
    });

    it('should enforce business can only access their store data', async () => {
      // Create business account and another business
      const businessAccount = await createTestAdmin(); // Reuse for simplicity
      const otherBusiness = await createTestAdmin();
      
      const businessStore = await createTestStore(businessAccount.id);
      const otherStore = await createTestStore(otherBusiness.id);

      // Business should only access their own store
      const businessClient = supabase.from('stores');
      await businessClient.auth.signInWithPassword({
        email: businessAccount.email,
        password: businessAccount.password
      });

      const { data: businessStores } = await businessClient
        .select('*')
        .eq('business_id', businessAccount.id);

      expect(businessStores).toHaveLength(1);
      expect(businessStores[0].id).toBe(businessStore.id);

      // Should not access other business stores
      const { data: otherStores } = await businessClient
        .select('*')
        .eq('business_id', otherBusiness.id);

      expect(otherStores).toHaveLength(0);

      // Cleanup
      await adminSupabase.from('stores').delete().eq('id', businessStore.id);
      await adminSupabase.from('stores').delete().eq('id', otherStore.id);
      await adminSupabase.from('admin_accounts').delete().eq('id', businessAccount.id);
      await adminSupabase.from('admin_accounts').delete().eq('id', otherBusiness.id);
    });
  });

  describe('Admin Access Policies', () => {
    it('should enforce admin can access all data when authenticated', async () => {
      // Admin should have access to all stores
      const adminClient = supabase.from('stores');
      await adminClient.auth.signInWithPassword({
        email: testAdmin.email,
        password: testAdmin.password
      });

      const { data: allStores, error } = await adminClient.select('*');

      expect(error).toBeNull();
      expect(Array.isArray(allStores)).toBe(true);
    });

    it('should block non-admin access to sensitive tables', async () => {
      // Regular user should not access audit logs
      const userClient = supabase.from('audit_logs');
      await userClient.auth.signInWithPassword({
        email: testUser.email,
        password: testUser.password
      });

      const { data, error } = await userClient.select('*');

      expect(error).not.toBeNull();
      expect(data).toBeNull();
    });
  });

  describe('Fraud Detection Policies', () => {
    it('should enforce fraud scores are only accessible by admins and system', async () => {
      // Create fraud score
      const { data: feedback } = await adminSupabase
        .from('feedback_submissions')
        .insert({
          customer_id: testUser.id,
          store_id: testStore.id,
          feedback_content: 'Test feedback',
          feedback_type: 'improvement'
        })
        .select()
        .single();

      const { data: fraudScore } = await adminSupabase
        .from('fraud_scores')
        .insert({
          feedback_id: feedback.id,
          overall_score: 85,
          context_score: 90,
          keyword_score: 80,
          behavioral_score: 85,
          transaction_score: 95
        })
        .select()
        .single();

      // Customer should not access fraud scores
      const userClient = supabase.from('fraud_scores');
      await userClient.auth.signInWithPassword({
        email: testUser.email,
        password: testUser.password
      });

      const { data, error } = await userClient
        .select('*')
        .eq('feedback_id', feedback.id);

      expect(error).not.toBeNull();
      expect(data).toBeNull();

      // Admin should access fraud scores
      const adminClient = supabase.from('fraud_scores');
      await adminClient.auth.signInWithPassword({
        email: testAdmin.email,
        password: testAdmin.password
      });

      const { data: adminData, error: adminError } = await adminClient
        .select('*')
        .eq('feedback_id', feedback.id);

      expect(adminError).toBeNull();
      expect(adminData).toHaveLength(1);

      // Cleanup
      await adminSupabase.from('fraud_scores').delete().eq('id', fraudScore.id);
      await adminSupabase.from('feedback_submissions').delete().eq('id', feedback.id);
    });
  });

  describe('Policy Violation Logging', () => {
    it('should log RLS policy violations', async () => {
      const initialAuditCount = await adminSupabase
        .from('audit_logs')
        .select('count(*)', { count: 'exact' });

      // Attempt unauthorized access
      const userClient = supabase.from('encryption_keys');
      await userClient.auth.signInWithPassword({
        email: testUser.email,
        password: testUser.password
      });

      const { error } = await userClient.select('*');
      expect(error).not.toBeNull();

      // Check if violation was logged
      const finalAuditCount = await adminSupabase
        .from('audit_logs')
        .select('count(*)', { count: 'exact' });

      expect(finalAuditCount.count).toBeGreaterThan(initialAuditCount.count || 0);

      // Check specific audit log entry
      const { data: auditLogs } = await adminSupabase
        .from('audit_logs')
        .select('*')
        .eq('event_type', 'security_violation')
        .eq('user_id', testUser.id)
        .order('created_at', { ascending: false })
        .limit(1);

      expect(auditLogs).toHaveLength(1);
      expect(auditLogs[0].result_status).toBe('blocked');
    });
  });

  describe('Dynamic Policy Management', () => {
    it('should enforce dynamically updated policies', async () => {
      // Create a new RLS policy
      const policyData = {
        policy_name: 'test_dynamic_policy',
        table_name: 'test_table',
        operation: 'SELECT',
        role_type: 'customer',
        policy_expression: 'auth.uid() = user_id',
        data_classification: 'internal',
        created_by: testAdmin.id
      };

      const createdPolicy = await rlsPolicyService.createPolicy(policyData);
      expect(createdPolicy).toBeDefined();
      expect(createdPolicy.policy_name).toBe('test_dynamic_policy');

      // Update the policy
      const updatedPolicy = await rlsPolicyService.updatePolicy(createdPolicy.id, {
        policy_expression: 'auth.uid() = user_id AND is_active = true'
      });

      expect(updatedPolicy.policy_expression).toContain('is_active = true');

      // Disable the policy
      await rlsPolicyService.updatePolicy(createdPolicy.id, { is_active: false });

      const disabledPolicy = await rlsPolicyService.getPolicyById(createdPolicy.id);
      expect(disabledPolicy.is_active).toBe(false);

      // Cleanup
      await adminSupabase.from('rls_policies').delete().eq('id', createdPolicy.id);
    });
  });
});