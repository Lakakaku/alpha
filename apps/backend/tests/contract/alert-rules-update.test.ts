import request from 'supertest';
import { app } from '../../src/app';

describe('PUT /api/monitoring/alerts/rules/{rule_id} - Contract Test', () => {
  const validAdminAuth = 'Bearer valid-admin-token'; // Will be mocked
  const validRuleId = '550e8400-e29b-41d4-a716-446655440000';

  const validUpdateData = {
    rule_name: 'Updated High CPU Usage Alert',
    threshold_value: 85,
    comparison_operator: '>=',
    notification_channels: ['email', 'dashboard', 'sms'],
    is_active: false
  };

  describe('Authentication Requirements', () => {
    it('should return 401 when no authentication provided', async () => {
      const response = await request(app)
        .put(`/api/monitoring/alerts/rules/${validRuleId}`)
        .send(validUpdateData);

      expect(response.status).toBe(401);
    });

    it('should return 403 when user lacks monitoring permissions', async () => {
      const response = await request(app)
        .put(`/api/monitoring/alerts/rules/${validRuleId}`)
        .set('Authorization', 'Bearer invalid-admin-token')
        .send(validUpdateData);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('monitoring');
    });

    it('should return 403 when non-owner user tries to update rule', async () => {
      const response = await request(app)
        .put(`/api/monitoring/alerts/rules/${validRuleId}`)
        .set('Authorization', 'Bearer different-admin-token')
        .send(validUpdateData);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('permission');
    });
  });

  describe('Path Parameter Validation', () => {
    it('should accept valid UUID for rule_id', async () => {
      const response = await request(app)
        .put(`/api/monitoring/alerts/rules/${validRuleId}`)
        .set('Authorization', validAdminAuth)
        .send(validUpdateData);

      expect(response.status).not.toBe(422);
    });

    it('should reject invalid UUID format for rule_id', async () => {
      const response = await request(app)
        .put('/api/monitoring/alerts/rules/invalid-uuid')
        .set('Authorization', validAdminAuth)
        .send(validUpdateData);

      expect(response.status).toBe(422);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('UUID');
    });
  });

  describe('Request Body Validation', () => {
    it('should accept valid partial update with rule_name only', async () => {
      const response = await request(app)
        .put(`/api/monitoring/alerts/rules/${validRuleId}`)
        .set('Authorization', validAdminAuth)
        .send({
          rule_name: 'Updated Rule Name'
        });

      expect(response.status).not.toBe(422);
    });

    it('should accept valid partial update with threshold_value only', async () => {
      const response = await request(app)
        .put(`/api/monitoring/alerts/rules/${validRuleId}`)
        .set('Authorization', validAdminAuth)
        .send({
          threshold_value: 90
        });

      expect(response.status).not.toBe(422);
    });

    it('should accept valid partial update with comparison_operator only', async () => {
      const response = await request(app)
        .put(`/api/monitoring/alerts/rules/${validRuleId}`)
        .set('Authorization', validAdminAuth)
        .send({
          comparison_operator: '<='
        });

      expect(response.status).not.toBe(422);
    });

    it('should accept valid partial update with notification_channels only', async () => {
      const response = await request(app)
        .put(`/api/monitoring/alerts/rules/${validRuleId}`)
        .set('Authorization', validAdminAuth)
        .send({
          notification_channels: ['email']
        });

      expect(response.status).not.toBe(422);
    });

    it('should accept valid partial update with is_active only', async () => {
      const response = await request(app)
        .put(`/api/monitoring/alerts/rules/${validRuleId}`)
        .set('Authorization', validAdminAuth)
        .send({
          is_active: false
        });

      expect(response.status).not.toBe(422);
    });

    it('should accept valid full update with all fields', async () => {
      const response = await request(app)
        .put(`/api/monitoring/alerts/rules/${validRuleId}`)
        .set('Authorization', validAdminAuth)
        .send(validUpdateData);

      expect(response.status).not.toBe(422);
    });

    it('should reject empty rule_name', async () => {
      const response = await request(app)
        .put(`/api/monitoring/alerts/rules/${validRuleId}`)
        .set('Authorization', validAdminAuth)
        .send({
          rule_name: ''
        });

      expect(response.status).toBe(422);
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'rule_name',
            message: expect.stringContaining('minLength')
          })
        ])
      );
    });

    it('should reject rule_name exceeding maximum length', async () => {
      const longName = 'x'.repeat(101); // Exceeds 100 character limit

      const response = await request(app)
        .put(`/api/monitoring/alerts/rules/${validRuleId}`)
        .set('Authorization', validAdminAuth)
        .send({
          rule_name: longName
        });

      expect(response.status).toBe(422);
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'rule_name',
            message: expect.stringContaining('maxLength')
          })
        ])
      );
    });

    it('should reject invalid comparison_operator', async () => {
      const response = await request(app)
        .put(`/api/monitoring/alerts/rules/${validRuleId}`)
        .set('Authorization', validAdminAuth)
        .send({
          comparison_operator: '!='
        });

      expect(response.status).toBe(422);
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'comparison_operator',
            message: expect.stringContaining('enum')
          })
        ])
      );
    });

    it('should accept all valid comparison operators', async () => {
      const operators = ['>', '<', '>=', '<=', '='];

      for (const operator of operators) {
        const response = await request(app)
          .put(`/api/monitoring/alerts/rules/${validRuleId}`)
          .set('Authorization', validAdminAuth)
          .send({
            comparison_operator: operator
          });

        expect(response.status).not.toBe(422);
      }
    });

    it('should reject invalid notification channels', async () => {
      const response = await request(app)
        .put(`/api/monitoring/alerts/rules/${validRuleId}`)
        .set('Authorization', validAdminAuth)
        .send({
          notification_channels: ['email', 'invalid_channel']
        });

      expect(response.status).toBe(422);
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'notification_channels',
            message: expect.stringContaining('enum')
          })
        ])
      );
    });

    it('should accept all valid notification channels', async () => {
      const channels = ['email', 'dashboard', 'sms'];

      const response = await request(app)
        .put(`/api/monitoring/alerts/rules/${validRuleId}`)
        .set('Authorization', validAdminAuth)
        .send({
          notification_channels: channels
        });

      expect(response.status).not.toBe(422);
    });

    it('should reject non-numeric threshold_value', async () => {
      const response = await request(app)
        .put(`/api/monitoring/alerts/rules/${validRuleId}`)
        .set('Authorization', validAdminAuth)
        .send({
          threshold_value: 'not_a_number'
        });

      expect(response.status).toBe(422);
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'threshold_value',
            message: expect.stringContaining('number')
          })
        ])
      );
    });

    it('should accept decimal threshold values', async () => {
      const response = await request(app)
        .put(`/api/monitoring/alerts/rules/${validRuleId}`)
        .set('Authorization', validAdminAuth)
        .send({
          threshold_value: 82.5
        });

      expect(response.status).not.toBe(422);
    });

    it('should reject non-boolean is_active value', async () => {
      const response = await request(app)
        .put(`/api/monitoring/alerts/rules/${validRuleId}`)
        .set('Authorization', validAdminAuth)
        .send({
          is_active: 'true'
        });

      expect(response.status).toBe(422);
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'is_active',
            message: expect.stringContaining('boolean')
          })
        ])
      );
    });

    it('should accept boolean is_active values', async () => {
      const response1 = await request(app)
        .put(`/api/monitoring/alerts/rules/${validRuleId}`)
        .set('Authorization', validAdminAuth)
        .send({
          is_active: true
        });

      const response2 = await request(app)
        .put(`/api/monitoring/alerts/rules/${validRuleId}`)
        .set('Authorization', validAdminAuth)
        .send({
          is_active: false
        });

      expect(response1.status).not.toBe(422);
      expect(response2.status).not.toBe(422);
    });

    it('should accept empty request body for no changes', async () => {
      const response = await request(app)
        .put(`/api/monitoring/alerts/rules/${validRuleId}`)
        .set('Authorization', validAdminAuth)
        .send({});

      expect(response.status).not.toBe(422);
    });
  });

  describe('Successful Response', () => {
    it('should return 200 when alert rule updated successfully', async () => {
      const response = await request(app)
        .put(`/api/monitoring/alerts/rules/${validRuleId}`)
        .set('Authorization', validAdminAuth)
        .send(validUpdateData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('updated');
    });

    it('should return updated rule data', async () => {
      const response = await request(app)
        .put(`/api/monitoring/alerts/rules/${validRuleId}`)
        .set('Authorization', validAdminAuth)
        .send(validUpdateData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('rule');
      expect(response.body.rule).toHaveProperty('id', validRuleId);
      expect(response.body.rule).toHaveProperty('rule_name', validUpdateData.rule_name);
      expect(response.body.rule).toHaveProperty('threshold_value', validUpdateData.threshold_value);
      expect(response.body.rule).toHaveProperty('comparison_operator', validUpdateData.comparison_operator);
      expect(response.body.rule).toHaveProperty('notification_channels');
      expect(response.body.rule).toHaveProperty('is_active', validUpdateData.is_active);
      expect(response.body.rule).toHaveProperty('updated_at');

      // Validate notification channels match
      expect(response.body.rule.notification_channels).toEqual(validUpdateData.notification_channels);

      // Validate updated_at is recent
      const updatedAt = new Date(response.body.rule.updated_at);
      const now = new Date();
      expect(now.getTime() - updatedAt.getTime()).toBeLessThan(5000); // Within 5 seconds
    });
  });

  describe('Error Handling', () => {
    it('should return 404 when alert rule not found', async () => {
      const nonExistentRuleId = '550e8400-e29b-41d4-a716-446655440999';

      const response = await request(app)
        .put(`/api/monitoring/alerts/rules/${nonExistentRuleId}`)
        .set('Authorization', validAdminAuth)
        .send(validUpdateData);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('not found');
    });
  });

  describe('Content Type Validation', () => {
    it('should require JSON content type', async () => {
      const response = await request(app)
        .put(`/api/monitoring/alerts/rules/${validRuleId}`)
        .set('Authorization', validAdminAuth)
        .set('Content-Type', 'text/plain')
        .send('rule_name=test');

      expect(response.status).toBe(415); // Unsupported Media Type
    });

    it('should accept application/json content type', async () => {
      const response = await request(app)
        .put(`/api/monitoring/alerts/rules/${validRuleId}`)
        .set('Authorization', validAdminAuth)
        .set('Content-Type', 'application/json')
        .send(JSON.stringify(validUpdateData));

      expect(response.status).not.toBe(415);
    });
  });

  describe('Response Headers', () => {
    it('should return JSON content type', async () => {
      const response = await request(app)
        .put(`/api/monitoring/alerts/rules/${validRuleId}`)
        .set('Authorization', validAdminAuth)
        .send(validUpdateData);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('Performance Requirements', () => {
    it('should respond within 500ms for update alert rule endpoint', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .put(`/api/monitoring/alerts/rules/${validRuleId}`)
        .set('Authorization', validAdminAuth)
        .send(validUpdateData);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(500);
    });
  });
});