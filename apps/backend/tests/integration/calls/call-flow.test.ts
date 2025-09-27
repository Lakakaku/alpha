import request from 'supertest';
import { app } from '../../../src/app';

describe('Complete Call Flow Integration Test', () => {
  // This test MUST FAIL initially since the endpoints and services don't exist yet
  // This is part of the TDD (Test-Driven Development) approach
  // Tests the entire call lifecycle from initiation to completion

  let callSessionId: string;
  const businessId = '550e8400-e29b-41d4-a716-446655440000';
  const verificationId = '550e8400-e29b-41d4-a716-446655440100';
  const customerPhone = '+46701234567';

  describe('End-to-End Call Flow', () => {
    it('should complete entire call lifecycle successfully', async () => {
      // Step 1: Initiate the call
      const initiateResponse = await request(app)
        .post('/api/calls/initiate')
        .send({
          verificationId,
          businessId,
          customerPhone,
          priority: 'normal'
        })
        .expect(201);

      expect(initiateResponse.body.success).toBe(true);
      expect(initiateResponse.body.data.status).toBe('initiated');
      callSessionId = initiateResponse.body.data.id;

      // Step 2: Select questions for the call
      const questionSelectionResponse = await request(app)
        .post('/api/questions/select')
        .send({
          businessId,
          customerCount: 1,
          timeBudgetSeconds: 90,
          customerContext: {
            department: 'electronics',
            visitTime: new Date().toISOString()
          }
        })
        .expect(200);

      expect(questionSelectionResponse.body.success).toBe(true);
      expect(questionSelectionResponse.body.data.selectedQuestions.length).toBeGreaterThan(0);

      const selectedQuestions = questionSelectionResponse.body.data.selectedQuestions;

      // Step 3: Monitor call status during progress
      // Simulate call progression through different states
      let currentStatus = 'initiated';
      let attempts = 0;
      const maxAttempts = 10;

      while (currentStatus !== 'in_progress' && attempts < maxAttempts) {
        const statusResponse = await request(app)
          .get(`/api/calls/${callSessionId}/status`)
          .expect(200);

        expect(statusResponse.body.success).toBe(true);
        currentStatus = statusResponse.body.data.status;
        
        // Valid status progression: initiated -> connecting -> in_progress
        expect(['initiated', 'connecting', 'in_progress', 'failed']).toContain(currentStatus);

        if (currentStatus === 'failed') {
          throw new Error('Call failed during progression');
        }

        attempts++;
        
        // Small delay to simulate real-time monitoring
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Step 4: Verify call is in progress
      const inProgressResponse = await request(app)
        .get(`/api/calls/${callSessionId}/status`)
        .expect(200);

      expect(inProgressResponse.body.data.status).toBeOneOf(['connecting', 'in_progress']);
      if (inProgressResponse.body.data.status === 'in_progress') {
        expect(inProgressResponse.body.data.connectedAt).not.toBeNull();
      }

      // Step 5: Complete the call with responses
      const callResponses = selectedQuestions.map((question: any, index: number) => ({
        questionId: question.id,
        questionText: question.questionText,
        responseText: `Detta är mitt svar på fråga ${index + 1}. Jag är mycket nöjd med upplevelsen.`,
        responseDuration: 10 + index * 5, // Varying response times
        confidenceScore: 0.9,
        sentimentScore: 0.7,
        askedAt: new Date(Date.now() - (selectedQuestions.length - index) * 15000).toISOString(),
        respondedAt: new Date(Date.now() - (selectedQuestions.length - index - 1) * 15000).toISOString()
      }));

      const completeResponse = await request(app)
        .post(`/api/calls/${callSessionId}/complete`)
        .send({
          reason: 'completed',
          transcript: 'Hej! Tack för att du deltog i vår undersökning. ' + 
                     callResponses.map(r => `Fråga: ${r.questionText} Svar: ${r.responseText}`).join(' '),
          responses: callResponses
        })
        .expect(200);

      expect(completeResponse.body.success).toBe(true);
      expect(completeResponse.body.data.status).toBe('completed');
      expect(completeResponse.body.data.endedAt).not.toBeNull();
      expect(completeResponse.body.data.durationSeconds).toBeGreaterThan(0);
      expect(completeResponse.body.data.durationSeconds).toBeLessThanOrEqual(120);

      // Step 6: Verify final call status
      const finalStatusResponse = await request(app)
        .get(`/api/calls/${callSessionId}/status`)
        .expect(200);

      expect(finalStatusResponse.body.data.status).toBe('completed');
      expect(finalStatusResponse.body.data.questionsAsked).toEqual(
        expect.arrayContaining(selectedQuestions.map((q: any) => q.id))
      );
      expect(finalStatusResponse.body.data.costEstimate).toBeGreaterThan(0);
      expect(finalStatusResponse.body.data.costEstimate).toBeLessThanOrEqual(0.25);
    });

    it('should handle call timeout scenario', async () => {
      // Step 1: Initiate a call that will timeout
      const initiateResponse = await request(app)
        .post('/api/calls/initiate')
        .send({
          verificationId: '550e8400-e29b-41d4-a716-446655440101',
          businessId,
          customerPhone: '+46707654321', // Different phone for timeout scenario
          priority: 'normal'
        })
        .expect(201);

      const timeoutSessionId = initiateResponse.body.data.id;

      // Step 2: Simulate timeout completion
      const timeoutResponse = await request(app)
        .post(`/api/calls/${timeoutSessionId}/complete`)
        .send({
          reason: 'timeout',
          transcript: 'Hej! Tack för att du deltog i vår undersökning. Tyvärr fick vi ingen kontakt.',
          responses: []
        })
        .expect(200);

      expect(timeoutResponse.body.success).toBe(true);
      expect(timeoutResponse.body.data.status).toBe('timeout');

      // Step 3: Verify timeout status
      const statusResponse = await request(app)
        .get(`/api/calls/${timeoutSessionId}/status`)
        .expect(200);

      expect(statusResponse.body.data.status).toBe('timeout');
      expect(statusResponse.body.data.questionsAsked).toEqual([]);
    });

    it('should handle technical failure scenario', async () => {
      // Step 1: Initiate a call that will fail
      const initiateResponse = await request(app)
        .post('/api/calls/initiate')
        .send({
          verificationId: '550e8400-e29b-41d4-a716-446655440102',
          businessId,
          customerPhone: '+46708765432',
          priority: 'normal'
        })
        .expect(201);

      const failedSessionId = initiateResponse.body.data.id;

      // Step 2: Simulate technical failure
      const failureResponse = await request(app)
        .post(`/api/calls/${failedSessionId}/complete`)
        .send({
          reason: 'technical_failure',
          transcript: null
        })
        .expect(200);

      expect(failureResponse.body.success).toBe(true);
      expect(failureResponse.body.data.status).toBe('failed');

      // Step 3: Verify failure status
      const statusResponse = await request(app)
        .get(`/api/calls/${failedSessionId}/status`)
        .expect(200);

      expect(statusResponse.body.data.status).toBe('failed');
    });

    it('should handle partial response scenario', async () => {
      // Step 1: Initiate call
      const initiateResponse = await request(app)
        .post('/api/calls/initiate')
        .send({
          verificationId: '550e8400-e29b-41d4-a716-446655440103',
          businessId,
          customerPhone: '+46709876543',
          priority: 'normal'
        })
        .expect(201);

      const partialSessionId = initiateResponse.body.data.id;

      // Step 2: Get questions
      const questionSelectionResponse = await request(app)
        .post('/api/questions/select')
        .send({
          businessId,
          customerCount: 1,
          timeBudgetSeconds: 90
        })
        .expect(200);

      const questions = questionSelectionResponse.body.data.selectedQuestions;

      // Step 3: Complete with only partial responses (customer hung up)
      const partialResponses = questions.slice(0, Math.floor(questions.length / 2)).map((question: any, index: number) => ({
        questionId: question.id,
        questionText: question.questionText,
        responseText: `Svar på fråga ${index + 1}`,
        responseDuration: 8,
        confidenceScore: 0.85,
        sentimentScore: 0.3,
        askedAt: new Date(Date.now() - (questions.length - index) * 10000).toISOString(),
        respondedAt: new Date(Date.now() - (questions.length - index - 1) * 10000).toISOString()
      }));

      const partialResponse = await request(app)
        .post(`/api/calls/${partialSessionId}/complete`)
        .send({
          reason: 'customer_hangup',
          transcript: 'Hej! Tack för att du deltog... [kunden lade på]',
          responses: partialResponses
        })
        .expect(200);

      expect(partialResponse.body.success).toBe(true);
      expect(partialResponse.body.data.status).toBe('completed');

      // Step 4: Verify partial completion
      const statusResponse = await request(app)
        .get(`/api/calls/${partialSessionId}/status`)
        .expect(200);

      expect(statusResponse.body.data.questionsAsked.length).toBeLessThan(questions.length);
      expect(statusResponse.body.data.durationSeconds).toBeGreaterThan(0);
    });
  });

  describe('Call Flow Error Handling', () => {
    it('should handle invalid verification during initiation', async () => {
      const response = await request(app)
        .post('/api/calls/initiate')
        .send({
          verificationId: '99999999-9999-9999-9999-999999999999',
          businessId,
          customerPhone,
          priority: 'normal'
        })
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VERIFICATION_NOT_FOUND');
    });

    it('should handle unauthorized business access', async () => {
      const unauthorizedBusinessId = '99999999-9999-9999-9999-999999999999';

      const response = await request(app)
        .post('/api/calls/initiate')
        .send({
          verificationId,
          businessId: unauthorizedBusinessId,
          customerPhone,
          priority: 'normal'
        })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('ACCESS_DENIED');
    });

    it('should handle completion of non-existent session', async () => {
      const response = await request(app)
        .post('/api/calls/99999999-9999-9999-9999-999999999999/complete')
        .send({
          reason: 'completed',
          transcript: 'Test'
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('CALL_SESSION_NOT_FOUND');
    });

    it('should handle double completion of same session', async () => {
      // First, initiate and complete a call
      const initiateResponse = await request(app)
        .post('/api/calls/initiate')
        .send({
          verificationId: '550e8400-e29b-41d4-a716-446655440104',
          businessId,
          customerPhone: '+46701111111',
          priority: 'normal'
        })
        .expect(201);

      const sessionId = initiateResponse.body.data.id;

      // Complete the call
      await request(app)
        .post(`/api/calls/${sessionId}/complete`)
        .send({
          reason: 'completed',
          transcript: 'Test completion'
        })
        .expect(200);

      // Try to complete again
      const secondCompleteResponse = await request(app)
        .post(`/api/calls/${sessionId}/complete`)
        .send({
          reason: 'completed',
          transcript: 'Second completion attempt'
        })
        .expect(409);

      expect(secondCompleteResponse.body.success).toBe(false);
      expect(secondCompleteResponse.body.error.code).toBe('CALL_ALREADY_COMPLETED');
    });
  });

  describe('Performance and Constraints', () => {
    it('should enforce call duration limits', async () => {
      const initiateResponse = await request(app)
        .post('/api/calls/initiate')
        .send({
          verificationId: '550e8400-e29b-41d4-a716-446655440105',
          businessId,
          customerPhone: '+46702222222',
          priority: 'normal'
        })
        .expect(201);

      const sessionId = initiateResponse.body.data.id;

      // Simulate a call that exceeds the 2-minute limit
      const longCallResponse = await request(app)
        .post(`/api/calls/${sessionId}/complete`)
        .send({
          reason: 'timeout',
          transcript: 'Long call that exceeded time limit'
        })
        .expect(200);

      expect(longCallResponse.body.data.status).toBe('timeout');
      
      // Verify duration constraint
      const statusResponse = await request(app)
        .get(`/api/calls/${sessionId}/status`)
        .expect(200);

      if (statusResponse.body.data.durationSeconds) {
        expect(statusResponse.body.data.durationSeconds).toBeLessThanOrEqual(120);
      }
    });

    it('should enforce cost limits', async () => {
      const initiateResponse = await request(app)
        .post('/api/calls/initiate')
        .send({
          verificationId: '550e8400-e29b-41d4-a716-446655440106',
          businessId,
          customerPhone: '+46703333333',
          priority: 'normal'
        })
        .expect(201);

      const sessionId = initiateResponse.body.data.id;

      await request(app)
        .post(`/api/calls/${sessionId}/complete`)
        .send({
          reason: 'completed',
          transcript: 'Cost verification test'
        })
        .expect(200);

      const statusResponse = await request(app)
        .get(`/api/calls/${sessionId}/status`)
        .expect(200);

      if (statusResponse.body.data.costEstimate) {
        expect(statusResponse.body.data.costEstimate).toBeLessThanOrEqual(0.25);
      }
    });

    it('should complete entire flow within performance limits', async () => {
      const startTime = Date.now();

      // Execute complete flow
      const initiateResponse = await request(app)
        .post('/api/calls/initiate')
        .send({
          verificationId: '550e8400-e29b-41d4-a716-446655440107',
          businessId,
          customerPhone: '+46704444444',
          priority: 'normal'
        })
        .expect(201);

      const sessionId = initiateResponse.body.data.id;

      await request(app)
        .post('/api/questions/select')
        .send({
          businessId,
          customerCount: 1,
          timeBudgetSeconds: 90
        })
        .expect(200);

      await request(app)
        .get(`/api/calls/${sessionId}/status`)
        .expect(200);

      await request(app)
        .post(`/api/calls/${sessionId}/complete`)
        .send({
          reason: 'completed',
          transcript: 'Performance test completion'
        })
        .expect(200);

      const totalTime = Date.now() - startTime;
      
      // Complete flow should finish within 5 seconds
      expect(totalTime).toBeLessThan(5000);
    });
  });
});