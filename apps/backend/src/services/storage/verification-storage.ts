import { createClient } from '@supabase/supabase-js';
import { Database } from '@vocilia/database';
import { loggingService } from '../loggingService';
import { randomUUID } from 'crypto';

export interface FileExportOptions {
  format: 'csv' | 'excel' | 'json';
  filename?: string;
  metadata?: Record<string, any>;
}

export interface StoredFile {
  id: string;
  bucket: string;
  path: string;
  filename: string;
  size: number;
  contentType: string;
  uploadedAt: Date;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

export interface FileUploadResult {
  file: StoredFile;
  publicUrl?: string;
  signedUrl?: string;
}

class VerificationStorageService {
  private supabase = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  private readonly VERIFICATION_BUCKET = 'verification-files';
  private readonly TEMP_BUCKET = 'temp-uploads';
  private readonly PUBLIC_BASE_URL = process.env.SUPABASE_URL?.replace('/rest/v1', '') || '';

  constructor() {
    this.ensureBucketsExist();
  }

  private async ensureBucketsExist(): Promise<void> {
    try {
      // Check if buckets exist, create if not
      const { data: buckets } = await this.supabase.storage.listBuckets();
      const bucketNames = buckets?.map(b => b.name) || [];

      if (!bucketNames.includes(this.VERIFICATION_BUCKET)) {
        await this.supabase.storage.createBucket(this.VERIFICATION_BUCKET, {
          public: false,
          allowedMimeTypes: ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/json'],
          fileSizeLimit: 100 * 1024 * 1024 // 100MB
        });
      }

      if (!bucketNames.includes(this.TEMP_BUCKET)) {
        await this.supabase.storage.createBucket(this.TEMP_BUCKET, {
          public: false,
          allowedMimeTypes: ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
          fileSizeLimit: 50 * 1024 * 1024 // 50MB
        });
      }
    } catch (error) {
      await loggingService.logError('Failed to ensure storage buckets exist', error as Error);
    }
  }

  async storeVerificationFile(
    databaseId: string,
    content: Buffer | string,
    options: FileExportOptions
  ): Promise<FileUploadResult> {
    const fileId = randomUUID();
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = options.filename || `verification-${databaseId}-${timestamp}.${options.format}`;
    const path = `databases/${databaseId}/${filename}`;

    try {
      const contentType = this.getContentType(options.format);
      const fileContent = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;

      const { data, error } = await this.supabase.storage
        .from(this.VERIFICATION_BUCKET)
        .upload(path, fileContent, {
          contentType,
          metadata: {
            databaseId,
            format: options.format,
            uploadedAt: new Date().toISOString(),
            ...options.metadata
          }
        });

      if (error) {
        throw new Error(`Storage upload failed: ${error.message}`);
      }

      // Generate signed URL for download (valid for 7 days)
      const { data: signedUrlData } = await this.supabase.storage
        .from(this.VERIFICATION_BUCKET)
        .createSignedUrl(path, 7 * 24 * 60 * 60); // 7 days

      const storedFile: StoredFile = {
        id: fileId,
        bucket: this.VERIFICATION_BUCKET,
        path: data.path,
        filename,
        size: fileContent.length,
        contentType,
        uploadedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        metadata: options.metadata
      };

      await loggingService.logInfo('Verification file stored successfully', {
        databaseId,
        filename,
        format: options.format,
        size: fileContent.length
      });

      return {
        file: storedFile,
        signedUrl: signedUrlData?.signedUrl
      };

    } catch (error) {
      await loggingService.logError('Failed to store verification file', error as Error, {
        databaseId,
        filename,
        format: options.format
      });
      throw error;
    }
  }

  async getVerificationFile(databaseId: string, filename: string): Promise<Buffer> {
    const path = `databases/${databaseId}/${filename}`;

    try {
      const { data, error } = await this.supabase.storage
        .from(this.VERIFICATION_BUCKET)
        .download(path);

      if (error) {
        throw new Error(`File download failed: ${error.message}`);
      }

      return Buffer.from(await data.arrayBuffer());

    } catch (error) {
      await loggingService.logError('Failed to retrieve verification file', error as Error, {
        databaseId,
        filename
      });
      throw error;
    }
  }

  async createDownloadUrl(databaseId: string, filename: string, expiresIn: number = 3600): Promise<string> {
    const path = `databases/${databaseId}/${filename}`;

    try {
      const { data, error } = await this.supabase.storage
        .from(this.VERIFICATION_BUCKET)
        .createSignedUrl(path, expiresIn);

      if (error) {
        throw new Error(`Failed to create download URL: ${error.message}`);
      }

      return data.signedUrl;

    } catch (error) {
      await loggingService.logError('Failed to create download URL', error as Error, {
        databaseId,
        filename
      });
      throw error;
    }
  }

  async storeTempUpload(
    storeId: string,
    content: Buffer,
    originalFilename: string
  ): Promise<FileUploadResult> {
    const fileId = randomUUID();
    const timestamp = Date.now();
    const extension = originalFilename.split('.').pop() || 'csv';
    const filename = `upload-${storeId}-${timestamp}.${extension}`;
    const path = `uploads/${storeId}/${filename}`;

    try {
      const contentType = this.getContentTypeFromExtension(extension);

      const { data, error } = await this.supabase.storage
        .from(this.TEMP_BUCKET)
        .upload(path, content, {
          contentType,
          metadata: {
            storeId,
            originalFilename,
            uploadedAt: new Date().toISOString()
          }
        });

      if (error) {
        throw new Error(`Temp upload failed: ${error.message}`);
      }

      const storedFile: StoredFile = {
        id: fileId,
        bucket: this.TEMP_BUCKET,
        path: data.path,
        filename,
        size: content.length,
        contentType,
        uploadedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        metadata: { storeId, originalFilename }
      };

      return { file: storedFile };

    } catch (error) {
      await loggingService.logError('Failed to store temp upload', error as Error, {
        storeId,
        originalFilename
      });
      throw error;
    }
  }

  async getTempUpload(storeId: string, filename: string): Promise<Buffer> {
    const path = `uploads/${storeId}/${filename}`;

    try {
      const { data, error } = await this.supabase.storage
        .from(this.TEMP_BUCKET)
        .download(path);

      if (error) {
        throw new Error(`Temp file download failed: ${error.message}`);
      }

      return Buffer.from(await data.arrayBuffer());

    } catch (error) {
      await loggingService.logError('Failed to retrieve temp upload', error as Error, {
        storeId,
        filename
      });
      throw error;
    }
  }

  async deleteFile(bucket: string, path: string): Promise<void> {
    try {
      const { error } = await this.supabase.storage
        .from(bucket)
        .remove([path]);

      if (error) {
        throw new Error(`File deletion failed: ${error.message}`);
      }

      await loggingService.logInfo('File deleted successfully', { bucket, path });

    } catch (error) {
      await loggingService.logError('Failed to delete file', error as Error, { bucket, path });
      throw error;
    }
  }

  async deleteExpiredFiles(bucket: string, olderThanDays: number): Promise<number> {
    try {
      const { data: files } = await this.supabase.storage
        .from(bucket)
        .list('', { limit: 1000 });

      if (!files) return 0;

      const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
      const expiredFiles = files.filter(file => 
        new Date(file.created_at) < cutoffDate
      );

      if (expiredFiles.length === 0) return 0;

      const filePaths = expiredFiles.map(file => file.name);
      const { error } = await this.supabase.storage
        .from(bucket)
        .remove(filePaths);

      if (error) {
        throw new Error(`Bulk file deletion failed: ${error.message}`);
      }

      await loggingService.logInfo('Expired files cleaned up', {
        bucket,
        deletedCount: expiredFiles.length,
        cutoffDate: cutoffDate.toISOString()
      });

      return expiredFiles.length;

    } catch (error) {
      await loggingService.logError('Failed to delete expired files', error as Error, {
        bucket,
        olderThanDays
      });
      throw error;
    }
  }

  async listFiles(databaseId: string): Promise<StoredFile[]> {
    try {
      const { data: files, error } = await this.supabase.storage
        .from(this.VERIFICATION_BUCKET)
        .list(`databases/${databaseId}`, { limit: 100 });

      if (error) {
        throw new Error(`File listing failed: ${error.message}`);
      }

      return files.map(file => ({
        id: file.id || randomUUID(),
        bucket: this.VERIFICATION_BUCKET,
        path: `databases/${databaseId}/${file.name}`,
        filename: file.name,
        size: file.metadata?.size || 0,
        contentType: file.metadata?.mimetype || 'application/octet-stream',
        uploadedAt: new Date(file.created_at),
        metadata: file.metadata
      }));

    } catch (error) {
      await loggingService.logError('Failed to list files', error as Error, { databaseId });
      throw error;
    }
  }

  private getContentType(format: string): string {
    switch (format) {
      case 'csv':
        return 'text/csv';
      case 'excel':
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case 'json':
        return 'application/json';
      default:
        return 'application/octet-stream';
    }
  }

  private getContentTypeFromExtension(extension: string): string {
    switch (extension.toLowerCase()) {
      case 'csv':
        return 'text/csv';
      case 'xlsx':
      case 'xls':
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case 'json':
        return 'application/json';
      default:
        return 'application/octet-stream';
    }
  }

  // Admin utilities
  async getStorageStats(): Promise<{
    verificationFiles: { count: number; totalSize: number };
    tempFiles: { count: number; totalSize: number };
  }> {
    try {
      const [verificationFiles, tempFiles] = await Promise.all([
        this.getBucketStats(this.VERIFICATION_BUCKET),
        this.getBucketStats(this.TEMP_BUCKET)
      ]);

      return {
        verificationFiles,
        tempFiles
      };

    } catch (error) {
      await loggingService.logError('Failed to get storage stats', error as Error);
      throw error;
    }
  }

  private async getBucketStats(bucket: string): Promise<{ count: number; totalSize: number }> {
    const { data: files } = await this.supabase.storage
      .from(bucket)
      .list('', { limit: 1000 });

    if (!files) return { count: 0, totalSize: 0 };

    const totalSize = files.reduce((sum, file) => sum + (file.metadata?.size || 0), 0);
    return { count: files.length, totalSize };
  }
}

export const verificationStorage = new VerificationStorageService();
export { VerificationStorageService };