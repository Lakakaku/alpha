import { DeploymentStatus } from '../models/deployment-status';
import { supabase } from '@vocilia/database';
import { createLogger } from './loggingService';

const logger = createLogger('DeploymentStatusService');

export interface DeploymentRequest {
  application_name: 'backend' | 'customer' | 'business' | 'admin';
  version: string;
  environment: 'production' | 'staging' | 'development';
  deployment_platform: 'railway' | 'vercel';
  git_commit_hash: string;
  git_branch: string;
  triggered_by: string;
  deployment_config?: Record<string, any>;
}

export interface RollbackRequest {
  deployment_id: string;
  target_version: string;
  rollback_reason: string;
  triggered_by: string;
}

export interface DeploymentMetrics {
  total_deployments: number;
  successful_deployments: number;
  failed_deployments: number;
  average_duration_minutes: number;
  success_rate_percentage: number;
  rollback_rate_percentage: number;
  last_deployment_at: Date | null;
  last_successful_deployment_at: Date | null;
}

export interface DeploymentHealthCheck {
  deployment_id: string;
  is_healthy: boolean;
  health_score: number;
  response_time_ms: number;
  error_rate_percentage: number;
  uptime_percentage: number;
  last_health_check_at: Date;
  health_issues: string[];
}

export class DeploymentStatusService {
  private static readonly HEALTH_CHECK_INTERVAL_MS = 30000; // 30 seconds
  private static readonly ROLLBACK_TIMEOUT_MS = 900000; // 15 minutes
  private static readonly MAX_DEPLOYMENT_DURATION_MS = 1800000; // 30 minutes

  /**
   * Initiate a new deployment
   */
  static async initiateDeployment(request: DeploymentRequest): Promise<DeploymentStatus> {
    try {
      logger.info('Initiating deployment', { 
        application: request.application_name, 
        version: request.version,
        environment: request.environment,
        platform: request.deployment_platform,
        commit: request.git_commit_hash
      });

      // Check for existing in-progress deployments
      const existingDeployment = await this.getActiveDeployment(request.application_name, request.environment);
      if (existingDeployment) {
        throw new Error(`Deployment already in progress for ${request.application_name} in ${request.environment}: ${existingDeployment.id}`);
      }

      // Create deployment status record
      const deployment = await DeploymentStatus.create({
        application_name: request.application_name,
        version: request.version,
        environment: request.environment,
        deployment_platform: request.deployment_platform,
        status: 'in_progress',
        git_commit_hash: request.git_commit_hash,
        git_branch: request.git_branch,
        triggered_by: request.triggered_by,
        deployment_config: request.deployment_config || {},
        started_at: new Date(),
        created_at: new Date(),
        updated_at: new Date()
      });

      // Start deployment monitoring
      this.startDeploymentMonitoring(deployment.id);

      logger.info('Deployment initiated successfully', { 
        deployment_id: deployment.id, 
        application: request.application_name,
        version: request.version
      });

      return deployment;
    } catch (error) {
      logger.error('Failed to initiate deployment', { 
        application: request.application_name,
        version: request.version,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Update deployment status
   */
  static async updateDeploymentStatus(
    deploymentId: string, 
    status: 'in_progress' | 'completed' | 'failed' | 'rolled_back',
    additionalData?: {
      deployment_url?: string;
      error_message?: string;
      logs?: string;
      completed_at?: Date;
      rollback_completed_at?: Date;
    }
  ): Promise<DeploymentStatus> {
    try {
      const deployment = await DeploymentStatus.findById(deploymentId);
      if (!deployment) {
        throw new Error(`Deployment not found: ${deploymentId}`);
      }

      logger.info('Updating deployment status', { 
        deployment_id: deploymentId, 
        old_status: deployment.status,
        new_status: status 
      });

      // Calculate duration for completed deployments
      let duration_minutes: number | undefined;
      if (status === 'completed' || status === 'failed') {
        const endTime = additionalData?.completed_at || new Date();
        duration_minutes = (endTime.getTime() - deployment.started_at.getTime()) / (1000 * 60);
      }

      // Update deployment record
      const updatedDeployment = await DeploymentStatus.update(deploymentId, {
        status,
        deployment_url: additionalData?.deployment_url,
        error_message: additionalData?.error_message,
        logs: additionalData?.logs,
        duration_minutes,
        completed_at: additionalData?.completed_at,
        rollback_completed_at: additionalData?.rollback_completed_at,
        updated_at: new Date()
      });

      // Stop monitoring for completed deployments
      if (status === 'completed' || status === 'failed' || status === 'rolled_back') {
        this.stopDeploymentMonitoring(deploymentId);
      }

      // Trigger health checks for successful deployments
      if (status === 'completed' && additionalData?.deployment_url) {
        setTimeout(() => {
          this.startHealthChecks(deploymentId, additionalData.deployment_url!);
        }, 5000); // Wait 5 seconds for deployment to be ready
      }

      logger.info('Deployment status updated successfully', { 
        deployment_id: deploymentId, 
        status,
        duration_minutes 
      });

      return updatedDeployment;
    } catch (error) {
      logger.error('Failed to update deployment status', { 
        deployment_id: deploymentId, 
        status,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Initiate deployment rollback
   */
  static async initiateRollback(request: RollbackRequest): Promise<DeploymentStatus> {
    try {
      const deployment = await DeploymentStatus.findById(request.deployment_id);
      if (!deployment) {
        throw new Error(`Deployment not found: ${request.deployment_id}`);
      }

      if (deployment.status !== 'completed' && deployment.status !== 'failed') {
        throw new Error(`Cannot rollback deployment with status: ${deployment.status}`);
      }

      logger.info('Initiating deployment rollback', { 
        deployment_id: request.deployment_id, 
        target_version: request.target_version,
        reason: request.rollback_reason,
        triggered_by: request.triggered_by
      });

      // Find target deployment to rollback to
      const targetDeployment = await this.findDeploymentByVersion(
        deployment.application_name,
        deployment.environment,
        request.target_version
      );

      if (!targetDeployment) {
        throw new Error(`Target deployment version not found: ${request.target_version}`);
      }

      // Update current deployment status
      const rolledBackDeployment = await DeploymentStatus.update(request.deployment_id, {
        status: 'rolled_back',
        rollback_target_version: request.target_version,
        rollback_reason: request.rollback_reason,
        rollback_triggered_by: request.triggered_by,
        rollback_started_at: new Date(),
        updated_at: new Date()
      });

      // Start rollback monitoring
      this.startRollbackMonitoring(request.deployment_id, request.target_version);

      logger.info('Deployment rollback initiated successfully', { 
        deployment_id: request.deployment_id, 
        target_version: request.target_version
      });

      return rolledBackDeployment;
    } catch (error) {
      logger.error('Failed to initiate rollback', { 
        deployment_id: request.deployment_id, 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get deployment metrics for an application
   */
  static async getDeploymentMetrics(
    applicationName: string, 
    environment: string, 
    periodDays: number = 30
  ): Promise<DeploymentMetrics> {
    try {
      logger.info('Retrieving deployment metrics', { 
        application: applicationName, 
        environment, 
        period_days: periodDays 
      });

      const startDate = new Date(Date.now() - (periodDays * 24 * 60 * 60 * 1000));

      const { data, error } = await supabase
        .from('deployment_status')
        .select('*')
        .eq('application_name', applicationName)
        .eq('environment', environment)
        .gte('started_at', startDate.toISOString())
        .order('started_at', { ascending: false });

      if (error) {
        throw error;
      }

      const deployments = data || [];
      const total_deployments = deployments.length;
      const successful_deployments = deployments.filter(d => d.status === 'completed').length;
      const failed_deployments = deployments.filter(d => d.status === 'failed').length;
      const rollbacks = deployments.filter(d => d.status === 'rolled_back').length;

      // Calculate average duration
      const completedDeployments = deployments.filter(d => d.duration_minutes);
      const average_duration_minutes = completedDeployments.length > 0
        ? completedDeployments.reduce((sum, d) => sum + (d.duration_minutes || 0), 0) / completedDeployments.length
        : 0;

      // Calculate success rate
      const success_rate_percentage = total_deployments > 0 
        ? (successful_deployments / total_deployments) * 100 
        : 0;

      // Calculate rollback rate
      const rollback_rate_percentage = total_deployments > 0 
        ? (rollbacks / total_deployments) * 100 
        : 0;

      // Get last deployment dates
      const last_deployment_at = deployments.length > 0 ? new Date(deployments[0].started_at) : null;
      const successfulDeployments = deployments.filter(d => d.status === 'completed');
      const last_successful_deployment_at = successfulDeployments.length > 0 
        ? new Date(successfulDeployments[0].started_at) 
        : null;

      const metrics: DeploymentMetrics = {
        total_deployments,
        successful_deployments,
        failed_deployments,
        average_duration_minutes: Math.round(average_duration_minutes * 100) / 100,
        success_rate_percentage: Math.round(success_rate_percentage * 100) / 100,
        rollback_rate_percentage: Math.round(rollback_rate_percentage * 100) / 100,
        last_deployment_at,
        last_successful_deployment_at
      };

      logger.info('Deployment metrics retrieved', { 
        application: applicationName, 
        environment,
        metrics 
      });

      return metrics;
    } catch (error) {
      logger.error('Failed to get deployment metrics', { 
        application: applicationName, 
        environment,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get deployment health status
   */
  static async getDeploymentHealth(deploymentId: string): Promise<DeploymentHealthCheck | null> {
    try {
      const deployment = await DeploymentStatus.findById(deploymentId);
      if (!deployment || deployment.status !== 'completed' || !deployment.deployment_url) {
        return null;
      }

      logger.info('Checking deployment health', { deployment_id: deploymentId, url: deployment.deployment_url });

      // Perform health checks
      const healthChecks = await this.performHealthChecks(deployment.deployment_url);

      const healthCheck: DeploymentHealthCheck = {
        deployment_id: deploymentId,
        is_healthy: healthChecks.response_time_ms < 5000 && healthChecks.error_rate_percentage < 1,
        health_score: this.calculateHealthScore(healthChecks),
        response_time_ms: healthChecks.response_time_ms,
        error_rate_percentage: healthChecks.error_rate_percentage,
        uptime_percentage: healthChecks.uptime_percentage,
        last_health_check_at: new Date(),
        health_issues: healthChecks.issues
      };

      logger.info('Deployment health check completed', { 
        deployment_id: deploymentId, 
        is_healthy: healthCheck.is_healthy,
        health_score: healthCheck.health_score 
      });

      return healthCheck;
    } catch (error) {
      logger.error('Failed to check deployment health', { 
        deployment_id: deploymentId, 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Get recent deployments
   */
  static async getRecentDeployments(limit: number = 10): Promise<DeploymentStatus[]> {
    try {
      logger.info('Retrieving recent deployments', { limit });

      const { data, error } = await supabase
        .from('deployment_status')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      const deployments = data?.map(deployment => DeploymentStatus.fromDatabase(deployment)) || [];
      
      logger.info('Recent deployments retrieved', { count: deployments.length });
      
      return deployments;
    } catch (error) {
      logger.error('Failed to get recent deployments', { 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private static async getActiveDeployment(applicationName: string, environment: string): Promise<DeploymentStatus | null> {
    const { data, error } = await supabase
      .from('deployment_status')
      .select('*')
      .eq('application_name', applicationName)
      .eq('environment', environment)
      .eq('status', 'in_progress')
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw error;
    }

    return data ? DeploymentStatus.fromDatabase(data) : null;
  }

  private static async findDeploymentByVersion(
    applicationName: string, 
    environment: string, 
    version: string
  ): Promise<DeploymentStatus | null> {
    const { data, error } = await supabase
      .from('deployment_status')
      .select('*')
      .eq('application_name', applicationName)
      .eq('environment', environment)
      .eq('version', version)
      .eq('status', 'completed')
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return data ? DeploymentStatus.fromDatabase(data) : null;
  }

  private static startDeploymentMonitoring(deploymentId: string): void {
    // Implementation would start monitoring deployment progress
    logger.info('Started deployment monitoring', { deployment_id: deploymentId });
    
    // Set timeout for maximum deployment duration
    setTimeout(async () => {
      const deployment = await DeploymentStatus.findById(deploymentId);
      if (deployment && deployment.status === 'in_progress') {
        await this.updateDeploymentStatus(deploymentId, 'failed', {
          error_message: 'Deployment timed out after 30 minutes',
          completed_at: new Date()
        });
      }
    }, this.MAX_DEPLOYMENT_DURATION_MS);
  }

  private static stopDeploymentMonitoring(deploymentId: string): void {
    // Implementation would stop monitoring deployment progress
    logger.info('Stopped deployment monitoring', { deployment_id: deploymentId });
  }

  private static startRollbackMonitoring(deploymentId: string, targetVersion: string): void {
    // Implementation would monitor rollback progress
    logger.info('Started rollback monitoring', { deployment_id: deploymentId, target_version: targetVersion });

    // Set timeout for rollback completion
    setTimeout(async () => {
      const deployment = await DeploymentStatus.findById(deploymentId);
      if (deployment && !deployment.rollback_completed_at) {
        await DeploymentStatus.update(deploymentId, {
          rollback_completed_at: new Date(),
          error_message: 'Rollback timed out after 15 minutes',
          updated_at: new Date()
        });
      }
    }, this.ROLLBACK_TIMEOUT_MS);
  }

  private static startHealthChecks(deploymentId: string, deploymentUrl: string): void {
    // Implementation would start periodic health checks
    logger.info('Started health checks', { deployment_id: deploymentId, url: deploymentUrl });
  }

  private static async performHealthChecks(url: string): Promise<{
    response_time_ms: number;
    error_rate_percentage: number;
    uptime_percentage: number;
    issues: string[];
  }> {
    // Mock implementation - would perform actual health checks
    return {
      response_time_ms: Math.floor(Math.random() * 1000) + 200,
      error_rate_percentage: Math.random() * 2,
      uptime_percentage: 99.5 + (Math.random() * 0.5),
      issues: []
    };
  }

  private static calculateHealthScore(healthMetrics: {
    response_time_ms: number;
    error_rate_percentage: number;
    uptime_percentage: number;
  }): number {
    let score = 100;

    // Penalize slow response times
    if (healthMetrics.response_time_ms > 2000) {
      score -= (healthMetrics.response_time_ms - 2000) / 100;
    }

    // Penalize error rates
    score -= healthMetrics.error_rate_percentage * 10;

    // Penalize downtime
    score -= (100 - healthMetrics.uptime_percentage) * 5;

    return Math.max(0, Math.min(100, Math.round(score)));
  }
}

export default DeploymentStatusService;