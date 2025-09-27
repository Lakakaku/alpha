// Offline sync service for background processing of queued submissions
// Handles retry logic, batch processing, and error recovery

import { offlineQueueService } from '@vocilia/database/src/offline';
import type { OfflineSubmissionQueue } from '@vocilia/types';

export class OfflineSyncService {
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startBackgroundProcessing();
  }

  /**
   * Start background processing of offline queue
   */
  startBackgroundProcessing(): void {
    if (this.processingInterval) {
      return; // Already running
    }

    console.log('Starting offline sync background processing');

    // Process queue every 2 minutes
    this.processingInterval = setInterval(async () => {
      if (!this.isProcessing) {
        await this.processQueue();
      }
    }, 2 * 60 * 1000);

    // Initial processing
    setTimeout(() => this.processQueue(), 5000); // Start after 5 seconds
  }

  /**
   * Stop background processing
   */
  stopBackgroundProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      console.log('Stopped offline sync background processing');
    }
  }

  /**
   * Process the offline submission queue
   */
  async processQueue(): Promise<void> {
    if (this.isProcessing) {
      return; // Already processing
    }

    this.isProcessing = true;

    try {
      console.log('Processing offline submission queue...');

      // Get pending submissions
      const result = await offlineQueueService.getPendingSubmissions(20); // Process 20 at a time

      if (!result.success || !result.submissions || result.submissions.length === 0) {
        return; // No submissions to process
      }

      const submissions = result.submissions;
      console.log(`Found ${submissions.length} submissions to process`);

      // Process each submission
      let successCount = 0;
      let failureCount = 0;

      for (const submission of submissions) {
        try {
          const processed = await this.processSubmission(submission);
          if (processed) {
            successCount++;
          } else {
            failureCount++;
          }
        } catch (error) {
          console.error(`Failed to process submission ${submission.id}:`, error);
          failureCount++;
        }
      }

      console.log(`Offline sync batch completed: ${successCount} successful, ${failureCount} failed`);

      // Clean up old submissions periodically
      if (Math.random() < 0.1) { // 10% chance
        await this.cleanupOldSubmissions();
      }

    } catch (error) {
      console.error('Error processing offline queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single submission
   */
  private async processSubmission(submission: OfflineSubmissionQueue): Promise<boolean> {
    try {
      // Update status to syncing
      await offlineQueueService.updateSubmissionStatus(submission.id, 'syncing');

      // Validate submission data
      const submissionData = submission.submission_data;
      if (!this.validateSubmissionData(submissionData)) {
        await offlineQueueService.updateSubmissionStatus(
          submission.id,
          'failed',
          'Invalid submission data format'
        );
        return false;
      }

      // Process the verification submission
      const result = await this.processVerificationSubmission(submissionData);

      if (result.success) {
        // Mark as synced
        await offlineQueueService.updateSubmissionStatus(
          submission.id,
          'synced',
          undefined,
          result.verificationId
        );
        return true;
      } else {
        // Mark as failed
        await offlineQueueService.updateSubmissionStatus(
          submission.id,
          'failed',
          result.error
        );
        return false;
      }

    } catch (error) {
      console.error(`Error processing submission ${submission.id}:`, error);

      await offlineQueueService.updateSubmissionStatus(
        submission.id,
        'failed',
        error instanceof Error ? error.message : 'Unknown processing error'
      );

      return false;
    }
  }

  /**
   * Validate submission data format
   */
  private validateSubmissionData(data: any): boolean {
    return !!(
      data &&
      data.store_id &&
      data.session_token &&
      data.transaction_time &&
      data.transaction_amount &&
      data.phone_number &&
      data.client_timestamp
    );
  }

  /**
   * Process verification submission (integrates with existing verification logic)
   */
  private async processVerificationSubmission(submissionData: any): Promise<{
    success: boolean;
    verificationId?: string;
    error?: string;
  }> {
    try {
      // TODO: Integrate with actual verification service
      // This is a placeholder implementation

      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Simulate success/failure based on data validity
      if (submissionData.transaction_amount < 0) {
        return {
          success: false,
          error: 'Invalid transaction amount'
        };
      }

      // Generate verification ID
      const verificationId = `ver_offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      return {
        success: true,
        verificationId
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Processing failed'
      };
    }
  }

  /**
   * Clean up old submissions
   */
  private async cleanupOldSubmissions(): Promise<void> {
    try {
      const result = await offlineQueueService.cleanupOldSubmissions(7); // Clean up submissions older than 7 days

      if (result.success && result.deletedCount && result.deletedCount > 0) {
        console.log(`Cleaned up ${result.deletedCount} old offline submissions`);
      }
    } catch (error) {
      console.error('Error cleaning up old submissions:', error);
    }
  }

  /**
   * Get processing statistics
   */
  async getProcessingStats(): Promise<{
    is_processing: boolean;
    queue_stats: any;
    last_processed: string;
  }> {
    const queueStats = await offlineQueueService.getQueueStats();

    return {
      is_processing: this.isProcessing,
      queue_stats: queueStats.success ? queueStats.stats : null,
      last_processed: new Date().toISOString()
    };
  }
}

// Export singleton instance
export const offlineSyncService = new OfflineSyncService();

// Graceful shutdown
process.on('SIGTERM', () => {
  offlineSyncService.stopBackgroundProcessing();
});

process.on('SIGINT', () => {
  offlineSyncService.stopBackgroundProcessing();
});