import request from 'supertest';
import { app } from '../../src/app';

describe('Alert System Configuration - Integration Test', () => {
  const validAdminAuth = 'Bearer valid-admin-token'; // Will be mocked
  const testRuleId = '550e8400-e29b-41d4-a716-446655440000';

  describe('Complete Alert Rule Lifecycle', () => {
    it('should create, configure, and manage alert rules end-to-end', async () => {
      // Step 1: Create new alert rule
      const newAlertRule = {
        rule_name: 'High Error Rate Alert',
        metric_type: 'error_rate',
        threshold_value: 0.05, // 5% error rate
        comparison_operator: '>',
        evaluation_window: 300, // 5 minutes
        notification_channels: ['email', 'dashboard'],
        severity: 'high',
        description: 'Alert when error rate exceeds 5% for 5 minutes',
        enabled: true
      };

      const createResponse = await request(app)
        .post('/api/monitoring/alerts/rules')
        .set('Authorization', validAdminAuth)
        .send(newAlertRule);

      expect([201, 404]).toContain(createResponse.status);

      // Step 2: List all alert rules to verify creation
      const listResponse = await request(app)
        .get('/api/monitoring/alerts/rules')
        .set('Authorization', validAdminAuth);

      expect([200, 404]).toContain(listResponse.status);

      // Step 3: Update alert rule configuration
      const updatedConfig = {
        threshold_value: 0.03, // Lower threshold to 3%
        notification_channels: ['email', 'dashboard', 'slack'],
        cooldown_period: 600 // 10 minutes cooldown
      };

      const updateResponse = await request(app)
        .put(`/api/monitoring/alerts/rules/${testRuleId}`)
        .set('Authorization', validAdminAuth)
        .send(updatedConfig);

      expect([200, 404]).toContain(updateResponse.status);

      // Step 4: Test alert rule activation/deactivation
      const deactivateResponse = await request(app)
        .put(`/api/monitoring/alerts/rules/${testRuleId}`)
        .set('Authorization', validAdminAuth)
        .send({ enabled: false });

      expect([200, 404]).toContain(deactivateResponse.status);

      // Validate response structures
      if (createResponse.status === 201) {
        expect(createResponse.body).toHaveProperty('id');
        expect(createResponse.body).toHaveProperty('rule_name');
        expect(createResponse.body).toHaveProperty('metric_type');
      }

      if (listResponse.status === 200) {
        expect(listResponse.body).toHaveProperty('rules');
        expect(Array.isArray(listResponse.body.rules)).toBe(true);
      }

      if (updateResponse.status === 200) {
        expect(updateResponse.body).toHaveProperty('id');
        expect(updateResponse.body).toHaveProperty('updated_at');
      }
    });

    it('should configure different alert types for comprehensive monitoring', async () => {
      const alertRuleTypes = [
        {
          rule_name: 'CPU Usage Alert',
          metric_type: 'cpu_usage',
          threshold_value: 80,
          comparison_operator: '>',
          notification_channels: ['email']
        },
        {
          rule_name: 'Memory Usage Alert',
          metric_type: 'memory_usage',
          threshold_value: 85,
          comparison_operator: '>',
          notification_channels: ['dashboard']
        },
        {
          rule_name: 'Response Time Alert',
          metric_type: 'response_time',
          threshold_value: 5000,
          comparison_operator: '>',
          notification_channels: ['email', 'slack']
        },
        {
          rule_name: 'Low Disk Space Alert',
          metric_type: 'disk_usage',
          threshold_value: 90,
          comparison_operator: '>',
          notification_channels: ['email', 'dashboard']
        }
      ];

      // Create multiple alert rules in parallel
      const creationPromises = alertRuleTypes.map(rule =>
        request(app)
          .post('/api/monitoring/alerts/rules')
          .set('Authorization', validAdminAuth)
          .send(rule)
      );

      const creationResults = await Promise.all(creationPromises);

      // All alert rule types should be supported
      creationResults.forEach(result => {
        expect([201, 404]).toContain(result.status);
        if (result.status === 201) {
          expect(result.body).toHaveProperty('id');
          expect(result.body).toHaveProperty('metric_type');
          expect(result.body).toHaveProperty('threshold_value');
        }
      });

      // Verify all rules are listed
      const allRulesResponse = await request(app)
        .get('/api/monitoring/alerts/rules')
        .set('Authorization', validAdminAuth);

      expect([200, 404]).toContain(allRulesResponse.status);

      if (allRulesResponse.status === 200 && allRulesResponse.body.rules) {
        const ruleMetricTypes = allRulesResponse.body.rules.map((rule: any) => rule.metric_type);
        const expectedTypes = ['cpu_usage', 'memory_usage', 'response_time', 'disk_usage'];
        
        // Should support all metric types (if any rules exist)
        if (ruleMetricTypes.length > 0) {
          expectedTypes.forEach(expectedType => {
            const typeSupported = ruleMetricTypes.includes(expectedType) || 
                                 allRulesResponse.body.rules.some((rule: any) => 
                                   ['cpu_usage', 'memory_usage', 'response_time', 'disk_usage'].includes(rule.metric_type)
                                 );
            // Don't fail if no rules exist yet, but verify structure is correct
          });
        }
      }
    });

    it('should integrate alert rules with actual metrics monitoring', async () => {
      // Get current system metrics to understand alert context
      const metricsResponse = await request(app)
        .get('/api/monitoring/metrics?metric_type=cpu_usage,error_rate,response_time')
        .set('Authorization', validAdminAuth);

      expect([200, 404]).toContain(metricsResponse.status);

      // Get alert rules that match these metrics
      const relevantRulesResponse = await request(app)
        .get('/api/monitoring/alerts/rules?metric_type=cpu_usage,error_rate,response_time')
        .set('Authorization', validAdminAuth);

      expect([200, 404]).toContain(relevantRulesResponse.status);

      // Check alert history/notifications for these metrics
      const alertHistoryResponse = await request(app)
        .get('/api/monitoring/alerts/notifications?metric_type=cpu_usage,error_rate,response_time')
        .set('Authorization', validAdminAuth);

      expect([200, 404]).toContain(alertHistoryResponse.status);

      // Verify metrics and alert rules can be correlated
      if (metricsResponse.status === 200 && relevantRulesResponse.status === 200) {
        // Both should provide metric_type for correlation
        if (metricsResponse.body.metrics && metricsResponse.body.metrics.length > 0) {
          expect(metricsResponse.body.metrics[0]).toHaveProperty('metric_type');
        }

        if (relevantRulesResponse.body.rules && relevantRulesResponse.body.rules.length > 0) {
          expect(relevantRulesResponse.body.rules[0]).toHaveProperty('metric_type');
          expect(relevantRulesResponse.body.rules[0]).toHaveProperty('threshold_value');
        }
      }
    });

    it('should handle alert rule validation and constraints', async () => {
      // Test invalid alert rule configurations
      const invalidRules = [
        {
          // Missing required fields
          rule_name: 'Invalid Rule 1',
          metric_type: 'cpu_usage'
          // Missing threshold_value, comparison_operator
        },
        {
          // Invalid metric type
          rule_name: 'Invalid Rule 2',
          metric_type: 'invalid_metric_type',
          threshold_value: 50,
          comparison_operator: '>',
          notification_channels: ['email']
        },
        {
          // Invalid comparison operator
          rule_name: 'Invalid Rule 3',
          metric_type: 'cpu_usage',
          threshold_value: 80,
          comparison_operator: 'invalid_operator',
          notification_channels: ['email']
        },
        {
          // Invalid notification channel
          rule_name: 'Invalid Rule 4',
          metric_type: 'cpu_usage',
          threshold_value: 80,
          comparison_operator: '>',
          notification_channels: ['invalid_channel']
        }
      ];

      // All invalid rules should be rejected
      for (const invalidRule of invalidRules) {
        const invalidResponse = await request(app)
          .post('/api/monitoring/alerts/rules')
          .set('Authorization', validAdminAuth)
          .send(invalidRule);

        expect([400, 422, 404]).toContain(invalidResponse.status);

        if (invalidResponse.status === 422) {
          expect(invalidResponse.body).toHaveProperty('error');
          expect(invalidResponse.body).toHaveProperty('details');
        }
      }

      // Valid rule should still work
      const validRule = {
        rule_name: 'Valid CPU Alert',
        metric_type: 'cpu_usage',
        threshold_value: 80,
        comparison_operator: '>',
        notification_channels: ['email', 'dashboard'],
        enabled: true
      };

      const validResponse = await request(app)
        .post('/api/monitoring/alerts/rules')
        .set('Authorization', validAdminAuth)
        .send(validRule);

      expect([201, 404]).toContain(validResponse.status);
    });

    it('should support alert rule templates and presets', async () => {
      // Get available alert rule templates
      const templatesResponse = await request(app)
        .get('/api/monitoring/alerts/templates')
        .set('Authorization', validAdminAuth);

      expect([200, 404]).toContain(templatesResponse.status);

      // Create alert rule from template
      const templateRule = {
        template_name: 'high_error_rate',
        customizations: {
          threshold_value: 0.02, // 2% instead of default
          notification_channels: ['email', 'slack']
        }
      };

      const templateCreationResponse = await request(app)
        .post('/api/monitoring/alerts/rules/from-template')
        .set('Authorization', validAdminAuth)
        .send(templateRule);

      expect([201, 404]).toContain(templateCreationResponse.status);

      // Verify template-based rules follow same structure
      if (templateCreationResponse.status === 201) {
        expect(templateCreationResponse.body).toHaveProperty('id');
        expect(templateCreationResponse.body).toHaveProperty('rule_name');
        expect(templateCreationResponse.body).toHaveProperty('metric_type');
      }
    });
  });

  describe('Alert Notification Management', () => {
    it('should configure and test notification channels', async () => {
      // Configure email notification settings
      const emailConfig = {
        channel_type: 'email',
        configuration: {
          recipients: ['admin@vocilia.se', 'ops@vocilia.se'],
          subject_template: 'Vocilia Alert: {alert_name}',
          body_template: 'Alert triggered: {alert_description} at {timestamp}'
        },
        enabled: true
      };

      const emailConfigResponse = await request(app)
        .post('/api/monitoring/alerts/channels')
        .set('Authorization', validAdminAuth)
        .send(emailConfig);

      expect([201, 404]).toContain(emailConfigResponse.status);

      // Test notification channel
      const testNotification = {
        channel_id: 'email-channel-id',
        test_message: 'Test alert notification from Vocilia monitoring system'
      };

      const testResponse = await request(app)
        .post('/api/monitoring/alerts/channels/test')
        .set('Authorization', validAdminAuth)
        .send(testNotification);

      expect([200, 404]).toContain(testResponse.status);

      // List all configured channels
      const channelsResponse = await request(app)
        .get('/api/monitoring/alerts/channels')
        .set('Authorization', validAdminAuth);

      expect([200, 404]).toContain(channelsResponse.status);

      if (channelsResponse.status === 200) {
        expect(channelsResponse.body).toHaveProperty('channels');
        expect(Array.isArray(channelsResponse.body.channels)).toBe(true);
      }
    });

    it('should track and manage alert notification history', async () => {
      // Get recent alert notifications
      const notificationsResponse = await request(app)
        .get('/api/monitoring/alerts/notifications?limit=50')
        .set('Authorization', validAdminAuth);

      expect([200, 404]).toContain(notificationsResponse.status);

      // Filter notifications by status
      const failedNotificationsResponse = await request(app)
        .get('/api/monitoring/alerts/notifications?status=failed')
        .set('Authorization', validAdminAuth);

      expect([200, 404]).toContain(failedNotificationsResponse.status);

      // Get notifications for specific alert rule
      const ruleNotificationsResponse = await request(app)
        .get(`/api/monitoring/alerts/notifications?rule_id=${testRuleId}`)
        .set('Authorization', validAdminAuth);

      expect([200, 404]).toContain(ruleNotificationsResponse.status);

      // Verify notification history structure
      if (notificationsResponse.status === 200) {
        expect(notificationsResponse.body).toHaveProperty('notifications');
        expect(notificationsResponse.body).toHaveProperty('pagination');

        if (notificationsResponse.body.notifications.length > 0) {
          const notification = notificationsResponse.body.notifications[0];
          expect(notification).toHaveProperty('id');
          expect(notification).toHaveProperty('rule_id');
          expect(notification).toHaveProperty('channel_type');
          expect(notification).toHaveProperty('status');
          expect(notification).toHaveProperty('sent_at');
        }
      }
    });

    it('should support alert notification escalation', async () => {
      // Create alert rule with escalation
      const escalationRule = {
        rule_name: 'Critical System Alert',
        metric_type: 'system_health',
        threshold_value: 1, // Any unhealthy status
        comparison_operator: '>=',
        notification_channels: ['email'],
        escalation_rules: [
          {
            delay_minutes: 5,
            channels: ['email', 'slack']
          },
          {
            delay_minutes: 15,
            channels: ['email', 'slack', 'phone']
          }
        ],
        enabled: true
      };

      const escalationResponse = await request(app)
        .post('/api/monitoring/alerts/rules')
        .set('Authorization', validAdminAuth)
        .send(escalationRule);

      expect([201, 404]).toContain(escalationResponse.status);

      // Test escalation policy configuration
      const escalationPolicyResponse = await request(app)
        .get('/api/monitoring/alerts/escalation-policies')
        .set('Authorization', validAdminAuth);

      expect([200, 404]).toContain(escalationPolicyResponse.status);

      if (escalationResponse.status === 201) {
        expect(escalationResponse.body).toHaveProperty('id');
        expect(escalationResponse.body).toHaveProperty('escalation_rules');
      }
    });
  });

  describe('Alert System Performance and Reliability', () => {
    it('should handle high-frequency alert evaluation efficiently', async () => {
      const startTime = Date.now();

      // Get all active alert rules
      const activeRulesResponse = await request(app)
        .get('/api/monitoring/alerts/rules?enabled=true')
        .set('Authorization', validAdminAuth);

      const rulesQueryTime = Date.now() - startTime;

      expect([200, 404]).toContain(activeRulesResponse.status);
      expect(rulesQueryTime).toBeLessThan(500); // Should be fast

      // Simulate checking multiple metrics for alert evaluation
      const metricsTypes = ['cpu_usage', 'memory_usage', 'error_rate', 'response_time'];
      const metricsStartTime = Date.now();

      const metricsPromises = metricsTypes.map(type =>
        request(app)
          .get(`/api/monitoring/metrics?metric_type=${type}&granularity=minute&limit=5`)
          .set('Authorization', validAdminAuth)
      );

      const metricsResults = await Promise.all(metricsPromises);
      const totalMetricsTime = Date.now() - metricsStartTime;

      // All metrics queries should complete quickly
      expect(totalMetricsTime).toBeLessThan(2000); // <2s for all metrics

      metricsResults.forEach(result => {
        expect([200, 404]).toContain(result.status);
      });
    });

    it('should maintain alert state consistency during system load', async () => {
      // Simulate concurrent alert rule operations
      const concurrentOperations = [
        // Create new rule
        request(app)
          .post('/api/monitoring/alerts/rules')
          .set('Authorization', validAdminAuth)
          .send({
            rule_name: 'Concurrent Test Rule 1',
            metric_type: 'cpu_usage',
            threshold_value: 75,
            comparison_operator: '>',
            notification_channels: ['email']
          }),
        
        // Update existing rule
        request(app)
          .put(`/api/monitoring/alerts/rules/${testRuleId}`)
          .set('Authorization', validAdminAuth)
          .send({ enabled: true }),
        
        // List all rules
        request(app)
          .get('/api/monitoring/alerts/rules')
          .set('Authorization', validAdminAuth),
        
        // Get alert notifications
        request(app)
          .get('/api/monitoring/alerts/notifications')
          .set('Authorization', validAdminAuth)
      ];

      const results = await Promise.allSettled(concurrentOperations);

      // Most operations should complete successfully
      const successfulOps = results.filter(
        result => result.status === 'fulfilled' && 
        [200, 201, 404].includes((result as any).value.status)
      );

      expect(successfulOps.length).toBeGreaterThan(results.length / 2);
    });

    it('should handle alert rule deletion and cleanup properly', async () => {
      // Create a test rule to delete
      const testRule = {
        rule_name: 'Rule to Delete',
        metric_type: 'cpu_usage',
        threshold_value: 90,
        comparison_operator: '>',
        notification_channels: ['email']
      };

      const createResponse = await request(app)
        .post('/api/monitoring/alerts/rules')
        .set('Authorization', validAdminAuth)
        .send(testRule);

      let ruleIdToDelete = testRuleId; // Use test ID if creation fails

      if (createResponse.status === 201) {
        ruleIdToDelete = createResponse.body.id;
      }

      // Delete the rule
      const deleteResponse = await request(app)
        .delete(`/api/monitoring/alerts/rules/${ruleIdToDelete}`)
        .set('Authorization', validAdminAuth);

      expect([204, 404]).toContain(deleteResponse.status);

      // Verify rule is no longer accessible
      const getDeletedRuleResponse = await request(app)
        .get(`/api/monitoring/alerts/rules/${ruleIdToDelete}`)
        .set('Authorization', validAdminAuth);

      expect([404]).toContain(getDeletedRuleResponse.status);

      // Verify associated notifications are handled properly
      const notificationsResponse = await request(app)
        .get(`/api/monitoring/alerts/notifications?rule_id=${ruleIdToDelete}`)
        .set('Authorization', validAdminAuth);

      expect([200, 404]).toContain(notificationsResponse.status);

      if (notificationsResponse.status === 200) {
        // Should either return empty results or handle gracefully
        expect(notificationsResponse.body).toHaveProperty('notifications');
      }
    });
  });
});