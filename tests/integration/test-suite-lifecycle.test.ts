import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { TestSuiteService } from '../../apps/backend/src/services/testing/test-suite-service';
import { TestRunService } from '../../apps/backend/src/services/testing/test-run-service';
import { TestOrchestrator } from '../../apps/backend/src/testing/test-orchestrator';
import { supabase } from '../setup';

describe('Test Suite Lifecycle Integration', () => {
  let testSuiteService: TestSuiteService;
  let testRunService: TestRunService;
  let orchestrator: TestOrchestrator;
  let testSuiteId: string;
  let testRunId: string;

  beforeAll(async () => {
    testSuiteService = new TestSuiteService();
    testRunService = new TestRunService();
    orchestrator = new TestOrchestrator();
  });

  beforeEach(async () => {
    // Clean up any existing test data
    await supabase.from('test_results').delete().neq('id', '');
    await supabase.from('test_runs').delete().neq('id', '');
    await supabase.from('test_suites').delete().neq('id', '');
  });

  afterEach(async () => {
    // Clean up test data after each test
    if (testRunId) {
      await supabase.from('test_results').delete().eq('test_run_id', testRunId);
      await supabase.from('test_runs').delete().eq('id', testRunId);
    }
    if (testSuiteId) {
      await supabase.from('test_suites').delete().eq('id', testSuiteId);
    }
  });

  afterAll(async () => {
    // Final cleanup
    await supabase.from('test_results').delete().neq('id', '');
    await supabase.from('test_runs').delete().neq('id', '');
    await supabase.from('test_suites').delete().neq('id', '');
  });

  describe('Complete Test Suite Lifecycle', () => {
    it('should create, configure, execute, and report on a test suite', async () => {
      // Phase 1: Create Test Suite
      const suiteData = {
        name: 'Customer QR Code Unit Tests',
        type: 'unit' as const,
        component: 'customer-app',
        priority: 'high' as const,
        coverageTarget: 85,
        enabled: true
      };

      const createdSuite = await testSuiteService.createTestSuite(suiteData);
      testSuiteId = createdSuite.id;

      expect(createdSuite).toMatchObject({
        name: suiteData.name,
        type: suiteData.type,
        component: suiteData.component,
        priority: suiteData.priority,
        coverageTarget: suiteData.coverageTarget,
        enabled: suiteData.enabled
      });
      expect(createdSuite.id).toBeDefined();
      expect(createdSuite.createdAt).toBeDefined();

      // Phase 2: Retrieve and Verify Suite
      const retrievedSuite = await testSuiteService.getTestSuiteById(testSuiteId);
      expect(retrievedSuite).toMatchObject(createdSuite);

      // Phase 3: Update Suite Configuration
      const updateData = {
        coverageTarget: 90,
        priority: 'critical' as const
      };

      const updatedSuite = await testSuiteService.updateTestSuite(testSuiteId, updateData);
      expect(updatedSuite?.coverageTarget).toBe(90);
      expect(updatedSuite?.priority).toBe('critical');

      // Phase 4: Create Test Run for Suite
      const runData = {
        triggerType: 'manual' as const,
        triggerReference: 'integration-test',
        branch: 'test-branch',
        environmentId: 'test-env-1',
        suiteIds: [testSuiteId]
      };

      const createdRun = await testRunService.createTestRun(runData);
      testRunId = createdRun.id;

      expect(createdRun).toMatchObject({
        triggerType: runData.triggerType,
        triggerReference: runData.triggerReference,
        branch: runData.branch,
        environmentId: runData.environmentId,
        status: 'pending'
      });

      // Phase 5: Execute Test Run (mock execution)
      await testRunService.updateTestRun(testRunId, {
        status: 'running',
        startedAt: new Date()
      });

      // Simulate test execution results
      const testResults = [
        {
          testRunId: testRunId,
          testCaseId: 'qr-generation-test',
          status: 'passed' as const,
          duration: 150,
          assertions: { total: 5, passed: 5, failed: 0 }
        },
        {
          testRunId: testRunId,
          testCaseId: 'qr-validation-test',
          status: 'passed' as const,
          duration: 200,
          assertions: { total: 3, passed: 3, failed: 0 }
        },
        {
          testRunId: testRunId,
          testCaseId: 'qr-error-handling-test',
          status: 'failed' as const,
          duration: 100,
          errorMessage: 'Expected error not thrown',
          assertions: { total: 2, passed: 1, failed: 1 }
        }
      ];

      // Store test results
      for (const result of testResults) {
        await testRunService.createTestResult(result);
      }

      // Phase 6: Complete Test Run
      const coverage = {
        overall: 87.5,
        files: 12,
        coveredFiles: 10
      };

      await testRunService.updateTestRun(testRunId, {
        status: 'failed', // One test failed
        completedAt: new Date(),
        duration: 450,
        coverage: coverage
      });

      // Phase 7: Retrieve and Validate Final Results
      const finalRun = await testRunService.getTestRunById(testRunId);
      expect(finalRun?.status).toBe('failed');
      expect(finalRun?.duration).toBe(450);
      expect(finalRun?.coverage).toMatchObject(coverage);

      const { results: runResults } = await testRunService.getTestResults(testRunId, {}, { page: 1, limit: 10 });
      expect(runResults).toHaveLength(3);
      expect(runResults.filter(r => r.status === 'passed')).toHaveLength(2);
      expect(runResults.filter(r => r.status === 'failed')).toHaveLength(1);

      // Phase 8: Verify Suite Statistics
      const suiteStats = await testSuiteService.getSuiteStatistics(testSuiteId);
      expect(suiteStats.totalRuns).toBe(1);
      expect(suiteStats.lastRun?.status).toBe('failed');
      expect(suiteStats.averageCoverage).toBe(87.5);
    });

    it('should handle suite deletion and cleanup', async () => {
      // Create a test suite
      const suiteData = {
        name: 'Temporary Test Suite',
        type: 'unit' as const,
        component: 'test-component',
        priority: 'low' as const,
        coverageTarget: 70,
        enabled: false
      };

      const createdSuite = await testSuiteService.createTestSuite(suiteData);
      testSuiteId = createdSuite.id;

      // Verify suite exists
      const retrievedSuite = await testSuiteService.getTestSuiteById(testSuiteId);
      expect(retrievedSuite).toBeTruthy();

      // Delete the suite
      const deleted = await testSuiteService.deleteTestSuite(testSuiteId);
      expect(deleted).toBe(true);

      // Verify suite is deleted
      const deletedSuite = await testSuiteService.getTestSuiteById(testSuiteId);
      expect(deletedSuite).toBeNull();

      // Reset testSuiteId so cleanup doesn't fail
      testSuiteId = '';
    });

    it('should handle concurrent test runs on the same suite', async () => {
      // Create a test suite
      const suiteData = {
        name: 'Concurrent Test Suite',
        type: 'integration' as const,
        component: 'backend-api',
        priority: 'medium' as const,
        coverageTarget: 80,
        enabled: true
      };

      const createdSuite = await testSuiteService.createTestSuite(suiteData);
      testSuiteId = createdSuite.id;

      // Create multiple test runs for the same suite
      const runPromises = Array.from({ length: 3 }, (_, i) => 
        testRunService.createTestRun({
          triggerType: 'manual',
          triggerReference: `concurrent-test-${i}`,
          branch: 'test-branch',
          environmentId: 'test-env-1',
          suiteIds: [testSuiteId]
        })
      );

      const runs = await Promise.all(runPromises);
      expect(runs).toHaveLength(3);

      // All runs should be created successfully
      for (const run of runs) {
        expect(run.id).toBeDefined();
        expect(run.status).toBe('pending');
      }

      // Clean up runs
      for (const run of runs) {
        await supabase.from('test_runs').delete().eq('id', run.id);
      }
    });

    it('should validate suite configuration constraints', async () => {
      // Test invalid coverage target
      const invalidSuiteData = {
        name: 'Invalid Suite',
        type: 'unit' as const,
        component: 'test-component',
        priority: 'high' as const,
        coverageTarget: 150, // Invalid - over 100%
        enabled: true
      };

      await expect(
        testSuiteService.createTestSuite(invalidSuiteData)
      ).rejects.toThrow();

      // Test empty name
      const emptySuiteData = {
        name: '',
        type: 'unit' as const,
        component: 'test-component',
        priority: 'high' as const,
        coverageTarget: 80,
        enabled: true
      };

      await expect(
        testSuiteService.createTestSuite(emptySuiteData)
      ).rejects.toThrow();
    });

    it('should track suite performance over multiple runs', async () => {
      // Create a test suite
      const suiteData = {
        name: 'Performance Tracking Suite',
        type: 'unit' as const,
        component: 'customer-app',
        priority: 'high' as const,
        coverageTarget: 85,
        enabled: true
      };

      const createdSuite = await testSuiteService.createTestSuite(suiteData);
      testSuiteId = createdSuite.id;

      // Create multiple test runs with different outcomes
      const runData = [
        { status: 'passed', coverage: 90, duration: 1000 },
        { status: 'passed', coverage: 88, duration: 1200 },
        { status: 'failed', coverage: 85, duration: 800 },
        { status: 'passed', coverage: 92, duration: 1100 }
      ];

      const runIds: string[] = [];

      for (const [index, data] of runData.entries()) {
        const run = await testRunService.createTestRun({
          triggerType: 'manual',
          triggerReference: `perf-test-${index}`,
          branch: 'test-branch',
          environmentId: 'test-env-1',
          suiteIds: [testSuiteId]
        });

        await testRunService.updateTestRun(run.id, {
          status: data.status as any,
          completedAt: new Date(),
          duration: data.duration,
          coverage: { overall: data.coverage, files: 10, coveredFiles: 9 }
        });

        runIds.push(run.id);
      }

      // Get suite statistics
      const stats = await testSuiteService.getSuiteStatistics(testSuiteId);
      expect(stats.totalRuns).toBe(4);
      expect(stats.passRate).toBe(75); // 3 out of 4 passed
      expect(stats.averageCoverage).toBeCloseTo(88.75); // Average of coverage values
      expect(stats.averageDuration).toBeCloseTo(1025); // Average of duration values

      // Clean up runs
      for (const runId of runIds) {
        await supabase.from('test_runs').delete().eq('id', runId);
      }
    });
  });
});