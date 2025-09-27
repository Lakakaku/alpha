// Database queries for offline submission queue management
// Handles offline verification data storage and sync operations

import { createClient } from '../client/supabase';
import type { 
  OfflineSubmissionQueue, 
  OfflineSubmissionData, 
  OfflineSubmissionStatus,
  OfflineSubmitRequest,
  OfflineSubmitResponse,
  OfflineSyncRequest,
  OfflineSyncResponse 
} from '@vocilia/types';

const supabase = createClient();

export class OfflineQueueService {
  /**
   * Add submission data to offline queue
   */
  async queueSubmission(
    submissionData: OfflineSubmissionData,
    customerId?: string
  ): Promise<{ success: boolean; queueId?: string; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('offline_submission_queue')
        .insert({
          customer_id: customerId || null,
          submission_data: submissionData,
          status: 'pending' as OfflineSubmissionStatus,
          retry_count: 0,
          max_retries: 3
        })
        .select('id')
        .single();

      if (error) {
        console.error('Failed to queue offline submission:', error);
        return { success: false, error: error.message };
      }

      return { success: true, queueId: data.id };
    } catch (error) {
      console.error('Error queuing submission:', error);
      return { success: false, error: 'Failed to queue submission' };
    }
  }

  /**
   * Get pending submissions for sync
   */
  async getPendingSubmissions(
    limit: number = 50
  ): Promise<{ success: boolean; submissions?: OfflineSubmissionQueue[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('offline_submission_queue')
        .select('*')
        .in('status', ['pending', 'failed'])
        .or('next_retry_at.is.null,next_retry_at.lte.now()')
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) {
        console.error('Failed to get pending submissions:', error);
        return { success: false, error: error.message };
      }

      return { success: true, submissions: data || [] };
    } catch (error) {
      console.error('Error getting pending submissions:', error);
      return { success: false, error: 'Failed to get pending submissions' };
    }
  }

  /**
   * Update submission status after sync attempt
   */
  async updateSubmissionStatus(
    queueId: string,
    status: OfflineSubmissionStatus,
    errorMessage?: string,
    verificationId?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const updateData: any = {
        status,
        updated_at: new Date().toISOString()
      };

      if (status === 'synced') {
        updateData.synced_at = new Date().toISOString();
        updateData.error_message = null;
      } else if (status === 'failed') {
        updateData.retry_count = supabase.raw('retry_count + 1');
        updateData.error_message = errorMessage;
        // Calculate next retry time (exponential backoff)
        const nextRetry = new Date();
        nextRetry.setMinutes(nextRetry.getMinutes() + Math.pow(2, 3) * 5); // 5, 10, 20 minute delays
        updateData.next_retry_at = nextRetry.toISOString();
      }

      const { error } = await supabase
        .from('offline_submission_queue')
        .update(updateData)
        .eq('id', queueId);

      if (error) {
        console.error('Failed to update submission status:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error updating submission status:', error);
      return { success: false, error: 'Failed to update submission status' };
    }
  }

  /**
   * Get user's queued submissions
   */
  async getUserQueuedSubmissions(
    customerId: string
  ): Promise<{ success: boolean; submissions?: OfflineSubmissionQueue[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('offline_submission_queue')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to get user queued submissions:', error);
        return { success: false, error: error.message };
      }

      return { success: true, submissions: data || [] };
    } catch (error) {
      console.error('Error getting user queued submissions:', error);
      return { success: false, error: 'Failed to get user queued submissions' };
    }
  }

  /**
   * Clean up old completed/failed submissions
   */
  async cleanupOldSubmissions(
    olderThanDays: number = 30
  ): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const { data, error } = await supabase
        .from('offline_submission_queue')
        .delete()
        .in('status', ['synced', 'failed'])
        .lt('created_at', cutoffDate.toISOString())
        .select('id');

      if (error) {
        console.error('Failed to cleanup old submissions:', error);
        return { success: false, error: error.message };
      }

      return { success: true, deletedCount: data?.length || 0 };
    } catch (error) {
      console.error('Error cleaning up old submissions:', error);
      return { success: false, error: 'Failed to cleanup old submissions' };
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    success: boolean;
    stats?: {
      total_pending: number;
      total_synced: number;
      total_failed: number;
      oldest_pending: string | null;
    };
    error?: string;
  }> {
    try {
      const { data, error } = await supabase
        .rpc('get_offline_queue_stats');

      if (error) {
        console.error('Failed to get queue stats:', error);
        return { success: false, error: error.message };
      }

      return { success: true, stats: data };
    } catch (error) {
      console.error('Error getting queue stats:', error);
      return { success: false, error: 'Failed to get queue stats' };
    }
  }
}

// Export singleton instance
export const offlineQueueService = new OfflineQueueService();

// Export individual functions for compatibility
export const {
  queueSubmission,
  getPendingSubmissions,
  updateSubmissionStatus,
  getUserQueuedSubmissions,
  cleanupOldSubmissions,
  getQueueStats
} = offlineQueueService;