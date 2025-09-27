import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { createServer } from '../../src/app';
import { Application } from 'express';

// Contract tests for Templates API
// These tests verify API contracts match the specification
// Expected to FAIL initially (TDD approach)

describe('Templates API Contract Tests', () => {
  let app: Application;
  let server: any;

  beforeAll(async () => {
    app = createServer();
    server = app.listen(0); // Use random port for testing
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
  });

  beforeEach(() => {
    // Reset any test state if needed
  });

  describe('GET /api/admin/communication/templates', () => {
    it('should list all communication templates', async () => {
      const response = await request(app)
        .get('/api/admin/communication/templates')
        .set('Authorization', 'Bearer admin-jwt-token')
        .expect(200);

      expect(response.body).toMatchObject({
        templates: expect.any(Array),
        total_count: expect.any(Number),
        has_more: expect.any(Boolean)
      });

      if (response.body.templates.length > 0) {
        expect(response.body.templates[0]).toMatchObject({
          id: expect.any(String),
          name: expect.any(String),
          notification_type: expect.stringMatching(/^(reward_earned|payment_confirmed|verification_request|payment_overdue|support_response|weekly_summary|verification_failed)$/),
          channel: expect.stringMatching(/^(sms|email|internal)$/),
          language: expect.any(String),
          content_template: expect.any(String),
          required_variables: expect.any(Array),
          is_active: expect.any(Boolean),
          version: expect.any(Number),
          created_at: expect.any(String),
          updated_at: expect.any(String)
        });
      }
    });

    it('should filter templates by notification_type', async () => {
      const response = await request(app)
        .get('/api/admin/communication/templates')
        .query({ notification_type: 'reward_earned' })
        .set('Authorization', 'Bearer admin-jwt-token')
        .expect(200);

      response.body.templates.forEach((template: any) => {
        expect(template.notification_type).toBe('reward_earned');
      });
    });

    it('should filter templates by channel', async () => {
      const response = await request(app)
        .get('/api/admin/communication/templates')
        .query({ channel: 'sms' })
        .set('Authorization', 'Bearer admin-jwt-token')
        .expect(200);

      response.body.templates.forEach((template: any) => {
        expect(template.channel).toBe('sms');
      });
    });

    it('should filter templates by language', async () => {
      const response = await request(app)
        .get('/api/admin/communication/templates')
        .query({ language: 'sv' })
        .set('Authorization', 'Bearer admin-jwt-token')
        .expect(200);

      response.body.templates.forEach((template: any) => {
        expect(template.language).toBe('sv');
      });
    });

    it('should filter templates by active status', async () => {
      const response = await request(app)
        .get('/api/admin/communication/templates')
        .query({ is_active: false })
        .set('Authorization', 'Bearer admin-jwt-token')
        .expect(200);

      response.body.templates.forEach((template: any) => {
        expect(template.is_active).toBe(false);
      });
    });

    it('should respect pagination limits', async () => {
      const response = await request(app)
        .get('/api/admin/communication/templates')
        .query({ limit: 5, offset: 0 })
        .set('Authorization', 'Bearer admin-jwt-token')
        .expect(200);

      expect(response.body.templates.length).toBeLessThanOrEqual(5);
    });

    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .get('/api/admin/communication/templates')
        .set('Authorization', 'Bearer customer-jwt-token')
        .expect(403);

      expect(response.body).toMatchObject({
        error: 'forbidden',
        message: 'Admin privileges required for template management'
      });
    });
  });

  describe('GET /api/admin/communication/templates/{id}', () => {
    it('should get specific template details', async () => {
      const templateId = 'test-template-uuid';

      const response = await request(app)
        .get(`/api/admin/communication/templates/${templateId}`)
        .set('Authorization', 'Bearer admin-jwt-token')
        .expect(200);

      expect(response.body).toMatchObject({
        id: templateId,
        name: expect.any(String),
        notification_type: expect.any(String),
        channel: expect.any(String),
        language: expect.any(String),
        content_template: expect.any(String),
        required_variables: expect.any(Array),
        is_active: expect.any(Boolean),
        version: expect.any(Number),
        created_by: {
          id: expect.any(String),
          name: expect.any(String),
          email: expect.any(String)
        },
        created_at: expect.any(String),
        updated_at: expect.any(String),
        usage_stats: {
          total_sent: expect.any(Number),
          last_used: expect.any(String),
          success_rate: expect.any(Number)
        }
      });

      // SMS templates should have null subject_template
      if (response.body.channel === 'sms') {
        expect(response.body.subject_template).toBeNull();
      }
      // Email templates should have subject_template
      if (response.body.channel === 'email') {
        expect(response.body.subject_template).toBeDefined();
      }
    });

    it('should return 404 for non-existent template', async () => {
      const response = await request(app)
        .get('/api/admin/communication/templates/non-existent-uuid')
        .set('Authorization', 'Bearer admin-jwt-token')
        .expect(404);

      expect(response.body).toMatchObject({
        error: 'template_not_found',
        message: 'Communication template not found'
      });
    });
  });

  describe('POST /api/admin/communication/templates', () => {
    it('should create new SMS communication template', async () => {
      const requestBody = {
        name: 'payment_confirmed_sms_sv',
        notification_type: 'payment_confirmed',
        channel: 'sms',
        language: 'sv',
        subject_template: null,
        content_template: 'Betalning mottagen! {{amount}} SEK har skickats till {{phone_number}} för din feedback från {{store_name}}. Tack! /STOP för att avsluta',
        required_variables: ['amount', 'phone_number', 'store_name']
      };

      const response = await request(app)
        .post('/api/admin/communication/templates')
        .set('Authorization', 'Bearer admin-jwt-token')
        .send(requestBody)
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        name: requestBody.name,
        notification_type: requestBody.notification_type,
        channel: requestBody.channel,
        language: requestBody.language,
        content_template: requestBody.content_template,
        required_variables: requestBody.required_variables,
        is_active: true,
        version: 1,
        created_at: expect.any(String)
      });
    });

    it('should create new email communication template', async () => {
      const requestBody = {
        name: 'verification_request_email_sv',
        notification_type: 'verification_request',
        channel: 'email',
        language: 'sv',
        subject_template: 'Verifiering krävs för {{store_name}}',
        content_template: 'Hej {{business_name}}, ny verifieringsdatabas tillgänglig. Deadline: {{deadline}}. Logga in för att granska transaktioner.',
        required_variables: ['business_name', 'store_name', 'deadline']
      };

      const response = await request(app)
        .post('/api/admin/communication/templates')
        .set('Authorization', 'Bearer admin-jwt-token')
        .send(requestBody)
        .expect(201);

      expect(response.body.subject_template).toBe(requestBody.subject_template);
    });

    it('should return 400 for SMS template exceeding character limit', async () => {
      const longContent = 'A'.repeat(1700); // Exceeds 1600 char limit
      const requestBody = {
        name: 'too_long_sms_template',
        notification_type: 'reward_earned',
        channel: 'sms',
        language: 'sv',
        content_template: longContent,
        required_variables: []
      };

      const response = await request(app)
        .post('/api/admin/communication/templates')
        .set('Authorization', 'Bearer admin-jwt-token')
        .send(requestBody)
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'validation_error',
        details: expect.arrayContaining([
          expect.objectContaining({
            field: 'content_template',
            message: expect.stringContaining('1600 character limit')
          })
        ])
      });
    });

    it('should return 400 for missing required variables', async () => {
      const requestBody = {
        name: 'missing_variables_template',
        notification_type: 'reward_earned',
        channel: 'sms',
        language: 'sv',
        content_template: 'Hello {{customer_name}}, you earned {{amount}}!',
        required_variables: ['customer_name'] // Missing 'amount'
      };

      const response = await request(app)
        .post('/api/admin/communication/templates')
        .set('Authorization', 'Bearer admin-jwt-token')
        .send(requestBody)
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'validation_error',
        details: expect.arrayContaining([
          expect.objectContaining({
            field: 'required_variables',
            message: expect.stringContaining('amount')
          })
        ])
      });
    });

    it('should return 409 for duplicate template name', async () => {
      const requestBody = {
        name: 'existing_template_name',
        notification_type: 'reward_earned',
        channel: 'sms',
        language: 'sv',
        content_template: 'Test template',
        required_variables: []
      };

      const response = await request(app)
        .post('/api/admin/communication/templates')
        .set('Authorization', 'Bearer admin-jwt-token')
        .send(requestBody)
        .expect(409);

      expect(response.body).toMatchObject({
        error: 'template_name_exists',
        message: 'Template name already exists for this notification type and channel'
      });
    });
  });

  describe('PUT /api/admin/communication/templates/{id}', () => {
    it('should update existing template and create new version', async () => {
      const templateId = 'test-template-uuid';
      const requestBody = {
        content_template: 'Grattis {{customer_name}}! Du har tjänat {{reward_amount}} SEK ({{feedback_score}}% kvalitet). Betalning {{payment_date}}. /STOP',
        required_variables: ['customer_name', 'reward_amount', 'feedback_score', 'payment_date'],
        is_active: true
      };

      const response = await request(app)
        .put(`/api/admin/communication/templates/${templateId}`)
        .set('Authorization', 'Bearer admin-jwt-token')
        .send(requestBody)
        .expect(200);

      expect(response.body).toMatchObject({
        id: templateId,
        version: expect.any(Number),
        content_template: requestBody.content_template,
        updated_at: expect.any(String),
        previous_version: expect.any(Number)
      });

      expect(response.body.version).toBeGreaterThan(response.body.previous_version);
    });

    it('should return 404 for non-existent template', async () => {
      const response = await request(app)
        .put('/api/admin/communication/templates/non-existent-uuid')
        .set('Authorization', 'Bearer admin-jwt-token')
        .send({ content_template: 'Updated content' })
        .expect(404);
    });
  });

  describe('POST /api/admin/communication/templates/{id}/preview', () => {
    it('should preview template with sample data', async () => {
      const templateId = 'test-template-uuid';
      const requestBody = {
        template_variables: {
          customer_name: 'Anna Andersson',
          reward_amount: '125.50',
          feedback_score: '87',
          payment_date: 'inom 7 dagar'
        }
      };

      const response = await request(app)
        .post(`/api/admin/communication/templates/${templateId}/preview`)
        .set('Authorization', 'Bearer admin-jwt-token')
        .send(requestBody)
        .expect(200);

      expect(response.body).toMatchObject({
        rendered_content: expect.any(String),
        character_count: expect.any(Number),
        sms_segments: expect.any(Number),
        estimated_cost: expect.any(String),
        validation: {
          valid: expect.any(Boolean),
          warnings: expect.any(Array)
        }
      });

      expect(response.body.rendered_content).toContain('Anna Andersson');
      expect(response.body.rendered_content).toContain('125.50');
    });

    it('should return validation errors for missing variables', async () => {
      const templateId = 'test-template-uuid';
      const requestBody = {
        template_variables: {
          customer_name: 'Anna Andersson'
          // Missing other required variables
        }
      };

      const response = await request(app)
        .post(`/api/admin/communication/templates/${templateId}/preview`)
        .set('Authorization', 'Bearer admin-jwt-token')
        .send(requestBody)
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'template_error',
        rendered_content: null,
        validation: {
          valid: false,
          warnings: expect.arrayContaining([
            expect.stringContaining('Missing required variable')
          ])
        }
      });
    });

    it('should warn about templates exceeding SMS length limit', async () => {
      const templateId = 'long-template-uuid';
      const requestBody = {
        template_variables: {
          customer_name: 'Very Long Customer Name That Will Make The Template Exceed Limits',
          reward_amount: '1000000.00',
          feedback_score: '100'
        }
      };

      const response = await request(app)
        .post(`/api/admin/communication/templates/${templateId}/preview`)
        .set('Authorization', 'Bearer admin-jwt-token')
        .send(requestBody)
        .expect(400);

      expect(response.body.validation.warnings).toEqual(
        expect.arrayContaining([
          expect.stringContaining('SMS length limit')
        ])
      );
    });
  });

  describe('GET /api/admin/communication/templates/{id}/versions', () => {
    it('should get template version history', async () => {
      const templateId = 'test-template-uuid';

      const response = await request(app)
        .get(`/api/admin/communication/templates/${templateId}/versions`)
        .set('Authorization', 'Bearer admin-jwt-token')
        .expect(200);

      expect(response.body).toMatchObject({
        template_id: templateId,
        current_version: expect.any(Number),
        versions: expect.any(Array)
      });

      if (response.body.versions.length > 0) {
        expect(response.body.versions[0]).toMatchObject({
          version: expect.any(Number),
          content_template: expect.any(String),
          is_active: expect.any(Boolean),
          created_at: expect.any(String),
          created_by: expect.any(String)
        });
      }
    });
  });

  describe('POST /api/admin/communication/templates/{id}/rollback', () => {
    it('should rollback to previous template version', async () => {
      const templateId = 'test-template-uuid';
      const requestBody = {
        target_version: 2,
        reason: 'New version causing delivery issues'
      };

      const response = await request(app)
        .post(`/api/admin/communication/templates/${templateId}/rollback`)
        .set('Authorization', 'Bearer admin-jwt-token')
        .send(requestBody)
        .expect(200);

      expect(response.body).toMatchObject({
        id: templateId,
        version: expect.any(Number),
        content_template: expect.any(String),
        is_active: true,
        rollback_reason: requestBody.reason,
        updated_at: expect.any(String)
      });

      expect(response.body.version).toBeGreaterThan(requestBody.target_version);
    });

    it('should return 400 for invalid target version', async () => {
      const templateId = 'test-template-uuid';
      const requestBody = {
        target_version: 999, // Non-existent version
        reason: 'Testing invalid rollback'
      };

      const response = await request(app)
        .post(`/api/admin/communication/templates/${templateId}/rollback`)
        .set('Authorization', 'Bearer admin-jwt-token')
        .send(requestBody)
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'validation_error',
        details: expect.arrayContaining([
          expect.objectContaining({
            field: 'target_version',
            message: expect.stringContaining('does not exist')
          })
        ])
      });
    });
  });

  describe('DELETE /api/admin/communication/templates/{id}', () => {
    it('should deactivate template (soft delete)', async () => {
      const templateId = 'test-template-uuid';

      const response = await request(app)
        .delete(`/api/admin/communication/templates/${templateId}`)
        .set('Authorization', 'Bearer admin-jwt-token')
        .expect(200);

      expect(response.body).toMatchObject({
        id: templateId,
        is_active: false,
        deactivated_at: expect.any(String),
        message: expect.stringContaining('Template deactivated successfully')
      });
    });

    it('should return 409 when template has pending notifications', async () => {
      const templateId = 'template-with-pending-notifications';

      const response = await request(app)
        .delete(`/api/admin/communication/templates/${templateId}`)
        .set('Authorization', 'Bearer admin-jwt-token')
        .expect(409);

      expect(response.body).toMatchObject({
        error: 'template_in_use',
        message: 'Cannot delete template with pending notifications',
        pending_notifications: expect.any(Number)
      });
    });
  });

  describe('GET /api/admin/communication/templates/variables', () => {
    it('should get available template variables by notification type', async () => {
      const response = await request(app)
        .get('/api/admin/communication/templates/variables')
        .query({ notification_type: 'reward_earned' })
        .set('Authorization', 'Bearer admin-jwt-token')
        .expect(200);

      expect(response.body).toMatchObject({
        notification_type: 'reward_earned',
        available_variables: expect.any(Object)
      });

      const variables = response.body.available_variables;
      const variableKeys = Object.keys(variables);
      
      // Should include common reward variables
      expect(variableKeys).toEqual(
        expect.arrayContaining(['customer_name', 'reward_amount', 'feedback_score'])
      );

      // Each variable should have proper metadata
      if (variables.customer_name) {
        expect(variables.customer_name).toMatchObject({
          description: expect.any(String),
          type: expect.any(String),
          example: expect.any(String)
        });
      }
    });

    it('should return 400 for missing notification_type', async () => {
      const response = await request(app)
        .get('/api/admin/communication/templates/variables')
        .set('Authorization', 'Bearer admin-jwt-token')
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'validation_error',
        details: expect.arrayContaining([
          expect.objectContaining({
            field: 'notification_type',
            message: expect.stringContaining('required')
          })
        ])
      });
    });
  });

  describe('POST /api/admin/communication/templates/validate', () => {
    it('should validate template syntax and variables', async () => {
      const requestBody = {
        content_template: 'Hello {{customer_name}}, you earned {{reward_amount}} SEK! /STOP',
        required_variables: ['customer_name', 'reward_amount'],
        notification_type: 'reward_earned',
        channel: 'sms'
      };

      const response = await request(app)
        .post('/api/admin/communication/templates/validate')
        .set('Authorization', 'Bearer admin-jwt-token')
        .send(requestBody)
        .expect(200);

      expect(response.body).toMatchObject({
        valid: expect.any(Boolean),
        errors: expect.any(Array),
        warnings: expect.any(Array),
        character_count: expect.any(Number),
        sms_segments: expect.any(Number)
      });
    });

    it('should detect undefined variables', async () => {
      const requestBody = {
        content_template: 'Hello {{customer_name}}, you got {{invalid_variable}} from {{store_name}}.',
        required_variables: ['customer_name', 'store_name'],
        notification_type: 'reward_earned',
        channel: 'sms'
      };

      const response = await request(app)
        .post('/api/admin/communication/templates/validate')
        .set('Authorization', 'Bearer admin-jwt-token')
        .send(requestBody)
        .expect(200);

      expect(response.body.valid).toBe(false);
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'undefined_variable',
            variable: 'invalid_variable',
            message: expect.stringContaining('not available for notification type')
          })
        ])
      );
    });

    it('should warn about missing unsubscribe option for SMS', async () => {
      const requestBody = {
        content_template: 'Hello {{customer_name}}, you earned {{reward_amount}} SEK!',
        required_variables: ['customer_name', 'reward_amount'],
        notification_type: 'reward_earned',
        channel: 'sms'
      };

      const response = await request(app)
        .post('/api/admin/communication/templates/validate')
        .set('Authorization', 'Bearer admin-jwt-token')
        .send(requestBody)
        .expect(200);

      expect(response.body.warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'missing_unsubscribe',
            message: expect.stringContaining('/STOP unsubscribe option')
          })
        ])
      );
    });
  });
});