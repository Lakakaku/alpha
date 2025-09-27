import fs from 'fs/promises';
import path from 'path';

export interface CoverageData {
  overall: number;
  files: CoverageFileData[];
  summary: CoverageSummary;
  thresholds: CoverageThresholds;
  violations: CoverageViolation[];
}

export interface CoverageFileData {
  filePath: string;
  statements: CoverageMetric;
  branches: CoverageMetric;
  functions: CoverageMetric;
  lines: CoverageMetric;
  uncoveredLines: number[];
}

export interface CoverageMetric {
  total: number;
  covered: number;
  percentage: number;
}

export interface CoverageSummary {
  statements: CoverageMetric;
  branches: CoverageMetric;
  functions: CoverageMetric;
  lines: CoverageMetric;
}

export interface CoverageThresholds {
  global: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
  perFile?: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
}

export interface CoverageViolation {
  type: 'global' | 'file';
  metric: 'statements' | 'branches' | 'functions' | 'lines';
  filePath?: string;
  actual: number;
  threshold: number;
  difference: number;
}

export interface CoverageAnalysisOptions {
  coverageDir?: string;
  thresholds?: CoverageThresholds;
  includeFileDetails?: boolean;
  excludePatterns?: string[];
}

export class CoverageAnalyzer {
  private defaultThresholds: CoverageThresholds = {
    global: {
      statements: 80,
      branches: 75,
      functions: 80,
      lines: 80
    },
    perFile: {
      statements: 70,
      branches: 65,
      functions: 70,
      lines: 70
    }
  };

  async analyzeCoverage(options: CoverageAnalysisOptions = {}): Promise<CoverageData> {
    const coverageDir = options.coverageDir || path.join(process.cwd(), 'coverage');
    const thresholds = { ...this.defaultThresholds, ...options.thresholds };

    try {
      // Read coverage data from Jest/Istanbul output
      const coverageData = await this.readCoverageData(coverageDir);
      
      // Process and analyze the data
      const processedData = await this.processCoverageData(coverageData, options);
      
      // Check for threshold violations
      const violations = this.checkThresholds(processedData, thresholds);
      
      return {
        overall: processedData.summary.statements.percentage,
        files: processedData.files,
        summary: processedData.summary,
        thresholds,
        violations
      };
    } catch (error) {
      throw new Error(`Coverage analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async generateCoverageReport(coverageData: CoverageData, outputPath: string): Promise<string> {
    const reportHtml = this.generateHtmlReport(coverageData);
    
    // Ensure output directory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    
    // Write report to file
    await fs.writeFile(outputPath, reportHtml, 'utf-8');
    
    return outputPath;
  }

  async compareCoverageWithBaseline(
    currentCoverage: CoverageData,
    baselinePath?: string
  ): Promise<{
    improved: boolean;
    degraded: boolean;
    changes: Array<{
      metric: string;
      current: number;
      baseline: number;
      change: number;
    }>;
  }> {
    if (!baselinePath) {
      return { improved: false, degraded: false, changes: [] };
    }

    try {
      const baselineData = await fs.readFile(baselinePath, 'utf-8');
      const baseline: CoverageData = JSON.parse(baselineData);
      
      const changes = [
        {
          metric: 'statements',
          current: currentCoverage.summary.statements.percentage,
          baseline: baseline.summary.statements.percentage,
          change: currentCoverage.summary.statements.percentage - baseline.summary.statements.percentage
        },
        {
          metric: 'branches',
          current: currentCoverage.summary.branches.percentage,
          baseline: baseline.summary.branches.percentage,
          change: currentCoverage.summary.branches.percentage - baseline.summary.branches.percentage
        },
        {
          metric: 'functions',
          current: currentCoverage.summary.functions.percentage,
          baseline: baseline.summary.functions.percentage,
          change: currentCoverage.summary.functions.percentage - baseline.summary.functions.percentage
        },
        {
          metric: 'lines',
          current: currentCoverage.summary.lines.percentage,
          baseline: baseline.summary.lines.percentage,
          change: currentCoverage.summary.lines.percentage - baseline.summary.lines.percentage
        }
      ];

      const improved = changes.some(change => change.change > 1); // Improved by more than 1%
      const degraded = changes.some(change => change.change < -1); // Degraded by more than 1%

      return { improved, degraded, changes };
    } catch (error) {
      console.warn('Failed to compare with baseline coverage:', error);
      return { improved: false, degraded: false, changes: [] };
    }
  }

  private async readCoverageData(coverageDir: string): Promise<any> {
    // Try to read coverage-final.json (Istanbul format)
    const finalCoveragePath = path.join(coverageDir, 'coverage-final.json');
    
    try {
      const data = await fs.readFile(finalCoveragePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      // Fallback to lcov-report directory
      const lcovPath = path.join(coverageDir, 'lcov-report', 'index.html');
      try {
        await fs.access(lcovPath);
        return await this.parseLcovReport(lcovPath);
      } catch (lcovError) {
        throw new Error('No coverage data found. Run tests with coverage enabled first.');
      }
    }
  }

  private async processCoverageData(
    rawData: any,
    options: CoverageAnalysisOptions
  ): Promise<{ files: CoverageFileData[]; summary: CoverageSummary }> {
    const files: CoverageFileData[] = [];
    const totals = {
      statements: { total: 0, covered: 0 },
      branches: { total: 0, covered: 0 },
      functions: { total: 0, covered: 0 },
      lines: { total: 0, covered: 0 }
    };

    // Process each file in the coverage data
    for (const [filePath, fileData] of Object.entries(rawData)) {
      if (this.shouldExcludeFile(filePath, options.excludePatterns)) {
        continue;
      }

      const processedFile = this.processFileData(filePath, fileData as any);
      files.push(processedFile);

      // Accumulate totals
      totals.statements.total += processedFile.statements.total;
      totals.statements.covered += processedFile.statements.covered;
      totals.branches.total += processedFile.branches.total;
      totals.branches.covered += processedFile.branches.covered;
      totals.functions.total += processedFile.functions.total;
      totals.functions.covered += processedFile.functions.covered;
      totals.lines.total += processedFile.lines.total;
      totals.lines.covered += processedFile.lines.covered;
    }

    // Calculate summary percentages
    const summary: CoverageSummary = {
      statements: {
        ...totals.statements,
        percentage: this.calculatePercentage(totals.statements.covered, totals.statements.total)
      },
      branches: {
        ...totals.branches,
        percentage: this.calculatePercentage(totals.branches.covered, totals.branches.total)
      },
      functions: {
        ...totals.functions,
        percentage: this.calculatePercentage(totals.functions.covered, totals.functions.total)
      },
      lines: {
        ...totals.lines,
        percentage: this.calculatePercentage(totals.lines.covered, totals.lines.total)
      }
    };

    return { files, summary };
  }

  private processFileData(filePath: string, fileData: any): CoverageFileData {
    // Process Istanbul coverage data format
    const statements = this.processMetric(fileData.s || {}, fileData.statementMap || {});
    const branches = this.processBranchMetric(fileData.b || {}, fileData.branchMap || {});
    const functions = this.processMetric(fileData.f || {}, fileData.fnMap || {});
    const lines = this.processMetric(fileData.l || {});

    // Find uncovered lines
    const uncoveredLines = Object.entries(fileData.l || {})
      .filter(([, count]) => count === 0)
      .map(([lineNum]) => parseInt(lineNum));

    return {
      filePath: this.normalizePath(filePath),
      statements,
      branches,
      functions,
      lines,
      uncoveredLines
    };
  }

  private processMetric(coverageData: Record<string, number>, map?: Record<string, any>): CoverageMetric {
    const entries = Object.entries(coverageData);
    const total = entries.length;
    const covered = entries.filter(([, count]) => count > 0).length;

    return {
      total,
      covered,
      percentage: this.calculatePercentage(covered, total)
    };
  }

  private processBranchMetric(branchData: Record<string, number[]>, branchMap?: Record<string, any>): CoverageMetric {
    let total = 0;
    let covered = 0;

    for (const branches of Object.values(branchData)) {
      total += branches.length;
      covered += branches.filter(count => count > 0).length;
    }

    return {
      total,
      covered,
      percentage: this.calculatePercentage(covered, total)
    };
  }

  private checkThresholds(
    data: { files: CoverageFileData[]; summary: CoverageSummary },
    thresholds: CoverageThresholds
  ): CoverageViolation[] {
    const violations: CoverageViolation[] = [];

    // Check global thresholds
    const globalChecks = [
      { metric: 'statements' as const, actual: data.summary.statements.percentage, threshold: thresholds.global.statements },
      { metric: 'branches' as const, actual: data.summary.branches.percentage, threshold: thresholds.global.branches },
      { metric: 'functions' as const, actual: data.summary.functions.percentage, threshold: thresholds.global.functions },
      { metric: 'lines' as const, actual: data.summary.lines.percentage, threshold: thresholds.global.lines }
    ];

    for (const check of globalChecks) {
      if (check.actual < check.threshold) {
        violations.push({
          type: 'global',
          metric: check.metric,
          actual: check.actual,
          threshold: check.threshold,
          difference: check.threshold - check.actual
        });
      }
    }

    // Check per-file thresholds if configured
    if (thresholds.perFile) {
      for (const file of data.files) {
        const fileChecks = [
          { metric: 'statements' as const, actual: file.statements.percentage, threshold: thresholds.perFile.statements },
          { metric: 'branches' as const, actual: file.branches.percentage, threshold: thresholds.perFile.branches },
          { metric: 'functions' as const, actual: file.functions.percentage, threshold: thresholds.perFile.functions },
          { metric: 'lines' as const, actual: file.lines.percentage, threshold: thresholds.perFile.lines }
        ];

        for (const check of fileChecks) {
          if (check.actual < check.threshold) {
            violations.push({
              type: 'file',
              metric: check.metric,
              filePath: file.filePath,
              actual: check.actual,
              threshold: check.threshold,
              difference: check.threshold - check.actual
            });
          }
        }
      }
    }

    return violations;
  }

  private generateHtmlReport(coverageData: CoverageData): string {
    // Generate a simple HTML coverage report
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Coverage Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .metric { display: inline-block; margin: 10px; padding: 10px; border: 1px solid #ddd; border-radius: 3px; }
        .high { background-color: #d4edda; }
        .medium { background-color: #fff3cd; }
        .low { background-color: #f8d7da; }
        .violations { margin-top: 20px; }
        .violation { background: #f8d7da; padding: 10px; margin: 5px 0; border-radius: 3px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <h1>Test Coverage Report</h1>
    
    <div class="summary">
        <h2>Overall Coverage: ${coverageData.overall.toFixed(2)}%</h2>
        
        <div class="metric ${this.getCoverageClass(coverageData.summary.statements.percentage)}">
            <strong>Statements:</strong> ${coverageData.summary.statements.percentage.toFixed(2)}%
            (${coverageData.summary.statements.covered}/${coverageData.summary.statements.total})
        </div>
        
        <div class="metric ${this.getCoverageClass(coverageData.summary.branches.percentage)}">
            <strong>Branches:</strong> ${coverageData.summary.branches.percentage.toFixed(2)}%
            (${coverageData.summary.branches.covered}/${coverageData.summary.branches.total})
        </div>
        
        <div class="metric ${this.getCoverageClass(coverageData.summary.functions.percentage)}">
            <strong>Functions:</strong> ${coverageData.summary.functions.percentage.toFixed(2)}%
            (${coverageData.summary.functions.covered}/${coverageData.summary.functions.total})
        </div>
        
        <div class="metric ${this.getCoverageClass(coverageData.summary.lines.percentage)}">
            <strong>Lines:</strong> ${coverageData.summary.lines.percentage.toFixed(2)}%
            (${coverageData.summary.lines.covered}/${coverageData.summary.lines.total})
        </div>
    </div>

    ${coverageData.violations.length > 0 ? `
    <div class="violations">
        <h2>Threshold Violations</h2>
        ${coverageData.violations.map(violation => `
            <div class="violation">
                <strong>${violation.type === 'global' ? 'Global' : 'File'}:</strong> 
                ${violation.filePath || 'Overall'} - 
                ${violation.metric} coverage ${violation.actual.toFixed(2)}% 
                is below threshold ${violation.threshold}% 
                (${violation.difference.toFixed(2)}% short)
            </div>
        `).join('')}
    </div>
    ` : ''}

    <h2>File Coverage Details</h2>
    <table>
        <thead>
            <tr>
                <th>File</th>
                <th>Statements</th>
                <th>Branches</th>
                <th>Functions</th>
                <th>Lines</th>
            </tr>
        </thead>
        <tbody>
            ${coverageData.files.map(file => `
                <tr>
                    <td>${file.filePath}</td>
                    <td class="${this.getCoverageClass(file.statements.percentage)}">
                        ${file.statements.percentage.toFixed(2)}%
                    </td>
                    <td class="${this.getCoverageClass(file.branches.percentage)}">
                        ${file.branches.percentage.toFixed(2)}%
                    </td>
                    <td class="${this.getCoverageClass(file.functions.percentage)}">
                        ${file.functions.percentage.toFixed(2)}%
                    </td>
                    <td class="${this.getCoverageClass(file.lines.percentage)}">
                        ${file.lines.percentage.toFixed(2)}%
                    </td>
                </tr>
            `).join('')}
        </tbody>
    </table>
</body>
</html>
    `;
  }

  private shouldExcludeFile(filePath: string, excludePatterns?: string[]): boolean {
    if (!excludePatterns) return false;

    return excludePatterns.some(pattern => {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(filePath);
    });
  }

  private normalizePath(filePath: string): string {
    return path.relative(process.cwd(), filePath);
  }

  private calculatePercentage(covered: number, total: number): number {
    return total === 0 ? 100 : (covered / total) * 100;
  }

  private getCoverageClass(percentage: number): string {
    if (percentage >= 80) return 'high';
    if (percentage >= 60) return 'medium';
    return 'low';
  }

  private async parseLcovReport(lcovPath: string): Promise<any> {
    // Simplified LCOV parsing - in practice you'd use a proper LCOV parser
    throw new Error('LCOV parsing not implemented. Use Jest with --coverage --coverageReporters=json');
  }
}