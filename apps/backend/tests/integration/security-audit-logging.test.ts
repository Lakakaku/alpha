import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { adminSupabase } from '../../src/config/supabase';
import { AuditLoggingService } from '../../src/services/security/auditLoggingService';
import { createTestUser, createTestAdmin } from '../utils/test-helpers';

describe('Audit Logging System Integration', () => {
  let testUser: any;
  let testAdmin: any;
  let auditService: AuditLoggingService;

  beforeAll(async () => {
    auditService = new AuditLoggingService();
    testAdmin = await createTestAdmin();
    testUser = await createTestUser();
  });

  afterAll(async () => {
    // Cleanup test data
    await adminSupabase.from('customers').delete().eq('id', testUser.id);
    await adminSupabase.from('admin_accounts').delete().eq('id', testAdmin.id);
    
    // Note: audit_logs are immutable, so we don't delete them
  });

  beforeEach(async () => {
    // No setup needed for each test
  });

  describe('Audit Log Creation', () => {
    it('should create comprehensive audit log for user authentication', async () => {
      const correlationId = 'test-auth-' + Date.now();
      
      const auditData = {
        event_type: 'authentication' as const,
        user_id: testUser.id,
        user_type: 'customer' as const,
        action_performed: 'login_attempt',
        ip_address: '192.168.1.100',
        user_agent: 'Mozilla/5.0 Test Browser',
        correlation_id: correlationId,
        result_status: 'success' as const,
        event_metadata: {
          login_method: 'password',
          session_duration: '2h',
          device_info: 'mobile'
        }
      };

      const auditLog = await auditService.logEvent(auditData);

      expect(auditLog.id).toBeDefined();
      expect(auditLog.event_type).toBe('authentication');
      expect(auditLog.user_id).toBe(testUser.id);
      expect(auditLog.correlation_id).toBe(correlationId);
      expect(auditLog.event_metadata).toEqual(auditData.event_metadata);
      expect(auditLog.created_at).toBeDefined();
    });

    it('should create audit log for data access events', async () => {
      const correlationId = 'test-data-access-' + Date.now();

      const auditData = {
        event_type: 'data_access' as const,
        user_id: testAdmin.id,
        user_type: 'admin' as const,
        action_performed: 'view_customer_feedback',
        resource_type: 'feedback_submissions',
        resource_id: 'fb-123456',
        ip_address: '10.0.0.50',
        correlation_id: correlationId,
        result_status: 'success' as const,
        event_metadata: {
          query_filters: { store_id: 'store-123', date_range: '7d' },
          record_count: 25
        }
      };

      const auditLog = await auditService.logEvent(auditData);

      expect(auditLog.event_type).toBe('data_access');
      expect(auditLog.resource_type).toBe('feedback_submissions');
      expect(auditLog.resource_id).toBe('fb-123456');
      expect(auditLog.action_performed).toBe('view_customer_feedback');
    });

    it('should create audit log for security violations', async () => {
      const correlationId = 'test-violation-' + Date.now();

      const auditData = {
        event_type: 'security_violation' as const,
        user_id: testUser.id,
        user_type: 'customer' as const,
        action_performed: 'unauthorized_access_attempt',
        resource_type: 'admin_accounts',
        ip_address: '203.0.113.42',
        correlation_id: correlationId,
        result_status: 'blocked' as const,
        event_metadata: {
          violation_type: 'privilege_escalation',
          blocked_action: 'SELECT admin_accounts',
          rls_policy: 'admin_only_policy'
        }
      };

      const auditLog = await auditService.logEvent(auditData);

      expect(auditLog.event_type).toBe('security_violation');
      expect(auditLog.result_status).toBe('blocked');
      expect(auditLog.event_metadata.violation_type).toBe('privilege_escalation');
    });

    it('should create audit log for fraud detection events', async () => {
      const correlationId = 'test-fraud-' + Date.now();

      const auditData = {
        event_type: 'fraud_detection' as const,
        user_id: testUser.id,
        user_type: 'customer' as const,
        action_performed: 'fraud_score_calculated',
        resource_type: 'feedback_submissions',
        resource_id: 'feedback-789',
        correlation_id: correlationId,
        result_status: 'warning' as const,
        event_metadata: {
          fraud_score: 65,
          triggered_rules: ['keyword_detection', 'behavioral_pattern'],
          analysis_engine: 'gpt4-omini',
          legitimacy_score: 45
        }
      };

      const auditLog = await auditService.logEvent(auditData);

      expect(auditLog.event_type).toBe('fraud_detection');
      expect(auditLog.result_status).toBe('warning');
      expect(auditLog.event_metadata.fraud_score).toBe(65);
    });
  });

  describe('Audit Log Querying', () => {
    it('should retrieve audit logs by user ID', async () => {
      // Create multiple audit logs for the test user
      const correlationId = 'test-query-user-' + Date.now();
      
      await Promise.all([
        auditService.logEvent({
          event_type: 'authentication',
          user_id: testUser.id,
          user_type: 'customer',
          action_performed: 'login',
          correlation_id: correlationId + '-1',
          result_status: 'success'
        }),
        auditService.logEvent({
          event_type: 'data_access',
          user_id: testUser.id,
          user_type: 'customer',
          action_performed: 'view_feedback',
          correlation_id: correlationId + '-2',
          result_status: 'success'
        })
      ]);

      const logs = await auditService.getLogsByUserId(testUser.id, { limit: 10 });

      expect(logs.length).toBeGreaterThanOrEqual(2);
      expect(logs.every(log => log.user_id === testUser.id)).toBe(true);
    });

    it('should retrieve audit logs by correlation ID', async () => {
      const correlationId = 'test-correlation-' + Date.now();
      
      // Create related events with same correlation ID
      await Promise.all([
        auditService.logEvent({
          event_type: 'authentication',
          user_id: testUser.id,
          user_type: 'customer',
          action_performed: 'login_start',
          correlation_id: correlationId,
          result_status: 'success'
        }),
        auditService.logEvent({
          event_type: 'authentication',
          user_id: testUser.id,
          user_type: 'customer',
          action_performed: 'session_created',
          correlation_id: correlationId,
          result_status: 'success'
        })
      ]);

      const logs = await auditService.getLogsByCorrelationId(correlationId);

      expect(logs).toHaveLength(2);
      expect(logs.every(log => log.correlation_id === correlationId)).toBe(true);
      expect(logs.map(log => log.action_performed).sort()).toEqual(['login_start', 'session_created']);
    });

    it('should filter audit logs by event type and date range', async () => {
      const startDate = new Date();
      startDate.setHours(startDate.getHours() - 1); // 1 hour ago

      const endDate = new Date();
      endDate.setHours(endDate.getHours() + 1); // 1 hour from now

      // Create audit log within date range
      await auditService.logEvent({
        event_type: 'admin_action',
        user_id: testAdmin.id,
        user_type: 'admin',
        action_performed: 'test_admin_action',
        correlation_id: 'test-filter-' + Date.now(),
        result_status: 'success'
      });

      const logs = await auditService.getLogsByEventType('admin_action', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });

      expect(logs.length).toBeGreaterThan(0);
      expect(logs.every(log => log.event_type === 'admin_action')).toBe(true);
      expect(logs.every(log => {
        const logDate = new Date(log.created_at);
        return logDate >= startDate && logDate <= endDate;
      })).toBe(true);
    });
  });

  describe('Security Event Analysis', () => {
    it('should analyze security patterns from audit logs', async () => {
      const correlationBase = 'test-pattern-' + Date.now();
      
      // Create a pattern of failed login attempts
      await Promise.all([
        auditService.logEvent({
          event_type: 'authentication',
          user_id: testUser.id,
          user_type: 'customer',
          action_performed: 'login_attempt',
          ip_address: '192.168.1.100',
          correlation_id: correlationBase + '-1',
          result_status: 'failure',
          event_metadata: { failure_reason: 'invalid_password' }
        }),
        auditService.logEvent({
          event_type: 'authentication',
          user_id: testUser.id,
          user_type: 'customer',
          action_performed: 'login_attempt',
          ip_address: '192.168.1.100',
          correlation_id: correlationBase + '-2',
          result_status: 'failure',
          event_metadata: { failure_reason: 'invalid_password' }
        }),
        auditService.logEvent({
          event_type: 'authentication',
          user_id: testUser.id,
          user_type: 'customer',
          action_performed: 'login_attempt',
          ip_address: '192.168.1.100',
          correlation_id: correlationBase + '-3',
          result_status: 'failure',
          event_metadata: { failure_reason: 'invalid_password' }
        })
      ]);

      const analysis = await auditService.analyzeSecurityPatterns({
        userId: testUser.id,
        timeWindow: '1h',
        eventTypes: ['authentication']
      });

      expect(analysis).toBeDefined();
      expect(analysis.totalEvents).toBeGreaterThanOrEqual(3);
      expect(analysis.failureRate).toBeGreaterThan(0);
      expect(analysis.suspiciousPatterns).toBeDefined();
    });

    it('should detect brute force attack patterns', async () => {
      const attackerIp = '203.0.113.100';
      const correlationBase = 'test-brute-force-' + Date.now();

      // Simulate brute force attack
      const bruteForceAttempts = Array.from({ length: 10 }, (_, i) => 
        auditService.logEvent({
          event_type: 'authentication',
          user_id: testUser.id,
          user_type: 'customer',
          action_performed: 'login_attempt',
          ip_address: attackerIp,
          correlation_id: correlationBase + '-' + i,
          result_status: 'failure',
          event_metadata: { failure_reason: 'invalid_credentials' }
        })
      );

      await Promise.all(bruteForceAttempts);

      const bruteForcePattern = await auditService.detectBruteForcePattern(attackerIp, '10m');

      expect(bruteForcePattern.isDetected).toBe(true);
      expect(bruteForcePattern.attemptCount).toBeGreaterThanOrEqual(10);
      expect(bruteForcePattern.sourceIp).toBe(attackerIp);
      expect(bruteForcePattern.riskScore).toBeGreaterThan(70);
    });
  });

  describe('Audit Log Immutability', () => {
    it('should prevent modification of existing audit logs', async () => {
      // Create an audit log
      const auditLog = await auditService.logEvent({
        event_type: 'data_modification',
        user_id: testAdmin.id,
        user_type: 'admin',
        action_performed: 'update_store_info',
        correlation_id: 'test-immutable-' + Date.now(),
        result_status: 'success'
      });

      // Attempt to update the audit log (should fail)
      const updateAttempt = adminSupabase
        .from('audit_logs')
        .update({ action_performed: 'modified_action' })
        .eq('id', auditLog.id);

      await expect(updateAttempt).rejects.toThrow();
    });

    it('should prevent deletion of audit logs', async () => {
      // Create an audit log
      const auditLog = await auditService.logEvent({
        event_type: 'system_event',
        user_type: 'system',
        action_performed: 'automated_cleanup',
        correlation_id: 'test-delete-protection-' + Date.now(),
        result_status: 'success'
      });

      // Attempt to delete the audit log (should fail)
      const deleteAttempt = adminSupabase
        .from('audit_logs')
        .delete()
        .eq('id', auditLog.id);

      await expect(deleteAttempt).rejects.toThrow();

      // Verify the audit log still exists
      const { data: existingLog } = await adminSupabase
        .from('audit_logs')
        .select('*')
        .eq('id', auditLog.id)
        .single();

      expect(existingLog).toBeDefined();
      expect(existingLog.id).toBe(auditLog.id);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle high-volume audit log creation', async () => {
      const startTime = Date.now();
      const batchSize = 50;
      const correlationId = 'test-volume-' + Date.now();

      // Create many audit logs concurrently
      const auditPromises = Array.from({ length: batchSize }, (_, i) =>
        auditService.logEvent({
          event_type: 'data_access',
          user_id: testUser.id,
          user_type: 'customer',
          action_performed: 'bulk_test_' + i,
          correlation_id: correlationId + '-' + i,
          result_status: 'success'
        })
      );

      const auditLogs = await Promise.all(auditPromises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(auditLogs).toHaveLength(batchSize);
      expect(auditLogs.every(log => log.id)).toBe(true);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should efficiently query large audit log sets', async () => {
      const startTime = Date.now();

      // Query with pagination
      const logs = await auditService.getLogsByEventType('authentication', {
        limit: 100,
        offset: 0
      });

      const endTime = Date.now();
      const queryDuration = endTime - startTime;

      expect(Array.isArray(logs)).toBe(true);
      expect(queryDuration).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});