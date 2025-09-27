/**
 * Contract Test: GET /api/security/vulnerabilities
 * Tests vulnerability listing endpoint contract validation
 * 
 * This test MUST FAIL initially as implementation doesn't exist yet (TDD approach)
 */

import request from 'supertest';
import { app } from '../../apps/backend/src/app';

describe('GET /api/security/vulnerabilities - Contract Test', () => {
  const adminToken = process.env.ADMIN_TEST_TOKEN || 'test-admin-token';
  
  describe('Authentication & Authorization', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/security/vulnerabilities')
        .expect(401);
      
      expect(response.body).toMatchObject({
        error: expect.stringContaining('Unauthorized')
      });
    });

    it('should require admin privileges', async () => {
      const businessToken = process.env.BUSINESS_TEST_TOKEN || 'test-business-token';
      
      const response = await request(app)
        .get('/api/security/vulnerabilities')
        .set('Authorization', `Bearer ${businessToken}`)
        .expect(403);
      
      expect(response.body).toMatchObject({
        error: expect.stringContaining('Forbidden')
      });
    });
  });

  describe('Response Contract Validation', () => {
    it('should return valid vulnerability list structure', async () => {
      const response = await request(app)
        .get('/api/security/vulnerabilities')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Validate response structure according to security-test-api.yaml
      expect(response.body).toMatchObject({
        vulnerabilities: expect.arrayContaining([
          expect.objectContaining({
            id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
            type: expect.any(String),
            severity: expect.stringMatching(/^(critical|high|medium|low|info)$/),
            title: expect.any(String),
            description: expect.any(String),
            affected_component: expect.any(String),
            discovery_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/),
            remediation_status: expect.stringMatching(/^(open|in_progress|fixed|accepted|wont_fix)$/),
            risk_score: expect.any(Number)
          })
        ]),
        pagination: expect.objectContaining({
          page: expect.any(Number),
          limit: expect.any(Number),
          total: expect.any(Number),
          has_next: expect.any(Boolean)
        })
      });
    });

    it('should validate risk score range (0-10)', async () => {
      const response = await request(app)
        .get('/api/security/vulnerabilities')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      response.body.vulnerabilities.forEach((vulnerability: any) => {
        expect(vulnerability.risk_score).toBeGreaterThanOrEqual(0);
        expect(vulnerability.risk_score).toBeLessThanOrEqual(10);
      });
    });

    it('should include CVE references when available', async () => {
      const response = await request(app)
        .get('/api/security/vulnerabilities')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      response.body.vulnerabilities.forEach((vulnerability: any) => {
        if (vulnerability.cve_reference) {
          expect(vulnerability.cve_reference).toMatch(/^CVE-\d{4}-\d{4,}$/);
        }
      });
    });
  });

  describe('Filtering Validation', () => {
    describe('Severity Filtering', () => {
      const severities = ['critical', 'high', 'medium', 'low', 'info'];
      
      severities.forEach(severity => {
        it(`should support filtering by ${severity} severity`, async () => {
          const response = await request(app)
            .get('/api/security/vulnerabilities')
            .query({ severity })
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);

          response.body.vulnerabilities.forEach((vulnerability: any) => {
            expect(vulnerability.severity).toBe(severity);
          });
        });
      });

      it('should reject invalid severity values', async () => {
        const response = await request(app)
          .get('/api/security/vulnerabilities')
          .query({ severity: 'invalid_severity' })
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400);

        expect(response.body.error).toMatch(/severity/i);
      });
    });

    describe('Status Filtering', () => {
      const statuses = ['open', 'in_progress', 'fixed', 'accepted', 'wont_fix'];
      
      statuses.forEach(status => {
        it(`should support filtering by ${status} status`, async () => {
          const response = await request(app)
            .get('/api/security/vulnerabilities')
            .query({ status })
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);

          response.body.vulnerabilities.forEach((vulnerability: any) => {
            expect(vulnerability.remediation_status).toBe(status);
          });
        });
      });

      it('should reject invalid status values', async () => {
        const response = await request(app)
          .get('/api/security/vulnerabilities')
          .query({ status: 'invalid_status' })
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400);

        expect(response.body.error).toMatch(/status/i);
      });
    });

    describe('Component Filtering', () => {
      it('should support filtering by affected component', async () => {
        const testComponent = 'auth_middleware';
        
        const response = await request(app)
          .get('/api/security/vulnerabilities')
          .query({ component: testComponent })
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        response.body.vulnerabilities.forEach((vulnerability: any) => {
          expect(vulnerability.affected_component).toMatch(new RegExp(testComponent, 'i'));
        });
      });
    });
  });

  describe('Pagination Validation', () => {
    it('should support pagination parameters', async () => {
      const response = await request(app)
        .get('/api/security/vulnerabilities')
        .query({ page: 1, limit: 10 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 10,
        total: expect.any(Number),
        has_next: expect.any(Boolean)
      });

      expect(response.body.vulnerabilities.length).toBeLessThanOrEqual(10);
    });

    it('should handle pagination edge cases', async () => {
      // Test with very large page number
      const response = await request(app)
        .get('/api/security/vulnerabilities')
        .query({ page: 999999, limit: 10 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.vulnerabilities).toEqual([]);
      expect(response.body.pagination.has_next).toBe(false);
    });
  });

  describe('Critical Vulnerability Prioritization', () => {
    it('should prioritize critical vulnerabilities in response', async () => {
      const response = await request(app)
        .get('/api/security/vulnerabilities')
        .query({ severity: 'critical' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      response.body.vulnerabilities.forEach((vulnerability: any) => {
        expect(vulnerability.severity).toBe('critical');
        expect(vulnerability.risk_score).toBeGreaterThanOrEqual(7); // Critical should have high risk scores
        
        // Critical vulnerabilities should have remediation deadlines
        if (vulnerability.remediation_status === 'open' || vulnerability.remediation_status === 'in_progress') {
          expect(vulnerability).toHaveProperty('remediation_deadline');
        }
      });
    });

    it('should validate remediation deadline requirements', async () => {
      const response = await request(app)
        .get('/api/security/vulnerabilities')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      response.body.vulnerabilities.forEach((vulnerability: any) => {
        if (vulnerability.remediation_deadline) {
          expect(vulnerability.remediation_deadline).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/);
          
          // Validate remediation timeline requirements from data model
          const discoveryDate = new Date(vulnerability.discovery_date);
          const deadline = new Date(vulnerability.remediation_deadline);
          const hoursDiff = (deadline.getTime() - discoveryDate.getTime()) / (1000 * 60 * 60);
          
          if (vulnerability.severity === 'critical') {
            expect(hoursDiff).toBeLessThanOrEqual(24); // 24 hours for critical
          } else if (vulnerability.severity === 'high') {
            expect(hoursDiff).toBeLessThanOrEqual(72); // 72 hours for high
          }
        }
      });
    });
  });

  describe('OWASP Top 10 Coverage', () => {
    it('should include OWASP Top 10 vulnerability categories', async () => {
      const response = await request(app)
        .get('/api/security/vulnerabilities')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const vulnerabilityTypes = response.body.vulnerabilities.map((v: any) => v.type.toLowerCase());
      
      // Should include common OWASP categories
      const owaspCategories = [
        'injection',
        'broken_authentication',
        'sensitive_data_exposure',
        'xml_external_entities',
        'broken_access_control',
        'security_misconfiguration',
        'cross_site_scripting',
        'insecure_deserialization',
        'components_with_vulnerabilities',
        'insufficient_logging'
      ];

      // At least some OWASP categories should be present if vulnerabilities exist
      if (vulnerabilityTypes.length > 0) {
        const foundCategories = owaspCategories.filter(category =>
          vulnerabilityTypes.some(type => type.includes(category))
        );
        expect(foundCategories.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Performance Validation', () => {
    it('should respond within acceptable time limits', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/api/security/vulnerabilities')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(500); // Constitutional requirement
    });

    it('should handle large result sets efficiently', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/security/vulnerabilities')
        .query({ limit: 100 }) // Request large page
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(2000); // Should handle large sets within 2s
      expect(response.body.vulnerabilities.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Security Context Validation', () => {
    it('should include security-relevant vulnerability metadata', async () => {
      const response = await request(app)
        .get('/api/security/vulnerabilities')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      response.body.vulnerabilities.forEach((vulnerability: any) => {
        // Should include component context for security analysis
        expect(vulnerability.affected_component).toBeDefined();
        expect(vulnerability.affected_component).not.toBe('');
        
        // Should include discovery context
        expect(vulnerability.discovery_date).toBeDefined();
        
        // Should include risk assessment
        expect(vulnerability.risk_score).toBeDefined();
        expect(typeof vulnerability.risk_score).toBe('number');
      });
    });

    it('should support component-based security analysis', async () => {
      const response = await request(app)
        .get('/api/security/vulnerabilities')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Group vulnerabilities by component for analysis
      const componentGroups = response.body.vulnerabilities.reduce((groups: any, vuln: any) => {
        const component = vuln.affected_component;
        if (!groups[component]) groups[component] = [];
        groups[component].push(vuln);
        return groups;
      }, {});

      // Each component should have consistent vulnerability data
      Object.values(componentGroups).forEach((vulns: any) => {
        vulns.forEach((vuln: any) => {
          expect(vuln.affected_component).toBeDefined();
          expect(vuln.type).toBeDefined();
          expect(vuln.severity).toBeDefined();
        });
      });
    });
  });
});