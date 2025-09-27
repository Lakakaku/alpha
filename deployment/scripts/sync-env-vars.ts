import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

interface EnvironmentVariable {
  key: string;
  value: string;
  encrypted?: boolean;
  source?: string;
  lastUpdated?: Date;
  environment?: string;
  service?: string;
}

interface SyncTarget {
  platform: 'railway' | 'vercel' | 'supabase' | 'local';
  service?: string;
  environment: 'production' | 'staging' | 'development';
  projectId?: string;
}

interface SyncOptions {
  source: SyncTarget;
  targets: SyncTarget[];
  variables?: string[]; // Specific variables to sync (if empty, sync all)
  dryRun?: boolean;
  encryptSecrets?: boolean;
  skipConfirmation?: boolean;
  backupBefore?: boolean;
  validateAfter?: boolean;
}

interface SyncResult {
  target: SyncTarget;
  success: boolean;
  added: string[];
  updated: string[];
  removed: string[];
  errors: string[];
  duration: number;
}

interface EnvVarMapping {
  [key: string]: {
    railway?: string;
    vercel?: string;
    supabase?: string;
    local?: string;
    required: boolean;
    secret: boolean;
    description?: string;
  };
}

export class EnvironmentSynchronizer {
  private configPath: string;
  private backupDir: string;
  private encryptionKey: string;
  private envVarMappings: EnvVarMapping;

  constructor() {
    this.configPath = path.join(process.cwd(), 'deployment', 'env-sync-config.json');
    this.backupDir = path.join(process.cwd(), 'deployment', 'env-backups');
    this.encryptionKey = process.env.ENV_ENCRYPTION_KEY || this.generateEncryptionKey();
    
    this.ensureDirectoriesExist();
    this.loadEnvVarMappings();
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

  private generateEncryptionKey(): string {
    const key = crypto.randomBytes(32).toString('hex');
    console.warn('⚠️ Generated new encryption key. Store this securely: ENV_ENCRYPTION_KEY=' + key);
    return key;
  }

  private loadEnvVarMappings(): void {
    // Define standard environment variable mappings for Vocilia
    this.envVarMappings = {
      'DATABASE_URL': {
        railway: 'DATABASE_URL',
        vercel: 'DATABASE_URL',
        supabase: 'DATABASE_URL',
        local: 'DATABASE_URL',
        required: true,
        secret: true,
        description: 'Supabase database connection string'
      },
      'NEXT_PUBLIC_SUPABASE_URL': {
        railway: 'NEXT_PUBLIC_SUPABASE_URL',
        vercel: 'NEXT_PUBLIC_SUPABASE_URL',
        local: 'NEXT_PUBLIC_SUPABASE_URL',
        required: true,
        secret: false,
        description: 'Supabase project URL'
      },
      'NEXT_PUBLIC_SUPABASE_ANON_KEY': {
        railway: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        vercel: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        local: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        required: true,
        secret: false,
        description: 'Supabase anonymous key'
      },
      'SUPABASE_SERVICE_ROLE_KEY': {
        railway: 'SUPABASE_SERVICE_ROLE_KEY',
        vercel: 'SUPABASE_SERVICE_ROLE_KEY',
        local: 'SUPABASE_SERVICE_ROLE_KEY',
        required: true,
        secret: true,
        description: 'Supabase service role key for backend operations'
      },
      'OPENAI_API_KEY': {
        railway: 'OPENAI_API_KEY',
        vercel: 'OPENAI_API_KEY',
        local: 'OPENAI_API_KEY',
        required: true,
        secret: true,
        description: 'OpenAI API key for AI assistant'
      },
      'JWT_SECRET': {
        railway: 'JWT_SECRET',
        local: 'JWT_SECRET',
        required: true,
        secret: true,
        description: 'JWT signing secret'
      },
      'SWISH_MERCHANT_ID': {
        railway: 'SWISH_MERCHANT_ID',
        local: 'SWISH_MERCHANT_ID',
        required: false,
        secret: true,
        description: 'Swish payment merchant ID'
      },
      'SWISH_API_KEY': {
        railway: 'SWISH_API_KEY',
        local: 'SWISH_API_KEY',
        required: false,
        secret: true,
        description: 'Swish payment API key'
      },
      'NODE_ENV': {
        railway: 'NODE_ENV',
        vercel: 'NODE_ENV',
        local: 'NODE_ENV',
        required: true,
        secret: false,
        description: 'Node.js environment'
      },
      'RAILWAY_ENVIRONMENT': {
        railway: 'RAILWAY_ENVIRONMENT',
        required: false,
        secret: false,
        description: 'Railway environment identifier'
      },
      'VERCEL_ENV': {
        vercel: 'VERCEL_ENV',
        required: false,
        secret: false,
        description: 'Vercel environment identifier'
      }
    };
  }

  async synchronizeEnvironmentVariables(options: SyncOptions): Promise<SyncResult[]> {
    console.log('🔄 Starting environment variable synchronization...');
    console.log(`Source: ${options.source.platform} (${options.source.environment})`);
    console.log(`Targets: ${options.targets.map(t => `${t.platform}:${t.environment}`).join(', ')}`);
    
    const results: SyncResult[] = [];

    try {
      // Create backup if requested
      if (options.backupBefore) {
        await this.createBackup(options.targets);
      }

      // Load source environment variables
      const sourceVars = await this.loadEnvironmentVariables(options.source);
      console.log(`📦 Loaded ${sourceVars.length} variables from source`);

      // Filter variables if specific ones are requested
      let varsToSync = sourceVars;
      if (options.variables && options.variables.length > 0) {
        varsToSync = sourceVars.filter(v => options.variables!.includes(v.key));
        console.log(`🔍 Filtering to ${varsToSync.length} specified variables`);
      }

      // Sync to each target
      for (const target of options.targets) {
        const result = await this.syncToTarget(varsToSync, target, options);
        results.push(result);
      }

      // Validate after sync if requested
      if (options.validateAfter) {
        await this.validateSynchronization(options.source, options.targets, varsToSync);
      }

      const allSuccessful = results.every(r => r.success);
      console.log(allSuccessful ? '✅ Environment sync completed successfully' : '❌ Environment sync completed with errors');

      return results;

    } catch (error) {
      const errorMessage = `Environment sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error('❌', errorMessage);
      
      const failedResult: SyncResult = {
        target: { platform: 'unknown' as any, environment: 'unknown' as any },
        success: false,
        added: [],
        updated: [],
        removed: [],
        errors: [errorMessage],
        duration: 0
      };
      
      return [failedResult];
    }
  }

  private async loadEnvironmentVariables(source: SyncTarget): Promise<EnvironmentVariable[]> {
    console.log(`📥 Loading environment variables from ${source.platform}...`);

    switch (source.platform) {
      case 'railway':
        return await this.loadRailwayVariables(source);
      case 'vercel':
        return await this.loadVercelVariables(source);
      case 'supabase':
        return await this.loadSupabaseVariables(source);
      case 'local':
        return await this.loadLocalVariables(source);
      default:
        throw new Error(`Unsupported source platform: ${source.platform}`);
    }
  }

  private async loadRailwayVariables(source: SyncTarget): Promise<EnvironmentVariable[]> {
    try {
      const envFlag = source.environment === 'production' ? '--environment production' : '--environment staging';
      const output = execSync(`railway variables ${envFlag}`, { encoding: 'utf8' });
      
      const variables: EnvironmentVariable[] = [];
      const lines = output.split('\n').filter(line => line.includes('='));
      
      for (const line of lines) {
        const [key, ...valueParts] = line.split('=');
        const value = valueParts.join('=');
        
        if (key && value) {
          variables.push({
            key: key.trim(),
            value: value.trim(),
            source: 'railway',
            environment: source.environment,
            service: source.service,
            lastUpdated: new Date()
          });
        }
      }
      
      return variables;
    } catch (error) {
      throw new Error(`Failed to load Railway variables: ${error}`);
    }
  }

  private async loadVercelVariables(source: SyncTarget): Promise<EnvironmentVariable[]> {
    try {
      const envFlag = source.environment === 'production' ? 'production' : 
                     source.environment === 'staging' ? 'preview' : 'development';
      
      const output = execSync(`vercel env ls ${envFlag}`, { encoding: 'utf8' });
      
      const variables: EnvironmentVariable[] = [];
      const lines = output.split('\n').slice(1); // Skip header
      
      for (const line of lines) {
        const match = line.match(/^(\S+)\s+(.+)\s+(production|preview|development)$/);
        if (match) {
          const [, key, value, env] = match;
          
          variables.push({
            key: key.trim(),
            value: value.trim(),
            source: 'vercel',
            environment: source.environment,
            service: source.service,
            lastUpdated: new Date()
          });
        }
      }
      
      return variables;
    } catch (error) {
      throw new Error(`Failed to load Vercel variables: ${error}`);
    }
  }

  private async loadSupabaseVariables(source: SyncTarget): Promise<EnvironmentVariable[]> {
    try {
      // Load from Supabase project settings or local config
      const variables: EnvironmentVariable[] = [];
      
      // This would typically load from Supabase API or CLI
      // For now, we'll load basic Supabase variables that are commonly needed
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      
      if (supabaseUrl) {
        variables.push({
          key: 'NEXT_PUBLIC_SUPABASE_URL',
          value: supabaseUrl,
          source: 'supabase',
          environment: source.environment,
          lastUpdated: new Date()
        });
      }
      
      if (supabaseAnonKey) {
        variables.push({
          key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
          value: supabaseAnonKey,
          source: 'supabase',
          environment: source.environment,
          lastUpdated: new Date()
        });
      }
      
      if (supabaseServiceKey) {
        variables.push({
          key: 'SUPABASE_SERVICE_ROLE_KEY',
          value: supabaseServiceKey,
          source: 'supabase',
          environment: source.environment,
          encrypted: true,
          lastUpdated: new Date()
        });
      }
      
      return variables;
    } catch (error) {
      throw new Error(`Failed to load Supabase variables: ${error}`);
    }
  }

  private async loadLocalVariables(source: SyncTarget): Promise<EnvironmentVariable[]> {
    try {
      const envFiles = ['.env', '.env.local', `.env.${source.environment}`];
      const variables: EnvironmentVariable[] = [];
      
      for (const envFile of envFiles) {
        const envPath = path.join(process.cwd(), envFile);
        
        if (fs.existsSync(envPath)) {
          const content = fs.readFileSync(envPath, 'utf8');
          const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
          
          for (const line of lines) {
            const [key, ...valueParts] = line.split('=');
            const value = valueParts.join('=');
            
            if (key && value) {
              variables.push({
                key: key.trim(),
                value: value.trim().replace(/^["']|["']$/g, ''), // Remove quotes
                source: 'local',
                environment: source.environment,
                lastUpdated: new Date()
              });
            }
          }
        }
      }
      
      return variables;
    } catch (error) {
      throw new Error(`Failed to load local variables: ${error}`);
    }
  }

  private async syncToTarget(variables: EnvironmentVariable[], target: SyncTarget, options: SyncOptions): Promise<SyncResult> {
    const startTime = Date.now();
    console.log(`🎯 Syncing to ${target.platform} (${target.environment})...`);

    const result: SyncResult = {
      target,
      success: false,
      added: [],
      updated: [],
      removed: [],
      errors: [],
      duration: 0
    };

    try {
      // Load existing variables from target
      const existingVars = await this.loadEnvironmentVariables(target);
      const existingKeys = new Set(existingVars.map(v => v.key));

      // Map variables based on platform-specific naming
      const mappedVars = this.mapVariablesForTarget(variables, target);

      if (options.dryRun) {
        console.log(`🔍 DRY RUN: Would sync ${mappedVars.length} variables to ${target.platform}`);
        this.logDryRunChanges(mappedVars, existingVars, result);
      } else {
        // Perform actual sync
        await this.performSync(mappedVars, target, existingKeys, result, options);
      }

      result.success = result.errors.length === 0;
      result.duration = Date.now() - startTime;

      console.log(`${result.success ? '✅' : '❌'} Sync to ${target.platform} completed (${result.duration}ms)`);
      if (result.added.length > 0) console.log(`  Added: ${result.added.join(', ')}`);
      if (result.updated.length > 0) console.log(`  Updated: ${result.updated.join(', ')}`);
      if (result.errors.length > 0) console.log(`  Errors: ${result.errors.length}`);

    } catch (error) {
      const errorMessage = `Sync to ${target.platform} failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error('❌', errorMessage);
      result.errors.push(errorMessage);
      result.duration = Date.now() - startTime;
    }

    return result;
  }

  private mapVariablesForTarget(variables: EnvironmentVariable[], target: SyncTarget): EnvironmentVariable[] {
    const mapped: EnvironmentVariable[] = [];

    for (const variable of variables) {
      const mapping = this.envVarMappings[variable.key];
      
      if (mapping) {
        const targetKey = mapping[target.platform];
        if (targetKey) {
          mapped.push({
            ...variable,
            key: targetKey,
            encrypted: mapping.secret
          });
        }
      } else {
        // No mapping found, use original key
        mapped.push(variable);
      }
    }

    return mapped;
  }

  private logDryRunChanges(mappedVars: EnvironmentVariable[], existingVars: EnvironmentVariable[], result: SyncResult): void {
    const existingMap = new Map(existingVars.map(v => [v.key, v.value]));

    for (const variable of mappedVars) {
      if (existingMap.has(variable.key)) {
        if (existingMap.get(variable.key) !== variable.value) {
          result.updated.push(variable.key);
          console.log(`  📝 Would update: ${variable.key}`);
        }
      } else {
        result.added.push(variable.key);
        console.log(`  ➕ Would add: ${variable.key}`);
      }
    }
  }

  private async performSync(mappedVars: EnvironmentVariable[], target: SyncTarget, existingKeys: Set<string>, result: SyncResult, options: SyncOptions): Promise<void> {
    switch (target.platform) {
      case 'railway':
        await this.syncToRailway(mappedVars, target, existingKeys, result);
        break;
      case 'vercel':
        await this.syncToVercel(mappedVars, target, existingKeys, result);
        break;
      case 'local':
        await this.syncToLocal(mappedVars, target, existingKeys, result);
        break;
      default:
        throw new Error(`Sync to ${target.platform} not implemented`);
    }
  }

  private async syncToRailway(variables: EnvironmentVariable[], target: SyncTarget, existingKeys: Set<string>, result: SyncResult): Promise<void> {
    const envFlag = target.environment === 'production' ? '--environment production' : '--environment staging';

    for (const variable of variables) {
      try {
        const action = existingKeys.has(variable.key) ? 'updated' : 'added';
        
        execSync(`railway variables set ${variable.key}="${variable.value}" ${envFlag}`, { stdio: 'pipe' });
        
        if (action === 'added') {
          result.added.push(variable.key);
        } else {
          result.updated.push(variable.key);
        }
        
        console.log(`  ✅ ${action} ${variable.key} in Railway`);
      } catch (error) {
        const errorMessage = `Failed to set ${variable.key} in Railway: ${error}`;
        result.errors.push(errorMessage);
        console.error(`  ❌ ${errorMessage}`);
      }
    }
  }

  private async syncToVercel(variables: EnvironmentVariable[], target: SyncTarget, existingKeys: Set<string>, result: SyncResult): Promise<void> {
    const envType = target.environment === 'production' ? 'production' : 
                   target.environment === 'staging' ? 'preview' : 'development';

    for (const variable of variables) {
      try {
        const action = existingKeys.has(variable.key) ? 'updated' : 'added';
        
        // Remove existing variable if updating
        if (action === 'updated') {
          try {
            execSync(`vercel env rm ${variable.key} ${envType}`, { stdio: 'pipe' });
          } catch (error) {
            // Variable might not exist, continue
          }
        }
        
        // Add the variable
        execSync(`vercel env add ${variable.key} ${envType}`, { 
          input: variable.value,
          stdio: 'pipe'
        });
        
        if (action === 'added') {
          result.added.push(variable.key);
        } else {
          result.updated.push(variable.key);
        }
        
        console.log(`  ✅ ${action} ${variable.key} in Vercel`);
      } catch (error) {
        const errorMessage = `Failed to set ${variable.key} in Vercel: ${error}`;
        result.errors.push(errorMessage);
        console.error(`  ❌ ${errorMessage}`);
      }
    }
  }

  private async syncToLocal(variables: EnvironmentVariable[], target: SyncTarget, existingKeys: Set<string>, result: SyncResult): Promise<void> {
    const envFile = target.environment === 'production' ? '.env.production' :
                   target.environment === 'staging' ? '.env.staging' : '.env.local';
    const envPath = path.join(process.cwd(), envFile);

    try {
      // Read existing content
      let existingContent = '';
      if (fs.existsSync(envPath)) {
        existingContent = fs.readFileSync(envPath, 'utf8');
      }

      const lines = existingContent.split('\n');
      const variableMap = new Map<string, string>();

      // Parse existing variables
      for (const line of lines) {
        if (line.trim() && !line.startsWith('#')) {
          const [key] = line.split('=');
          if (key) {
            variableMap.set(key.trim(), line);
          }
        }
      }

      // Update/add variables
      for (const variable of variables) {
        const action = variableMap.has(variable.key) ? 'updated' : 'added';
        const newLine = `${variable.key}=${variable.value}`;
        
        variableMap.set(variable.key, newLine);
        
        if (action === 'added') {
          result.added.push(variable.key);
        } else {
          result.updated.push(variable.key);
        }
        
        console.log(`  ✅ ${action} ${variable.key} in ${envFile}`);
      }

      // Write updated content
      const newContent = Array.from(variableMap.values()).join('\n') + '\n';
      fs.writeFileSync(envPath, newContent);

    } catch (error) {
      const errorMessage = `Failed to sync to local file: ${error}`;
      result.errors.push(errorMessage);
      console.error(`  ❌ ${errorMessage}`);
    }
  }

  private async createBackup(targets: SyncTarget[]): Promise<void> {
    console.log('💾 Creating environment variable backup...');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    for (const target of targets) {
      try {
        const variables = await this.loadEnvironmentVariables(target);
        const backupFile = path.join(
          this.backupDir, 
          `${target.platform}-${target.environment}-${timestamp}.json`
        );
        
        const backupData = {
          timestamp: new Date(),
          target,
          variables: variables.map(v => ({
            key: v.key,
            value: v.encrypted ? this.encrypt(v.value) : v.value,
            encrypted: v.encrypted
          }))
        };
        
        fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
        console.log(`  📁 Backup created: ${backupFile}`);
        
      } catch (error) {
        console.warn(`  ⚠️ Failed to backup ${target.platform}: ${error}`);
      }
    }
  }

  private async validateSynchronization(source: SyncTarget, targets: SyncTarget[], variables: EnvironmentVariable[]): Promise<void> {
    console.log('🔍 Validating synchronization...');
    
    for (const target of targets) {
      try {
        const targetVars = await this.loadEnvironmentVariables(target);
        const targetMap = new Map(targetVars.map(v => [v.key, v.value]));
        
        let missingCount = 0;
        let mismatchCount = 0;
        
        for (const variable of variables) {
          const mapping = this.envVarMappings[variable.key];
          const targetKey = mapping?.[target.platform] || variable.key;
          
          if (!targetMap.has(targetKey)) {
            missingCount++;
            console.warn(`  ⚠️ Missing variable: ${targetKey} in ${target.platform}`);
          } else if (targetMap.get(targetKey) !== variable.value) {
            mismatchCount++;
            console.warn(`  ⚠️ Value mismatch: ${targetKey} in ${target.platform}`);
          }
        }
        
        if (missingCount === 0 && mismatchCount === 0) {
          console.log(`  ✅ ${target.platform} validation passed`);
        } else {
          console.warn(`  ⚠️ ${target.platform} validation failed: ${missingCount} missing, ${mismatchCount} mismatched`);
        }
        
      } catch (error) {
        console.error(`  ❌ Validation failed for ${target.platform}: ${error}`);
      }
    }
  }

  private encrypt(value: string): string {
    const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  private decrypt(encryptedValue: string): string {
    const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
    let decrypted = decipher.update(encryptedValue, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  async listEnvironmentVariables(target: SyncTarget): Promise<EnvironmentVariable[]> {
    return await this.loadEnvironmentVariables(target);
  }

  async compareEnvironments(source: SyncTarget, target: SyncTarget): Promise<{
    onlyInSource: string[];
    onlyInTarget: string[];
    different: string[];
    same: string[];
  }> {
    const sourceVars = await this.loadEnvironmentVariables(source);
    const targetVars = await this.loadEnvironmentVariables(target);
    
    const sourceMap = new Map(sourceVars.map(v => [v.key, v.value]));
    const targetMap = new Map(targetVars.map(v => [v.key, v.value]));
    
    const sourceKeys = new Set(sourceMap.keys());
    const targetKeys = new Set(targetMap.keys());
    
    const onlyInSource = Array.from(sourceKeys).filter(k => !targetKeys.has(k));
    const onlyInTarget = Array.from(targetKeys).filter(k => !sourceKeys.has(k));
    const commonKeys = Array.from(sourceKeys).filter(k => targetKeys.has(k));
    
    const different = commonKeys.filter(k => sourceMap.get(k) !== targetMap.get(k));
    const same = commonKeys.filter(k => sourceMap.get(k) === targetMap.get(k));
    
    return { onlyInSource, onlyInTarget, different, same };
  }
}

// CLI usage example
if (require.main === module) {
  const synchronizer = new EnvironmentSynchronizer();
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'sync':
      const sourceEnv = args[1] || 'production';
      const targetEnv = args[2] || 'staging';
      
      const syncOptions: SyncOptions = {
        source: { platform: 'railway', environment: sourceEnv as any },
        targets: [
          { platform: 'vercel', environment: targetEnv as any },
          { platform: 'local', environment: targetEnv as any }
        ],
        dryRun: args.includes('--dry-run'),
        backupBefore: true,
        validateAfter: true,
        skipConfirmation: args.includes('--yes')
      };

      synchronizer.synchronizeEnvironmentVariables(syncOptions)
        .then(results => {
          console.log('\n📊 Sync Results:');
          results.forEach(result => {
            console.log(`- ${result.target.platform}: ${result.success ? '✅' : '❌'} (${result.duration}ms)`);
            console.log(`  Added: ${result.added.length}, Updated: ${result.updated.length}, Errors: ${result.errors.length}`);
          });
          
          const allSuccessful = results.every(r => r.success);
          process.exit(allSuccessful ? 0 : 1);
        })
        .catch(error => {
          console.error('💥 Sync failed:', error);
          process.exit(1);
        });
      break;

    case 'compare':
      const sourceTarget: SyncTarget = { platform: args[1] as any, environment: args[2] as any };
      const targetTarget: SyncTarget = { platform: args[3] as any, environment: args[4] as any };
      
      synchronizer.compareEnvironments(sourceTarget, targetTarget)
        .then(comparison => {
          console.log('\n🔍 Environment Comparison:');
          console.log(`Only in ${sourceTarget.platform}: ${comparison.onlyInSource.join(', ') || 'none'}`);
          console.log(`Only in ${targetTarget.platform}: ${comparison.onlyInTarget.join(', ') || 'none'}`);
          console.log(`Different values: ${comparison.different.join(', ') || 'none'}`);
          console.log(`Same: ${comparison.same.length} variables`);
        })
        .catch(error => {
          console.error('💥 Comparison failed:', error);
          process.exit(1);
        });
      break;

    case 'list':
      const listTarget: SyncTarget = { platform: args[1] as any, environment: args[2] as any };
      
      synchronizer.listEnvironmentVariables(listTarget)
        .then(variables => {
          console.log(`\n📋 Environment Variables (${listTarget.platform}:${listTarget.environment}):`);
          variables.forEach(variable => {
            const value = variable.encrypted ? '[ENCRYPTED]' : variable.value.substring(0, 20) + '...';
            console.log(`${variable.key}=${value}`);
          });
        })
        .catch(error => {
          console.error('💥 List failed:', error);
          process.exit(1);
        });
      break;

    default:
      console.log(`
🔄 Vocilia Environment Variable Synchronizer

Usage:
  npm run sync-env sync [source-env] [target-env] [--dry-run] [--yes]
  npm run sync-env compare [source-platform] [source-env] [target-platform] [target-env]
  npm run sync-env list [platform] [environment]

Examples:
  npm run sync-env sync production staging --dry-run
  npm run sync-env sync production staging --yes
  npm run sync-env compare railway production vercel production
  npm run sync-env list railway production

Platforms: railway, vercel, supabase, local
Environments: production, staging, development
      `);
      break;
  }
}