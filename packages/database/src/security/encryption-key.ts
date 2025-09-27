/**
 * Encryption Key Database Model  
 * Task: T038 - EncryptionKey model in packages/database/src/security/encryption-key.ts
 * 
 * Manages AES-256 encryption keys for secure data storage and transmission.
 * Provides key generation, rotation, and secure key management operations.
 */

import { supabase } from '../client/supabase';
import { 
  EncryptionKey,
  KeyType,
  KeyStatus,
  EncryptionAlgorithm,
  CreateEncryptionKeyRequest,
  UpdateEncryptionKeyRequest,
  EncryptionKeyStatistics,
  KeyRotationResult,
  EncryptionResult,
  DecryptionResult
} from '../../types/security';
import { randomBytes, createHash, createCipheriv, createDecipheriv } from 'crypto';

export class EncryptionKeyModel {
  private static readonly KEY_LENGTH = 32; // 256 bits for AES-256
  private static readonly IV_LENGTH = 16; // 128 bits for initialization vector

  /**
   * Generate a new encryption key
   */
  static async create(data: CreateEncryptionKeyRequest): Promise<EncryptionKey> {
    try {
      // Generate cryptographically secure key
      const keyMaterial = randomBytes(this.KEY_LENGTH);
      const keyHash = createHash('sha256').update(keyMaterial).digest('hex');

      const newKey: Omit<EncryptionKey, 'id' | 'created_at' | 'updated_at'> = {
        key_name: data.key_name.trim(),
        key_type: data.key_type,
        algorithm: data.algorithm || 'AES-256-GCM',
        key_length: this.KEY_LENGTH * 8, // Convert to bits
        key_hash: keyHash,
        purpose: data.purpose?.trim() || 'general',
        environment: data.environment || 'production',
        status: 'active',
        rotation_interval_days: data.rotation_interval_days || 90,
        auto_rotate: data.auto_rotate ?? false,
        usage_count: 0,
        max_usage_count: data.max_usage_count || 1000000,
        metadata: data.metadata || {},
        expires_at: data.expires_at || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        last_rotated_at: null
      };

      const { data: key, error } = await supabase
        .from('encryption_keys')
        .insert(newKey)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create encryption key: ${error.message}`);
      }

      // Store encrypted key material securely (not in the response)
      await this.storeKeyMaterial(key.id, keyMaterial);

      return key;
    } catch (error) {
      throw new Error(`Encryption key creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get encryption key by ID
   */
  static async getById(keyId: string): Promise<EncryptionKey | null> {
    try {
      const { data, error } = await supabase
        .from('encryption_keys')
        .select('*')
        .eq('id', keyId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw new Error(`Failed to fetch encryption key: ${error.message}`);
      }

      return data || null;
    } catch (error) {
      throw new Error(`Encryption key retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get active encryption keys by type
   */
  static async getActiveByType(keyType: KeyType): Promise<EncryptionKey[]> {
    try {
      const { data, error } = await supabase
        .from('encryption_keys')
        .select('*')
        .eq('key_type', keyType)
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch active keys: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      throw new Error(`Active keys retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get primary encryption key for a purpose
   */
  static async getPrimaryKey(purpose: string = 'general'): Promise<EncryptionKey | null> {
    try {
      const { data, error } = await supabase
        .from('encryption_keys')
        .select('*')
        .eq('purpose', purpose)
        .eq('status', 'active')
        .eq('key_type', 'primary')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw new Error(`Failed to fetch primary key: ${error.message}`);
      }

      return data || null;
    } catch (error) {
      throw new Error(`Primary key retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get keys needing rotation
   */
  static async getKeysNeedingRotation(): Promise<EncryptionKey[]> {
    try {
      const rotationDate = new Date();
      rotationDate.setDate(rotationDate.getDate() - 90); // Default 90 days

      const { data, error } = await supabase
        .from('encryption_keys')
        .select('*')
        .eq('status', 'active')
        .eq('auto_rotate', true)
        .or(`last_rotated_at.is.null,last_rotated_at.lt.${rotationDate.toISOString()}`)
        .order('created_at', { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch keys needing rotation: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      throw new Error(`Rotation keys retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update encryption key
   */
  static async update(keyId: string, updates: UpdateEncryptionKeyRequest): Promise<EncryptionKey> {
    try {
      const updateData: Partial<EncryptionKey> = {
        ...updates,
        updated_at: new Date().toISOString()
      };

      // Clean undefined values
      Object.keys(updateData).forEach(key => {
        if (updateData[key as keyof typeof updateData] === undefined) {
          delete updateData[key as keyof typeof updateData];
        }
      });

      const { data, error } = await supabase
        .from('encryption_keys')
        .update(updateData)
        .eq('id', keyId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update encryption key: ${error.message}`);
      }

      return data;
    } catch (error) {
      throw new Error(`Encryption key update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Rotate encryption key
   */
  static async rotateKey(keyId: string): Promise<KeyRotationResult> {
    try {
      const existingKey = await this.getById(keyId);
      if (!existingKey) {
        throw new Error('Encryption key not found');
      }

      if (existingKey.status !== 'active') {
        throw new Error('Can only rotate active keys');
      }

      // Generate new key material
      const newKeyMaterial = randomBytes(this.KEY_LENGTH);
      const newKeyHash = createHash('sha256').update(newKeyMaterial).digest('hex');

      // Create new key version
      const newKey = await this.create({
        key_name: `${existingKey.key_name}_rotated_${Date.now()}`,
        key_type: existingKey.key_type,
        algorithm: existingKey.algorithm,
        purpose: existingKey.purpose,
        environment: existingKey.environment,
        rotation_interval_days: existingKey.rotation_interval_days,
        auto_rotate: existingKey.auto_rotate,
        max_usage_count: existingKey.max_usage_count,
        metadata: {
          ...existingKey.metadata,
          rotated_from: keyId,
          rotation_reason: 'scheduled_rotation'
        }
      });

      // Mark old key as rotated
      await this.update(keyId, {
        status: 'rotated',
        metadata: {
          ...existingKey.metadata,
          rotated_to: newKey.id,
          rotated_at: new Date().toISOString()
        }
      });

      // Update usage tracking
      await this.incrementUsage(newKey.id, 0); // Initialize usage tracking

      return {
        success: true,
        old_key_id: keyId,
        new_key_id: newKey.id,
        rotated_at: new Date().toISOString(),
        message: 'Key rotated successfully'
      };
    } catch (error) {
      return {
        success: false,
        old_key_id: keyId,
        new_key_id: null,
        rotated_at: new Date().toISOString(),
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Encrypt data using specified key
   */
  static async encrypt(keyId: string, plaintext: string): Promise<EncryptionResult> {
    try {
      const key = await this.getById(keyId);
      if (!key) {
        throw new Error('Encryption key not found');
      }

      if (key.status !== 'active') {
        throw new Error('Key is not active');
      }

      if (key.usage_count >= key.max_usage_count) {
        throw new Error('Key has exceeded maximum usage count');
      }

      // Get key material
      const keyMaterial = await this.getKeyMaterial(keyId);
      if (!keyMaterial) {
        throw new Error('Key material not accessible');
      }

      // Generate random IV
      const iv = randomBytes(this.IV_LENGTH);
      
      // Encrypt data
      const cipher = createCipheriv('aes-256-gcm', keyMaterial, iv);
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Get authentication tag
      const authTag = cipher.getAuthTag();

      // Increment usage count
      await this.incrementUsage(keyId);

      return {
        success: true,
        encrypted_data: encrypted,
        iv: iv.toString('hex'),
        auth_tag: authTag.toString('hex'),
        key_id: keyId,
        algorithm: key.algorithm,
        encrypted_at: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        encrypted_data: null,
        iv: null,
        auth_tag: null,
        key_id: keyId,
        algorithm: null,
        encrypted_at: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Decrypt data using specified key
   */
  static async decrypt(keyId: string, encryptedData: string, iv: string, authTag: string): Promise<DecryptionResult> {
    try {
      const key = await this.getById(keyId);
      if (!key) {
        throw new Error('Encryption key not found');
      }

      // Get key material
      const keyMaterial = await this.getKeyMaterial(keyId);
      if (!keyMaterial) {
        throw new Error('Key material not accessible');
      }

      // Decrypt data
      const decipher = createDecipheriv('aes-256-gcm', keyMaterial, Buffer.from(iv, 'hex'));
      decipher.setAuthTag(Buffer.from(authTag, 'hex'));
      
      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return {
        success: true,
        decrypted_data: decrypted,
        key_id: keyId,
        decrypted_at: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        decrypted_data: null,
        key_id: keyId,
        decrypted_at: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Increment usage count for a key
   */
  private static async incrementUsage(keyId: string, increment: number = 1): Promise<void> {
    try {
      const { error } = await supabase.rpc('increment_key_usage', {
        p_key_id: keyId,
        p_increment: increment
      });

      if (error) {
        throw new Error(`Failed to increment usage: ${error.message}`);
      }
    } catch (error) {
      // Log error but don't throw - usage tracking is not critical
      console.warn(`Usage increment failed for key ${keyId}: ${error}`);
    }
  }

  /**
   * Store key material securely (implementation depends on key management system)
   */
  private static async storeKeyMaterial(keyId: string, keyMaterial: Buffer): Promise<void> {
    try {
      // In production, this would integrate with a proper key management system
      // For now, we'll use Supabase's secure storage with encryption at rest
      const { error } = await supabase.rpc('store_key_material', {
        p_key_id: keyId,
        p_key_material: keyMaterial.toString('base64')
      });

      if (error) {
        throw new Error(`Failed to store key material: ${error.message}`);
      }
    } catch (error) {
      throw new Error(`Key material storage failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieve key material securely
   */
  private static async getKeyMaterial(keyId: string): Promise<Buffer | null> {
    try {
      const { data, error } = await supabase.rpc('get_key_material', {
        p_key_id: keyId
      });

      if (error) {
        throw new Error(`Failed to retrieve key material: ${error.message}`);
      }

      return data ? Buffer.from(data, 'base64') : null;
    } catch (error) {
      console.error(`Key material retrieval failed: ${error}`);
      return null;
    }
  }

  /**
   * Get encryption key statistics
   */
  static async getStatistics(): Promise<EncryptionKeyStatistics> {
    try {
      const [
        totalKeys,
        activeKeys,
        expiredKeys,
        keyTypes,
        recentUsage
      ] = await Promise.all([
        // Total keys
        supabase
          .from('encryption_keys')
          .select('id', { count: 'exact' }),
        
        // Active keys
        supabase
          .from('encryption_keys')
          .select('id', { count: 'exact' })
          .eq('status', 'active')
          .gt('expires_at', new Date().toISOString()),

        // Expired keys
        supabase
          .from('encryption_keys')
          .select('id', { count: 'exact' })
          .lt('expires_at', new Date().toISOString()),

        // Key types distribution
        supabase
          .from('encryption_keys')
          .select('key_type, algorithm')
          .eq('status', 'active'),

        // Recent usage (keys used in last 24 hours)
        supabase
          .from('encryption_keys')
          .select('usage_count')
          .eq('status', 'active')
          .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      ]);

      // Process key types
      const typeDistribution = (keyTypes.data || []).reduce((acc, key) => {
        const typeKey = `${key.key_type}_${key.algorithm}` as keyof typeof acc;
        acc[typeKey] = (acc[typeKey] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Calculate total usage
      const totalUsage = (recentUsage.data || []).reduce((sum, key) => sum + (key.usage_count || 0), 0);

      return {
        total_keys: totalKeys.count || 0,
        active_keys: activeKeys.count || 0,
        expired_keys: expiredKeys.count || 0,
        keys_needing_rotation: (await this.getKeysNeedingRotation()).length,
        key_type_distribution: typeDistribution,
        total_usage_count: totalUsage,
        recent_usage_24h: recentUsage.data?.length || 0,
        last_updated: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Statistics retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Deactivate encryption key
   */
  static async deactivate(keyId: string): Promise<void> {
    try {
      await this.update(keyId, {
        status: 'revoked',
        metadata: {
          deactivated_at: new Date().toISOString(),
          deactivation_reason: 'manual_deactivation'
        }
      });
    } catch (error) {
      throw new Error(`Key deactivation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete encryption key permanently
   */
  static async delete(keyId: string): Promise<void> {
    try {
      // First deactivate the key
      await this.deactivate(keyId);

      // Remove key material
      await supabase.rpc('delete_key_material', {
        p_key_id: keyId
      });

      // Delete the record
      const { error } = await supabase
        .from('encryption_keys')
        .delete()
        .eq('id', keyId);

      if (error) {
        throw new Error(`Failed to delete encryption key: ${error.message}`);
      }
    } catch (error) {
      throw new Error(`Encryption key deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}