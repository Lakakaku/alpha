import * as crypto from 'crypto';

export interface EnvironmentVariable {
  variable_id: string;
  environment_id: string;
  key_name: string;
  value_encrypted: string;
  is_secret: boolean;
  platform_synced: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateEnvironmentVariableRequest {
  environment_id: string;
  key_name: string;
  value: string;
  is_secret?: boolean;
  platform_synced?: boolean;
}

export interface UpdateEnvironmentVariableRequest {
  value?: string;
  is_secret?: boolean;
  platform_synced?: boolean;
}

export interface DecryptedEnvironmentVariable extends Omit<EnvironmentVariable, 'value_encrypted'> {
  value: string;
}

export class EnvironmentVariableModel {
  private static readonly ENCRYPTION_ALGORITHM = 'aes-256-gcm';
  private static readonly ENCRYPTION_KEY = process.env.ENV_VAR_ENCRYPTION_KEY || 'default-key-for-testing';

  static validateKeyName(keyName: string): boolean {
    // Environment variable names should follow standard conventions
    return /^[A-Z][A-Z0-9_]*$/.test(keyName);
  }

  static validateEnvironmentId(environmentId: string): boolean {
    return /^[a-zA-Z0-9\-_]+$/.test(environmentId) && environmentId.length >= 3;
  }

  private static encrypt(text: string): string {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher(this.ENCRYPTION_ALGORITHM, this.ENCRYPTION_KEY);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      throw new Error('Failed to encrypt environment variable value');
    }
  }

  private static decrypt(encryptedText: string): string {
    try {
      const parts = encryptedText.split(':');
      if (parts.length !== 2) {
        throw new Error('Invalid encrypted format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      
      const decipher = crypto.createDecipher(this.ENCRYPTION_ALGORITHM, this.ENCRYPTION_KEY);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error('Failed to decrypt environment variable value');
    }
  }

  static create(data: CreateEnvironmentVariableRequest): EnvironmentVariable {
    if (!this.validateKeyName(data.key_name)) {
      throw new Error('Invalid environment variable key name format');
    }

    if (!this.validateEnvironmentId(data.environment_id)) {
      throw new Error('Invalid environment ID format');
    }

    if (!data.value || data.value.trim().length === 0) {
      throw new Error('Environment variable value cannot be empty');
    }

    const variableId = crypto.randomUUID();
    const encryptedValue = this.encrypt(data.value);
    const now = new Date();

    return {
      variable_id: variableId,
      environment_id: data.environment_id,
      key_name: data.key_name,
      value_encrypted: encryptedValue,
      is_secret: data.is_secret ?? this.isSecretKey(data.key_name),
      platform_synced: data.platform_synced ?? false,
      created_at: now,
      updated_at: now
    };
  }

  static update(
    existing: EnvironmentVariable,
    updates: UpdateEnvironmentVariableRequest
  ): EnvironmentVariable {
    const updated: EnvironmentVariable = { ...existing };

    if (updates.value !== undefined) {
      if (!updates.value || updates.value.trim().length === 0) {
        throw new Error('Environment variable value cannot be empty');
      }
      updated.value_encrypted = this.encrypt(updates.value);
    }

    if (updates.is_secret !== undefined) {
      updated.is_secret = updates.is_secret;
    }

    if (updates.platform_synced !== undefined) {
      updated.platform_synced = updates.platform_synced;
    }

    updated.updated_at = new Date();
    return updated;
  }

  static decrypt(envVar: EnvironmentVariable): DecryptedEnvironmentVariable {
    const decryptedValue = this.decrypt(envVar.value_encrypted);
    
    const { value_encrypted, ...rest } = envVar;
    return {
      ...rest,
      value: decryptedValue
    };
  }

  static getMaskedValue(envVar: EnvironmentVariable): string {
    if (!envVar.is_secret) {
      return this.decrypt(envVar.value_encrypted);
    }

    const decryptedValue = this.decrypt(envVar.value_encrypted);
    
    if (decryptedValue.length <= 4) {
      return '***';
    }

    const visibleChars = Math.min(4, Math.floor(decryptedValue.length * 0.25));
    const maskedPortion = '*'.repeat(decryptedValue.length - visibleChars);
    
    return decryptedValue.substring(0, visibleChars) + maskedPortion;
  }

  static isSecretKey(keyName: string): boolean {
    const secretPatterns = [
      /.*_SECRET.*/,
      /.*_KEY.*/,
      /.*_TOKEN.*/,
      /.*_PASSWORD.*/,
      /.*_PRIVATE.*/,
      /^SECRET_.*/,
      /^PRIVATE_.*/,
      /^AUTH_.*/,
      /.*_CERT.*/,
      /.*_CREDENTIAL.*/
    ];

    return secretPatterns.some(pattern => pattern.test(keyName));
  }

  static validateForPlatform(envVar: EnvironmentVariable, platform: string): boolean {
    const platformRequirements = {
      railway: {
        required: ['DATABASE_URL', 'PORT'],
        optional: ['REDIS_URL', 'NODE_ENV']
      },
      vercel: {
        required: ['NEXT_PUBLIC_API_URL'],
        optional: ['VERCEL_URL', 'VERCEL_ENV']
      },
      supabase: {
        required: ['SUPABASE_URL', 'SUPABASE_ANON_KEY'],
        optional: ['SUPABASE_SERVICE_ROLE_KEY']
      }
    };

    const requirements = platformRequirements[platform as keyof typeof platformRequirements];
    if (!requirements) {
      return true; // Unknown platform, assume valid
    }

    // For now, just validate that the key name format is correct
    return this.validateKeyName(envVar.key_name);
  }

  static getRequiredVariablesForPlatform(platform: string): string[] {
    const platformRequirements = {
      railway: ['DATABASE_URL', 'PORT', 'NODE_ENV'],
      vercel: ['NEXT_PUBLIC_API_URL', 'VERCEL_ENV'],
      supabase: ['SUPABASE_URL', 'SUPABASE_ANON_KEY']
    };

    return platformRequirements[platform as keyof typeof platformRequirements] || [];
  }

  static groupByEnvironment(variables: EnvironmentVariable[]): Record<string, EnvironmentVariable[]> {
    return variables.reduce((groups, variable) => {
      const envId = variable.environment_id;
      if (!groups[envId]) {
        groups[envId] = [];
      }
      groups[envId].push(variable);
      return groups;
    }, {} as Record<string, EnvironmentVariable[]>);
  }

  static generateEnvFile(variables: EnvironmentVariable[]): string {
    const decryptedVars = variables.map(this.decrypt);
    
    return decryptedVars
      .map(variable => `${variable.key_name}="${variable.value}"`)
      .join('\n');
  }

  static parseEnvFile(content: string, environmentId: string): CreateEnvironmentVariableRequest[] {
    const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
    const variables: CreateEnvironmentVariableRequest[] = [];

    for (const line of lines) {
      const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (match) {
        const [, key, value] = match;
        let cleanValue = value;

        // Remove quotes if present
        if ((cleanValue.startsWith('"') && cleanValue.endsWith('"')) ||
            (cleanValue.startsWith("'") && cleanValue.endsWith("'"))) {
          cleanValue = cleanValue.slice(1, -1);
        }

        variables.push({
          environment_id: environmentId,
          key_name: key,
          value: cleanValue,
          is_secret: this.isSecretKey(key)
        });
      }
    }

    return variables;
  }
}