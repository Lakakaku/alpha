import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@vocilia/types';
import { NotificationProcessor } from '../../src/services/communication/notification-processor';
import { SmsProvider } from '../../src/services/communication/sms-provider';
import { TemplateRenderer } from '../../src/services/communication/template-renderer';

// Mock implementations for performance testing
const mockSmsProvider = {
  sendSms: jest.fn(),
  getDeliveryStatus: jest.fn(),
  validatePhoneNumber: jest.fn(),
  getSupportedCountries: jest.fn()
} as jest.Mocked<SmsProvider>;

const mockTemplateRenderer = {
  renderTemplate: jest.fn(),
  validateTemplate: jest.fn(),
  getAvailableVariables: jest.fn()
} as jest.Mocked<TemplateRenderer>;

const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        limit: jest.fn(() => ({ data: [], error: null })),
        range: jest.fn(() => ({ data: [], error: null }))
      })),
      in: jest.fn(() => ({
        limit: jest.fn(() => ({ data: [], error: null })),
        range: jest.fn(() => ({ data: [], error: null }))
      })),
      limit: jest.fn(() => ({ data: [], error: null })),
      range: jest.fn(() => ({ data: [], error: null }))
    })),
    insert: jest.fn(() => ({ data: [], error: null })),
    update: jest.fn(() => ({
      eq: jest.fn(() => ({ data: [], error: null }))
    })),
    upsert: jest.fn(() => ({ data: [], error: null }))
  }))
} as unknown as jest.Mocked<SupabaseClient<Database>>;

describe('Batch SMS Processing Performance Tests', () => {
  let notificationProcessor: NotificationProcessor;
  let performanceMetrics: {
    totalProcessingTime: number;
    averageTimePerMessage: number;
    messagesPerSecond: number;
    memoryUsage: number;
    errorRate: number;
  };

  beforeAll(() => {
    notificationProcessor = new NotificationProcessor(
      mockSupabase,
      mockSmsProvider,
      mockTemplateRenderer
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();
    performanceMetrics = {
      totalProcessingTime: 0,
      averageTimePerMessage: 0,
      messagesPerSecond: 0,
      memoryUsage: 0,
      errorRate: 0
    };
  });

  afterEach(() => {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  });

  describe('Small Batch Processing (100 messages)', () => {
    it('should process 100 SMS messages within 5 seconds', async () => {
      const batchSize = 100;
      const notifications = generateTestNotifications(batchSize);
      
      mockSmsProvider.sendSms.mockResolvedValue({
        success: true,
        messageId: 'test-message-id',
        deliveryStatus: 'sent'
      });

      mockTemplateRenderer.renderTemplate.mockResolvedValue({
        success: true,
        content: 'Test SMS message',
        variables_used: ['customer_name']
      });

      const startTime = performance.now();
      const startMemory = process.memoryUsage().heapUsed;

      const results = await notificationProcessor.processBatch(notifications);

      const endTime = performance.now();
      const endMemory = process.memoryUsage().heapUsed;
      const totalTime = endTime - startTime;

      performanceMetrics.totalProcessingTime = totalTime;
      performanceMetrics.averageTimePerMessage = totalTime / batchSize;
      performanceMetrics.messagesPerSecond = (batchSize / totalTime) * 1000;
      performanceMetrics.memoryUsage = endMemory - startMemory;
      performanceMetrics.errorRate = results.failed.length / batchSize;

      // Performance assertions
      expect(totalTime).toBeLessThan(5000); // 5 seconds max
      expect(performanceMetrics.averageTimePerMessage).toBeLessThan(50); // 50ms per message max
      expect(performanceMetrics.messagesPerSecond).toBeGreaterThan(20); // At least 20 messages/second
      expect(performanceMetrics.errorRate).toBeLessThan(0.01); // Less than 1% error rate

      // Memory usage should be reasonable
      expect(performanceMetrics.memoryUsage).toBeLessThan(50 * 1024 * 1024); // Less than 50MB

      console.log('Small Batch Performance Metrics:', performanceMetrics);
    }, 10000);
  });

  describe('Medium Batch Processing (1,000 messages)', () => {
    it('should process 1,000 SMS messages within 30 seconds', async () => {
      const batchSize = 1000;
      const notifications = generateTestNotifications(batchSize);
      
      mockSmsProvider.sendSms.mockResolvedValue({
        success: true,
        messageId: 'test-message-id',
        deliveryStatus: 'sent'
      });

      mockTemplateRenderer.renderTemplate.mockResolvedValue({
        success: true,
        content: 'Test SMS message',
        variables_used: ['customer_name']
      });

      const startTime = performance.now();
      const startMemory = process.memoryUsage().heapUsed;

      const results = await notificationProcessor.processBatch(notifications);

      const endTime = performance.now();
      const endMemory = process.memoryUsage().heapUsed;
      const totalTime = endTime - startTime;

      performanceMetrics.totalProcessingTime = totalTime;
      performanceMetrics.averageTimePerMessage = totalTime / batchSize;
      performanceMetrics.messagesPerSecond = (batchSize / totalTime) * 1000;
      performanceMetrics.memoryUsage = endMemory - startMemory;
      performanceMetrics.errorRate = results.failed.length / batchSize;

      // Performance assertions
      expect(totalTime).toBeLessThan(30000); // 30 seconds max
      expect(performanceMetrics.averageTimePerMessage).toBeLessThan(30); // 30ms per message max
      expect(performanceMetrics.messagesPerSecond).toBeGreaterThan(33); // At least 33 messages/second
      expect(performanceMetrics.errorRate).toBeLessThan(0.01); // Less than 1% error rate

      // Memory usage should scale linearly
      expect(performanceMetrics.memoryUsage).toBeLessThan(100 * 1024 * 1024); // Less than 100MB

      console.log('Medium Batch Performance Metrics:', performanceMetrics);
    }, 35000);
  });

  describe('Large Batch Processing (10,000 messages)', () => {
    it('should process 10,000 SMS messages within 5 minutes', async () => {
      const batchSize = 10000;
      const notifications = generateTestNotifications(batchSize);
      
      mockSmsProvider.sendSms.mockResolvedValue({
        success: true,
        messageId: 'test-message-id',
        deliveryStatus: 'sent'
      });

      mockTemplateRenderer.renderTemplate.mockResolvedValue({
        success: true,
        content: 'Test SMS message',
        variables_used: ['customer_name']
      });

      const startTime = performance.now();
      const startMemory = process.memoryUsage().heapUsed;

      const results = await notificationProcessor.processBatch(notifications);

      const endTime = performance.now();
      const endMemory = process.memoryUsage().heapUsed;
      const totalTime = endTime - startTime;

      performanceMetrics.totalProcessingTime = totalTime;
      performanceMetrics.averageTimePerMessage = totalTime / batchSize;
      performanceMetrics.messagesPerSecond = (batchSize / totalTime) * 1000;
      performanceMetrics.memoryUsage = endMemory - startMemory;
      performanceMetrics.errorRate = results.failed.length / batchSize;

      // Performance assertions
      expect(totalTime).toBeLessThan(300000); // 5 minutes max
      expect(performanceMetrics.averageTimePerMessage).toBeLessThan(30); // 30ms per message max
      expect(performanceMetrics.messagesPerSecond).toBeGreaterThan(33); // At least 33 messages/second
      expect(performanceMetrics.errorRate).toBeLessThan(0.01); // Less than 1% error rate

      // Memory usage should not exceed 500MB for 10k messages
      expect(performanceMetrics.memoryUsage).toBeLessThan(500 * 1024 * 1024); // Less than 500MB

      console.log('Large Batch Performance Metrics:', performanceMetrics);
    }, 310000); // 5+ minutes timeout
  });

  describe('Concurrent Batch Processing', () => {
    it('should handle 3 concurrent batches of 1,000 messages each', async () => {
      const batchSize = 1000;
      const concurrentBatches = 3;
      
      mockSmsProvider.sendSms.mockResolvedValue({
        success: true,
        messageId: 'test-message-id',
        deliveryStatus: 'sent'
      });

      mockTemplateRenderer.renderTemplate.mockResolvedValue({
        success: true,
        content: 'Test SMS message',
        variables_used: ['customer_name']
      });

      const startTime = performance.now();
      const startMemory = process.memoryUsage().heapUsed;

      // Create concurrent batches
      const batchPromises = Array.from({ length: concurrentBatches }, () => {
        const notifications = generateTestNotifications(batchSize);
        return notificationProcessor.processBatch(notifications);
      });

      const results = await Promise.all(batchPromises);

      const endTime = performance.now();
      const endMemory = process.memoryUsage().heapUsed;
      const totalTime = endTime - startTime;
      const totalMessages = batchSize * concurrentBatches;

      performanceMetrics.totalProcessingTime = totalTime;
      performanceMetrics.averageTimePerMessage = totalTime / totalMessages;
      performanceMetrics.messagesPerSecond = (totalMessages / totalTime) * 1000;
      performanceMetrics.memoryUsage = endMemory - startMemory;
      
      const totalFailed = results.reduce((sum, result) => sum + result.failed.length, 0);
      performanceMetrics.errorRate = totalFailed / totalMessages;

      // Performance assertions for concurrent processing
      expect(totalTime).toBeLessThan(45000); // 45 seconds max for concurrent processing
      expect(performanceMetrics.averageTimePerMessage).toBeLessThan(15); // Should be faster due to concurrency
      expect(performanceMetrics.messagesPerSecond).toBeGreaterThan(60); // Higher throughput
      expect(performanceMetrics.errorRate).toBeLessThan(0.01); // Less than 1% error rate

      // Memory usage should be efficient for concurrent processing
      expect(performanceMetrics.memoryUsage).toBeLessThan(200 * 1024 * 1024); // Less than 200MB

      console.log('Concurrent Batch Performance Metrics:', performanceMetrics);
    }, 50000);
  });

  describe('Error Resilience Performance', () => {
    it('should maintain performance with 10% SMS failures', async () => {
      const batchSize = 1000;
      const failureRate = 0.1; // 10% failure rate
      const notifications = generateTestNotifications(batchSize);
      
      // Mock 10% failures
      mockSmsProvider.sendSms
        .mockResolvedValueOnce({
          success: false,
          error: 'Network timeout',
          retryable: true
        })
        .mockResolvedValue({
          success: true,
          messageId: 'test-message-id',
          deliveryStatus: 'sent'
        });

      // Set up alternating success/failure pattern for 10% failure rate
      let callCount = 0;
      mockSmsProvider.sendSms.mockImplementation(async () => {
        callCount++;
        if (callCount % 10 === 0) { // Every 10th call fails
          return {
            success: false,
            error: 'Simulated failure',
            retryable: true
          };
        }
        return {
          success: true,
          messageId: `test-message-${callCount}`,
          deliveryStatus: 'sent'
        };
      });

      mockTemplateRenderer.renderTemplate.mockResolvedValue({
        success: true,
        content: 'Test SMS message',
        variables_used: ['customer_name']
      });

      const startTime = performance.now();
      const results = await notificationProcessor.processBatch(notifications);
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      performanceMetrics.totalProcessingTime = totalTime;
      performanceMetrics.averageTimePerMessage = totalTime / batchSize;
      performanceMetrics.messagesPerSecond = (batchSize / totalTime) * 1000;
      performanceMetrics.errorRate = results.failed.length / batchSize;

      // Performance should degrade gracefully with failures
      expect(totalTime).toBeLessThan(40000); // 40 seconds max with failures
      expect(performanceMetrics.averageTimePerMessage).toBeLessThan(40); // Slightly slower due to retries
      expect(performanceMetrics.messagesPerSecond).toBeGreaterThan(25); // Still reasonable throughput
      expect(performanceMetrics.errorRate).toBeCloseTo(failureRate, 1); // Should match expected failure rate

      console.log('Error Resilience Performance Metrics:', performanceMetrics);
    }, 45000);
  });

  describe('Memory Stress Test', () => {
    it('should maintain stable memory usage across multiple batch cycles', async () => {
      const batchSize = 500;
      const cycles = 10;
      const memorySnapshots: number[] = [];
      
      mockSmsProvider.sendSms.mockResolvedValue({
        success: true,
        messageId: 'test-message-id',
        deliveryStatus: 'sent'
      });

      mockTemplateRenderer.renderTemplate.mockResolvedValue({
        success: true,
        content: 'Test SMS message',
        variables_used: ['customer_name']
      });

      for (let cycle = 0; cycle < cycles; cycle++) {
        const notifications = generateTestNotifications(batchSize);
        
        const cycleStartMemory = process.memoryUsage().heapUsed;
        await notificationProcessor.processBatch(notifications);
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
        
        const cycleEndMemory = process.memoryUsage().heapUsed;
        memorySnapshots.push(cycleEndMemory - cycleStartMemory);
        
        // Small delay between cycles
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Calculate memory growth
      const initialMemory = memorySnapshots[0];
      const finalMemory = memorySnapshots[memorySnapshots.length - 1];
      const memoryGrowth = finalMemory - initialMemory;
      const maxMemoryUsage = Math.max(...memorySnapshots);

      // Memory assertions
      expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024); // Less than 10MB growth over cycles
      expect(maxMemoryUsage).toBeLessThan(100 * 1024 * 1024); // Max 100MB per cycle

      console.log('Memory Stress Test Results:', {
        cycles,
        memoryGrowth: `${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`,
        maxMemoryUsage: `${(maxMemoryUsage / 1024 / 1024).toFixed(2)}MB`,
        averageMemoryPerCycle: `${(memorySnapshots.reduce((a, b) => a + b, 0) / cycles / 1024 / 1024).toFixed(2)}MB`
      });
    }, 60000);
  });

  describe('Rate Limiting Performance', () => {
    it('should respect SMS rate limits while maintaining throughput', async () => {
      const batchSize = 100;
      const rateLimit = 30; // 30 SMS per minute
      const notifications = generateTestNotifications(batchSize);
      
      let smsCount = 0;
      const smsTimes: number[] = [];
      
      mockSmsProvider.sendSms.mockImplementation(async () => {
        smsCount++;
        smsTimes.push(Date.now());
        
        // Simulate rate limiting delay every 30 messages
        if (smsCount % rateLimit === 0) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
        }
        
        return {
          success: true,
          messageId: `test-message-${smsCount}`,
          deliveryStatus: 'sent'
        };
      });

      mockTemplateRenderer.renderTemplate.mockResolvedValue({
        success: true,
        content: 'Test SMS message',
        variables_used: ['customer_name']
      });

      const startTime = performance.now();
      const results = await notificationProcessor.processBatch(notifications);
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Calculate actual rate
      const actualRate = (batchSize / totalTime) * 1000 * 60; // Messages per minute

      performanceMetrics.totalProcessingTime = totalTime;
      performanceMetrics.messagesPerSecond = (batchSize / totalTime) * 1000;
      performanceMetrics.errorRate = results.failed.length / batchSize;

      // Rate limiting assertions
      expect(actualRate).toBeLessThanOrEqual(rateLimit * 1.1); // Within 10% of rate limit
      expect(performanceMetrics.errorRate).toBeLessThan(0.01); // No failures due to rate limiting
      expect(results.successful.length).toBe(batchSize); // All messages should eventually succeed

      console.log('Rate Limiting Performance Metrics:', {
        ...performanceMetrics,
        targetRate: rateLimit,
        actualRate: actualRate.toFixed(2)
      });
    }, 30000);
  });
});

// Helper function to generate test notifications
function generateTestNotifications(count: number): Array<{
  id: string;
  recipient_phone: string;
  template_id: string;
  variables: Record<string, any>;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  scheduled_at?: string;
}> {
  const notifications = [];
  const templates = ['reward_notification', 'payment_confirmation', 'verification_request'];
  const priorities: ('low' | 'medium' | 'high' | 'urgent')[] = ['low', 'medium', 'high', 'urgent'];

  for (let i = 0; i < count; i++) {
    notifications.push({
      id: `test-notification-${i}`,
      recipient_phone: `+46701234${String(i).padStart(3, '0')}`, // Swedish mobile numbers
      template_id: templates[i % templates.length],
      variables: {
        customer_name: `Test Customer ${i}`,
        amount: (Math.random() * 1000).toFixed(2),
        store_name: `Store ${Math.floor(i / 10)}`
      },
      priority: priorities[i % priorities.length],
      scheduled_at: i % 5 === 0 ? new Date(Date.now() + 60000).toISOString() : undefined
    });
  }

  return notifications;
}