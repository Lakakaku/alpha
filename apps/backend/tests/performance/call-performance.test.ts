// Jest globals are available globally
import request from 'supertest';
import { performance } from 'perf_hooks';
import { app } from '../../src/app';
import { supabase } from '../../src/config/database';

describe('Call Performance Tests', () => {
  let businessId: string;
  let verificationId: string;

  beforeAll(async () => {
    // Create test business
    const { data: business } = await supabase
      .from('businesses')
      .insert({
        name: 'Performance Test Business',
        email: 'perf-test@example.com',
        phone: '+46700000100'
      })
      .select()
      .single();
    
    businessId = business.id;

    // Create test verification
    const { data: verification } = await supabase
      .from('customer_verifications')
      .insert({
        business_id: businessId,
        phone_number: '+46701234567',
        status: 'verified',
        transaction_time: new Date(),
        transaction_amount: 145.50
      })
      .select()
      .single();
    
    verificationId = verification.id;

    // Create test question configurations
    await supabase
      .from('question_configurations')
      .insert([
        {
          business_id: businessId,
          question_text: 'Hur var din upplevelse av vår service idag?',
          frequency: 2,
          priority: 'high',
          department_tags: ['service'],
          is_active: true,
          max_response_time: 30
        },
        {
          business_id: businessId,
          question_text: 'Vad tycker du om våra öppettider?',
          frequency: 5,
          priority: 'medium',
          department_tags: ['operations'],
          is_active: true,
          max_response_time: 25
        }
      ]);
  });

  afterAll(async () => {
    // Clean up test data
    await supabase
      .from('call_sessions')
      .delete()
      .eq('business_id', businessId);
    
    await supabase
      .from('question_configurations')
      .delete()
      .eq('business_id', businessId);
    
    await supabase
      .from('customer_verifications')
      .delete()
      .eq('id', verificationId);
    
    await supabase
      .from('businesses')
      .delete()
      .eq('id', businessId);
  });

  describe('Call Initiation Performance', () => {
    it('should initiate call within 5 seconds (95th percentile)', async () => {
      const measurements: number[] = [];
      const iterations = 20;

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        
        const response = await request(app)
          .post('/api/calls/initiate')
          .send({
            verificationId,
            businessId,
            customerPhone: '+46701234567',
            priority: 'normal'
          });

        const endTime = performance.now();
        const duration = endTime - startTime;
        measurements.push(duration);

        // Should not fail
        expect(response.status).toBeLessThan(500);
      }

      // Calculate 95th percentile
      measurements.sort((a, b) => a - b);
      const p95Index = Math.floor(measurements.length * 0.95);
      const p95Duration = measurements[p95Index];

      console.log(`Call initiation p95: ${p95Duration.toFixed(2)}ms`);
      console.log(`Call initiation average: ${(measurements.reduce((a, b) => a + b) / measurements.length).toFixed(2)}ms`);
      
      // P95 should be under 5000ms (5 seconds)
      expect(p95Duration).toBeLessThan(5000);
    });

    it('should handle concurrent call initiations', async () => {
      const concurrentCalls = 10;
      const startTime = performance.now();

      const promises = Array.from({ length: concurrentCalls }, (_, i) => 
        request(app)
          .post('/api/calls/initiate')
          .send({
            verificationId,
            businessId,
            customerPhone: `+4670123456${i}`,
            priority: 'normal'
          })
      );

      const responses = await Promise.allSettled(promises);
      const endTime = performance.now();
      const totalDuration = endTime - startTime;

      console.log(`${concurrentCalls} concurrent calls completed in ${totalDuration.toFixed(2)}ms`);

      // Most calls should succeed
      const successfulCalls = responses.filter(r => 
        r.status === 'fulfilled' && r.value.status < 500
      ).length;

      expect(successfulCalls).toBeGreaterThan(concurrentCalls * 0.8); // 80% success rate
      expect(totalDuration).toBeLessThan(10000); // 10 seconds for all concurrent calls
    });
  });

  describe('Question Selection Performance', () => {
    it('should select questions within 100ms', async () => {
      const measurements: number[] = [];
      const iterations = 50;

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        
        const response = await request(app)
          .post('/api/questions/select')
          .send({
            businessId,
            customerCount: Math.floor(Math.random() * 100) + 1,
            timeBudgetSeconds: 90
          });

        const endTime = performance.now();
        const duration = endTime - startTime;
        measurements.push(duration);

        expect(response.status).toBe(200);
      }

      const avgDuration = measurements.reduce((a, b) => a + b) / measurements.length;
      const maxDuration = Math.max(...measurements);

      console.log(`Question selection average: ${avgDuration.toFixed(2)}ms`);
      console.log(`Question selection max: ${maxDuration.toFixed(2)}ms`);

      expect(avgDuration).toBeLessThan(100);
      expect(maxDuration).toBeLessThan(200);
    });

    it('should handle complex frequency calculations efficiently', async () => {
      // Create many question configurations for stress testing
      const manyQuestions = Array.from({ length: 100 }, (_, i) => ({
        business_id: businessId,
        question_text: `Test question ${i + 1}?`,
        frequency: (i % 10) + 1, // Frequencies from 1 to 10
        priority: ['high', 'medium', 'low'][i % 3],
        department_tags: [`dept_${i % 5}`],
        is_active: true,
        max_response_time: 30
      }));

      await supabase
        .from('question_configurations')
        .insert(manyQuestions);

      const startTime = performance.now();

      const response = await request(app)
        .post('/api/questions/select')
        .send({
          businessId,
          customerCount: 60, // Will trigger many frequencies
          timeBudgetSeconds: 120
        });

      const endTime = performance.now();
      const duration = endTime - startTime;

      console.log(`Complex question selection: ${duration.toFixed(2)}ms`);

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(500); // Even with 100 questions, should be fast

      // Clean up
      await supabase
        .from('question_configurations')
        .delete()
        .in('question_text', manyQuestions.map(q => q.question_text));
    });
  });

  describe('Database Query Performance', () => {
    it('should retrieve call status within 50ms', async () => {
      // Create a test call session
      const { data: callSession } = await supabase
        .from('call_sessions')
        .insert({
          business_id: businessId,
          customer_phone: '+46701234567',
          verification_id: verificationId,
          status: 'in_progress',
          started_at: new Date(),
          connected_at: new Date()
        })
        .select()
        .single();

      const measurements: number[] = [];
      const iterations = 30;

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        
        const response = await request(app)
          .get(`/api/calls/${callSession.id}/status`);

        const endTime = performance.now();
        const duration = endTime - startTime;
        measurements.push(duration);

        expect(response.status).toBe(200);
      }

      const avgDuration = measurements.reduce((a, b) => a + b) / measurements.length;
      console.log(`Call status retrieval average: ${avgDuration.toFixed(2)}ms`);

      expect(avgDuration).toBeLessThan(50);

      // Clean up
      await supabase
        .from('call_sessions')
        .delete()
        .eq('id', callSession.id);
    });

    it('should handle webhook processing within 200ms', async () => {
      // Create a test call session
      const { data: callSession } = await supabase
        .from('call_sessions')
        .insert({
          business_id: businessId,
          customer_phone: '+46701234567',
          verification_id: verificationId,
          status: 'initiated',
          started_at: new Date(),
          telephony_call_id: '46elks-perf-test-123'
        })
        .select()
        .single();

      const measurements: number[] = [];
      const iterations = 20;

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        
        const response = await request(app)
          .post('/api/calls/webhooks/telephony')
          .send({
            eventType: 'call_answered',
            callId: '46elks-perf-test-123',
            sessionId: callSession.id,
            timestamp: new Date().toISOString(),
            data: {
              answerTime: new Date().toISOString(),
              provider: '46elks'
            }
          });

        const endTime = performance.now();
        const duration = endTime - startTime;
        measurements.push(duration);

        expect(response.status).toBe(200);
      }

      const avgDuration = measurements.reduce((a, b) => a + b) / measurements.length;
      console.log(`Webhook processing average: ${avgDuration.toFixed(2)}ms`);

      expect(avgDuration).toBeLessThan(200);

      // Clean up
      await supabase
        .from('call_events')
        .delete()
        .eq('call_session_id', callSession.id);
      
      await supabase
        .from('call_sessions')
        .delete()
        .eq('id', callSession.id);
    });
  });

  describe('Load Testing', () => {
    it('should maintain performance under sustained load', async () => {
      const duration = 30000; // 30 seconds
      const rps = 5; // 5 requests per second
      const interval = 1000 / rps;
      
      const startTime = Date.now();
      const results: { success: boolean; duration: number; timestamp: number }[] = [];
      
      const makeRequest = async () => {
        const reqStart = performance.now();
        
        try {
          const response = await request(app)
            .post('/api/questions/select')
            .send({
              businessId,
              customerCount: Math.floor(Math.random() * 50) + 1,
              timeBudgetSeconds: 90
            });
          
          const reqEnd = performance.now();
          const reqDuration = reqEnd - reqStart;
          
          results.push({
            success: response.status === 200,
            duration: reqDuration,
            timestamp: Date.now()
          });
        } catch (error) {
          results.push({
            success: false,
            duration: 0,
            timestamp: Date.now()
          });
        }
      };

      // Start load testing
      const intervalId = setInterval(makeRequest, interval);

      // Wait for test duration
      await new Promise(resolve => setTimeout(resolve, duration));
      
      // Stop load testing
      clearInterval(intervalId);

      // Analyze results
      const totalRequests = results.length;
      const successfulRequests = results.filter(r => r.success).length;
      const successRate = successfulRequests / totalRequests;
      const avgDuration = results
        .filter(r => r.success)
        .reduce((sum, r) => sum + r.duration, 0) / successfulRequests;

      console.log(`Load test results:`);
      console.log(`- Total requests: ${totalRequests}`);
      console.log(`- Success rate: ${(successRate * 100).toFixed(2)}%`);
      console.log(`- Average response time: ${avgDuration.toFixed(2)}ms`);

      // Performance should remain stable under load
      expect(successRate).toBeGreaterThan(0.95); // 95% success rate
      expect(avgDuration).toBeLessThan(200); // Average response time under 200ms
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should not have memory leaks during extended operation', async () => {
      const initialMemory = process.memoryUsage();
      
      // Perform many operations
      for (let i = 0; i < 100; i++) {
        await request(app)
          .post('/api/questions/select')
          .send({
            businessId,
            customerCount: i + 1,
            timeBudgetSeconds: 90
          });

        // Trigger garbage collection occasionally
        if (i % 20 === 0 && global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreasePercent = (memoryIncrease / initialMemory.heapUsed) * 100;

      console.log(`Memory usage increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB (${memoryIncreasePercent.toFixed(2)}%)`);

      // Memory increase should be reasonable (less than 50% increase)
      expect(memoryIncreasePercent).toBeLessThan(50);
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid sequential requests efficiently', async () => {
      const requests = 50;
      const startTime = performance.now();

      // Make requests sequentially as fast as possible
      for (let i = 0; i < requests; i++) {
        const response = await request(app)
          .post('/api/questions/select')
          .send({
            businessId,
            customerCount: i + 1,
            timeBudgetSeconds: 90
          });

        expect(response.status).toBe(200);
      }

      const endTime = performance.now();
      const totalDuration = endTime - startTime;
      const avgPerRequest = totalDuration / requests;

      console.log(`${requests} sequential requests: ${totalDuration.toFixed(2)}ms total, ${avgPerRequest.toFixed(2)}ms per request`);

      expect(avgPerRequest).toBeLessThan(100); // Should maintain performance
    });

    it('should handle malformed requests without performance degradation', async () => {
      const measurements: number[] = [];
      const iterations = 20;

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        
        // Send malformed request
        const response = await request(app)
          .post('/api/calls/initiate')
          .send({
            invalidField: 'test',
            missingRequired: true
          });

        const endTime = performance.now();
        const duration = endTime - startTime;
        measurements.push(duration);

        expect(response.status).toBe(400); // Should fail fast
      }

      const avgDuration = measurements.reduce((a, b) => a + b) / measurements.length;
      console.log(`Malformed request handling: ${avgDuration.toFixed(2)}ms average`);

      // Error handling should be fast
      expect(avgDuration).toBeLessThan(50);
    });
  });
});