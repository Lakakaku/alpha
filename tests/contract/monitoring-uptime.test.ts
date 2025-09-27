import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

const API_BASE_URL = process.env.TEST_API_URL || 'http://localhost:3001';
const ADMIN_TOKEN = process.env.TEST_ADMIN_TOKEN || 'test-admin-token';

describe('Contract Test: GET /api/admin/monitoring/uptime', () => {
  let server: any;

  beforeAll(async () => {
    // Server setup will be handled by test environment
  });

  afterAll(async () => {
    // Cleanup will be handled by test environment
  });

  it('should return uptime metrics for default period', async () => {
    const response = await request(API_BASE_URL)
      .get('/api/admin/monitoring/uptime')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .expect('Content-Type', /json/)
      .expect(200);

    // Contract validation - uptime metrics schema
    expect(response.body).toMatchObject({
      period: expect.any(String),
      uptime_percent: expect.any(Number),
      sla_target: 99.5,
      sla_status: expect.stringMatching(/^(meeting|at_risk|violated)$/),
      total_downtime_minutes: expect.any(Number),
      incidents: expect.arrayContaining([]),
      current_status: expect.stringMatching(/^(operational|degraded|outage)$/)
    });

    // Uptime validation
    expect(response.body.uptime_percent).toBeGreaterThanOrEqual(0);
    expect(response.body.uptime_percent).toBeLessThanOrEqual(100);
    expect(response.body.total_downtime_minutes).toBeGreaterThanOrEqual(0);

    // Incidents validation
    response.body.incidents.forEach((incident: any) => {
      expect(incident).toMatchObject({
        incident_id: expect.any(String),
        start_time: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/),
        duration_minutes: expect.any(Number),
        severity: expect.stringMatching(/^(minor|major|critical)$/)
      });

      expect(incident.duration_minutes).toBeGreaterThan(0);
      expect(new Date(incident.start_time)).toBeInstanceOf(Date);

      if (incident.end_time) {
        expect(new Date(incident.end_time)).toBeInstanceOf(Date);
      }

      if (incident.affected_services) {
        expect(incident.affected_services).toEqual(expect.arrayContaining([]));
      }
    });
  });

  it('should accept period query parameter', async () => {
    const periods = ['hour', 'day', 'week', 'month'];
    
    for (const period of periods) {
      const response = await request(API_BASE_URL)
        .get(`/api/admin/monitoring/uptime?period=${period}`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.period).toBe(period);
    }
  });

  it('should accept environment query parameter', async () => {
    const environments = ['production', 'staging'];
    
    for (const environment of environments) {
      const response = await request(API_BASE_URL)
        .get(`/api/admin/monitoring/uptime?environment=${environment}`)
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('uptime_percent');
    }
  });

  it('should indicate SLA violation when uptime is below 99.5%', async () => {
    const response = await request(API_BASE_URL)
      .get('/api/admin/monitoring/uptime')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .expect('Content-Type', /json/)
      .expect(200);

    if (response.body.uptime_percent < 99.5) {
      expect(['at_risk', 'violated']).toContain(response.body.sla_status);
    }
  });

  it('should require admin authentication', async () => {
    await request(API_BASE_URL)
      .get('/api/admin/monitoring/uptime')
      .expect(401);
  });

  it('should respond within performance requirements', async () => {
    const startTime = Date.now();
    
    await request(API_BASE_URL)
      .get('/api/admin/monitoring/uptime')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .expect(200);
    
    const responseTime = Date.now() - startTime;
    expect(responseTime).toBeLessThan(2000); // Monitoring API should be <2s
  });
});