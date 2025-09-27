import request from 'supertest';
import { app } from '../../src/app';
import { supabase } from '@vocilia/database';

describe('AI Analysis Pipeline (T016)', () => {
  let storeId: string;
  let verificationId: string;

  beforeAll(async () => {
    // Create test store
    const storeResult = await supabase
      .from('stores')
      .insert({
        name: 'Test Store for AI Analysis Pipeline',
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

    // Create customer verification
    const verificationResult = await supabase
      .from('customer_verifications')
      .insert({
        store_id: storeId,
        phone_number: '+46701234567',
        transaction_amount: 185.50,
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
      .from('business_context_profiles')
      .delete()
      .eq('store_id', storeId);

    await supabase
      .from('call_quality_metrics')
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

  describe('End-to-End AI Analysis Pipeline (Quality 2-15%)', () => {
    let callSessionId: string;
    let transcriptId: string;

    beforeEach(async () => {
      // Initiate call session
      const callResponse = await request(app)
        .post('/api/ai/calls/initiate')
        .send({
          verification_id: verificationId,
          store_id: storeId,
          customer_phone_number: '+46701234567'
        })
        .expect(202);

      callSessionId = callResponse.body.call_session_id;
    });

    it('should process high-quality feedback (12-15% range)', async () => {
      // Submit high-quality conversation transcript
      const highQualityTranscript = {
        messages: [
          {
            speaker: 'ai',
            content: 'Hej! Tack för att du handlade hos oss idag. Kan du berätta om din upplevelse?',
            timestamp_ms: 0,
            message_order: 1,
            message_type: 'greeting'
          },
          {
            speaker: 'customer',
            content: 'Hej! Ja, det var en mycket positiv upplevelse. Jag kom hit för att köpa ingredienser till middag och allt gick smidigt.',
            timestamp_ms: 5000,
            message_order: 2,
            message_type: 'initial_response'
          },
          {
            speaker: 'ai',
            content: 'Vad roligt att höra! Kan du berätta mer specifikt om vad som gjorde upplevelsen bra?',
            timestamp_ms: 15000,
            message_order: 3,
            message_type: 'follow_up'
          },
          {
            speaker: 'customer',
            content: 'Personalen vid köttdisken var fantastisk - de hjälpte mig välja rätt kött och gav tips om tillagning. Fiskdisken hade färsk lax och personalen där förklarade ursprung och fångstmetod.',
            timestamp_ms: 22000,
            message_order: 4,
            message_type: 'detailed_feedback'
          },
          {
            speaker: 'ai',
            content: 'Underbart med så engagerad personal! Hur upplevde du resten av butiken?',
            timestamp_ms: 40000,
            message_order: 5,
            message_type: 'exploration'
          },
          {
            speaker: 'customer',
            content: 'Frukt och grönt avdelningen var mycket fräsch, speciellt de ekologiska produkterna. Kassapersonalen var effektiv och vänlig. Jag uppskattade också att ni har återvinningsstation vid ingången.',
            timestamp_ms: 48000,
            message_order: 6,
            message_type: 'comprehensive_feedback'
          },
          {
            speaker: 'ai',
            content: 'Tack för den detaljerade feedbacken! Fanns det något område där vi kan förbättra oss?',
            timestamp_ms: 70000,
            message_order: 7,
            message_type: 'improvement_inquiry'
          },
          {
            speaker: 'customer',
            content: 'Faktiskt inte mycket. Kanske lite mer variation i det ekologiska brödsortimentet, men det är verkligen en detalj. Ni gör ett fantastiskt jobb!',
            timestamp_ms: 78000,
            message_order: 8,
            message_type: 'constructive_feedback'
          }
        ],
        total_duration_seconds: 105,
        openai_session_id: 'sess_high_quality_test',
        language_detected: 'sv'
      };

      // Submit transcript
      const transcriptResponse = await request(app)
        .post(`/api/ai/calls/${callSessionId}/transcript`)
        .send(highQualityTranscript)
        .expect(200);

      transcriptId = transcriptResponse.body.transcript_id;

      // Trigger AI analysis pipeline
      const analysisResponse = await request(app)
        .post('/api/ai/analysis/quality')
        .send({
          call_session_id: callSessionId,
          transcript_id: transcriptId,
          analysis_depth: 'comprehensive'
        })
        .expect(202);

      expect(analysisResponse.body).toHaveProperty('analysis_id');
      expect(analysisResponse.body.processing_status).toBe('initiated');

      // Wait for analysis completion
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Get analysis results
      const resultResponse = await request(app)
        .get(`/api/ai/analysis/${analysisResponse.body.analysis_id}/results`)
        .expect(200);

      const analysis = resultResponse.body;

      // Verify high-quality analysis scores
      expect(analysis.overall_satisfaction).toBeGreaterThan(0.85);
      expect(analysis.service_quality).toBeGreaterThan(0.9);
      expect(analysis.product_quality).toBeGreaterThan(0.85);
      expect(analysis.staff_helpfulness).toBeGreaterThan(0.9);

      // Verify reward percentage in high range (12-15%)
      expect(analysis.reward_percentage).toBeGreaterThanOrEqual(12.0);
      expect(analysis.reward_percentage).toBeLessThanOrEqual(15.0);

      // Verify fraud detection passes
      expect(analysis.is_fraudulent).toBe(false);
      expect(analysis.fraud_confidence_score).toBeLessThan(0.3);

      // Verify detailed insights
      expect(analysis.positive_highlights).toContain('köttdisken');
      expect(analysis.positive_highlights).toContain('kassapersonalen');
      expect(analysis.business_insights.department_mentions.meat).toBeGreaterThan(0);
      expect(analysis.business_insights.department_mentions.fish).toBeGreaterThan(0);
      expect(analysis.business_insights.department_mentions.produce).toBeGreaterThan(0);
    });

    it('should process medium-quality feedback (6-10% range)', async () => {
      // Submit medium-quality conversation transcript
      const mediumQualityTranscript = {
        messages: [
          {
            speaker: 'ai',
            content: 'Hej! Kan du berätta om din upplevelse idag?',
            timestamp_ms: 0,
            message_order: 1
          },
          {
            speaker: 'customer',
            content: 'Hej! Det var okej. Jag hittade det jag letade efter.',
            timestamp_ms: 4000,
            message_order: 2
          },
          {
            speaker: 'ai',
            content: 'Vad bra! Kan du berätta lite mer om vad som var bra?',
            timestamp_ms: 10000,
            message_order: 3
          },
          {
            speaker: 'customer',
            content: 'Personalen var trevlig och butiken var ren. Kassorna gick ganska fort.',
            timestamp_ms: 16000,
            message_order: 4
          },
          {
            speaker: 'ai',
            content: 'Tack! Fanns det något som kunde vara bättre?',
            timestamp_ms: 28000,
            message_order: 5
          },
          {
            speaker: 'customer',
            content: 'Kanske lite mer personal vid delikatessavdelningen, det var en del kö.',
            timestamp_ms: 35000,
            message_order: 6
          }
        ],
        total_duration_seconds: 72,
        openai_session_id: 'sess_medium_quality_test',
        language_detected: 'sv'
      };

      const transcriptResponse = await request(app)
        .post(`/api/ai/calls/${callSessionId}/transcript`)
        .send(mediumQualityTranscript)
        .expect(200);

      const analysisResponse = await request(app)
        .post('/api/ai/analysis/quality')
        .send({
          call_session_id: callSessionId,
          transcript_id: transcriptResponse.body.transcript_id,
          analysis_depth: 'standard'
        })
        .expect(202);

      await new Promise(resolve => setTimeout(resolve, 2000));

      const resultResponse = await request(app)
        .get(`/api/ai/analysis/${analysisResponse.body.analysis_id}/results`)
        .expect(200);

      const analysis = resultResponse.body;

      // Verify medium-quality scores
      expect(analysis.overall_satisfaction).toBeGreaterThan(0.6);
      expect(analysis.overall_satisfaction).toBeLessThan(0.85);

      // Verify reward percentage in medium range (6-10%)
      expect(analysis.reward_percentage).toBeGreaterThanOrEqual(6.0);
      expect(analysis.reward_percentage).toBeLessThanOrEqual(10.0);

      expect(analysis.improvement_areas).toContain('delikatessavdelningen');
    });

    it('should process low-quality feedback (2-4% range)', async () => {
      // Submit low-quality conversation transcript
      const lowQualityTranscript = {
        messages: [
          {
            speaker: 'ai',
            content: 'Hej! Kan du berätta om din upplevelse?',
            timestamp_ms: 0,
            message_order: 1
          },
          {
            speaker: 'customer',
            content: 'Ja, det var okej.',
            timestamp_ms: 3000,
            message_order: 2
          },
          {
            speaker: 'ai',
            content: 'Kan du säga något mer?',
            timestamp_ms: 8000,
            message_order: 3
          },
          {
            speaker: 'customer',
            content: 'Mmm, bra.',
            timestamp_ms: 12000,
            message_order: 4
          }
        ],
        total_duration_seconds: 65,
        openai_session_id: 'sess_low_quality_test',
        language_detected: 'sv'
      };

      const transcriptResponse = await request(app)
        .post(`/api/ai/calls/${callSessionId}/transcript`)
        .send(lowQualityTranscript)
        .expect(200);

      const analysisResponse = await request(app)
        .post('/api/ai/analysis/quality')
        .send({
          call_session_id: callSessionId,
          transcript_id: transcriptResponse.body.transcript_id,
          analysis_depth: 'basic'
        })
        .expect(202);

      await new Promise(resolve => setTimeout(resolve, 1500));

      const resultResponse = await request(app)
        .get(`/api/ai/analysis/${analysisResponse.body.analysis_id}/results`)
        .expect(200);

      const analysis = resultResponse.body;

      // Verify low-quality scores
      expect(analysis.overall_satisfaction).toBeLessThan(0.6);

      // Verify reward percentage in low range (2-4%)
      expect(analysis.reward_percentage).toBeGreaterThanOrEqual(2.0);
      expect(analysis.reward_percentage).toBeLessThanOrEqual(4.0);

      expect(analysis.feedback_summary).toContain('minimal');
      expect(analysis.business_insights.sentiment_trends.positive_score).toBeLessThan(0.6);
    });

    it('should reject feedback below 2% threshold', async () => {
      // Submit very poor quality conversation
      const belowThresholdTranscript = {
        messages: [
          {
            speaker: 'ai',
            content: 'Hej! Kan du berätta om din upplevelse?',
            timestamp_ms: 0,
            message_order: 1
          },
          {
            speaker: 'customer',
            content: 'Nej.',
            timestamp_ms: 2000,
            message_order: 2
          }
        ],
        total_duration_seconds: 45, // Too short
        openai_session_id: 'sess_below_threshold_test',
        language_detected: 'sv'
      };

      const transcriptResponse = await request(app)
        .post(`/api/ai/calls/${callSessionId}/transcript`)
        .send(belowThresholdTranscript)
        .expect(200);

      const analysisResponse = await request(app)
        .post('/api/ai/analysis/quality')
        .send({
          call_session_id: callSessionId,
          transcript_id: transcriptResponse.body.transcript_id
        })
        .expect(202);

      await new Promise(resolve => setTimeout(resolve, 1000));

      const resultResponse = await request(app)
        .get(`/api/ai/analysis/${analysisResponse.body.analysis_id}/results`)
        .expect(200);

      const analysis = resultResponse.body;

      // Should be below reward threshold
      expect(analysis.reward_percentage).toBeLessThan(2.0);
      expect(analysis.qualifies_for_reward).toBe(false);
      expect(analysis.rejection_reason).toBe('insufficient_feedback_quality');
    });
  });

  describe('Business Context Profile Generation', () => {
    it('should build comprehensive business context from multiple conversations', async () => {
      // Create multiple call sessions with varied feedback
      const conversationTopics = [
        { 
          department: 'meat',
          sentiment: 'positive',
          content: 'Köttdisken hade fantastisk kvalitet och kunnig personal'
        },
        {
          department: 'produce', 
          sentiment: 'mixed',
          content: 'Frukt och grönt var mest bra men några äpplen såg gamla ut'
        },
        {
          department: 'checkout',
          sentiment: 'negative', 
          content: 'Kassorna var långsamma och det var för få öppna'
        }
      ];

      const analysisIds = [];

      for (const topic of conversationTopics) {
        // Create call session
        const callResponse = await request(app)
          .post('/api/ai/calls/initiate')
          .send({
            verification_id: verificationId,
            store_id: storeId,
            customer_phone_number: '+46701234567'
          });

        const callSessionId = callResponse.body.call_session_id;

        // Submit topic-specific transcript
        const transcript = {
          messages: [
            {
              speaker: 'ai',
              content: 'Kan du berätta om din upplevelse?',
              timestamp_ms: 0,
              message_order: 1
            },
            {
              speaker: 'customer',
              content: topic.content,
              timestamp_ms: 5000,
              message_order: 2
            }
          ],
          total_duration_seconds: 70,
          openai_session_id: `sess_context_${topic.department}`,
          language_detected: 'sv'
        };

        const transcriptResponse = await request(app)
          .post(`/api/ai/calls/${callSessionId}/transcript`)
          .send(transcript);

        const analysisResponse = await request(app)
          .post('/api/ai/analysis/quality')
          .send({
            call_session_id: callSessionId,
            transcript_id: transcriptResponse.body.transcript_id
          });

        analysisIds.push(analysisResponse.body.analysis_id);
      }

      // Wait for all analyses to complete
      await new Promise(resolve => setTimeout(resolve, 4000));

      // Trigger business context profile generation
      const profileResponse = await request(app)
        .post('/api/ai/business/context/generate')
        .send({
          store_id: storeId,
          analysis_period_days: 30
        })
        .expect(200);

      expect(profileResponse.body).toHaveProperty('business_context_profile_id');

      // Verify business context profile
      const profile = await supabase
        .from('business_context_profiles')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      expect(profile.data.department_performance).toHaveProperty('meat');
      expect(profile.data.department_performance).toHaveProperty('produce');
      expect(profile.data.department_performance).toHaveProperty('checkout');

      expect(profile.data.department_performance.meat.sentiment_score).toBeGreaterThan(0.7);
      expect(profile.data.department_performance.checkout.sentiment_score).toBeLessThan(0.4);

      expect(profile.data.improvement_priorities).toContain('checkout');
      expect(profile.data.strength_areas).toContain('meat');
    });
  });

  describe('Call Quality Metrics Tracking', () => {
    it('should track comprehensive call quality metrics', async () => {
      const callResponse = await request(app)
        .post('/api/ai/calls/initiate')
        .send({
          verification_id: verificationId,
          store_id: storeId,
          customer_phone_number: '+46701234567'
        });

      const callSessionId = callResponse.body.call_session_id;

      // Submit transcript with quality metrics
      const transcript = {
        messages: [
          {
            speaker: 'ai',
            content: 'Hej! Kan du berätta om din upplevelse?',
            timestamp_ms: 0,
            message_order: 1,
            audio_quality_score: 0.95
          },
          {
            speaker: 'customer',
            content: 'Bra upplevelse med trevlig personal och bra produkter.',
            timestamp_ms: 5000,
            message_order: 2,
            audio_quality_score: 0.88,
            speech_clarity_score: 0.92
          }
        ],
        total_duration_seconds: 80,
        openai_session_id: 'sess_quality_metrics_test',
        language_detected: 'sv',
        technical_metrics: {
          connection_quality: 0.94,
          latency_ms: 150,
          packet_loss_percentage: 0.5
        }
      };

      const transcriptResponse = await request(app)
        .post(`/api/ai/calls/${callSessionId}/transcript`)
        .send(transcript);

      // Trigger quality metrics analysis
      const metricsResponse = await request(app)
        .post('/api/ai/analysis/call-quality-metrics')
        .send({
          call_session_id: callSessionId,
          transcript_id: transcriptResponse.body.transcript_id
        })
        .expect(200);

      expect(metricsResponse.body).toHaveProperty('quality_metrics_id');

      // Verify call quality metrics are stored
      const metrics = await supabase
        .from('call_quality_metrics')
        .select('*')
        .eq('call_session_id', callSessionId)
        .single();

      expect(metrics.data.audio_quality_avg).toBeGreaterThan(0.8);
      expect(metrics.data.speech_clarity_avg).toBeGreaterThan(0.9);
      expect(metrics.data.connection_stability).toBeGreaterThan(0.9);
      expect(metrics.data.technical_issues_detected).toBe(false);
    });

    it('should detect and flag technical quality issues', async () => {
      const callResponse = await request(app)
        .post('/api/ai/calls/initiate')
        .send({
          verification_id: verificationId,
          store_id: storeId,
          customer_phone_number: '+46701234567'
        });

      const callSessionId = callResponse.body.call_session_id;

      // Submit transcript with poor technical quality
      const lowQualityTranscript = {
        messages: [
          {
            speaker: 'ai',
            content: 'Hej! Kan du berätta...',
            timestamp_ms: 0,
            message_order: 1,
            audio_quality_score: 0.45
          },
          {
            speaker: 'customer',
            content: 'Ja... kan inte höra... vad sa du?',
            timestamp_ms: 8000,
            message_order: 2,
            audio_quality_score: 0.35,
            speech_clarity_score: 0.3
          }
        ],
        total_duration_seconds: 35,
        openai_session_id: 'sess_poor_quality_test',
        language_detected: 'sv',
        technical_metrics: {
          connection_quality: 0.4,
          latency_ms: 800,
          packet_loss_percentage: 15.5
        }
      };

      await request(app)
        .post(`/api/ai/calls/${callSessionId}/transcript`)
        .send(lowQualityTranscript);

      const metricsResponse = await request(app)
        .post('/api/ai/analysis/call-quality-metrics')
        .send({
          call_session_id: callSessionId
        })
        .expect(200);

      const metrics = await supabase
        .from('call_quality_metrics')
        .select('*')
        .eq('call_session_id', callSessionId)
        .single();

      expect(metrics.data.technical_issues_detected).toBe(true);
      expect(metrics.data.quality_issues).toContain('poor_audio_quality');
      expect(metrics.data.quality_issues).toContain('high_latency');
      expect(metrics.data.quality_issues).toContain('packet_loss');
      expect(metrics.data.overall_call_quality).toBeLessThan(0.5);
    });
  });

  describe('Pipeline Performance and Error Handling', () => {
    it('should handle pipeline failures gracefully', async () => {
      const callResponse = await request(app)
        .post('/api/ai/calls/initiate')
        .send({
          verification_id: verificationId,
          store_id: storeId,
          customer_phone_number: '+46701234567'
        });

      const callSessionId = callResponse.body.call_session_id;

      // Submit malformed transcript to trigger error handling
      const malformedTranscript = {
        messages: [
          {
            speaker: 'ai',
            content: null, // Invalid content
            timestamp_ms: 0
          }
        ],
        total_duration_seconds: -5, // Invalid duration
        language_detected: 'unknown'
      };

      const transcriptResponse = await request(app)
        .post(`/api/ai/calls/${callSessionId}/transcript`)
        .send(malformedTranscript)
        .expect(400);

      expect(transcriptResponse.body.error).toContain('validation');
      expect(transcriptResponse.body.validation_errors).toBeDefined();
    });

    it('should meet performance requirements (<30s analysis time)', async () => {
      const callResponse = await request(app)
        .post('/api/ai/calls/initiate')
        .send({
          verification_id: verificationId,
          store_id: storeId,
          customer_phone_number: '+46701234567'
        });

      const callSessionId = callResponse.body.call_session_id;

      const transcript = {
        messages: [
          {
            speaker: 'ai',
            content: 'Hej! Kan du berätta om din upplevelse?',
            timestamp_ms: 0,
            message_order: 1
          },
          {
            speaker: 'customer',
            content: 'Bra service och kvalitet på produkterna.',
            timestamp_ms: 5000,
            message_order: 2
          }
        ],
        total_duration_seconds: 70,
        openai_session_id: 'sess_performance_test',
        language_detected: 'sv'
      };

      const transcriptResponse = await request(app)
        .post(`/api/ai/calls/${callSessionId}/transcript`)
        .send(transcript);

      const analysisStartTime = Date.now();

      const analysisResponse = await request(app)
        .post('/api/ai/analysis/quality')
        .send({
          call_session_id: callSessionId,
          transcript_id: transcriptResponse.body.transcript_id
        });

      // Wait for completion and measure time
      let completed = false;
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds max

      while (!completed && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;

        const statusResponse = await request(app)
          .get(`/api/ai/analysis/${analysisResponse.body.analysis_id}/status`);

        if (statusResponse.body.status === 'completed') {
          completed = true;
        }
      }

      const totalTime = Date.now() - analysisStartTime;

      expect(completed).toBe(true);
      expect(totalTime).toBeLessThan(30000); // 30 seconds
      expect(attempts).toBeLessThan(30);
    });
  });
});