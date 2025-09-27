import { SSLCertificateService } from '../../../apps/backend/src/services/ssl-certificate-service';
import { supabase } from '../../../packages/database/src/client/supabase';

// Mock Supabase client
jest.mock('../../../packages/database/src/client/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

// Mock crypto for certificate validation
jest.mock('crypto', () => ({
  createHash: jest.fn(() => ({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn(() => 'mocked-hash'),
  })),
  X509Certificate: jest.fn().mockImplementation(() => ({
    subject: 'CN=api.vocilia.com',
    issuer: 'CN=Let\'s Encrypt Authority X3',
    validFrom: new Date('2024-01-01').toISOString(),
    validTo: new Date('2024-04-01').toISOString(),
    fingerprint: 'AB:CD:EF:12:34:56',
  })),
}));

// Mock Railway and Vercel APIs
jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  create: jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  })),
}));

describe('SSLCertificateService', () => {
  let sslService: SSLCertificateService;
  const mockSupabaseFrom = supabase.from as jest.Mock;

  beforeEach(() => {
    sslService = new SSLCertificateService();
    jest.clearAllMocks();
  });

  describe('issueCertificate', () => {
    it('should issue SSL certificate for Railway domain', async () => {
      const mockInsert = jest.fn().mockResolvedValue({ 
        data: [{ certificate_id: 'cert-123' }], 
        error: null 
      });
      mockSupabaseFrom.mockReturnValue({ 
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({ insert: mockInsert })
        })
      });

      // Mock Railway API response
      const axios = require('axios');
      axios.post.mockResolvedValueOnce({
        status: 200,
        data: {
          id: 'railway-cert-123',
          domain: 'api.vocilia.com',
          status: 'active',
          issued_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
        },
      });

      const certificate = await sslService.issueCertificate(
        'api.vocilia.com',
        'railway'
      );

      expect(certificate.certificate_id).toBe('cert-123');
      expect(mockSupabaseFrom).toHaveBeenCalledWith('ssl_certificates');
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('railway'),
        expect.objectContaining({ domain: 'api.vocilia.com' })
      );
    });

    it('should issue SSL certificate for Vercel domain', async () => {
      const mockInsert = jest.fn().mockResolvedValue({ 
        data: [{ certificate_id: 'cert-456' }], 
        error: null 
      });
      mockSupabaseFrom.mockReturnValue({ 
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({ insert: mockInsert })
        })
      });

      // Mock Vercel API response
      const axios = require('axios');
      axios.post.mockResolvedValueOnce({
        status: 200,
        data: {
          uid: 'vercel-cert-456',
          name: 'customer.vocilia.com',
          created: Date.now(),
          expiration: Date.now() + (90 * 24 * 60 * 60 * 1000),
        },
      });

      const certificate = await sslService.issueCertificate(
        'customer.vocilia.com',
        'vercel'
      );

      expect(certificate.certificate_id).toBe('cert-456');
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('vercel'),
        expect.objectContaining({ name: 'customer.vocilia.com' })
      );
    });

    it('should handle certificate issuance failures', async () => {
      const axios = require('axios');
      axios.post.mockRejectedValueOnce(new Error('Domain validation failed'));

      await expect(sslService.issueCertificate('invalid.domain.com', 'railway'))
        .rejects.toThrow('Failed to issue SSL certificate');
    });

    it('should validate domain format before issuance', async () => {
      await expect(sslService.issueCertificate('invalid-domain', 'railway'))
        .rejects.toThrow('Invalid domain format');
    });
  });

  describe('renewCertificate', () => {
    it('should renew expiring certificate automatically', async () => {
      const expiringCert = {
        certificate_id: 'cert-123',
        domain: 'api.vocilia.com',
        platform: 'railway' as const,
        status: 'active' as const,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        auto_renewal: true,
      };

      const mockSelect = jest.fn().mockResolvedValue({
        data: [expiringCert],
        error: null,
      });
      const mockUpdate = jest.fn().mockResolvedValue({
        data: [{ certificate_id: 'cert-123' }],
        error: null,
      });

      mockSupabaseFrom.mockReturnValueOnce({ 
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({ select: mockSelect })
        })
      });
      mockSupabaseFrom.mockReturnValueOnce({ 
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({ update: mockUpdate })
          })
        })
      });

      // Mock successful renewal API call
      const axios = require('axios');
      axios.put.mockResolvedValueOnce({
        status: 200,
        data: {
          id: 'railway-cert-123',
          status: 'active',
          expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        },
      });

      const renewed = await sslService.renewCertificate('cert-123');

      expect(renewed.success).toBe(true);
      expect(axios.put).toHaveBeenCalled();
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'active',
          last_renewal_attempt: expect.any(Date),
        })
      );
    });

    it('should not renew certificate if auto_renewal is disabled', async () => {
      const cert = {
        certificate_id: 'cert-456',
        domain: 'business.vocilia.com',
        platform: 'vercel' as const,
        status: 'active' as const,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        auto_renewal: false,
      };

      const mockSelect = jest.fn().mockResolvedValue({
        data: [cert],
        error: null,
      });
      mockSupabaseFrom.mockReturnValue({ 
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({ select: mockSelect })
        })
      });

      const result = await sslService.renewCertificate('cert-456');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Auto-renewal disabled');
    });

    it('should handle renewal API failures gracefully', async () => {
      const cert = {
        certificate_id: 'cert-789',
        domain: 'admin.vocilia.com',
        platform: 'vercel' as const,
        status: 'active' as const,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        auto_renewal: true,
      };

      const mockSelect = jest.fn().mockResolvedValue({
        data: [cert],
        error: null,
      });
      const mockUpdate = jest.fn().mockResolvedValue({
        data: [{ certificate_id: 'cert-789' }],
        error: null,
      });

      mockSupabaseFrom.mockReturnValueOnce({ 
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({ select: mockSelect })
        })
      });
      mockSupabaseFrom.mockReturnValueOnce({ 
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({ update: mockUpdate })
          })
        })
      });

      const axios = require('axios');
      axios.put.mockRejectedValueOnce(new Error('Rate limit exceeded'));

      const result = await sslService.renewCertificate('cert-789');

      expect(result.success).toBe(false);
      expect(result.reason).toContain('Rate limit exceeded');
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          last_renewal_attempt: expect.any(Date),
        })
      );
    });
  });

  describe('validateCertificate', () => {
    it('should validate active certificate successfully', async () => {
      const cert = {
        certificate_id: 'cert-123',
        domain: 'api.vocilia.com',
        platform: 'railway' as const,
        certificate_hash: 'existing-hash',
      };

      const mockSelect = jest.fn().mockResolvedValue({
        data: [cert],
        error: null,
      });
      mockSupabaseFrom.mockReturnValue({ 
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({ select: mockSelect })
        })
      });

      // Mock successful certificate fetch
      const axios = require('axios');
      axios.get.mockResolvedValueOnce({
        status: 200,
        data: {
          certificate: '-----BEGIN CERTIFICATE-----\nMOCKED_CERT_DATA\n-----END CERTIFICATE-----',
          valid: true,
          domain: 'api.vocilia.com',
        },
      });

      const validation = await sslService.validateCertificate('cert-123');

      expect(validation.is_valid).toBe(true);
      expect(validation.domain_match).toBe(true);
      expect(validation.certificate_id).toBe('cert-123');
    });

    it('should detect certificate domain mismatch', async () => {
      const cert = {
        certificate_id: 'cert-456',
        domain: 'api.vocilia.com',
        platform: 'vercel' as const,
        certificate_hash: 'existing-hash',
      };

      const mockSelect = jest.fn().mockResolvedValue({
        data: [cert],
        error: null,
      });
      mockSupabaseFrom.mockReturnValue({ 
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({ select: mockSelect })
        })
      });

      const axios = require('axios');
      axios.get.mockResolvedValueOnce({
        status: 200,
        data: {
          certificate: '-----BEGIN CERTIFICATE-----\nMOCKED_CERT_DATA\n-----END CERTIFICATE-----',
          valid: true,
          domain: 'wrong.domain.com', // Domain mismatch
        },
      });

      const validation = await sslService.validateCertificate('cert-456');

      expect(validation.is_valid).toBe(false);
      expect(validation.domain_match).toBe(false);
      expect(validation.validation_errors).toContain('Domain mismatch');
    });

    it('should handle certificate validation errors', async () => {
      const cert = {
        certificate_id: 'cert-789',
        domain: 'invalid.domain.com',
        platform: 'railway' as const,
        certificate_hash: 'hash',
      };

      const mockSelect = jest.fn().mockResolvedValue({
        data: [cert],
        error: null,
      });
      mockSupabaseFrom.mockReturnValue({ 
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({ select: mockSelect })
        })
      });

      const axios = require('axios');
      axios.get.mockRejectedValueOnce(new Error('Certificate not found'));

      const validation = await sslService.validateCertificate('cert-789');

      expect(validation.is_valid).toBe(false);
      expect(validation.validation_errors).toContain('Certificate not found');
    });
  });

  describe('getCertificateStatus', () => {
    it('should return comprehensive certificate status', async () => {
      const activeCert = {
        certificate_id: 'cert-123',
        domain: 'api.vocilia.com',
        platform: 'railway',
        status: 'active',
        issued_at: new Date('2024-01-01').toISOString(),
        expires_at: new Date('2024-04-01').toISOString(),
        auto_renewal: true,
        last_renewal_attempt: new Date('2024-01-01').toISOString(),
      };

      const mockSelect = jest.fn().mockResolvedValue({
        data: [activeCert],
        error: null,
      });
      mockSupabaseFrom.mockReturnValue({ 
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({ select: mockSelect })
        })
      });

      const status = await sslService.getCertificateStatus('api.vocilia.com');

      expect(status.domain).toBe('api.vocilia.com');
      expect(status.is_valid).toBe(true);
      expect(status.expires_in_days).toBeGreaterThanOrEqual(0);
      expect(status.renewal_status).toBe('enabled');
    });

    it('should detect expiring certificates', async () => {
      const expiringCert = {
        certificate_id: 'cert-456',
        domain: 'business.vocilia.com',
        platform: 'vercel',
        status: 'active',
        issued_at: new Date('2024-01-01').toISOString(),
        expires_at: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 days
        auto_renewal: true,
        last_renewal_attempt: null,
      };

      const mockSelect = jest.fn().mockResolvedValue({
        data: [expiringCert],
        error: null,
      });
      mockSupabaseFrom.mockReturnValue({ 
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({ select: mockSelect })
        })
      });

      const status = await sslService.getCertificateStatus('business.vocilia.com');

      expect(status.is_expiring_soon).toBe(true);
      expect(status.expires_in_days).toBeLessThan(30);
      expect(status.needs_attention).toBe(true);
    });

    it('should handle missing certificate domains', async () => {
      const mockSelect = jest.fn().mockResolvedValue({
        data: [],
        error: null,
      });
      mockSupabaseFrom.mockReturnValue({ 
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({ select: mockSelect })
        })
      });

      const status = await sslService.getCertificateStatus('nonexistent.domain.com');

      expect(status.domain).toBe('nonexistent.domain.com');
      expect(status.is_valid).toBe(false);
      expect(status.certificate_exists).toBe(false);
      expect(status.needs_attention).toBe(true);
    });
  });

  describe('getExpiringCertificates', () => {
    it('should return certificates expiring within specified days', async () => {
      const mockSelect = jest.fn().mockResolvedValue({
        data: [
          {
            certificate_id: 'cert-1',
            domain: 'api.vocilia.com',
            expires_at: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
            auto_renewal: true,
          },
          {
            certificate_id: 'cert-2',
            domain: 'customer.vocilia.com',
            expires_at: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
            auto_renewal: false,
          },
        ],
        error: null,
      });
      mockSupabaseFrom.mockReturnValue({ 
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            lt: jest.fn().mockReturnValue({ select: mockSelect })
          })
        })
      });

      const expiring = await sslService.getExpiringCertificates(30);

      expect(expiring).toHaveLength(2);
      expect(expiring[0].domain).toBe('api.vocilia.com');
      expect(expiring[1].auto_renewal).toBe(false);
    });

    it('should return empty array when no certificates are expiring', async () => {
      const mockSelect = jest.fn().mockResolvedValue({
        data: [],
        error: null,
      });
      mockSupabaseFrom.mockReturnValue({ 
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            lt: jest.fn().mockReturnValue({ select: mockSelect })
          })
        })
      });

      const expiring = await sslService.getExpiringCertificates(30);

      expect(expiring).toHaveLength(0);
    });
  });

  describe('scheduleRenewalChecks', () => {
    it('should schedule daily renewal check cron job', () => {
      const nodeCron = require('node-cron');
      const mockSchedule = jest.fn();
      
      // Mock node-cron module
      jest.doMock('node-cron', () => ({
        schedule: mockSchedule,
        validate: jest.fn(() => true),
      }));

      const SSLService = require('../../../apps/backend/src/services/ssl-certificate-service').SSLCertificateService;
      const service = new SSLService();

      service.scheduleRenewalChecks();

      expect(mockSchedule).toHaveBeenCalledWith(
        '0 6 * * *', // Daily at 6 AM
        expect.any(Function),
        { timezone: 'Europe/Stockholm' }
      );
    });
  });

  describe('revokeAllCertificates', () => {
    it('should revoke all certificates for domain during emergency', async () => {
      const mockUpdate = jest.fn().mockResolvedValue({
        data: [
          { certificate_id: 'cert-1' },
          { certificate_id: 'cert-2' },
        ],
        error: null,
      });
      mockSupabaseFrom.mockReturnValue({ 
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({ update: mockUpdate })
          })
        })
      });

      const axios = require('axios');
      axios.delete.mockResolvedValue({ status: 200 });

      const result = await sslService.revokeAllCertificates(
        'compromised.domain.com',
        'Security incident - certificate compromise'
      );

      expect(result.success).toBe(true);
      expect(result.revoked_count).toBe(2);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'revoked',
          revoked_at: expect.any(Date),
          revocation_reason: 'Security incident - certificate compromise',
        })
      );
    });
  });
});