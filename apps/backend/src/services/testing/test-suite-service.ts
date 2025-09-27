import { TestSuite, TestCase, CreateTestSuiteRequest, UpdateTestSuiteRequest } from '@vocilia/types/testing';
import { TestSuiteModel, TestCaseModel } from '@vocilia/database/testing';
import { v4 as uuidv4 } from 'uuid';

export class TestSuiteService {
  private testSuiteModel: TestSuiteModel;
  private testCaseModel: TestCaseModel;

  constructor() {
    this.testSuiteModel = new TestSuiteModel();
    this.testCaseModel = new TestCaseModel();
  }

  async createTestSuite(data: CreateTestSuiteRequest): Promise<TestSuite> {
    const testSuite: TestSuite = {
      id: uuidv4(),
      name: data.name,
      description: data.description,
      category: data.category,
      tags: data.tags || [],
      status: 'active',
      priority: data.priority || 'medium',
      timeout: data.timeout || 30000,
      retryCount: data.retryCount || 3,
      environment: data.environment || 'test',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: data.created_by
    };

    const created = await this.testSuiteModel.create(testSuite);
    
    // Create test cases if provided
    if (data.testCases && data.testCases.length > 0) {
      for (const testCaseData of data.testCases) {
        const testCase: TestCase = {
          id: uuidv4(),
          suite_id: created.id,
          name: testCaseData.name,
          description: testCaseData.description,
          test_type: testCaseData.test_type,
          expected_result: testCaseData.expected_result,
          test_data: testCaseData.test_data || {},
          assertions: testCaseData.assertions || [],
          setup_script: testCaseData.setup_script,
          teardown_script: testCaseData.teardown_script,
          timeout: testCaseData.timeout || 10000,
          priority: testCaseData.priority || 'medium',
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        await this.testCaseModel.create(testCase);
      }
    }

    return this.getTestSuiteById(created.id);
  }

  async getTestSuites(
    category?: string,
    status?: string,
    environment?: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ suites: TestSuite[]; total: number }> {
    const filters = {};
    if (category) filters['category'] = category;
    if (status) filters['status'] = status;
    if (environment) filters['environment'] = environment;

    const { data, total } = await this.testSuiteModel.findMany(filters, limit, offset);
    
    // Get test cases for each suite
    const suitesWithCases = await Promise.all(
      data.map(async (suite) => {
        const testCases = await this.testCaseModel.findBySuiteId(suite.id);
        return { ...suite, testCases };
      })
    );

    return { suites: suitesWithCases, total };
  }

  async getTestSuiteById(id: string): Promise<TestSuite> {
    const suite = await this.testSuiteModel.findById(id);
    if (!suite) {
      throw new Error(`Test suite with ID ${id} not found`);
    }

    const testCases = await this.testCaseModel.findBySuiteId(id);
    return { ...suite, testCases };
  }

  async updateTestSuite(id: string, data: UpdateTestSuiteRequest): Promise<TestSuite> {
    const existing = await this.testSuiteModel.findById(id);
    if (!existing) {
      throw new Error(`Test suite with ID ${id} not found`);
    }

    const updated: Partial<TestSuite> = {
      ...data,
      updated_at: new Date().toISOString()
    };

    await this.testSuiteModel.update(id, updated);
    return this.getTestSuiteById(id);
  }

  async deleteTestSuite(id: string): Promise<void> {
    const existing = await this.testSuiteModel.findById(id);
    if (!existing) {
      throw new Error(`Test suite with ID ${id} not found`);
    }

    // Delete all test cases first
    await this.testCaseModel.deleteBySuiteId(id);
    
    // Then delete the suite
    await this.testSuiteModel.delete(id);
  }

  async duplicateTestSuite(id: string, newName: string): Promise<TestSuite> {
    const original = await this.getTestSuiteById(id);
    
    const duplicateData: CreateTestSuiteRequest = {
      name: newName,
      description: `Copy of ${original.description}`,
      category: original.category,
      tags: [...original.tags],
      priority: original.priority,
      timeout: original.timeout,
      retryCount: original.retryCount,
      environment: original.environment,
      created_by: original.created_by,
      testCases: original.testCases?.map(tc => ({
        name: tc.name,
        description: tc.description,
        test_type: tc.test_type,
        expected_result: tc.expected_result,
        test_data: tc.test_data,
        assertions: tc.assertions,
        setup_script: tc.setup_script,
        teardown_script: tc.teardown_script,
        timeout: tc.timeout,
        priority: tc.priority
      }))
    };

    return this.createTestSuite(duplicateData);
  }

  async getTestSuitesByCategory(category: string): Promise<TestSuite[]> {
    const { suites } = await this.getTestSuites(category);
    return suites;
  }

  async searchTestSuites(query: string): Promise<TestSuite[]> {
    const allSuites = await this.testSuiteModel.search(query);
    
    // Get test cases for each suite
    const suitesWithCases = await Promise.all(
      allSuites.map(async (suite) => {
        const testCases = await this.testCaseModel.findBySuiteId(suite.id);
        return { ...suite, testCases };
      })
    );

    return suitesWithCases;
  }
}