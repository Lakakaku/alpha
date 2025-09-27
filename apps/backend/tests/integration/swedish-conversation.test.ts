import request from 'supertest';
import { app } from '../../src/app';
import { supabase } from '@vocilia/database';

describe('Swedish Language Conversation Flow (T013)', () => {
  let storeId: string;
  let verificationId: string;

  beforeAll(async () => {
    // Create test store
    const storeResult = await supabase
      .from('stores')
      .insert({
        name: 'Test Store for Swedish Conversations',
        business_type: 'grocery',
        country: 'SE',
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
      .eq('id', verificationId);

    await supabase
      .from('stores')
      .delete()
      .eq('id', storeId);
  });

  describe('Swedish Language Requirements (FR-002, FR-008)', () => {
    let callSessionId: string;

    beforeEach(async () => {
      // Initiate new call session
      const response = await request(app)
        .post('/api/ai/calls/initiate')
        .send({
          verification_id: verificationId,
          store_id: storeId,
          customer_phone_number: '+46701234567'
        })
        .expect(202);

      callSessionId = response.body.call_session_id;
    });

    it('should initiate call with Swedish AI voice model', async () => {
      // Verify call session uses Swedish configuration
      const session = await supabase
        .from('feedback_call_sessions')
        .select('*')
        .eq('id', callSessionId)
        .single();

      expect(session.data.language_code).toBe('sv-SE');
      expect(session.data.voice_model).toBe('sv-SE-MattiasNeural');
      expect(session.data.openai_model).toBe('gpt-4o-mini');
    });

    it('should conduct conversation entirely in Swedish', async () => {
      // Submit Swedish conversation transcript
      const swedishConversation = {
        messages: [
          {
            speaker: 'ai',
            content: 'Hej! Tack för att du handlade hos oss idag. Kan du berätta om din upplevelse?',
            timestamp_ms: 0,
            message_order: 1,
            message_type: 'greeting',
            language_detected: 'sv'
          },
          {
            speaker: 'customer',
            content: 'Hej! Ja, det var en bra upplevelse. Butiken var ren och välorganiserad.',
            timestamp_ms: 5000,
            message_order: 2,
            message_type: 'response',
            language_detected: 'sv'
          },
          {
            speaker: 'ai',
            content: 'Vad trevligt att höra! Kan du berätta mer specifikt om vad som var bra?',
            timestamp_ms: 12000,
            message_order: 3,
            message_type: 'follow_up',
            language_detected: 'sv'
          },
          {
            speaker: 'customer',
            content: 'Personalen vid köttdisken var mycket hjälpsam och produkterna såg fräscha ut. Kassören var också vänlig och effektiv.',
            timestamp_ms: 18000,
            message_order: 4,
            message_type: 'detailed_feedback',
            language_detected: 'sv'
          },
          {
            speaker: 'ai',
            content: 'Tack så mycket för din detaljerade feedback! Fanns det något som kunde förbättras?',
            timestamp_ms: 30000,
            message_order: 5,
            message_type: 'improvement_inquiry',
            language_detected: 'sv'
          },
          {
            speaker: 'customer',
            content: 'Kanske lite längre öppettider på söndagar, men annars var allt bra.',
            timestamp_ms: 40000,
            message_order: 6,
            message_type: 'improvement_suggestion',
            language_detected: 'sv'
          },
          {
            speaker: 'ai',
            content: 'Tack för förslaget! Vi uppskattar verkligen din tid och feedback. Ha en bra dag!',
            timestamp_ms: 50000,
            message_order: 7,
            message_type: 'closing',
            language_detected: 'sv'
          }
        ],
        total_duration_seconds: 85,
        openai_session_id: 'sess_swedish_test_123'
      };

      const response = await request(app)
        .post(`/api/ai/calls/${callSessionId}/transcript`)
        .send(swedishConversation)
        .expect(200);

      expect(response.body.status).toBe('transcript_received');
      expect(response.body.language_validation).toBe('passed');
      expect(response.body.primary_language).toBe('sv');

      // Verify transcript is stored correctly
      const transcript = await supabase
        .from('conversation_transcripts')
        .select('*')
        .eq('call_session_id', callSessionId)
        .single();

      expect(transcript.data.language_detected).toBe('sv');
      expect(transcript.data.messages).toHaveLength(7);
      expect(transcript.data.messages[0].content).toContain('Hej!');
      expect(transcript.data.messages[0].language_detected).toBe('sv');
    });

    it('should reject calls with non-Swedish responses', async () => {
      // Submit conversation with English responses
      const mixedLanguageConversation = {
        messages: [
          {
            speaker: 'ai',
            content: 'Hej! Tack för att du handlade hos oss idag. Kan du berätta om din upplevelse?',
            timestamp_ms: 0,
            message_order: 1,
            language_detected: 'sv'
          },
          {
            speaker: 'customer',
            content: 'Sorry, I don\'t speak Swedish very well.',
            timestamp_ms: 5000,
            message_order: 2,
            language_detected: 'en'
          },
          {
            speaker: 'ai',
            content: 'Jag förstår. Tyvärr kan vi bara genomföra samtalet på svenska.',
            timestamp_ms: 10000,
            message_order: 3,
            language_detected: 'sv'
          }
        ],
        total_duration_seconds: 15,
        openai_session_id: 'sess_mixed_lang_123'
      };

      const response = await request(app)
        .post(`/api/ai/calls/${callSessionId}/transcript`)
        .send(mixedLanguageConversation)
        .expect(200);

      expect(response.body.status).toBe('language_barrier_detected');
      expect(response.body.termination_reason).toBe('non_swedish_response');
      expect(response.body.language_validation).toBe('failed');

      // Verify call session is marked as abandoned
      const session = await supabase
        .from('feedback_call_sessions')
        .select('*')
        .eq('id', callSessionId)
        .single();

      expect(session.data.status).toBe('abandoned');
      expect(session.data.failure_reason).toBe('language_barrier');
    });

    it('should handle Swedish dialects and accents gracefully', async () => {
      // Test with various Swedish regional expressions
      const dialectConversation = {
        messages: [
          {
            speaker: 'ai',
            content: 'Hej! Kan du berätta om din upplevelse?',
            timestamp_ms: 0,
            message_order: 1,
            language_detected: 'sv'
          },
          {
            speaker: 'customer',
            content: 'Ja, det var riktigt bra det! Kött va fräscht och personalen va trevlig.',
            timestamp_ms: 5000,
            message_order: 2,
            language_detected: 'sv'
          },
          {
            speaker: 'ai',
            content: 'Vad roligt! Kan du berätta mer?',
            timestamp_ms: 12000,
            message_order: 3,
            language_detected: 'sv'
          },
          {
            speaker: 'customer',
            content: 'Jo, kassan gick fort och allt va rent och snyggt. Bra jobbat!',
            timestamp_ms: 18000,
            message_order: 4,
            language_detected: 'sv'
          }
        ],
        total_duration_seconds: 75,
        openai_session_id: 'sess_dialect_test_123'
      };

      const response = await request(app)
        .post(`/api/ai/calls/${callSessionId}/transcript`)
        .send(dialectConversation)
        .expect(200);

      expect(response.body.language_validation).toBe('passed');
      expect(response.body.dialect_notes).toBeDefined();
      expect(response.body.primary_language).toBe('sv');
    });
  });

  describe('Swedish Cultural Context (FR-008)', () => {
    it('should use appropriate Swedish business etiquette', async () => {
      const callResponse = await request(app)
        .post('/api/ai/calls/initiate')
        .send({
          verification_id: verificationId,
          store_id: storeId,
          customer_phone_number: '+46701234567'
        })
        .expect(202);

      const callSessionId = callResponse.body.call_session_id;

      // Submit formal Swedish conversation
      const formalConversation = {
        messages: [
          {
            speaker: 'ai',
            content: 'God dag! Mitt namn är Emma och jag ringer från butiken. Har ni en stund att prata om ert besök idag?',
            timestamp_ms: 0,
            message_order: 1,
            language_detected: 'sv',
            formality_level: 'formal'
          },
          {
            speaker: 'customer',
            content: 'Ja, det är lugnt. Det var en bra upplevelse.',
            timestamp_ms: 4000,
            message_order: 2,
            language_detected: 'sv'
          },
          {
            speaker: 'ai',
            content: 'Tack så mycket! Skulle ni kunna berätta lite mer detaljerat om vad som var bra?',
            timestamp_ms: 10000,
            message_order: 3,
            language_detected: 'sv',
            formality_level: 'polite'
          }
        ],
        total_duration_seconds: 90,
        openai_session_id: 'sess_formal_swedish_123'
      };

      const response = await request(app)
        .post(`/api/ai/calls/${callSessionId}/transcript`)
        .send(formalConversation)
        .expect(200);

      expect(response.body.cultural_analysis).toHaveProperty('politeness_level');
      expect(response.body.cultural_analysis).toHaveProperty('formality_appropriate');
      expect(response.body.cultural_analysis.formality_appropriate).toBe(true);
    });

    it('should recognize Swedish product and store terminology', async () => {
      const callResponse = await request(app)
        .post('/api/ai/calls/initiate')
        .send({
          verification_id: verificationId,
          store_id: storeId,
          customer_phone_number: '+46701234567'
        })
        .expect(202);

      const callSessionId = callResponse.body.call_session_id;

      // Conversation with Swedish grocery terms
      const groceryTermsConversation = {
        messages: [
          {
            speaker: 'ai',
            content: 'Hej! Kan du berätta om din upplevelse i butiken?',
            timestamp_ms: 0,
            message_order: 1,
            language_detected: 'sv'
          },
          {
            speaker: 'customer',
            content: 'Charkuteridisken hade bra utbud och delikatessavdelningen var välsorterad. Frukt och grönt såg fräscht ut.',
            timestamp_ms: 5000,
            message_order: 2,
            language_detected: 'sv'
          },
          {
            speaker: 'ai',
            content: 'Vad bra! Hur upplevde du kassorna och självscanning?',
            timestamp_ms: 15000,
            message_order: 3,
            language_detected: 'sv'
          },
          {
            speaker: 'customer',
            content: 'Kassorna gick snabbt och självscanning fungerade bra. ICA-kortet aktiverades utan problem.',
            timestamp_ms: 22000,
            message_order: 4,
            language_detected: 'sv'
          }
        ],
        total_duration_seconds: 80,
        openai_session_id: 'sess_grocery_terms_123'
      };

      const response = await request(app)
        .post(`/api/ai/calls/${callSessionId}/transcript`)
        .send(groceryTermsConversation)
        .expect(200);

      // Verify AI understands Swedish grocery terminology
      expect(response.body.terminology_analysis).toHaveProperty('recognized_departments');
      expect(response.body.terminology_analysis.recognized_departments).toContain('charkuteri');
      expect(response.body.terminology_analysis.recognized_departments).toContain('delikatess');
      expect(response.body.terminology_analysis.recognized_departments).toContain('frukt_och_gront');

      expect(response.body.terminology_analysis).toHaveProperty('recognized_services');
      expect(response.body.terminology_analysis.recognized_services).toContain('kassorna');
      expect(response.body.terminology_analysis.recognized_services).toContain('självscanning');
    });
  });

  describe('Language Detection and Validation', () => {
    it('should detect language confidence levels', async () => {
      const callResponse = await request(app)
        .post('/api/ai/calls/initiate')
        .send({
          verification_id: verificationId,
          store_id: storeId,
          customer_phone_number: '+46701234567'
        })
        .expect(202);

      const callSessionId = callResponse.body.call_session_id;

      // Submit conversation with language confidence metadata
      const confidenceConversation = {
        messages: [
          {
            speaker: 'ai',
            content: 'Hej! Kan du berätta om din upplevelse?',
            timestamp_ms: 0,
            message_order: 1,
            language_detected: 'sv',
            language_confidence: 0.98
          },
          {
            speaker: 'customer',
            content: 'Ja, det var mycket bra. Personalen var hjälpsam och allt var rent.',
            timestamp_ms: 5000,
            message_order: 2,
            language_detected: 'sv',
            language_confidence: 0.95
          },
          {
            speaker: 'customer',
            content: 'Tack så mycket för er service!',
            timestamp_ms: 15000,
            message_order: 3,
            language_detected: 'sv',
            language_confidence: 0.97
          }
        ],
        total_duration_seconds: 70,
        openai_session_id: 'sess_confidence_test_123'
      };

      const response = await request(app)
        .post(`/api/ai/calls/${callSessionId}/transcript`)
        .send(confidenceConversation)
        .expect(200);

      expect(response.body.language_quality).toHaveProperty('average_confidence');
      expect(response.body.language_quality.average_confidence).toBeGreaterThan(0.9);
      expect(response.body.language_quality).toHaveProperty('minimum_confidence');
      expect(response.body.language_quality.minimum_confidence).toBeGreaterThan(0.8);
    });

    it('should handle low confidence Swedish detection', async () => {
      const callResponse = await request(app)
        .post('/api/ai/calls/initiate')
        .send({
          verification_id: verificationId,
          store_id: storeId,
          customer_phone_number: '+46701234567'
        })
        .expect(202);

      const callSessionId = callResponse.body.call_session_id;

      // Submit conversation with low confidence Swedish
      const lowConfidenceConversation = {
        messages: [
          {
            speaker: 'ai',
            content: 'Hej! Kan du berätta om din upplevelse?',
            timestamp_ms: 0,
            message_order: 1,
            language_detected: 'sv',
            language_confidence: 0.98
          },
          {
            speaker: 'customer',
            content: 'Mmm... ja... det var... okej...',
            timestamp_ms: 5000,
            message_order: 2,
            language_detected: 'sv',
            language_confidence: 0.65  // Low confidence due to mumbling
          },
          {
            speaker: 'ai',
            content: 'Kan du tala lite tydligare? Jag vill gärna höra din åsikt.',
            timestamp_ms: 12000,
            message_order: 3,
            language_detected: 'sv',
            language_confidence: 0.98
          }
        ],
        total_duration_seconds: 45,
        openai_session_id: 'sess_low_confidence_123'
      };

      const response = await request(app)
        .post(`/api/ai/calls/${callSessionId}/transcript`)
        .send(lowConfidenceConversation)
        .expect(200);

      expect(response.body.language_quality).toHaveProperty('quality_warning');
      expect(response.body.language_quality.quality_warning).toBe('low_confidence_detected');
      expect(response.body.language_quality).toHaveProperty('recommendation');
      expect(response.body.language_quality.recommendation).toContain('audio quality');
    });
  });

  describe('Swedish Number and Date Formatting', () => {
    it('should handle Swedish number formats in feedback', async () => {
      const callResponse = await request(app)
        .post('/api/ai/calls/initiate')
        .send({
          verification_id: verificationId,
          store_id: storeId,
          customer_phone_number: '+46701234567'
        })
        .expect(202);

      const callSessionId = callResponse.body.call_session_id;

      // Conversation mentioning Swedish number formats
      const numberFormatConversation = {
        messages: [
          {
            speaker: 'ai',
            content: 'Kan du berätta om din upplevelse?',
            timestamp_ms: 0,
            message_order: 1,
            language_detected: 'sv'
          },
          {
            speaker: 'customer',
            content: 'Jag handlade för 234,50 kronor och fick 15% rabatt. Klockan var ungefär 14:30.',
            timestamp_ms: 5000,
            message_order: 2,
            language_detected: 'sv'
          }
        ],
        total_duration_seconds: 60,
        openai_session_id: 'sess_numbers_123'
      };

      const response = await request(app)
        .post(`/api/ai/calls/${callSessionId}/transcript`)
        .send(numberFormatConversation)
        .expect(200);

      expect(response.body.format_analysis).toHaveProperty('currency_mentions');
      expect(response.body.format_analysis.currency_mentions).toContain('234,50 kronor');
      expect(response.body.format_analysis).toHaveProperty('time_mentions');
      expect(response.body.format_analysis.time_mentions).toContain('14:30');
    });
  });
});