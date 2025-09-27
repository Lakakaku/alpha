import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types';

export interface TestRun {
  id: string;
  triggerType: 'commit' | 'pull-request' | 'scheduled' | 'manual';
  triggerReference: string;
  branch: string;
  environmentId: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'cancelled';
  startedAt: string;
  completedAt: string | null;
  duration: number | null;
  coverage: {
    overall: number;
    unit: number;
    integration: number;
  };
  performanceMetrics: {
    apiResponseTime: number;
    pageLoadTime: number;
    errorRate: number;
  };
  metadata: Record<string, any>;
  createdAt: string;
}

export interface CreateTestRunRequest {
  triggerType: 'commit' | 'pull-request' | 'scheduled' | 'manual';
  triggerReference: string;
  branch: string;
  environmentId: string;
  metadata?: Record<string, any>;
}

export interface UpdateTestRunRequest {
  status?: 'pending' | 'running' | 'passed' | 'failed' | 'cancelled';
  startedAt?: string;
  completedAt?: string;
  duration?: number;
  coverage?: {
    overall: number;
    unit: number;
    integration: number;
  };
  performanceMetrics?: {
    apiResponseTime: number;
    pageLoadTime: number;
    errorRate: number;
  };
  metadata?: Record<string, any>;
}

export class TestRunModel {
  constructor(private supabase: SupabaseClient<Database>) {}

  async create(data: CreateTestRunRequest): Promise<TestRun> {
    const { data: testRun, error } = await this.supabase
      .from('test_runs')
      .insert({
        trigger_type: data.triggerType,
        trigger_reference: data.triggerReference,
        branch: data.branch,
        environment_id: data.environmentId,
        status: 'pending',
        coverage: { overall: 0, unit: 0, integration: 0 },
        performance_metrics: { apiResponseTime: 0, pageLoadTime: 0, errorRate: 0 },
        metadata: data.metadata || {},
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create test run: ${error.message}`);
    }

    return this.mapToTestRun(testRun);
  }

  async findById(id: string): Promise<TestRun | null> {
    const { data: testRun, error } = await this.supabase
      .from('test_runs')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to find test run: ${error.message}`);
    }

    return this.mapToTestRun(testRun);
  }

  async findAll(params?: {
    triggerType?: string;
    branch?: string;
    status?: string;
    environmentId?: string;
    limit?: number;
    offset?: number;
  }): Promise<TestRun[]> {
    let query = this.supabase.from('test_runs').select('*');

    if (params?.triggerType) {
      query = query.eq('trigger_type', params.triggerType);
    }
    if (params?.branch) {
      query = query.eq('branch', params.branch);
    }
    if (params?.status) {
      query = query.eq('status', params.status);
    }
    if (params?.environmentId) {
      query = query.eq('environment_id', params.environmentId);
    }
    if (params?.limit) {
      query = query.limit(params.limit);
    }
    if (params?.offset) {
      query = query.range(params.offset, (params.offset + (params.limit || 10)) - 1);
    }

    const { data: testRuns, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch test runs: ${error.message}`);
    }

    return testRuns?.map(testRun => this.mapToTestRun(testRun)) || [];
  }

  async update(id: string, data: UpdateTestRunRequest): Promise<TestRun> {
    const updateData: any = {};
    
    if (data.status !== undefined) updateData.status = data.status;
    if (data.startedAt !== undefined) updateData.started_at = data.startedAt;
    if (data.completedAt !== undefined) updateData.completed_at = data.completedAt;
    if (data.duration !== undefined) updateData.duration = data.duration;
    if (data.coverage !== undefined) updateData.coverage = data.coverage;
    if (data.performanceMetrics !== undefined) updateData.performance_metrics = data.performanceMetrics;
    if (data.metadata !== undefined) updateData.metadata = data.metadata;

    const { data: testRun, error } = await this.supabase
      .from('test_runs')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update test run: ${error.message}`);
    }

    return this.mapToTestRun(testRun);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('test_runs')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete test run: ${error.message}`);
    }
  }

  async findByBranch(branch: string): Promise<TestRun[]> {
    return this.findAll({ branch });
  }

  async findByStatus(status: 'pending' | 'running' | 'passed' | 'failed' | 'cancelled'): Promise<TestRun[]> {
    return this.findAll({ status });
  }

  async findRecent(limit: number = 10): Promise<TestRun[]> {
    return this.findAll({ limit });
  }

  async startRun(id: string): Promise<TestRun> {
    return this.update(id, {
      status: 'running',
      startedAt: new Date().toISOString(),
    });
  }

  async completeRun(id: string, success: boolean, coverage?: TestRun['coverage'], performanceMetrics?: TestRun['performanceMetrics']): Promise<TestRun> {
    const completedAt = new Date().toISOString();
    const testRun = await this.findById(id);
    
    if (!testRun) {
      throw new Error('Test run not found');
    }

    const duration = testRun.startedAt 
      ? new Date(completedAt).getTime() - new Date(testRun.startedAt).getTime()
      : null;

    return this.update(id, {
      status: success ? 'passed' : 'failed',
      completedAt,
      duration,
      coverage,
      performanceMetrics,
    });
  }

  async cancelRun(id: string): Promise<TestRun> {
    return this.update(id, {
      status: 'cancelled',
      completedAt: new Date().toISOString(),
    });
  }

  private mapToTestRun(row: any): TestRun {
    return {
      id: row.id,
      triggerType: row.trigger_type,
      triggerReference: row.trigger_reference,
      branch: row.branch,
      environmentId: row.environment_id,
      status: row.status,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      duration: row.duration,
      coverage: row.coverage,
      performanceMetrics: row.performance_metrics,
      metadata: row.metadata || {},
      createdAt: row.created_at,
    };
  }
}