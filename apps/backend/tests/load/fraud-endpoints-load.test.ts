import { performance } from 'perf_hooks';
import autocannon from 'autocannon';
import type { Result } from 'autocannon';

/**
 * Load Testing for Fraud Detection Endpoints
 * 
 * Tests system behavior under load:
 * - Concurrent requests handling
 * - Response time degradation
 * - Error rates under stress
 * - Throughput metrics
 * - Resource utilization
 * 
 * Requirements:
 * - Fraud detection endpoint should handle 100 req/s
 * - P95 latency should remain <500ms under load
 * - Error rate should be <1% under normal load
 */

describe('Fraud Detection Endpoints Load Testing', () => {
  const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3001';
  const FRAUD_ANALYZE_ENDPOINT = `${BASE_URL}/api/fraud/analyze`;
  const FRAUD_PATTERNS_ENDPOINT = `${BASE_URL}/api/fraud/patterns`;
  
  // Sample request payloads
  const sampleAnalyzeRequest = {
    phone_hash: 'load-test-hash-12345',
    call_transcript: 'Hej! Jag ringer angående min beställning från er butik i Stockholm. Maten var kall när den kom och personalen var inte särskilt hjälpsam.',
    feedback_content: 'Kall mat, otrevlig personal',
    store_id: 'store-stockholm-1',
    customer_context: {
      previous_calls: 2,
      last_call_date: new Date(Date.now() - 3600000).toISOString(),
      location_history: ['Stockholm']
    }
  };

  describe('POST /api/fraud/analyze Load Tests', () => {
    test('should handle moderate load (50 req/s for 30 seconds)', async () => {
      const loadTest = autocannon({
        url: FRAUD_ANALYZE_ENDPOINT,
        connections: 10,
        duration: 30,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify(sampleAnalyzeRequest)
      });

      const result: Result = await new Promise((resolve, reject) => {
        autocannon.track(loadTest, { renderResultsTable: false });
        loadTest.on('done', resolve);
        loadTest.on('error', reject);
      });

      // Assertions
      expect(result.requests.average).toBeGreaterThan(40); // Should handle at least 40 req/s
      expect(result.latency.p95).toBeLessThan(500); // P95 should be under 500ms
      expect(result.errors).toBe(0); // No errors expected under moderate load
      
      console.log('Moderate Load Test Results:');
      console.log(`- Average Requests/sec: ${result.requests.average}`);
      console.log(`- P50 Latency: ${result.latency.p50}ms`);
      console.log(`- P95 Latency: ${result.latency.p95}ms`);
      console.log(`- P99 Latency: ${result.latency.p99}ms`);
      console.log(`- Total Requests: ${result.requests.total}`);
      console.log(`- Errors: ${result.errors}`);
    }, 45000);

    test('should handle high load (100 req/s for 60 seconds)', async () => {
      const loadTest = autocannon({
        url: FRAUD_ANALYZE_ENDPOINT,
        connections: 20,
        duration: 60,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify(sampleAnalyzeRequest)
      });

      const result: Result = await new Promise((resolve, reject) => {
        autocannon.track(loadTest, { renderResultsTable: false });
        loadTest.on('done', resolve);
        loadTest.on('error', reject);
      });

      // Assertions
      expect(result.requests.average).toBeGreaterThan(80); // Should handle at least 80 req/s
      expect(result.latency.p95).toBeLessThan(600); // P95 may degrade slightly under high load
      expect(result.errors).toBeLessThan(result.requests.total * 0.01); // Error rate <1%
      
      console.log('High Load Test Results:');
      console.log(`- Average Requests/sec: ${result.requests.average}`);
      console.log(`- P50 Latency: ${result.latency.p50}ms`);
      console.log(`- P95 Latency: ${result.latency.p95}ms`);
      console.log(`- P99 Latency: ${result.latency.p99}ms`);
      console.log(`- Total Requests: ${result.requests.total}`);
      console.log(`- Errors: ${result.errors}`);
      console.log(`- Error Rate: ${((result.errors / result.requests.total) * 100).toFixed(2)}%`);
    }, 75000);

    test('should handle spike load (200 connections burst)', async () => {
      const loadTest = autocannon({
        url: FRAUD_ANALYZE_ENDPOINT,
        connections: 200,
        duration: 10,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify(sampleAnalyzeRequest)
      });

      const result: Result = await new Promise((resolve, reject) => {
        autocannon.track(loadTest, { renderResultsTable: false });
        loadTest.on('done', resolve);
        loadTest.on('error', reject);
      });

      // During spike load, system should not crash
      expect(result.requests.total).toBeGreaterThan(0);
      expect(result.latency.p99).toBeLessThan(2000); // P99 under spike should be reasonable
      expect(result.errors / result.requests.total).toBeLessThan(0.05); // Error rate <5% during spike
      
      console.log('Spike Load Test Results:');
      console.log(`- Average Requests/sec: ${result.requests.average}`);
      console.log(`- P95 Latency: ${result.latency.p95}ms`);
      console.log(`- P99 Latency: ${result.latency.p99}ms`);
      console.log(`- Total Requests: ${result.requests.total}`);
      console.log(`- Errors: ${result.errors}`);
      console.log(`- Error Rate: ${((result.errors / result.requests.total) * 100).toFixed(2)}%`);
    }, 20000);

    test('should maintain performance with varied payload sizes', async () => {
      // Create different payload sizes
      const smallPayload = { ...sampleAnalyzeRequest };
      const mediumPayload = {
        ...sampleAnalyzeRequest,
        call_transcript: sampleAnalyzeRequest.call_transcript.repeat(5)
      };
      const largePayload = {
        ...sampleAnalyzeRequest,
        call_transcript: sampleAnalyzeRequest.call_transcript.repeat(20)
      };

      const payloads = [smallPayload, mediumPayload, largePayload];
      const results: Result[] = [];

      for (const payload of payloads) {
        const loadTest = autocannon({
          url: FRAUD_ANALYZE_ENDPOINT,
          connections: 10,
          duration: 15,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token'
          },
          body: JSON.stringify(payload)
        });

        const result: Result = await new Promise((resolve, reject) => {
          autocannon.track(loadTest, { renderResultsTable: false });
          loadTest.on('done', resolve);
          loadTest.on('error', reject);
        });

        results.push(result);
      }

      // All payload sizes should perform adequately
      results.forEach((result, index) => {
        const size = index === 0 ? 'Small' : index === 1 ? 'Medium' : 'Large';
        expect(result.requests.average).toBeGreaterThan(20);
        expect(result.latency.p95).toBeLessThan(800);
        
        console.log(`${size} Payload Results:`);
        console.log(`- Average Requests/sec: ${result.requests.average}`);
        console.log(`- P95 Latency: ${result.latency.p95}ms`);
      });
    }, 60000);
  });

  describe('GET /api/fraud/patterns/:phone_hash Load Tests', () => {
    test('should handle pattern retrieval under moderate load', async () => {
      const loadTest = autocannon({
        url: `${FRAUD_PATTERNS_ENDPOINT}/test-phone-hash-123`,
        connections: 15,
        duration: 30,
        method: 'GET',
        headers: {
          'Authorization': 'Bearer test-token'
        }
      });

      const result: Result = await new Promise((resolve, reject) => {
        autocannon.track(loadTest, { renderResultsTable: false });
        loadTest.on('done', resolve);
        loadTest.on('error', reject);
      });

      expect(result.requests.average).toBeGreaterThan(50); // GET should be faster
      expect(result.latency.p95).toBeLessThan(200); // GET operations should be very fast
      expect(result.errors).toBe(0);
      
      console.log('Pattern Retrieval Load Test Results:');
      console.log(`- Average Requests/sec: ${result.requests.average}`);
      console.log(`- P95 Latency: ${result.latency.p95}ms`);
      console.log(`- Total Requests: ${result.requests.total}`);
    }, 40000);
  });

  describe('Sustained Load Testing', () => {
    test('should maintain performance during 5-minute sustained load', async () => {
      const duration = 300; // 5 minutes
      const loadTest = autocannon({
        url: FRAUD_ANALYZE_ENDPOINT,
        connections: 15,
        duration: duration,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify(sampleAnalyzeRequest)
      });

      const checkpoints: Array<{ time: number; latency: number }> = [];
      
      // Track performance at regular intervals
      const interval = setInterval(() => {
        // @ts-ignore - accessing internal state
        const currentLatency = loadTest.latency?.p95 || 0;
        checkpoints.push({
          time: Date.now(),
          latency: currentLatency
        });
      }, 30000); // Every 30 seconds

      const result: Result = await new Promise((resolve, reject) => {
        autocannon.track(loadTest, { renderResultsTable: false });
        loadTest.on('done', resolve);
        loadTest.on('error', reject);
      });

      clearInterval(interval);

      // Performance should remain consistent throughout the test
      expect(result.requests.average).toBeGreaterThan(40);
      expect(result.latency.p95).toBeLessThan(600);
      
      // Check for performance degradation over time
      if (checkpoints.length > 1) {
        const firstCheckpoint = checkpoints[0].latency;
        const lastCheckpoint = checkpoints[checkpoints.length - 1].latency;
        const degradation = ((lastCheckpoint - firstCheckpoint) / firstCheckpoint) * 100;
        
        expect(degradation).toBeLessThan(50); // Less than 50% degradation
        
        console.log('Sustained Load Test Results:');
        console.log(`- Duration: ${duration}s`);
        console.log(`- Average Requests/sec: ${result.requests.average}`);
        console.log(`- P95 Latency: ${result.latency.p95}ms`);
        console.log(`- Performance Degradation: ${degradation.toFixed(2)}%`);
      }
    }, 330000);
  });

  describe('Concurrent Endpoint Load Testing', () => {
    test('should handle concurrent load on multiple endpoints', async () => {
      // Test both analyze and pattern endpoints simultaneously
      const analyzeTest = autocannon({
        url: FRAUD_ANALYZE_ENDPOINT,
        connections: 10,
        duration: 30,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify(sampleAnalyzeRequest)
      });

      const patternsTest = autocannon({
        url: `${FRAUD_PATTERNS_ENDPOINT}/concurrent-test-hash`,
        connections: 10,
        duration: 30,
        method: 'GET',
        headers: {
          'Authorization': 'Bearer test-token'
        }
      });

      const [analyzeResult, patternsResult]: Result[] = await Promise.all([
        new Promise((resolve, reject) => {
          autocannon.track(analyzeTest, { renderResultsTable: false });
          analyzeTest.on('done', resolve);
          analyzeTest.on('error', reject);
        }),
        new Promise((resolve, reject) => {
          autocannon.track(patternsTest, { renderResultsTable: false });
          patternsTest.on('done', resolve);
          patternsTest.on('error', reject);
        })
      ]);

      // Both endpoints should perform adequately under concurrent load
      expect(analyzeResult.requests.average).toBeGreaterThan(30);
      expect(patternsResult.requests.average).toBeGreaterThan(40);
      expect(analyzeResult.latency.p95).toBeLessThan(600);
      expect(patternsResult.latency.p95).toBeLessThan(300);
      
      console.log('Concurrent Endpoint Load Test Results:');
      console.log('Analyze Endpoint:');
      console.log(`- Average Requests/sec: ${analyzeResult.requests.average}`);
      console.log(`- P95 Latency: ${analyzeResult.latency.p95}ms`);
      console.log('Patterns Endpoint:');
      console.log(`- Average Requests/sec: ${patternsResult.requests.average}`);
      console.log(`- P95 Latency: ${patternsResult.latency.p95}ms`);
    }, 45000);
  });

  describe('Recovery and Resilience Testing', () => {
    test('should recover from overload gracefully', async () => {
      // Phase 1: Normal load
      const normalLoadTest = autocannon({
        url: FRAUD_ANALYZE_ENDPOINT,
        connections: 10,
        duration: 10,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify(sampleAnalyzeRequest)
      });

      const normalResult: Result = await new Promise((resolve, reject) => {
        autocannon.track(normalLoadTest, { renderResultsTable: false });
        normalLoadTest.on('done', resolve);
        normalLoadTest.on('error', reject);
      });

      // Phase 2: Overload
      const overloadTest = autocannon({
        url: FRAUD_ANALYZE_ENDPOINT,
        connections: 300,
        duration: 5,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify(sampleAnalyzeRequest)
      });

      await new Promise((resolve, reject) => {
        autocannon.track(overloadTest, { renderResultsTable: false });
        overloadTest.on('done', resolve);
        overloadTest.on('error', reject);
      });

      // Phase 3: Recovery - wait 5 seconds then test normal load again
      await new Promise(resolve => setTimeout(resolve, 5000));

      const recoveryTest = autocannon({
        url: FRAUD_ANALYZE_ENDPOINT,
        connections: 10,
        duration: 10,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify(sampleAnalyzeRequest)
      });

      const recoveryResult: Result = await new Promise((resolve, reject) => {
        autocannon.track(recoveryTest, { renderResultsTable: false });
        recoveryTest.on('done', resolve);
        recoveryTest.on('error', reject);
      });

      // System should recover to near-normal performance
      const recoveryPerformance = (recoveryResult.requests.average / normalResult.requests.average) * 100;
      expect(recoveryPerformance).toBeGreaterThan(80); // Should recover to at least 80% of normal
      
      console.log('Recovery Test Results:');
      console.log(`- Normal Load Req/sec: ${normalResult.requests.average}`);
      console.log(`- Recovery Load Req/sec: ${recoveryResult.requests.average}`);
      console.log(`- Recovery Performance: ${recoveryPerformance.toFixed(2)}%`);
    }, 45000);
  });
});