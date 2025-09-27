#!/usr/bin/env tsx

import { execSync, spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import * as path from 'path';

interface FrontendApp {
  name: 'customer' | 'business' | 'admin';
  path: string;
  domain?: string;
  environmentVariables?: Record<string, string>;
  buildCommand?: string;
  outputDirectory?: string;
}

interface VercelDeploymentConfig {
  environment: 'preview' | 'production';
  apps: FrontendApp[];
  teamId?: string;
  projectLinks: Record<string, string>; // app name -> vercel project id
  rollbackOnFailure: boolean;
  timeout: number; // seconds
  parallelDeployments: boolean;
}

interface AppDeploymentResult {
  app: string;
  success: boolean;
  deploymentId?: string;
  deploymentUrl?: string;
  previewUrl?: string;
  duration: number;
  buildLogs: string[];
  errors: string[];
}

interface VercelDeploymentResult {
  success: boolean;
  duration: number;
  apps: AppDeploymentResult[];
  errors: string[];
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

class VercelDeployer {
  private config: VercelDeploymentConfig;
  private startTime: number = 0;
  private errors: string[] = [];

  constructor(config: VercelDeploymentConfig) {
    this.config = config;
  }

  public async deployAll(): Promise<VercelDeploymentResult> {
    this.startTime = Date.now();
    this.log('🚀 Starting Vercel frontend deployments...');

    try {
      // Pre-deployment validation
      await this.validateEnvironment();
      await this.validateVercelCLI();
      await this.validateProjects();

      // Deploy apps
      const appResults = this.config.parallelDeployments
        ? await this.deployAppsParallel()
        : await this.deployAppsSequential();

      // Calculate summary
      const summary = {
        total: appResults.length,
        successful: appResults.filter(r => r.success).length,
        failed: appResults.filter(r => !r.success).length
      };

      const overallSuccess = summary.failed === 0;

      // Handle rollback if needed
      if (!overallSuccess && this.config.rollbackOnFailure) {
        await this.attemptRollbackAll(appResults.filter(r => r.success));
      }

      this.log(`✅ Deployment completed. Success: ${summary.successful}/${summary.total}`);

      return {
        success: overallSuccess,
        duration: Date.now() - this.startTime,
        apps: appResults,
        errors: this.errors,
        summary
      };

    } catch (error) {
      this.error(`❌ Deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);

      return {
        success: false,
        duration: Date.now() - this.startTime,
        apps: [],
        errors: this.errors,
        summary: { total: 0, successful: 0, failed: 0 }
      };
    }
  }

  public async deploySingleApp(appName: string): Promise<AppDeploymentResult> {
    const app = this.config.apps.find(a => a.name === appName);
    if (!app) {
      throw new Error(`App ${appName} not found in configuration`);
    }

    return await this.deployApp(app);
  }

  private async validateEnvironment(): Promise<void> {
    this.log('🔍 Validating deployment environment...');

    // Check if we're in the correct directory
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    if (!existsSync(packageJsonPath)) {
      throw new Error('package.json not found. Please run from project root.');
    }

    // Validate each app directory exists
    for (const app of this.config.apps) {
      const appPath = path.join(process.cwd(), app.path);
      if (!existsSync(appPath)) {
        throw new Error(`App directory not found: ${app.path}`);
      }

      const appPackageJson = path.join(appPath, 'package.json');
      if (!existsSync(appPackageJson)) {
        throw new Error(`package.json not found for app: ${app.name}`);
      }
    }

    // Validate Vercel configurations exist
    for (const app of this.config.apps) {
      const vercelConfigPath = path.join(process.cwd(), 'deployment', 'vercel', `${app.name}.json`);
      if (!existsSync(vercelConfigPath)) {
        throw new Error(`Vercel configuration not found: ${vercelConfigPath}`);
      }
    }

    this.log('✅ Environment validation passed');
  }

  private async validateVercelCLI(): Promise<void> {
    this.log('🔍 Validating Vercel CLI...');

    try {
      const version = execSync('vercel --version', { encoding: 'utf8' }).trim();
      this.log(`Vercel CLI version: ${version}`);

      // Check if logged in
      try {
        const whoami = execSync('vercel whoami', { encoding: 'utf8' }).trim();
        this.log(`Vercel user: ${whoami}`);
      } catch {
        throw new Error('Vercel CLI not authenticated. Run: vercel login');
      }

    } catch (error) {
      throw new Error('Vercel CLI not found. Install with: npm install -g vercel');
    }
  }

  private async validateProjects(): Promise<void> {
    this.log('🔍 Validating Vercel projects...');

    for (const app of this.config.apps) {
      const projectId = this.config.projectLinks[app.name];
      if (!projectId) {
        throw new Error(`No Vercel project ID configured for app: ${app.name}`);
      }

      try {
        // Link to project
        const appPath = path.join(process.cwd(), app.path);
        const linkCommand = this.config.teamId
          ? `vercel link --project ${projectId} --scope ${this.config.teamId} --yes`
          : `vercel link --project ${projectId} --yes`;

        execSync(linkCommand, { 
          encoding: 'utf8',
          cwd: appPath
        });

        this.log(`✅ Linked app ${app.name} to project ${projectId}`);

      } catch (error) {
        throw new Error(`Failed to link app ${app.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  private async deployAppsParallel(): Promise<AppDeploymentResult[]> {
    this.log('🚀 Deploying apps in parallel...');

    const deploymentPromises = this.config.apps.map(app => 
      this.deployApp(app).catch(error => ({
        app: app.name,
        success: false,
        duration: 0,
        buildLogs: [],
        errors: [error instanceof Error ? error.message : 'Unknown error']
      } as AppDeploymentResult))
    );

    return await Promise.all(deploymentPromises);
  }

  private async deployAppsSequential(): Promise<AppDeploymentResult[]> {
    this.log('🚀 Deploying apps sequentially...');

    const results: AppDeploymentResult[] = [];

    for (const app of this.config.apps) {
      try {
        const result = await this.deployApp(app);
        results.push(result);

        if (!result.success) {
          this.error(`App ${app.name} deployment failed, stopping sequential deployment`);
          break;
        }
      } catch (error) {
        results.push({
          app: app.name,
          success: false,
          duration: 0,
          buildLogs: [],
          errors: [error instanceof Error ? error.message : 'Unknown error']
        });
        break;
      }
    }

    return results;
  }

  private async deployApp(app: FrontendApp): Promise<AppDeploymentResult> {
    const appStartTime = Date.now();
    this.log(`🚢 Deploying app: ${app.name}`);

    try {
      // Set environment variables
      if (app.environmentVariables) {
        await this.setAppEnvironmentVariables(app);
      }

      // Execute deployment
      const { deploymentId, deploymentUrl, previewUrl, buildLogs } = await this.executeAppDeployment(app);

      // Verify deployment if production
      if (this.config.environment === 'production' && deploymentUrl) {
        await this.verifyAppDeployment(deploymentUrl, app.name);
      }

      // Update deployment status
      await this.updateAppDeploymentStatus(app.name, deploymentId, 'completed');

      this.log(`✅ App ${app.name} deployed successfully`);

      return {
        app: app.name,
        success: true,
        deploymentId,
        deploymentUrl,
        previewUrl,
        duration: Date.now() - appStartTime,
        buildLogs,
        errors: []
      };

    } catch (error) {
      this.error(`❌ App ${app.name} deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);

      return {
        app: app.name,
        success: false,
        duration: Date.now() - appStartTime,
        buildLogs: [],
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  private async setAppEnvironmentVariables(app: FrontendApp): Promise<void> {
    if (!app.environmentVariables || Object.keys(app.environmentVariables).length === 0) {
      return;
    }

    this.log(`⚙️ Setting environment variables for ${app.name}...`);

    const appPath = path.join(process.cwd(), app.path);
    const projectId = this.config.projectLinks[app.name];

    for (const [key, value] of Object.entries(app.environmentVariables)) {
      try {
        const envCommand = this.config.teamId
          ? `vercel env add ${key} --scope ${this.config.teamId}`
          : `vercel env add ${key}`;

        const envProcess = spawn('vercel', envCommand.split(' ').slice(1), {
          cwd: appPath,
          stdio: ['pipe', 'pipe', 'pipe']
        });

        // Provide the value when prompted
        envProcess.stdin?.write(`${value}\n`);
        envProcess.stdin?.end();

        await new Promise((resolve, reject) => {
          envProcess.on('close', (code) => {
            if (code === 0) {
              resolve(void 0);
            } else {
              reject(new Error(`Failed to set environment variable ${key}`));
            }
          });
        });

        this.log(`Set environment variable: ${key} for ${app.name}`);

      } catch (error) {
        this.log(`Warning: Failed to set environment variable ${key} for ${app.name}: ${error}`);
      }
    }
  }

  private async executeAppDeployment(app: FrontendApp): Promise<{
    deploymentId: string;
    deploymentUrl?: string;
    previewUrl?: string;
    buildLogs: string[];
  }> {
    const appPath = path.join(process.cwd(), app.path);
    const buildLogs: string[] = [];

    return new Promise((resolve, reject) => {
      // Build deployment command
      const deployArgs = ['--yes'];
      
      if (this.config.environment === 'production') {
        deployArgs.push('--prod');
      }

      if (this.config.teamId) {
        deployArgs.push('--scope', this.config.teamId);
      }

      if (app.buildCommand) {
        deployArgs.push('--build-env', `BUILD_COMMAND=${app.buildCommand}`);
      }

      const deployProcess = spawn('vercel', deployArgs, {
        cwd: appPath,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let deploymentId = '';
      let deploymentUrl = '';
      let previewUrl = '';

      deployProcess.stdout?.on('data', (data) => {
        const text = data.toString();
        buildLogs.push(text.trim());
        
        // Extract deployment information from output
        const idMatch = text.match(/https:\/\/vercel\.com\/[^\/]+\/[^\/]+\/([A-Za-z0-9]+)/);
        if (idMatch) {
          deploymentId = idMatch[1];
        }

        const urlMatch = text.match(/https:\/\/[a-zA-Z0-9.-]+\.vercel\.app/);
        if (urlMatch) {
          if (this.config.environment === 'production') {
            deploymentUrl = urlMatch[0];
          } else {
            previewUrl = urlMatch[0];
          }
        }

        // Check for custom domain URL
        const customDomainMatch = text.match(/https:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        if (customDomainMatch && !customDomainMatch[0].includes('vercel.app')) {
          deploymentUrl = customDomainMatch[0];
        }
      });

      deployProcess.stderr?.on('data', (data) => {
        const text = data.toString();
        buildLogs.push(`ERROR: ${text.trim()}`);
      });

      deployProcess.on('close', (code) => {
        if (code === 0 && deploymentId) {
          resolve({
            deploymentId,
            deploymentUrl: deploymentUrl || undefined,
            previewUrl: previewUrl || undefined,
            buildLogs
          });
        } else {
          reject(new Error(`Vercel deployment failed with code ${code}. Logs: ${buildLogs.join('\n')}`));
        }
      });

      // Set timeout
      setTimeout(() => {
        deployProcess.kill();
        reject(new Error('Deployment timed out'));
      }, this.config.timeout * 1000);
    });
  }

  private async verifyAppDeployment(url: string, appName: string): Promise<void> {
    this.log(`🏥 Verifying deployment health for ${appName} at ${url}...`);

    const maxAttempts = 10;
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'User-Agent': 'Vercel-Deploy-Script/1.0'
          }
        });

        if (response.ok) {
          this.log(`✅ Health check passed for ${appName}`);
          return;
        }

        this.log(`Health check attempt ${attempts + 1} failed for ${appName}: ${response.status}`);
        
      } catch (error) {
        this.log(`Health check attempt ${attempts + 1} error for ${appName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      await this.sleep(5000); // Wait 5 seconds between attempts
      attempts++;
    }

    throw new Error(`Health check failed for ${appName} after maximum attempts`);
  }

  private async updateAppDeploymentStatus(appName: string, deploymentId: string, status: 'completed' | 'failed'): Promise<void> {
    // This would update the deployment status in the monitoring system
    // For now, just log the status
    this.log(`📊 App ${appName} deployment status updated: ${status} (ID: ${deploymentId})`);
  }

  private async attemptRollbackAll(successfulApps: AppDeploymentResult[]): Promise<void> {
    this.log('🔄 Attempting rollback for successful deployments...');

    for (const app of successfulApps) {
      try {
        const appPath = path.join(process.cwd(), this.config.apps.find(a => a.name === app.app)!.path);
        
        // Get previous deployment
        const deployments = execSync('vercel list', { 
          encoding: 'utf8',
          cwd: appPath 
        });

        // This is a simplified rollback - in practice, you'd need to identify the previous stable deployment
        this.log(`⚠️ Rollback for ${app.app} would be performed here`);

      } catch (error) {
        this.error(`Failed to rollback ${app.app}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
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
  const environment = args[0] as 'preview' | 'production' || 'preview';
  const appName = args[1]; // Optional: deploy single app
  
  // Load base configuration
  const apps: FrontendApp[] = [
    {
      name: 'customer',
      path: 'apps/customer',
      domain: environment === 'production' ? 'vocilia.com' : undefined
    },
    {
      name: 'business', 
      path: 'apps/business',
      domain: environment === 'production' ? 'business.vocilia.com' : undefined
    },
    {
      name: 'admin',
      path: 'apps/admin',
      domain: environment === 'production' ? 'admin.vocilia.com' : undefined
    }
  ];

  // Load configuration for each app
  for (const app of apps) {
    const configPath = path.join(process.cwd(), 'deployment', 'vercel', `${app.name}.json`);
    if (existsSync(configPath)) {
      const appConfig = JSON.parse(readFileSync(configPath, 'utf8'));
      Object.assign(app, appConfig);
    }
  }

  const config: VercelDeploymentConfig = {
    environment,
    apps: appName ? apps.filter(app => app.name === appName) : apps,
    teamId: process.env.VERCEL_TEAM_ID,
    projectLinks: {
      customer: process.env.VERCEL_CUSTOMER_PROJECT_ID || 'customer-project-id',
      business: process.env.VERCEL_BUSINESS_PROJECT_ID || 'business-project-id',
      admin: process.env.VERCEL_ADMIN_PROJECT_ID || 'admin-project-id'
    },
    rollbackOnFailure: environment === 'production',
    timeout: 600, // 10 minutes
    parallelDeployments: !appName && environment !== 'production' // Parallel for preview, sequential for production
  };

  console.log(`🚀 Starting Vercel deployment to ${environment}`);
  console.log(`Apps: ${config.apps.map(a => a.name).join(', ')}`);
  console.log(`Team ID: ${config.teamId || 'Personal'}`);

  const deployer = new VercelDeployer(config);
  
  const result = appName 
    ? { 
        success: true, 
        duration: 0, 
        apps: [await deployer.deploySingleApp(appName)], 
        errors: [], 
        summary: { total: 1, successful: 0, failed: 0 } 
      }
    : await deployer.deployAll();

  // Ensure logs directory exists
  const logsDir = path.join(process.cwd(), 'deployment', 'logs');
  if (!existsSync(logsDir)) {
    mkdirSync(logsDir, { recursive: true });
  }

  // Write deployment result to file
  const resultPath = path.join(logsDir, `vercel-${environment}-${Date.now()}.json`);
  writeFileSync(resultPath, JSON.stringify(result, null, 2));

  if (result.success) {
    console.log(`✅ Deployment successful! Duration: ${result.duration}ms`);
    console.log(`📊 Summary: ${result.summary.successful}/${result.summary.total} apps deployed`);
    console.log(`📄 Deployment log: ${resultPath}`);
    process.exit(0);
  } else {
    console.error(`❌ Deployment failed! Duration: ${result.duration}ms`);
    console.error(`📊 Summary: ${result.summary.successful}/${result.summary.total} apps deployed`);
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

export { VercelDeployer, VercelDeploymentConfig, VercelDeploymentResult };