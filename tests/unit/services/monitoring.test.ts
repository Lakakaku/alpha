import { UptimeService } from '../../../apps/backend/src/services/monitoring/uptime-service';
import { PerformanceService } from '../../../apps/backend/src/services/monitoring/performance-service';
import { BackupService } from '../../../apps/backend/src/services/monitoring/backup-service';
import { AlertService } from '../../../apps/backend/src/services/monitoring/alert-service';
import { supabase } from '../../../packages/database/src/client/supabase';

// Mock Supabase client
jest.mock('../../../packages/database/src/client/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

// Mock node-cron for scheduler tests
jest.mock('node-cron', () => ({
  schedule: jest.fn(),
  validate: jest.fn(() => true),
  destroy: jest.fn(),
}));

// Mock external services
jest.mock('nodemailer', () => ({
  createTransporter: jest.fn(() => ({
    sendMail: jest.fn(),
  })),
}));

describe('UptimeService', () => {
  let uptimeService: UptimeService;
  const mockSupabaseFrom = supabase.from as jest.Mock;

  beforeEach(() => {
    uptimeService = new UptimeService();
    jest.clearAllMocks();
  });

  describe('recordHealthCheck', () => {
    it('should record successful health check', async () => {
      const mockInsert = jest.fn().mockResolvedValue({ data: null, error: null });
      const mockFrom = jest.fn().mockReturnValue({ insert: mockInsert });
      mockSupabaseFrom.mockReturnValue({ insert: mockInsert });

      const healthData = {
        environment_id: 'prod-backend',
        endpoint: '/health',
        status: 'healthy' as const,
        response_time: 150,
        timestamp: new Date(),
      };

      await uptimeService.recordHealthCheck(healthData);

      expect(mockSupabaseFrom).toHaveBeenCalledWith('monitoring_data');
      expect(mockInsert).toHaveBeenCalledWith({
        environment_id: 'prod-backend',
        metric_type: 'health_check',
        metric_value: 150,
        unit: 'ms',
        status: 'healthy',
        timestamp: healthData.timestamp,
        source: 'uptime_service',
      });
    });

    it('should handle health check failures', async () => {
      const mockInsert = jest.fn().mockResolvedValue({ 
        data: null, 
        error: { message: 'Database error' }
      });
      mockSupabaseFrom.mockReturnValue({ insert: mockInsert });

      const healthData = {
        environment_id: 'prod-backend',
        endpoint: '/health',
        status: 'critical' as const,
        response_time: 5000,
        timestamp: new Date(),
      };

      await expect(uptimeService.recordHealthCheck(healthData))
        .rejects.toThrow('Failed to record health check');
    });
  });

  describe('calculateUptime', () => {
    it('should calculate monthly uptime percentage correctly', async () => {
      const mockSelect = jest.fn().mockResolvedValue({
        data: [
          { status: 'healthy', count: 2880 }, // 2880 successful checks
          { status: 'critical', count: 120 },  // 120 failed checks
        ],
        error: null,
      });
      mockSupabaseFrom.mockReturnValue({ 
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lt: jest.fn().mockReturnValue({ select: mockSelect })
            })
          })
        })
      });

      const uptime = await uptimeService.calculateUptime('prod-backend', 'month');

      expect(uptime.percentage).toBe(96.0); // 2880 / (2880 + 120) = 96%
      expect(uptime.status).toBe('warning'); // Below 99.5% target
      expect(uptime.total_checks).toBe(3000);
      expect(uptime.successful_checks).toBe(2880);
    });

    it('should return healthy status for uptime above 99.5%', async () => {
      const mockSelect = jest.fn().mockResolvedValue({
        data: [
          { status: 'healthy', count: 2985 },
          { status: 'critical', count: 15 },
        ],
        error: null,
      });
      mockSupabaseFrom.mockReturnValue({ 
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lt: jest.fn().mockReturnValue({ select: mockSelect })
            })
          })
        })
      });

      const uptime = await uptimeService.calculateUptime('prod-backend', 'month');

      expect(uptime.percentage).toBe(99.5);
      expect(uptime.status).toBe('healthy');
    });
  });

  describe('getUptimeStatus', () => {
    it('should return current uptime status for environment', async () => {
      const mockSelect = jest.fn().mockResolvedValue({
        data: [{ 
          status: 'healthy',
          timestamp: new Date().toISOString(),
          metric_value: 150 
        }],
        error: null,
      });
      mockSupabaseFrom.mockReturnValue({ 
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({ select: mockSelect })
            })
          })
        })
      });

      const status = await uptimeService.getUptimeStatus('prod-backend');

      expect(status.environment_id).toBe('prod-backend');
      expect(status.current_status).toBe('healthy');
      expect(status.last_check).toBeDefined();
    });
  });
});

describe('PerformanceService', () => {
  let performanceService: PerformanceService;

  beforeEach(() => {
    performanceService = new PerformanceService();
    jest.clearAllMocks();
  });

  describe('recordMetric', () => {
    it('should record performance metric successfully', async () => {
      const mockInsert = jest.fn().mockResolvedValue({ data: null, error: null });
      mockSupabaseFrom.mockReturnValue({ insert: mockInsert });

      const metric = {
        environment_id: 'prod-backend',
        endpoint: '/api/businesses',
        response_time: 850,
        timestamp: new Date(),
      };

      await performanceService.recordMetric(metric);

      expect(mockSupabaseFrom).toHaveBeenCalledWith('monitoring_data');
      expect(mockInsert).toHaveBeenCalledWith({
        environment_id: 'prod-backend',
        metric_type: 'performance',
        metric_value: 850,
        unit: 'ms',
        threshold_warning: 1500,
        threshold_critical: 2000,
        status: 'healthy',
        timestamp: metric.timestamp,
        source: 'performance_service',
      });
    });

    it('should mark metric as warning when response time exceeds threshold', async () => {
      const mockInsert = jest.fn().mockResolvedValue({ data: null, error: null });
      mockSupabaseFrom.mockReturnValue({ insert: mockInsert });

      const metric = {
        environment_id: 'prod-backend',
        endpoint: '/api/stores',
        response_time: 1750, // Exceeds warning threshold
        timestamp: new Date(),
      };

      await performanceService.recordMetric(metric);

      const insertCall = mockInsert.mock.calls[0][0];
      expect(insertCall.status).toBe('warning');
      expect(insertCall.metric_value).toBe(1750);
    });

    it('should mark metric as critical when response time exceeds critical threshold', async () => {
      const mockInsert = jest.fn().mockResolvedValue({ data: null, error: null });
      mockSupabaseFrom.mockReturnValue({ insert: mockInsert });

      const metric = {
        environment_id: 'prod-backend',
        endpoint: '/api/complex-query',
        response_time: 2500, // Exceeds critical threshold
        timestamp: new Date(),
      };

      await performanceService.recordMetric(metric);

      const insertCall = mockInsert.mock.calls[0][0];
      expect(insertCall.status).toBe('critical');
    });
  });

  describe('getAverageResponseTime', () => {
    it('should calculate average response time for time period', async () => {
      const mockRpc = jest.fn().mockResolvedValue({
        data: [{ avg_response_time: 1250.5 }],
        error: null,
      });
      (supabase.rpc as jest.Mock).mockReturnValue(mockRpc);

      const avgTime = await performanceService.getAverageResponseTime(
        'prod-backend',
        'hour'
      );

      expect(avgTime).toBe(1250.5);
      expect(supabase.rpc).toHaveBeenCalledWith('calculate_avg_response_time', {
        env_id: 'prod-backend',
        time_period: 'hour',
      });
    });

    it('should handle database errors gracefully', async () => {
      const mockRpc = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'RPC function not found' },
      });
      (supabase.rpc as jest.Mock).mockReturnValue(mockRpc);

      await expect(performanceService.getAverageResponseTime('prod-backend', 'day'))
        .rejects.toThrow('Failed to calculate average response time');
    });
  });

  describe('getPercentileResponseTime', () => {
    it('should calculate P95 response time correctly', async () => {
      const mockRpc = jest.fn().mockResolvedValue({
        data: [{ percentile_response_time: 1890 }],
        error: null,
      });
      (supabase.rpc as jest.Mock).mockReturnValue(mockRpc);

      const p95Time = await performanceService.getPercentileResponseTime(
        'prod-backend',
        95,
        'hour'
      );

      expect(p95Time).toBe(1890);
      expect(supabase.rpc).toHaveBeenCalledWith('calculate_percentile_response_time', {
        env_id: 'prod-backend',
        percentile: 95,
        time_period: 'hour',
      });
    });
  });
});

describe('BackupService', () => {
  let backupService: BackupService;

  beforeEach(() => {
    backupService = new BackupService();
    jest.clearAllMocks();
  });

  describe('createBackup', () => {
    it('should create manual backup successfully', async () => {
      const mockInsert = jest.fn().mockResolvedValue({ 
        data: [{ backup_id: 'backup-123' }], 
        error: null 
      });
      mockSupabaseFrom.mockReturnValue({ 
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({ insert: mockInsert })
        })
      });

      const backup = await backupService.createBackup('vocilia-prod', 'manual');

      expect(backup.backup_id).toBe('backup-123');
      expect(mockSupabaseFrom).toHaveBeenCalledWith('backup_records');
    });

    it('should handle backup creation failures', async () => {
      const mockInsert = jest.fn().mockResolvedValue({ 
        data: null, 
        error: { message: 'Backup creation failed' }
      });
      mockSupabaseFrom.mockReturnValue({ 
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({ insert: mockInsert })
        })
      });

      await expect(backupService.createBackup('vocilia-prod', 'daily'))
        .rejects.toThrow('Failed to create backup');
    });
  });

  describe('getBackupStatus', () => {
    it('should return latest backup status', async () => {
      const mockSelect = jest.fn().mockResolvedValue({
        data: [{
          backup_id: 'backup-123',
          backup_status: 'completed',
          created_at: new Date().toISOString(),
          backup_size: 1024000,
          checksum: 'abc123def456',
        }],
        error: null,
      });
      mockSupabaseFrom.mockReturnValue({ 
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({ select: mockSelect })
            })
          })
        })
      });

      const status = await backupService.getBackupStatus('vocilia-prod');

      expect(status.database_name).toBe('vocilia-prod');
      expect(status.last_backup.backup_id).toBe('backup-123');
      expect(status.last_backup.status).toBe('completed');
      expect(status.backup_health).toBe('healthy');
    });

    it('should detect unhealthy backup status when backup is old', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 3); // 3 days ago

      const mockSelect = jest.fn().mockResolvedValue({
        data: [{
          backup_id: 'backup-old',
          backup_status: 'completed',
          created_at: oldDate.toISOString(),
          backup_size: 1024000,
          checksum: 'old123',
        }],
        error: null,
      });
      mockSupabaseFrom.mockReturnValue({ 
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({ select: mockSelect })
            })
          })
        })
      });

      const status = await backupService.getBackupStatus('vocilia-prod');

      expect(status.backup_health).toBe('warning');
      expect(status.last_backup_age_hours).toBeGreaterThan(48);
    });
  });

  describe('verifyBackupIntegrity', () => {
    it('should verify backup integrity successfully', async () => {
      const mockSelect = jest.fn().mockResolvedValue({
        data: [{
          backup_id: 'backup-123',
          checksum: 'abc123def456',
          backup_size: 1024000,
        }],
        error: null,
      });
      mockSupabaseFrom.mockReturnValue({ 
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({ select: mockSelect })
        })
      });

      // Mock checksum calculation
      const mockCalculateChecksum = jest.spyOn(backupService as any, 'calculateChecksum')
        .mockResolvedValue('abc123def456');

      const verification = await backupService.verifyBackupIntegrity('backup-123');

      expect(verification.is_valid).toBe(true);
      expect(verification.checksum_match).toBe(true);
      expect(verification.backup_id).toBe('backup-123');
    });
  });

  describe('scheduleBackups', () => {
    it('should schedule daily backup cron job', () => {
      const nodeCron = require('node-cron');
      const mockSchedule = jest.spyOn(nodeCron, 'schedule');

      backupService.scheduleBackups();

      expect(mockSchedule).toHaveBeenCalledWith(
        '0 2 * * *', // Daily at 2 AM
        expect.any(Function),
        { timezone: 'Europe/Stockholm' }
      );
    });
  });
});

describe('AlertService', () => {
  let alertService: AlertService;

  beforeEach(() => {
    alertService = new AlertService();
    jest.clearAllMocks();
  });

  describe('createAlert', () => {
    it('should create critical alert for deployment failure', async () => {
      const mockInsert = jest.fn().mockResolvedValue({ 
        data: [{ alert_id: 'alert-123' }], 
        error: null 
      });
      mockSupabaseFrom.mockReturnValue({ 
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({ insert: mockInsert })
        })
      });

      const alert = {
        environment_id: 'prod-backend',
        alert_type: 'deployment_failure' as const,
        severity: 'critical' as const,
        message: 'Backend deployment failed',
        source_metric_id: 'deploy-456',
      };

      const createdAlert = await alertService.createAlert(alert);

      expect(createdAlert.alert_id).toBe('alert-123');
      expect(mockSupabaseFrom).toHaveBeenCalledWith('monitoring_alerts');
    });

    it('should send notification for critical alerts', async () => {
      const mockInsert = jest.fn().mockResolvedValue({ 
        data: [{ alert_id: 'alert-critical' }], 
        error: null 
      });
      mockSupabaseFrom.mockReturnValue({ 
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({ insert: mockInsert })
        })
      });

      const mockSendNotification = jest.spyOn(alertService as any, 'sendNotification')
        .mockResolvedValue(true);

      const alert = {
        environment_id: 'prod-backend',
        alert_type: 'uptime_critical' as const,
        severity: 'critical' as const,
        message: 'System uptime below 99%',
      };

      await alertService.createAlert(alert);

      expect(mockSendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'critical',
          message: 'System uptime below 99%',
        })
      );
    });
  });

  describe('getActiveAlerts', () => {
    it('should return active alerts for environment', async () => {
      const mockSelect = jest.fn().mockResolvedValue({
        data: [
          {
            alert_id: 'alert-1',
            alert_type: 'performance_warning',
            severity: 'warning',
            message: 'Response time above threshold',
            created_at: new Date().toISOString(),
            status: 'active',
          },
          {
            alert_id: 'alert-2',
            alert_type: 'backup_failure',
            severity: 'critical',
            message: 'Daily backup failed',
            created_at: new Date().toISOString(),
            status: 'active',
          },
        ],
        error: null,
      });
      mockSupabaseFrom.mockReturnValue({ 
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({ select: mockSelect })
            })
          })
        })
      });

      const alerts = await alertService.getActiveAlerts('prod-backend');

      expect(alerts).toHaveLength(2);
      expect(alerts[0].alert_type).toBe('performance_warning');
      expect(alerts[1].severity).toBe('critical');
    });
  });

  describe('acknowledgeAlert', () => {
    it('should acknowledge alert and update status', async () => {
      const mockUpdate = jest.fn().mockResolvedValue({ 
        data: [{ alert_id: 'alert-123' }], 
        error: null 
      });
      mockSupabaseFrom.mockReturnValue({ 
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({ update: mockUpdate })
          })
        })
      });

      const result = await alertService.acknowledgeAlert('alert-123', 'admin-user-123');

      expect(result.success).toBe(true);
      expect(mockSupabaseFrom).toHaveBeenCalledWith('monitoring_alerts');
    });
  });

  describe('resolveAlert', () => {
    it('should resolve alert with resolution notes', async () => {
      const mockUpdate = jest.fn().mockResolvedValue({ 
        data: [{ alert_id: 'alert-123' }], 
        error: null 
      });
      mockSupabaseFrom.mockReturnValue({ 
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({ update: mockUpdate })
          })
        })
      });

      const result = await alertService.resolveAlert(
        'alert-123', 
        'admin-user-123',
        'Issue resolved by restarting service'
      );

      expect(result.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith({
        status: 'resolved',
        resolved_at: expect.any(Date),
        resolved_by: 'admin-user-123',
        resolution_notes: 'Issue resolved by restarting service',
      });
    });
  });

  describe('checkAlertRules', () => {
    it('should trigger alert when response time exceeds threshold', async () => {
      const mockCreateAlert = jest.spyOn(alertService, 'createAlert')
        .mockResolvedValue({ alert_id: 'alert-123' } as any);

      await alertService.checkAlertRules('prod-backend', {
        metric_type: 'performance',
        metric_value: 2500, // Exceeds 2000ms threshold
        status: 'critical',
        environment_id: 'prod-backend',
        timestamp: new Date(),
      });

      expect(mockCreateAlert).toHaveBeenCalledWith({
        environment_id: 'prod-backend',
        alert_type: 'performance_critical',
        severity: 'critical',
        message: 'Response time (2500ms) exceeds critical threshold (2000ms)',
        source_metric_id: undefined,
      });
    });

    it('should not trigger alert for healthy metrics', async () => {
      const mockCreateAlert = jest.spyOn(alertService, 'createAlert')
        .mockResolvedValue({ alert_id: 'alert-123' } as any);

      await alertService.checkAlertRules('prod-backend', {
        metric_type: 'performance',
        metric_value: 800, // Within healthy range
        status: 'healthy',
        environment_id: 'prod-backend',
        timestamp: new Date(),
      });

      expect(mockCreateAlert).not.toHaveBeenCalled();
    });
  });
});