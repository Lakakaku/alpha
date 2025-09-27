#!/usr/bin/env tsx

import { execSync, spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import * as path from 'path';

interface DeploymentConfig {
  projectId: string;
  environment: 'staging' | 'production';
  serviceId?: string;
  variables?: Record<string, string>;
  buildCommand?: string;
  startCommand?: string;
  healthCheckUrl?: string;
  rollbackOnFailure: boolean;
  timeout: number; // seconds
}

interface DeploymentResult {
  success: boolean;
  deploymentId?: string;
  deploymentUrl?: string;
  duration: number;
  logs: string[];
  errors: string[];
  rollbackInfo?: {
    previousDeploymentId: string;
    rollbackExecuted: boolean;
  };
}

class RailwayDeployer {
  private config: DeploymentConfig;
  private startTime: number = 0;
  private logs: string[] = [];
  private errors: string[] = [];

  constructor(config: DeploymentConfig) {
    this.config = config;
  }

  public async deploy(): Promise<DeploymentResult> {
    this.startTime = Date.now();
    this.log('🚀 Starting Railway backend deployment...');

    try {
      // Pre-deployment validation
      await this.validateEnvironment();
      await this.validateRailwayCLI();
      await this.validateProject();

      // Get current deployment for potential rollback
      const currentDeployment = await this.getCurrentDeployment();

      // Set environment variables
      if (this.config.variables) {
        await this.setEnvironmentVariables(this.config.variables);
      }

      // Deploy to Railway
      const deploymentId = await this.executeDeployment();

      // Wait for deployment to complete
      await this.waitForDeployment(deploymentId);

      // Verify deployment health
      const deploymentUrl = await this.getDeploymentUrl(deploymentId);
      await this.verifyDeploymentHealth(deploymentUrl);

      // Update deployment status
      await this.updateDeploymentStatus(deploymentId, 'completed');

      this.log('✅ Deployment completed successfully');

      return {
        success: true,
        deploymentId,
        deploymentUrl,
        duration: Date.now() - this.startTime,
        logs: this.logs,
        errors: this.errors
      };

    } catch (error) {
      this.error(`❌ Deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);

      // Attempt rollback if enabled
      let rollbackInfo;
      if (this.config.rollbackOnFailure) {
        rollbackInfo = await this.attemptRollback();
      }

      return {
        success: false,
        duration: Date.now() - this.startTime,
        logs: this.logs,
        errors: this.errors,
        rollbackInfo
      };
    }
  }

  private async validateEnvironment(): Promise<void> {
    this.log('🔍 Validating deployment environment...');

    // Check if we're in the correct directory
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    if (!existsSync(packageJsonPath)) {
      throw new Error('package.json not found. Please run from project root.');
    }

    // Validate backend app exists
    const backendPath = path.join(process.cwd(), 'apps', 'backend');
    if (!existsSync(backendPath)) {
      throw new Error('Backend app directory not found at apps/backend');
    }

    // Check Railway configuration
    const railwayConfigPath = path.join(process.cwd(), 'apps', 'backend', 'railway.json');
    if (!existsSync(railwayConfigPath)) {
      throw new Error('Railway configuration not found at apps/backend/railway.json');
    }

    // Validate environment-specific configuration
    const envConfigPath = path.join(process.cwd(), 'deployment', 'railway', `${this.config.environment}.json`);
    if (!existsSync(envConfigPath)) {
      throw new Error(`Environment configuration not found: ${envConfigPath}`);
    }

    this.log('✅ Environment validation passed');
  }

  private async validateRailwayCLI(): Promise<void> {
    this.log('🔍 Validating Railway CLI...');

    try {
      const version = execSync('railway --version', { encoding: 'utf8' }).trim();
      this.log(`Railway CLI version: ${version}`);

      // Check if logged in
      try {
        execSync('railway whoami', { encoding: 'utf8' });
        this.log('✅ Railway CLI authenticated');
      } catch {
        throw new Error('Railway CLI not authenticated. Run: railway login');
      }

    } catch (error) {
      throw new Error('Railway CLI not found. Install with: npm install -g @railway/cli');
    }
  }

  private async validateProject(): Promise<void> {
    this.log('🔍 Validating Railway project...');

    try {
      // Link to project if not already linked
      if (this.config.projectId) {
        execSync(`railway link ${this.config.projectId}`, { 
          encoding: 'utf8',
          cwd: path.join(process.cwd(), 'apps', 'backend')
        });
      }

      // Verify project is linked
      const projectInfo = execSync('railway status', { 
        encoding: 'utf8',
        cwd: path.join(process.cwd(), 'apps', 'backend')
      });
      
      this.log(`Project status: ${projectInfo.trim()}`);

      // Set environment if specified
      if (this.config.environment) {
        execSync(`railway environment ${this.config.environment}`, {
          encoding: 'utf8',
          cwd: path.join(process.cwd(), 'apps', 'backend')
        });
        this.log(`Environment set to: ${this.config.environment}`);
      }

    } catch (error) {
      throw new Error(`Failed to validate Railway project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async getCurrentDeployment(): Promise<string | null> {
    try {
      const deployments = execSync('railway deployments', { 
        encoding: 'utf8',
        cwd: path.join(process.cwd(), 'apps', 'backend')
      });
      
      // Parse latest deployment ID from output
      const lines = deployments.split('\n');
      for (const line of lines) {
        if (line.includes('Active') || line.includes('Success')) {
          const match = line.match(/([a-f0-9-]{36})/);
          if (match) {
            return match[1];
          }
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  private async setEnvironmentVariables(variables: Record<string, string>): Promise<void> {
    this.log('⚙️ Setting environment variables...');

    for (const [key, value] of Object.entries(variables)) {
      try {
        execSync(`railway variables set ${key}="${value}"`, { 
          encoding: 'utf8',
          cwd: path.join(process.cwd(), 'apps', 'backend')
        });
        this.log(`Set variable: ${key}`);
      } catch (error) {
        this.error(`Failed to set variable ${key}: ${error}`);
        throw error;
      }
    }

    this.log('✅ Environment variables updated');
  }

  private async executeDeployment(): Promise<string> {
    this.log('🚢 Executing Railway deployment...');

    return new Promise((resolve, reject) => {
      const deployCommand = this.config.serviceId 
        ? `railway up --service ${this.config.serviceId}`
        : 'railway up';

      const deployProcess = spawn('railway', deployCommand.split(' ').slice(1), {
        cwd: path.join(process.cwd(), 'apps', 'backend'),
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let deploymentId = '';
      let output = '';

      deployProcess.stdout?.on('data', (data) => {
        const text = data.toString();
        output += text;
        this.log(text.trim());

        // Extract deployment ID from output
        const deploymentMatch = text.match(/Deployment ID: ([a-f0-9-]{36})/);
        if (deploymentMatch) {
          deploymentId = deploymentMatch[1];
        }
      });

      deployProcess.stderr?.on('data', (data) => {
        const text = data.toString();
        this.error(text.trim());
      });

      deployProcess.on('close', (code) => {
        if (code === 0 && deploymentId) {
          this.log(`✅ Deployment initiated with ID: ${deploymentId}`);
          resolve(deploymentId);
        } else {
          reject(new Error(`Railway deployment failed with code ${code}`));
        }
      });

      // Set timeout
      setTimeout(() => {
        deployProcess.kill();
        reject(new Error('Deployment timed out'));
      }, this.config.timeout * 1000);
    });
  }

  private async waitForDeployment(deploymentId: string): Promise<void> {
    this.log(`⏳ Waiting for deployment ${deploymentId} to complete...`);

    const maxAttempts = Math.floor(this.config.timeout / 10); // Check every 10 seconds
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const status = execSync(`railway deployment status ${deploymentId}`, { 
          encoding: 'utf8',
          cwd: path.join(process.cwd(), 'apps', 'backend')
        });

        if (status.includes('SUCCESS') || status.includes('ACTIVE')) {
          this.log('✅ Deployment completed successfully');
          return;
        }

        if (status.includes('FAILED') || status.includes('CRASHED')) {
          throw new Error(`Deployment failed: ${status}`);
        }

        this.log(`Deployment status: ${status.trim()}`);
        await this.sleep(10000); // Wait 10 seconds
        attempts++;

      } catch (error) {
        throw new Error(`Failed to check deployment status: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    throw new Error('Deployment timeout exceeded');
  }

  private async getDeploymentUrl(deploymentId: string): Promise<string> {
    try {
      const domains = execSync('railway domain', { 
        encoding: 'utf8',
        cwd: path.join(process.cwd(), 'apps', 'backend')
      });

      // Extract domain from output
      const domainMatch = domains.match(/https?:\/\/[^\s]+/);
      if (domainMatch) {
        return domainMatch[0];
      }

      // Fallback to Railway-generated domain
      return `https://${this.config.projectId}.railway.app`;
    } catch {
      return `https://${this.config.projectId}.railway.app`;
    }
  }

  private async verifyDeploymentHealth(url: string): Promise<void> {
    if (!this.config.healthCheckUrl) {
      this.log('⚠️ No health check URL configured, skipping health verification');
      return;
    }

    this.log(`🏥 Verifying deployment health at ${url}${this.config.healthCheckUrl}...`);

    const healthUrl = `${url}${this.config.healthCheckUrl}`;
    const maxAttempts = 10;
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const response = await fetch(healthUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'Railway-Deploy-Script/1.0'
          }
        });

        if (response.ok) {
          this.log('✅ Health check passed');
          return;
        }

        this.log(`Health check attempt ${attempts + 1} failed: ${response.status}`);
        
      } catch (error) {
        this.log(`Health check attempt ${attempts + 1} error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      await this.sleep(5000); // Wait 5 seconds between attempts
      attempts++;
    }

    throw new Error('Health check failed after maximum attempts');
  }

  private async updateDeploymentStatus(deploymentId: string, status: 'completed' | 'failed'): Promise<void> {
    // This would update the deployment status in the monitoring system
    // For now, just log the status
    this.log(`📊 Deployment status updated: ${status} (ID: ${deploymentId})`);
  }

  private async attemptRollback(): Promise<{ previousDeploymentId: string; rollbackExecuted: boolean }> {
    this.log('🔄 Attempting rollback...');

    try {
      const previousDeployment = await this.getCurrentDeployment();
      if (!previousDeployment) {
        throw new Error('No previous deployment found for rollback');
      }

      execSync(`railway rollback ${previousDeployment}`, { 
        encoding: 'utf8',
        cwd: path.join(process.cwd(), 'apps', 'backend')
      });

      this.log(`✅ Rollback completed to deployment: ${previousDeployment}`);
      return {
        previousDeploymentId: previousDeployment,
        rollbackExecuted: true
      };

    } catch (error) {
      this.error(`Failed to rollback: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        previousDeploymentId: 'unknown',
        rollbackExecuted: false
      };
    }
  }

  private log(message: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    this.logs.push(logMessage);
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
  
  // Load configuration
  const configPath = path.join(process.cwd(), 'deployment', 'railway', `${environment}.json`);
  
  if (!existsSync(configPath)) {
    console.error(`❌ Configuration file not found: ${configPath}`);
    process.exit(1);
  }

  const config: DeploymentConfig = {
    ...JSON.parse(readFileSync(configPath, 'utf8')),
    environment,
    rollbackOnFailure: true,
    timeout: 600 // 10 minutes
  };

  // Override with environment variables if present
  if (process.env.RAILWAY_PROJECT_ID) {
    config.projectId = process.env.RAILWAY_PROJECT_ID;
  }
  if (process.env.RAILWAY_SERVICE_ID) {
    config.serviceId = process.env.RAILWAY_SERVICE_ID;
  }

  console.log(`🚀 Starting Railway deployment to ${environment}`);
  console.log(`Project ID: ${config.projectId}`);
  console.log(`Service ID: ${config.serviceId || 'default'}`);

  const deployer = new RailwayDeployer(config);
  const result = await deployer.deploy();

  // Write deployment result to file
  const resultPath = path.join(process.cwd(), 'deployment', 'logs', `railway-${environment}-${Date.now()}.json`);
  writeFileSync(resultPath, JSON.stringify(result, null, 2));

  if (result.success) {
    console.log(`✅ Deployment successful! Duration: ${result.duration}ms`);
    console.log(`📄 Deployment log: ${resultPath}`);
    process.exit(0);
  } else {
    console.error(`❌ Deployment failed! Duration: ${result.duration}ms`);
    console.error(`📄 Deployment log: ${resultPath}`);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Deployment script failed:', error);
    process.exit(1);
  });
}

export { RailwayDeployer, DeploymentConfig, DeploymentResult };