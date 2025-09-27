import { performance } from 'perf_hooks';
import { SecurityMonitoringService } from '../../src/services/security/securityMonitoringService';
import { AuditLoggingService } from '../../src/services/security/auditLoggingService';
import { IntrusionDetectionService } from '../../src/services/security/intrusionDetectionService';
import { RLSPolicyService } from '../../src/services/security/rlsPolicyService';
import type { 
  SecurityAlert,
  AuditLogEntry,
  IntrusionEvent,
  SecurityMetrics
} from '@vocilia/types';

// Mock all security services
jest.mock('../../src/services/security/auditLoggingService');
jest.mock('../../src/services/security/intrusionDetectionService');
jest.mock('../../src/services/security/rlsPolicyService');

const MockAuditLoggingService = AuditLoggingService as jest.MockedClass<typeof AuditLoggingService>;
const MockIntrusionDetectionService = IntrusionDetectionService as jest.MockedClass<typeof IntrusionDetectionService>;
const MockRLSPolicyService = RLSPolicyService as jest.MockedClass<typeof RLSPolicyService>;

describe('Security Monitoring Performance Tests', () => {
  let securityMonitoringService: SecurityMonitoringService;
  let mockAuditLogging: jest.Mocked<AuditLoggingService>;
  let mockIntrusionDetection: jest.Mocked<IntrusionDetectionService>;
  let mockRLSPolicy: jest.Mocked<RLSPolicyService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock instances
    mockAuditLogging = {
      getInstance: jest.fn().mockReturnThis(),
      logEvent: jest.fn(),
      logBulkEvents: jest.fn(),
      queryLogs: jest.fn(),
      detectAnomalies: jest.fn(),
      calculateRiskScore: jest.fn(),
      getStatistics: jest.fn(),
      archiveOldLogs: jest.fn(),
      getCorrelationTrail: jest.fn()
    } as any;
    
    mockIntrusionDetection = {
      detectIntrusion: jest.fn(),
      analyzeAccessPattern: jest.fn(),
      checkRateLimit: jest.fn(),
      blockSuspiciousIP: jest.fn(),
      getActiveThreats: jest.fn(),
      updateThreatIntelligence: jest.fn()
    } as any;
    
    mockRLSPolicy = {
      enforcePolicy: jest.fn(),
      validateAccess: jest.fn(),
      auditPolicyViolation: jest.fn(),
      getPolicyStatus: jest.fn(),
      updatePolicyConfiguration: jest.fn()
    } as any;
    
    // Mock singleton pattern
    MockAuditLoggingService.getInstance = jest.fn().mockReturnValue(mockAuditLogging);
    
    securityMonitoringService = new SecurityMonitoringService();
  });

  describe('Performance Requirements (<100ms)', () => {
    beforeEach(() => {
      // Mock fast responses from all services
      mockAuditLogging.logEvent.mockResolvedValue({ success: true, id: 'audit-123' });
      mockAuditLogging.detectAnomalies.mockResolvedValue({
        anomalies_detected: 0,
        risk_score: 10,
        recommendations: []
      });
      mockAuditLogging.getStatistics.mockResolvedValue({
        total_events: 1000,
        events_by_type: { authentication: 500, data_access: 300 },
        anomaly_rate: 0.02,
        avg_risk_score: 25
      });
      
      mockIntrusionDetection.detectIntrusion.mockResolvedValue({
        threat_detected: false,
        threat_level: 'low',
        automated_response: { action: 'monitor', details: 'Normal activity' }
      });
      
      mockRLSPolicy.enforcePolicy.mockResolvedValue({
        access_granted: true,
        policy_applied: 'customer_data_access',
        violations: []
      });
    });

    test('should generate security alerts within 100ms', async () => {
      const startTime = performance.now();
      
      const alerts = await securityMonitoringService.generateSecurityAlerts();
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      expect(executionTime).toBeLessThan(100);
      expect(alerts).toBeDefined();
      expect(Array.isArray(alerts)).toBe(true);
      
      console.log(`Security alerts generated in ${executionTime.toFixed(2)}ms`);
    }, 5000);

    test('should check system health within 100ms', async () => {
      const startTime = performance.now();
      
      const health = await securityMonitoringService.checkSystemHealth();
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      expect(executionTime).toBeLessThan(100);
      expect(health).toBeDefined();
      expect(health.status).toBeDefined();
      expect(health.timestamp).toBeDefined();
      
      console.log(`System health check completed in ${executionTime.toFixed(2)}ms`);
    }, 5000);

    test('should process security event logging within 100ms', async () => {
      const securityEvent = {
        event_type: 'authentication' as const,
        user_id: 'test-user-123',
        action_performed: 'login_attempt',
        ip_address: '192.168.1.100',
        user_agent: 'Mozilla/5.0...',
        result_status: 'success' as const,
        event_metadata: { login_method: 'password' }
      };
      
      const startTime = performance.now();
      
      await securityMonitoringService.logSecurityEvent(securityEvent);
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      expect(executionTime).toBeLessThan(100);
      expect(mockAuditLogging.logEvent).toHaveBeenCalledWith(securityEvent);
      
      console.log(`Security event logged in ${executionTime.toFixed(2)}ms`);
    }, 5000);

    test('should detect intrusions within 100ms', async () => {
      const suspiciousActivity = {
        ip_address: '192.168.1.200',
        user_agent: 'Suspicious Bot/1.0',
        request_pattern: 'sql_injection_attempt',
        timestamp: new Date().toISOString()
      };
      
      const startTime = performance.now();
      
      const result = await securityMonitoringService.detectIntrusion(suspiciousActivity);
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      expect(executionTime).toBeLessThan(100);
      expect(result).toBeDefined();
      expect(mockIntrusionDetection.detectIntrusion).toHaveBeenCalled();
      
      console.log(`Intrusion detection completed in ${executionTime.toFixed(2)}ms`);
    }, 5000);

    test('should validate RLS policies within 100ms', async () => {
      const accessRequest = {
        user_id: 'business-user-123',
        resource_type: 'customer_data',
        resource_id: 'customer-456',
        operation: 'SELECT',
        context: { user_type: 'business', store_id: 'store-789' }
      };
      
      const startTime = performance.now();
      
      const result = await securityMonitoringService.validateAccess(accessRequest);
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      expect(executionTime).toBeLessThan(100);
      expect(result).toBeDefined();
      expect(mockRLSPolicy.enforcePolicy).toHaveBeenCalled();
      
      console.log(`RLS policy validation completed in ${executionTime.toFixed(2)}ms`);
    }, 5000);
  });

  describe('Concurrent Security Operations Performance', () => {
    test('should maintain performance under concurrent security monitoring requests', async () => {
      const concurrentRequests = 20;
      
      const startTime = performance.now();
      
      const promises = Array(concurrentRequests).fill(null).map((_, index) => 
        securityMonitoringService.generateSecurityAlerts()
      );
      
      const results = await Promise.all(promises);
      
      const endTime = performance.now();
      const totalExecutionTime = endTime - startTime;
      const averageExecutionTime = totalExecutionTime / concurrentRequests;
      
      expect(results).toHaveLength(concurrentRequests);
      expect(averageExecutionTime).toBeLessThan(100);
      
      results.forEach(alerts => {
        expect(Array.isArray(alerts)).toBe(true);
      });
      
      console.log(`${concurrentRequests} concurrent security monitoring requests completed in ${totalExecutionTime.toFixed(2)}ms (avg: ${averageExecutionTime.toFixed(2)}ms per request)`);
    }, 10000);

    test('should handle rapid security event logging efficiently', async () => {
      const eventCount = 50;
      const events = Array(eventCount).fill(null).map((_, index) => ({
        event_type: 'data_access' as const,
        user_id: `user-${index}`,
        action_performed: `access_customer_data_${index}`,
        ip_address: `192.168.1.${100 + (index % 155)}`,
        result_status: 'success' as const,
        event_metadata: { resource_id: `customer-${index}` }
      }));
      
      const startTime = performance.now();
      
      const promises = events.map(event => 
        securityMonitoringService.logSecurityEvent(event)
      );
      
      await Promise.all(promises);
      
      const endTime = performance.now();
      const totalExecutionTime = endTime - startTime;
      const averageExecutionTime = totalExecutionTime / eventCount;
      
      expect(averageExecutionTime).toBeLessThan(100);
      expect(mockAuditLogging.logEvent).toHaveBeenCalledTimes(eventCount);
      
      console.log(`${eventCount} security events logged in ${totalExecutionTime.toFixed(2)}ms (avg: ${averageExecutionTime.toFixed(2)}ms per event)`);
    }, 10000);
  });

  describe('Service-Level Performance Benchmarks', () => {
    test('anomaly detection should complete within allocated time budget (50ms)', async () => {
      mockAuditLogging.detectAnomalies.mockImplementation(async () => {
        // Simulate actual processing time
        await new Promise(resolve => setTimeout(resolve, 40));
        return {
          anomalies_detected: 2,
          risk_score: 65,
          recommendations: ['Review authentication patterns', 'Monitor IP addresses']
        };
      });
      
      const startTime = performance.now();
      
      const result = await securityMonitoringService.detectAnomalies({
        time_window: '1 hour',
        event_types: ['authentication', 'authorization']
      });
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      expect(executionTime).toBeLessThan(50);
      expect(result.anomalies_detected).toBeDefined();
      
      console.log(`Anomaly detection completed in ${executionTime.toFixed(2)}ms`);
    }, 5000);

    test('threat intelligence updates should complete within allocated time budget (75ms)', async () => {
      mockIntrusionDetection.updateThreatIntelligence.mockImplementation(async () => {
        // Simulate actual processing time
        await new Promise(resolve => setTimeout(resolve, 60));
        return {
          updated_rules: 15,
          new_threat_signatures: 3,
          last_updated: new Date().toISOString()
        };
      });
      
      const startTime = performance.now();
      
      const result = await securityMonitoringService.updateThreatIntelligence();
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      expect(executionTime).toBeLessThan(75);
      expect(result.updated_rules).toBeDefined();
      
      console.log(`Threat intelligence update completed in ${executionTime.toFixed(2)}ms`);
    }, 5000);

    test('access pattern analysis should complete within allocated time budget (80ms)', async () => {
      const accessPatterns = Array(10).fill(null).map((_, index) => ({
        user_id: `user-${index}`,
        timestamp: new Date(Date.now() - index * 60000).toISOString(),
        resource_accessed: `resource-${index}`,
        ip_address: `192.168.1.${100 + index}`
      }));
      
      mockIntrusionDetection.analyzeAccessPattern.mockImplementation(async () => {
        // Simulate actual processing time
        await new Promise(resolve => setTimeout(resolve, 65));
        return {
          suspicious_patterns: 1,
          risk_level: 'medium',
          pattern_details: ['Unusual access time detected'],
          recommended_actions: ['Verify user identity']
        };
      });
      
      const startTime = performance.now();
      
      const result = await securityMonitoringService.analyzeAccessPatterns(accessPatterns);
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      expect(executionTime).toBeLessThan(80);
      expect(result.suspicious_patterns).toBeDefined();
      
      console.log(`Access pattern analysis completed in ${executionTime.toFixed(2)}ms`);
    }, 5000);
  });

  describe('Real-time Security Monitoring Performance', () => {
    test('should process security alerts in real-time (<2s requirement)', async () => {
      // Mock high-severity security event that should trigger immediate alert
      const criticalEvent = {
        event_type: 'security_violation' as const,
        user_id: 'suspicious-user',
        action_performed: 'privilege_escalation_attempt',
        ip_address: '10.0.0.1',
        result_status: 'blocked' as const,
        event_metadata: { 
          severity: 10,
          attack_type: 'privilege_escalation',
          automated_response: 'account_locked'
        }
      };
      
      mockAuditLogging.logEvent.mockImplementation(async () => {
        // Simulate real-time processing
        await new Promise(resolve => setTimeout(resolve, 100));
        return { success: true, id: 'critical-event-123' };
      });
      
      mockAuditLogging.detectAnomalies.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return {
          anomalies_detected: 1,
          risk_score: 95,
          recommendations: ['Immediate investigation required']
        };
      });
      
      const startTime = performance.now();
      
      // Simulate the real-time alert generation process
      await securityMonitoringService.logSecurityEvent(criticalEvent);
      const alerts = await securityMonitoringService.generateSecurityAlerts();
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      // Must be under 2 seconds (2000ms) for critical security events
      expect(executionTime).toBeLessThan(2000);
      expect(alerts).toBeDefined();
      
      console.log(`Critical security alert processed in ${executionTime.toFixed(2)}ms`);
    }, 5000);

    test('should handle security dashboard metrics updates efficiently', async () => {
      const metricsRequest = {
        time_range: '24h',
        include_trends: true,
        detailed_breakdown: true
      };
      
      mockAuditLogging.getStatistics.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 80));
        return {
          total_events: 5000,
          events_by_type: {
            authentication: 2000,
            data_access: 1500,
            admin_action: 800,
            security_violation: 25
          },
          anomaly_rate: 0.05,
          avg_risk_score: 30,
          hourly_breakdown: Array(24).fill(null).map((_, i) => ({
            hour: i,
            event_count: Math.floor(Math.random() * 200) + 50
          }))
        };
      });
      
      const startTime = performance.now();
      
      const metrics = await securityMonitoringService.getSecurityMetrics(metricsRequest);
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      expect(executionTime).toBeLessThan(100);
      expect(metrics.total_events).toBeDefined();
      expect(metrics.events_by_type).toBeDefined();
      
      console.log(`Security metrics dashboard updated in ${executionTime.toFixed(2)}ms`);
    }, 5000);
  });

  describe('Performance Under Security Load', () => {
    test('should maintain performance during security incident response', async () => {
      // Simulate multiple simultaneous security events
      const securityEvents = [
        {
          event_type: 'authentication' as const,
          action_performed: 'failed_login_attempt',
          result_status: 'failure' as const
        },
        {
          event_type: 'security_violation' as const,
          action_performed: 'brute_force_attack',
          result_status: 'blocked' as const
        },
        {
          event_type: 'intrusion_detected' as const,
          action_performed: 'sql_injection_attempt',
          result_status: 'blocked' as const
        }
      ].map((event, index) => ({
        ...event,
        user_id: `incident-user-${index}`,
        ip_address: `192.168.2.${100 + index}`,
        event_metadata: { incident_id: `inc-${index}`, severity: 8 }
      }));
      
      const startTime = performance.now();
      
      // Process all security events concurrently
      const eventPromises = securityEvents.map(event => 
        securityMonitoringService.logSecurityEvent(event)
      );
      
      // Generate alerts and detect intrusions simultaneously
      const alertsPromise = securityMonitoringService.generateSecurityAlerts();
      const intrusionChecks = securityEvents.map(event => 
        securityMonitoringService.detectIntrusion({
          ip_address: event.ip_address,
          user_agent: 'Suspicious Activity',
          request_pattern: event.action_performed,
          timestamp: new Date().toISOString()
        })
      );
      
      await Promise.all([
        ...eventPromises,
        alertsPromise,
        ...intrusionChecks
      ]);
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      // Should handle security incident response within 500ms
      expect(executionTime).toBeLessThan(500);
      
      console.log(`Security incident response handled in ${executionTime.toFixed(2)}ms`);
    }, 10000);

    test('should handle high-frequency security monitoring without degradation', async () => {
      const monitoringCycles = 100;
      const executionTimes: number[] = [];
      
      for (let i = 0; i < monitoringCycles; i++) {
        const startTime = performance.now();
        
        // Simulate a monitoring cycle
        await Promise.all([
          securityMonitoringService.checkSystemHealth(),
          securityMonitoringService.generateSecurityAlerts()
        ]);
        
        const endTime = performance.now();
        executionTimes.push(endTime - startTime);
      }
      
      const averageTime = executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length;
      const maxTime = Math.max(...executionTimes);
      const minTime = Math.min(...executionTimes);
      
      expect(averageTime).toBeLessThan(100);
      expect(maxTime).toBeLessThan(150); // Allow some variance for worst case
      
      console.log(`High-frequency monitoring - Avg: ${averageTime.toFixed(2)}ms, Min: ${minTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`);
    }, 15000);
  });

  describe('Memory and Resource Efficiency', () => {
    test('should handle extended security monitoring without memory leaks', async () => {
      const initialMemory = process.memoryUsage();
      
      // Run extended security monitoring simulation
      const monitoringTasks = Array(200).fill(null).map((_, index) => {
        return Promise.all([
          securityMonitoringService.logSecurityEvent({
            event_type: 'data_access',
            user_id: `memory-test-user-${index}`,
            action_performed: 'view_customer_data',
            ip_address: `10.0.1.${(index % 254) + 1}`,
            result_status: 'success'
          }),
          securityMonitoringService.checkSystemHealth()
        ]);
      });
      
      const startTime = performance.now();
      await Promise.all(monitoringTasks);
      const endTime = performance.now();
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const totalExecutionTime = endTime - startTime;
      
      // Memory increase should be reasonable (less than 30MB for 200 monitoring cycles)
      expect(memoryIncrease).toBeLessThan(30 * 1024 * 1024);
      
      // Total time should be efficient
      expect(totalExecutionTime).toBeLessThan(5000); // 5 seconds for 200 cycles
      
      console.log(`Extended monitoring - Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB, Total time: ${totalExecutionTime.toFixed(2)}ms`);
    }, 10000);
  });

  describe('Performance Monitoring and SLA Compliance', () => {
    test('should provide comprehensive performance metrics for SLA monitoring', async () => {
      const performanceTest = {
        alert_generation: async () => {
          const start = performance.now();
          await securityMonitoringService.generateSecurityAlerts();
          return performance.now() - start;
        },
        health_check: async () => {
          const start = performance.now();
          await securityMonitoringService.checkSystemHealth();
          return performance.now() - start;
        },
        event_logging: async () => {
          const start = performance.now();
          await securityMonitoringService.logSecurityEvent({
            event_type: 'authentication',
            user_id: 'sla-test-user',
            action_performed: 'login',
            result_status: 'success'
          });
          return performance.now() - start;
        },
        intrusion_detection: async () => {
          const start = performance.now();
          await securityMonitoringService.detectIntrusion({
            ip_address: '192.168.1.250',
            user_agent: 'Test Agent',
            request_pattern: 'normal_request',
            timestamp: new Date().toISOString()
          });
          return performance.now() - start;
        }
      };
      
      const results = await Promise.all([
        performanceTest.alert_generation(),
        performanceTest.health_check(),
        performanceTest.event_logging(),
        performanceTest.intrusion_detection()
      ]);
      
      const [alertTime, healthTime, eventTime, intrusionTime] = results;
      
      // All operations should meet the <100ms SLA
      expect(alertTime).toBeLessThan(100);
      expect(healthTime).toBeLessThan(100);
      expect(eventTime).toBeLessThan(100);
      expect(intrusionTime).toBeLessThan(100);
      
      const performanceReport = {
        alert_generation_ms: alertTime,
        health_check_ms: healthTime,
        event_logging_ms: eventTime,
        intrusion_detection_ms: intrusionTime,
        overall_sla_compliance: results.every(time => time < 100),
        timestamp: new Date().toISOString()
      };
      
      expect(performanceReport.overall_sla_compliance).toBe(true);
      
      console.log('Security Performance SLA Report:', JSON.stringify(performanceReport, null, 2));
    }, 5000);
  });
});