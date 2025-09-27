import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types';

export interface TestCase {
  id: string;
  suiteId: string;
  name: string;
  description: string;
  type: 'contract' | 'unit' | 'integration' | 'e2e' | 'performance';
  filePath: string;
  testFunction: string;
  tags: string[];
  timeout: number;
  retries: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTestCaseRequest {
  suiteId: string;
  name: string;
  description: string;
  type: 'contract' | 'unit' | 'integration' | 'e2e' | 'performance';
  filePath: string;
  testFunction: string;
  tags?: string[];
  timeout?: number;
  retries?: number;
  enabled?: boolean;
}

export interface UpdateTestCaseRequest {
  name?: string;
  description?: string;
  type?: 'contract' | 'unit' | 'integration' | 'e2e' | 'performance';
  filePath?: string;
  testFunction?: string;
  tags?: string[];
  timeout?: number;
  retries?: number;
  enabled?: boolean;
}

export class TestCaseModel {
  constructor(private supabase: SupabaseClient<Database>) {}

  async create(data: CreateTestCaseRequest): Promise<TestCase> {
    const { data: testCase, error } = await this.supabase
      .from('test_cases')
      .insert({
        suite_id: data.suiteId,
        name: data.name,
        description: data.description,
        type: data.type,
        file_path: data.filePath,
        test_function: data.testFunction,
        tags: data.tags || [],
        timeout: data.timeout || 30000,
        retries: data.retries || 0,
        enabled: data.enabled ?? true,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create test case: ${error.message}`);
    }

    return this.mapToTestCase(testCase);
  }

  async findById(id: string): Promise<TestCase | null> {
    const { data: testCase, error } = await this.supabase
      .from('test_cases')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to find test case: ${error.message}`);
    }

    return this.mapToTestCase(testCase);
  }

  async findBySuiteId(suiteId: string): Promise<TestCase[]> {
    const { data: testCases, error } = await this.supabase
      .from('test_cases')
      .select('*')
      .eq('suite_id', suiteId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch test cases for suite: ${error.message}`);
    }

    return testCases?.map(testCase => this.mapToTestCase(testCase)) || [];
  }

  async findAll(params?: {
    suiteId?: string;
    type?: string;
    enabled?: boolean;
    tags?: string[];
    limit?: number;
    offset?: number;
  }): Promise<TestCase[]> {
    let query = this.supabase.from('test_cases').select('*');

    if (params?.suiteId) {
      query = query.eq('suite_id', params.suiteId);
    }
    if (params?.type) {
      query = query.eq('type', params.type);
    }
    if (params?.enabled !== undefined) {
      query = query.eq('enabled', params.enabled);
    }
    if (params?.tags && params.tags.length > 0) {
      query = query.overlaps('tags', params.tags);
    }
    if (params?.limit) {
      query = query.limit(params.limit);
    }
    if (params?.offset) {
      query = query.range(params.offset, (params.offset + (params.limit || 10)) - 1);
    }

    const { data: testCases, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch test cases: ${error.message}`);
    }

    return testCases?.map(testCase => this.mapToTestCase(testCase)) || [];
  }

  async update(id: string, data: UpdateTestCaseRequest): Promise<TestCase> {
    const updateData: any = {};
    
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.filePath !== undefined) updateData.file_path = data.filePath;
    if (data.testFunction !== undefined) updateData.test_function = data.testFunction;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.timeout !== undefined) updateData.timeout = data.timeout;
    if (data.retries !== undefined) updateData.retries = data.retries;
    if (data.enabled !== undefined) updateData.enabled = data.enabled;

    const { data: testCase, error } = await this.supabase
      .from('test_cases')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update test case: ${error.message}`);
    }

    return this.mapToTestCase(testCase);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('test_cases')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete test case: ${error.message}`);
    }
  }

  async findByType(type: 'contract' | 'unit' | 'integration' | 'e2e' | 'performance'): Promise<TestCase[]> {
    return this.findAll({ type, enabled: true });
  }

  async findByTags(tags: string[]): Promise<TestCase[]> {
    return this.findAll({ tags, enabled: true });
  }

  async findEnabled(): Promise<TestCase[]> {
    return this.findAll({ enabled: true });
  }

  private mapToTestCase(row: any): TestCase {
    return {
      id: row.id,
      suiteId: row.suite_id,
      name: row.name,
      description: row.description,
      type: row.type,
      filePath: row.file_path,
      testFunction: row.test_function,
      tags: row.tags || [],
      timeout: row.timeout,
      retries: row.retries,
      enabled: row.enabled,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}