/**
 * Unit Tests: Audit Logging Service
 * Task: T075 - Unit tests for audit logging in apps/backend/tests/unit/audit-logging.test.ts
 * 
 * Tests the comprehensive audit logging service including:
 * - Event logging and storage
 * - Anomaly detection algorithms
 * - Pattern violation analysis
 * - Risk score calculation
 * - Correlation tracking
 * - Bulk operations
 * - Security compliance
 */

import { AuditLoggingService, AuditLogRequest, AuditContext, EventPattern, AnomalyDetectionResult } from '../../src/services/security/auditLoggingService';
import { AuditLog } from '@vocilia/database';
import { AuditLogEntry, EventType, UserType, ResultStatus, AuditQueryFilters, AuditQueryResult } from '@vocilia/types';
import { randomUUID } from 'crypto';

// Mock dependencies
jest.mock('@vocilia/database');
jest.mock('crypto');

const MockAuditLog = AuditLog as jest.MockedClass<typeof AuditLog>;
const mockRandomUUID = randomUUID as jest.MockedFunction<typeof randomUUID>;

describe('AuditLoggingService', () => {
  let auditLoggingService: AuditLoggingService;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset singleton instance for testing
    (AuditLoggingService as any).instance = undefined;
    auditLoggingService = AuditLoggingService.getInstance();
    
    // Mock UUID generation
    let uuidCounter = 0;
    mockRandomUUID.mockImplementation(() => `test-uuid-${++uuidCounter}`);

    // Setup database mocks
    MockAuditLog.create.mockResolvedValue(undefined);
    MockAuditLog.bulkCreate.mockResolvedValue(undefined);
    MockAuditLog.query.mockResolvedValue({
      logs: [],
      total_count: 0,
      page: 1,
      per_page: 50,
      has_more: false
    });
    MockAuditLog.deleteOlderThan.mockResolvedValue(undefined);

    // Spy on console.error to test error handling
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('Singleton Pattern', () => {
    test('should return same instance on multiple calls', () => {
      const instance1 = AuditLoggingService.getInstance();
      const instance2 = AuditLoggingService.getInstance();
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBe(auditLoggingService);
    });
  });

  describe('Single Event Logging', () => {
    test('should log basic audit event successfully', async () => {
      // Arrange
      const request: AuditLogRequest = {
        eventType: 'data_access',
        userId: 'user-123',
        userType: 'customer',
        actionPerformed: 'view_feedback',
        resourceType: 'feedback_data',
        resourceId: 'feedback-456',
        resultStatus: 'success'
      };

      // Act
      await auditLoggingService.logEvent(request);

      // Assert
      expect(MockAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-uuid-1',
          event_type: 'data_access',
          user_id: 'user-123',
          user_type: 'customer',
          action_performed: 'view_feedback',
          resource_type: 'feedback_data',
          resource_id: 'feedback-456',
          correlation_id: 'test-uuid-2',
          result_status: 'success',
          ip_address: 'unknown',
          user_agent: 'unknown'
        })
      );
    });

    test('should include context information when provided', async () => {
      // Arrange
      const context: AuditContext = {
        correlationId: 'correlation-123',
        sessionId: 'session-456',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
        additionalMetadata: {
          deviceType: 'mobile',
          appVersion: '1.2.3'
        }
      };

      const request: AuditLogRequest = {
        eventType: 'authentication',
        userId: 'user-789',
        userType: 'business',
        actionPerformed: 'login_attempt',
        resourceType: 'auth_system',
        resourceId: 'login',
        resultStatus: 'success',
        context
      };

      // Act
      await auditLoggingService.logEvent(request);

      // Assert
      expect(MockAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          correlation_id: 'correlation-123',
          ip_address: '192.168.1.100',
          user_agent: 'Mozilla/5.0',
          event_metadata: expect.objectContaining({
            session_id: 'session-456',
            deviceType: 'mobile',
            appVersion: '1.2.3'
          })
        })
      );
    });

    test('should include event metadata when provided', async () => {
      // Arrange
      const eventMetadata = {
        requestDuration: 150,
        dataSize: 1024,
        errorCode: null,
        additionalInfo: 'Customer viewed their own feedback'
      };

      const request: AuditLogRequest = {
        eventType: 'data_access',
        userId: 'user-123',
        userType: 'customer',
        actionPerformed: 'view_feedback',
        resourceType: 'feedback_data',
        resourceId: 'feedback-456',
        resultStatus: 'success',
        eventMetadata
      };

      // Act
      await auditLoggingService.logEvent(request);

      // Assert
      expect(MockAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          event_metadata: expect.objectContaining(eventMetadata)
        })
      );
    });

    test('should generate correlation ID when not provided', async () => {
      // Arrange
      const request: AuditLogRequest = {
        eventType: 'data_modification',
        userId: 'user-123',
        userType: 'admin',
        actionPerformed: 'update_store_info',
        resourceType: 'store_data',
        resourceId: 'store-789',
        resultStatus: 'success'
      };

      // Act
      await auditLoggingService.logEvent(request);

      // Assert
      expect(MockAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          correlation_id: 'test-uuid-2' // Generated UUID
        })
      );
    });

    test('should handle database failures gracefully', async () => {
      // Arrange
      MockAuditLog.create.mockRejectedValue(new Error('Database connection failed'));

      const request: AuditLogRequest = {
        eventType: 'system_event',
        userId: 'system',
        userType: 'system',
        actionPerformed: 'system_startup',
        resourceType: 'system',
        resourceId: 'main',
        resultStatus: 'success'
      };

      // Act - Should not throw
      await auditLoggingService.logEvent(request);

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith('[AUDIT_LOG_FAILURE]', 
        expect.objectContaining({
          error: 'Database connection failed',
          request: expect.objectContaining({
            eventType: 'system_event',
            userId: 'system',
            actionPerformed: 'system_startup'
          })
        })
      );
    });
  });

  describe('Bulk Event Logging', () => {
    test('should log multiple events in batch', async () => {
      // Arrange
      const requests: AuditLogRequest[] = [
        {
          eventType: 'data_access',
          userId: 'user-1',
          userType: 'customer',
          actionPerformed: 'view_data',
          resourceType: 'customer_data',
          resourceId: 'data-1',
          resultStatus: 'success'
        },
        {
          eventType: 'data_modification',
          userId: 'user-2',
          userType: 'business',
          actionPerformed: 'update_profile',
          resourceType: 'business_profile',
          resourceId: 'profile-2',
          resultStatus: 'success'
        }
      ];

      // Act
      await auditLoggingService.logBulkEvents(requests);

      // Assert
      expect(MockAuditLog.bulkCreate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            event_type: 'data_access',
            user_id: 'user-1',
            action_performed: 'view_data'
          }),
          expect.objectContaining({
            event_type: 'data_modification',
            user_id: 'user-2',
            action_performed: 'update_profile'
          })
        ])
      );
    });

    test('should handle bulk operation failures gracefully', async () => {
      // Arrange
      MockAuditLog.bulkCreate.mockRejectedValue(new Error('Bulk insert failed'));

      const requests: AuditLogRequest[] = [
        {
          eventType: 'data_access',
          userId: 'user-1',
          userType: 'customer',
          actionPerformed: 'view_data',
          resourceType: 'customer_data',
          resourceId: 'data-1',
          resultStatus: 'success'
        }
      ];

      // Act - Should not throw
      await auditLoggingService.logBulkEvents(requests);

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith('[AUDIT_BULK_LOG_FAILURE]', 
        expect.objectContaining({
          error: 'Bulk insert failed',
          count: 1
        })
      );
    });
  });

  describe('Query Operations', () => {
    test('should query audit logs with filters', async () => {
      // Arrange
      const mockQueryResult: AuditQueryResult = {
        logs: [
          {
            id: 'log-1',
            event_type: 'authentication',
            user_id: 'user-123',
            user_type: 'customer',
            action_performed: 'login',
            resource_type: 'auth_system',
            resource_id: 'login',
            ip_address: '192.168.1.1',
            user_agent: 'test-agent',
            correlation_id: 'corr-1',
            event_metadata: {},
            result_status: 'success',
            created_at: '2025-01-01T10:00:00Z'
          }
        ],
        total_count: 1,
        page: 1,
        per_page: 50,
        has_more: false
      };

      MockAuditLog.query.mockResolvedValue(mockQueryResult);

      const filters: AuditQueryFilters = {
        event_type: 'authentication',
        user_id: 'user-123',
        start_date: '2025-01-01T00:00:00Z',
        limit: 10
      };

      // Act
      const result = await auditLoggingService.queryLogs(filters);

      // Assert
      expect(MockAuditLog.query).toHaveBeenCalledWith(filters);
      expect(result).toEqual(mockQueryResult);
      expect(result.logs).toHaveLength(1);
      expect(result.logs[0].user_id).toBe('user-123');
    });

    test('should get correlation trail', async () => {
      // Arrange
      const correlationId = 'correlation-123';
      const mockLogs = [
        {
          id: 'log-1',
          correlation_id: correlationId,
          event_type: 'authentication' as EventType,
          created_at: '2025-01-01T10:00:00Z'
        },
        {
          id: 'log-2',
          correlation_id: correlationId,
          event_type: 'data_access' as EventType,
          created_at: '2025-01-01T10:01:00Z'
        }
      ] as AuditLogEntry[];

      MockAuditLog.query.mockResolvedValue({
        logs: mockLogs,
        total_count: 2,
        page: 1,
        per_page: 1000,
        has_more: false
      });

      // Act
      const trail = await auditLoggingService.getCorrelationTrail(correlationId);

      // Assert
      expect(MockAuditLog.query).toHaveBeenCalledWith(
        expect.objectContaining({
          correlation_id: correlationId,
          limit: 1000,
          order_by: 'created_at',
          order_direction: 'ASC'
        })
      );
      expect(trail).toEqual(mockLogs);
      expect(trail).toHaveLength(2);
    });

    test('should handle query failures', async () => {
      // Arrange
      MockAuditLog.query.mockRejectedValue(new Error('Query failed'));

      const filters: AuditQueryFilters = {
        event_type: 'authentication',
        limit: 10
      };

      // Act & Assert
      await expect(auditLoggingService.queryLogs(filters))
        .rejects.toThrow('Failed to query audit logs: Query failed');
    });
  });

  describe('Anomaly Detection', () => {
    test('should detect call frequency anomalies', async () => {
      // Arrange - Mock high frequency of authentication events
      MockAuditLog.query.mockResolvedValue({
        logs: Array(8).fill(null).map((_, i) => ({ // 8 events > 5 threshold
          id: `log-${i}`,
          event_type: 'authentication',
          user_id: 'user-123',
          created_at: new Date(Date.now() - i * 60000).toISOString()
        })),
        total_count: 8,
        page: 1,
        per_page: 50,
        has_more: false
      } as AuditQueryResult);

      const request: AuditLogRequest = {
        eventType: 'authentication',
        userId: 'user-123',
        userType: 'customer',
        actionPerformed: 'login_attempt',
        resourceType: 'auth_system',
        resourceId: 'login',
        resultStatus: 'success'
      };

      // Act
      await auditLoggingService.logEvent(request);

      // Assert - Should log anomaly as security violation
      expect(MockAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'security_violation',
          action_performed: 'anomaly_detected',
          event_metadata: expect.objectContaining({
            original_event_type: 'authentication',
            anomaly_details: expect.objectContaining({
              violation_count: 1,
              recommended_action: expect.stringMatching(/monitor|alert|block/)
            })
          })
        })
      );
    });

    test('should not flag normal activity patterns', async () => {
      // Arrange - Mock normal activity (below thresholds)
      MockAuditLog.query.mockResolvedValue({
        logs: [
          {
            id: 'log-1',
            event_type: 'data_access',
            user_id: 'user-123',
            created_at: new Date(Date.now() - 300000).toISOString() // 5 minutes ago
          }
        ],
        total_count: 1, // Only 1 event, well below threshold
        page: 1,
        per_page: 50,
        has_more: false
      });

      const request: AuditLogRequest = {
        eventType: 'data_access',
        userId: 'user-123',
        userType: 'customer',
        actionPerformed: 'view_feedback',
        resourceType: 'feedback_data',
        resourceId: 'feedback-456',
        resultStatus: 'success'
      };

      // Act
      await auditLoggingService.logEvent(request);

      // Assert - Should only log the original event, not an anomaly
      expect(MockAuditLog.create).toHaveBeenCalledTimes(1);
      expect(MockAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'data_access', // Original event only
          action_performed: 'view_feedback'
        })
      );
    });

    test('should calculate risk scores correctly', async () => {
      // Arrange - Mock critical security violations
      MockAuditLog.query.mockResolvedValue({
        logs: Array(5).fill(null).map((_, i) => ({ // 5 events > 3 threshold
          id: `log-${i}`,
          event_type: 'security_violation',
          user_id: 'user-123',
          created_at: new Date(Date.now() - i * 600000).toISOString()
        })),
        total_count: 5,
        page: 1,
        per_page: 50,
        has_more: false
      });

      const request: AuditLogRequest = {
        eventType: 'security_violation',
        userId: 'user-123',
        userType: 'customer',
        actionPerformed: 'unauthorized_access_attempt',
        resourceType: 'admin_panel',
        resourceId: 'admin_dashboard',
        resultStatus: 'blocked'
      };

      // Act
      await auditLoggingService.logEvent(request);

      // Assert - Should log high-risk anomaly
      expect(MockAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'security_violation',
          action_performed: 'anomaly_detected',
          event_metadata: expect.objectContaining({
            anomaly_details: expect.objectContaining({
              risk_score: expect.any(Number),
              recommended_action: expect.stringMatching(/alert|block/) // High risk actions
            })
          })
        })
      );
    });

    test('should handle anomaly detection failures gracefully', async () => {
      // Arrange
      MockAuditLog.query.mockRejectedValue(new Error('Query failed during anomaly detection'));

      const request: AuditLogRequest = {
        eventType: 'data_access',
        userId: 'user-123',
        userType: 'customer',
        actionPerformed: 'view_data',
        resourceType: 'customer_data',
        resourceId: 'data-123',
        resultStatus: 'success'
      };

      // Act - Should not throw despite anomaly detection failure
      await auditLoggingService.logEvent(request);

      // Assert - Original event should still be logged
      expect(MockAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'data_access',
          action_performed: 'view_data'
        })
      );
    });
  });

  describe('Risk Score Calculation', () => {
    const riskScoreTests = [
      {
        violations: [
          { eventType: 'security_violation' as EventType, actualOccurrences: 6, maxOccurrences: 3 }
        ],
        expectedMinScore: 60, // 40 * (6/3) = 80, but should be significant
        description: 'high-risk security violations'
      },
      {
        violations: [
          { eventType: 'authentication' as EventType, actualOccurrences: 8, maxOccurrences: 5 },
          { eventType: 'data_access' as EventType, actualOccurrences: 150, maxOccurrences: 100 }
        ],
        expectedMinScore: 30, // Multiple moderate violations
        description: 'multiple moderate risk patterns'
      },
      {
        violations: [
          { eventType: 'system_event' as EventType, actualOccurrences: 20, maxOccurrences: 10 }
        ],
        expectedMinScore: 5, // Low risk event type
        description: 'low-risk system events'
      }
    ];

    riskScoreTests.forEach(({ violations, expectedMinScore, description }) => {
      test(`should calculate appropriate risk score for ${description}`, async () => {
        // Arrange - Mock query to return violations
        MockAuditLog.query.mockResolvedValue({
          logs: violations.map(v => Array(v.actualOccurrences).fill(null)).flat().map((_, i) => ({
            id: `log-${i}`,
            event_type: violations[0].eventType,
            user_id: 'user-123',
            created_at: new Date(Date.now() - i * 60000).toISOString()
          })),
          total_count: violations[0].actualOccurrences,
          page: 1,
          per_page: 50,
          has_more: false
        });

        const request: AuditLogRequest = {
          eventType: violations[0].eventType,
          userId: 'user-123',
          userType: 'customer',
          actionPerformed: 'test_action',
          resourceType: 'test_resource',
          resourceId: 'test-id',
          resultStatus: 'success'
        };

        // Act
        await auditLoggingService.logEvent(request);

        // Assert
        if (violations[0].actualOccurrences > violations[0].maxOccurrences) {
          expect(MockAuditLog.create).toHaveBeenCalledWith(
            expect.objectContaining({
              event_type: 'security_violation',
              action_performed: 'anomaly_detected',
              event_metadata: expect.objectContaining({
                anomaly_details: expect.objectContaining({
                  risk_score: expect.any(Number)
                })
              })
            })
          );
        }
      });
    });

    test('should cap risk score at 100', async () => {
      // Arrange - Extreme violations that would calculate > 100
      MockAuditLog.query.mockResolvedValue({
        logs: Array(50).fill(null).map((_, i) => ({ // Extremely high count
          id: `log-${i}`,
          event_type: 'security_violation',
          user_id: 'user-123',
          created_at: new Date(Date.now() - i * 60000).toISOString()
        })),
        total_count: 50,
        page: 1,
        per_page: 50,
        has_more: false
      });

      const request: AuditLogRequest = {
        eventType: 'security_violation',
        userId: 'user-123',
        userType: 'customer',
        actionPerformed: 'extreme_violation',
        resourceType: 'critical_resource',
        resourceId: 'critical-id',
        resultStatus: 'blocked'
      };

      // Act
      await auditLoggingService.logEvent(request);

      // Assert - Risk score should be capped at 100
      expect(MockAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          event_metadata: expect.objectContaining({
            anomaly_details: expect.objectContaining({
              risk_score: expect.any(Number) // Should be <= 100
            })
          })
        })
      );
    });
  });

  describe('Statistics and Monitoring', () => {
    test('should calculate audit statistics correctly', async () => {
      // Arrange
      const mockLogs: AuditLogEntry[] = [
        {
          id: 'log-1',
          event_type: 'authentication',
          user_id: 'user-1',
          user_type: 'customer',
          action_performed: 'login',
          resource_type: 'auth_system',
          resource_id: 'login',
          ip_address: '192.168.1.1',
          user_agent: 'test',
          correlation_id: 'corr-1',
          event_metadata: {},
          result_status: 'success',
          created_at: '2025-01-01T10:00:00Z'
        },
        {
          id: 'log-2',
          event_type: 'security_violation',
          user_id: 'user-1',
          user_type: 'customer',
          action_performed: 'anomaly_detected',
          resource_type: 'audit_system',
          resource_id: 'pattern_analysis',
          ip_address: '192.168.1.1',
          user_agent: 'test',
          correlation_id: 'corr-2',
          event_metadata: {},
          result_status: 'warning',
          created_at: '2025-01-01T10:05:00Z'
        },
        {
          id: 'log-3',
          event_type: 'data_access',
          user_id: 'user-2',
          user_type: 'business',
          action_performed: 'view_data',
          resource_type: 'customer_data',
          resource_id: 'data-123',
          ip_address: '192.168.1.2',
          user_agent: 'test',
          correlation_id: 'corr-3',
          event_metadata: {},
          result_status: 'success',
          created_at: '2025-01-01T10:10:00Z'
        }
      ];

      MockAuditLog.query.mockResolvedValue({
        logs: mockLogs,
        total_count: 3,
        page: 1,
        per_page: 10000,
        has_more: false
      });

      // Act
      const stats = await auditLoggingService.getAuditStatistics(24);

      // Assert
      expect(stats.totalEvents).toBe(3);
      expect(stats.eventsByType.authentication).toBe(1);
      expect(stats.eventsByType.security_violation).toBe(1);
      expect(stats.eventsByType.data_access).toBe(1);
      expect(stats.securityViolations).toBe(1);
      expect(stats.anomaliesDetected).toBe(1);
      expect(stats.topUsers).toEqual([
        { userId: 'user-1', eventCount: 2 },
        { userId: 'user-2', eventCount: 1 }
      ]);
      expect(stats.topResources).toContainEqual({ resourceType: 'auth_system', accessCount: 1 });
      expect(stats.topResources).toContainEqual({ resourceType: 'customer_data', accessCount: 1 });
    });

    test('should handle statistics calculation errors', async () => {
      // Arrange
      MockAuditLog.query.mockRejectedValue(new Error('Statistics query failed'));

      // Act & Assert
      await expect(auditLoggingService.getAuditStatistics(24))
        .rejects.toThrow('Failed to get audit statistics: Statistics query failed');
    });
  });

  describe('Data Retention and Archival', () => {
    test('should archive old logs successfully', async () => {
      // Arrange
      const retentionDays = 90;
      const mockOldLogs: AuditQueryResult = {
        logs: Array(100).fill(null).map((_, i) => ({
          id: `old-log-${i}`,
          event_type: 'data_access' as EventType,
          created_at: new Date(Date.now() - 95 * 24 * 60 * 60 * 1000).toISOString()
        })) as AuditLogEntry[],
        total_count: 100,
        page: 1,
        per_page: 50000,
        has_more: false
      };

      MockAuditLog.query.mockResolvedValue(mockOldLogs);
      MockAuditLog.deleteOlderThan.mockResolvedValue(undefined);

      // Act
      const result = await auditLoggingService.archiveOldLogs(retentionDays);

      // Assert
      expect(result.archivedCount).toBe(100);
      expect(result.deletedCount).toBe(100);
      
      // Should log the archival action
      expect(MockAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'system_event',
          action_performed: 'audit_logs_archived',
          event_metadata: expect.objectContaining({
            retention_days: 90,
            archived_count: 100
          })
        })
      );
    });

    test('should handle archival failures', async () => {
      // Arrange
      MockAuditLog.query.mockRejectedValue(new Error('Cannot query old logs'));

      // Act & Assert
      await expect(auditLoggingService.archiveOldLogs(90))
        .rejects.toThrow('Failed to archive logs: Cannot query old logs');
    });
  });

  describe('Event Type Coverage', () => {
    const eventTypes: EventType[] = [
      'authentication',
      'authorization', 
      'data_access',
      'data_modification',
      'admin_action',
      'security_violation',
      'system_event',
      'fraud_detection'
    ];

    eventTypes.forEach(eventType => {
      test(`should handle ${eventType} events correctly`, async () => {
        // Arrange
        const request: AuditLogRequest = {
          eventType,
          userId: 'test-user',
          userType: 'customer',
          actionPerformed: `test_${eventType}_action`,
          resourceType: 'test_resource',
          resourceId: 'test-resource-123',
          resultStatus: 'success'
        };

        // Act
        await auditLoggingService.logEvent(request);

        // Assert
        expect(MockAuditLog.create).toHaveBeenCalledWith(
          expect.objectContaining({
            event_type: eventType,
            action_performed: `test_${eventType}_action`
          })
        );
      });
    });
  });

  describe('Security and Compliance', () => {
    test('should never throw exceptions that could break application flow', async () => {
      // Arrange - Multiple failure scenarios
      const failureScenarios = [
        () => MockAuditLog.create.mockRejectedValue(new Error('Database down')),
        () => MockAuditLog.query.mockRejectedValue(new Error('Query timeout')),
        () => mockRandomUUID.mockImplementation(() => { throw new Error('UUID generation failed'); })
      ];

      const request: AuditLogRequest = {
        eventType: 'data_access',
        userId: 'user-123',
        userType: 'customer',
        actionPerformed: 'view_data',
        resourceType: 'customer_data',
        resourceId: 'data-456',
        resultStatus: 'success'
      };

      // Act & Assert - None should throw
      for (const setupFailure of failureScenarios) {
        jest.clearAllMocks();
        setupFailure();
        
        await expect(auditLoggingService.logEvent(request)).resolves.not.toThrow();
        
        // Reset mocks for next iteration
        MockAuditLog.create.mockResolvedValue(undefined);
        MockAuditLog.query.mockResolvedValue({ logs: [], total_count: 0, page: 1, per_page: 50, has_more: false });
        mockRandomUUID.mockImplementation(() => `test-uuid-${Date.now()}`);
      }
    });

    test('should prevent infinite recursion in anomaly logging', async () => {
      // Arrange - Mock anomaly detection that would trigger another security violation
      MockAuditLog.query.mockResolvedValue({
        logs: Array(10).fill(null).map((_, i) => ({
          id: `log-${i}`,
          event_type: 'security_violation',
          user_id: 'user-123',
          created_at: new Date(Date.now() - i * 60000).toISOString()
        })),
        total_count: 10,
        page: 1,
        per_page: 50,
        has_more: false
      });

      const request: AuditLogRequest = {
        eventType: 'security_violation',
        userId: 'user-123',
        userType: 'admin',
        actionPerformed: 'suspicious_admin_action',
        resourceType: 'admin_panel',
        resourceId: 'critical_function',
        resultStatus: 'blocked'
      };

      // Act
      await auditLoggingService.logEvent(request);

      // Assert - Should log original event + anomaly, but not recurse further
      expect(MockAuditLog.create).toHaveBeenCalledTimes(2); // Original + anomaly, no recursion
      expect(MockAuditLog.create).toHaveBeenNthCalledWith(1, 
        expect.objectContaining({
          event_type: 'security_violation',
          action_performed: 'suspicious_admin_action'
        })
      );
      expect(MockAuditLog.create).toHaveBeenNthCalledWith(2,
        expect.objectContaining({
          event_type: 'security_violation',
          action_performed: 'anomaly_detected'
        })
      );
    });

    test('should preserve data integrity with timestamps', async () => {
      // Arrange
      const fixedTime = '2025-01-01T12:00:00.000Z';
      const originalDateNow = Date.now;
      Date.now = jest.fn(() => new Date(fixedTime).getTime());

      const request: AuditLogRequest = {
        eventType: 'data_modification',
        userId: 'user-123',
        userType: 'admin',
        actionPerformed: 'update_sensitive_data',
        resourceType: 'customer_pii',
        resourceId: 'customer-789',
        resultStatus: 'success'
      };

      try {
        // Act
        await auditLoggingService.logEvent(request);

        // Assert
        expect(MockAuditLog.create).toHaveBeenCalledWith(
          expect.objectContaining({
            created_at: expect.any(String) // Should have timestamp
          })
        );

        const callArgs = MockAuditLog.create.mock.calls[0][0];
        const timestamp = new Date(callArgs.created_at);
        expect(timestamp.getTime()).toBeCloseTo(new Date(fixedTime).getTime(), -3); // Within 1000ms
      } finally {
        Date.now = originalDateNow;
      }
    });
  });
});