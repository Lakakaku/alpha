/**
 * OWASP ZAP Integration Configuration
 * Automated vulnerability scanning setup for Vocilia security testing
 */

import { config } from 'dotenv';

config();

export interface ZapScanProfile {
  name: string;
  scanDepth: 'quick' | 'comprehensive' | 'full';
  maxDuration: number; // minutes
  performanceLimit: number; // percentage
  scanTargets: string[];
}

export interface ZapConfiguration {
  apiUrl: string;
  apiKey: string;
  proxy: {
    host: string;
    port: number;
  };
  scanProfiles: Record<string, ZapScanProfile>;
  reportFormats: string[];
  maxConcurrentScans: number;
}

export const zapConfig: ZapConfiguration = {
  apiUrl: process.env.ZAP_API_URL || 'http://localhost:8080',
  apiKey: process.env.ZAP_API_KEY || '',
  proxy: {
    host: process.env.ZAP_PROXY_HOST || 'localhost',
    port: parseInt(process.env.ZAP_PROXY_PORT || '8081')
  },
  scanProfiles: {
    'owasp-top-10': {
      name: 'OWASP Top 10 Scan',
      scanDepth: 'comprehensive',
      maxDuration: 25, // matches quickstart requirement
      performanceLimit: 10, // constitutional requirement
      scanTargets: [
        '/api/auth/*',
        '/api/admin/*',
        '/api/business/*',
        '/api/customer/*',
        '/api/qr/*'
      ]
    },
    'quick-security': {
      name: 'Quick Security Check',
      scanDepth: 'quick',
      maxDuration: 5,
      performanceLimit: 5,
      scanTargets: [
        '/api/health',
        '/api/auth/login',
        '/api/admin/stores'
      ]
    },
    'comprehensive': {
      name: 'Full Security Assessment',
      scanDepth: 'full',
      maxDuration: 60,
      performanceLimit: 10,
      scanTargets: ['/*']
    }
  },
  reportFormats: ['json', 'html', 'xml'],
  maxConcurrentScans: 1 // prevent performance impact
};

export class OwaspZapClient {
  private config: ZapConfiguration;
  private baseUrl: string;

  constructor(configuration: ZapConfiguration = zapConfig) {
    this.config = configuration;
    this.baseUrl = `${configuration.apiUrl}/JSON`;
  }

  /**
   * Initialize ZAP client and verify connection
   */
  async initialize(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/core/view/version/`, {
        headers: this.getHeaders()
      });
      
      if (!response.ok) {
        throw new Error(`ZAP connection failed: ${response.status}`);
      }

      const data = await response.json();
      console.log(`Connected to OWASP ZAP version: ${data.version}`);
      return true;
    } catch (error) {
      console.error('Failed to connect to OWASP ZAP:', error);
      return false;
    }
  }

  /**
   * Start vulnerability scan with specified profile
   */
  async startScan(profileName: string, targetUrl: string): Promise<string> {
    const profile = this.config.scanProfiles[profileName];
    if (!profile) {
      throw new Error(`Unknown scan profile: ${profileName}`);
    }

    try {
      // Start active scan
      const response = await fetch(`${this.baseUrl}/ascan/action/scan/`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: new URLSearchParams({
          url: targetUrl,
          recurse: 'true',
          inScopeOnly: 'false',
          scanPolicyName: profile.name,
          method: 'GET'
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to start scan: ${response.status}`);
      }

      const data = await response.json();
      return data.scan; // scan ID
    } catch (error) {
      console.error('Failed to start ZAP scan:', error);
      throw error;
    }
  }

  /**
   * Get scan progress and status
   */
  async getScanStatus(scanId: string): Promise<{
    status: number;
    progress: number;
    isComplete: boolean;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/ascan/view/status/`, {
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get scan status: ${response.status}`);
      }

      const data = await response.json();
      const progress = parseInt(data.status);
      
      return {
        status: progress,
        progress,
        isComplete: progress >= 100
      };
    } catch (error) {
      console.error('Failed to get scan status:', error);
      throw error;
    }
  }

  /**
   * Get vulnerability report for completed scan
   */
  async getVulnerabilityReport(format: string = 'json'): Promise<any> {
    try {
      const endpoint = format === 'json' ? 'alerts' : `report/${format}`;
      const response = await fetch(`${this.baseUrl}/core/view/${endpoint}/`, {
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get vulnerability report: ${response.status}`);
      }

      if (format === 'json') {
        return await response.json();
      } else {
        return await response.text();
      }
    } catch (error) {
      console.error('Failed to get vulnerability report:', error);
      throw error;
    }
  }

  /**
   * Stop active scan
   */
  async stopScan(scanId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/ascan/action/stop/`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: new URLSearchParams({ scanId })
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to stop scan:', error);
      return false;
    }
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    if (this.config.apiKey) {
      headers['X-ZAP-API-Key'] = this.config.apiKey;
    }

    return headers;
  }
}

export default OwaspZapClient;