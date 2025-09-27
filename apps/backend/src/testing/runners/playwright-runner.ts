import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { TestRunner, TestRunResult, TestRunOptions } from '../../types/testing.js';

export class PlaywrightRunner extends EventEmitter implements TestRunner {
  private process: ChildProcess | null = null;
  private runId: string | null = null;

  async runTests(options: TestRunOptions): Promise<TestRunResult> {
    this.runId = options.runId;
    
    const startTime = Date.now();
    this.emit('start', { runId: this.runId, timestamp: startTime });

    try {
      const result = await this.executePlaywright(options);
      const duration = Date.now() - startTime;

      const testResult: TestRunResult = {
        runId: this.runId,
        runner: 'playwright',
        status: result.success ? 'passed' : 'failed',
        duration,
        testCount: result.totalTests,
        passedCount: result.passedTests,
        failedCount: result.failedTests,
        skippedCount: result.skippedTests,
        results: result.testResults,
        metadata: {
          playwrightVersion: result.version,
          browser: options.browser || 'chromium',
          headless: options.headless !== false,
          screenshots: result.screenshots,
          videos: result.videos
        }
      };

      this.emit('complete', testResult);
      return testResult;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorResult: TestRunResult = {
        runId: this.runId,
        runner: 'playwright',
        status: 'error',
        duration,
        testCount: 0,
        passedCount: 0,
        failedCount: 0,
        skippedCount: 0,
        error: error instanceof Error ? error.message : String(error),
        results: [],
        metadata: { error: String(error) }
      };

      this.emit('error', errorResult);
      return errorResult;
    }
  }

  async cancel(): Promise<boolean> {
    if (this.process && !this.process.killed) {
      this.process.kill('SIGTERM');
      
      setTimeout(() => {
        if (this.process && !this.process.killed) {
          this.process.kill('SIGKILL');
        }
      }, 10000); // Longer timeout for browser cleanup

      this.emit('cancelled', { runId: this.runId });
      return true;
    }
    return false;
  }

  private async executePlaywright(options: TestRunOptions): Promise<any> {
    return new Promise((resolve, reject) => {
      const playwrightArgs = this.buildPlaywrightArgs(options);
      
      this.process = spawn('npx', ['playwright', 'test', ...playwrightArgs], {
        cwd: options.workingDirectory || process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          CI: 'true',
          PWTEST_SKIP_TEST_OUTPUT: 'true'
        }
      });

      let stdout = '';
      let stderr = '';

      this.process.stdout?.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        this.emit('output', { runId: this.runId, type: 'stdout', data: output });
      });

      this.process.stderr?.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        this.emit('output', { runId: this.runId, type: 'stderr', data: output });
      });

      this.process.on('close', (code) => {
        try {
          const result = this.parsePlaywrightOutput(stdout, stderr, code === 0);
          resolve(result);
        } catch (error) {
          reject(new Error(`Playwright execution failed: ${stderr || error}`));
        }
      });

      this.process.on('error', (error) => {
        reject(new Error(`Failed to start Playwright: ${error.message}`));
      });
    });
  }

  private buildPlaywrightArgs(options: TestRunOptions): string[] {
    const args = ['--reporter=json'];

    if (options.configPath) {
      args.push('--config', options.configPath);
    }

    if (options.testPattern) {
      args.push('--grep', options.testPattern);
    }

    if (options.testPaths && options.testPaths.length > 0) {
      args.push(...options.testPaths);
    }

    if (options.browser) {
      args.push('--project', options.browser);
    }

    if (options.maxWorkers) {
      args.push('--workers', String(options.maxWorkers));
    }

    if (options.timeout) {
      args.push('--timeout', String(options.timeout));
    }

    if (options.headless === false) {
      args.push('--headed');
    }

    // Enable screenshots and videos for debugging
    args.push('--screenshot=only-on-failure');
    args.push('--video=retain-on-failure');

    return args;
  }

  private parsePlaywrightOutput(stdout: string, stderr: string, success: boolean): any {
    try {
      // Look for JSON reporter output
      const lines = stdout.split('\n');
      let jsonOutput = null;

      for (const line of lines) {
        if (line.trim().startsWith('{') && line.includes('"config"')) {
          jsonOutput = JSON.parse(line);
          break;
        }
      }

      if (jsonOutput && jsonOutput.suites) {
        return this.formatPlaywrightResults(jsonOutput, success);
      }
    } catch (error) {
      console.warn('Failed to parse Playwright JSON output:', error);
    }

    // Fallback parsing from text output
    return this.parsePlaywrightTextOutput(stdout, stderr, success);
  }

  private formatPlaywrightResults(jsonOutput: any, success: boolean): any {
    const allTests: any[] = [];
    const screenshots: string[] = [];
    const videos: string[] = [];

    const collectTests = (suites: any[]) => {
      for (const suite of suites) {
        if (suite.tests) {
          for (const test of suite.tests) {
            allTests.push({
              title: test.title,
              file: suite.file,
              status: this.mapPlaywrightStatus(test.outcome),
              duration: test.duration || 0,
              error: test.error,
              annotations: test.annotations
            });

            // Collect attachments
            if (test.attachments) {
              for (const attachment of test.attachments) {
                if (attachment.contentType?.includes('image')) {
                  screenshots.push(attachment.path);
                } else if (attachment.contentType?.includes('video')) {
                  videos.push(attachment.path);
                }
              }
            }
          }
        }
        if (suite.suites) {
          collectTests(suite.suites);
        }
      }
    };

    collectTests(jsonOutput.suites || []);

    const stats = this.calculateStats(allTests);

    return {
      success,
      version: jsonOutput.config?.version || 'unknown',
      totalTests: stats.total,
      passedTests: stats.passed,
      failedTests: stats.failed,
      skippedTests: stats.skipped,
      testResults: allTests,
      screenshots,
      videos
    };
  }

  private parsePlaywrightTextOutput(stdout: string, stderr: string, success: boolean): any {
    const lines = stdout.split('\n');
    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;
    let skippedTests = 0;

    // Parse summary line like "5 passed, 2 failed, 1 skipped"
    for (const line of lines) {
      const summaryMatch = line.match(/(\d+)\s+passed.*?(\d+)\s+failed.*?(\d+)\s+skipped/);
      if (summaryMatch) {
        passedTests = parseInt(summaryMatch[1]) || 0;
        failedTests = parseInt(summaryMatch[2]) || 0;
        skippedTests = parseInt(summaryMatch[3]) || 0;
        totalTests = passedTests + failedTests + skippedTests;
        break;
      }
    }

    return {
      success,
      version: 'unknown',
      totalTests,
      passedTests,
      failedTests,
      skippedTests,
      testResults: [],
      screenshots: [],
      videos: []
    };
  }

  private mapPlaywrightStatus(outcome: string): string {
    switch (outcome) {
      case 'expected': return 'passed';
      case 'unexpected': return 'failed';
      case 'flaky': return 'failed';
      case 'skipped': return 'skipped';
      default: return 'unknown';
    }
  }

  private calculateStats(tests: any[]): { total: number; passed: number; failed: number; skipped: number } {
    return {
      total: tests.length,
      passed: tests.filter(t => t.status === 'passed').length,
      failed: tests.filter(t => t.status === 'failed').length,
      skipped: tests.filter(t => t.status === 'skipped').length
    };
  }
}