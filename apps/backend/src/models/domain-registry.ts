export interface DomainRegistry {
  domain_id: string;
  environment_id: string;
  domain_name: string;
  subdomain?: string;
  full_domain: string;
  domain_type: 'primary' | 'subdomain' | 'wildcard' | 'redirect';
  app_name: string;
  platform: 'railway' | 'vercel' | 'supabase';
  ssl_certificate_id?: string;
  dns_provider: 'cloudflare' | 'route53' | 'namecheap' | 'godaddy' | 'other';
  dns_status: 'pending' | 'configured' | 'propagated' | 'failed';
  ssl_status: 'pending' | 'issued' | 'active' | 'expired' | 'failed';
  verification_status: 'pending' | 'verified' | 'failed';
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  verified_at?: Date;
  expires_at?: Date;
}

export interface DNSRecord {
  record_id: string;
  domain_id: string;
  record_type: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'NS';
  name: string;
  value: string;
  ttl: number;
  priority?: number;
  status: 'pending' | 'active' | 'failed';
  created_at: Date;
  updated_at: Date;
}

export interface DomainConfiguration {
  redirect_rules: RedirectRule[];
  caching_config: CachingConfig;
  security_headers: SecurityHeaders;
  custom_headers: Record<string, string>;
}

export interface RedirectRule {
  source_path: string;
  destination_url: string;
  status_code: 301 | 302 | 307 | 308;
  preserve_query: boolean;
}

export interface CachingConfig {
  enabled: boolean;
  ttl_seconds: number;
  cache_control: string;
  vary_headers: string[];
}

export interface SecurityHeaders {
  hsts_enabled: boolean;
  hsts_max_age: number;
  content_security_policy?: string;
  x_frame_options: 'DENY' | 'SAMEORIGIN' | 'ALLOW-FROM';
  x_content_type_options: boolean;
  referrer_policy: string;
}

export class DomainRegistryModel {
  private static readonly DOMAIN_REGEX = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
  private static readonly SUBDOMAIN_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;

  static validate(domain: Partial<DomainRegistry>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!domain.domain_id) {
      errors.push('domain_id is required');
    }

    if (!domain.environment_id) {
      errors.push('environment_id is required');
    }

    if (!domain.domain_name) {
      errors.push('domain_name is required');
    } else if (!this.DOMAIN_REGEX.test(domain.domain_name)) {
      errors.push('domain_name must be a valid domain format');
    }

    if (domain.subdomain && !this.SUBDOMAIN_REGEX.test(domain.subdomain)) {
      errors.push('subdomain must be a valid subdomain format');
    }

    if (!domain.full_domain) {
      errors.push('full_domain is required');
    }

    if (!domain.domain_type || !['primary', 'subdomain', 'wildcard', 'redirect'].includes(domain.domain_type)) {
      errors.push('domain_type must be primary, subdomain, wildcard, or redirect');
    }

    if (!domain.app_name) {
      errors.push('app_name is required');
    }

    if (!domain.platform || !['railway', 'vercel', 'supabase'].includes(domain.platform)) {
      errors.push('platform must be railway, vercel, or supabase');
    }

    if (!domain.dns_provider || !['cloudflare', 'route53', 'namecheap', 'godaddy', 'other'].includes(domain.dns_provider)) {
      errors.push('dns_provider must be cloudflare, route53, namecheap, godaddy, or other');
    }

    if (!domain.dns_status || !['pending', 'configured', 'propagated', 'failed'].includes(domain.dns_status)) {
      errors.push('dns_status must be pending, configured, propagated, or failed');
    }

    if (!domain.ssl_status || !['pending', 'issued', 'active', 'expired', 'failed'].includes(domain.ssl_status)) {
      errors.push('ssl_status must be pending, issued, active, expired, or failed');
    }

    if (!domain.verification_status || !['pending', 'verified', 'failed'].includes(domain.verification_status)) {
      errors.push('verification_status must be pending, verified, or failed');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static buildFullDomain(domainName: string, subdomain?: string): string {
    if (!subdomain) return domainName;
    return `${subdomain}.${domainName}`;
  }

  static isFullyConfigured(domain: DomainRegistry): boolean {
    return domain.dns_status === 'propagated' && 
           domain.ssl_status === 'active' && 
           domain.verification_status === 'verified' &&
           domain.is_active;
  }

  static requiresAttention(domain: DomainRegistry): boolean {
    // Failed states
    if (domain.dns_status === 'failed') return true;
    if (domain.ssl_status === 'failed') return true;
    if (domain.verification_status === 'failed') return true;

    // Expired SSL
    if (domain.ssl_status === 'expired') return true;

    // Domain expiring soon (within 30 days)
    if (domain.expires_at) {
      const daysUntilExpiry = (domain.expires_at.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      if (daysUntilExpiry < 30) return true;
    }

    // Stuck in pending states for too long (> 24 hours)
    const pendingTime = Date.now() - domain.created_at.getTime();
    const maxPendingMs = 24 * 60 * 60 * 1000;
    
    if ((domain.dns_status === 'pending' || 
         domain.ssl_status === 'pending' || 
         domain.verification_status === 'pending') && 
        pendingTime > maxPendingMs) {
      return true;
    }

    return false;
  }

  static getConfigurationStatus(domain: DomainRegistry): 'complete' | 'in_progress' | 'failed' | 'pending' {
    if (this.requiresAttention(domain)) return 'failed';
    if (this.isFullyConfigured(domain)) return 'complete';
    
    const hasStarted = domain.dns_status !== 'pending' || 
                      domain.ssl_status !== 'pending' || 
                      domain.verification_status !== 'pending';
    
    return hasStarted ? 'in_progress' : 'pending';
  }

  static createDomainRecord(
    environmentId: string,
    domainName: string,
    subdomain: string | undefined,
    appName: string,
    platform: DomainRegistry['platform'],
    dnsProvider: DomainRegistry['dns_provider'] = 'cloudflare'
  ): DomainRegistry {
    const now = new Date();
    const fullDomain = this.buildFullDomain(domainName, subdomain);
    const domainType = subdomain ? 'subdomain' : 'primary';

    return {
      domain_id: `domain_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      environment_id: environmentId,
      domain_name: domainName,
      subdomain,
      full_domain: fullDomain,
      domain_type: domainType,
      app_name: appName,
      platform,
      dns_provider: dnsProvider,
      dns_status: 'pending',
      ssl_status: 'pending',
      verification_status: 'pending',
      is_active: false,
      created_at: now,
      updated_at: now
    };
  }

  static createDNSRecord(
    domainId: string,
    recordType: DNSRecord['record_type'],
    name: string,
    value: string,
    ttl: number = 300,
    priority?: number
  ): DNSRecord {
    const now = new Date();

    return {
      record_id: `dns_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      domain_id: domainId,
      record_type: recordType,
      name,
      value,
      ttl,
      priority,
      status: 'pending',
      created_at: now,
      updated_at: now
    };
  }

  static getDefaultSecurityHeaders(): SecurityHeaders {
    return {
      hsts_enabled: true,
      hsts_max_age: 31536000, // 1 year
      content_security_policy: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';",
      x_frame_options: 'DENY',
      x_content_type_options: true,
      referrer_policy: 'strict-origin-when-cross-origin'
    };
  }

  static getDefaultCachingConfig(): CachingConfig {
    return {
      enabled: true,
      ttl_seconds: 3600, // 1 hour
      cache_control: 'public, max-age=3600',
      vary_headers: ['Accept-Encoding', 'Authorization']
    };
  }

  static validateDNSRecord(record: Partial<DNSRecord>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!record.domain_id) {
      errors.push('domain_id is required');
    }

    if (!record.record_type || !['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS'].includes(record.record_type)) {
      errors.push('record_type must be A, AAAA, CNAME, MX, TXT, or NS');
    }

    if (!record.name) {
      errors.push('name is required');
    }

    if (!record.value) {
      errors.push('value is required');
    }

    if (!record.ttl || record.ttl < 60 || record.ttl > 86400) {
      errors.push('ttl must be between 60 and 86400 seconds');
    }

    // Validate record-specific requirements
    if (record.record_type === 'MX' && !record.priority) {
      errors.push('priority is required for MX records');
    }

    if (record.record_type === 'A' && record.value) {
      const ipv4Regex = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      if (!ipv4Regex.test(record.value)) {
        errors.push('A record value must be a valid IPv4 address');
      }
    }

    if (record.record_type === 'AAAA' && record.value) {
      const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
      if (!ipv6Regex.test(record.value)) {
        errors.push('AAAA record value must be a valid IPv6 address');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static getDomainsByApp(domains: DomainRegistry[], appName: string): DomainRegistry[] {
    return domains.filter(d => d.app_name === appName);
  }

  static getActiveDomains(domains: DomainRegistry[]): DomainRegistry[] {
    return domains.filter(d => d.is_active && this.isFullyConfigured(d));
  }

  static getDomainsRequiringAttention(domains: DomainRegistry[]): DomainRegistry[] {
    return domains.filter(d => this.requiresAttention(d));
  }

  static formatDomainStatus(domain: DomainRegistry): string {
    const status = this.getConfigurationStatus(domain);
    const statusMap = {
      'complete': '✅ Active',
      'in_progress': '🔄 Configuring',
      'failed': '❌ Failed',
      'pending': '⏳ Pending'
    };
    return statusMap[status];
  }
}