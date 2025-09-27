import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface DeploymentRecord {
  id: string;
  platform: 'railway' | 'vercel';
  service: string;
  version: string;
  timestamp: Date;
  status: 'success' | 'failed' | 'rolling_back' | 'rolled_back';
  commitHash: string;
  environment: 'production' | 'staging';
  healthCheckUrl?: string;
  rollbackData?: any;
}

interface RollbackOptions {
  platform: 'railway' | 'vercel' | 'all';
  service?: string;
  targetVersion?: string;
  targetCommit?: string;
  environment: 'production' | 'staging';
  skipHealthCheck?: boolean;
  maxRetries?: number;
  notificationWebhook?: string;
}

interface RollbackResult {
  success: boolean;
  deploymentId: string;
  previousVersion: string;
  rolledBackTo: string;
  duration: number;
  healthStatus: 'healthy' | 'unhealthy' | 'unknown';
  errors: string[];
}

export class RollbackManager {
  private deploymentHistoryPath: string;
  private configPath: string;
  private maxRetries: number;

  constructor() {
    this.deploymentHistoryPath = path.join(process.cwd(), 'deployment', 'history.json');
    this.configPath = path.join(process.cwd(), 'deployment', 'rollback-config.json');
    this.maxRetries = 3;
    
    this.ensureDirectoryExists();
  }

  private ensureDirectoryExists(): void {
    const deploymentDir = path.dirname(this.deploymentHistoryPath);
    if (!fs.existsSync(deploymentDir)) {
      fs.mkdirSync(deploymentDir, { recursive: true });
    }

    // Initialize history file if it doesn't exist
    if (!fs.existsSync(this.deploymentHistoryPath)) {
      fs.writeFileSync(this.deploymentHistoryPath, JSON.stringify([], null, 2));
    }
  }

  async performRollback(options: RollbackOptions): Promise<RollbackResult[]> {
    console.log('🔄 Starting deployment rollback...');
    console.log(`Platform: ${options.platform}, Environment: ${options.environment}`);
    
    const startTime = Date.now();
    const results: RollbackResult[] = [];

    try {
      // Load deployment history
      const deploymentHistory = this.loadDeploymentHistory();
      
      // Find target deployments for rollback
      const targetDeployments = this.findRollbackTargets(deploymentHistory, options);
      
      if (targetDeployments.length === 0) {
        throw new Error('No suitable deployment found for rollback');
      }

      // Perform rollbacks
      for (const deployment of targetDeployments) {
        const result = await this.rollbackSingleDeployment(deployment, options);
        results.push(result);
      }

      // Send notifications
      if (options.notificationWebhook) {
        await this.sendRollbackNotification(options.notificationWebhook, results);
      }

      const allSuccessful = results.every(r => r.success);
      console.log(allSuccessful ? '✅ Rollback completed successfully' : '❌ Rollback completed with errors');

      return results;

    } catch (error) {
      const errorMessage = `Rollback failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error('❌', errorMessage);
      
      const failedResult: RollbackResult = {
        success: false,
        deploymentId: 'unknown',
        previousVersion: 'unknown',
        rolledBackTo: 'unknown',
        duration: Date.now() - startTime,
        healthStatus: 'unknown',
        errors: [errorMessage]
      };
      
      return [failedResult];
    }
  }

  private loadDeploymentHistory(): DeploymentRecord[] {
    try {
      const historyData = fs.readFileSync(this.deploymentHistoryPath, 'utf8');
      return JSON.parse(historyData).map((record: any) => ({
        ...record,
        timestamp: new Date(record.timestamp)
      }));
    } catch (error) {
      console.warn('⚠️ Could not load deployment history, starting fresh');
      return [];
    }
  }

  private saveDeploymentHistory(history: DeploymentRecord[]): void {
    fs.writeFileSync(this.deploymentHistoryPath, JSON.stringify(history, null, 2));
  }

  private findRollbackTargets(history: DeploymentRecord[], options: RollbackOptions): DeploymentRecord[] {
    let filtered = history.filter(record => 
      record.environment === options.environment &&
      record.status === 'success'
    );

    // Filter by platform
    if (options.platform !== 'all') {
      filtered = filtered.filter(record => record.platform === options.platform);
    }

    // Filter by service if specified
    if (options.service) {
      filtered = filtered.filter(record => record.service === options.service);
    }

    // Find target deployment
    if (options.targetVersion) {
      filtered = filtered.filter(record => record.version === options.targetVersion);
    } else if (options.targetCommit) {
      filtered = filtered.filter(record => record.commitHash === options.targetCommit);
    } else {
      // Default: find previous successful deployment for each service
      const services = [...new Set(filtered.map(r => r.service))];
      const targets: DeploymentRecord[] = [];
      
      for (const service of services) {
        const serviceRecords = filtered
          .filter(r => r.service === service)
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        
        // Skip the most recent (current) deployment and get the previous one
        if (serviceRecords.length >= 2) {
          targets.push(serviceRecords[1]); // Previous deployment
        }
      }
      
      return targets;
    }

    return filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  private async rollbackSingleDeployment(deployment: DeploymentRecord, options: RollbackOptions): Promise<RollbackResult> {
    const startTime = Date.now();
    console.log(`🔄 Rolling back ${deployment.service} to version ${deployment.version}...`);

    const result: RollbackResult = {
      success: false,
      deploymentId: deployment.id,
      previousVersion: 'unknown',
      rolledBackTo: deployment.version,
      duration: 0,
      healthStatus: 'unknown',
      errors: []
    };

    try {
      // Update deployment status
      const history = this.loadDeploymentHistory();
      const deploymentIndex = history.findIndex(r => r.id === deployment.id);
      if (deploymentIndex >= 0) {
        history[deploymentIndex].status = 'rolling_back';
        this.saveDeploymentHistory(history);
      }

      // Perform platform-specific rollback
      if (deployment.platform === 'railway') {
        await this.rollbackRailwayDeployment(deployment, result);
      } else if (deployment.platform === 'vercel') {
        await this.rollbackVercelDeployment(deployment, result);
      } else {
        throw new Error(`Unsupported platform: ${deployment.platform}`);
      }

      // Health check after rollback
      if (!options.skipHealthCheck && deployment.healthCheckUrl) {
        result.healthStatus = await this.performHealthCheck(deployment.healthCheckUrl);
        
        if (result.healthStatus !== 'healthy') {
          throw new Error(`Health check failed after rollback: ${result.healthStatus}`);
        }
      }

      // Update deployment status to rolled back
      if (deploymentIndex >= 0) {
        history[deploymentIndex].status = 'rolled_back';
        this.saveDeploymentHistory(history);
      }

      result.success = true;
      result.duration = Date.now() - startTime;
      console.log(`✅ Rollback successful for ${deployment.service} (${result.duration}ms)`);

    } catch (error) {
      const errorMessage = `Rollback failed for ${deployment.service}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error('❌', errorMessage);
      result.errors.push(errorMessage);
      result.duration = Date.now() - startTime;
    }

    return result;
  }

  private async rollbackRailwayDeployment(deployment: DeploymentRecord, result: RollbackResult): Promise<void> {
    try {
      console.log(`🚂 Rolling back Railway service ${deployment.service}...`);

      // Check if Railway CLI is available
      try {
        execSync('railway --version', { stdio: 'pipe' });
      } catch {
        throw new Error('Railway CLI not found. Please install railway CLI.');
      }

      // Set environment
      const envFlag = deployment.environment === 'production' ? '--environment production' : '--environment staging';
      
      // Get current deployment for comparison
      try {
        const currentStatus = execSync(`railway status ${envFlag}`, { encoding: 'utf8' });
        const currentVersionMatch = currentStatus.match(/Deployment ID: (.+)/);
        if (currentVersionMatch) {
          result.previousVersion = currentVersionMatch[1].trim();
        }
      } catch (error) {
        console.warn('⚠️ Could not determine current Railway deployment version');
      }

      // Perform rollback using deployment ID
      if (deployment.rollbackData?.deploymentId) {
        console.log(`🔄 Rolling back to deployment ${deployment.rollbackData.deploymentId}...`);
        execSync(`railway rollback ${deployment.rollbackData.deploymentId} ${envFlag}`, { stdio: 'inherit' });
      } else if (deployment.commitHash) {
        // Alternative: redeploy from specific commit
        console.log(`🔄 Redeploying from commit ${deployment.commitHash}...`);
        execSync(`railway up --detach ${envFlag}`, { 
          stdio: 'inherit',
          env: { ...process.env, RAILWAY_GIT_COMMIT_SHA: deployment.commitHash }
        });
      } else {
        throw new Error('No rollback data available for Railway deployment');
      }

      // Wait for deployment to complete
      await this.waitForRailwayDeployment(deployment.environment);

      console.log('✅ Railway rollback completed');

    } catch (error) {
      throw new Error(`Railway rollback failed: ${error}`);
    }
  }

  private async rollbackVercelDeployment(deployment: DeploymentRecord, result: RollbackResult): Promise<void> {
    try {
      console.log(`▲ Rolling back Vercel service ${deployment.service}...`);

      // Check if Vercel CLI is available
      try {
        execSync('vercel --version', { stdio: 'pipe' });
      } catch {
        throw new Error('Vercel CLI not found. Please install vercel CLI.');
      }

      // Get current deployment for comparison
      try {
        const currentStatus = execSync('vercel ls --scope vocilia', { encoding: 'utf8' });
        const lines = currentStatus.split('\n').filter(line => line.includes(deployment.service));
        if (lines.length > 0) {
          const urlMatch = lines[0].match(/https:\/\/[^\s]+/);
          if (urlMatch) {
            result.previousVersion = urlMatch[0];
          }
        }
      } catch (error) {
        console.warn('⚠️ Could not determine current Vercel deployment');
      }

      // Perform rollback using deployment URL or ID
      if (deployment.rollbackData?.deploymentUrl) {
        console.log(`🔄 Promoting deployment ${deployment.rollbackData.deploymentUrl}...`);
        
        // Promote the previous deployment to production
        const prodFlag = deployment.environment === 'production' ? '--prod' : '';
        execSync(`vercel promote ${deployment.rollbackData.deploymentUrl} ${prodFlag}`, { stdio: 'inherit' });
        
      } else if (deployment.commitHash) {
        // Alternative: redeploy from specific commit
        console.log(`🔄 Redeploying from commit ${deployment.commitHash}...`);
        
        // Checkout specific commit and redeploy
        const appPath = path.join(process.cwd(), 'apps', deployment.service);
        const originalCwd = process.cwd();
        
        try {
          process.chdir(appPath);
          
          // Save current state
          const currentBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
          
          // Checkout target commit
          execSync(`git checkout ${deployment.commitHash}`, { stdio: 'inherit' });
          
          // Deploy
          const prodFlag = deployment.environment === 'production' ? '--prod' : '';
          execSync(`vercel ${prodFlag} --yes`, { stdio: 'inherit' });
          
          // Return to original branch
          execSync(`git checkout ${currentBranch}`, { stdio: 'inherit' });
          
        } finally {
          process.chdir(originalCwd);
        }
      } else {
        throw new Error('No rollback data available for Vercel deployment');
      }

      console.log('✅ Vercel rollback completed');

    } catch (error) {
      throw new Error(`Vercel rollback failed: ${error}`);
    }
  }

  private async waitForRailwayDeployment(environment: string, maxWaitTime = 300000): Promise<void> {
    const envFlag = environment === 'production' ? '--environment production' : '--environment staging';
    const startTime = Date.now();
    
    console.log('⏳ Waiting for Railway deployment to complete...');
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        const status = execSync(`railway status ${envFlag}`, { encoding: 'utf8' });
        
        if (status.includes('SUCCESS') || status.includes('ACTIVE')) {
          console.log('✅ Railway deployment completed');
          return;
        }
        
        if (status.includes('FAILED') || status.includes('ERROR')) {
          throw new Error('Railway deployment failed');
        }
        
        // Wait 10 seconds before checking again
        await new Promise(resolve => setTimeout(resolve, 10000));
        
      } catch (error) {
        console.warn('⚠️ Could not check Railway deployment status:', error);
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }
    
    throw new Error('Railway deployment timeout');
  }

  private async performHealthCheck(url: string, maxRetries = 3): Promise<'healthy' | 'unhealthy' | 'unknown'> {
    console.log(`🏥 Performing health check: ${url}`);
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, { 
          method: 'GET',
          timeout: 10000
        });
        
        if (response.ok) {
          console.log('✅ Health check passed');
          return 'healthy';
        } else {
          console.warn(`⚠️ Health check failed with status ${response.status}`);
        }
      } catch (error) {
        console.warn(`⚠️ Health check attempt ${attempt} failed:`, error);
      }
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      }
    }
    
    console.error('❌ All health check attempts failed');
    return 'unhealthy';
  }

  async recordDeployment(deployment: Omit<DeploymentRecord, 'timestamp'>): Promise<void> {
    const history = this.loadDeploymentHistory();
    
    const newRecord: DeploymentRecord = {
      ...deployment,
      timestamp: new Date()
    };
    
    history.push(newRecord);
    
    // Keep only last 50 deployments per service
    const serviceRecords = history.filter(r => r.service === deployment.service);
    if (serviceRecords.length > 50) {
      const toRemove = serviceRecords
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
        .slice(0, serviceRecords.length - 50);
      
      const filteredHistory = history.filter(r => 
        r.service !== deployment.service || !toRemove.some(tr => tr.id === r.id)
      );
      
      this.saveDeploymentHistory(filteredHistory);
    } else {
      this.saveDeploymentHistory(history);
    }
    
    console.log(`📝 Recorded deployment: ${deployment.service} v${deployment.version}`);
  }

  async getDeploymentHistory(filters?: {
    service?: string;
    platform?: 'railway' | 'vercel';
    environment?: 'production' | 'staging';
    limit?: number;
  }): Promise<DeploymentRecord[]> {
    let history = this.loadDeploymentHistory();
    
    if (filters?.service) {
      history = history.filter(r => r.service === filters.service);
    }
    
    if (filters?.platform) {
      history = history.filter(r => r.platform === filters.platform);
    }
    
    if (filters?.environment) {
      history = history.filter(r => r.environment === filters.environment);
    }
    
    history.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    if (filters?.limit) {
      history = history.slice(0, filters.limit);
    }
    
    return history;
  }

  private async sendRollbackNotification(webhookUrl: string, results: RollbackResult[]): Promise<void> {
    try {
      const successCount = results.filter(r => r.success).length;
      const totalCount = results.length;
      const status = successCount === totalCount ? 'success' : 'partial_failure';
      
      const notification = {
        event: 'rollback_completed',
        status,
        timestamp: new Date().toISOString(),
        summary: {
          total: totalCount,
          successful: successCount,
          failed: totalCount - successCount
        },
        results: results.map(r => ({
          service: r.deploymentId,
          success: r.success,
          duration: r.duration,
          healthStatus: r.healthStatus,
          errors: r.errors
        }))
      };

      await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(notification)
      });

      console.log('📡 Rollback notification sent');

    } catch (error) {
      console.warn('⚠️ Failed to send rollback notification:', error);
    }
  }

  async listAvailableRollbacks(service?: string, environment: 'production' | 'staging' = 'production'): Promise<DeploymentRecord[]> {
    const history = this.loadDeploymentHistory();
    
    let available = history.filter(record => 
      record.environment === environment &&
      record.status === 'success'
    );

    if (service) {
      available = available.filter(record => record.service === service);
    }

    return available
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10); // Last 10 successful deployments
  }
}

// CLI usage example
if (require.main === module) {
  const rollbackManager = new RollbackManager();
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'rollback':
      const rollbackOptions: RollbackOptions = {
        platform: (args[1] as any) || 'all',
        service: args[2],
        environment: (args[3] as any) || 'production',
        skipHealthCheck: args.includes('--skip-health-check'),
        notificationWebhook: process.env.ROLLBACK_WEBHOOK_URL
      };

      rollbackManager.performRollback(rollbackOptions)
        .then(results => {
          console.log('\n📊 Rollback Results:');
          results.forEach(result => {
            console.log(`- ${result.deploymentId}: ${result.success ? '✅' : '❌'} (${result.duration}ms)`);
            if (result.errors.length > 0) {
              result.errors.forEach(error => console.log(`  Error: ${error}`));
            }
          });
          
          const allSuccessful = results.every(r => r.success);
          process.exit(allSuccessful ? 0 : 1);
        })
        .catch(error => {
          console.error('💥 Rollback failed:', error);
          process.exit(1);
        });
      break;

    case 'history':
      const service = args[1];
      const environment = (args[2] as any) || 'production';
      
      rollbackManager.getDeploymentHistory({ 
        service, 
        environment, 
        limit: 20 
      })
        .then(history => {
          console.log('\n📚 Deployment History:');
          history.forEach(record => {
            console.log(`${record.timestamp.toISOString()} - ${record.service} v${record.version} (${record.status})`);
            console.log(`  Platform: ${record.platform}, Commit: ${record.commitHash}`);
          });
        })
        .catch(error => {
          console.error('💥 Failed to get history:', error);
          process.exit(1);
        });
      break;

    case 'list':
      const listService = args[1];
      const listEnvironment = (args[2] as any) || 'production';
      
      rollbackManager.listAvailableRollbacks(listService, listEnvironment)
        .then(available => {
          console.log('\n🔄 Available Rollback Targets:');
          available.forEach((record, index) => {
            console.log(`${index + 1}. ${record.service} v${record.version} (${record.timestamp.toLocaleDateString()})`);
            console.log(`   Platform: ${record.platform}, Commit: ${record.commitHash}`);
          });
        })
        .catch(error => {
          console.error('💥 Failed to list rollbacks:', error);
          process.exit(1);
        });
      break;

    default:
      console.log(`
🔄 Vocilia Rollback Manager

Usage:
  npm run rollback rollback [platform] [service] [environment] [--skip-health-check]
  npm run rollback history [service] [environment]  
  npm run rollback list [service] [environment]

Examples:
  npm run rollback rollback all production
  npm run rollback rollback railway backend staging
  npm run rollback rollback vercel customer production --skip-health-check
  npm run rollback history backend production
  npm run rollback list customer staging

Platforms: railway, vercel, all
Environments: production, staging
      `);
      break;
  }
}