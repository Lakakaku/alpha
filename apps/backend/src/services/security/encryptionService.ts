/**
 * Data Encryption Service
 * Task: T047 - Data encryption service
 * 
 * Provides comprehensive data encryption and decryption capabilities using AES-256-GCM.
 * Manages encryption keys, supports field-level encryption, and ensures data protection at rest.
 */

import { EncryptionKey } from '@vocilia/database';
import { EncryptionKeyEntry, KeyStatus, EncryptionMethod } from '@vocilia/types';
import { AuditLoggingService } from './auditLoggingService';
import { randomBytes, createCipherGCM, createDecipherGCM, pbkdf2Sync, timingSafeEqual } from 'crypto';
import { randomUUID } from 'crypto';

export interface EncryptionOptions {
  keyId?: string;
  algorithm?: EncryptionMethod;
  additionalData?: Buffer;
}

export interface EncryptionResult {
  encryptedData: Buffer;
  keyId: string;
  algorithm: EncryptionMethod;
  iv: Buffer;
  authTag: Buffer;
  metadata?: Record<string, any>;
}

export interface DecryptionRequest {
  encryptedData: Buffer;
  keyId: string;
  algorithm: EncryptionMethod;
  iv: Buffer;
  authTag: Buffer;
  additionalData?: Buffer;
}

export interface KeyRotationResult {
  oldKeyId: string;
  newKeyId: string;
  rotatedRecords: number;
  failedRecords: number;
}

export interface FieldEncryptionConfig {
  tableName: string;
  fieldName: string;
  keyId: string;
  encryptionMethod: EncryptionMethod;
  searchable?: boolean; // If true, creates searchable hash
}

export interface BulkEncryptionRequest {
  data: Array<{
    id: string;
    value: string;
  }>;
  keyId?: string;
  algorithm?: EncryptionMethod;
}

export interface BulkEncryptionResult {
  results: Array<{
    id: string;
    encryptedValue: string;
    success: boolean;
    error?: string;
  }>;
  successCount: number;
  failureCount: number;
}

export class EncryptionService {
  private static instance: EncryptionService;
  private auditService: AuditLoggingService;
  private keyCache = new Map<string, EncryptionKeyEntry>();
  private readonly KEY_CACHE_TTL = 30 * 60 * 1000; // 30 minutes
  private keysCacheLastUpdated = 0;

  // Encryption constants
  private readonly DEFAULT_ALGORITHM: EncryptionMethod = 'aes-256-gcm';
  private readonly KEY_LENGTH = 32; // 256 bits
  private readonly IV_LENGTH = 16; // 128 bits
  private readonly SALT_LENGTH = 32; // 256 bits
  private readonly TAG_LENGTH = 16; // 128 bits
  private readonly PBKDF2_ITERATIONS = 100000; // OWASP recommended minimum

  private constructor() {
    this.auditService = AuditLoggingService.getInstance();
  }

  static getInstance(): EncryptionService {
    if (!EncryptionService.instance) {
      EncryptionService.instance = new EncryptionService();
    }
    return EncryptionService.instance;
  }

  /**
   * Generate a new encryption key
   */
  async generateKey(purpose: string, description?: string): Promise<string> {
    try {
      const keyId = randomUUID();
      const keyMaterial = randomBytes(this.KEY_LENGTH);
      const salt = randomBytes(this.SALT_LENGTH);
      
      // Derive key using PBKDF2
      const derivedKey = pbkdf2Sync(keyMaterial, salt, this.PBKDF2_ITERATIONS, this.KEY_LENGTH, 'sha256');
      
      const keyEntry: EncryptionKeyEntry = {
        id: keyId,
        purpose,
        algorithm: this.DEFAULT_ALGORITHM,
        key_material: derivedKey.toString('base64'),
        salt: salt.toString('base64'),
        status: 'active',
        description: description || `Auto-generated key for ${purpose}`,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
        metadata: {
          iterations: this.PBKDF2_ITERATIONS,
          key_length: this.KEY_LENGTH,
          generation_timestamp: Date.now()
        }
      };

      await EncryptionKey.create(keyEntry);
      
      // Clear cache to force reload
      this.clearKeyCache();

      await this.auditService.logEvent({
        eventType: 'system_event',
        userId: 'system',
        userType: 'system',
        actionPerformed: 'encryption_key_generated',
        resourceType: 'encryption_key',
        resourceId: keyId,
        resultStatus: 'success',
        eventMetadata: {
          purpose,
          algorithm: this.DEFAULT_ALGORITHM,
          key_length: this.KEY_LENGTH
        }
      });

      return keyId;
    } catch (error) {
      await this.auditService.logEvent({
        eventType: 'system_event',
        userId: 'system',
        userType: 'system',
        actionPerformed: 'encryption_key_generation_failed',
        resourceType: 'encryption_key',
        resourceId: 'unknown',
        resultStatus: 'failure',
        eventMetadata: {
          purpose,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
      throw error;
    }
  }

  /**
   * Encrypt data using specified or default key
   */
  async encrypt(data: string | Buffer, options: EncryptionOptions = {}): Promise<EncryptionResult> {
    try {
      const algorithm = options.algorithm || this.DEFAULT_ALGORITHM;
      const keyId = options.keyId || await this.getDefaultKeyId();
      
      const key = await this.getKey(keyId);
      if (!key || key.status !== 'active') {
        throw new Error(`Key ${keyId} not found or inactive`);
      }

      const keyMaterial = Buffer.from(key.key_material, 'base64');
      const iv = randomBytes(this.IV_LENGTH);
      
      const cipher = createCipherGCM(algorithm, keyMaterial, iv);
      
      // Add additional authenticated data if provided
      if (options.additionalData) {
        cipher.setAAD(options.additionalData);
      }

      const input = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
      const encrypted = Buffer.concat([cipher.update(input), cipher.final()]);
      const authTag = cipher.getAuthTag();

      const result: EncryptionResult = {
        encryptedData: encrypted,
        keyId,
        algorithm,
        iv,
        authTag,
        metadata: {
          original_size: input.length,
          encrypted_size: encrypted.length,
          timestamp: Date.now()
        }
      };

      await this.auditService.logEvent({
        eventType: 'data_modification',
        userId: 'system',
        userType: 'system',
        actionPerformed: 'data_encrypted',
        resourceType: 'encrypted_data',
        resourceId: keyId,
        resultStatus: 'success',
        eventMetadata: {
          algorithm,
          data_size: input.length,
          key_id: keyId
        }
      });

      return result;
    } catch (error) {
      await this.auditService.logEvent({
        eventType: 'data_modification',
        userId: 'system',
        userType: 'system',
        actionPerformed: 'data_encryption_failed',
        resourceType: 'encrypted_data',
        resourceId: options.keyId || 'unknown',
        resultStatus: 'failure',
        eventMetadata: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
      throw error;
    }
  }

  /**
   * Decrypt data using the specified key
   */
  async decrypt(request: DecryptionRequest): Promise<Buffer> {
    try {
      const key = await this.getKey(request.keyId);
      if (!key) {
        throw new Error(`Key ${request.keyId} not found`);
      }

      const keyMaterial = Buffer.from(key.key_material, 'base64');
      
      const decipher = createDecipherGCM(request.algorithm, keyMaterial, request.iv);
      decipher.setAuthTag(request.authTag);
      
      // Add additional authenticated data if provided
      if (request.additionalData) {
        decipher.setAAD(request.additionalData);
      }

      const decrypted = Buffer.concat([
        decipher.update(request.encryptedData),
        decipher.final()
      ]);

      await this.auditService.logEvent({
        eventType: 'data_access',
        userId: 'system',
        userType: 'system',
        actionPerformed: 'data_decrypted',
        resourceType: 'encrypted_data',
        resourceId: request.keyId,
        resultStatus: 'success',
        eventMetadata: {
          algorithm: request.algorithm,
          data_size: decrypted.length,
          key_id: request.keyId
        }
      });

      return decrypted;
    } catch (error) {
      await this.auditService.logEvent({
        eventType: 'data_access',
        userId: 'system',
        userType: 'system',
        actionPerformed: 'data_decryption_failed',
        resourceType: 'encrypted_data',
        resourceId: request.keyId,
        resultStatus: 'failure',
        eventMetadata: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
      throw error;
    }
  }

  /**
   * Encrypt field value and return base64 encoded result
   */
  async encryptField(value: string, keyId?: string): Promise<string> {
    const result = await this.encrypt(value, { keyId });
    
    // Pack encryption metadata with the data
    const packed = {
      data: result.encryptedData.toString('base64'),
      keyId: result.keyId,
      algorithm: result.algorithm,
      iv: result.iv.toString('base64'),
      authTag: result.authTag.toString('base64')
    };

    return Buffer.from(JSON.stringify(packed)).toString('base64');
  }

  /**
   * Decrypt field value from base64 encoded result
   */
  async decryptField(encryptedValue: string): Promise<string> {
    try {
      const packed = JSON.parse(Buffer.from(encryptedValue, 'base64').toString());
      
      const request: DecryptionRequest = {
        encryptedData: Buffer.from(packed.data, 'base64'),
        keyId: packed.keyId,
        algorithm: packed.algorithm,
        iv: Buffer.from(packed.iv, 'base64'),
        authTag: Buffer.from(packed.authTag, 'base64')
      };

      const decrypted = await this.decrypt(request);
      return decrypted.toString('utf8');
    } catch (error) {
      throw new Error(`Failed to decrypt field: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Bulk encrypt multiple values
   */
  async bulkEncrypt(request: BulkEncryptionRequest): Promise<BulkEncryptionResult> {
    const results: BulkEncryptionResult['results'] = [];
    let successCount = 0;
    let failureCount = 0;

    for (const item of request.data) {
      try {
        const encryptedValue = await this.encryptField(item.value, request.keyId);
        results.push({
          id: item.id,
          encryptedValue,
          success: true
        });
        successCount++;
      } catch (error) {
        results.push({
          id: item.id,
          encryptedValue: '',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        failureCount++;
      }
    }

    await this.auditService.logEvent({
      eventType: 'data_modification',
      userId: 'system',
      userType: 'system',
      actionPerformed: 'bulk_data_encryption',
      resourceType: 'encrypted_data',
      resourceId: 'bulk_operation',
      resultStatus: failureCount === 0 ? 'success' : 'partial_failure',
      eventMetadata: {
        total_items: request.data.length,
        success_count: successCount,
        failure_count: failureCount,
        key_id: request.keyId
      }
    });

    return {
      results,
      successCount,
      failureCount
    };
  }

  /**
   * Create searchable hash of encrypted value
   */
  async createSearchableHash(value: string, keyId?: string): Promise<string> {
    try {
      const key = keyId ? await this.getKey(keyId) : await this.getKey(await this.getDefaultKeyId());
      if (!key) {
        throw new Error('Encryption key not found');
      }

      const keyMaterial = Buffer.from(key.key_material, 'base64');
      const salt = Buffer.from(key.salt!, 'base64');
      
      // Create deterministic hash for searchability
      const hash = pbkdf2Sync(value, salt, this.PBKDF2_ITERATIONS, 32, 'sha256');
      return hash.toString('base64');
    } catch (error) {
      throw new Error(`Failed to create searchable hash: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Rotate encryption key
   */
  async rotateKey(oldKeyId: string, newPurpose?: string): Promise<KeyRotationResult> {
    try {
      const oldKey = await this.getKey(oldKeyId);
      if (!oldKey) {
        throw new Error(`Old key ${oldKeyId} not found`);
      }

      // Generate new key
      const newKeyId = await this.generateKey(newPurpose || oldKey.purpose, `Rotated from ${oldKeyId}`);

      // Mark old key as rotated
      await EncryptionKey.updateStatus(oldKeyId, 'rotated');

      // In production, this would re-encrypt all data using the old key
      const rotatedRecords = 0; // Placeholder
      const failedRecords = 0; // Placeholder

      const result: KeyRotationResult = {
        oldKeyId,
        newKeyId,
        rotatedRecords,
        failedRecords
      };

      await this.auditService.logEvent({
        eventType: 'admin_action',
        userId: 'system',
        userType: 'admin',
        actionPerformed: 'encryption_key_rotated',
        resourceType: 'encryption_key',
        resourceId: oldKeyId,
        resultStatus: 'success',
        eventMetadata: {
          old_key_id: oldKeyId,
          new_key_id: newKeyId,
          rotated_records: rotatedRecords,
          failed_records: failedRecords
        }
      });

      return result;
    } catch (error) {
      await this.auditService.logEvent({
        eventType: 'admin_action',
        userId: 'system',
        userType: 'admin',
        actionPerformed: 'encryption_key_rotation_failed',
        resourceType: 'encryption_key',
        resourceId: oldKeyId,
        resultStatus: 'failure',
        eventMetadata: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
      throw error;
    }
  }

  /**
   * Revoke encryption key
   */
  async revokeKey(keyId: string, reason: string): Promise<void> {
    try {
      await EncryptionKey.updateStatus(keyId, 'revoked', { revocation_reason: reason });
      this.clearKeyCache();

      await this.auditService.logEvent({
        eventType: 'admin_action',
        userId: 'system',
        userType: 'admin',
        actionPerformed: 'encryption_key_revoked',
        resourceType: 'encryption_key',
        resourceId: keyId,
        resultStatus: 'success',
        eventMetadata: {
          revocation_reason: reason
        }
      });
    } catch (error) {
      await this.auditService.logEvent({
        eventType: 'admin_action',
        userId: 'system',
        userType: 'admin',
        actionPerformed: 'encryption_key_revocation_failed',
        resourceType: 'encryption_key',
        resourceId: keyId,
        resultStatus: 'failure',
        eventMetadata: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
      throw error;
    }
  }

  /**
   * Get encryption key by ID
   */
  private async getKey(keyId: string): Promise<EncryptionKeyEntry | null> {
    await this.refreshKeyCacheIfNeeded();
    return this.keyCache.get(keyId) || null;
  }

  /**
   * Get default encryption key ID
   */
  private async getDefaultKeyId(): Promise<string> {
    await this.refreshKeyCacheIfNeeded();
    
    for (const [keyId, key] of this.keyCache.entries()) {
      if (key.status === 'active' && key.purpose === 'default') {
        return keyId;
      }
    }

    // If no default key exists, create one
    return this.generateKey('default', 'Default encryption key');
  }

  /**
   * Refresh key cache if needed
   */
  private async refreshKeyCacheIfNeeded(): Promise<void> {
    const now = Date.now();
    if (now - this.keysCacheLastUpdated > this.KEY_CACHE_TTL) {
      await this.refreshKeyCache();
    }
  }

  /**
   * Refresh key cache
   */
  private async refreshKeyCache(): Promise<void> {
    try {
      const keys = await EncryptionKey.getActive();
      this.keyCache.clear();
      
      for (const key of keys) {
        this.keyCache.set(key.id, key);
      }
      
      this.keysCacheLastUpdated = Date.now();
    } catch (error) {
      // Continue with existing cache if refresh fails
    }
  }

  /**
   * Clear key cache
   */
  private clearKeyCache(): void {
    this.keyCache.clear();
    this.keysCacheLastUpdated = 0;
  }

  /**
   * Verify encrypted data integrity
   */
  async verifyIntegrity(encryptedValue: string): Promise<boolean> {
    try {
      // Attempt to decrypt the value
      await this.decryptField(encryptedValue);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get encryption statistics for monitoring
   */
  async getEncryptionStatistics(): Promise<{
    totalKeys: number;
    activeKeys: number;
    expiredKeys: number;
    revokedKeys: number;
    keysByPurpose: Record<string, number>;
    oldestKeyAge: number; // in days
    newestKeyAge: number; // in days
  }> {
    try {
      await this.refreshKeyCacheIfNeeded();
      
      const keys = Array.from(this.keyCache.values());
      const activeKeys = keys.filter(k => k.status === 'active');
      const expiredKeys = keys.filter(k => k.status === 'expired' || new Date(k.expires_at!) < new Date());
      const revokedKeys = keys.filter(k => k.status === 'revoked');
      
      const keysByPurpose: Record<string, number> = {};
      let oldestTimestamp = Date.now();
      let newestTimestamp = 0;
      
      for (const key of keys) {
        keysByPurpose[key.purpose] = (keysByPurpose[key.purpose] || 0) + 1;
        
        const createdTimestamp = new Date(key.created_at).getTime();
        if (createdTimestamp < oldestTimestamp) oldestTimestamp = createdTimestamp;
        if (createdTimestamp > newestTimestamp) newestTimestamp = createdTimestamp;
      }
      
      const now = Date.now();
      const oldestKeyAge = Math.floor((now - oldestTimestamp) / (24 * 60 * 60 * 1000));
      const newestKeyAge = Math.floor((now - newestTimestamp) / (24 * 60 * 60 * 1000));
      
      return {
        totalKeys: keys.length,
        activeKeys: activeKeys.length,
        expiredKeys: expiredKeys.length,
        revokedKeys: revokedKeys.length,
        keysByPurpose,
        oldestKeyAge: keys.length > 0 ? oldestKeyAge : 0,
        newestKeyAge: keys.length > 0 ? newestKeyAge : 0
      };
    } catch (error) {
      throw new Error(`Failed to get encryption statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Secure comparison of encrypted values
   */
  secureCompare(encrypted1: string, encrypted2: string): boolean {
    try {
      const buf1 = Buffer.from(encrypted1);
      const buf2 = Buffer.from(encrypted2);
      
      if (buf1.length !== buf2.length) return false;
      
      return timingSafeEqual(buf1, buf2);
    } catch (error) {
      return false;
    }
  }

  /**
   * Export key for backup (encrypted with master key)
   */
  async exportKey(keyId: string, masterPassword: string): Promise<string> {
    try {
      const key = await this.getKey(keyId);
      if (!key) {
        throw new Error(`Key ${keyId} not found`);
      }

      // Encrypt key material with master password
      const salt = randomBytes(this.SALT_LENGTH);
      const masterKey = pbkdf2Sync(masterPassword, salt, this.PBKDF2_ITERATIONS, this.KEY_LENGTH, 'sha256');
      
      const exportData = {
        keyId: key.id,
        purpose: key.purpose,
        algorithm: key.algorithm,
        keyMaterial: key.key_material,
        salt: key.salt,
        createdAt: key.created_at,
        expiresAt: key.expires_at
      };

      const iv = randomBytes(this.IV_LENGTH);
      const cipher = createCipherGCM('aes-256-gcm', masterKey, iv);
      const encrypted = Buffer.concat([
        cipher.update(JSON.stringify(exportData), 'utf8'),
        cipher.final()
      ]);
      const authTag = cipher.getAuthTag();

      const exportPackage = {
        version: '1.0',
        salt: salt.toString('base64'),
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64'),
        data: encrypted.toString('base64'),
        timestamp: Date.now()
      };

      await this.auditService.logEvent({
        eventType: 'admin_action',
        userId: 'system',
        userType: 'admin',
        actionPerformed: 'encryption_key_exported',
        resourceType: 'encryption_key',
        resourceId: keyId,
        resultStatus: 'success',
        eventMetadata: {
          export_timestamp: Date.now()
        }
      });

      return Buffer.from(JSON.stringify(exportPackage)).toString('base64');
    } catch (error) {
      throw new Error(`Failed to export key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export default EncryptionService;