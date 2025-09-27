import * as cron from 'node-cron';
import { createClient } from '@supabase/supabase-js';
import { loggingService } from '../services/loggingService.js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export const refreshMaterializedViewsJob = cron.schedule(
  '0 2 * * *', // Daily at 2 AM
  async () => {
    const startTime = Date.now();
    const jobId = `refresh-views-${startTime}`;
    
    try {
      await loggingService.logInfo(`Starting materialized view refresh job ${jobId}`);
      
      // Refresh store_reward_summary materialized view
      const { error } = await supabase.rpc('refresh_materialized_view', {
        view_name: 'store_reward_summary'
      });
      
      if (error) {
        throw error;
      }
      
      const duration = Date.now() - startTime;
      await loggingService.logInfo(
        `Materialized view refresh job ${jobId} completed successfully in ${duration}ms`
      );
      
    } catch (error) {
      const duration = Date.now() - startTime;
      await loggingService.logError(
        `Materialized view refresh job ${jobId} failed after ${duration}ms`,
        { error: error instanceof Error ? error.message : String(error) }
      );
      
      // Don't throw - let the job continue to run on schedule
      console.error('Materialized view refresh job failed:', error);
    }
  },
  {
    scheduled: false, // Don't start automatically - will be started manually
    timezone: 'Europe/Stockholm'
  }
);

export const startMaterializedViewRefreshJob = () => {
  refreshMaterializedViewsJob.start();
  console.log('Materialized view refresh job started (daily at 2 AM Europe/Stockholm)');
};

export const stopMaterializedViewRefreshJob = () => {
  refreshMaterializedViewsJob.stop();
  console.log('Materialized view refresh job stopped');
};