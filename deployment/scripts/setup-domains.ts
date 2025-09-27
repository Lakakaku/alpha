#!/usr/bin/env tsx

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import * as path from 'path';

interface DomainConfig {
  domain: string;
  subdomain?: string;
  fullDomain: string; // computed: subdomain.domain or domain
  type: 'apex' | 'subdomain';
  service: 'vercel' | 'railway' | 'custom';
  target: string; // deployment URL or IP
  recordType: 'CNAME' | 'A' | 'ALIAS';
  ttl: number;
  priority?: number; // for MX records
}

interface DNSProvider {
  name: string;
  apiKey?: string;
  apiSecret?: string;
  zoneId?: string;
}

interface DomainSetupConfig {
  domains: DomainConfig[];
  dnsProvider: DNSProvider;
  environment: 'staging' | 'production';
  verifyDelay: number; // seconds to wait before verification
  maxRetries: number;
  backupDNS?: {
    enabled: boolean;
    provider: DNSProvider;
  };
}

interface DomainSetupResult {
  domain: string;
  success: boolean;
  recordId?: string;
  ipAddress?: string;
  verificationStatus: 'pending' | 'verified' | 'failed';
  errors: string[];
  dnsRecords: Array<{
    type: string;
    name: string;
    value: string;
    ttl: number;
  }>;
}

interface SetupSummary {
  success: boolean;
  duration: number;
  domains: DomainSetupResult[];
  errors: string[];
  summary: {
    total: number;
    successful: number;
    failed: number;
    pending: number;
  };
}

class DomainSetupManager {
  private config: DomainSetupConfig;
  private startTime: number = 0;
  private errors: string[] = [];

  constructor(config: DomainSetupConfig) {
    this.config = config;
  }

  public async setupAllDomains(): Promise<SetupSummary> {
    this.startTime = Date.now();
    this.log('🌐 Starting domain setup process...');

    try {
      // Validate configuration
      await this.validateConfiguration();

      // Setup domains
      const domainResults: DomainSetupResult[] = [];

      for (const domain of this.config.domains) {
        const result = await this.setupDomain(domain);
        domainResults.push(result);
      }

      // Wait for DNS propagation
      this.log(`⏳ Waiting ${this.config.verifyDelay}s for DNS propagation...`);
      await this.sleep(this.config.verifyDelay * 1000);

      // Verify all domains
      for (const result of domainResults) {
        if (result.success) {
          await this.verifyDomain(result);
        }
      }

      // Calculate summary
      const summary = {
        total: domainResults.length,
        successful: domainResults.filter(r => r.success && r.verificationStatus === 'verified').length,
        failed: domainResults.filter(r => !r.success || r.verificationStatus === 'failed').length,
        pending: domainResults.filter(r => r.verificationStatus === 'pending').length
      };

      const overallSuccess = summary.failed === 0;

      this.log(`✅ Domain setup completed. Success: ${summary.successful}/${summary.total}`);

      return {
        success: overallSuccess,
        duration: Date.now() - this.startTime,
        domains: domainResults,
        errors: this.errors,
        summary
      };

    } catch (error) {
      this.error(`❌ Domain setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);

      return {
        success: false,
        duration: Date.now() - this.startTime,
        domains: [],
        errors: this.errors,
        summary: { total: 0, successful: 0, failed: 0, pending: 0 }
      };
    }
  }

  public async setupSingleDomain(domainName: string): Promise<DomainSetupResult> {
    const domainConfig = this.config.domains.find(d => d.fullDomain === domainName);
    if (!domainConfig) {
      throw new Error(`Domain ${domainName} not found in configuration`);
    }

    return await this.setupDomain(domainConfig);
  }

  private async validateConfiguration(): Promise<void> {
    this.log('🔍 Validating domain configuration...');

    // Check DNS provider configuration
    if (!this.config.dnsProvider.name) {
      throw new Error('DNS provider name is required');
    }

    // Validate domains
    for (const domain of this.config.domains) {
      if (!domain.domain || !domain.target) {
        throw new Error(`Invalid domain configuration: ${JSON.stringify(domain)}`);
      }

      // Validate domain format
      if (!this.isValidDomain(domain.fullDomain)) {
        throw new Error(`Invalid domain format: ${domain.fullDomain}`);
      }

      // Validate target URL or IP
      if (!this.isValidTarget(domain.target)) {
        throw new Error(`Invalid target: ${domain.target}`);
      }
    }

    this.log('✅ Configuration validation passed');
  }

  private async setupDomain(domain: DomainConfig): Promise<DomainSetupResult> {
    this.log(`🚀 Setting up domain: ${domain.fullDomain}`);

    const result: DomainSetupResult = {
      domain: domain.fullDomain,
      success: false,
      verificationStatus: 'pending',
      errors: [],
      dnsRecords: []
    };

    try {
      // Resolve target to IP if needed
      if (domain.recordType === 'A') {
        result.ipAddress = await this.resolveTargetToIP(domain.target);
      }

      // Create DNS records
      const recordValue = domain.recordType === 'A' ? result.ipAddress! : domain.target;
      
      // Main record
      const mainRecord = await this.createDNSRecord({
        type: domain.recordType,
        name: domain.type === 'apex' ? '@' : domain.subdomain!,
        value: recordValue,
        ttl: domain.ttl,
        priority: domain.priority
      });

      result.dnsRecords.push(mainRecord);
      result.recordId = mainRecord.id;

      // Additional records for web services
      if (domain.service === 'vercel') {
        const additionalRecords = await this.setupVercelDomain(domain);
        result.dnsRecords.push(...additionalRecords);
      } else if (domain.service === 'railway') {
        const additionalRecords = await this.setupRailwayDomain(domain);
        result.dnsRecords.push(...additionalRecords);
      }

      result.success = true;
      this.log(`✅ Domain ${domain.fullDomain} configured successfully`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(errorMessage);
      this.error(`❌ Failed to setup domain ${domain.fullDomain}: ${errorMessage}`);
    }

    return result;
  }

  private async createDNSRecord(record: {
    type: string;
    name: string;
    value: string;
    ttl: number;
    priority?: number;
  }): Promise<{ id: string; type: string; name: string; value: string; ttl: number }> {
    
    switch (this.config.dnsProvider.name.toLowerCase()) {
      case 'cloudflare':
        return await this.createCloudflareRecord(record);
      case 'digitalocean':
        return await this.createDigitalOceanRecord(record);
      case 'namecheap':
        return await this.createNamecheapRecord(record);
      case 'godaddy':
        return await this.createGoDaddyRecord(record);
      default:
        // Generic implementation - would need to be customized per provider
        return await this.createGenericRecord(record);
    }
  }

  private async createCloudflareRecord(record: any): Promise<any> {
    const apiKey = this.config.dnsProvider.apiKey;
    const zoneId = this.config.dnsProvider.zoneId;

    if (!apiKey || !zoneId) {
      throw new Error('Cloudflare API key and zone ID are required');
    }

    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: record.type,
        name: record.name,
        content: record.value,
        ttl: record.ttl,
        priority: record.priority
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Cloudflare API error: ${error}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(`Cloudflare error: ${data.errors.map((e: any) => e.message).join(', ')}`);
    }

    return {
      id: data.result.id,
      type: data.result.type,
      name: data.result.name,
      value: data.result.content,
      ttl: data.result.ttl
    };
  }

  private async createDigitalOceanRecord(record: any): Promise<any> {
    const apiKey = this.config.dnsProvider.apiKey;
    const domain = this.extractBaseDomain(record.name);

    if (!apiKey) {
      throw new Error('DigitalOcean API key is required');
    }

    const response = await fetch(`https://api.digitalocean.com/v2/domains/${domain}/records`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: record.type,
        name: record.name === '@' ? '' : record.name,
        data: record.value,
        ttl: record.ttl,
        priority: record.priority
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DigitalOcean API error: ${error}`);
    }

    const data = await response.json();

    return {
      id: data.domain_record.id.toString(),
      type: data.domain_record.type,
      name: data.domain_record.name,
      value: data.domain_record.data,
      ttl: data.domain_record.ttl
    };
  }

  private async createNamecheapRecord(record: any): Promise<any> {
    // Namecheap uses different API structure
    this.log(`⚠️ Namecheap DNS record creation not implemented. Manual setup required for ${record.name}`);
    
    return {
      id: `manual-${Date.now()}`,
      type: record.type,
      name: record.name,
      value: record.value,
      ttl: record.ttl
    };
  }

  private async createGoDaddyRecord(record: any): Promise<any> {
    const apiKey = this.config.dnsProvider.apiKey;
    const apiSecret = this.config.dnsProvider.apiSecret;
    const domain = this.extractBaseDomain(record.name);

    if (!apiKey || !apiSecret) {
      throw new Error('GoDaddy API key and secret are required');
    }

    const response = await fetch(`https://api.godaddy.com/v1/domains/${domain}/records`, {
      method: 'PATCH',
      headers: {
        'Authorization': `sso-key ${apiKey}:${apiSecret}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([{
        type: record.type,
        name: record.name === '@' ? '' : record.name,
        data: record.value,
        ttl: record.ttl,
        priority: record.priority
      }])
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GoDaddy API error: ${error}`);
    }

    return {
      id: `godaddy-${Date.now()}`,
      type: record.type,
      name: record.name,
      value: record.value,
      ttl: record.ttl
    };
  }

  private async createGenericRecord(record: any): Promise<any> {
    // Generic implementation for unsupported providers
    this.log(`⚠️ Generic DNS provider - manual setup required for ${record.name}`);
    this.log(`   Type: ${record.type}`);
    this.log(`   Name: ${record.name}`);
    this.log(`   Value: ${record.value}`);
    this.log(`   TTL: ${record.ttl}`);

    return {
      id: `generic-${Date.now()}`,
      type: record.type,
      name: record.name,
      value: record.value,
      ttl: record.ttl
    };
  }

  private async setupVercelDomain(domain: DomainConfig): Promise<any[]> {
    const records = [];

    // Add Vercel-specific records if needed
    if (domain.type === 'apex') {
      // Add www redirect
      records.push({
        type: 'CNAME',
        name: 'www',
        value: `cname.vercel-dns.com`,
        ttl: domain.ttl
      });
    }

    // Create the records
    const createdRecords = [];
    for (const record of records) {
      try {
        const created = await this.createDNSRecord(record);
        createdRecords.push(created);
      } catch (error) {
        this.error(`Failed to create Vercel record ${record.name}: ${error}`);
      }
    }

    return createdRecords;
  }

  private async setupRailwayDomain(domain: DomainConfig): Promise<any[]> {
    const records = [];

    // Railway typically uses CNAME records
    if (domain.recordType === 'CNAME' && domain.type === 'subdomain') {
      // No additional records needed for Railway subdomains
    }

    return records;
  }

  private async resolveTargetToIP(target: string): Promise<string> {
    try {
      // Extract hostname from URL if needed
      const hostname = target.startsWith('http') ? new URL(target).hostname : target;
      
      // Use DNS lookup to resolve IP
      const { execSync } = require('child_process');
      const result = execSync(`nslookup ${hostname}`, { encoding: 'utf8' });
      
      // Parse IP from nslookup output
      const ipMatch = result.match(/Address: (\d+\.\d+\.\d+\.\d+)/);
      if (ipMatch) {
        return ipMatch[1];
      }

      throw new Error(`Could not resolve IP for ${hostname}`);
    } catch (error) {
      throw new Error(`DNS resolution failed for ${target}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async verifyDomain(result: DomainSetupResult): Promise<void> {
    this.log(`🔍 Verifying domain: ${result.domain}`);

    let attempts = 0;
    const maxAttempts = this.config.maxRetries;

    while (attempts < maxAttempts) {
      try {
        const isResolved = await this.checkDNSResolution(result.domain);
        const isAccessible = await this.checkDomainAccessibility(result.domain);

        if (isResolved && isAccessible) {
          result.verificationStatus = 'verified';
          this.log(`✅ Domain ${result.domain} verified successfully`);
          return;
        }

        this.log(`Verification attempt ${attempts + 1} failed for ${result.domain}`);
        await this.sleep(10000); // Wait 10 seconds between attempts
        attempts++;

      } catch (error) {
        this.log(`Verification error for ${result.domain}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        attempts++;
        await this.sleep(10000);
      }
    }

    result.verificationStatus = 'failed';
    result.errors.push('Domain verification failed after maximum attempts');
    this.error(`❌ Domain ${result.domain} verification failed`);
  }

  private async checkDNSResolution(domain: string): Promise<boolean> {
    try {
      const { execSync } = require('child_process');
      const result = execSync(`nslookup ${domain}`, { encoding: 'utf8' });
      
      // Check if DNS resolution was successful
      return !result.includes('can\'t find') && !result.includes('NXDOMAIN');
    } catch {
      return false;
    }
  }

  private async checkDomainAccessibility(domain: string): Promise<boolean> {
    try {
      const url = `https://${domain}`;
      const response = await fetch(url, {
        method: 'HEAD',
        redirect: 'follow',
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      return response.ok || response.status < 500; // Accept redirects and client errors
    } catch {
      // Try HTTP if HTTPS fails
      try {
        const url = `http://${domain}`;
        const response = await fetch(url, {
          method: 'HEAD',
          redirect: 'follow',
          signal: AbortSignal.timeout(10000)
        });

        return response.ok || response.status < 500;
      } catch {
        return false;
      }
    }
  }

  private isValidDomain(domain: string): boolean {
    const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
    return domainRegex.test(domain);
  }

  private isValidTarget(target: string): boolean {
    // Check if it's a valid URL or IP address
    try {
      new URL(target);
      return true;
    } catch {
      // Check if it's a valid IP address
      const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (ipRegex.test(target)) {
        return true;
      }

      // Check if it's a valid hostname
      const hostnameRegex = /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
      return hostnameRegex.test(target);
    }
  }

  private extractBaseDomain(name: string): string {
    if (name === '@') {
      // Would need to be configured based on the zone
      return 'vocilia.com'; // Default for this project
    }
    
    const parts = name.split('.');
    if (parts.length >= 2) {
      return parts.slice(-2).join('.');
    }
    
    return name;
  }

  private log(message: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
  }

  private error(message: string): void {
    const timestamp = new Date().toISOString();
    const errorMessage = `[${timestamp}] ERROR: ${message}`;
    console.error(errorMessage);
    this.errors.push(errorMessage);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const environment = args[0] as 'staging' | 'production' || 'staging';
  const domainName = args[1]; // Optional: setup single domain

  // Load configuration
  const configPath = path.join(process.cwd(), 'deployment', 'config', `domains-${environment}.json`);
  
  if (!existsSync(configPath)) {
    console.error(`❌ Configuration file not found: ${configPath}`);
    process.exit(1);
  }

  const config: DomainSetupConfig = {
    ...JSON.parse(readFileSync(configPath, 'utf8')),
    environment
  };

  // Override with environment variables
  if (process.env.DNS_API_KEY) {
    config.dnsProvider.apiKey = process.env.DNS_API_KEY;
  }
  if (process.env.DNS_API_SECRET) {
    config.dnsProvider.apiSecret = process.env.DNS_API_SECRET;
  }
  if (process.env.DNS_ZONE_ID) {
    config.dnsProvider.zoneId = process.env.DNS_ZONE_ID;
  }

  console.log(`🌐 Starting domain setup for ${environment}`);
  console.log(`DNS Provider: ${config.dnsProvider.name}`);
  console.log(`Domains: ${config.domains.map(d => d.fullDomain).join(', ')}`);

  const manager = new DomainSetupManager(config);
  
  const result = domainName 
    ? { 
        success: true, 
        duration: 0, 
        domains: [await manager.setupSingleDomain(domainName)], 
        errors: [], 
        summary: { total: 1, successful: 0, failed: 0, pending: 0 } 
      }
    : await manager.setupAllDomains();

  // Write result to file
  const resultPath = path.join(process.cwd(), 'deployment', 'logs', `domains-${environment}-${Date.now()}.json`);
  writeFileSync(resultPath, JSON.stringify(result, null, 2));

  if (result.success) {
    console.log(`✅ Domain setup successful! Duration: ${result.duration}ms`);
    console.log(`📊 Summary: ${result.summary.successful}/${result.summary.total} domains configured`);
    console.log(`📄 Setup log: ${resultPath}`);
    process.exit(0);
  } else {
    console.error(`❌ Domain setup failed! Duration: ${result.duration}ms`);
    console.error(`📊 Summary: ${result.summary.successful}/${result.summary.total} domains configured`);
    console.error(`📄 Setup log: ${resultPath}`);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Domain setup script failed:', error);
    process.exit(1);
  });
}

export { DomainSetupManager, DomainSetupConfig, SetupSummary };