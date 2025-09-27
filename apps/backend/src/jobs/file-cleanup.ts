import { createClient } from '@supabase/supabase-js';

interface FileCleanupJob {
  id: string;
  type: 'verification_files' | 'expired_downloads' | 'temp_uploads';
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  filesProcessed: number;
  filesDeleted: number;
}

interface VerificationDatabase {
  id: string;
  csv_file_url?: string;
  excel_file_url?: string;
  json_file_url?: string;
  status: string;
  created_at: string;
}

interface TempFile {
  id: string;
  file_path: string;
  created_at: string;
  expires_at: string;
}

export class FileCleanupJobProcessor {
  private supabase;
  private storageClient;
  private runningJobs: Map<string, FileCleanupJob> = new Map();

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    this.storageClient = this.supabase.storage;
  }

  async cleanupExpiredVerificationFiles(): Promise<string> {
    const jobId = this.generateJobId();
    
    const job: FileCleanupJob = {
      id: jobId,
      type: 'verification_files',
      status: 'pending',
      filesProcessed: 0,
      filesDeleted: 0
    };

    this.runningJobs.set(jobId, job);

    // Start cleanup in background
    this.processExpiredVerificationFilesJob(jobId).catch(error => {
      console.error(`Verification files cleanup job ${jobId} failed:`, error);
      this.updateJobStatus(jobId, 'failed', error.message);
    });

    return jobId;
  }

  async cleanupExpiredDownloads(): Promise<string> {
    const jobId = this.generateJobId();
    
    const job: FileCleanupJob = {
      id: jobId,
      type: 'expired_downloads',
      status: 'pending',
      filesProcessed: 0,
      filesDeleted: 0
    };

    this.runningJobs.set(jobId, job);

    // Start cleanup in background
    this.processExpiredDownloadsJob(jobId).catch(error => {
      console.error(`Expired downloads cleanup job ${jobId} failed:`, error);
      this.updateJobStatus(jobId, 'failed', error.message);
    });

    return jobId;
  }

  async cleanupTempUploads(): Promise<string> {
    const jobId = this.generateJobId();
    
    const job: FileCleanupJob = {
      id: jobId,
      type: 'temp_uploads',
      status: 'pending',
      filesProcessed: 0,
      filesDeleted: 0
    };

    this.runningJobs.set(jobId, job);

    // Start cleanup in background
    this.processTempUploadsJob(jobId).catch(error => {
      console.error(`Temp uploads cleanup job ${jobId} failed:`, error);
      this.updateJobStatus(jobId, 'failed', error.message);
    });

    return jobId;
  }

  private async processExpiredVerificationFilesJob(jobId: string): Promise<void> {
    try {
      this.updateJobStatus(jobId, 'running');
      console.log('Starting expired verification files cleanup...');

      // Get verification databases with files that are old enough to clean up
      const expiredDatabases = await this.getExpiredVerificationDatabases();
      
      if (expiredDatabases.length === 0) {
        console.log('No expired verification files found');
        this.updateJobStatus(jobId, 'completed');
        return;
      }

      console.log(`Processing ${expiredDatabases.length} expired verification databases`);

      let filesProcessed = 0;
      let filesDeleted = 0;

      for (const database of expiredDatabases) {
        try {
          // Clean up files for this database
          const deletedCount = await this.cleanupDatabaseFiles(database);
          filesProcessed++;
          filesDeleted += deletedCount;

          // Clear file URLs from database
          await this.clearDatabaseFileUrls(database.id);

          console.log(`Cleaned up ${deletedCount} files for database ${database.id}`);

        } catch (error) {
          console.error(`Failed to cleanup files for database ${database.id}:`, error);
          filesProcessed++;
        }
      }

      console.log(`Verification files cleanup completed: ${filesDeleted} files deleted from ${filesProcessed} databases`);
      
      const job = this.runningJobs.get(jobId);
      if (job) {
        job.filesProcessed = filesProcessed;
        job.filesDeleted = filesDeleted;
      }
      
      this.updateJobStatus(jobId, 'completed');

    } catch (error) {
      console.error(`Verification files cleanup job ${jobId} failed:`, error);
      this.updateJobStatus(jobId, 'failed', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  private async processExpiredDownloadsJob(jobId: string): Promise<void> {
    try {
      this.updateJobStatus(jobId, 'running');
      console.log('Starting expired download files cleanup...');

      // Clean up files from the downloads bucket that are older than 24 hours
      const expiredDownloads = await this.getExpiredDownloadFiles();
      
      if (expiredDownloads.length === 0) {
        console.log('No expired download files found');
        this.updateJobStatus(jobId, 'completed');
        return;
      }

      console.log(`Processing ${expiredDownloads.length} expired download files`);

      let filesProcessed = 0;
      let filesDeleted = 0;

      // Delete files in batches
      const batchSize = 50;
      for (let i = 0; i < expiredDownloads.length; i += batchSize) {
        const batch = expiredDownloads.slice(i, i + batchSize);
        const filePaths = batch.map(file => file.name);

        try {
          const { data, error } = await this.storageClient
            .from('verification-downloads')
            .remove(filePaths);

          if (error) {
            console.error('Failed to delete batch of download files:', error);
          } else {
            filesDeleted += data?.length || 0;
          }

          filesProcessed += batch.length;

        } catch (error) {
          console.error('Error deleting download files batch:', error);
          filesProcessed += batch.length;
        }
      }

      console.log(`Download files cleanup completed: ${filesDeleted} files deleted from ${filesProcessed} processed`);
      
      const job = this.runningJobs.get(jobId);
      if (job) {
        job.filesProcessed = filesProcessed;
        job.filesDeleted = filesDeleted;
      }
      
      this.updateJobStatus(jobId, 'completed');

    } catch (error) {
      console.error(`Download files cleanup job ${jobId} failed:`, error);
      this.updateJobStatus(jobId, 'failed', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  private async processTempUploadsJob(jobId: string): Promise<void> {
    try {
      this.updateJobStatus(jobId, 'running');
      console.log('Starting temp upload files cleanup...');

      // Clean up temp upload files
      const expiredTempFiles = await this.getExpiredTempFiles();
      
      if (expiredTempFiles.length === 0) {
        console.log('No expired temp files found');
        this.updateJobStatus(jobId, 'completed');
        return;
      }

      console.log(`Processing ${expiredTempFiles.length} expired temp files`);

      let filesProcessed = 0;
      let filesDeleted = 0;

      for (const tempFile of expiredTempFiles) {
        try {
          // Delete file from storage
          const { error } = await this.storageClient
            .from('temp-uploads')
            .remove([tempFile.file_path]);

          if (!error) {
            filesDeleted++;
          } else {
            console.error(`Failed to delete temp file ${tempFile.file_path}:`, error);
          }

          // Remove temp file record from database
          await this.removeTempFileRecord(tempFile.id);
          filesProcessed++;

        } catch (error) {
          console.error(`Failed to cleanup temp file ${tempFile.id}:`, error);
          filesProcessed++;
        }
      }

      console.log(`Temp uploads cleanup completed: ${filesDeleted} files deleted from ${filesProcessed} processed`);
      
      const job = this.runningJobs.get(jobId);
      if (job) {
        job.filesProcessed = filesProcessed;
        job.filesDeleted = filesDeleted;
      }
      
      this.updateJobStatus(jobId, 'completed');

    } catch (error) {
      console.error(`Temp uploads cleanup job ${jobId} failed:`, error);
      this.updateJobStatus(jobId, 'failed', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  private async getExpiredVerificationDatabases(): Promise<VerificationDatabase[]> {
    // Get databases that are completed or expired and older than 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data, error } = await this.supabase
      .from('verification_databases')
      .select('id, csv_file_url, excel_file_url, json_file_url, status, created_at')
      .in('status', ['processed', 'expired'])
      .lt('created_at', thirtyDaysAgo.toISOString())
      .or('csv_file_url.not.is.null,excel_file_url.not.is.null,json_file_url.not.is.null');

    if (error) {
      throw new Error(`Failed to get expired verification databases: ${error.message}`);
    }

    return data || [];
  }

  private async getExpiredDownloadFiles(): Promise<Array<{ name: string; created_at: string }>> {
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    try {
      const { data, error } = await this.storageClient
        .from('verification-downloads')
        .list('', { limit: 1000 });

      if (error) {
        throw new Error(`Failed to list download files: ${error.message}`);
      }

      // Filter files older than 24 hours
      return (data || []).filter(file => {
        const fileDate = new Date(file.created_at);
        return fileDate < twentyFourHoursAgo;
      });

    } catch (error) {
      console.error('Error listing download files:', error);
      return [];
    }
  }

  private async getExpiredTempFiles(): Promise<TempFile[]> {
    const now = new Date();

    const { data, error } = await this.supabase
      .from('temp_files')
      .select('id, file_path, created_at, expires_at')
      .lt('expires_at', now.toISOString());

    if (error) {
      throw new Error(`Failed to get expired temp files: ${error.message}`);
    }

    return data || [];
  }

  private async cleanupDatabaseFiles(database: VerificationDatabase): Promise<number> {
    let deletedCount = 0;
    const filesToDelete: string[] = [];

    // Extract file paths from URLs
    if (database.csv_file_url) {
      const filePath = this.extractFilePathFromUrl(database.csv_file_url);
      if (filePath) filesToDelete.push(filePath);
    }

    if (database.excel_file_url) {
      const filePath = this.extractFilePathFromUrl(database.excel_file_url);
      if (filePath) filesToDelete.push(filePath);
    }

    if (database.json_file_url) {
      const filePath = this.extractFilePathFromUrl(database.json_file_url);
      if (filePath) filesToDelete.push(filePath);
    }

    if (filesToDelete.length === 0) return 0;

    try {
      const { data, error } = await this.storageClient
        .from('verification-files')
        .remove(filesToDelete);

      if (error) {
        console.error(`Failed to delete files for database ${database.id}:`, error);
      } else {
        deletedCount = data?.length || 0;
      }

    } catch (error) {
      console.error(`Error deleting files for database ${database.id}:`, error);
    }

    return deletedCount;
  }

  private async clearDatabaseFileUrls(databaseId: string): Promise<void> {
    const { error } = await this.supabase
      .from('verification_databases')
      .update({
        csv_file_url: null,
        excel_file_url: null,
        json_file_url: null
      })
      .eq('id', databaseId);

    if (error) {
      console.error(`Failed to clear file URLs for database ${databaseId}:`, error);
    }
  }

  private async removeTempFileRecord(tempFileId: string): Promise<void> {
    const { error } = await this.supabase
      .from('temp_files')
      .delete()
      .eq('id', tempFileId);

    if (error) {
      console.error(`Failed to remove temp file record ${tempFileId}:`, error);
    }
  }

  private extractFilePathFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      // Extract path after the bucket name
      const pathParts = urlObj.pathname.split('/');
      // Remove empty strings and bucket name
      const relevantParts = pathParts.filter(part => part.length > 0).slice(1);
      return relevantParts.join('/');
    } catch (error) {
      console.error('Failed to extract file path from URL:', url, error);
      return null;
    }
  }

  private generateJobId(): string {
    return `cleanup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private updateJobStatus(
    jobId: string, 
    status: FileCleanupJob['status'], 
    error?: string
  ): void {
    const job = this.runningJobs.get(jobId);
    if (!job) return;

    job.status = status;
    job.error = error;

    if (status === 'running' && !job.startedAt) {
      job.startedAt = new Date();
    }

    if (status === 'completed' || status === 'failed') {
      job.completedAt = new Date();
    }

    this.runningJobs.set(jobId, job);
  }

  getJobStatus(jobId: string): FileCleanupJob | null {
    return this.runningJobs.get(jobId) || null;
  }

  // Scheduled job entry points
  async runDailyCleanup(): Promise<void> {
    console.log('Starting daily file cleanup...');
    
    try {
      // Run all cleanup jobs
      await Promise.all([
        this.cleanupExpiredDownloads(),
        this.cleanupTempUploads()
      ]);
      
    } catch (error) {
      console.error('Daily cleanup failed:', error);
    }
    
    console.log('Daily file cleanup completed');
  }

  async runWeeklyCleanup(): Promise<void> {
    console.log('Starting weekly file cleanup...');
    
    try {
      // Run comprehensive cleanup including verification files
      await Promise.all([
        this.cleanupExpiredVerificationFiles(),
        this.cleanupExpiredDownloads(),
        this.cleanupTempUploads()
      ]);
      
    } catch (error) {
      console.error('Weekly cleanup failed:', error);
    }
    
    console.log('Weekly file cleanup completed');
  }

  // Cleanup completed jobs
  cleanupCompletedJobs(olderThanHours: number = 24): void {
    const cutoffTime = new Date(Date.now() - (olderThanHours * 60 * 60 * 1000));
    
    for (const [jobId, job] of this.runningJobs.entries()) {
      if ((job.status === 'completed' || job.status === 'failed') && 
          job.completedAt && 
          job.completedAt < cutoffTime) {
        this.runningJobs.delete(jobId);
      }
    }
  }

  // Get cleanup statistics
  getCleanupStats(): {
    totalJobs: number;
    runningJobs: number;
    completedJobs: number;
    failedJobs: number;
  } {
    const totalJobs = this.runningJobs.size;
    let runningJobs = 0;
    let completedJobs = 0;
    let failedJobs = 0;

    for (const job of this.runningJobs.values()) {
      switch (job.status) {
        case 'running':
        case 'pending':
          runningJobs++;
          break;
        case 'completed':
          completedJobs++;
          break;
        case 'failed':
          failedJobs++;
          break;
      }
    }

    return {
      totalJobs,
      runningJobs,
      completedJobs,
      failedJobs
    };
  }
}

// Export singleton instance
export const fileCleanupProcessor = new FileCleanupJobProcessor();