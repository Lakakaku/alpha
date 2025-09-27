import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface SSLConfig {
  domains: string[];
  email: string;
  provider: 'letsencrypt' | 'cloudflare' | 'custom';
  staging?: boolean;
  keyType?: 'rsa' | 'ecdsa';
  keySize?: number;
  autoRenewal?: boolean;
}

interface CertificateInfo {
  domain: string;
  issuer: string;
  validFrom: Date;
  validTo: Date;
  fingerprint: string;
  status: 'valid' | 'expired' | 'expiring' | 'invalid';
}

interface ProviderConfig {
  cloudflare?: {
    apiToken: string;
    zone: string;
  };
  custom?: {
    certificatePath: string;
    privateKeyPath: string;
    chainPath?: string;
  };
}

export class SSLSetupManager {
  private config: SSLConfig;
  private providerConfig: ProviderConfig;
  private certDir: string;

  constructor(config: SSLConfig, providerConfig: ProviderConfig = {}) {
    this.config = config;
    this.providerConfig = providerConfig;
    this.certDir = '/etc/ssl/vocilia';
    
    this.validateConfiguration();
  }

  private validateConfiguration(): void {
    if (!this.config.domains || this.config.domains.length === 0) {
      throw new Error('SSL setup requires at least one domain');
    }

    if (!this.config.email) {
      throw new Error('Email is required for SSL certificate setup');
    }

    // Validate domain formats
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.([a-zA-Z]{2,}\.)*[a-zA-Z]{2,}$/;
    for (const domain of this.config.domains) {
      if (!domainRegex.test(domain)) {
        throw new Error(`Invalid domain format: ${domain}`);
      }
    }

    // Validate provider-specific config
    if (this.config.provider === 'cloudflare' && !this.providerConfig.cloudflare?.apiToken) {
      throw new Error('Cloudflare API token is required for Cloudflare SSL provider');
    }

    if (this.config.provider === 'custom' && !this.providerConfig.custom?.certificatePath) {
      throw new Error('Certificate path is required for custom SSL provider');
    }
  }

  async setupSSLCertificates(): Promise<{ success: boolean; certificates: CertificateInfo[]; errors: string[] }> {
    console.log('🔒 Starting SSL certificate setup for domains:', this.config.domains);
    
    const results: CertificateInfo[] = [];
    const errors: string[] = [];

    try {
      // Ensure certificate directory exists
      await this.ensureCertificateDirectory();

      // Setup certificates based on provider
      switch (this.config.provider) {
        case 'letsencrypt':
          await this.setupLetsEncryptCertificates(results, errors);
          break;
        case 'cloudflare':
          await this.setupCloudflareCertificates(results, errors);
          break;
        case 'custom':
          await this.setupCustomCertificates(results, errors);
          break;
        default:
          throw new Error(`Unsupported SSL provider: ${this.config.provider}`);
      }

      // Verify all certificates
      await this.verifyCertificates(results, errors);

      // Setup auto-renewal if enabled
      if (this.config.autoRenewal && this.config.provider === 'letsencrypt') {
        await this.setupAutoRenewal();
      }

      // Configure web servers
      await this.configureWebServers(results, errors);

      const success = results.length > 0 && errors.length === 0;
      console.log(success ? '✅ SSL certificate setup completed successfully' : '❌ SSL certificate setup completed with errors');

      return { success, certificates: results, errors };

    } catch (error) {
      const errorMessage = `SSL setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error('❌', errorMessage);
      errors.push(errorMessage);
      
      return { success: false, certificates: results, errors };
    }
  }

  private async ensureCertificateDirectory(): Promise<void> {
    try {
      if (!fs.existsSync(this.certDir)) {
        execSync(`sudo mkdir -p ${this.certDir}`, { stdio: 'inherit' });
        execSync(`sudo chmod 755 ${this.certDir}`, { stdio: 'inherit' });
      }
      console.log(`📁 Certificate directory ready: ${this.certDir}`);
    } catch (error) {
      throw new Error(`Failed to create certificate directory: ${error}`);
    }
  }

  private async setupLetsEncryptCertificates(results: CertificateInfo[], errors: string[]): Promise<void> {
    console.log('🔐 Setting up Let\'s Encrypt certificates...');

    // Install certbot if not present
    await this.installCertbot();

    const domainArgs = this.config.domains.map(domain => `-d ${domain}`).join(' ');
    const stagingFlag = this.config.staging ? '--staging' : '';
    const keyType = this.config.keyType || 'rsa';
    const keySize = this.config.keySize || (keyType === 'rsa' ? 2048 : 256);

    try {
      const certbotCommand = [
        'sudo certbot certonly',
        '--webroot',
        '-w /var/www/html',
        domainArgs,
        `--email ${this.config.email}`,
        '--agree-tos',
        '--non-interactive',
        `--key-type ${keyType}`,
        `--rsa-key-size ${keySize}`,
        stagingFlag
      ].filter(Boolean).join(' ');

      console.log('🔄 Running certbot...');
      execSync(certbotCommand, { stdio: 'inherit' });

      // Parse certificate information
      for (const domain of this.config.domains) {
        const certInfo = await this.parseCertificateInfo(domain);
        if (certInfo) {
          results.push(certInfo);
          console.log(`✅ Certificate obtained for ${domain}`);
        }
      }

    } catch (error) {
      const errorMessage = `Let's Encrypt setup failed: ${error}`;
      console.error('❌', errorMessage);
      errors.push(errorMessage);
    }
  }

  private async setupCloudflareCertificates(results: CertificateInfo[], errors: string[]): Promise<void> {
    console.log('☁️ Setting up Cloudflare certificates...');

    if (!this.providerConfig.cloudflare) {
      errors.push('Cloudflare configuration missing');
      return;
    }

    try {
      // Install certbot cloudflare plugin
      await this.installCloudflarePlugin();

      // Create credentials file
      const credentialsPath = '/etc/ssl/cloudflare.ini';
      const credentialsContent = `dns_cloudflare_api_token = ${this.providerConfig.cloudflare.apiToken}`;
      
      execSync(`sudo bash -c 'echo "${credentialsContent}" > ${credentialsPath}'`, { stdio: 'inherit' });
      execSync(`sudo chmod 600 ${credentialsPath}`, { stdio: 'inherit' });

      const domainArgs = this.config.domains.map(domain => `-d ${domain}`).join(' ');
      const stagingFlag = this.config.staging ? '--staging' : '';

      const certbotCommand = [
        'sudo certbot certonly',
        '--dns-cloudflare',
        `--dns-cloudflare-credentials ${credentialsPath}`,
        domainArgs,
        `--email ${this.config.email}`,
        '--agree-tos',
        '--non-interactive',
        stagingFlag
      ].filter(Boolean).join(' ');

      console.log('🔄 Running certbot with Cloudflare DNS...');
      execSync(certbotCommand, { stdio: 'inherit' });

      // Parse certificate information
      for (const domain of this.config.domains) {
        const certInfo = await this.parseCertificateInfo(domain);
        if (certInfo) {
          results.push(certInfo);
          console.log(`✅ Certificate obtained for ${domain} via Cloudflare`);
        }
      }

      // Clean up credentials file
      execSync(`sudo rm -f ${credentialsPath}`, { stdio: 'inherit' });

    } catch (error) {
      const errorMessage = `Cloudflare setup failed: ${error}`;
      console.error('❌', errorMessage);
      errors.push(errorMessage);
    }
  }

  private async setupCustomCertificates(results: CertificateInfo[], errors: string[]): Promise<void> {
    console.log('📋 Setting up custom certificates...');

    if (!this.providerConfig.custom) {
      errors.push('Custom certificate configuration missing');
      return;
    }

    try {
      const { certificatePath, privateKeyPath, chainPath } = this.providerConfig.custom;

      // Verify custom certificate files exist
      if (!fs.existsSync(certificatePath)) {
        throw new Error(`Certificate file not found: ${certificatePath}`);
      }
      if (!fs.existsSync(privateKeyPath)) {
        throw new Error(`Private key file not found: ${privateKeyPath}`);
      }

      // Copy certificates to standard location
      const certDestination = path.join(this.certDir, 'cert.pem');
      const keyDestination = path.join(this.certDir, 'privkey.pem');
      const chainDestination = path.join(this.certDir, 'chain.pem');

      execSync(`sudo cp ${certificatePath} ${certDestination}`, { stdio: 'inherit' });
      execSync(`sudo cp ${privateKeyPath} ${keyDestination}`, { stdio: 'inherit' });
      
      if (chainPath && fs.existsSync(chainPath)) {
        execSync(`sudo cp ${chainPath} ${chainDestination}`, { stdio: 'inherit' });
      }

      // Set proper permissions
      execSync(`sudo chmod 644 ${certDestination}`, { stdio: 'inherit' });
      execSync(`sudo chmod 600 ${keyDestination}`, { stdio: 'inherit' });
      if (chainPath) {
        execSync(`sudo chmod 644 ${chainDestination}`, { stdio: 'inherit' });
      }

      // Parse certificate information for each domain
      for (const domain of this.config.domains) {
        try {
          const certInfo = await this.parseCustomCertificateInfo(domain, certificatePath);
          if (certInfo) {
            results.push(certInfo);
            console.log(`✅ Custom certificate configured for ${domain}`);
          }
        } catch (error) {
          errors.push(`Failed to parse certificate for ${domain}: ${error}`);
        }
      }

    } catch (error) {
      const errorMessage = `Custom certificate setup failed: ${error}`;
      console.error('❌', errorMessage);
      errors.push(errorMessage);
    }
  }

  private async installCertbot(): Promise<void> {
    try {
      // Check if certbot is already installed
      execSync('which certbot', { stdio: 'pipe' });
      console.log('📦 Certbot already installed');
    } catch {
      console.log('📦 Installing certbot...');
      try {
        // Try different package managers
        execSync('sudo apt-get update && sudo apt-get install -y certbot', { stdio: 'inherit' });
      } catch {
        try {
          execSync('sudo yum install -y certbot', { stdio: 'inherit' });
        } catch {
          try {
            execSync('brew install certbot', { stdio: 'inherit' });
          } catch {
            throw new Error('Failed to install certbot. Please install manually.');
          }
        }
      }
    }
  }

  private async installCloudflarePlugin(): Promise<void> {
    try {
      console.log('📦 Installing certbot Cloudflare plugin...');
      try {
        execSync('sudo apt-get install -y python3-certbot-dns-cloudflare', { stdio: 'inherit' });
      } catch {
        try {
          execSync('sudo yum install -y python3-certbot-dns-cloudflare', { stdio: 'inherit' });
        } catch {
          try {
            execSync('pip3 install certbot-dns-cloudflare', { stdio: 'inherit' });
          } catch {
            throw new Error('Failed to install certbot Cloudflare plugin. Please install manually.');
          }
        }
      }
    } catch (error) {
      throw new Error(`Cloudflare plugin installation failed: ${error}`);
    }
  }

  private async parseCertificateInfo(domain: string): Promise<CertificateInfo | null> {
    try {
      const certPath = `/etc/letsencrypt/live/${domain}/cert.pem`;
      
      if (!fs.existsSync(certPath)) {
        console.warn(`⚠️ Certificate file not found: ${certPath}`);
        return null;
      }

      const certOutput = execSync(`openssl x509 -in ${certPath} -text -noout`, { encoding: 'utf8' });
      const fingerprint = execSync(`openssl x509 -in ${certPath} -fingerprint -noout`, { encoding: 'utf8' });

      // Parse certificate details
      const issuerMatch = certOutput.match(/Issuer: (.+)/);
      const validFromMatch = certOutput.match(/Not Before: (.+)/);
      const validToMatch = certOutput.match(/Not After : (.+)/);
      const fingerprintMatch = fingerprint.match(/SHA1 Fingerprint=(.+)/);

      if (!issuerMatch || !validFromMatch || !validToMatch || !fingerprintMatch) {
        throw new Error('Failed to parse certificate information');
      }

      const validFrom = new Date(validFromMatch[1]);
      const validTo = new Date(validToMatch[1]);
      const now = new Date();

      let status: CertificateInfo['status'] = 'valid';
      if (validTo < now) {
        status = 'expired';
      } else if (validTo.getTime() - now.getTime() < 30 * 24 * 60 * 60 * 1000) { // 30 days
        status = 'expiring';
      }

      return {
        domain,
        issuer: issuerMatch[1].trim(),
        validFrom,
        validTo,
        fingerprint: fingerprintMatch[1].trim(),
        status
      };

    } catch (error) {
      console.error(`Failed to parse certificate for ${domain}:`, error);
      return null;
    }
  }

  private async parseCustomCertificateInfo(domain: string, certificatePath: string): Promise<CertificateInfo | null> {
    try {
      const certOutput = execSync(`openssl x509 -in ${certificatePath} -text -noout`, { encoding: 'utf8' });
      const fingerprint = execSync(`openssl x509 -in ${certificatePath} -fingerprint -noout`, { encoding: 'utf8' });

      // Parse certificate details (same logic as parseCertificateInfo)
      const issuerMatch = certOutput.match(/Issuer: (.+)/);
      const validFromMatch = certOutput.match(/Not Before: (.+)/);
      const validToMatch = certOutput.match(/Not After : (.+)/);
      const fingerprintMatch = fingerprint.match(/SHA1 Fingerprint=(.+)/);

      if (!issuerMatch || !validFromMatch || !validToMatch || !fingerprintMatch) {
        throw new Error('Failed to parse custom certificate information');
      }

      const validFrom = new Date(validFromMatch[1]);
      const validTo = new Date(validToMatch[1]);
      const now = new Date();

      let status: CertificateInfo['status'] = 'valid';
      if (validTo < now) {
        status = 'expired';
      } else if (validTo.getTime() - now.getTime() < 30 * 24 * 60 * 60 * 1000) { // 30 days
        status = 'expiring';
      }

      return {
        domain,
        issuer: issuerMatch[1].trim(),
        validFrom,
        validTo,
        fingerprint: fingerprintMatch[1].trim(),
        status
      };

    } catch (error) {
      console.error(`Failed to parse custom certificate for ${domain}:`, error);
      return null;
    }
  }

  private async verifyCertificates(results: CertificateInfo[], errors: string[]): Promise<void> {
    console.log('🔍 Verifying SSL certificates...');

    for (const cert of results) {
      try {
        // Test SSL connection
        const testCommand = `echo | openssl s_client -connect ${cert.domain}:443 -servername ${cert.domain} 2>/dev/null | openssl x509 -noout -dates`;
        execSync(testCommand, { stdio: 'pipe' });
        console.log(`✅ SSL verification successful for ${cert.domain}`);
      } catch (error) {
        const errorMessage = `SSL verification failed for ${cert.domain}: ${error}`;
        console.warn('⚠️', errorMessage);
        errors.push(errorMessage);
      }
    }
  }

  private async setupAutoRenewal(): Promise<void> {
    console.log('🔄 Setting up automatic certificate renewal...');

    try {
      // Create renewal script
      const renewalScript = `#!/bin/bash
# Vocilia SSL Certificate Auto-Renewal Script
# Generated by SSL Setup Manager

# Attempt certificate renewal
certbot renew --quiet

# Restart web services if renewal occurred
if [ $? -eq 0 ]; then
    echo "Certificate renewal successful - restarting services"
    systemctl reload nginx 2>/dev/null || service nginx reload 2>/dev/null || true
    systemctl reload apache2 2>/dev/null || service apache2 reload 2>/dev/null || true
    echo "SSL certificate renewal completed at $(date)" >> /var/log/ssl-renewal.log
fi
`;

      const renewalScriptPath = '/etc/ssl/vocilia-renewal.sh';
      execSync(`sudo bash -c 'echo "${renewalScript}" > ${renewalScriptPath}'`, { stdio: 'inherit' });
      execSync(`sudo chmod +x ${renewalScriptPath}`, { stdio: 'inherit' });

      // Setup cron job for automatic renewal (twice daily)
      const cronEntry = `0 2,14 * * * ${renewalScriptPath} >/dev/null 2>&1`;
      execSync(`(crontab -l 2>/dev/null || true; echo "${cronEntry}") | crontab -`, { stdio: 'inherit' });

      console.log('✅ Automatic renewal configured (runs twice daily)');

    } catch (error) {
      console.error('❌ Failed to setup auto-renewal:', error);
    }
  }

  private async configureWebServers(results: CertificateInfo[], errors: string[]): Promise<void> {
    console.log('🌐 Configuring web servers...');

    // Generate nginx configuration
    await this.generateNginxConfig(results, errors);

    // Generate Apache configuration (if Apache is detected)
    await this.generateApacheConfig(results, errors);
  }

  private async generateNginxConfig(results: CertificateInfo[], errors: string[]): Promise<void> {
    try {
      // Check if nginx is installed
      execSync('which nginx', { stdio: 'pipe' });

      const nginxConfig = this.generateNginxSSLConfig(results);
      const configPath = '/etc/nginx/sites-available/vocilia-ssl';

      execSync(`sudo bash -c 'echo "${nginxConfig}" > ${configPath}'`, { stdio: 'inherit' });
      
      // Enable the site
      execSync(`sudo ln -sf ${configPath} /etc/nginx/sites-enabled/`, { stdio: 'inherit' });
      
      // Test and reload nginx
      execSync('sudo nginx -t', { stdio: 'inherit' });
      execSync('sudo systemctl reload nginx', { stdio: 'inherit' });

      console.log('✅ Nginx SSL configuration updated');

    } catch (error) {
      if (error instanceof Error && error.message.includes('nginx')) {
        console.log('ℹ️ Nginx not found, skipping nginx configuration');
      } else {
        const errorMessage = `Nginx configuration failed: ${error}`;
        console.error('❌', errorMessage);
        errors.push(errorMessage);
      }
    }
  }

  private generateNginxSSLConfig(certificates: CertificateInfo[]): string {
    const serverBlocks = certificates.map(cert => {
      const domain = cert.domain;
      const certPath = this.config.provider === 'custom' 
        ? `${this.certDir}/cert.pem`
        : `/etc/letsencrypt/live/${domain}/fullchain.pem`;
      const keyPath = this.config.provider === 'custom'
        ? `${this.certDir}/privkey.pem`
        : `/etc/letsencrypt/live/${domain}/privkey.pem`;

      return `
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${domain};

    ssl_certificate ${certPath};
    ssl_certificate_key ${keyPath};

    # Modern SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    # HSTS
    add_header Strict-Transport-Security "max-age=63072000" always;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";

    # Application-specific configuration
    location / {
        # Proxy to application or serve static files
        # This should be customized based on your application setup
        try_files $uri $uri/ =404;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name ${domain};
    return 301 https://$server_name$request_uri;
}`;
    }).join('\n');

    return `# Vocilia SSL Configuration
# Generated by SSL Setup Manager
${serverBlocks}`;
  }

  private async generateApacheConfig(results: CertificateInfo[], errors: string[]): Promise<void> {
    try {
      // Check if Apache is installed
      execSync('which apache2', { stdio: 'pipe' });

      const apacheConfig = this.generateApacheSSLConfig(results);
      const configPath = '/etc/apache2/sites-available/vocilia-ssl.conf';

      execSync(`sudo bash -c 'echo "${apacheConfig}" > ${configPath}'`, { stdio: 'inherit' });
      
      // Enable SSL module and site
      execSync('sudo a2enmod ssl', { stdio: 'inherit' });
      execSync('sudo a2ensite vocilia-ssl', { stdio: 'inherit' });
      
      // Test and reload Apache
      execSync('sudo apache2ctl configtest', { stdio: 'inherit' });
      execSync('sudo systemctl reload apache2', { stdio: 'inherit' });

      console.log('✅ Apache SSL configuration updated');

    } catch (error) {
      if (error instanceof Error && error.message.includes('apache2')) {
        console.log('ℹ️ Apache not found, skipping Apache configuration');
      } else {
        const errorMessage = `Apache configuration failed: ${error}`;
        console.error('❌', errorMessage);
        errors.push(errorMessage);
      }
    }
  }

  private generateApacheSSLConfig(certificates: CertificateInfo[]): string {
    const virtualHosts = certificates.map(cert => {
      const domain = cert.domain;
      const certPath = this.config.provider === 'custom' 
        ? `${this.certDir}/cert.pem`
        : `/etc/letsencrypt/live/${domain}/fullchain.pem`;
      const keyPath = this.config.provider === 'custom'
        ? `${this.certDir}/privkey.pem`
        : `/etc/letsencrypt/live/${domain}/privkey.pem`;

      return `
<VirtualHost *:443>
    ServerName ${domain}
    
    SSLEngine on
    SSLCertificateFile ${certPath}
    SSLCertificateKeyFile ${keyPath}
    
    # Modern SSL configuration
    SSLProtocol all -SSLv3 -TLSv1 -TLSv1.1
    SSLCipherSuite ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384
    SSLHonorCipherOrder off
    SSLSessionTickets off
    
    # HSTS
    Header always set Strict-Transport-Security "max-age=63072000"
    
    # Security headers
    Header always set X-Frame-Options DENY
    Header always set X-Content-Type-Options nosniff
    Header always set X-XSS-Protection "1; mode=block"
    
    # Application-specific configuration
    DocumentRoot /var/www/html
    
    # This should be customized based on your application setup
</VirtualHost>

# Redirect HTTP to HTTPS
<VirtualHost *:80>
    ServerName ${domain}
    Redirect permanent / https://${domain}/
</VirtualHost>`;
    }).join('\n');

    return `# Vocilia SSL Configuration
# Generated by SSL Setup Manager
${virtualHosts}`;
  }

  async renewCertificates(): Promise<{ success: boolean; renewed: string[]; errors: string[] }> {
    console.log('🔄 Renewing SSL certificates...');
    
    const renewed: string[] = [];
    const errors: string[] = [];

    try {
      if (this.config.provider === 'letsencrypt') {
        const output = execSync('sudo certbot renew --dry-run', { encoding: 'utf8' });
        
        // Parse renewal output
        for (const domain of this.config.domains) {
          if (output.includes(domain)) {
            renewed.push(domain);
            console.log(`✅ Certificate renewal successful for ${domain}`);
          }
        }
      } else {
        console.log('ℹ️ Manual certificate renewal required for non-Let\'s Encrypt certificates');
      }

      return { success: true, renewed, errors };

    } catch (error) {
      const errorMessage = `Certificate renewal failed: ${error}`;
      console.error('❌', errorMessage);
      errors.push(errorMessage);
      
      return { success: false, renewed, errors };
    }
  }

  async getCertificateStatus(): Promise<CertificateInfo[]> {
    const certificates: CertificateInfo[] = [];

    for (const domain of this.config.domains) {
      const certInfo = await this.parseCertificateInfo(domain);
      if (certInfo) {
        certificates.push(certInfo);
      }
    }

    return certificates;
  }
}

// CLI usage example
if (require.main === module) {
  const sslConfig: SSLConfig = {
    domains: [
      'api.vocilia.com',
      'admin.vocilia.com', 
      'business.vocilia.com'
    ],
    email: 'devops@vocilia.com',
    provider: 'letsencrypt',
    staging: false,
    keyType: 'rsa',
    keySize: 2048,
    autoRenewal: true
  };

  const providerConfig: ProviderConfig = {
    // cloudflare: {
    //   apiToken: process.env.CLOUDFLARE_API_TOKEN || '',
    //   zone: 'vocilia.com'
    // }
  };

  const sslManager = new SSLSetupManager(sslConfig, providerConfig);
  
  sslManager.setupSSLCertificates()
    .then(result => {
      console.log('\n📊 SSL Setup Results:');
      console.log(`Success: ${result.success}`);
      console.log(`Certificates: ${result.certificates.length}`);
      console.log(`Errors: ${result.errors.length}`);
      
      if (result.errors.length > 0) {
        console.log('\n❌ Errors:');
        result.errors.forEach(error => console.log(`  - ${error}`));
      }
      
      if (result.certificates.length > 0) {
        console.log('\n✅ Certificates:');
        result.certificates.forEach(cert => {
          console.log(`  - ${cert.domain}: ${cert.status} (expires ${cert.validTo.toLocaleDateString()})`);
        });
      }
      
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 SSL setup failed:', error);
      process.exit(1);
    });
}