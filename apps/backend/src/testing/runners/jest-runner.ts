import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import { TestRunner, TestRunResult, TestRunOptions } from '../../types/testing.js';

export class JestRunner extends EventEmitter implements TestRunner {
  private process: ChildProcess | null = null;
  private runId: string | null = null;

  async runTests(options: TestRunOptions): Promise<TestRunResult> {
    this.runId = options.runId;
    
    const startTime = Date.now();
    this.emit('start', { runId: this.runId, timestamp: startTime });

    try {
      const result = await this.executeJest(options);
      const duration = Date.now() - startTime;

      const testResult: TestRunResult = {
        runId: this.runId,
        runner: 'jest',
        status: result.success ? 'passed' : 'failed',
        duration,
        testCount: result.numTotalTests,
        passedCount: result.numPassedTests,
        failedCount: result.numFailedTests,
        skippedCount: result.numSkippedTests,
        coverage: result.coverage,
        results: result.testResults,
        metadata: {
          jestVersion: result.jestVersion,
          configPath: options.configPath,
          testPattern: options.testPattern
        }
      };

      this.emit('complete', testResult);
      return testResult;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorResult: TestRunResult = {
        runId: this.runId,
        runner: 'jest',
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
      
      // Force kill after 5 seconds if graceful termination fails
      setTimeout(() => {
        if (this.process && !this.process.killed) {
          this.process.kill('SIGKILL');
        }
      }, 5000);

      this.emit('cancelled', { runId: this.runId });
      return true;
    }
    return false;
  }

  private async executeJest(options: TestRunOptions): Promise<any> {
    return new Promise((resolve, reject) => {
      const jestArgs = this.buildJestArgs(options);
      
      this.process = spawn('npx', ['jest', ...jestArgs], {
        cwd: options.workingDirectory || process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          NODE_ENV: 'test',
          CI: 'true'
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
          // Try to parse Jest JSON output
          const result = this.parseJestOutput(stdout, stderr, code === 0);
          resolve(result);
        } catch (error) {
          reject(new Error(`Jest execution failed: ${stderr || error}`));
        }
      });

      this.process.on('error', (error) => {
        reject(new Error(`Failed to start Jest: ${error.message}`));
      });
    });
  }

  private buildJestArgs(options: TestRunOptions): string[] {
    const args = ['--json', '--coverage'];

    if (options.configPath) {
      args.push('--config', options.configPath);
    }

    if (options.testPattern) {
      args.push('--testNamePattern', options.testPattern);
    }

    if (options.testPaths && options.testPaths.length > 0) {
      args.push(...options.testPaths);
    }

    if (options.maxWorkers) {
      args.push('--maxWorkers', String(options.maxWorkers));
    }

    if (options.timeout) {
      args.push('--testTimeout', String(options.timeout));
    }

    // Always run in CI mode for consistent output
    args.push('--ci', '--watchman=false');

    return args;
  }

  private parseJestOutput(stdout: string, stderr: string, success: boolean): any {
    try {
      // Jest outputs JSON on the last line when using --json flag
      const lines = stdout.split('\n').filter(line => line.trim());
      const jsonLine = lines[lines.length - 1];
      
      if (jsonLine && jsonLine.startsWith('{')) {
        const result = JSON.parse(jsonLine);
        return {
          success,
          jestVersion: result.jestVersion || 'unknown',
          numTotalTests: result.numTotalTests || 0,
          numPassedTests: result.numPassedTests || 0,
          numFailedTests: result.numFailedTests || 0,
          numSkippedTests: result.numPendingTests || 0,
          testResults: this.formatTestResults(result.testResults || []),
          coverage: this.formatCoverage(result.coverageMap)
        };
      }
    } catch (error) {
      console.warn('Failed to parse Jest JSON output:', error);
    }

    // Fallback parsing from text output
    return {
      success,
      jestVersion: 'unknown',
      numTotalTests: 0,
      numPassedTests: success ? 1 : 0,
      numFailedTests: success ? 0 : 1,
      numSkippedTests: 0,
      testResults: [],
      coverage: null
    };
  }

  private formatTestResults(testResults: any[]): any[] {
    return testResults.map(result => ({
      testFilePath: result.testFilePath,
      status: result.status,
      duration: result.endTime - result.startTime,
      assertions: result.assertionResults?.map((assertion: any) => ({
        title: assertion.title,
        status: assertion.status,
        failureMessage: assertion.failureMessage
      })) || []
    }));
  }

  private formatCoverage(coverageMap: any): any {
    if (!coverageMap) return null;

    try {
      const files = Object.keys(coverageMap);
      let totalStatements = 0;
      let coveredStatements = 0;

      files.forEach(file => {
        const fileCoverage = coverageMap[file];
        if (fileCoverage && fileCoverage.s) {
          const statements = Object.values(fileCoverage.s) as number[];
          totalStatements += statements.length;
          coveredStatements += statements.filter(count => count > 0).length;
        }
      });

      return {
        overall: totalStatements > 0 ? (coveredStatements / totalStatements) * 100 : 0,
        files: files.length,
        coveredFiles: files.filter(file => {
          const fileCoverage = coverageMap[file];
          return fileCoverage && Object.values(fileCoverage.s || {}).some(count => count > 0);
        }).length
      };
    } catch (error) {
      console.warn('Failed to format coverage data:', error);
      return null;
    }
  }
}