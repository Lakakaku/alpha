import request from 'supertest';
import { app } from '../../src/app';
import { supabase } from '@vocilia/database';

describe('Fraud Detection and Scoring (T014)', () => {
  let storeId: string;
  let verificationId: string;

  beforeAll(async () => {
    // Create test store with specific business hours
    const storeResult = await supabase
      .from('stores')
      .insert({
        name: 'Test Store for Fraud Detection',
        business_type: 'grocery',
        operating_hours: {
          monday: { open: '08:00', close: '20:00' },
          tuesday: { open: '08:00', close: '20:00' },
          wednesday: { open: '08:00', close: '20:00' },
          thursday: { open: '08:00', close: '20:00' },
          friday: { open: '08:00', close: '20:00' },
          saturday: { open: '09:00', close: '18:00' },
          sunday: { open: '10:00', close: '16:00' }
        },
        address: {
          street: 'Test Street 1',
          city: 'Stockholm',
          postal_code: '12345',
          country: 'SE'
        }
      })
      .select()
      .single();

    storeId = storeResult.data.id;

    // Create base verification record
    const verificationResult = await supabase
      .from('customer_verifications')
      .insert({
        store_id: storeId,
        phone_number: '+46701234567',
        transaction_amount: 125.50,
        transaction_time: new Date().toISOString(),
        verification_status: 'verified'
      })
      .select()
      .single();

    verificationId = verificationResult.data.id;
  });

  afterAll(async () => {
    // Cleanup test data
    await supabase
      .from('fraud_detection_results')
      .delete()
      .eq('store_id', storeId);

    await supabase
      .from('quality_assessments')
      .delete()
      .eq('store_id', storeId);

    await supabase
      .from('conversation_transcripts')
      .delete()
      .eq('store_id', storeId);

    await supabase
      .from('feedback_call_sessions')
      .delete()
      .eq('store_id', storeId);

    await supabase
      .from('customer_verifications')
      .delete()
      .eq('id', verificationId);

    await supabase
      .from('stores')
      .delete()
      .eq('id', storeId);
  });

  describe('Business Hours Fraud Detection (FR-011)', () => {
    it('should detect transactions outside business hours', async () => {
      // Create verification with transaction at 2 AM (store closed)
      const closedHoursVerification = await supabase
        .from('customer_verifications')
        .insert({
          store_id: storeId,
          phone_number: '+46701234568',
          transaction_amount: 85.00,
          transaction_time: '2025-09-23T02:00:00Z', // 2 AM Tuesday
          verification_status: 'verified'
        })
        .select()
        .single();

      // Create call session for this verification
      const callSession = await supabase
        .from('feedback_call_sessions')
        .insert({
          verification_id: closedHoursVerification.data.id,
          store_id: storeId,
          customer_phone_number: '+46701234568',
          status: 'pending',
          initiated_at: new Date().toISOString()
        })
        .select()
        .single();

      // Run fraud detection
      const response = await request(app)
        .post('/api/ai/analysis/fraud-detection')
        .send({
          call_session_id: callSession.data.id,
          analysis_types: ['timing', 'business_context'],
          verification_data: {
            transaction_time: '2025-09-23T02:00:00Z',
            store_operating_hours: {
              tuesday: { open: '08:00', close: '20:00' }
            }
          }
        })
        .expect(200);

      expect(response.body).toHaveProperty('is_fraudulent', true);
      expect(response.body).toHaveProperty('fraud_confidence_score');
      expect(response.body.fraud_confidence_score).toBeGreaterThan(0.8);
      expect(response.body.fraud_reasons).toContain('business_hours_violation');
      expect(response.body.risk_factors).toHaveProperty('timing_risk');
      expect(response.body.risk_factors.timing_risk).toBeGreaterThan(0.9);

      // Verify fraud detection result is stored
      const fraudResult = await supabase
        .from('fraud_detection_results')
        .select('*')
        .eq('call_session_id', callSession.data.id)
        .single();

      expect(fraudResult.data.is_fraudulent).toBe(true);
      expect(fraudResult.data.fraud_reasons).toContain('business_hours_violation');

      // Cleanup
      await supabase
        .from('customer_verifications')
        .delete()
        .eq('id', closedHoursVerification.data.id);
    });

    it('should validate legitimate transactions during business hours', async () => {
      // Create verification during normal business hours
      const businessHoursVerification = await supabase
        .from('customer_verifications')
        .insert({
          store_id: storeId,
          phone_number: '+46701234569',
          transaction_amount: 150.00,
          transaction_time: '2025-09-23T14:00:00Z', // 2 PM Tuesday
          verification_status: 'verified'
        })
        .select()
        .single();

      const callSession = await supabase
        .from('feedback_call_sessions')
        .insert({
          verification_id: businessHoursVerification.data.id,
          store_id: storeId,
          customer_phone_number: '+46701234569',
          status: 'pending',
          initiated_at: new Date().toISOString()
        })
        .select()
        .single();

      const response = await request(app)
        .post('/api/ai/analysis/fraud-detection')
        .send({
          call_session_id: callSession.data.id,
          analysis_types: ['timing', 'business_context'],
          verification_data: {
            transaction_time: '2025-09-23T14:00:00Z',
            store_operating_hours: {
              tuesday: { open: '08:00', close: '20:00' }
            }
          }
        })
        .expect(200);

      expect(response.body).toHaveProperty('is_fraudulent', false);
      expect(response.body.fraud_confidence_score).toBeLessThan(0.3);
      expect(response.body.risk_factors.timing_risk).toBeLessThan(0.2);

      // Cleanup
      await supabase
        .from('customer_verifications')
        .delete()
        .eq('id', businessHoursVerification.data.id);
    });
  });

  describe('Pattern-Based Fraud Detection', () => {
    it('should detect suspicious call patterns and timing', async () => {
      // Create multiple rapid calls from same number
      const rapidCallsPhoneNumber = '+46701234570';
      const callSessions = [];

      for (let i = 0; i < 5; i++) {
        const verification = await supabase
          .from('customer_verifications')
          .insert({
            store_id: storeId,
            phone_number: rapidCallsPhoneNumber,
            transaction_amount: 50.00 + i * 10,
            transaction_time: new Date(Date.now() - i * 60000).toISOString(), // 1 minute apart
            verification_status: 'verified'
          })
          .select()
          .single();

        const session = await supabase
          .from('feedback_call_sessions')
          .insert({
            verification_id: verification.data.id,
            store_id: storeId,
            customer_phone_number: rapidCallsPhoneNumber,
            status: 'completed',
            call_duration_seconds: 30 + i * 5, // Very short calls
            initiated_at: new Date(Date.now() - i * 60000).toISOString()
          })
          .select()
          .single();

        callSessions.push(session.data);
      }

      // Analyze pattern for latest call
      const response = await request(app)
        .post('/api/ai/analysis/fraud-detection')
        .send({
          call_session_id: callSessions[0].id,
          analysis_types: ['pattern', 'frequency'],
          lookback_hours: 24
        })
        .expect(200);

      expect(response.body.is_fraudulent).toBe(true);
      expect(response.body.fraud_reasons).toContain('suspicious_call_frequency');
      expect(response.body.risk_factors).toHaveProperty('pattern_risk');
      expect(response.body.risk_factors.pattern_risk).toBeGreaterThan(0.7);

      expect(response.body.pattern_analysis).toHaveProperty('call_frequency_last_hour');
      expect(response.body.pattern_analysis.call_frequency_last_hour).toBeGreaterThan(3);

      // Cleanup
      for (const session of callSessions) {
        await supabase
          .from('customer_verifications')
          .delete()
          .eq('id', session.verification_id);
      }
    });

    it('should detect abnormally short call durations', async () => {
      const shortCallVerification = await supabase
        .from('customer_verifications')
        .insert({
          store_id: storeId,
          phone_number: '+46701234571',
          transaction_amount: 200.00,
          transaction_time: new Date().toISOString(),
          verification_status: 'verified'
        })
        .select()
        .single();

      const shortCallSession = await supabase
        .from('feedback_call_sessions')
        .insert({
          verification_id: shortCallVerification.data.id,
          store_id: storeId,
          customer_phone_number: '+46701234571',
          status: 'completed',
          call_duration_seconds: 15, // Very short
          initiated_at: new Date().toISOString(),
          completed_at: new Date(Date.now() + 15000).toISOString()
        })
        .select()
        .single();

      // Create minimal transcript
      await supabase
        .from('conversation_transcripts')
        .insert({
          call_session_id: shortCallSession.data.id,
          store_id: storeId,
          messages: [
            {
              speaker: 'ai',
              content: 'Hej!',
              timestamp_ms: 0,
              message_order: 1
            },
            {
              speaker: 'customer',
              content: 'Ja ja bra',
              timestamp_ms: 3000,
              message_order: 2
            }
          ],
          total_duration_seconds: 15,
          language_detected: 'sv'
        });

      const response = await request(app)
        .post('/api/ai/analysis/fraud-detection')
        .send({
          call_session_id: shortCallSession.data.id,
          analysis_types: ['content', 'duration']
        })
        .expect(200);

      expect(response.body.is_fraudulent).toBe(true);
      expect(response.body.fraud_reasons).toContain('insufficient_call_duration');
      expect(response.body.risk_factors.content_risk).toBeGreaterThan(0.8);

      // Cleanup
      await supabase
        .from('customer_verifications')
        .delete()
        .eq('id', shortCallVerification.data.id);
    });
  });

  describe('Content-Based Fraud Detection', () => {
    it('should detect generic or scripted responses', async () => {
      const scriptedVerification = await supabase
        .from('customer_verifications')
        .insert({
          store_id: storeId,
          phone_number: '+46701234572',
          transaction_amount: 100.00,
          transaction_time: new Date().toISOString(),
          verification_status: 'verified'
        })
        .select()
        .single();

      const scriptedCallSession = await supabase
        .from('feedback_call_sessions')
        .insert({
          verification_id: scriptedVerification.data.id,
          store_id: storeId,
          customer_phone_number: '+46701234572',
          status: 'completed',
          call_duration_seconds: 60,
          initiated_at: new Date().toISOString()
        })
        .select()
        .single();

      // Create scripted/generic transcript
      const scriptedTranscript = {
        call_session_id: scriptedCallSession.data.id,
        store_id: storeId,
        messages: [
          {
            speaker: 'ai',
            content: 'Hej! Kan du berätta om din upplevelse?',
            timestamp_ms: 0,
            message_order: 1
          },
          {
            speaker: 'customer',
            content: 'Bra bra, allt var bra. Mycket bra service.',
            timestamp_ms: 5000,
            message_order: 2
          },
          {
            speaker: 'ai',
            content: 'Kan du berätta mer specifikt?',
            timestamp_ms: 10000,
            message_order: 3
          },
          {
            speaker: 'customer',
            content: 'Ja, det var bra. Personalen var bra. Allt var bra.',
            timestamp_ms: 15000,
            message_order: 4
          }
        ],
        total_duration_seconds: 60,
        language_detected: 'sv'
      };

      await supabase
        .from('conversation_transcripts')
        .insert(scriptedTranscript);

      const response = await request(app)
        .post('/api/ai/analysis/fraud-detection')
        .send({
          call_session_id: scriptedCallSession.data.id,
          analysis_types: ['content', 'authenticity']
        })
        .expect(200);

      expect(response.body.is_fraudulent).toBe(true);
      expect(response.body.fraud_reasons).toContain('generic_responses');
      expect(response.body.content_analysis).toHaveProperty('repetitive_language_score');
      expect(response.body.content_analysis.repetitive_language_score).toBeGreaterThan(0.7);
      expect(response.body.content_analysis).toHaveProperty('authenticity_score');
      expect(response.body.content_analysis.authenticity_score).toBeLessThan(0.4);

      // Cleanup
      await supabase
        .from('customer_verifications')
        .delete()
        .eq('id', scriptedVerification.data.id);
    });

    it('should validate authentic detailed feedback', async () => {
      const authenticVerification = await supabase
        .from('customer_verifications')
        .insert({
          store_id: storeId,
          phone_number: '+46701234573',
          transaction_amount: 175.00,
          transaction_time: new Date().toISOString(),
          verification_status: 'verified'
        })
        .select()
        .single();

      const authenticCallSession = await supabase
        .from('feedback_call_sessions')
        .insert({
          verification_id: authenticVerification.data.id,
          store_id: storeId,
          customer_phone_number: '+46701234573',
          status: 'completed',
          call_duration_seconds: 95,
          initiated_at: new Date().toISOString()
        })
        .select()
        .single();

      // Create authentic, detailed transcript
      const authenticTranscript = {
        call_session_id: authenticCallSession.data.id,
        store_id: storeId,
        messages: [
          {
            speaker: 'ai',
            content: 'Hej! Kan du berätta om din upplevelse i butiken idag?',
            timestamp_ms: 0,
            message_order: 1
          },
          {
            speaker: 'customer',
            content: 'Ja, det var faktiskt riktigt bra. Jag hittade det jag letade efter och personalen vid köttdisken var mycket kunnig.',
            timestamp_ms: 5000,
            message_order: 2
          },
          {
            speaker: 'ai',
            content: 'Vad roligt att höra! Kan du berätta lite mer om vad som var särskilt bra?',
            timestamp_ms: 15000,
            message_order: 3
          },
          {
            speaker: 'customer',
            content: 'Ja, de hjälpte mig att välja rätt kött för grytan jag skulle laga, och förklarade hur länge det skulle kokas. Plus att kassören var snabb och trevlig.',
            timestamp_ms: 20000,
            message_order: 4
          },
          {
            speaker: 'ai',
            content: 'Underbart! Fanns det något som kunde förbättras?',
            timestamp_ms: 35000,
            message_order: 5
          },
          {
            speaker: 'customer',
            content: 'Hmm, kanske lite fler kassor öppna under lunchtid, men annars var det bra. Fruktavdelningen såg fräsch ut också.',
            timestamp_ms: 42000,
            message_order: 6
          }
        ],
        total_duration_seconds: 95,
        language_detected: 'sv'
      };

      await supabase
        .from('conversation_transcripts')
        .insert(authenticTranscript);

      const response = await request(app)
        .post('/api/ai/analysis/fraud-detection')
        .send({
          call_session_id: authenticCallSession.data.id,
          analysis_types: ['content', 'authenticity']
        })
        .expect(200);

      expect(response.body.is_fraudulent).toBe(false);
      expect(response.body.fraud_confidence_score).toBeLessThan(0.3);
      expect(response.body.content_analysis.authenticity_score).toBeGreaterThan(0.7);
      expect(response.body.content_analysis.detail_level).toBe('high');
      expect(response.body.content_analysis.specific_mentions).toBeGreaterThan(3);

      // Cleanup
      await supabase
        .from('customer_verifications')
        .delete()
        .eq('id', authenticVerification.data.id);
    });
  });

  describe('Geolocation and Context Fraud Detection', () => {
    it('should detect impossible geographic scenarios', async () => {
      // Create verification with mismatched geographic context
      const geoVerification = await supabase
        .from('customer_verifications')
        .insert({
          store_id: storeId,
          phone_number: '+1234567890', // US number for Swedish store
          transaction_amount: 120.00,
          transaction_time: new Date().toISOString(),
          verification_status: 'verified'
        })
        .select()
        .single();

      const geoCallSession = await supabase
        .from('feedback_call_sessions')
        .insert({
          verification_id: geoVerification.data.id,
          store_id: storeId,
          customer_phone_number: '+1234567890',
          status: 'completed',
          call_duration_seconds: 75,
          initiated_at: new Date().toISOString()
        })
        .select()
        .single();

      const response = await request(app)
        .post('/api/ai/analysis/fraud-detection')
        .send({
          call_session_id: geoCallSession.data.id,
          analysis_types: ['geographic', 'context'],
          geographic_context: {
            store_country: 'SE',
            phone_country_code: '+1',
            expected_regions: ['SE', 'NO', 'DK', 'FI']
          }
        })
        .expect(200);

      expect(response.body.is_fraudulent).toBe(true);
      expect(response.body.fraud_reasons).toContain('geographic_mismatch');
      expect(response.body.risk_factors.geographic_risk).toBeGreaterThan(0.8);

      // Cleanup
      await supabase
        .from('customer_verifications')
        .delete()
        .eq('id', geoVerification.data.id);
    });
  });

  describe('Fraud Score Calculation and Thresholds', () => {
    it('should calculate composite fraud scores correctly', async () => {
      // Create call session with multiple risk factors
      const multiRiskVerification = await supabase
        .from('customer_verifications')
        .insert({
          store_id: storeId,
          phone_number: '+46701234574',
          transaction_amount: 45.00,
          transaction_time: '2025-09-23T21:30:00Z', // After hours
          verification_status: 'verified'
        })
        .select()
        .single();

      const multiRiskSession = await supabase
        .from('feedback_call_sessions')
        .insert({
          verification_id: multiRiskVerification.data.id,
          store_id: storeId,
          customer_phone_number: '+46701234574',
          status: 'completed',
          call_duration_seconds: 25, // Short duration
          initiated_at: new Date().toISOString()
        })
        .select()
        .single();

      // Add generic transcript
      await supabase
        .from('conversation_transcripts')
        .insert({
          call_session_id: multiRiskSession.data.id,
          store_id: storeId,
          messages: [
            {
              speaker: 'ai',
              content: 'Hej!',
              timestamp_ms: 0,
              message_order: 1
            },
            {
              speaker: 'customer',
              content: 'Bra, tack',
              timestamp_ms: 3000,
              message_order: 2
            }
          ],
          total_duration_seconds: 25,
          language_detected: 'sv'
        });

      const response = await request(app)
        .post('/api/ai/analysis/fraud-detection')
        .send({
          call_session_id: multiRiskSession.data.id,
          analysis_types: ['comprehensive'],
          fraud_threshold: 0.7
        })
        .expect(200);

      expect(response.body.is_fraudulent).toBe(true);
      expect(response.body.fraud_confidence_score).toBeGreaterThan(0.7);
      
      // Verify all risk factors are calculated
      expect(response.body.risk_factors).toHaveProperty('timing_risk');
      expect(response.body.risk_factors).toHaveProperty('content_risk');
      expect(response.body.risk_factors).toHaveProperty('duration_risk');
      expect(response.body.risk_factors).toHaveProperty('pattern_risk');

      // Verify composite score calculation
      expect(response.body.score_breakdown).toHaveProperty('weighted_factors');
      expect(response.body.score_breakdown).toHaveProperty('final_score');
      expect(response.body.score_breakdown.final_score).toBe(response.body.fraud_confidence_score);

      // Cleanup
      await supabase
        .from('customer_verifications')
        .delete()
        .eq('id', multiRiskVerification.data.id);
    });

    it('should provide fraud prevention recommendations', async () => {
      const recommendationVerification = await supabase
        .from('customer_verifications')
        .insert({
          store_id: storeId,
          phone_number: '+46701234575',
          transaction_amount: 300.00,
          transaction_time: '2025-09-23T23:00:00Z', // Late night
          verification_status: 'verified'
        })
        .select()
        .single();

      const recommendationSession = await supabase
        .from('feedback_call_sessions')
        .insert({
          verification_id: recommendationVerification.data.id,
          store_id: storeId,
          customer_phone_number: '+46701234575',
          status: 'failed',
          call_duration_seconds: 0,
          failure_reason: 'fraud_detected',
          initiated_at: new Date().toISOString()
        })
        .select()
        .single();

      const response = await request(app)
        .post('/api/ai/analysis/fraud-detection')
        .send({
          call_session_id: recommendationSession.data.id,
          analysis_types: ['comprehensive'],
          include_recommendations: true
        })
        .expect(200);

      expect(response.body.is_fraudulent).toBe(true);
      expect(response.body).toHaveProperty('prevention_recommendations');
      expect(Array.isArray(response.body.prevention_recommendations)).toBe(true);
      expect(response.body.prevention_recommendations.length).toBeGreaterThan(0);

      expect(response.body).toHaveProperty('risk_mitigation');
      expect(response.body.risk_mitigation).toHaveProperty('suggested_actions');
      expect(response.body.risk_mitigation.suggested_actions).toContain('verify_business_hours');

      // Cleanup
      await supabase
        .from('customer_verifications')
        .delete()
        .eq('id', recommendationVerification.data.id);
    });
  });
});