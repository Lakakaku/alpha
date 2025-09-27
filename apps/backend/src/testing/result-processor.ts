import { TestRunResult, TestResult, OrchestrationResult } from '../types/testing.js';
import { TestRunService } from '../services/testing/test-run-service.js';

export interface ProcessingOptions {
  storeResults?: boolean;
  generateReports?: boolean;
  notifyOnFailure?: boolean;
  updateCoverage?: boolean;
}

export interface ProcessedResult {
  runId: string;
  processed: boolean;
  stored: boolean;
  reportsGenerated: string[];
  notificationsSent: string[];
  coverageUpdated: boolean;
  errors: string[];
}

export class TestResultProcessor {
  private testRunService: TestRunService;

  constructor() {
    this.testRunService = new TestRunService();
  }

  async processOrchestrationResult(
    result: OrchestrationResult,
    options: ProcessingOptions = {}
  ): Promise<ProcessedResult> {
    const processedResult: ProcessedResult = {
      runId: result.runId,
      processed: false,
      stored: false,
      reportsGenerated: [],
      notificationsSent: [],
      coverageUpdated: false,
      errors: []
    };

    try {
      // Store results in database
      if (options.storeResults !== false) {
        await this.storeOrchestrationResults(result);
        processedResult.stored = true;
      }

      // Generate reports
      if (options.generateReports !== false) {
        const reports = await this.generateReports(result);
        processedResult.reportsGenerated = reports;
      }

      // Send notifications on failure
      if (options.notifyOnFailure !== false && result.status === 'failed') {
        const notifications = await this.sendFailureNotifications(result);
        processedResult.notificationsSent = notifications;
      }

      // Update coverage metrics
      if (options.updateCoverage !== false && result.summary.coverage) {
        await this.updateCoverageMetrics(result);
        processedResult.coverageUpdated = true;
      }

      processedResult.processed = true;
    } catch (error) {
      processedResult.errors.push(error instanceof Error ? error.message : String(error));
    }

    return processedResult;
  }

  async processSuiteResult(
    result: TestRunResult,
    options: ProcessingOptions = {}
  ): Promise<ProcessedResult> {
    const processedResult: ProcessedResult = {
      runId: result.runId,
      processed: false,
      stored: false,
      reportsGenerated: [],
      notificationsSent: [],
      coverageUpdated: false,
      errors: []
    };

    try {
      // Store individual suite results
      if (options.storeResults !== false) {
        await this.storeSuiteResults(result);
        processedResult.stored = true;
      }

      // Generate suite-specific reports
      if (options.generateReports !== false) {
        const reports = await this.generateSuiteReports(result);
        processedResult.reportsGenerated = reports;
      }

      processedResult.processed = true;
    } catch (error) {
      processedResult.errors.push(error instanceof Error ? error.message : String(error));
    }

    return processedResult;
  }

  private async storeOrchestrationResults(result: OrchestrationResult): Promise<void> {
    // Update test run with final status and summary
    await this.testRunService.updateTestRun(result.runId, {
      status: result.status,
      completedAt: new Date(result.endTime),
      duration: result.duration,
      coverage: result.summary.coverage,
      performanceMetrics: this.extractPerformanceMetrics(result)
    });

    // Store individual suite results
    for (const suiteResult of result.suiteResults) {
      await this.storeSuiteResults(suiteResult);
    }
  }

  private async storeSuiteResults(result: TestRunResult): Promise<void> {
    // Store test results for each test in the suite
    for (const testResult of result.results) {
      await this.testRunService.createTestResult({
        testRunId: result.runId.split('-')[0], // Extract main run ID
        testCaseId: this.generateTestCaseId(testResult),
        status: this.mapTestStatus(testResult.status),
        duration: testResult.duration || 0,
        errorMessage: testResult.error,
        stackTrace: testResult.stackTrace,
        screenshots: this.extractScreenshots(testResult),
        logs: this.extractLogs(testResult),
        assertions: this.extractAssertions(testResult),
        coverage: testResult.coverage,
        performanceData: testResult.performanceData,
        retryAttempt: 0
      });
    }
  }

  private async generateReports(result: OrchestrationResult): Promise<string[]> {
    const reports: string[] = [];

    try {
      // Generate HTML summary report
      const htmlReport = await this.generateHtmlReport(result);
      reports.push(htmlReport);

      // Generate JSON report for API consumption
      const jsonReport = await this.generateJsonReport(result);
      reports.push(jsonReport);

      // Generate coverage report if available
      if (result.summary.coverage) {
        const coverageReport = await this.generateCoverageReport(result);
        reports.push(coverageReport);
      }

      // Generate performance report for performance tests
      const performanceTests = result.suiteResults.filter(r => r.runner === 'artillery');
      if (performanceTests.length > 0) {
        const performanceReport = await this.generatePerformanceReport(result, performanceTests);
        reports.push(performanceReport);
      }
    } catch (error) {
      console.error('Error generating reports:', error);
    }

    return reports;
  }

  private async generateSuiteReports(result: TestRunResult): Promise<string[]> {
    const reports: string[] = [];

    try {
      // Generate suite-specific JSON report
      const jsonReport = await this.generateSuiteJsonReport(result);
      reports.push(jsonReport);

      // Generate screenshots report for E2E tests
      if (result.runner === 'playwright' && result.metadata?.screenshots) {
        const screenshotReport = await this.generateScreenshotReport(result);
        reports.push(screenshotReport);
      }
    } catch (error) {
      console.error('Error generating suite reports:', error);
    }

    return reports;
  }

  private async sendFailureNotifications(result: OrchestrationResult): Promise<string[]> {
    const notifications: string[] = [];

    try {
      // Send email notification to development team
      const emailNotification = await this.sendEmailNotification(result);
      notifications.push(emailNotification);

      // Send Slack notification if configured
      const slackNotification = await this.sendSlackNotification(result);
      if (slackNotification) {
        notifications.push(slackNotification);
      }

      // Create GitHub issue for critical failures
      if (this.isCriticalFailure(result)) {
        const githubIssue = await this.createGitHubIssue(result);
        if (githubIssue) {
          notifications.push(githubIssue);
        }
      }
    } catch (error) {
      console.error('Error sending notifications:', error);
    }

    return notifications;
  }

  private async updateCoverageMetrics(result: OrchestrationResult): Promise<void> {
    if (!result.summary.coverage) return;

    try {
      // Update coverage in database
      await this.testRunService.updateCoverageMetrics(result.runId, result.summary.coverage);

      // Update coverage trend data
      await this.updateCoverageTrends(result);
    } catch (error) {
      console.error('Error updating coverage metrics:', error);
    }
  }

  // Helper methods for report generation
  private async generateHtmlReport(result: OrchestrationResult): Promise<string> {
    // Generate HTML report - simplified implementation
    const reportPath = `reports/${result.runId}/summary.html`;
    // In practice, this would generate a proper HTML report
    return reportPath;
  }

  private async generateJsonReport(result: OrchestrationResult): Promise<string> {
    const reportPath = `reports/${result.runId}/results.json`;
    // In practice, this would save JSON report to file system or S3
    return reportPath;
  }

  private async generateCoverageReport(result: OrchestrationResult): Promise<string> {
    const reportPath = `reports/${result.runId}/coverage.html`;
    // Generate coverage report
    return reportPath;
  }

  private async generatePerformanceReport(result: OrchestrationResult, performanceTests: TestRunResult[]): Promise<string> {
    const reportPath = `reports/${result.runId}/performance.html`;
    // Generate performance report with charts and metrics
    return reportPath;
  }

  private async generateSuiteJsonReport(result: TestRunResult): Promise<string> {
    const reportPath = `reports/${result.runId}/suite-${result.runner}.json`;
    return reportPath;
  }

  private async generateScreenshotReport(result: TestRunResult): Promise<string> {
    const reportPath = `reports/${result.runId}/screenshots.html`;
    return reportPath;
  }

  // Helper methods for notifications
  private async sendEmailNotification(result: OrchestrationResult): Promise<string> {
    // Send email notification - simplified implementation
    return `email-notification-${result.runId}`;
  }

  private async sendSlackNotification(result: OrchestrationResult): Promise<string | null> {
    // Send Slack notification if webhook is configured
    return `slack-notification-${result.runId}`;
  }

  private async createGitHubIssue(result: OrchestrationResult): Promise<string | null> {
    // Create GitHub issue for critical failures
    return `github-issue-${result.runId}`;
  }

  private isCriticalFailure(result: OrchestrationResult): boolean {
    // Determine if failure is critical based on failed tests or performance thresholds
    return result.failedSuites > 0 && 
           result.summary.failedTests > result.summary.totalTests * 0.1; // More than 10% failure rate
  }

  private async updateCoverageTrends(result: OrchestrationResult): Promise<void> {
    // Update coverage trend data for monitoring coverage over time
  }

  // Helper methods for data extraction and mapping
  private extractPerformanceMetrics(result: OrchestrationResult): any {
    const performanceResults = result.suiteResults.filter(r => r.runner === 'artillery');
    if (performanceResults.length === 0) return null;

    // Aggregate performance metrics from Artillery results
    return {
      apiResponseTime: this.calculateAverageResponseTime(performanceResults),
      pageLoadTime: null, // Would extract from Playwright results
      errorRate: this.calculateErrorRate(performanceResults)
    };
  }

  private calculateAverageResponseTime(results: TestRunResult[]): number {
    const responseTimes = results
      .map(r => r.metadata?.metrics?.response_time_mean)
      .filter(rt => rt !== undefined);
    
    return responseTimes.length > 0 
      ? responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length
      : 0;
  }

  private calculateErrorRate(results: TestRunResult[]): number {
    let totalRequests = 0;
    let totalErrors = 0;

    for (const result of results) {
      const requests = result.metadata?.metrics?.requests_completed || 0;
      const errors = result.metadata?.metrics?.errors || 0;
      totalRequests += requests;
      totalErrors += errors;
    }

    return totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;
  }

  private generateTestCaseId(testResult: any): string {
    // Generate a consistent test case ID from test result
    return `test-case-${testResult.title?.replace(/\s+/g, '-').toLowerCase() || 'unknown'}`;
  }

  private mapTestStatus(status: string): 'passed' | 'failed' | 'skipped' | 'timeout' | 'error' {
    switch (status) {
      case 'passed': return 'passed';
      case 'failed': return 'failed';
      case 'skipped': return 'skipped';
      case 'timeout': return 'timeout';
      default: return 'error';
    }
  }

  private extractScreenshots(testResult: any): string[] {
    return testResult.screenshots || [];
  }

  private extractLogs(testResult: any): string {
    return testResult.logs || '';
  }

  private extractAssertions(testResult: any): any {
    return testResult.assertions || { total: 0, passed: 0, failed: 0 };
  }
}