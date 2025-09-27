// Offline submission and sync endpoints for PWA functionality
// Handles verification data submitted while offline and background sync

import { Request, Response } from 'express';
import { offlineQueueService } from '@vocilia/database/src/offline';
import type { 
  OfflineSubmitRequest,
  OfflineSubmitResponse,
  OfflineSyncRequest,
  OfflineSyncResponse 
} from '@vocilia/types';

/**
 * Submit verification data while offline
 * POST /api/offline/submit
 */
export const submitOfflineData = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      submissions,
      client_info
    }: OfflineSubmitRequest = req.body;

    // Validate request
    if (!Array.isArray(submissions) || submissions.length === 0) {
      res.status(400).json({
        error: 'submissions array is required and must not be empty'
      });
      return;
    }

    if (!client_info || !client_info.device_id || !client_info.app_version) {
      res.status(400).json({
        error: 'client_info with device_id and app_version is required'
      });
      return;
    }

    // Validate each submission
    for (const [index, submission] of submissions.entries()) {
      if (!submission.store_id || !submission.session_token || 
          !submission.transaction_time || !submission.transaction_amount || 
          !submission.phone_number || !submission.client_timestamp) {
        res.status(400).json({
          error: `Invalid submission at index ${index}: missing required fields`
        });
        return;
      }
    }

    // Get customer ID from auth context (if available)
    const customerId = (req as any).user?.id;

    // Queue all submissions
    const queueResults = [];
    for (const submission of submissions) {
      const result = await offlineQueueService.queueSubmission(submission, customerId);
      queueResults.push(result);
    }

    // Check for any failures
    const failedSubmissions = queueResults.filter(r => !r.success);
    if (failedSubmissions.length > 0) {
      console.error('Some offline submissions failed to queue:', failedSubmissions);
    }

    const successfulSubmissions = queueResults.filter(r => r.success);
    const queueIds = successfulSubmissions.map(r => r.queueId!);

    // Estimate sync time based on queue size
    const queueStats = await offlineQueueService.getQueueStats();
    const estimatedSyncTime = new Date();
    estimatedSyncTime.setMinutes(estimatedSyncTime.getMinutes() + 5); // 5 minutes default

    // Build response
    const response: OfflineSubmitResponse = {
      success: successfulSubmissions.length > 0,
      queued_count: successfulSubmissions.length,
      queue_ids: queueIds,
      estimated_sync_time: estimatedSyncTime.toISOString()
    };

    // Log offline submission
    console.log(`Queued ${successfulSubmissions.length} offline submissions`, {
      device_id: client_info.device_id,
      app_version: client_info.app_version,
      customer_id: customerId,
      total_submissions: submissions.length
    });

    res.json(response);

  } catch (error) {
    console.error('Failed to submit offline data:', error);

    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Sync offline submissions
 * POST /api/offline/sync
 */
export const syncOfflineData = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      device_id,
      last_sync_timestamp
    }: OfflineSyncRequest = req.body;

    if (!device_id) {
      res.status(400).json({
        error: 'device_id is required'
      });
      return;
    }

    // Get customer ID from auth context (if available)
    const customerId = (req as any).user?.id;

    // Get pending submissions for this user/device
    let pendingSubmissions;
    if (customerId) {
      pendingSubmissions = await offlineQueueService.getUserQueuedSubmissions(customerId);
    } else {
      // For anonymous users, get submissions by device info (would need additional logic)
      pendingSubmissions = await offlineQueueService.getPendingSubmissions(50);
    }

    if (!pendingSubmissions.success) {
      res.status(500).json({
        error: 'Failed to get pending submissions',
        details: pendingSubmissions.error
      });
      return;
    }

    const submissions = pendingSubmissions.submissions || [];

    // Filter submissions that haven't been synced yet
    const unsynced = submissions.filter(s => 
      s.status === 'pending' || 
      (s.status === 'failed' && (!s.next_retry_at || new Date(s.next_retry_at) <= new Date()))
    );

    // Process each submission
    const syncedSubmissions = [];
    const failedSubmissions = [];

    for (const submission of unsynced) {
      try {
        // Update status to syncing
        await offlineQueueService.updateSubmissionStatus(submission.id, 'syncing');

        // Process the verification submission
        const verificationResult = await processVerificationSubmission(submission.submission_data);

        if (verificationResult.success) {
          // Mark as synced
          await offlineQueueService.updateSubmissionStatus(
            submission.id, 
            'synced', 
            undefined, 
            verificationResult.verificationId
          );

          syncedSubmissions.push({
            queue_id: submission.id,
            verification_id: verificationResult.verificationId,
            status: 'success' as const
          });
        } else {
          // Mark as failed
          await offlineQueueService.updateSubmissionStatus(
            submission.id, 
            'failed', 
            verificationResult.error
          );

          const retryAfter = new Date();
          retryAfter.setMinutes(retryAfter.getMinutes() + 10); // Retry in 10 minutes

          failedSubmissions.push({
            queue_id: submission.id,
            error_message: verificationResult.error || 'Processing failed',
            retry_after: retryAfter.toISOString()
          });
        }
      } catch (error) {
        console.error(`Failed to sync submission ${submission.id}:`, error);

        await offlineQueueService.updateSubmissionStatus(
          submission.id, 
          'failed', 
          error instanceof Error ? error.message : 'Unknown sync error'
        );

        const retryAfter = new Date();
        retryAfter.setMinutes(retryAfter.getMinutes() + 15);

        failedSubmissions.push({
          queue_id: submission.id,
          error_message: error instanceof Error ? error.message : 'Unknown sync error',
          retry_after: retryAfter.toISOString()
        });
      }
    }

    // Calculate next recommended sync time
    const nextSync = new Date();
    nextSync.setMinutes(nextSync.getMinutes() + (failedSubmissions.length > 0 ? 15 : 60));

    // Build response
    const response: OfflineSyncResponse = {
      success: true,
      synced_submissions: syncedSubmissions,
      failed_submissions: failedSubmissions,
      next_sync_recommended: nextSync.toISOString()
    };

    // Log sync results
    console.log(`Offline sync completed for device ${device_id}`, {
      customer_id: customerId,
      synced_count: syncedSubmissions.length,
      failed_count: failedSubmissions.length,
      total_processed: unsynced.length
    });

    res.json(response);

  } catch (error) {
    console.error('Failed to sync offline data:', error);

    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get offline queue status
 * GET /api/offline/status
 */
export const getOfflineStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const customerId = (req as any).user?.id;

    if (!customerId) {
      res.status(401).json({
        error: 'Authentication required'
      });
      return;
    }

    // Get user's queued submissions
    const result = await offlineQueueService.getUserQueuedSubmissions(customerId);

    if (!result.success) {
      res.status(500).json({
        error: 'Failed to get offline status',
        details: result.error
      });
      return;
    }

    const submissions = result.submissions || [];

    // Categorize submissions
    const pending = submissions.filter(s => s.status === 'pending').length;
    const syncing = submissions.filter(s => s.status === 'syncing').length;
    const synced = submissions.filter(s => s.status === 'synced').length;
    const failed = submissions.filter(s => s.status === 'failed').length;

    // Get oldest pending submission
    const oldestPending = submissions
      .filter(s => s.status === 'pending')
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];

    res.json({
      success: true,
      queue_status: {
        pending_count: pending,
        syncing_count: syncing,
        synced_count: synced,
        failed_count: failed,
        total_count: submissions.length,
        oldest_pending_at: oldestPending?.created_at || null
      },
      last_updated: new Date().toISOString()
    });

  } catch (error) {
    console.error('Failed to get offline status:', error);

    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Process a verification submission (placeholder - would integrate with existing verification logic)
 */
async function processVerificationSubmission(submissionData: any): Promise<{
  success: boolean;
  verificationId?: string;
  error?: string;
}> {
  try {
    // This would integrate with the existing verification submission logic
    // For now, simulate processing
    
    // Validate submission data
    if (!submissionData.store_id || !submissionData.session_token || 
        !submissionData.transaction_time || !submissionData.transaction_amount || 
        !submissionData.phone_number) {
      return {
        success: false,
        error: 'Missing required verification fields'
      };
    }

    // TODO: Integrate with actual verification service
    // const verificationService = new VerificationService();
    // const result = await verificationService.submitVerification(submissionData);

    // Simulate successful processing for now
    const verificationId = `ver_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      success: true,
      verificationId
    };

  } catch (error) {
    console.error('Error processing verification submission:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Processing failed'
    };
  }
}