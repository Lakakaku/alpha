import * as crypto from 'crypto';

export interface SSLCertificate {
  certificate_id: string;
  domain: string;
  platform: 'railway' | 'vercel';
  certificate_authority: string;
  status: 'active' | 'pending' | 'expired' | 'failed';
  issued_at: Date;
  expires_at: Date;
  auto_renewal: boolean;
  last_renewal_attempt?: Date;
  certificate_hash: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateSSLCertificateRequest {
  domain: string;
  platform: 'railway' | 'vercel';
  certificate_authority?: string;
  auto_renewal?: boolean;
  issued_at?: Date;
  expires_at: Date;
  certificate_data?: string;
}

export interface UpdateSSLCertificateRequest {
  status?: 'active' | 'pending' | 'expired' | 'failed';
  expires_at?: Date;
  auto_renewal?: boolean;
  last_renewal_attempt?: Date;
  certificate_data?: string;
}

export interface SSLCertificateValidation {
  is_valid: boolean;
  days_until_expiry: number;
  needs_renewal: boolean;
  errors: string[];
}

export class SSLCertificateModel {
  private static readonly RENEWAL_THRESHOLD_DAYS = 30;
  private static readonly WARNING_THRESHOLD_DAYS = 7;

  static validateDomain(domain: string): boolean {
    // Basic domain validation regex
    const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
    return domainRegex.test(domain) && domain.length <= 253;
  }

  static validatePlatform(platform: string): platform is 'railway' | 'vercel' {
    return ['railway', 'vercel'].includes(platform);
  }

  static validateCertificateAuthority(authority: string): boolean {
    const knownAuthorities = [
      'Let\'s Encrypt',
      'DigiCert',
      'Cloudflare',
      'Custom',
      'Vercel',
      'Railway'
    ];
    return knownAuthorities.includes(authority);
  }

  private static generateCertificateHash(certificateData?: string): string {
    if (!certificateData) {
      // Generate a placeholder hash for certificates managed by platforms
      return crypto.createHash('sha256')
        .update(`placeholder-${Date.now()}-${Math.random()}`)
        .digest('hex')
        .substring(0, 16);
    }

    return crypto.createHash('sha256')
      .update(certificateData)
      .digest('hex')
      .substring(0, 16);
  }

  static create(data: CreateSSLCertificateRequest): SSLCertificate {
    if (!this.validateDomain(data.domain)) {
      throw new Error('Invalid domain format');
    }

    if (!this.validatePlatform(data.platform)) {
      throw new Error('Invalid platform type');
    }

    const certificateAuthority = data.certificate_authority || 'Let\'s Encrypt';
    if (!this.validateCertificateAuthority(certificateAuthority)) {
      throw new Error('Invalid certificate authority');
    }

    const now = new Date();
    const issuedAt = data.issued_at || now;

    // Validate expiration date
    if (data.expires_at <= issuedAt) {
      throw new Error('Certificate expiration date must be after issue date');
    }

    const certificateId = crypto.randomUUID();
    const certificateHash = this.generateCertificateHash(data.certificate_data);

    return {
      certificate_id: certificateId,
      domain: data.domain,
      platform: data.platform,
      certificate_authority: certificateAuthority,
      status: 'pending',
      issued_at: issuedAt,
      expires_at: data.expires_at,
      auto_renewal: data.auto_renewal ?? true,
      certificate_hash: certificateHash,
      created_at: now,
      updated_at: now
    };
  }

  static update(
    existing: SSLCertificate,
    updates: UpdateSSLCertificateRequest
  ): SSLCertificate {
    const updated: SSLCertificate = { ...existing };

    if (updates.status !== undefined) {
      updated.status = updates.status;
    }

    if (updates.expires_at !== undefined) {
      if (updates.expires_at <= existing.issued_at) {
        throw new Error('Certificate expiration date must be after issue date');
      }
      updated.expires_at = updates.expires_at;
    }

    if (updates.auto_renewal !== undefined) {
      updated.auto_renewal = updates.auto_renewal;
    }

    if (updates.last_renewal_attempt !== undefined) {
      updated.last_renewal_attempt = updates.last_renewal_attempt;
    }

    if (updates.certificate_data !== undefined) {
      updated.certificate_hash = this.generateCertificateHash(updates.certificate_data);
    }

    updated.updated_at = new Date();
    return updated;
  }

  static validate(certificate: SSLCertificate): SSLCertificateValidation {
    const now = new Date();
    const millisecondsUntilExpiry = certificate.expires_at.getTime() - now.getTime();
    const daysUntilExpiry = Math.floor(millisecondsUntilExpiry / (1000 * 60 * 60 * 24));
    
    const errors: string[] = [];
    let isValid = true;

    // Check if certificate is expired
    if (daysUntilExpiry < 0) {
      errors.push('Certificate has expired');
      isValid = false;
    }

    // Check if certificate is close to expiry
    if (daysUntilExpiry <= this.WARNING_THRESHOLD_DAYS && daysUntilExpiry >= 0) {
      errors.push(`Certificate expires in ${daysUntilExpiry} days`);
    }

    // Check certificate status
    if (certificate.status === 'failed') {
      errors.push('Certificate issuance failed');
      isValid = false;
    } else if (certificate.status === 'expired') {
      errors.push('Certificate is marked as expired');
      isValid = false;
    }

    // Check domain validity
    if (!this.validateDomain(certificate.domain)) {
      errors.push('Invalid domain format');
      isValid = false;
    }

    const needsRenewal = daysUntilExpiry <= this.RENEWAL_THRESHOLD_DAYS && 
                        certificate.auto_renewal && 
                        certificate.status === 'active';

    return {
      is_valid: isValid,
      days_until_expiry: Math.max(0, daysUntilExpiry),
      needs_renewal: needsRenewal,
      errors
    };
  }

  static shouldAutoRenew(certificate: SSLCertificate): boolean {
    if (!certificate.auto_renewal) {
      return false;
    }

    const validation = this.validate(certificate);
    return validation.needs_renewal;
  }

  static getDaysUntilExpiry(certificate: SSLCertificate): number {
    const now = new Date();
    const millisecondsUntilExpiry = certificate.expires_at.getTime() - now.getTime();
    return Math.floor(millisecondsUntilExpiry / (1000 * 60 * 60 * 24));
  }

  static isExpiringSoon(certificate: SSLCertificate): boolean {
    const daysUntilExpiry = this.getDaysUntilExpiry(certificate);
    return daysUntilExpiry <= this.WARNING_THRESHOLD_DAYS;
  }

  static getExpiringCertificates(certificates: SSLCertificate[]): SSLCertificate[] {
    return certificates.filter(cert => this.isExpiringSoon(cert));
  }

  static groupByPlatform(certificates: SSLCertificate[]): Record<string, SSLCertificate[]> {
    return certificates.reduce((groups, cert) => {
      if (!groups[cert.platform]) {
        groups[cert.platform] = [];
      }
      groups[cert.platform].push(cert);
      return groups;
    }, {} as Record<string, SSLCertificate[]>);
  }

  static getOverallStatus(certificates: SSLCertificate[]): 'healthy' | 'warning' | 'critical' {
    if (certificates.length === 0) {
      return 'warning';
    }

    const failedCerts = certificates.filter(cert => cert.status === 'failed' || cert.status === 'expired');
    if (failedCerts.length > 0) {
      return 'critical';
    }

    const expiringSoon = certificates.filter(cert => this.isExpiringSoon(cert));
    if (expiringSoon.length > 0) {
      return 'warning';
    }

    return 'healthy';
  }

  static generateRenewalReport(certificates: SSLCertificate[]): {
    total_certificates: number;
    active_certificates: number;
    expiring_within_30_days: number;
    expiring_within_7_days: number;
    failed_certificates: number;
    auto_renewal_enabled: number;
  } {
    const totalCerts = certificates.length;
    const activeCerts = certificates.filter(cert => cert.status === 'active').length;
    const expiring30Days = certificates.filter(cert => {
      const days = this.getDaysUntilExpiry(cert);
      return days <= 30 && days > 0;
    }).length;
    const expiring7Days = certificates.filter(cert => {
      const days = this.getDaysUntilExpiry(cert);
      return days <= 7 && days > 0;
    }).length;
    const failedCerts = certificates.filter(cert => 
      cert.status === 'failed' || cert.status === 'expired'
    ).length;
    const autoRenewalEnabled = certificates.filter(cert => cert.auto_renewal).length;

    return {
      total_certificates: totalCerts,
      active_certificates: activeCerts,
      expiring_within_30_days: expiring30Days,
      expiring_within_7_days: expiring7Days,
      failed_certificates: failedCerts,
      auto_renewal_enabled: autoRenewalEnabled
    };
  }

  static markRenewalAttempt(certificate: SSLCertificate): SSLCertificate {
    return this.update(certificate, {
      last_renewal_attempt: new Date()
    });
  }

  static markRenewalSuccess(
    certificate: SSLCertificate,
    newExpirationDate: Date,
    certificateData?: string
  ): SSLCertificate {
    return this.update(certificate, {
      status: 'active',
      expires_at: newExpirationDate,
      certificate_data: certificateData
    });
  }

  static markRenewalFailure(certificate: SSLCertificate): SSLCertificate {
    return this.update(certificate, {
      status: 'failed'
    });
  }
}