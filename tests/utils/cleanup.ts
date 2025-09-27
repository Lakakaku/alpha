import { createClient } from '@supabase/supabase-js';
import { join } from 'path';
import { rmdir, unlink, readdir } from 'fs/promises';
import { existsSync } from 'fs';

interface CleanupConfig {
  cleanDatabase: boolean;
  cleanTestFiles: boolean;
  cleanCacheFiles: boolean;
  cleanReports: boolean;
  cleanArtifacts: boolean;
  preserveLastN?: number; // Preserve last N test runs
}

interface CleanupStats {
  databaseRecordsDeleted: number;
  filesDeleted: number;
  directoriesDeleted: number;
  bytesFreed: number;
  errors: string[];
}

export class TestCleanupManager {
  private supabase = createClient(
    process.env.SUPABASE_URL || 'http://localhost:54321',
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key'
  );

  /**
   * Perform comprehensive test cleanup
   */
  async cleanup(config: CleanupConfig = this.getDefaultConfig()): Promise<CleanupStats> {
    const stats: CleanupStats = {
      databaseRecordsDeleted: 0,
      filesDeleted: 0,
      directoriesDeleted: 0,
      bytesFreed: 0,
      errors: [],
    };

    console.log('🧹 Starting test cleanup...');

    try {
      if (config.cleanDatabase) {
        await this.cleanDatabase(stats, config.preserveLastN);
      }

      if (config.cleanTestFiles) {
        await this.cleanTestFiles(stats);
      }

      if (config.cleanCacheFiles) {
        await this.cleanCacheFiles(stats);
      }

      if (config.cleanReports) {
        await this.cleanReports(stats, config.preserveLastN);
      }

      if (config.cleanArtifacts) {
        await this.cleanArtifacts(stats);
      }

      console.log('✅ Test cleanup completed successfully');
      this.logCleanupStats(stats);

    } catch (error) {
      stats.errors.push(`General cleanup error: ${error.message}`);
      console.error('❌ Test cleanup failed:', error);
    }

    return stats;
  }

  /**
   * Clean test database records
   */
  private async cleanDatabase(stats: CleanupStats, preserveLastN?: number): Promise<void> {
    console.log('🗄️  Cleaning test database...');

    try {
      // Clean old test runs but preserve recent ones
      if (preserveLastN && preserveLastN > 0) {
        const { data: recentRuns } = await this.supabase
          .from('testing.test_runs')
          .select('id')
          .order('created_at', { ascending: false })
          .limit(preserveLastN);

        const recentRunIds = recentRuns?.map(run => run.id) || [];

        if (recentRunIds.length > 0) {
          const { count } = await this.supabase
            .from('testing.test_runs')
            .delete()
            .not('id', 'in', `(${recentRunIds.map(id => `'${id}'`).join(',')})`);

          stats.databaseRecordsDeleted += count || 0;
        }
      } else {
        // Clean all test runs if not preserving any
        const { count } = await this.supabase
          .from('testing.test_runs')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

        stats.databaseRecordsDeleted += count || 0;
      }

      // Clean orphaned test results
      const { count: resultCount } = await this.supabase
        .from('testing.test_results')
        .delete()
        .is('test_run_id', null);

      stats.databaseRecordsDeleted += resultCount || 0;

      // Clean old test data records (keep generators and schemas)
      const { count: dataCount } = await this.supabase
        .from('testing.test_data_records')
        .delete()
        .lt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()); // Older than 7 days

      stats.databaseRecordsDeleted += dataCount || 0;

      console.log(`🗄️  Cleaned ${stats.databaseRecordsDeleted} database records`);

    } catch (error) {
      stats.errors.push(`Database cleanup error: ${error.message}`);
      console.error('❌ Database cleanup failed:', error);
    }
  }

  /**
   * Clean temporary test files
   */
  private async cleanTestFiles(stats: CleanupStats): Promise<void> {
    console.log('📁 Cleaning test files...');

    const testDirectories = [
      'test-results',
      'tests/fixtures/temp',
      'tests/temp',
      '.tmp-test',
    ];

    for (const dir of testDirectories) {
      try {
        if (existsSync(dir)) {
          const beforeSize = await this.getDirectorySize(dir);
          await this.cleanDirectory(dir, stats, ['.gitkeep', 'README.md']);
          const afterSize = await this.getDirectorySize(dir);
          stats.bytesFreed += beforeSize - afterSize;
        }
      } catch (error) {
        stats.errors.push(`Error cleaning ${dir}: ${error.message}`);
      }
    }

    console.log(`📁 Cleaned test files, freed ${this.formatBytes(stats.bytesFreed)}`);
  }

  /**
   * Clean cache files
   */
  private async cleanCacheFiles(stats: CleanupStats): Promise<void> {
    console.log('💾 Cleaning cache files...');

    const cacheDirectories = [
      'node_modules/.cache',
      '.next/cache',
      '.cache',
      'coverage/.nyc_output',
    ];

    for (const dir of cacheDirectories) {
      try {
        if (existsSync(dir)) {
          const beforeSize = await this.getDirectorySize(dir);
          await this.cleanDirectory(dir, stats);
          const afterSize = await this.getDirectorySize(dir);
          stats.bytesFreed += beforeSize - afterSize;
        }
      } catch (error) {
        stats.errors.push(`Error cleaning cache ${dir}: ${error.message}`);
      }
    }

    console.log(`💾 Cleaned cache files, freed ${this.formatBytes(stats.bytesFreed)}`);
  }

  /**
   * Clean test reports but preserve recent ones
   */
  private async cleanReports(stats: CleanupStats, preserveLastN?: number): Promise<void> {
    console.log('📊 Cleaning test reports...');

    const reportDirectories = [
      'test-results',
      'coverage',
      'playwright-report',
      '.lighthouseci',
    ];

    for (const dir of reportDirectories) {
      try {
        if (existsSync(dir)) {
          await this.cleanReportDirectory(dir, stats, preserveLastN);
        }
      } catch (error) {
        stats.errors.push(`Error cleaning reports in ${dir}: ${error.message}`);
      }
    }

    console.log(`📊 Cleaned test reports`);
  }

  /**
   * Clean build artifacts and temporary files
   */
  private async cleanArtifacts(stats: CleanupStats): Promise<void> {
    console.log('🔧 Cleaning build artifacts...');

    const artifactPatterns = [
      'apps/*/dist',
      'apps/*/.next',
      'packages/*/dist',
      'packages/*/lib',
      '**/*.tsbuildinfo',
    ];

    // Note: In a real implementation, you'd use glob matching
    // For now, we'll check common locations
    const commonArtifacts = [
      'apps/backend/dist',
      'apps/customer/.next',
      'apps/business/.next',
      'apps/admin/.next',
      'packages/types/dist',
      'packages/database/dist',
      'packages/ui/dist',
    ];

    for (const artifact of commonArtifacts) {
      try {
        if (existsSync(artifact)) {
          const beforeSize = await this.getDirectorySize(artifact);
          await this.removeDirectory(artifact);
          stats.directoriesDeleted++;
          stats.bytesFreed += beforeSize;
        }
      } catch (error) {
        stats.errors.push(`Error cleaning artifact ${artifact}: ${error.message}`);
      }
    }

    console.log(`🔧 Cleaned build artifacts, freed ${this.formatBytes(stats.bytesFreed)}`);
  }

  /**
   * Clean directory contents while preserving specified files
   */
  private async cleanDirectory(
    dirPath: string,
    stats: CleanupStats,
    preserve: string[] = []
  ): Promise<void> {
    try {
      const items = await readdir(dirPath, { withFileTypes: true });

      for (const item of items) {
        if (preserve.includes(item.name)) {
          continue;
        }

        const itemPath = join(dirPath, item.name);

        if (item.isDirectory()) {
          await this.removeDirectory(itemPath);
          stats.directoriesDeleted++;
        } else {
          await unlink(itemPath);
          stats.filesDeleted++;
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Clean report directory with preservation logic
   */
  private async cleanReportDirectory(
    dirPath: string,
    stats: CleanupStats,
    preserveLastN?: number
  ): Promise<void> {
    try {
      const items = await readdir(dirPath, { withFileTypes: true });
      
      // Sort items by creation time (most recent first)
      const sortedItems = items
        .filter(item => item.isFile() && (item.name.includes('report') || item.name.includes('.html')))
        .sort((a, b) => {
          // In a real implementation, you'd check file stats
          // For now, sort by name assuming timestamp-based naming
          return b.name.localeCompare(a.name);
        });

      const itemsToDelete = preserveLastN 
        ? sortedItems.slice(preserveLastN)
        : sortedItems;

      for (const item of itemsToDelete) {
        const itemPath = join(dirPath, item.name);
        await unlink(itemPath);
        stats.filesDeleted++;
      }

    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Remove directory recursively
   */
  private async removeDirectory(dirPath: string): Promise<void> {
    try {
      await rmdir(dirPath, { recursive: true });
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Get directory size in bytes
   */
  private async getDirectorySize(dirPath: string): Promise<number> {
    let size = 0;
    
    try {
      const items = await readdir(dirPath, { withFileTypes: true });
      
      for (const item of items) {
        const itemPath = join(dirPath, item.name);
        
        if (item.isDirectory()) {
          size += await this.getDirectorySize(itemPath);
        } else {
          // In a real implementation, you'd use fs.stat to get file size
          // For now, estimate based on file type
          if (item.name.endsWith('.html') || item.name.endsWith('.json')) {
            size += 10000; // ~10KB
          } else if (item.name.endsWith('.js') || item.name.endsWith('.map')) {
            size += 50000; // ~50KB
          } else {
            size += 1000; // ~1KB
          }
        }
      }
    } catch (error) {
      // Directory doesn't exist or can't be read
      return 0;
    }

    return size;
  }

  /**
   * Format bytes for human-readable output
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get default cleanup configuration
   */
  private getDefaultConfig(): CleanupConfig {
    const isCI = process.env.CI === 'true';
    
    return {
      cleanDatabase: !isCI, // Don't clean DB in CI
      cleanTestFiles: true,
      cleanCacheFiles: true,
      cleanReports: true,
      cleanArtifacts: !isCI, // Keep artifacts in CI for debugging
      preserveLastN: isCI ? 1 : 3, // Preserve fewer in CI
    };
  }

  /**
   * Log cleanup statistics
   */
  private logCleanupStats(stats: CleanupStats): void {
    console.log('\n📈 Cleanup Statistics:');
    console.log(`   Database records deleted: ${stats.databaseRecordsDeleted}`);
    console.log(`   Files deleted: ${stats.filesDeleted}`);
    console.log(`   Directories deleted: ${stats.directoriesDeleted}`);
    console.log(`   Disk space freed: ${this.formatBytes(stats.bytesFreed)}`);
    
    if (stats.errors.length > 0) {
      console.log(`   Errors encountered: ${stats.errors.length}`);
      stats.errors.forEach(error => console.log(`     ⚠️  ${error}`));
    }
  }
}

// Convenience functions for common cleanup operations

/**
 * Quick cleanup for development
 */
export async function quickCleanup(): Promise<CleanupStats> {
  const manager = new TestCleanupManager();
  return manager.cleanup({
    cleanDatabase: false, // Keep DB data in quick cleanup
    cleanTestFiles: true,
    cleanCacheFiles: true,
    cleanReports: false, // Keep reports in quick cleanup
    cleanArtifacts: false,
    preserveLastN: 3,
  });
}

/**
 * Deep cleanup for CI or before important test runs
 */
export async function deepCleanup(): Promise<CleanupStats> {
  const manager = new TestCleanupManager();
  return manager.cleanup({
    cleanDatabase: true,
    cleanTestFiles: true,
    cleanCacheFiles: true,
    cleanReports: true,
    cleanArtifacts: true,
    preserveLastN: 1,
  });
}

/**
 * Emergency cleanup when disk space is low
 */
export async function emergencyCleanup(): Promise<CleanupStats> {
  const manager = new TestCleanupManager();
  return manager.cleanup({
    cleanDatabase: true,
    cleanTestFiles: true,
    cleanCacheFiles: true,
    cleanReports: true,
    cleanArtifacts: true,
    preserveLastN: 0, // Don't preserve anything
  });
}

/**
 * Cleanup test data only (preserve reports and artifacts)
 */
export async function cleanupTestDataOnly(): Promise<CleanupStats> {
  const manager = new TestCleanupManager();
  return manager.cleanup({
    cleanDatabase: true,
    cleanTestFiles: true,
    cleanCacheFiles: false,
    cleanReports: false,
    cleanArtifacts: false,
    preserveLastN: 0,
  });
}

// Export singleton instance
export const testCleanup = new TestCleanupManager();