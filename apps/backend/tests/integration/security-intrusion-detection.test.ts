import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { adminSupabase } from '../../src/config/supabase';
import { IntrusionDetectionService } from '../../src/services/security/intrusionDetectionService';
import { AuditLoggingService } from '../../src/services/security/auditLoggingService';
import { createTestAdmin, createTestUser } from '../utils/test-helpers';
import { Request } from 'express';

describe('Intrusion Detection Workflow Integration', () => {
  let testAdmin: any;
  let testUser: any;
  let intrusionService: IntrusionDetectionService;
  let auditService: AuditLoggingService;

  beforeAll(async () => {
    intrusionService = new IntrusionDetectionService();
    auditService = new AuditLoggingService();
    testAdmin = await createTestAdmin();
    testUser = await createTestUser();
  });

  afterAll(async () => {
    // Cleanup test data
    await adminSupabase.from('customers').delete().eq('id', testUser.id);
    await adminSupabase.from('admin_accounts').delete().eq('id', testAdmin.id);
    
    // Cleanup test intrusion events
    await adminSupabase.from('intrusion_events')
      .delete()
      .like('target_resource', 'test-%');
  });

  beforeEach(async () => {
    // Reset any state if needed
  });

  describe('Brute Force Attack Detection', () => {
    it('should detect and log brute force authentication attacks', async () => {
      const attackerIp = '203.0.113.200';
      const targetResource = '/api/auth/login';
      
      // Simulate multiple failed login attempts
      const attempts = Array.from({ length: 8 }, (_, i) => ({
        ip: attackerIp,
        userAgent: 'Mozilla/5.0 Attack Bot',
        timestamp: new Date(Date.now() - (7 - i) * 1000).toISOString(), // 1 second apart
        success: false,
        resource: targetResource
      }));

      // Process each attempt through intrusion detection
      const detectionResults = [];
      for (const attempt of attempts) {
        const mockRequest = {
          ip: attempt.ip,
          headers: { 'user-agent': attempt.userAgent },
          path: attempt.resource,
          method: 'POST',
          body: { email: 'victim@example.com', password: 'wrong' }
        } as Request;

        const result = await intrusionService.analyzeRequest(mockRequest, {
          success: attempt.success,
          userId: testUser.id
        });

        detectionResults.push(result);
      }

      // Should detect brute force pattern
      const lastResult = detectionResults[detectionResults.length - 1];
      expect(lastResult.threatLevel).toBeGreaterThanOrEqual(7);
      expect(lastResult.detectedThreats).toContain('brute_force');

      // Check if intrusion event was created
      const { data: intrusionEvents } = await adminSupabase
        .from('intrusion_events')
        .select('*')
        .eq('source_ip', attackerIp)
        .eq('event_type', 'brute_force')
        .order('first_detected_at', { ascending: false })
        .limit(1);

      expect(intrusionEvents).toHaveLength(1);
      expect(intrusionEvents[0].severity_level).toBeGreaterThanOrEqual(7);
      expect(intrusionEvents[0].detection_method).toBe('pattern_analysis');
    });

    it('should implement progressive blocking for repeated attacks', async () => {
      const persistentAttackerIp = '198.51.100.50';
      
      // First wave of attacks
      for (let i = 0; i < 10; i++) {
        const mockRequest = {
          ip: persistentAttackerIp,
          headers: { 'user-agent': 'Persistent Bot' },
          path: '/api/auth/login',
          method: 'POST',
          body: { email: 'target@example.com', password: 'wrong' + i }
        } as Request;

        await intrusionService.analyzeRequest(mockRequest, { success: false });
      }

      // Check if progressive blocking is implemented
      const blockingStatus = await intrusionService.getBlockingStatus(persistentAttackerIp);
      
      expect(blockingStatus.isBlocked).toBe(true);
      expect(blockingStatus.blockDuration).toBeGreaterThan(0);
      expect(blockingStatus.escalationLevel).toBeGreaterThanOrEqual(1);

      // Verify intrusion event was escalated
      const { data: escalatedEvents } = await adminSupabase
        .from('intrusion_events')
        .select('*')
        .eq('source_ip', persistentAttackerIp)
        .eq('event_type', 'brute_force')
        .gte('severity_level', 8);

      expect(escalatedEvents.length).toBeGreaterThan(0);
    });
  });

  describe('SQL Injection Detection', () => {
    it('should detect SQL injection attempts in request parameters', async () => {
      const attackerIp = '192.0.2.100';
      const sqlPayloads = [
        "'; DROP TABLE users; --",
        "' UNION SELECT * FROM admin_accounts --",
        "' OR '1'='1",
        "admin'; INSERT INTO users VALUES('hacker','pass'); --"
      ];

      const detectionResults = [];
      
      for (const payload of sqlPayloads) {
        const mockRequest = {
          ip: attackerIp,
          headers: { 'user-agent': 'SQL Injection Bot' },
          path: '/api/stores/search',
          method: 'GET',
          query: { q: payload },
          body: {}
        } as Request;

        const result = await intrusionService.analyzeRequest(mockRequest, { success: false });
        detectionResults.push(result);
      }

      // Should detect SQL injection patterns
      const sqlInjectionDetected = detectionResults.some(result => 
        result.detectedThreats.includes('sql_injection') && result.threatLevel >= 8
      );

      expect(sqlInjectionDetected).toBe(true);

      // Check if high-severity intrusion event was created
      const { data: sqlInjectionEvents } = await adminSupabase
        .from('intrusion_events')
        .select('*')
        .eq('source_ip', attackerIp)
        .eq('event_type', 'sql_injection')
        .gte('severity_level', 8);

      expect(sqlInjectionEvents.length).toBeGreaterThan(0);
      expect(sqlInjectionEvents[0].attack_pattern).toContain('SQL');
    });

    it('should trigger immediate blocking for severe SQL injection attempts', async () => {
      const severeAttackerIp = '203.0.113.150';
      const severePayload = "'; DROP DATABASE vocilia; SHUTDOWN; --";

      const mockRequest = {
        ip: severeAttackerIp,
        headers: { 'user-agent': 'Advanced SQL Injection Tool' },
        path: '/api/admin/stores',
        method: 'POST',
        body: { name: severePayload }
      } as Request;

      const result = await intrusionService.analyzeRequest(mockRequest, { success: false });

      expect(result.threatLevel).toBe(10);
      expect(result.detectedThreats).toContain('sql_injection');
      expect(result.immediateBlock).toBe(true);

      // Verify immediate blocking was implemented
      const blockingStatus = await intrusionService.getBlockingStatus(severeAttackerIp);
      expect(blockingStatus.isBlocked).toBe(true);
      expect(blockingStatus.escalationLevel).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Privilege Escalation Detection', () => {
    it('should detect unauthorized access to admin endpoints', async () => {
      const unauthorizedIp = '10.0.0.200';
      const adminEndpoints = [
        '/api/admin/users',
        '/api/admin/stores/bulk-update',
        '/api/admin/audit-logs',
        '/api/admin/system/config'
      ];

      const detectionResults = [];

      for (const endpoint of adminEndpoints) {
        const mockRequest = {
          ip: unauthorizedIp,
          headers: { 
            'user-agent': 'Unauthorized Client',
            'authorization': 'Bearer fake-token'
          },
          path: endpoint,
          method: 'GET',
          body: {}
        } as Request;

        const result = await intrusionService.analyzeRequest(mockRequest, { 
          success: false,
          userId: testUser.id, // Regular user trying to access admin endpoints
          userRole: 'customer'
        });

        detectionResults.push(result);
      }

      // Should detect privilege escalation attempts
      const escalationDetected = detectionResults.some(result =>
        result.detectedThreats.includes('privilege_escalation') && result.threatLevel >= 6
      );

      expect(escalationDetected).toBe(true);

      // Check intrusion event creation
      const { data: escalationEvents } = await adminSupabase
        .from('intrusion_events')
        .select('*')
        .eq('source_ip', unauthorizedIp)
        .eq('event_type', 'privilege_escalation');

      expect(escalationEvents.length).toBeGreaterThan(0);
    });

    it('should detect session hijacking attempts', async () => {
      const hijackerIp = '172.16.0.50';
      const victimSessionToken = 'valid-session-token-123';

      // Legitimate request from original IP
      await intrusionService.analyzeRequest({
        ip: '192.168.1.10',
        headers: { 
          'authorization': `Bearer ${victimSessionToken}`,
          'user-agent': 'Legitimate Browser'
        },
        path: '/api/customer/profile',
        method: 'GET'
      } as Request, { 
        success: true,
        userId: testUser.id,
        sessionToken: victimSessionToken
      });

      // Same session token from different IP (potential hijacking)
      const hijackingResult = await intrusionService.analyzeRequest({
        ip: hijackerIp,
        headers: { 
          'authorization': `Bearer ${victimSessionToken}`,
          'user-agent': 'Different Browser'
        },
        path: '/api/customer/feedback',
        method: 'POST'
      } as Request, { 
        success: false,
        userId: testUser.id,
        sessionToken: victimSessionToken
      });

      expect(hijackingResult.detectedThreats).toContain('session_hijacking');
      expect(hijackingResult.threatLevel).toBeGreaterThanOrEqual(8);

      // Check intrusion event
      const { data: hijackingEvents } = await adminSupabase
        .from('intrusion_events')
        .select('*')
        .eq('source_ip', hijackerIp)
        .eq('event_type', 'authentication_bypass');

      expect(hijackingEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Rate Limiting and DDoS Protection', () => {
    it('should detect and mitigate high-frequency request patterns', async () => {
      const ddosAttackerIp = '198.51.100.200';
      const targetEndpoint = '/api/feedback/submit';

      // Simulate high-frequency requests
      const requests = Array.from({ length: 100 }, (_, i) => ({
        ip: ddosAttackerIp,
        headers: { 'user-agent': 'DDoS Bot' },
        path: targetEndpoint,
        method: 'POST',
        body: { content: `Spam feedback ${i}` }
      }));

      const detectionResults = [];
      for (const requestData of requests.slice(0, 50)) { // Test with first 50
        const result = await intrusionService.analyzeRequest(requestData as Request, {
          success: true // Some succeed before detection
        });
        detectionResults.push(result);
      }

      // Should detect rate limit violations
      const rateLimitViolation = detectionResults.some(result =>
        result.detectedThreats.includes('rate_limit_violation') && result.threatLevel >= 6
      );

      expect(rateLimitViolation).toBe(true);

      // Check rate limiting status
      const rateLimitStatus = await intrusionService.getRateLimitStatus(
        ddosAttackerIp, 
        targetEndpoint
      );

      expect(rateLimitStatus.isLimited).toBe(true);
      expect(rateLimitStatus.remainingRequests).toBeLessThan(10);
    });

    it('should implement progressive rate limiting', async () => {
      const progressiveAttackerIp = '203.0.113.75';
      
      // First phase: Normal rate limiting
      for (let i = 0; i < 20; i++) {
        await intrusionService.analyzeRequest({
          ip: progressiveAttackerIp,
          path: '/api/stores/search',
          method: 'GET'
        } as Request, { success: true });
      }

      const firstPhaseStatus = await intrusionService.getRateLimitStatus(
        progressiveAttackerIp,
        '/api/stores/search'
      );

      expect(firstPhaseStatus.isLimited).toBe(true);

      // Second phase: Continued violations should escalate
      for (let i = 0; i < 30; i++) {
        await intrusionService.analyzeRequest({
          ip: progressiveAttackerIp,
          path: '/api/stores/search',
          method: 'GET'
        } as Request, { success: false });
      }

      const escalatedStatus = await intrusionService.getRateLimitStatus(
        progressiveAttackerIp,
        '/api/stores/search'
      );

      expect(escalatedStatus.blockDuration).toBeGreaterThan(firstPhaseStatus.blockDuration || 0);
    });
  });

  describe('Automated Response and Alerting', () => {
    it('should trigger automated responses for high-severity threats', async () => {
      const highThreatIp = '192.0.2.250';

      // Create high-severity attack
      const criticalAttack = await intrusionService.analyzeRequest({
        ip: highThreatIp,
        headers: { 'user-agent': 'Critical Threat Actor' },
        path: '/api/admin/system/destroy',
        method: 'DELETE',
        body: { confirm: "'; DROP DATABASE vocilia; --" }
      } as Request, { 
        success: false,
        threatLevel: 10
      });

      expect(criticalAttack.threatLevel).toBe(10);
      expect(criticalAttack.immediateBlock).toBe(true);

      // Check automated response was recorded
      const { data: criticalEvent } = await adminSupabase
        .from('intrusion_events')
        .select('*')
        .eq('source_ip', highThreatIp)
        .gte('severity_level', 9)
        .order('first_detected_at', { ascending: false })
        .limit(1);

      expect(criticalEvent).toHaveLength(1);
      expect(criticalEvent[0].automated_response).toBeDefined();
      expect(criticalEvent[0].automated_response.actions).toContain('immediate_block');
      expect(criticalEvent[0].admin_notified).toBe(true);
    });

    it('should create comprehensive incident reports', async () => {
      const incidentIp = '10.0.0.100';
      const incidentId = 'incident-' + Date.now();

      // Create series of related attacks
      const attackSequence = [
        { type: 'brute_force', path: '/api/auth/login' },
        { type: 'privilege_escalation', path: '/api/admin/users' },
        { type: 'data_exfiltration', path: '/api/customer/export' }
      ];

      for (const attack of attackSequence) {
        await intrusionService.analyzeRequest({
          ip: incidentIp,
          path: attack.path,
          method: attack.path.includes('export') ? 'GET' : 'POST',
          headers: { 'incident-id': incidentId }
        } as Request, { success: false });
      }

      // Generate incident report
      const incidentReport = await intrusionService.generateIncidentReport(incidentIp, {
        timeWindow: '1h',
        includeContext: true
      });

      expect(incidentReport).toBeDefined();
      expect(incidentReport.sourceIp).toBe(incidentIp);
      expect(incidentReport.eventCount).toBeGreaterThanOrEqual(3);
      expect(incidentReport.threatTypes.length).toBeGreaterThanOrEqual(2);
      expect(incidentReport.riskScore).toBeGreaterThan(70);
      expect(incidentReport.recommendedActions).toBeDefined();
    });
  });

  describe('Integration with Audit Logging', () => {
    it('should create audit logs for all intrusion detection events', async () => {
      const auditTestIp = '172.16.0.100';
      const correlationId = 'audit-integration-' + Date.now();

      // Create intrusion event
      await intrusionService.analyzeRequest({
        ip: auditTestIp,
        path: '/api/sensitive/data',
        method: 'GET',
        headers: { 'correlation-id': correlationId }
      } as Request, { 
        success: false,
        correlationId
      });

      // Check if audit log was created
      const { data: auditLogs } = await adminSupabase
        .from('audit_logs')
        .select('*')
        .eq('correlation_id', correlationId)
        .eq('event_type', 'security_violation');

      expect(auditLogs.length).toBeGreaterThan(0);
      expect(auditLogs[0].action_performed).toContain('intrusion');
      expect(auditLogs[0].ip_address).toBe(auditTestIp);
    });

    it('should maintain correlation between intrusion events and audit logs', async () => {
      const correlatedIp = '192.168.100.50';
      const correlationId = 'correlation-test-' + Date.now();

      // Create coordinated attack with correlation ID
      await intrusionService.analyzeRequest({
        ip: correlatedIp,
        path: '/api/auth/admin',
        method: 'POST',
        headers: { 'x-correlation-id': correlationId }
      } as Request, { 
        success: false,
        correlationId,
        attackPhase: 'initial_probe'
      });

      await intrusionService.analyzeRequest({
        ip: correlatedIp,
        path: '/api/admin/escalate',
        method: 'PUT',
        headers: { 'x-correlation-id': correlationId }
      } as Request, { 
        success: false,
        correlationId,
        attackPhase: 'privilege_escalation'
      });

      // Check correlated events
      const correlatedEvents = await intrusionService.getCorrelatedEvents(correlationId);
      expect(correlatedEvents.length).toBe(2);
      expect(correlatedEvents.every(event => event.correlation_id === correlationId)).toBe(true);

      // Check audit logs correlation
      const { data: correlatedAuditLogs } = await adminSupabase
        .from('audit_logs')
        .select('*')
        .eq('correlation_id', correlationId)
        .eq('event_type', 'security_violation');

      expect(correlatedAuditLogs.length).toBeGreaterThanOrEqual(1);
    });
  });
});