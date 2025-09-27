import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types';

export interface TestResult {
  id: string;
  testRunId: string;
  testCaseId: string;
  status: 'passed' | 'failed' | 'skipped' | 'timeout' | 'error';
  duration: number;
  errorMessage: string | null;
  stackTrace: string | null;
  screenshots: string[];
  logs: string;
  assertions: {
    total: number;
    passed: number;
    failed: number;
  };
  coverage: Record<string, any>;
  performanceData: Record<string, any>;
  retryAttempt: number;
  createdAt: string;
}

export interface CreateTestResultRequest {
  testRunId: string;
  testCaseId: string;
  status: 'passed' | 'failed' | 'skipped' | 'timeout' | 'error';
  duration: number;
  errorMessage?: string;
  stackTrace?: string;
  screenshots?: string[];
  logs?: string;
  assertions?: {
    total: number;
    passed: number;
    failed: number;
  };
  coverage?: Record<string, any>;
  performanceData?: Record<string, any>;
  retryAttempt?: number;
}

export interface UpdateTestResultRequest {
  status?: 'passed' | 'failed' | 'skipped' | 'timeout' | 'error';
  duration?: number;
  errorMessage?: string;
  stackTrace?: string;
  screenshots?: string[];
  logs?: string;
  assertions?: {
    total: number;
    passed: number;
    failed: number;
  };
  coverage?: Record<string, any>;
  performanceData?: Record<string, any>;
  retryAttempt?: number;
}

export class TestResultModel {
  constructor(private supabase: SupabaseClient<Database>) {}

  async create(data: CreateTestResultRequest): Promise<TestResult> {
    const { data: testResult, error } = await this.supabase
      .from('test_results')
      .insert({
        test_run_id: data.testRunId,
        test_case_id: data.testCaseId,
        status: data.status,
        duration: data.duration,
        error_message: data.errorMessage || null,
        stack_trace: data.stackTrace || null,
        screenshots: data.screenshots || [],
        logs: data.logs || '',
        assertions: data.assertions || { total: 0, passed: 0, failed: 0 },
        coverage: data.coverage || {},
        performance_data: data.performanceData || {},
        retry_attempt: data.retryAttempt || 0,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create test result: ${error.message}`);
    }

    return this.mapToTestResult(testResult);
  }

  async findById(id: string): Promise<TestResult | null> {
    const { data: testResult, error } = await this.supabase
      .from('test_results')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to find test result: ${error.message}`);
    }

    return this.mapToTestResult(testResult);
  }

  async findByTestRunId(testRunId: string): Promise<TestResult[]> {
    const { data: testResults, error } = await this.supabase
      .from('test_results')
      .select('*')
      .eq('test_run_id', testRunId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch test results for run: ${error.message}`);
    }

    return testResults?.map(result => this.mapToTestResult(result)) || [];
  }

  async findByTestCaseId(testCaseId: string): Promise<TestResult[]> {
    const { data: testResults, error } = await this.supabase
      .from('test_results')
      .select('*')
      .eq('test_case_id', testCaseId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch test results for case: ${error.message}`);
    }

    return testResults?.map(result => this.mapToTestResult(result)) || [];
  }

  async findAll(params?: {
    testRunId?: string;
    testCaseId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<TestResult[]> {
    let query = this.supabase.from('test_results').select('*');

    if (params?.testRunId) {
      query = query.eq('test_run_id', params.testRunId);
    }
    if (params?.testCaseId) {
      query = query.eq('test_case_id', params.testCaseId);
    }
    if (params?.status) {
      query = query.eq('status', params.status);
    }
    if (params?.limit) {
      query = query.limit(params.limit);
    }
    if (params?.offset) {
      query = query.range(params.offset, (params.offset + (params.limit || 10)) - 1);
    }

    const { data: testResults, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch test results: ${error.message}`);
    }

    return testResults?.map(result => this.mapToTestResult(result)) || [];
  }

  async update(id: string, data: UpdateTestResultRequest): Promise<TestResult> {
    const updateData: any = {};
    
    if (data.status !== undefined) updateData.status = data.status;
    if (data.duration !== undefined) updateData.duration = data.duration;
    if (data.errorMessage !== undefined) updateData.error_message = data.errorMessage;
    if (data.stackTrace !== undefined) updateData.stack_trace = data.stackTrace;
    if (data.screenshots !== undefined) updateData.screenshots = data.screenshots;
    if (data.logs !== undefined) updateData.logs = data.logs;
    if (data.assertions !== undefined) updateData.assertions = data.assertions;
    if (data.coverage !== undefined) updateData.coverage = data.coverage;
    if (data.performanceData !== undefined) updateData.performance_data = data.performanceData;
    if (data.retryAttempt !== undefined) updateData.retry_attempt = data.retryAttempt;

    const { data: testResult, error } = await this.supabase
      .from('test_results')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update test result: ${error.message}`);
    }

    return this.mapToTestResult(testResult);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('test_results')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete test result: ${error.message}`);
    }
  }

  async findFailedResults(testRunId: string): Promise<TestResult[]> {
    return this.findAll({
      testRunId,
      status: 'failed',
    });
  }

  async findPassedResults(testRunId: string): Promise<TestResult[]> {
    return this.findAll({
      testRunId,
      status: 'passed',
    });
  }

  async getTestRunSummary(testRunId: string): Promise<{
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    timeout: number;
    error: number;
    passRate: number;
  }> {
    const results = await this.findByTestRunId(testRunId);
    
    const summary = {
      total: results.length,
      passed: results.filter(r => r.status === 'passed').length,
      failed: results.filter(r => r.status === 'failed').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      timeout: results.filter(r => r.status === 'timeout').length,
      error: results.filter(r => r.status === 'error').length,
      passRate: 0,
    };

    summary.passRate = summary.total > 0 ? (summary.passed / summary.total) * 100 : 0;

    return summary;
  }

  async findRecentFailures(limit: number = 10): Promise<TestResult[]> {
    return this.findAll({
      status: 'failed',
      limit,
    });
  }

  private mapToTestResult(row: any): TestResult {
    return {
      id: row.id,
      testRunId: row.test_run_id,
      testCaseId: row.test_case_id,
      status: row.status,
      duration: row.duration,
      errorMessage: row.error_message,
      stackTrace: row.stack_trace,
      screenshots: row.screenshots || [],
      logs: row.logs || '',
      assertions: row.assertions || { total: 0, passed: 0, failed: 0 },
      coverage: row.coverage || {},
      performanceData: row.performance_data || {},
      retryAttempt: row.retry_attempt || 0,
      createdAt: row.created_at,
    };
  }
}