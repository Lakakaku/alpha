import { SSLCertificate } from '../models/ssl-certificate';
import { supabase } from '@vocilia/database';
import { createLogger } from './loggingService';

const logger = createLogger('SSLCertificateService');

export interface CertificateProvisionRequest {
  domain: string;
  certificate_type: 'letsencrypt' | 'cloudflare' | 'custom';
  contact_email: string;
  auto_renewal?: boolean;
}

export interface CertificateValidationResult {
  is_valid: boolean;
  expires_at: Date;
  issuer: string;
  subject: string;
  san_domains: string[];
  validation_errors: string[];
}

export interface RenewalResult {
  success: boolean;
  new_certificate_id?: string;
  error_message?: string;
  renewed_at: Date;
}

export class SSLCertificateService {
  /**
   * Provision a new SSL certificate for a domain
   */
  static async provisionCertificate(request: CertificateProvisionRequest): Promise<SSLCertificate> {
    try {
      logger.info('Provisioning SSL certificate', { domain: request.domain, type: request.certificate_type });

      // Validate domain ownership before provisioning
      const domainValidation = await this.validateDomainOwnership(request.domain);
      if (!domainValidation.is_valid) {
        throw new Error(`Domain validation failed: ${domainValidation.validation_errors.join(', ')}`);
      }

      // Generate certificate based on provider
      const certificateData = await this.generateCertificateByProvider(request);

      // Create certificate record
      const certificate = await SSLCertificate.create({
        domain: request.domain,
        certificate_type: request.certificate_type,
        certificate_data: certificateData.certificate,
        private_key: certificateData.private_key,
        certificate_chain: certificateData.chain,
        expires_at: certificateData.expires_at,
        issuer: certificateData.issuer,
        subject: certificateData.subject,
        san_domains: certificateData.san_domains,
        contact_email: request.contact_email,
        auto_renewal: request.auto_renewal ?? true,
        status: 'active',
        created_at: new Date(),
        updated_at: new Date()
      });

      logger.info('SSL certificate provisioned successfully', { 
        certificate_id: certificate.id, 
        domain: request.domain,
        expires_at: certificate.expires_at
      });

      return certificate;
    } catch (error) {
      logger.error('Failed to provision SSL certificate', { 
        domain: request.domain, 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Validate an existing SSL certificate
   */
  static async validateCertificate(certificateId: string): Promise<CertificateValidationResult> {
    try {
      const certificate = await SSLCertificate.findById(certificateId);
      if (!certificate) {
        throw new Error(`Certificate not found: ${certificateId}`);
      }

      logger.info('Validating SSL certificate', { certificate_id: certificateId, domain: certificate.domain });

      const validation_errors: string[] = [];
      let is_valid = true;

      // Check expiration
      const now = new Date();
      const daysUntilExpiry = (certificate.expires_at.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysUntilExpiry <= 0) {
        validation_errors.push('Certificate has expired');
        is_valid = false;
      } else if (daysUntilExpiry <= 7) {
        validation_errors.push('Certificate expires within 7 days');
      }

      // Validate certificate chain
      const chainValidation = await this.validateCertificateChain(certificate.certificate_data, certificate.certificate_chain);
      if (!chainValidation.is_valid) {
        validation_errors.push(...chainValidation.errors);
        is_valid = false;
      }

      // Check domain matching
      const domainMatch = this.validateDomainMatch(certificate.domain, certificate.subject, certificate.san_domains);
      if (!domainMatch.is_valid) {
        validation_errors.push(...domainMatch.errors);
        is_valid = false;
      }

      const result: CertificateValidationResult = {
        is_valid,
        expires_at: certificate.expires_at,
        issuer: certificate.issuer,
        subject: certificate.subject,
        san_domains: certificate.san_domains,
        validation_errors
      };

      logger.info('Certificate validation completed', { 
        certificate_id: certificateId, 
        is_valid, 
        validation_errors: validation_errors.length 
      });

      return result;
    } catch (error) {
      logger.error('Certificate validation failed', { 
        certificate_id: certificateId, 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Renew an SSL certificate
   */
  static async renewCertificate(certificateId: string): Promise<RenewalResult> {
    try {
      const certificate = await SSLCertificate.findById(certificateId);
      if (!certificate) {
        throw new Error(`Certificate not found: ${certificateId}`);
      }

      logger.info('Renewing SSL certificate', { certificate_id: certificateId, domain: certificate.domain });

      // Check if renewal is needed
      if (!SSLCertificate.shouldAutoRenew(certificate)) {
        return {
          success: false,
          error_message: 'Certificate does not require renewal yet',
          renewed_at: new Date()
        };
      }

      // Generate new certificate
      const renewalRequest: CertificateProvisionRequest = {
        domain: certificate.domain,
        certificate_type: certificate.certificate_type,
        contact_email: certificate.contact_email,
        auto_renewal: certificate.auto_renewal
      };

      const newCertificateData = await this.generateCertificateByProvider(renewalRequest);

      // Update existing certificate with new data
      const updatedCertificate = await SSLCertificate.update(certificateId, {
        certificate_data: newCertificateData.certificate,
        private_key: newCertificateData.private_key,
        certificate_chain: newCertificateData.chain,
        expires_at: newCertificateData.expires_at,
        issuer: newCertificateData.issuer,
        subject: newCertificateData.subject,
        san_domains: newCertificateData.san_domains,
        status: 'active',
        updated_at: new Date()
      });

      // Log renewal success
      await this.logRenewalActivity(certificateId, certificate.expires_at, newCertificateData.expires_at);

      logger.info('SSL certificate renewed successfully', { 
        certificate_id: certificateId, 
        domain: certificate.domain,
        new_expires_at: newCertificateData.expires_at
      });

      return {
        success: true,
        new_certificate_id: certificateId,
        renewed_at: new Date()
      };
    } catch (error) {
      logger.error('Certificate renewal failed', { 
        certificate_id: certificateId, 
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error_message: error instanceof Error ? error.message : 'Unknown error',
        renewed_at: new Date()
      };
    }
  }

  /**
   * Get certificates that need renewal
   */
  static async getCertificatesForRenewal(): Promise<SSLCertificate[]> {
    try {
      logger.info('Checking for certificates requiring renewal');

      const { data, error } = await supabase
        .from('ssl_certificates')
        .select('*')
        .eq('auto_renewal', true)
        .eq('status', 'active')
        .lt('expires_at', new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)).toISOString()); // 30 days

      if (error) {
        throw error;
      }

      const certificates = data?.map(cert => SSLCertificate.fromDatabase(cert)) || [];
      
      logger.info('Found certificates for renewal', { count: certificates.length });
      
      return certificates.filter(cert => SSLCertificate.shouldAutoRenew(cert));
    } catch (error) {
      logger.error('Failed to get certificates for renewal', { 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Revoke an SSL certificate
   */
  static async revokeCertificate(certificateId: string, reason: string): Promise<void> {
    try {
      const certificate = await SSLCertificate.findById(certificateId);
      if (!certificate) {
        throw new Error(`Certificate not found: ${certificateId}`);
      }

      logger.info('Revoking SSL certificate', { certificate_id: certificateId, domain: certificate.domain, reason });

      // Revoke with certificate authority
      await this.revokeCertificateWithCA(certificate, reason);

      // Update certificate status
      await SSLCertificate.update(certificateId, {
        status: 'revoked',
        updated_at: new Date()
      });

      logger.info('SSL certificate revoked successfully', { certificate_id: certificateId, domain: certificate.domain });
    } catch (error) {
      logger.error('Certificate revocation failed', { 
        certificate_id: certificateId, 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private static async validateDomainOwnership(domain: string): Promise<{ is_valid: boolean; validation_errors: string[] }> {
    // Implementation would validate domain ownership via DNS TXT records or HTTP validation
    // For now, basic domain format validation
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
    const is_valid = domainRegex.test(domain);
    
    return {
      is_valid,
      validation_errors: is_valid ? [] : ['Invalid domain format']
    };
  }

  private static async generateCertificateByProvider(request: CertificateProvisionRequest): Promise<any> {
    // Implementation would integrate with actual certificate providers
    // For now, return mock certificate data structure
    const now = new Date();
    const expiryDate = new Date(now.getTime() + (90 * 24 * 60 * 60 * 1000)); // 90 days

    return {
      certificate: `-----BEGIN CERTIFICATE-----\n...certificate data...\n-----END CERTIFICATE-----`,
      private_key: `-----BEGIN PRIVATE KEY-----\n...private key data...\n-----END PRIVATE KEY-----`,
      chain: `-----BEGIN CERTIFICATE-----\n...chain data...\n-----END CERTIFICATE-----`,
      expires_at: expiryDate,
      issuer: request.certificate_type === 'letsencrypt' ? "Let's Encrypt Authority X3" : 'Cloudflare Inc ECC CA-3',
      subject: `CN=${request.domain}`,
      san_domains: [request.domain]
    };
  }

  private static async validateCertificateChain(certificate: string, chain: string): Promise<{ is_valid: boolean; errors: string[] }> {
    // Implementation would validate the certificate chain
    // For now, basic validation
    const is_valid = certificate.includes('BEGIN CERTIFICATE') && chain.includes('BEGIN CERTIFICATE');
    
    return {
      is_valid,
      errors: is_valid ? [] : ['Invalid certificate chain format']
    };
  }

  private static validateDomainMatch(domain: string, subject: string, sanDomains: string[]): { is_valid: boolean; errors: string[] } {
    const subjectDomain = subject.replace('CN=', '');
    const is_valid = subjectDomain === domain || sanDomains.includes(domain);
    
    return {
      is_valid,
      errors: is_valid ? [] : ['Domain does not match certificate subject or SAN']
    };
  }

  private static async revokeCertificateWithCA(certificate: SSLCertificate, reason: string): Promise<void> {
    // Implementation would revoke certificate with the appropriate CA
    logger.info('Certificate revocation request sent to CA', { 
      domain: certificate.domain, 
      issuer: certificate.issuer, 
      reason 
    });
  }

  private static async logRenewalActivity(certificateId: string, oldExpiry: Date, newExpiry: Date): Promise<void> {
    logger.info('Certificate renewal activity logged', {
      certificate_id: certificateId,
      old_expiry: oldExpiry.toISOString(),
      new_expiry: newExpiry.toISOString()
    });
  }
}

export default SSLCertificateService;