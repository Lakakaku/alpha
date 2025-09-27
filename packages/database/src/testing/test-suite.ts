import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types';

export interface TestSuite {
  id: string;
  name: string;
  type: 'unit' | 'integration' | 'e2e' | 'performance';
  component: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  coverageTarget: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTestSuiteRequest {
  name: string;
  type: 'unit' | 'integration' | 'e2e' | 'performance';
  component: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  coverageTarget: number;
  enabled?: boolean;
}

export interface UpdateTestSuiteRequest {
  name?: string;
  type?: 'unit' | 'integration' | 'e2e' | 'performance';
  component?: string;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  coverageTarget?: number;
  enabled?: boolean;
}

export class TestSuiteModel {
  constructor(private supabase: SupabaseClient<Database>) {}

  async create(data: CreateTestSuiteRequest): Promise<TestSuite> {
    const { data: suite, error } = await this.supabase
      .from('test_suites')
      .insert({
        name: data.name,
        type: data.type,
        component: data.component,
        priority: data.priority,
        coverage_target: data.coverageTarget,
        enabled: data.enabled ?? true,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create test suite: ${error.message}`);
    }

    return this.mapToTestSuite(suite);
  }

  async findById(id: string): Promise<TestSuite | null> {
    const { data: suite, error } = await this.supabase
      .from('test_suites')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to find test suite: ${error.message}`);
    }

    return this.mapToTestSuite(suite);
  }

  async findAll(params?: {
    type?: string;
    component?: string;
    enabled?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<TestSuite[]> {
    let query = this.supabase.from('test_suites').select('*');

    if (params?.type) {
      query = query.eq('type', params.type);
    }
    if (params?.component) {
      query = query.eq('component', params.component);
    }
    if (params?.enabled !== undefined) {
      query = query.eq('enabled', params.enabled);
    }
    if (params?.limit) {
      query = query.limit(params.limit);
    }
    if (params?.offset) {
      query = query.range(params.offset, (params.offset + (params.limit || 10)) - 1);
    }

    const { data: suites, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch test suites: ${error.message}`);
    }

    return suites?.map(suite => this.mapToTestSuite(suite)) || [];
  }

  async update(id: string, data: UpdateTestSuiteRequest): Promise<TestSuite> {
    const updateData: any = {};
    
    if (data.name !== undefined) updateData.name = data.name;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.component !== undefined) updateData.component = data.component;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.coverageTarget !== undefined) updateData.coverage_target = data.coverageTarget;
    if (data.enabled !== undefined) updateData.enabled = data.enabled;

    const { data: suite, error } = await this.supabase
      .from('test_suites')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update test suite: ${error.message}`);
    }

    return this.mapToTestSuite(suite);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('test_suites')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete test suite: ${error.message}`);
    }
  }

  async findByComponent(component: string): Promise<TestSuite[]> {
    return this.findAll({ component, enabled: true });
  }

  async findByType(type: 'unit' | 'integration' | 'e2e' | 'performance'): Promise<TestSuite[]> {
    return this.findAll({ type, enabled: true });
  }

  private mapToTestSuite(row: any): TestSuite {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      component: row.component,
      priority: row.priority,
      coverageTarget: row.coverage_target,
      enabled: row.enabled,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}