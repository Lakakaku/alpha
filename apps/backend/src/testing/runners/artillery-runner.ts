import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { TestRunner, TestRunResult, TestRunOptions } from '../../types/testing.js';
import fs from 'fs/promises';
import path from 'path';

export class ArtilleryRunner extends EventEmitter implements TestRunner {
  private process: ChildProcess | null = null;
  private runId: string | null = null;

  async runTests(options: TestRunOptions): Promise<TestRunResult> {
    this.runId = options.runId;
    
    const startTime = Date.now();
    this.emit('start', { runId: this.runId, timestamp: startTime });

    try {
      const result = await this.executeArtillery(options);
      const duration = Date.now() - startTime;

      const testResult: TestRunResult = {
        runId: this.runId,
        runner: 'artillery',
        status: result.success ? 'passed' : 'failed',
        duration,
        testCount: 1, // Artillery runs are treated as single performance tests
        passedCount: result.success ? 1 : 0,
        failedCount: result.success ? 0 : 1,
        skippedCount: 0,
        results: [result.summary],
        metadata: {
          artilleryVersion: result.version,
          configFile: options.configPath,
          target: result.target,
          phases: result.phases,
          metrics: result.metrics
        }
      };

      this.emit('complete', testResult);
      return testResult;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorResult: TestRunResult = {
        runId: this.runId,
        runner: 'artillery',
        status: 'error',
        duration,
        testCount: 1,
        passedCount: 0,
        failedCount: 1,
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
      }, 5000);

      this.emit('cancelled', { runId: this.runId });
      return true;
    }
    return false;
  }

  private async executeArtillery(options: TestRunOptions): Promise<any> {
    return new Promise(async (resolve, reject) => {
      try {
        // Validate config file exists
        if (!options.configPath) {
          throw new Error('Artillery config file path is required');
        }

        const configExists = await fs.access(options.configPath).then(() => true).catch(() => false);
        if (!configExists) {
          throw new Error(`Artillery config file not found: ${options.configPath}`);
        }

        const artilleryArgs = this.buildArtilleryArgs(options);
        
        this.process = spawn('npx', ['artillery', 'run', ...artilleryArgs], {
          cwd: options.workingDirectory || process.cwd(),
          stdio: ['pipe', 'pipe', 'pipe'],
          env: {
            ...process.env,
            NODE_ENV: 'test'
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
            const result = this.parseArtilleryOutput(stdout, stderr, code === 0);
            resolve(result);
          } catch (error) {
            reject(new Error(`Artillery execution failed: ${stderr || error}`));
          }
        });

        this.process.on('error', (error) => {
          reject(new Error(`Failed to start Artillery: ${error.message}`));
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  private buildArtilleryArgs(options: TestRunOptions): string[] {
    const args = [];

    if (options.configPath) {
      args.push(options.configPath);
    }

    // Add output format for parsing
    args.push('--output', path.join(process.cwd(), 'tmp', `artillery-${this.runId}.json`));

    // Override target if specified
    if (options.target) {
      args.push('--target', options.target);
    }

    // Override environment variables
    if (options.environment) {
      args.push('--environment', options.environment);
    }

    return args;
  }

  private parseArtilleryOutput(stdout: string, stderr: string, success: boolean): any {
    try {
      // Parse Artillery summary from stdout
      const summary = this.extractArtillerySummary(stdout);
      const metrics = this.extractArtilleryMetrics(stdout);
      
      return {
        success: success && this.validatePerformanceThresholds(metrics),
        version: this.extractVersion(stdout),
        target: summary.target || 'unknown',
        phases: summary.phases || [],
        metrics,
        summary: {
          title: 'Artillery Load Test',
          status: success ? 'passed' : 'failed',
          duration: summary.duration || 0,
          requests: summary.requestsCompleted || 0,
          errors: summary.errors || 0
        }
      };
    } catch (error) {
      console.warn('Failed to parse Artillery output:', error);
      return {
        success: false,
        version: 'unknown',
        target: 'unknown',
        phases: [],
        metrics: {},
        summary: {
          title: 'Artillery Load Test',
          status: 'failed',
          duration: 0,
          requests: 0,
          errors: 1
        }
      };
    }
  }

  private extractArtillerySummary(output: string): any {
    const summary: any = {};
    
    // Extract key metrics from Artillery output
    const scenariosLaunched = output.match(/Scenarios launched:\s+(\d+)/);
    const scenariosCompleted = output.match(/Scenarios completed:\s+(\d+)/);
    const requestsCompleted = output.match(/Requests completed:\s+(\d+)/);
    const meanResponseTime = output.match(/Mean response\/sec:\s+([\d.]+)/);
    const responseTimeMin = output.match(/Response time \(msec\):\s*min:\s+([\d.]+)/);
    const responseTimeMax = output.match(/max:\s+([\d.]+)/);
    const responseTimeMean = output.match(/mean:\s+([\d.]+)/);
    const responseTimeP95 = output.match(/p95:\s+([\d.]+)/);
    const responseTimeP99 = output.match(/p99:\s+([\d.]+)/);

    if (scenariosLaunched) summary.scenariosLaunched = parseInt(scenariosLaunched[1]);
    if (scenariosCompleted) summary.scenariosCompleted = parseInt(scenariosCompleted[1]);
    if (requestsCompleted) summary.requestsCompleted = parseInt(requestsCompleted[1]);
    if (meanResponseTime) summary.meanResponseTime = parseFloat(meanResponseTime[1]);

    // Extract response time statistics
    if (responseTimeMin) summary.responseTimeMin = parseFloat(responseTimeMin[1]);
    if (responseTimeMax) summary.responseTimeMax = parseFloat(responseTimeMax[1]);
    if (responseTimeMean) summary.responseTimeMean = parseFloat(responseTimeMean[1]);
    if (responseTimeP95) summary.responseTimeP95 = parseFloat(responseTimeP95[1]);
    if (responseTimeP99) summary.responseTimeP99 = parseFloat(responseTimeP99[1]);

    // Calculate duration and error rate
    const durationMatch = output.match(/Test duration:\s+([\d.]+)\s*s/);
    if (durationMatch) summary.duration = parseFloat(durationMatch[1]) * 1000; // Convert to ms

    const errorsMatch = output.match(/Errors:\s+(\d+)/);
    if (errorsMatch) summary.errors = parseInt(errorsMatch[1]);

    return summary;
  }

  private extractArtilleryMetrics(output: string): any {
    const metrics: any = {};

    // Extract all numeric metrics from Artillery output
    const lines = output.split('\n');
    
    for (const line of lines) {
      // Look for metric patterns like "metric_name: value"
      const metricMatch = line.match(/^\s*([a-zA-Z_][a-zA-Z0-9_\s]+):\s+([\d.]+)/);
      if (metricMatch) {
        const metricName = metricMatch[1].trim().toLowerCase().replace(/\s+/g, '_');
        const metricValue = parseFloat(metricMatch[2]);
        metrics[metricName] = metricValue;
      }
    }

    return metrics;
  }

  private extractVersion(output: string): string {
    const versionMatch = output.match(/Artillery:\s+([\d.]+)/);
    return versionMatch ? versionMatch[1] : 'unknown';
  }

  private validatePerformanceThresholds(metrics: any): boolean {
    // Define performance thresholds based on constitutional requirements
    const thresholds = {
      responseTimeMean: 1000, // API responses < 1s
      responseTimeP95: 2000,  // 95th percentile < 2s
      errorRate: 1            // Error rate < 1%
    };

    let passed = true;

    if (metrics.response_time_mean && metrics.response_time_mean > thresholds.responseTimeMean) {
      passed = false;
      this.emit('threshold-violation', {
        metric: 'response_time_mean',
        value: metrics.response_time_mean,
        threshold: thresholds.responseTimeMean
      });
    }

    if (metrics.response_time_p95 && metrics.response_time_p95 > thresholds.responseTimeP95) {
      passed = false;
      this.emit('threshold-violation', {
        metric: 'response_time_p95',
        value: metrics.response_time_p95,
        threshold: thresholds.responseTimeP95
      });
    }

    // Calculate error rate if we have the data
    if (metrics.errors && metrics.requests_completed) {
      const errorRate = (metrics.errors / metrics.requests_completed) * 100;
      if (errorRate > thresholds.errorRate) {
        passed = false;
        this.emit('threshold-violation', {
          metric: 'error_rate',
          value: errorRate,
          threshold: thresholds.errorRate
        });
      }
    }

    return passed;
  }
}