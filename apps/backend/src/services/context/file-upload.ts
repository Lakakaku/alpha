import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import path from 'path';

export interface FileUploadOptions {
  maxFileSize?: number; // bytes
  allowedMimeTypes?: string[];
  generateThumbnail?: boolean;
  thumbnailSize?: { width: number; height: number };
  quality?: number;
  resize?: { width?: number; height?: number; fit?: 'cover' | 'contain' | 'fill' };
}

export interface UploadResult {
  fileId: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
  metadata: {
    width?: number;
    height?: number;
    format?: string;
    uploadedAt: string;
    uploadedBy: string;
  };
}

export interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  metadata?: {
    width: number;
    height: number;
    format: string;
    size: number;
  };
}

export class ContextFileUploadService {
  private supabase;
  private bucketName = 'context-files';

  private defaultOptions: Required<FileUploadOptions> = {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: [
      'image/jpeg',
      'image/png', 
      'image/webp',
      'image/svg+xml',
      'application/pdf',
    ],
    generateThumbnail: true,
    thumbnailSize: { width: 300, height: 300 },
    quality: 85,
    resize: { fit: 'contain' },
  };

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
  }

  /**
   * Upload a file for layout context
   */
  async uploadLayoutFile(
    storeId: string,
    userId: string,
    file: Buffer,
    originalName: string,
    mimeType: string,
    layoutId?: string,
    options: Partial<FileUploadOptions> = {}
  ): Promise<UploadResult> {
    try {
      const uploadOptions = { ...this.defaultOptions, ...options };

      // Validate file
      const validation = await this.validateFile(file, mimeType, uploadOptions);
      if (!validation.isValid) {
        throw new Error(`File validation failed: ${validation.errors.join(', ')}`);
      }

      // Generate unique file ID and path
      const fileId = uuidv4();
      const fileExtension = path.extname(originalName);
      const fileName = `${fileId}${fileExtension}`;
      const filePath = `stores/${storeId}/layouts/${fileName}`;

      // Process image if needed
      let processedFile = file;
      let metadata = validation.metadata!;

      if (this.isImage(mimeType) && uploadOptions.resize) {
        const result = await this.processImage(file, uploadOptions);
        processedFile = result.buffer;
        metadata = { ...metadata, ...result.metadata };
      }

      // Upload main file
      const { data: uploadData, error: uploadError } = await this.supabase.storage
        .from(this.bucketName)
        .upload(filePath, processedFile, {
          contentType: mimeType,
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Failed to upload file: ${uploadError.message}`);
      }

      // Generate public URL
      const { data: urlData } = this.supabase.storage
        .from(this.bucketName)
        .getPublicUrl(filePath);

      const fileUrl = urlData.publicUrl;

      // Generate thumbnail if requested
      let thumbnailUrl: string | undefined;
      if (uploadOptions.generateThumbnail && this.isImage(mimeType)) {
        thumbnailUrl = await this.generateThumbnail(
          file,
          storeId,
          fileId,
          uploadOptions.thumbnailSize
        );
      }

      // Save file metadata to database
      const fileRecord = {
        id: fileId,
        store_id: storeId,
        layout_id: layoutId,
        file_name: fileName,
        original_name: originalName,
        mime_type: mimeType,
        file_size: processedFile.length,
        file_path: filePath,
        file_url: fileUrl,
        thumbnail_url: thumbnailUrl,
        metadata: {
          ...metadata,
          uploadedAt: new Date().toISOString(),
          uploadedBy: userId,
        },
        uploaded_by: userId,
        created_at: new Date().toISOString(),
      };

      const { data: dbData, error: dbError } = await this.supabase
        .from('context_files')
        .insert(fileRecord)
        .select()
        .single();

      if (dbError) {
        // Cleanup uploaded file if database insert fails
        await this.supabase.storage
          .from(this.bucketName)
          .remove([filePath]);
        
        throw new Error(`Failed to save file metadata: ${dbError.message}`);
      }

      return {
        fileId,
        fileName,
        originalName,
        mimeType,
        size: processedFile.length,
        url: fileUrl,
        thumbnailUrl,
        metadata: {
          ...metadata,
          uploadedAt: new Date().toISOString(),
          uploadedBy: userId,
        },
      };

    } catch (error) {
      console.error('File upload failed:', error);
      throw error;
    }
  }

  /**
   * Delete a file and its metadata
   */
  async deleteFile(fileId: string, userId: string): Promise<void> {
    try {
      // Get file metadata
      const { data: fileData, error: fetchError } = await this.supabase
        .from('context_files')
        .select('file_path, thumbnail_url')
        .eq('id', fileId)
        .single();

      if (fetchError) {
        throw new Error(`File not found: ${fetchError.message}`);
      }

      // Delete from storage
      const filesToDelete = [fileData.file_path];
      if (fileData.thumbnail_url) {
        // Extract thumbnail path from URL
        const thumbnailPath = this.extractPathFromUrl(fileData.thumbnail_url);
        if (thumbnailPath) {
          filesToDelete.push(thumbnailPath);
        }
      }

      const { error: storageError } = await this.supabase.storage
        .from(this.bucketName)
        .remove(filesToDelete);

      if (storageError) {
        console.warn(`Failed to delete files from storage: ${storageError.message}`);
      }

      // Delete from database
      const { error: dbError } = await this.supabase
        .from('context_files')
        .delete()
        .eq('id', fileId);

      if (dbError) {
        throw new Error(`Failed to delete file metadata: ${dbError.message}`);
      }

    } catch (error) {
      console.error('File deletion failed:', error);
      throw error;
    }
  }

  /**
   * Get files for a store or layout
   */
  async getFiles(
    storeId: string,
    layoutId?: string,
    options: {
      limit?: number;
      offset?: number;
      sortBy?: 'created_at' | 'file_name' | 'file_size';
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<{
    files: UploadResult[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      let query = this.supabase
        .from('context_files')
        .select('*', { count: 'exact' })
        .eq('store_id', storeId);

      if (layoutId) {
        query = query.eq('layout_id', layoutId);
      }

      // Apply sorting
      const sortBy = options.sortBy || 'created_at';
      const sortOrder = options.sortOrder || 'desc';
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      // Apply pagination
      const limit = options.limit || 50;
      const offset = options.offset || 0;
      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        throw new Error(`Failed to fetch files: ${error.message}`);
      }

      const files = (data || []).map(record => ({
        fileId: record.id,
        fileName: record.file_name,
        originalName: record.original_name,
        mimeType: record.mime_type,
        size: record.file_size,
        url: record.file_url,
        thumbnailUrl: record.thumbnail_url,
        metadata: record.metadata,
      }));

      const total = count || 0;
      const hasMore = total > offset + limit;

      return { files, total, hasMore };

    } catch (error) {
      console.error('Failed to fetch files:', error);
      throw error;
    }
  }

  /**
   * Validate uploaded file
   */
  private async validateFile(
    file: Buffer,
    mimeType: string,
    options: Required<FileUploadOptions>
  ): Promise<FileValidationResult> {
    const errors: string[] = [];

    // Check file size
    if (file.length > options.maxFileSize) {
      errors.push(`File size exceeds maximum allowed size of ${options.maxFileSize / 1024 / 1024}MB`);
    }

    // Check MIME type
    if (!options.allowedMimeTypes.includes(mimeType)) {
      errors.push(`File type ${mimeType} is not allowed`);
    }

    // Get image metadata if it's an image
    let metadata: { width: number; height: number; format: string; size: number } | undefined;

    if (this.isImage(mimeType)) {
      try {
        const imageInfo = await sharp(file).metadata();
        metadata = {
          width: imageInfo.width || 0,
          height: imageInfo.height || 0,
          format: imageInfo.format || 'unknown',
          size: file.length,
        };

        // Validate image dimensions
        if (metadata.width > 4096 || metadata.height > 4096) {
          errors.push('Image dimensions exceed maximum allowed size (4096x4096)');
        }

        if (metadata.width < 10 || metadata.height < 10) {
          errors.push('Image dimensions are too small (minimum 10x10)');
        }

      } catch (error) {
        errors.push('Invalid or corrupted image file');
      }
    } else {
      metadata = {
        width: 0,
        height: 0,
        format: mimeType.split('/')[1] || 'unknown',
        size: file.length,
      };
    }

    return {
      isValid: errors.length === 0,
      errors,
      metadata,
    };
  }

  /**
   * Process image (resize, optimize)
   */
  private async processImage(
    file: Buffer,
    options: Required<FileUploadOptions>
  ): Promise<{
    buffer: Buffer;
    metadata: { width: number; height: number; format: string };
  }> {
    let processor = sharp(file);

    // Apply resize if specified
    if (options.resize.width || options.resize.height) {
      processor = processor.resize({
        width: options.resize.width,
        height: options.resize.height,
        fit: options.resize.fit,
        withoutEnlargement: true,
      });
    }

    // Apply quality optimization
    processor = processor.jpeg({ quality: options.quality });

    const processedBuffer = await processor.toBuffer();
    const metadata = await sharp(processedBuffer).metadata();

    return {
      buffer: processedBuffer,
      metadata: {
        width: metadata.width || 0,
        height: metadata.height || 0,
        format: metadata.format || 'jpeg',
      },
    };
  }

  /**
   * Generate thumbnail for image
   */
  private async generateThumbnail(
    originalFile: Buffer,
    storeId: string,
    fileId: string,
    size: { width: number; height: number }
  ): Promise<string> {
    try {
      const thumbnailBuffer = await sharp(originalFile)
        .resize(size.width, size.height, {
          fit: 'cover',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 80 })
        .toBuffer();

      const thumbnailPath = `stores/${storeId}/layouts/thumbnails/${fileId}_thumb.jpg`;

      const { error } = await this.supabase.storage
        .from(this.bucketName)
        .upload(thumbnailPath, thumbnailBuffer, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
        });

      if (error) {
        console.warn(`Failed to upload thumbnail: ${error.message}`);
        return '';
      }

      const { data } = this.supabase.storage
        .from(this.bucketName)
        .getPublicUrl(thumbnailPath);

      return data.publicUrl;

    } catch (error) {
      console.warn('Thumbnail generation failed:', error);
      return '';
    }
  }

  /**
   * Check if MIME type is an image
   */
  private isImage(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }

  /**
   * Extract file path from Supabase public URL
   */
  private extractPathFromUrl(url: string): string | null {
    try {
      const urlParts = url.split(`/storage/v1/object/public/${this.bucketName}/`);
      return urlParts[1] || null;
    } catch {
      return null;
    }
  }

  /**
   * Cleanup orphaned files (files not referenced by any layout)
   */
  async cleanupOrphanedFiles(storeId: string): Promise<number> {
    try {
      // Find files not referenced by any layout
      const { data: orphanedFiles, error } = await this.supabase
        .from('context_files')
        .select('id, file_path, thumbnail_url')
        .eq('store_id', storeId)
        .is('layout_id', null);

      if (error) {
        throw new Error(`Failed to find orphaned files: ${error.message}`);
      }

      if (!orphanedFiles || orphanedFiles.length === 0) {
        return 0;
      }

      // Delete files from storage
      const filesToDelete: string[] = [];
      orphanedFiles.forEach(file => {
        filesToDelete.push(file.file_path);
        if (file.thumbnail_url) {
          const thumbnailPath = this.extractPathFromUrl(file.thumbnail_url);
          if (thumbnailPath) {
            filesToDelete.push(thumbnailPath);
          }
        }
      });

      const { error: storageError } = await this.supabase.storage
        .from(this.bucketName)
        .remove(filesToDelete);

      if (storageError) {
        console.warn(`Failed to delete orphaned files from storage: ${storageError.message}`);
      }

      // Delete from database
      const fileIds = orphanedFiles.map(file => file.id);
      const { error: dbError } = await this.supabase
        .from('context_files')
        .delete()
        .in('id', fileIds);

      if (dbError) {
        console.warn(`Failed to delete orphaned file records: ${dbError.message}`);
      }

      return orphanedFiles.length;

    } catch (error) {
      console.error('Cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Get file usage statistics for a store
   */
  async getFileStats(storeId: string): Promise<{
    totalFiles: number;
    totalSize: number;
    filesByType: Record<string, number>;
    sizeByType: Record<string, number>;
    oldestFile: string;
    newestFile: string;
  }> {
    try {
      const { data: files, error } = await this.supabase
        .from('context_files')
        .select('mime_type, file_size, created_at')
        .eq('store_id', storeId);

      if (error) {
        throw new Error(`Failed to fetch file stats: ${error.message}`);
      }

      const filesByType: Record<string, number> = {};
      const sizeByType: Record<string, number> = {};
      let totalSize = 0;
      let oldestFile = '';
      let newestFile = '';

      (files || []).forEach(file => {
        const type = file.mime_type;
        
        filesByType[type] = (filesByType[type] || 0) + 1;
        sizeByType[type] = (sizeByType[type] || 0) + file.file_size;
        totalSize += file.file_size;

        if (!oldestFile || file.created_at < oldestFile) {
          oldestFile = file.created_at;
        }
        if (!newestFile || file.created_at > newestFile) {
          newestFile = file.created_at;
        }
      });

      return {
        totalFiles: files?.length || 0,
        totalSize,
        filesByType,
        sizeByType,
        oldestFile,
        newestFile,
      };

    } catch (error) {
      console.error('Failed to get file stats:', error);
      throw error;
    }
  }
}

export default ContextFileUploadService;