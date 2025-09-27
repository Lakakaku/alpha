export interface DeploymentStatus {
  deployment_id: string;
  environment_id: string;
  app_name: string;
  platform: 'railway' | 'vercel' | 'supabase';
  status: 'pending' | 'building' | 'deploying' | 'deployed' | 'failed' | 'rolled_back';
  version: string;
  commit_sha: string;
  started_at: Date;
  completed_at?: Date;
  build_logs?: string;
  deployment_url?: string;
  rollback_url?: string;
  health_status: 'healthy' | 'unhealthy' | 'unknown';
  created_at: Date;
  updated_at: Date;
}

export interface DeploymentMetrics {
  build_duration_ms?: number;
  deployment_duration_ms?: number;
  bundle_size_bytes?: number;
  memory_usage_mb?: number;
  cpu_usage_percent?: number;
}

export interface RollbackInfo {
  previous_deployment_id: string;
  rollback_reason: string;
  initiated_by: string;
  initiated_at: Date;
  completed_at?: Date;
  rollback_status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

export class DeploymentStatusModel {
  static validate(status: Partial<DeploymentStatus>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!status.deployment_id) {
      errors.push('deployment_id is required');
    }

    if (!status.environment_id) {
      errors.push('environment_id is required');
    }

    if (!status.app_name) {
      errors.push('app_name is required');
    }

    if (!status.platform || !['railway', 'vercel', 'supabase'].includes(status.platform)) {
      errors.push('platform must be railway, vercel, or supabase');
    }

    if (!status.status || !['pending', 'building', 'deploying', 'deployed', 'failed', 'rolled_back'].includes(status.status)) {
      errors.push('status must be pending, building, deploying, deployed, failed, or rolled_back');
    }

    if (!status.version) {
      errors.push('version is required');
    }

    if (!status.commit_sha) {
      errors.push('commit_sha is required');
    }

    if (!status.started_at) {
      errors.push('started_at is required');
    }

    if (!status.health_status || !['healthy', 'unhealthy', 'unknown'].includes(status.health_status)) {
      errors.push('health_status must be healthy, unhealthy, or unknown');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static calculateDuration(status: DeploymentStatus): number | null {
    if (!status.completed_at) return null;
    return status.completed_at.getTime() - status.started_at.getTime();
  }

  static isActive(status: DeploymentStatus): boolean {
    return ['pending', 'building', 'deploying'].includes(status.status);
  }

  static isCompleted(status: DeploymentStatus): boolean {
    return ['deployed', 'failed', 'rolled_back'].includes(status.status);
  }

  static requiresAttention(status: DeploymentStatus): boolean {
    if (status.status === 'failed') return true;
    if (status.health_status === 'unhealthy') return true;
    
    // Check if deployment is taking too long (>15 minutes)
    const maxDurationMs = 15 * 60 * 1000;
    const currentDuration = Date.now() - status.started_at.getTime();
    
    return this.isActive(status) && currentDuration > maxDurationMs;
  }

  static canRollback(status: DeploymentStatus): boolean {
    return status.status === 'deployed' && status.health_status !== 'healthy';
  }

  static getStatusPriority(status: string): number {
    const priorities = {
      'failed': 1,
      'pending': 2,
      'building': 3,
      'deploying': 4,
      'rolled_back': 5,
      'deployed': 6
    };
    return priorities[status as keyof typeof priorities] || 99;
  }

  static createFromPlatformData(platformData: any, environmentId: string): DeploymentStatus {
    const now = new Date();
    
    return {
      deployment_id: platformData.id || `deploy_${Date.now()}`,
      environment_id: environmentId,
      app_name: platformData.app_name || 'unknown',
      platform: platformData.platform || 'railway',
      status: platformData.status || 'pending',
      version: platformData.version || '1.0.0',
      commit_sha: platformData.commit_sha || 'unknown',
      started_at: platformData.started_at ? new Date(platformData.started_at) : now,
      completed_at: platformData.completed_at ? new Date(platformData.completed_at) : undefined,
      build_logs: platformData.build_logs,
      deployment_url: platformData.deployment_url,
      rollback_url: platformData.rollback_url,
      health_status: platformData.health_status || 'unknown',
      created_at: now,
      updated_at: now
    };
  }
}