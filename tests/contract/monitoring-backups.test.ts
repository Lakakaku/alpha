import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

const API_BASE_URL = process.env.TEST_API_URL || 'http://localhost:3001';
const ADMIN_TOKEN = process.env.TEST_ADMIN_TOKEN || 'test-admin-token';

describe('Contract Test: GET /api/admin/monitoring/backups', () => {
  let server: any;

  beforeAll(async () => {
    // Server setup will be handled by test environment
  });

  afterAll(async () => {
    // Cleanup will be handled by test environment
  });

  it('should return backup status with schedule information', async () => {
    const response = await request(API_BASE_URL)
      .get('/api/admin/monitoring/backups')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .expect('Content-Type', /json/)
      .expect(200);

    // Contract validation - backup status schema
    expect(response.body).toMatchObject({
      health_status: expect.stringMatching(/^(healthy|warning|critical)$/),
      alerts: expect.arrayContaining([])
    });

    // Last backup validation (optional)
    if (response.body.last_backup) {
      expect(response.body.last_backup).toMatchObject({
        backup_id: expect.any(String),
        created_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/),
        backup_type: expect.stringMatching(/^(daily|weekly|monthly|manual)$/),
        status: expect.stringMatching(/^(completed|failed|in_progress)$/)
      });

      expect(new Date(response.body.last_backup.created_at)).toBeInstanceOf(Date);

      if (response.body.last_backup.size_bytes) {
        expect(response.body.last_backup.size_bytes).toBeGreaterThan(0);
      }

      if (response.body.last_backup.retention_expires_at) {
        expect(new Date(response.body.last_backup.retention_expires_at)).toBeInstanceOf(Date);
      }

      if (response.body.last_backup.restore_tested !== undefined) {
        expect(response.body.last_backup.restore_tested).toEqual(expect.any(Boolean));
      }
    }

    // Schedule validation (optional)
    if (response.body.schedule) {
      expect(response.body.schedule).toMatchObject({
        daily_backup_time: expect.any(String),
        next_backup: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/)
      });

      expect(new Date(response.body.schedule.next_backup)).toBeInstanceOf(Date);

      if (response.body.schedule.retention_policy) {
        expect(response.body.schedule.retention_policy).toMatchObject({
          daily_retention_days: 30,
          weekly_retention_months: 6,
          monthly_retention_years: 2
        });
      }
    }

    // Recent backups validation (optional)
    if (response.body.recent_backups) {
      response.body.recent_backups.forEach((backup: any) => {
        expect(backup).toMatchObject({
          backup_id: expect.any(String),
          created_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/),
          backup_type: expect.stringMatching(/^(daily|weekly|monthly|manual)$/),
          status: expect.stringMatching(/^(completed|failed|in_progress)$/)
        });
      });
    }

    // Alerts validation
    response.body.alerts.forEach((alert: string) => {
      expect(typeof alert).toBe('string');
      expect(alert.length).toBeGreaterThan(0);
    });
  });

  it('should indicate critical status when backups are failing', async () => {
    const response = await request(API_BASE_URL)
      .get('/api/admin/monitoring/backups')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .expect('Content-Type', /json/)
      .expect(200);

    if (response.body.last_backup && response.body.last_backup.status === 'failed') {
      expect(['warning', 'critical']).toContain(response.body.health_status);
    }
  });

  it('should indicate warning when backups are overdue', async () => {
    const response = await request(API_BASE_URL)
      .get('/api/admin/monitoring/backups')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .expect('Content-Type', /json/)
      .expect(200);

    if (response.body.last_backup) {
      const lastBackupTime = new Date(response.body.last_backup.created_at);
      const now = new Date();
      const hoursSinceLastBackup = (now.getTime() - lastBackupTime.getTime()) / (1000 * 60 * 60);
      
      // If last backup was more than 25 hours ago, should show warning
      if (hoursSinceLastBackup > 25) {
        expect(['warning', 'critical']).toContain(response.body.health_status);
      }
    }
  });

  it('should require admin authentication', async () => {
    await request(API_BASE_URL)
      .get('/api/admin/monitoring/backups')
      .expect(401);
  });

  it('should respond within performance requirements', async () => {
    const startTime = Date.now();
    
    await request(API_BASE_URL)
      .get('/api/admin/monitoring/backups')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .expect(200);
    
    const responseTime = Date.now() - startTime;
    expect(responseTime).toBeLessThan(2000); // Backup monitoring should be <2s
  });
});