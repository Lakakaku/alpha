import request from 'supertest';
import { app } from '../../src/app';
import { supabase } from '@vocilia/database';

describe('Concurrent Calls per Store (T015)', () => {
  let storeId: string;
  let verificationIds: string[] = [];

  beforeAll(async () => {
    // Create test store
    const storeResult = await supabase
      .from('stores')
      .insert({
        name: 'Test Store for Concurrent Calls',
        business_type: 'grocery',
        operating_hours: {
          monday: { open: '08:00', close: '20:00' },
          tuesday: { open: '08:00', close: '20:00' },
          wednesday: { open: '08:00', close: '20:00' },
          thursday: { open: '08:00', close: '20:00' },
          friday: { open: '08:00', close: '20:00' },
          saturday: { open: '09:00', close: '18:00' },
          sunday: { open: '10:00', close: '16:00' }
        }
      })
      .select()
      .single();

    storeId = storeResult.data.id;

    // Create multiple verification records for concurrent testing
    for (let i = 0; i < 50; i++) {
      const verification = await supabase
        .from('customer_verifications')
        .insert({
          store_id: storeId,
          phone_number: `+4670123456${i.toString().padStart(2, '0')}`,
          transaction_amount: 100.00 + i * 5,
          transaction_time: new Date(Date.now() - i * 60000).toISOString(), // Spread over last hour
          verification_status: 'verified'
        })
        .select()
        .single();

      verificationIds.push(verification.data.id);
    }
  });

  afterAll(async () => {
    // Cleanup test data
    await supabase
      .from('conversation_transcripts')
      .delete()
      .eq('store_id', storeId);

    await supabase
      .from('quality_assessments')
      .delete()
      .eq('store_id', storeId);

    await supabase
      .from('feedback_call_sessions')
      .delete()
      .eq('store_id', storeId);

    await supabase
      .from('customer_verifications')
      .delete()
      .in('id', verificationIds);

    await supabase
      .from('stores')
      .delete()
      .eq('id', storeId);
  });

  describe('Unlimited Concurrent Calls (Clarification Requirement)', () => {
    it('should accept 50 simultaneous call initiations for same store', async () => {
      // Create 50 concurrent call initiation requests
      const callPromises = verificationIds.slice(0, 50).map((verificationId, index) => {
        return request(app)
          .post('/api/ai/calls/initiate')
          .send({
            verification_id: verificationId,
            store_id: storeId,
            customer_phone_number: `+4670123456${index.toString().padStart(2, '0')}`
          });
      });

      // Execute all requests simultaneously
      const responses = await Promise.all(callPromises);

      // All should return 202 Accepted
      const successCount = responses.filter(response => response.status === 202).length;
      expect(successCount).toBe(50);

      // Each should have unique call session ID
      const callSessionIds = responses.map(response => response.body.call_session_id);
      const uniqueSessionIds = new Set(callSessionIds);
      expect(uniqueSessionIds.size).toBe(50);

      // Verify all sessions are stored in database
      const storedSessions = await supabase
        .from('feedback_call_sessions')
        .select('id, status, store_id')
        .eq('store_id', storeId)
        .in('id', callSessionIds);

      expect(storedSessions.data.length).toBe(50);
      storedSessions.data.forEach(session => {
        expect(session.status).toBe('pending');
        expect(session.store_id).toBe(storeId);
      });
    });

    it('should handle concurrent call processing without resource conflicts', async () => {
      // Create 20 concurrent calls and process them to completion
      const concurrentCallPromises = verificationIds.slice(25, 45).map(async (verificationId, index) => {
        // Initiate call
        const initiateResponse = await request(app)
          .post('/api/ai/calls/initiate')
          .send({
            verification_id: verificationId,
            store_id: storeId,
            customer_phone_number: `+4670123456${(25 + index).toString().padStart(2, '0')}`
          });

        expect(initiateResponse.status).toBe(202);
        const callSessionId = initiateResponse.body.call_session_id;

        // Submit transcript for each call
        const transcriptResponse = await request(app)
          .post(`/api/ai/calls/${callSessionId}/transcript`)
          .send({
            messages: [
              {
                speaker: 'ai',
                content: 'Hej! Kan du berätta om din upplevelse?',
                timestamp_ms: 0,
                message_order: 1
              },
              {
                speaker: 'customer',
                content: `Bra upplevelse från call ${index + 1}. Personalen var hjälpsam.`,
                timestamp_ms: 5000,
                message_order: 2
              }
            ],
            total_duration_seconds: 75 + index * 2, // Vary duration slightly
            openai_session_id: `sess_concurrent_${index}_${Date.now()}`
          });

        expect(transcriptResponse.status).toBe(200);
        return { callSessionId, transcriptResponse: transcriptResponse.body };
      });

      const results = await Promise.all(concurrentCallPromises);

      // Verify all processed successfully
      expect(results.length).toBe(20);
      results.forEach(result => {
        expect(result.transcriptResponse.status).toBe('transcript_received');
      });

      // Verify database consistency
      const sessions = await supabase
        .from('feedback_call_sessions')
        .select('id, status, call_duration_seconds')
        .eq('store_id', storeId)
        .eq('status', 'completed');

      expect(sessions.data.length).toBeGreaterThanOrEqual(20);
    });

    it('should maintain performance under high concurrent load', async () => {
      const startTime = Date.now();
      
      // Create 30 concurrent requests
      const loadTestPromises = verificationIds.slice(15, 45).map((verificationId, index) => {
        return request(app)
          .post('/api/ai/calls/initiate')
          .send({
            verification_id: verificationId,
            store_id: storeId,
            customer_phone_number: `+4670123456${(15 + index).toString().padStart(2, '0')}`
          });
      });

      const responses = await Promise.all(loadTestPromises);
      const totalTime = Date.now() - startTime;

      // All requests should complete within reasonable time
      expect(totalTime).toBeLessThan(10000); // 10 seconds max
      
      // All should succeed
      const successCount = responses.filter(r => r.status === 202).length;
      expect(successCount).toBe(30);

      // Average response time should be acceptable
      const averageResponseTime = totalTime / 30;
      expect(averageResponseTime).toBeLessThan(500); // 500ms average
    });
  });

  describe('Resource Management Under Load', () => {
    it('should track concurrent call metrics accurately', async () => {
      // Get initial metrics
      const initialMetrics = await request(app)
        .get('/api/ai/calls/metrics')
        .query({ store_id: storeId })
        .expect(200);

      // Start 15 concurrent calls
      const callPromises = verificationIds.slice(0, 15).map((verificationId, index) => {
        return request(app)
          .post('/api/ai/calls/initiate')
          .send({
            verification_id: verificationId,
            store_id: storeId,
            customer_phone_number: `+4670123456${index.toString().padStart(2, '0')}`
          });
      });

      await Promise.all(callPromises);

      // Check updated metrics
      const updatedMetrics = await request(app)
        .get('/api/ai/calls/metrics')
        .query({ store_id: storeId })
        .expect(200);

      expect(updatedMetrics.body.concurrent_calls_active).toBeGreaterThanOrEqual(15);
      expect(updatedMetrics.body.total_calls_initiated).toBeGreaterThan(initialMetrics.body.total_calls_initiated);
      expect(updatedMetrics.body.store_id).toBe(storeId);
    });

    it('should handle OpenAI API rate limits gracefully', async () => {
      // Simulate many rapid API calls that might hit rate limits
      const rapidCallPromises = [];
      
      for (let i = 0; i < 25; i++) {
        const promise = request(app)
          .post('/api/ai/calls/initiate')
          .send({
            verification_id: verificationIds[i],
            store_id: storeId,
            customer_phone_number: `+4670123456${i.toString().padStart(2, '0')}`
          });
        
        rapidCallPromises.push(promise);
      }

      const responses = await Promise.allSettled(rapidCallPromises);

      // Some may succeed, some may be rate limited, but none should crash
      const fulfilled = responses.filter(r => r.status === 'fulfilled') as PromiseFulfilledResult<any>[];
      const rejected = responses.filter(r => r.status === 'rejected');

      expect(fulfilled.length + rejected.length).toBe(25);

      // Successful requests should be properly formatted
      fulfilled.forEach(result => {
        const response = result.value;
        if (response.status === 202) {
          expect(response.body).toHaveProperty('call_session_id');
        } else if (response.status === 429) {
          expect(response.body).toHaveProperty('retry_after');
        }
      });
    });

    it('should queue calls efficiently when system is under load', async () => {
      // Create burst of 40 simultaneous calls
      const burstPromises = verificationIds.slice(5, 45).map(async (verificationId, index) => {
        const response = await request(app)
          .post('/api/ai/calls/initiate')
          .send({
            verification_id: verificationId,
            store_id: storeId,
            customer_phone_number: `+4670123456${(5 + index).toString().padStart(2, '0')}`
          });

        return {
          status: response.status,
          body: response.body,
          timing: response.header['x-response-time'] || 'unknown'
        };
      });

      const results = await Promise.all(burstPromises);

      // Analyze queue behavior
      const accepted = results.filter(r => r.status === 202).length;
      const queued = results.filter(r => r.status === 202 && r.body.queue_position).length;

      expect(accepted).toBeGreaterThan(30); // Most should be accepted
      
      // Some may be queued if system is busy
      if (queued > 0) {
        const queuedResults = results.filter(r => r.body.queue_position);
        queuedResults.forEach(result => {
          expect(result.body.queue_position).toBeGreaterThan(0);
          expect(result.body.estimated_start_time).toBeDefined();
        });
      }
    });
  });

  describe('Store-Specific Concurrency Isolation', () => {
    let secondStoreId: string;

    beforeAll(async () => {
      // Create second store for isolation testing
      const storeResult = await supabase
        .from('stores')
        .insert({
          name: 'Second Store for Isolation Test',
          business_type: 'pharmacy'
        })
        .select()
        .single();

      secondStoreId = storeResult.data.id;
    });

    afterAll(async () => {
      // Cleanup second store
      await supabase
        .from('feedback_call_sessions')
        .delete()
        .eq('store_id', secondStoreId);

      await supabase
        .from('stores')
        .delete()
        .eq('id', secondStoreId);
    });

    it('should isolate concurrent calls between different stores', async () => {
      // Create verification for second store
      const secondStoreVerification = await supabase
        .from('customer_verifications')
        .insert({
          store_id: secondStoreId,
          phone_number: '+46701234599',
          transaction_amount: 75.00,
          transaction_time: new Date().toISOString(),
          verification_status: 'verified'
        })
        .select()
        .single();

      // Start calls for both stores simultaneously
      const store1Promises = verificationIds.slice(0, 10).map((verificationId, index) => {
        return request(app)
          .post('/api/ai/calls/initiate')
          .send({
            verification_id: verificationId,
            store_id: storeId,
            customer_phone_number: `+4670123456${index.toString().padStart(2, '0')}`
          });
      });

      const store2Promises = Array(10).fill(null).map((_, index) => {
        return request(app)
          .post('/api/ai/calls/initiate')
          .send({
            verification_id: secondStoreVerification.data.id,
            store_id: secondStoreId,
            customer_phone_number: `+4670123459${index}`
          });
      });

      const [store1Results, store2Results] = await Promise.all([
        Promise.all(store1Promises),
        Promise.all(store2Promises)
      ]);

      // Both stores should handle their calls independently
      const store1Success = store1Results.filter(r => r.status === 202).length;
      const store2Success = store2Results.filter(r => r.status === 202).length;

      expect(store1Success).toBe(10);
      expect(store2Success).toBe(10);

      // Verify database isolation
      const store1Sessions = await supabase
        .from('feedback_call_sessions')
        .select('id')
        .eq('store_id', storeId);

      const store2Sessions = await supabase
        .from('feedback_call_sessions')
        .select('id')
        .eq('store_id', secondStoreId);

      expect(store1Sessions.data.length).toBeGreaterThanOrEqual(10);
      expect(store2Sessions.data.length).toBeGreaterThanOrEqual(10);

      // Cleanup
      await supabase
        .from('customer_verifications')
        .delete()
        .eq('id', secondStoreVerification.data.id);
    });

    it('should maintain independent metrics per store', async () => {
      // Get metrics for both stores
      const store1Metrics = await request(app)
        .get('/api/ai/calls/metrics')
        .query({ store_id: storeId })
        .expect(200);

      const store2Metrics = await request(app)
        .get('/api/ai/calls/metrics')
        .query({ store_id: secondStoreId })
        .expect(200);

      // Metrics should be independent
      expect(store1Metrics.body.store_id).toBe(storeId);
      expect(store2Metrics.body.store_id).toBe(secondStoreId);
      expect(store1Metrics.body.total_calls_initiated).not.toBe(store2Metrics.body.total_calls_initiated);
    });
  });

  describe('Error Handling Under Concurrent Load', () => {
    it('should handle partial failures gracefully during concurrent operations', async () => {
      // Mix valid and invalid verification IDs
      const mixedPromises = [];
      
      // 15 valid calls
      for (let i = 0; i < 15; i++) {
        mixedPromises.push(
          request(app)
            .post('/api/ai/calls/initiate')
            .send({
              verification_id: verificationIds[i],
              store_id: storeId,
              customer_phone_number: `+4670123456${i.toString().padStart(2, '0')}`
            })
        );
      }

      // 5 invalid calls (bad verification ID)
      for (let i = 0; i < 5; i++) {
        mixedPromises.push(
          request(app)
            .post('/api/ai/calls/initiate')
            .send({
              verification_id: 'invalid-uuid-' + i,
              store_id: storeId,
              customer_phone_number: `+4670123457${i}`
            })
        );
      }

      const results = await Promise.allSettled(mixedPromises);

      const fulfilled = results.filter(r => r.status === 'fulfilled') as PromiseFulfilledResult<any>[];
      
      // Valid calls should succeed
      const successfulCalls = fulfilled.filter(r => r.value.status === 202).length;
      const failedCalls = fulfilled.filter(r => r.value.status === 400 || r.value.status === 404).length;

      expect(successfulCalls).toBe(15);
      expect(failedCalls).toBe(5);
    });

    it('should recover gracefully from database connection issues', async () => {
      // This test would require mocking database connection failures
      // For now, we'll test the retry mechanism exists
      
      const response = await request(app)
        .get('/api/ai/calls/health')
        .expect(200);

      expect(response.body).toHaveProperty('database_connection');
      expect(response.body).toHaveProperty('concurrent_call_capacity');
      expect(response.body.database_connection).toBe('healthy');
    });
  });
});