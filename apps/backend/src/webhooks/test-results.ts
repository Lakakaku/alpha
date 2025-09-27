import express from 'express';
import { z } from 'zod';
import { supabase } from '@vocilia/database';
import { loggingService } from '../services/loggingService';

const router = express.Router();

// Webhook payload schemas
const TestResultPayloadSchema = z.object({
  repository: z.string(),
  branch: z.string(),
  commit: z.string(),
  workflow: z.string(),
  status: z.enum(['success', 'failure', 'cancelled', 'skipped']),
  results: z.object({
    lint: z.enum(['success', 'failure', 'cancelled', 'skipped']).optional(),
    unit: z.enum(['success', 'failure', 'cancelled', 'skipped']).optional(),
    contract: z.enum(['success', 'failure', 'cancelled', 'skipped']).optional(),
    integration: z.enum(['success', 'failure', 'cancelled', 'skipped']).optional(),
    e2e: z.enum(['success', 'failure', 'cancelled', 'skipped']).optional(),
    performance: z.enum(['success', 'failure', 'cancelled', 'skipped']).optional(),
    security: z.enum(['success', 'failure', 'cancelled', 'skipped']).optional(),
  }),
  timestamp: z.string(),
  duration?: z.number().optional(),
  coverage?: z.object({
    overall: z.number(),
    unit: z.number().optional(),
    integration: z.number().optional(),
  }).optional(),
  performanceMetrics?: z.object({
    apiResponseTime: z.number().optional(),
    pageLoadTime: z.number().optional(),
    errorRate: z.number().optional(),
  }).optional(),
  artifacts?: z.array(z.object({
    name: z.string(),
    url: z.string(),
    type: z.enum(['coverage', 'report', 'screenshot', 'log']),
  })).optional(),
});

type TestResultPayload = z.infer<typeof TestResultPayloadSchema>;

// Store test results in database
async function storeTestResults(payload: TestResultPayload): Promise<void> {
  try {
    // Create test run record
    const { data: testRun, error: runError } = await supabase
      .from('test_runs')
      .insert({
        trigger_type: 'commit',
        trigger_reference: payload.commit,
        branch: payload.branch,
        environment_id: 'ci-environment', // Default CI environment
        status: payload.status === 'success' ? 'passed' : 'failed',
        started_at: payload.timestamp,
        completed_at: new Date().toISOString(),
        duration: payload.duration || 0,
        coverage: payload.coverage || {},
        performance_metrics: payload.performanceMetrics || {},
        metadata: {
          repository: payload.repository,
          workflow: payload.workflow,
          results: payload.results,
        },
      })
      .select()
      .single();

    if (runError) {
      throw new Error(`Failed to create test run: ${runError.message}`);
    }

    // Store individual test results
    const testResults = [];
    for (const [testType, status] of Object.entries(payload.results)) {
      if (status) {
        testResults.push({
          test_run_id: testRun.id,
          test_case_id: `ci-${testType}`, // Default test case for CI
          status: status === 'success' ? 'passed' : 'failed',
          duration: payload.duration ? Math.floor(payload.duration / Object.keys(payload.results).length) : 0,
          error_message: status === 'failure' ? `${testType} tests failed` : null,
          logs: `${testType} test execution`,
          assertions: {
            total: 1,
            passed: status === 'success' ? 1 : 0,
            failed: status === 'success' ? 0 : 1,
          },
          retry_attempt: 0,
        });
      }
    }

    if (testResults.length > 0) {
      const { error: resultsError } = await supabase
        .from('test_results')
        .insert(testResults);

      if (resultsError) {
        throw new Error(`Failed to store test results: ${resultsError.message}`);
      }
    }

    loggingService.info('Test results stored successfully', {
      testRunId: testRun.id,
      commit: payload.commit,
      branch: payload.branch,
      status: payload.status,
    });
  } catch (error) {
    loggingService.error('Failed to store test results', { error, payload });
    throw error;
  }
}

// Send notifications based on test results
async function sendNotifications(payload: TestResultPayload): Promise<void> {
  try {
    // Determine notification priority
    const isFailure = payload.status === 'failure';
    const isMainBranch = ['main', 'master', 'develop'].includes(payload.branch);
    const shouldNotify = isFailure || (isMainBranch && payload.status === 'success');

    if (!shouldNotify) {
      return;
    }

    // Create notification payload
    const notification = {
      title: isFailure ? '❌ Test Failure Alert' : '✅ Tests Passed',
      message: isFailure
        ? `Test failures detected in ${payload.repository}:${payload.branch}`
        : `All tests passed for ${payload.repository}:${payload.branch}`,
      details: {
        repository: payload.repository,
        branch: payload.branch,
        commit: payload.commit.substring(0, 8),
        workflow: payload.workflow,
        results: payload.results,
        timestamp: payload.timestamp,
      },
      priority: isFailure ? 'high' : 'normal',
      type: 'test_result',
    };

    // Store notification in database for admin dashboard
    const { error: notificationError } = await supabase
      .from('admin_notifications')
      .insert({
        type: 'test_result',
        title: notification.title,
        message: notification.message,
        data: notification.details,
        priority: notification.priority,
        read: false,
      });

    if (notificationError) {
      loggingService.error('Failed to store notification', { 
        error: notificationError, 
        notification 
      });
    }

    // Send to external services if configured
    const webhookUrl = process.env.SLACK_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL;
    if (webhookUrl && isFailure) {
      await sendExternalNotification(webhookUrl, notification);
    }

    loggingService.info('Test result notifications sent', {
      commit: payload.commit,
      branch: payload.branch,
      status: payload.status,
    });
  } catch (error) {
    loggingService.error('Failed to send notifications', { error, payload });
  }
}

// Send notification to external service (Slack, Discord, etc.)
async function sendExternalNotification(
  webhookUrl: string,
  notification: any
): Promise<void> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: notification.title,
        attachments: [
          {
            color: notification.priority === 'high' ? 'danger' : 'good',
            fields: [
              {
                title: 'Repository',
                value: notification.details.repository,
                short: true,
              },
              {
                title: 'Branch',
                value: notification.details.branch,
                short: true,
              },
              {
                title: 'Commit',
                value: notification.details.commit,
                short: true,
              },
              {
                title: 'Workflow',
                value: notification.details.workflow,
                short: true,
              },
              {
                title: 'Results',
                value: Object.entries(notification.details.results)
                  .map(([test, status]) => `${test}: ${status}`)
                  .join('\n'),
                short: false,
              },
            ],
            ts: Math.floor(new Date(notification.details.timestamp).getTime() / 1000),
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`External webhook failed: ${response.status} ${response.statusText}`);
    }

    loggingService.info('External notification sent successfully', {
      webhookUrl: webhookUrl.substring(0, 50) + '...',
      status: response.status,
    });
  } catch (error) {
    loggingService.error('Failed to send external notification', { error, webhookUrl });
  }
}

// Generate test report
async function generateTestReport(payload: TestResultPayload): Promise<void> {
  try {
    const reportData = {
      id: `${payload.commit}-${Date.now()}`,
      test_run_id: payload.commit, // This would be the actual test run ID
      report_type: 'summary',
      period: {
        start_date: payload.timestamp,
        end_date: new Date().toISOString(),
      },
      metrics: {
        total_tests: Object.keys(payload.results).length,
        pass_rate: Object.values(payload.results).filter(s => s === 'success').length / Object.keys(payload.results).length * 100,
        coverage: payload.coverage?.overall || 0,
        performance: payload.performanceMetrics || {},
      },
      trends: {
        // Would be calculated from historical data
        pass_rate_trend: 0,
        coverage_trend: 0,
        performance_trend: 0,
      },
      recommendations: generateRecommendations(payload),
      format: 'json',
      url: `${process.env.API_BASE_URL}/api/admin/test-reports/${payload.commit}`,
      generated_at: new Date().toISOString(),
    };

    // Store report in database
    const { error: reportError } = await supabase
      .from('test_reports')
      .insert(reportData);

    if (reportError) {
      loggingService.error('Failed to store test report', { error: reportError, reportData });
    } else {
      loggingService.info('Test report generated', {
        reportId: reportData.id,
        commit: payload.commit,
      });
    }
  } catch (error) {
    loggingService.error('Failed to generate test report', { error, payload });
  }
}

// Generate recommendations based on test results
function generateRecommendations(payload: TestResultPayload): string[] {
  const recommendations: string[] = [];
  
  // Check for specific failures
  if (payload.results.unit === 'failure') {
    recommendations.push('Review unit test failures and fix failing components');
  }
  
  if (payload.results.e2e === 'failure') {
    recommendations.push('Check E2E test failures - may indicate UI/UX issues');
  }
  
  if (payload.results.performance === 'failure') {
    recommendations.push('Performance tests failed - optimize slow endpoints or pages');
  }
  
  if (payload.results.security === 'failure') {
    recommendations.push('Security issues detected - review and fix vulnerabilities');
  }
  
  // Check coverage
  if (payload.coverage && payload.coverage.overall < 80) {
    recommendations.push('Test coverage below 80% - add more unit tests');
  }
  
  // Check performance metrics
  if (payload.performanceMetrics?.apiResponseTime && payload.performanceMetrics.apiResponseTime > 1000) {
    recommendations.push('API response times above 1s - optimize backend performance');
  }
  
  if (payload.performanceMetrics?.pageLoadTime && payload.performanceMetrics.pageLoadTime > 3000) {
    recommendations.push('Page load times above 3s - optimize frontend performance');
  }
  
  // Default recommendation if no specific issues
  if (recommendations.length === 0 && payload.status === 'success') {
    recommendations.push('All tests passing - consider adding more edge case tests');
  }
  
  return recommendations;
}

// Webhook endpoint for receiving test results
router.post('/test-results', async (req, res) => {
  try {
    // Validate webhook signature if configured
    const signature = req.headers['x-hub-signature-256'] as string;
    const secret = process.env.WEBHOOK_SECRET;
    
    if (secret && signature) {
      const crypto = require('crypto');
      const expectedSignature = 'sha256=' + crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(req.body))
        .digest('hex');
      
      if (signature !== expectedSignature) {
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }
    
    // Validate payload
    const payload = TestResultPayloadSchema.parse(req.body);
    
    loggingService.info('Received test results webhook', {
      repository: payload.repository,
      branch: payload.branch,
      commit: payload.commit,
      status: payload.status,
    });
    
    // Process test results
    await Promise.allSettled([
      storeTestResults(payload),
      sendNotifications(payload),
      generateTestReport(payload),
    ]);
    
    res.status(200).json({ 
      success: true, 
      message: 'Test results processed successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    loggingService.error('Webhook processing failed', { error, body: req.body });
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid payload format',
        details: error.errors,
      });
    }
    
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Endpoint to get test reports
router.get('/test-reports/:commitOrId', async (req, res) => {
  try {
    const { commitOrId } = req.params;
    
    const { data: report, error } = await supabase
      .from('test_reports')
      .select('*')
      .or(`id.eq.${commitOrId},test_run_id.eq.${commitOrId}`)
      .single();
    
    if (error || !report) {
      return res.status(404).json({ error: 'Test report not found' });
    }
    
    res.json(report);
  } catch (error) {
    loggingService.error('Failed to retrieve test report', { error, commitOrId: req.params.commitOrId });
    res.status(500).json({ error: 'Failed to retrieve test report' });
  }
});

// Endpoint to get recent test results
router.get('/test-results/recent', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const branch = req.query.branch as string;
    
    let query = supabase
      .from('test_runs')
      .select(`
        *,
        test_results!inner(*)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (branch) {
      query = query.eq('branch', branch);
    }
    
    const { data: results, error } = await query;
    
    if (error) {
      throw error;
    }
    
    res.json(results);
  } catch (error) {
    loggingService.error('Failed to retrieve recent test results', { error });
    res.status(500).json({ error: 'Failed to retrieve test results' });
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'test-results-webhook',
  });
});

export default router;