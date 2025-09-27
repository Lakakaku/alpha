import request from 'supertest';
import { app } from '../../src/app';

describe('POST /api/monitoring/alerts/rules - Contract Test', () => {
  const validAdminAuth = 'Bearer valid-admin-token'; // Will be mocked

  const validRuleData = {
    rule_name: 'High CPU Usage Alert',
    metric_type: 'cpu_usage',
    threshold_value: 80,
    comparison_operator: '>',
    notification_channels: ['email', 'dashboard']
  };

  describe('Authentication Requirements', () => {
    it('should return 401 when no authentication provided', async () => {
      const response = await request(app)
        .post('/api/monitoring/alerts/rules')
        .send(validRuleData);

      expect(response.status).toBe(401);
    });

    it('should return 403 when user lacks monitoring permissions', async () => {
      const response = await request(app)
        .post('/api/monitoring/alerts/rules')
        .set('Authorization', 'Bearer invalid-admin-token')
        .send(validRuleData);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('monitoring');
    });
  });

  describe('Request Body Validation', () => {
    it('should accept valid request body with all required fields', async () => {
      const response = await request(app)
        .post('/api/monitoring/alerts/rules')
        .set('Authorization', validAdminAuth)
        .send(validRuleData);

      expect(response.status).not.toBe(422);
    });

    it('should reject request missing rule_name field', async () => {
      const invalidData = { ...validRuleData };
      delete invalidData.rule_name;

      const response = await request(app)
        .post('/api/monitoring/alerts/rules')
        .set('Authorization', validAdminAuth)
        .send(invalidData);

      expect(response.status).toBe(422);
      expect(response.body).toHaveProperty('error');
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'rule_name',
            message: expect.stringContaining('required')
          })
        ])
      );
    });

    it('should reject request missing metric_type field', async () => {
      const invalidData = { ...validRuleData };
      delete invalidData.metric_type;

      const response = await request(app)
        .post('/api/monitoring/alerts/rules')
        .set('Authorization', validAdminAuth)
        .send(invalidData);

      expect(response.status).toBe(422);
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'metric_type',
            message: expect.stringContaining('required')
          })
        ])
      );
    });

    it('should reject request missing threshold_value field', async () => {
      const invalidData = { ...validRuleData };
      delete invalidData.threshold_value;

      const response = await request(app)
        .post('/api/monitoring/alerts/rules')
        .set('Authorization', validAdminAuth)
        .send(invalidData);

      expect(response.status).toBe(422);
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'threshold_value',
            message: expect.stringContaining('required')
          })
        ])
      );
    });

    it('should reject request missing comparison_operator field', async () => {
      const invalidData = { ...validRuleData };
      delete invalidData.comparison_operator;

      const response = await request(app)
        .post('/api/monitoring/alerts/rules')
        .set('Authorization', validAdminAuth)
        .send(invalidData);

      expect(response.status).toBe(422);
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'comparison_operator',
            message: expect.stringContaining('required')
          })
        ])
      );
    });

    it('should reject request missing notification_channels field', async () => {
      const invalidData = { ...validRuleData };
      delete invalidData.notification_channels;

      const response = await request(app)
        .post('/api/monitoring/alerts/rules')
        .set('Authorization', validAdminAuth)
        .send(invalidData);

      expect(response.status).toBe(422);
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'notification_channels',
            message: expect.stringContaining('required')
          })
        ])
      );
    });

    it('should reject empty rule_name', async () => {
      const response = await request(app)
        .post('/api/monitoring/alerts/rules')
        .set('Authorization', validAdminAuth)
        .send({
          ...validRuleData,
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
        .post('/api/monitoring/alerts/rules')
        .set('Authorization', validAdminAuth)
        .send({
          ...validRuleData,
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
        .post('/api/monitoring/alerts/rules')
        .set('Authorization', validAdminAuth)
        .send({
          ...validRuleData,
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
          .post('/api/monitoring/alerts/rules')
          .set('Authorization', validAdminAuth)
          .send({
            ...validRuleData,
            comparison_operator: operator
          });

        expect(response.status).not.toBe(422);
      }
    });

    it('should reject empty notification_channels array', async () => {
      const response = await request(app)
        .post('/api/monitoring/alerts/rules')
        .set('Authorization', validAdminAuth)
        .send({
          ...validRuleData,
          notification_channels: []
        });

      expect(response.status).toBe(422);
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'notification_channels',
            message: expect.stringContaining('minItems')
          })
        ])
      );
    });

    it('should reject invalid notification channels', async () => {
      const response = await request(app)
        .post('/api/monitoring/alerts/rules')
        .set('Authorization', validAdminAuth)
        .send({
          ...validRuleData,
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
        .post('/api/monitoring/alerts/rules')
        .set('Authorization', validAdminAuth)
        .send({
          ...validRuleData,
          notification_channels: channels
        });

      expect(response.status).not.toBe(422);
    });

    it('should reject non-numeric threshold_value', async () => {
      const response = await request(app)
        .post('/api/monitoring/alerts/rules')
        .set('Authorization', validAdminAuth)
        .send({
          ...validRuleData,
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
        .post('/api/monitoring/alerts/rules')
        .set('Authorization', validAdminAuth)
        .send({
          ...validRuleData,
          threshold_value: 85.5
        });

      expect(response.status).not.toBe(422);
    });

    it('should accept negative threshold values', async () => {
      const response = await request(app)
        .post('/api/monitoring/alerts/rules')
        .set('Authorization', validAdminAuth)
        .send({
          ...validRuleData,
          threshold_value: -10
        });

      expect(response.status).not.toBe(422);
    });
  });

  describe('Successful Response', () => {
    it('should return 201 when alert rule created successfully', async () => {
      const response = await request(app)
        .post('/api/monitoring/alerts/rules')
        .set('Authorization', validAdminAuth)
        .send(validRuleData);

      expect(response.status).toBe(201);
    });

    it('should return the created alert rule with all fields', async () => {
      const response = await request(app)
        .post('/api/monitoring/alerts/rules')
        .set('Authorization', validAdminAuth)
        .send(validRuleData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('rule_name', validRuleData.rule_name);
      expect(response.body).toHaveProperty('metric_type', validRuleData.metric_type);
      expect(response.body).toHaveProperty('threshold_value', validRuleData.threshold_value);
      expect(response.body).toHaveProperty('comparison_operator', validRuleData.comparison_operator);
      expect(response.body).toHaveProperty('notification_channels');
      expect(response.body).toHaveProperty('is_active', true);
      expect(response.body).toHaveProperty('created_by');
      expect(response.body).toHaveProperty('created_at');

      // Validate generated fields
      expect(response.body.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(response.body.created_by).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(new Date(response.body.created_at)).toBeInstanceOf(Date);

      // Validate notification channels match
      expect(response.body.notification_channels).toEqual(validRuleData.notification_channels);
    });

    it('should set is_active to true by default', async () => {
      const response = await request(app)
        .post('/api/monitoring/alerts/rules')
        .set('Authorization', validAdminAuth)
        .send(validRuleData);

      expect(response.status).toBe(201);
      expect(response.body.is_active).toBe(true);
    });

    it('should set created_by to the authenticated admin user', async () => {
      const response = await request(app)
        .post('/api/monitoring/alerts/rules')
        .set('Authorization', validAdminAuth)
        .send(validRuleData);

      expect(response.status).toBe(201);
      expect(response.body.created_by).toBeDefined();
      expect(typeof response.body.created_by).toBe('string');
      expect(response.body.created_by).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });
  });

  describe('Content Type Validation', () => {
    it('should require JSON content type', async () => {
      const response = await request(app)
        .post('/api/monitoring/alerts/rules')
        .set('Authorization', validAdminAuth)
        .set('Content-Type', 'text/plain')
        .send('rule_name=test');

      expect(response.status).toBe(415); // Unsupported Media Type
    });

    it('should accept application/json content type', async () => {
      const response = await request(app)
        .post('/api/monitoring/alerts/rules')
        .set('Authorization', validAdminAuth)
        .set('Content-Type', 'application/json')
        .send(JSON.stringify(validRuleData));

      expect(response.status).not.toBe(415);
    });
  });

  describe('Response Headers', () => {
    it('should return JSON content type', async () => {
      const response = await request(app)
        .post('/api/monitoring/alerts/rules')
        .set('Authorization', validAdminAuth)
        .send(validRuleData);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('Performance Requirements', () => {
    it('should respond within 500ms for create alert rule endpoint', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .post('/api/monitoring/alerts/rules')
        .set('Authorization', validAdminAuth)
        .send(validRuleData);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(500);
    });
  });
});