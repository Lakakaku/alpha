import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface DNSRecord {
  type: 'A' | 'AAAA' | 'CNAME' | 'TXT' | 'MX' | 'NS';
  name: string;
  value: string;
  ttl?: number;
  priority?: number;
}

interface SubdomainConfig {
  subdomain: string;
  target: string;
  recordType: 'A' | 'CNAME';
  ipAddress?: string;
  verifyUrl?: string;
  description: string;
}

interface DNSProvider {
  name: string;
  apiKey?: string;
  email?: string;
  zoneId?: string;
  domain?: string;
}

interface DNSSetupOptions {
  provider: 'cloudflare' | 'digitalocean' | 'namecheap' | 'godaddy' | 'route53' | 'manual';
  domain: string;
  subdomains: SubdomainConfig[];
  dryRun?: boolean;
  validateAfter?: boolean;
  backupExisting?: boolean;
  ttl?: number;
}

interface DNSResult {
  subdomain: string;
  success: boolean;
  recordsCreated: DNSRecord[];
  errors: string[];
  verificationStatus?: 'verified' | 'pending' | 'failed';
}

export class DNSSetupManager {
  private provider: DNSProvider;
  private configPath: string;
  private backupDir: string;

  constructor(provider: DNSProvider) {
    this.provider = provider;
    this.configPath = path.join(process.cwd(), 'deployment', 'dns-config.json');
    this.backupDir = path.join(process.cwd(), 'deployment', 'dns-backups');
    
    this.ensureDirectoriesExist();
  }

  private ensureDirectoriesExist(): void {
    const deploymentDir = path.dirname(this.configPath);
    if (!fs.existsSync(deploymentDir)) {
      fs.mkdirSync(deploymentDir, { recursive: true });
    }

    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  async setupDNS(options: DNSSetupOptions): Promise<DNSResult[]> {
    console.log('🌐 Starting DNS configuration...');
    console.log(`Provider: ${options.provider}, Domain: ${options.domain}`);
    console.log(`Subdomains: ${options.subdomains.map(s => s.subdomain).join(', ')}`);

    const results: DNSResult[] = [];

    try {
      // Validate provider configuration
      await this.validateProviderConfig(options.provider);

      // Backup existing DNS records if requested
      if (options.backupExisting) {
        await this.backupExistingRecords(options.domain);
      }

      // Setup each subdomain
      for (const subdomainConfig of options.subdomains) {
        const result = await this.setupSubdomain(subdomainConfig, options);
        results.push(result);
      }

      // Validate DNS propagation if requested
      if (options.validateAfter) {
        await this.validateDNSPropagation(options.subdomains, results);
      }

      const allSuccessful = results.every(r => r.success);
      console.log(allSuccessful ? '✅ DNS setup completed successfully' : '❌ DNS setup completed with errors');

      return results;

    } catch (error) {
      const errorMessage = `DNS setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error('❌', errorMessage);
      
      const failedResult: DNSResult = {
        subdomain: 'unknown',
        success: false,
        recordsCreated: [],
        errors: [errorMessage]
      };
      
      return [failedResult];
    }
  }

  private async validateProviderConfig(provider: string): Promise<void> {
    switch (provider) {
      case 'cloudflare':
        if (!this.provider.apiKey || !this.provider.zoneId) {
          throw new Error('Cloudflare requires API key and zone ID');
        }
        await this.validateCloudflareConfig();
        break;
      case 'digitalocean':
        if (!this.provider.apiKey) {
          throw new Error('DigitalOcean requires API key');
        }
        break;
      case 'namecheap':
        if (!this.provider.apiKey) {
          throw new Error('Namecheap requires API key');
        }
        break;
      case 'godaddy':
        if (!this.provider.apiKey) {
          throw new Error('GoDaddy requires API key');
        }
        break;
      case 'route53':
        // AWS credentials should be configured via AWS CLI or environment variables
        break;
      case 'manual':
        console.log('ℹ️ Manual DNS configuration selected - will provide instructions only');
        break;
      default:
        throw new Error(`Unsupported DNS provider: ${provider}`);
    }
  }

  private async validateCloudflareConfig(): Promise<void> {
    try {
      const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${this.provider.zoneId}`, {
        headers: {
          'Authorization': `Bearer ${this.provider.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Cloudflare API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(`Cloudflare validation failed: ${data.errors?.[0]?.message || 'Unknown error'}`);
      }

      console.log(`✅ Cloudflare zone validated: ${data.result.name}`);
    } catch (error) {
      throw new Error(`Cloudflare configuration validation failed: ${error}`);
    }
  }

  private async setupSubdomain(config: SubdomainConfig, options: DNSSetupOptions): Promise<DNSResult> {
    console.log(`🔧 Setting up subdomain: ${config.subdomain}.${options.domain}`);

    const result: DNSResult = {
      subdomain: config.subdomain,
      success: false,
      recordsCreated: [],
      errors: []
    };

    try {
      const fullDomain = `${config.subdomain}.${options.domain}`;
      
      // Prepare DNS record
      const dnsRecord: DNSRecord = {
        type: config.recordType,
        name: config.subdomain,
        value: config.recordType === 'A' ? (config.ipAddress || '') : config.target,
        ttl: options.ttl || 300
      };

      if (options.dryRun) {
        console.log(`🔍 DRY RUN: Would create ${dnsRecord.type} record for ${fullDomain} -> ${dnsRecord.value}`);
        result.recordsCreated.push(dnsRecord);
        result.success = true;
        return result;
      }

      // Create DNS record based on provider
      switch (options.provider) {
        case 'cloudflare':
          await this.createCloudflareRecord(dnsRecord, options.domain, result);
          break;
        case 'digitalocean':
          await this.createDigitalOceanRecord(dnsRecord, options.domain, result);
          break;
        case 'namecheap':
          await this.createNamecheapRecord(dnsRecord, options.domain, result);
          break;
        case 'godaddy':
          await this.createGoDaddyRecord(dnsRecord, options.domain, result);
          break;
        case 'route53':
          await this.createRoute53Record(dnsRecord, options.domain, result);
          break;
        case 'manual':
          await this.generateManualInstructions(dnsRecord, options.domain, result);
          break;
        default:
          throw new Error(`DNS provider ${options.provider} not implemented`);
      }

      result.success = result.errors.length === 0;
      console.log(`${result.success ? '✅' : '❌'} Subdomain ${config.subdomain} setup ${result.success ? 'completed' : 'failed'}`);

    } catch (error) {
      const errorMessage = `Setup failed for ${config.subdomain}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error('❌', errorMessage);
      result.errors.push(errorMessage);
    }

    return result;
  }

  private async createCloudflareRecord(record: DNSRecord, domain: string, result: DNSResult): Promise<void> {
    try {
      const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${this.provider.zoneId}/dns_records`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.provider.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: record.type,
          name: record.name,
          content: record.value,
          ttl: record.ttl
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        // Check if record already exists
        if (data.errors?.[0]?.code === 81057) {
          console.log(`ℹ️ DNS record already exists for ${record.name}, updating...`);
          await this.updateCloudflareRecord(record, domain, result);
          return;
        }
        throw new Error(`Cloudflare API error: ${data.errors?.[0]?.message || response.statusText}`);
      }

      result.recordsCreated.push(record);
      console.log(`✅ Created ${record.type} record: ${record.name}.${domain} -> ${record.value}`);

    } catch (error) {
      const errorMessage = `Cloudflare record creation failed: ${error}`;
      result.errors.push(errorMessage);
      console.error('❌', errorMessage);
    }
  }

  private async updateCloudflareRecord(record: DNSRecord, domain: string, result: DNSResult): Promise<void> {
    try {
      // First, find the existing record
      const listResponse = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${this.provider.zoneId}/dns_records?name=${record.name}.${domain}`,
        {
          headers: {
            'Authorization': `Bearer ${this.provider.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const listData = await listResponse.json();
      if (!listData.success || listData.result.length === 0) {
        throw new Error('Existing record not found for update');
      }

      const existingRecord = listData.result[0];

      // Update the record
      const updateResponse = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${this.provider.zoneId}/dns_records/${existingRecord.id}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${this.provider.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            type: record.type,
            name: record.name,
            content: record.value,
            ttl: record.ttl
          })
        }
      );

      const updateData = await updateResponse.json();
      if (!updateData.success) {
        throw new Error(`Update failed: ${updateData.errors?.[0]?.message}`);
      }

      result.recordsCreated.push(record);
      console.log(`✅ Updated ${record.type} record: ${record.name}.${domain} -> ${record.value}`);

    } catch (error) {
      const errorMessage = `Cloudflare record update failed: ${error}`;
      result.errors.push(errorMessage);
      console.error('❌', errorMessage);
    }
  }

  private async createDigitalOceanRecord(record: DNSRecord, domain: string, result: DNSResult): Promise<void> {
    try {
      const response = await fetch(`https://api.digitalocean.com/v2/domains/${domain}/records`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.provider.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: record.type,
          name: record.name,
          data: record.value,
          ttl: record.ttl
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`DigitalOcean API error: ${errorData.message || response.statusText}`);
      }

      result.recordsCreated.push(record);
      console.log(`✅ Created ${record.type} record: ${record.name}.${domain} -> ${record.value}`);

    } catch (error) {
      const errorMessage = `DigitalOcean record creation failed: ${error}`;
      result.errors.push(errorMessage);
      console.error('❌', errorMessage);
    }
  }

  private async createNamecheapRecord(record: DNSRecord, domain: string, result: DNSResult): Promise<void> {
    try {
      // Namecheap API implementation would go here
      // This is a simplified version - actual implementation would use Namecheap's XML API
      console.log(`ℹ️ Namecheap DNS setup requires manual configuration or XML API integration`);
      await this.generateManualInstructions(record, domain, result);

    } catch (error) {
      const errorMessage = `Namecheap record creation failed: ${error}`;
      result.errors.push(errorMessage);
      console.error('❌', errorMessage);
    }
  }

  private async createGoDaddyRecord(record: DNSRecord, domain: string, result: DNSResult): Promise<void> {
    try {
      const response = await fetch(`https://api.godaddy.com/v1/domains/${domain}/records/${record.type}/${record.name}`, {
        method: 'PUT',
        headers: {
          'Authorization': `sso-key ${this.provider.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([{
          data: record.value,
          ttl: record.ttl
        }])
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`GoDaddy API error: ${errorData.message || response.statusText}`);
      }

      result.recordsCreated.push(record);
      console.log(`✅ Created ${record.type} record: ${record.name}.${domain} -> ${record.value}`);

    } catch (error) {
      const errorMessage = `GoDaddy record creation failed: ${error}`;
      result.errors.push(errorMessage);
      console.error('❌', errorMessage);
    }
  }

  private async createRoute53Record(record: DNSRecord, domain: string, result: DNSResult): Promise<void> {
    try {
      // Get hosted zone ID
      const hostedZoneOutput = execSync(`aws route53 list-hosted-zones --query "HostedZones[?Name=='${domain}.'].Id" --output text`, { encoding: 'utf8' });
      const hostedZoneId = hostedZoneOutput.trim();

      if (!hostedZoneId) {
        throw new Error(`Hosted zone not found for domain: ${domain}`);
      }

      // Create change batch
      const changeBatch = {
        Changes: [{
          Action: 'UPSERT',
          ResourceRecordSet: {
            Name: `${record.name}.${domain}`,
            Type: record.type,
            TTL: record.ttl,
            ResourceRecords: [{ Value: record.value }]
          }
        }]
      };

      const changeFile = path.join(this.backupDir, `route53-change-${Date.now()}.json`);
      fs.writeFileSync(changeFile, JSON.stringify({ ChangeBatch: changeBatch }, null, 2));

      // Apply changes
      execSync(`aws route53 change-resource-record-sets --hosted-zone-id ${hostedZoneId} --change-batch file://${changeFile}`, { stdio: 'inherit' });

      result.recordsCreated.push(record);
      console.log(`✅ Created ${record.type} record: ${record.name}.${domain} -> ${record.value}`);

      // Clean up temp file
      fs.unlinkSync(changeFile);

    } catch (error) {
      const errorMessage = `Route53 record creation failed: ${error}`;
      result.errors.push(errorMessage);
      console.error('❌', errorMessage);
    }
  }

  private async generateManualInstructions(record: DNSRecord, domain: string, result: DNSResult): Promise<void> {
    const instructions = `
📋 Manual DNS Configuration Required

Domain: ${domain}
Record Type: ${record.type}
Name: ${record.name}
Value: ${record.value}
TTL: ${record.ttl} seconds

Please add this DNS record through your domain registrar's control panel:

1. Log into your domain registrar's DNS management interface
2. Navigate to DNS records or DNS zones
3. Add a new ${record.type} record with the following details:
   - Name/Host: ${record.name}
   - Value/Target: ${record.value}
   - TTL: ${record.ttl}
4. Save the changes

Note: DNS propagation may take 5-60 minutes to complete.
`;

    console.log(instructions);
    
    // Save instructions to file
    const instructionsFile = path.join(this.backupDir, `manual-dns-${record.name}-${Date.now()}.txt`);
    fs.writeFileSync(instructionsFile, instructions);
    
    result.recordsCreated.push(record);
    console.log(`📄 Manual instructions saved to: ${instructionsFile}`);
  }

  private async backupExistingRecords(domain: string): Promise<void> {
    console.log('💾 Backing up existing DNS records...');
    
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = path.join(this.backupDir, `dns-backup-${domain}-${timestamp}.json`);
      
      // This would vary by provider - implement based on the configured provider
      const records = await this.fetchExistingRecords(domain);
      
      const backupData = {
        timestamp: new Date(),
        domain,
        provider: this.provider.name,
        records
      };
      
      fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
      console.log(`📁 DNS backup created: ${backupFile}`);
      
    } catch (error) {
      console.warn(`⚠️ Failed to backup existing DNS records: ${error}`);
    }
  }

  private async fetchExistingRecords(domain: string): Promise<DNSRecord[]> {
    // Implementation would depend on the provider
    // This is a placeholder that would need to be implemented for each provider
    return [];
  }

  private async validateDNSPropagation(subdomains: SubdomainConfig[], results: DNSResult[]): Promise<void> {
    console.log('🔍 Validating DNS propagation...');
    
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const config = subdomains[i];
      
      try {
        if (config.verifyUrl) {
          result.verificationStatus = await this.checkDNSResolution(config.verifyUrl);
          console.log(`${result.verificationStatus === 'verified' ? '✅' : '⚠️'} ${config.subdomain}: ${result.verificationStatus}`);
        } else {
          // Use dig or nslookup to verify DNS resolution
          const fullDomain = `${config.subdomain}.vocilia.com`;
          await this.verifyDNSWithDig(fullDomain, config.recordType);
          result.verificationStatus = 'verified';
          console.log(`✅ ${config.subdomain}: DNS resolution verified`);
        }
      } catch (error) {
        result.verificationStatus = 'failed';
        console.warn(`⚠️ ${config.subdomain}: DNS verification failed - ${error}`);
      }
    }
  }

  private async checkDNSResolution(url: string): Promise<'verified' | 'pending' | 'failed'> {
    try {
      const response = await fetch(url, { 
        method: 'HEAD', 
        timeout: 10000,
        redirect: 'follow'
      });
      
      return response.ok ? 'verified' : 'failed';
    } catch (error) {
      return 'pending';
    }
  }

  private async verifyDNSWithDig(domain: string, recordType: string): Promise<void> {
    try {
      const output = execSync(`dig +short ${domain} ${recordType}`, { encoding: 'utf8' });
      if (!output.trim()) {
        throw new Error('No DNS resolution found');
      }
    } catch (error) {
      throw new Error(`DNS verification failed: ${error}`);
    }
  }

  async listDNSRecords(domain: string): Promise<DNSRecord[]> {
    return await this.fetchExistingRecords(domain);
  }

  async deleteDNSRecord(domain: string, recordName: string, recordType: string): Promise<boolean> {
    // Implementation would depend on the provider
    console.log(`🗑️ Would delete ${recordType} record: ${recordName}.${domain}`);
    return true;
  }
}

// Predefined Vocilia subdomain configurations
export const VOCILIA_SUBDOMAINS: SubdomainConfig[] = [
  {
    subdomain: 'api',
    target: 'your-railway-app.railway.app', // Replace with actual Railway domain
    recordType: 'CNAME',
    verifyUrl: 'https://api.vocilia.com/health',
    description: 'Backend API server (Railway)'
  },
  {
    subdomain: 'admin',
    target: 'admin-vocilia.vercel.app', // Replace with actual Vercel domain
    recordType: 'CNAME',
    verifyUrl: 'https://admin.vocilia.com',
    description: 'Admin dashboard (Vercel)'
  },
  {
    subdomain: 'business',
    target: 'business-vocilia.vercel.app', // Replace with actual Vercel domain
    recordType: 'CNAME',
    verifyUrl: 'https://business.vocilia.com',
    description: 'Business portal (Vercel)'
  }
];

// CLI usage example
if (require.main === module) {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'setup':
      const provider = args[1] || 'cloudflare';
      const domain = args[2] || 'vocilia.com';
      
      const dnsProvider: DNSProvider = {
        name: provider,
        apiKey: process.env.DNS_API_KEY,
        zoneId: process.env.DNS_ZONE_ID,
        domain
      };

      const setupOptions: DNSSetupOptions = {
        provider: provider as any,
        domain,
        subdomains: VOCILIA_SUBDOMAINS,
        dryRun: args.includes('--dry-run'),
        validateAfter: true,
        backupExisting: true,
        ttl: 300
      };

      const dnsManager = new DNSSetupManager(dnsProvider);
      
      dnsManager.setupDNS(setupOptions)
        .then(results => {
          console.log('\n📊 DNS Setup Results:');
          results.forEach(result => {
            console.log(`- ${result.subdomain}: ${result.success ? '✅' : '❌'} (${result.recordsCreated.length} records)`);
            if (result.verificationStatus) {
              console.log(`  Verification: ${result.verificationStatus}`);
            }
            if (result.errors.length > 0) {
              result.errors.forEach(error => console.log(`  Error: ${error}`));
            }
          });
          
          const allSuccessful = results.every(r => r.success);
          process.exit(allSuccessful ? 0 : 1);
        })
        .catch(error => {
          console.error('💥 DNS setup failed:', error);
          process.exit(1);
        });
      break;

    case 'verify':
      const verifyDomain = args[1] || 'vocilia.com';
      const verifyProvider: DNSProvider = {
        name: 'cloudflare',
        domain: verifyDomain
      };
      
      const verifyManager = new DNSSetupManager(verifyProvider);
      
      verifyManager.validateDNSPropagation(VOCILIA_SUBDOMAINS, 
        VOCILIA_SUBDOMAINS.map(s => ({
          subdomain: s.subdomain,
          success: true,
          recordsCreated: [],
          errors: []
        }))
      )
        .then(() => {
          console.log('✅ DNS verification completed');
        })
        .catch(error => {
          console.error('💥 DNS verification failed:', error);
          process.exit(1);
        });
      break;

    default:
      console.log(`
🌐 Vocilia DNS Setup Manager

Usage:
  npm run setup-dns setup [provider] [domain] [--dry-run]
  npm run setup-dns verify [domain]

Examples:
  npm run setup-dns setup cloudflare vocilia.com --dry-run
  npm run setup-dns setup digitalocean vocilia.com
  npm run setup-dns verify vocilia.com

Providers: cloudflare, digitalocean, namecheap, godaddy, route53, manual

Environment Variables:
  DNS_API_KEY: API key for your DNS provider
  DNS_ZONE_ID: Zone ID (required for Cloudflare)

Vocilia Subdomains:
  - api.vocilia.com (Backend API - Railway)
  - admin.vocilia.com (Admin Dashboard - Vercel)
  - business.vocilia.com (Business Portal - Vercel)
      `);
      break;
  }
}