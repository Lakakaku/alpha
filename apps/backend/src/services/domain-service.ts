import { DomainRegistry } from '../models/domain-registry';
import { SSLCertificateService } from './ssl-certificate-service';
import { supabase } from '@vocilia/database';
import { createLogger } from './loggingService';

const logger = createLogger('DomainService');

export interface DomainRegistrationRequest {
  domain_name: string;
  subdomain?: string;
  application_type: 'customer' | 'business' | 'admin' | 'api';
  environment: 'production' | 'staging' | 'development';
  ssl_enabled: boolean;
  contact_email: string;
}

export interface DNSRecord {
  type: 'A' | 'AAAA' | 'CNAME' | 'TXT' | 'MX';
  name: string;
  value: string;
  ttl: number;
  priority?: number;
}

export interface DomainValidationResult {
  is_configured: boolean;
  dns_records_valid: boolean;
  ssl_valid: boolean;
  performance_score: number;
  validation_errors: string[];
  dns_propagation_complete: boolean;
}

export interface DomainConfiguration {
  domain: DomainRegistry;
  dns_records: DNSRecord[];
  ssl_certificate_id?: string;
  performance_metrics: {
    response_time_ms: number;
    ttfb_ms: number;
    ssl_handshake_ms: number;
  };
}

export class DomainService {
  private static readonly DNS_PROPAGATION_TIMEOUT = 300000; // 5 minutes
  private static readonly PERFORMANCE_THRESHOLD_MS = 2000; // 2 seconds

  /**
   * Register and configure a new domain
   */
  static async registerDomain(request: DomainRegistrationRequest): Promise<DomainConfiguration> {
    try {
      const fullDomain = request.subdomain 
        ? `${request.subdomain}.${request.domain_name}`
        : request.domain_name;

      logger.info('Registering domain', { 
        domain: fullDomain, 
        application_type: request.application_type,
        environment: request.environment
      });

      // Check if domain already exists
      const existingDomain = await DomainRegistry.findByDomain(fullDomain);
      if (existingDomain) {
        throw new Error(`Domain already registered: ${fullDomain}`);
      }

      // Create domain registry entry
      const domain = await DomainRegistry.create({
        domain_name: fullDomain,
        application_type: request.application_type,
        environment: request.environment,
        ssl_enabled: request.ssl_enabled,
        contact_email: request.contact_email,
        registration_status: 'pending',
        dns_configured: false,
        performance_score: 0,
        created_at: new Date(),
        updated_at: new Date()
      });

      // Generate required DNS records
      const dnsRecords = await this.generateDNSRecords(domain, request);

      // Configure SSL certificate if enabled
      let sslCertificateId: string | undefined;
      if (request.ssl_enabled) {
        const certificate = await SSLCertificateService.provisionCertificate({
          domain: fullDomain,
          certificate_type: 'letsencrypt',
          contact_email: request.contact_email,
          auto_renewal: true
        });
        sslCertificateId = certificate.id;

        // Update domain with SSL certificate ID
        await DomainRegistry.update(domain.id, {
          ssl_certificate_id: certificate.id,
          updated_at: new Date()
        });
      }

      // Initial performance metrics (will be updated after DNS propagation)
      const performanceMetrics = {
        response_time_ms: 0,
        ttfb_ms: 0,
        ssl_handshake_ms: 0
      };

      logger.info('Domain registered successfully', { 
        domain_id: domain.id, 
        domain: fullDomain,
        ssl_enabled: request.ssl_enabled,
        ssl_certificate_id: sslCertificateId
      });

      return {
        domain,
        dns_records: dnsRecords,
        ssl_certificate_id: sslCertificateId,
        performance_metrics: performanceMetrics
      };
    } catch (error) {
      logger.error('Domain registration failed', { 
        domain: request.subdomain ? `${request.subdomain}.${request.domain_name}` : request.domain_name,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Validate domain configuration and DNS setup
   */
  static async validateDomainConfiguration(domainId: string): Promise<DomainValidationResult> {
    try {
      const domain = await DomainRegistry.findById(domainId);
      if (!domain) {
        throw new Error(`Domain not found: ${domainId}`);
      }

      logger.info('Validating domain configuration', { domain_id: domainId, domain: domain.domain_name });

      const validation_errors: string[] = [];
      let dns_records_valid = true;
      let ssl_valid = true;
      let dns_propagation_complete = true;

      // Validate DNS records
      const dnsValidation = await this.validateDNSRecords(domain);
      if (!dnsValidation.is_valid) {
        dns_records_valid = false;
        validation_errors.push(...dnsValidation.errors);
      }
      dns_propagation_complete = dnsValidation.propagation_complete;

      // Validate SSL certificate if enabled
      if (domain.ssl_enabled && domain.ssl_certificate_id) {
        try {
          const sslValidation = await SSLCertificateService.validateCertificate(domain.ssl_certificate_id);
          if (!sslValidation.is_valid) {
            ssl_valid = false;
            validation_errors.push(...sslValidation.validation_errors);
          }
        } catch (error) {
          ssl_valid = false;
          validation_errors.push('SSL certificate validation failed');
        }
      }

      // Performance validation
      const performanceMetrics = await this.measureDomainPerformance(domain.domain_name);
      const performance_score = this.calculatePerformanceScore(performanceMetrics);

      // Update domain with validation results
      await DomainRegistry.update(domainId, {
        dns_configured: dns_records_valid && dns_propagation_complete,
        performance_score,
        registration_status: (dns_records_valid && ssl_valid && dns_propagation_complete) ? 'active' : 'pending',
        updated_at: new Date()
      });

      const result: DomainValidationResult = {
        is_configured: dns_records_valid && ssl_valid && dns_propagation_complete,
        dns_records_valid,
        ssl_valid,
        performance_score,
        validation_errors,
        dns_propagation_complete
      };

      logger.info('Domain validation completed', { 
        domain_id: domainId, 
        is_configured: result.is_configured,
        performance_score,
        validation_errors: validation_errors.length
      });

      return result;
    } catch (error) {
      logger.error('Domain validation failed', { 
        domain_id: domainId, 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Update domain DNS configuration
   */
  static async updateDNSConfiguration(domainId: string, dnsRecords: DNSRecord[]): Promise<void> {
    try {
      const domain = await DomainRegistry.findById(domainId);
      if (!domain) {
        throw new Error(`Domain not found: ${domainId}`);
      }

      logger.info('Updating DNS configuration', { domain_id: domainId, domain: domain.domain_name, records: dnsRecords.length });

      // Validate DNS records format
      const validationErrors = this.validateDNSRecordsFormat(dnsRecords);
      if (validationErrors.length > 0) {
        throw new Error(`Invalid DNS records: ${validationErrors.join(', ')}`);
      }

      // Apply DNS records (integration with DNS provider would go here)
      await this.applyDNSRecords(domain.domain_name, dnsRecords);

      // Update domain status
      await DomainRegistry.update(domainId, {
        dns_configured: true,
        updated_at: new Date()
      });

      logger.info('DNS configuration updated successfully', { domain_id: domainId, domain: domain.domain_name });
    } catch (error) {
      logger.error('DNS configuration update failed', { 
        domain_id: domainId, 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get domains requiring configuration
   */
  static async getDomainsRequiringConfiguration(): Promise<DomainRegistry[]> {
    try {
      logger.info('Checking for domains requiring configuration');

      const { data, error } = await supabase
        .from('domain_registry')
        .select('*')
        .in('registration_status', ['pending', 'failed'])
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      const domains = data?.map(domain => DomainRegistry.fromDatabase(domain)) || [];
      
      logger.info('Found domains requiring configuration', { count: domains.length });
      
      return domains;
    } catch (error) {
      logger.error('Failed to get domains requiring configuration', { 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Delete domain configuration
   */
  static async deleteDomain(domainId: string): Promise<void> {
    try {
      const domain = await DomainRegistry.findById(domainId);
      if (!domain) {
        throw new Error(`Domain not found: ${domainId}`);
      }

      logger.info('Deleting domain configuration', { domain_id: domainId, domain: domain.domain_name });

      // Revoke SSL certificate if exists
      if (domain.ssl_certificate_id) {
        await SSLCertificateService.revokeCertificate(domain.ssl_certificate_id, 'Domain deletion');
      }

      // Remove DNS records
      await this.removeDNSRecords(domain.domain_name);

      // Delete domain registry entry
      await DomainRegistry.delete(domainId);

      logger.info('Domain configuration deleted successfully', { domain_id: domainId, domain: domain.domain_name });
    } catch (error) {
      logger.error('Domain deletion failed', { 
        domain_id: domainId, 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private static async generateDNSRecords(domain: DomainRegistry, request: DomainRegistrationRequest): Promise<DNSRecord[]> {
    const records: DNSRecord[] = [];

    // Generate records based on application type
    switch (request.application_type) {
      case 'api':
        records.push({
          type: 'A',
          name: domain.domain_name,
          value: '0.0.0.0', // Would be replaced with actual Railway IP
          ttl: 300
        });
        break;

      case 'customer':
      case 'business':
      case 'admin':
        records.push({
          type: 'CNAME',
          name: domain.domain_name,
          value: 'cname.vercel-dns.com', // Vercel CNAME
          ttl: 300
        });
        break;
    }

    // Add TXT record for domain verification
    records.push({
      type: 'TXT',
      name: `_vocilia-verify.${domain.domain_name}`,
      value: `vocilia-verification=${this.generateVerificationToken(domain.domain_name)}`,
      ttl: 300
    });

    return records;
  }

  private static async validateDNSRecords(domain: DomainRegistry): Promise<{ is_valid: boolean; errors: string[]; propagation_complete: boolean }> {
    const errors: string[] = [];
    let is_valid = true;
    let propagation_complete = true;

    try {
      // Check A/AAAA/CNAME records (mock implementation)
      const dnsLookup = await this.performDNSLookup(domain.domain_name);
      if (!dnsLookup.resolved) {
        is_valid = false;
        propagation_complete = false;
        errors.push('DNS records not propagated');
      }

      // Check TXT verification record
      const txtRecord = await this.lookupTXTRecord(`_vocilia-verify.${domain.domain_name}`);
      if (!txtRecord.found) {
        is_valid = false;
        errors.push('Verification TXT record not found');
      }
    } catch (error) {
      is_valid = false;
      errors.push('DNS lookup failed');
    }

    return { is_valid, errors, propagation_complete };
  }

  private static async measureDomainPerformance(domain: string): Promise<{ response_time_ms: number; ttfb_ms: number; ssl_handshake_ms: number }> {
    // Mock implementation - would measure actual performance
    return {
      response_time_ms: Math.floor(Math.random() * 1000) + 500,
      ttfb_ms: Math.floor(Math.random() * 300) + 100,
      ssl_handshake_ms: Math.floor(Math.random() * 200) + 50
    };
  }

  private static calculatePerformanceScore(metrics: { response_time_ms: number; ttfb_ms: number; ssl_handshake_ms: number }): number {
    const maxScore = 100;
    const responseTimePenalty = Math.max(0, metrics.response_time_ms - this.PERFORMANCE_THRESHOLD_MS) / 100;
    const ttfbPenalty = Math.max(0, metrics.ttfb_ms - 500) / 50;
    const sslPenalty = Math.max(0, metrics.ssl_handshake_ms - 200) / 20;

    return Math.max(0, maxScore - responseTimePenalty - ttfbPenalty - sslPenalty);
  }

  private static validateDNSRecordsFormat(records: DNSRecord[]): string[] {
    const errors: string[] = [];

    for (const record of records) {
      if (!record.name || !record.value || !record.type) {
        errors.push(`Invalid record format: ${JSON.stringify(record)}`);
      }

      if (record.ttl < 60 || record.ttl > 86400) {
        errors.push(`Invalid TTL value: ${record.ttl} (must be between 60 and 86400)`);
      }
    }

    return errors;
  }

  private static async applyDNSRecords(domain: string, records: DNSRecord[]): Promise<void> {
    // Implementation would integrate with DNS provider API
    logger.info('Applying DNS records', { domain, record_count: records.length });
  }

  private static async removeDNSRecords(domain: string): Promise<void> {
    // Implementation would remove DNS records via provider API
    logger.info('Removing DNS records', { domain });
  }

  private static async performDNSLookup(domain: string): Promise<{ resolved: boolean; ip?: string }> {
    // Mock DNS lookup implementation
    return { resolved: true, ip: '192.168.1.1' };
  }

  private static async lookupTXTRecord(record: string): Promise<{ found: boolean; value?: string }> {
    // Mock TXT record lookup
    return { found: true, value: 'vocilia-verification=abc123' };
  }

  private static generateVerificationToken(domain: string): string {
    return Buffer.from(`${domain}-${Date.now()}`).toString('base64').substring(0, 32);
  }
}

export default DomainService;