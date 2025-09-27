import request from 'supertest';
import { app } from '../../src/app';

describe('Feedback Quality Analysis Integration Test', () => {
  const validJWT = 'valid-test-jwt';
  const validStoreId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

  beforeEach(() => {
    // This test MUST fail initially (TDD requirement)
    // Tests feedback analysis pipeline from quickstart.md Scenario 4
  });

  test('should analyze high-quality detailed feedback (8-12% reward range)', async () => {
    // Create and complete a call with detailed, useful feedback
    const callSetup = await setupCompleteCall({
      feedback_type: 'detailed_positive',
      transcript: [
        {
          speaker: 'ai',
          content: 'Hej! Tack för att du handlade hos oss idag. Kan du berätta om din upplevelse?',
          timestamp_ms: 0,
          message_order: 1,
          message_type: 'question',
          language_detected: 'sv'
        },
        {
          speaker: 'customer',
          content: 'Jag var mycket nöjd! Personalen vid köttdisken var extremt hjälpsam och kunnig. De hjälpte mig välja rätt kött för min middag och gav till och med koktips. Butiken var ren och välorganiserad.',
          timestamp_ms: 8000,
          message_order: 2,
          message_type: 'response',
          confidence_score: 0.96,
          language_detected: 'sv'
        },
        {
          speaker: 'ai',
          content: 'Det låter fantastiskt! Fanns det något som kunde förbättras?',
          timestamp_ms: 20000,
          message_order: 3,
          message_type: 'question',
          language_detected: 'sv'
        },
        {
          speaker: 'customer',
          content: 'Enda förbättringen skulle vara att ha fler kassor öppna under rusningstid. Jag väntade i cirka 8 minuter, vilket var lite långt. Men det påverkade inte min helhetsbild - jag kommer definitivt tillbaka!',
          timestamp_ms: 35000,
          message_order: 4,
          message_type: 'response',
          confidence_score: 0.94,
          language_detected: 'sv'
        }
      ],
      duration_seconds: 105
    });

    // Process analysis
    const analysisResponse = await request(app)
      .post('/ai/analysis/process')
      .set('Authorization', `Bearer ${validJWT}`)
      .send({
        call_session_id: callSetup.callSessionId,
        transcript_id: callSetup.transcriptId,
        priority: 'normal'
      })
      .expect(202);

    const analysisId = analysisResponse.body.analysis_id;

    // Wait for analysis completion and get results
    const results = await waitForAnalysisCompletion(analysisId);

    // Validate high-quality scoring
    expect(results.scores.legitimacy_score).toBeGreaterThan(0.85); // Very legitimate
    expect(results.scores.depth_score).toBeGreaterThan(0.8); // Detailed feedback
    expect(results.scores.usefulness_score).toBeGreaterThan(0.75); // Actionable insights
    expect(results.scores.overall_quality_score).toBeGreaterThan(0.8); // High overall quality

    // Validate reward percentage in expected range for high-quality feedback
    expect(results.reward_percentage).toBeGreaterThanOrEqual(8.0);
    expect(results.reward_percentage).toBeLessThanOrEqual(12.0);

    // Should not be flagged as fraudulent
    expect(results.is_fraudulent).toBe(false);

    // Should generate business actionable items
    expect(results.business_actionable_items).toBeDefined();
    expect(results.business_actionable_items.length).toBeGreaterThan(0);

    const checkoutIssue = results.business_actionable_items.find((item: any) => 
      item.description.toLowerCase().includes('kassa') || 
      item.description.toLowerCase().includes('checkout')
    );
    expect(checkoutIssue).toBeDefined();
    expect(checkoutIssue.priority).toMatch(/^(medium|high)$/);

    // Should have analysis summary
    expect(results.analysis_summary).toBeDefined();
    expect(results.analysis_summary.length).toBeGreaterThan(50);

    console.log('✅ High-quality feedback analysis passed - reward percentage:', results.reward_percentage);
  });

  test('should analyze low-quality vague feedback (2-4% reward range)', async () => {
    // Create and complete a call with vague, minimal feedback
    const callSetup = await setupCompleteCall({
      feedback_type: 'low_quality',
      transcript: [
        {
          speaker: 'ai',
          content: 'Hej! Kan du berätta om din upplevelse i butiken?',
          timestamp_ms: 0,
          message_order: 1,
          message_type: 'question',
          language_detected: 'sv'
        },
        {
          speaker: 'customer',
          content: 'Det var okej.',
          timestamp_ms: 3000,
          message_order: 2,
          message_type: 'response',
          confidence_score: 0.88,
          language_detected: 'sv'
        },
        {
          speaker: 'ai',
          content: 'Kan du vara mer specifik? Vad var bra eller dåligt?',
          timestamp_ms: 8000,
          message_order: 3,
          message_type: 'question',
          language_detected: 'sv'
        },
        {
          speaker: 'customer',
          content: 'Vet inte. Allt var väl normalt.',
          timestamp_ms: 12000,
          message_order: 4,
          message_type: 'response',
          confidence_score: 0.85,
          language_detected: 'sv'
        }
      ],
      duration_seconds: 62 // Just above minimum
    });

    // Process analysis
    const analysisResponse = await request(app)
      .post('/ai/analysis/process')
      .set('Authorization', `Bearer ${validJWT}`)
      .send({
        call_session_id: callSetup.callSessionId,
        transcript_id: callSetup.transcriptId
      })
      .expect(202);

    const results = await waitForAnalysisCompletion(analysisResponse.body.analysis_id);

    // Validate low-quality scoring
    expect(results.scores.legitimacy_score).toBeGreaterThan(0.6); // Still legitimate, just not detailed
    expect(results.scores.depth_score).toBeLessThan(0.4); // Low detail
    expect(results.scores.usefulness_score).toBeLessThan(0.3); // Not very actionable
    expect(results.scores.overall_quality_score).toBeLessThan(0.4); // Low overall quality

    // Validate reward percentage in low range
    expect(results.reward_percentage).toBeGreaterThanOrEqual(2.0);
    expect(results.reward_percentage).toBeLessThanOrEqual(4.0);

    // Should not be fraudulent
    expect(results.is_fraudulent).toBe(false);

    // May have few or no actionable items
    if (results.business_actionable_items) {
      expect(results.business_actionable_items.length).toBeLessThanOrEqual(1);
    }

    console.log('✅ Low-quality feedback analysis passed - reward percentage:', results.reward_percentage);
  });

  test('should analyze medium-quality feedback (5-7% reward range)', async () => {
    // Create and complete a call with moderate detail feedback
    const callSetup = await setupCompleteCall({
      feedback_type: 'medium_quality',
      transcript: [
        {
          speaker: 'ai',
          content: 'Hej! Hur var din shoppingupplevelse idag?',
          timestamp_ms: 0,
          message_order: 1,
          message_type: 'question',
          language_detected: 'sv'
        },
        {
          speaker: 'customer',
          content: 'Ganska bra. Jag hittade det jag behövde och personalen var trevlig när jag frågade om hjälp.',
          timestamp_ms: 6000,
          message_order: 2,
          message_type: 'response',
          confidence_score: 0.91,
          language_detected: 'sv'
        },
        {
          speaker: 'ai',
          content: 'Fanns det något som kunde varit bättre?',
          timestamp_ms: 15000,
          message_order: 3,
          message_type: 'question',
          language_detected: 'sv'
        },
        {
          speaker: 'customer',
          content: 'Prisnivån kändes lite hög på vissa produkter, men kvaliteten var bra så det var okej.',
          timestamp_ms: 22000,
          message_order: 4,
          message_type: 'response',
          confidence_score: 0.89,
          language_detected: 'sv'
        }
      ],
      duration_seconds: 85
    });

    // Process analysis
    const analysisResponse = await request(app)
      .post('/ai/analysis/process')
      .set('Authorization', `Bearer ${validJWT}`)
      .send({
        call_session_id: callSetup.callSessionId,
        transcript_id: callSetup.transcriptId
      })
      .expect(202);

    const results = await waitForAnalysisCompletion(analysisResponse.body.analysis_id);

    // Validate medium-quality scoring
    expect(results.scores.legitimacy_score).toBeGreaterThan(0.75);
    expect(results.scores.depth_score).toBeGreaterThan(0.4);
    expect(results.scores.depth_score).toBeLessThan(0.8);
    expect(results.scores.usefulness_score).toBeGreaterThan(0.3);
    expect(results.scores.usefulness_score).toBeLessThan(0.75);
    expect(results.scores.overall_quality_score).toBeGreaterThan(0.4);
    expect(results.scores.overall_quality_score).toBeLessThan(0.8);

    // Validate reward percentage in medium range
    expect(results.reward_percentage).toBeGreaterThanOrEqual(5.0);
    expect(results.reward_percentage).toBeLessThanOrEqual(7.0);

    // Should have some actionable items
    expect(results.business_actionable_items).toBeDefined();
    if (results.business_actionable_items.length > 0) {
      const pricingItem = results.business_actionable_items.find((item: any) => 
        item.category === 'pricing' || 
        item.description.toLowerCase().includes('pris')
      );
      if (pricingItem) {
        expect(pricingItem.priority).toMatch(/^(low|medium)$/);
      }
    }

    console.log('✅ Medium-quality feedback analysis passed - reward percentage:', results.reward_percentage);
  });

  test('should correctly grade feedback across quality spectrum (2-15% range)', async () => {
    const qualityTests = [
      {
        name: 'Exceptional detailed feedback',
        expectedRange: [12, 15],
        contentQuality: 'exceptional',
        transcript: createDetailedTranscript('exceptional')
      },
      {
        name: 'Good specific feedback',
        expectedRange: [8, 12],
        contentQuality: 'good',
        transcript: createDetailedTranscript('good')
      },
      {
        name: 'Average feedback',
        expectedRange: [5, 8],
        contentQuality: 'average',
        transcript: createDetailedTranscript('average')
      },
      {
        name: 'Poor minimal feedback',
        expectedRange: [2, 5],
        contentQuality: 'poor',
        transcript: createDetailedTranscript('poor')
      }
    ];

    const results = [];

    for (const test of qualityTests) {
      const callSetup = await setupCompleteCall({
        feedback_type: test.contentQuality,
        transcript: test.transcript,
        duration_seconds: 90
      });

      const analysisResponse = await request(app)
        .post('/ai/analysis/process')
        .set('Authorization', `Bearer ${validJWT}`)
        .send({
          call_session_id: callSetup.callSessionId,
          transcript_id: callSetup.transcriptId
        })
        .expect(202);

      const analysisResults = await waitForAnalysisCompletion(analysisResponse.body.analysis_id);

      // Validate reward percentage is within expected range
      expect(analysisResults.reward_percentage).toBeGreaterThanOrEqual(test.expectedRange[0]);
      expect(analysisResults.reward_percentage).toBeLessThanOrEqual(test.expectedRange[1]);

      results.push({
        name: test.name,
        reward_percentage: analysisResults.reward_percentage,
        overall_quality: analysisResults.scores.overall_quality_score,
        expected_range: test.expectedRange
      });
    }

    // Verify quality scoring consistency (higher quality = higher rewards)
    results.sort((a, b) => a.overall_quality - b.overall_quality);
    for (let i = 1; i < results.length; i++) {
      expect(results[i].reward_percentage).toBeGreaterThanOrEqual(results[i-1].reward_percentage);
    }

    console.log('✅ Quality spectrum analysis passed:');
    results.forEach(result => {
      console.log(`  ${result.name}: ${result.reward_percentage}% (expected ${result.expected_range[0]}-${result.expected_range[1]}%)`);
    });
  });

  test('should generate meaningful business insights from quality feedback', async () => {
    // Test analysis summarization and actionable item generation
    const callSetup = await setupCompleteCall({
      feedback_type: 'business_insights',
      transcript: [
        {
          speaker: 'ai',
          content: 'Hej! Kan du dela din upplevelse från butiken idag?',
          timestamp_ms: 0,
          message_order: 1,
          message_type: 'question',
          language_detected: 'sv'
        },
        {
          speaker: 'customer',
          content: 'Överlag bra, men jag märkte att frukt- och gröntavdelningen hade lite gamla produkter. Salladen såg inte fräsch ut och några bananer var överripa. Men personalen var hjälpsam när jag frågade.',
          timestamp_ms: 10000,
          message_order: 2,
          message_type: 'response',
          confidence_score: 0.93,
          language_detected: 'sv'
        },
        {
          speaker: 'ai',
          content: 'Tack för feedbacken om frukt och grönt. Något annat du vill kommentera?',
          timestamp_ms: 25000,
          message_order: 3,
          message_type: 'question',
          language_detected: 'sv'
        },
        {
          speaker: 'customer',
          content: 'Ja, parkeringen var också problematisk. Det var svårt att hitta en plats och några handikappplatser var blockerade av vanliga bilar. Det borde kontrolleras bättre.',
          timestamp_ms: 35000,
          message_order: 4,
          message_type: 'response',
          confidence_score: 0.95,
          language_detected: 'sv'
        }
      ],
      duration_seconds: 98
    });

    // Process analysis
    const analysisResponse = await request(app)
      .post('/ai/analysis/process')
      .set('Authorization', `Bearer ${validJWT}`)
      .send({
        call_session_id: callSetup.callSessionId,
        transcript_id: callSetup.transcriptId
      })
      .expect(202);

    const results = await waitForAnalysisCompletion(analysisResponse.body.analysis_id);

    // Should have specific actionable items for both issues mentioned
    expect(results.business_actionable_items).toBeDefined();
    expect(results.business_actionable_items.length).toBeGreaterThanOrEqual(2);

    // Look for produce quality item
    const produceItem = results.business_actionable_items.find((item: any) => 
      item.category === 'product' && 
      (item.description.toLowerCase().includes('frukt') || 
       item.description.toLowerCase().includes('produce') ||
       item.description.toLowerCase().includes('fresh'))
    );
    expect(produceItem).toBeDefined();
    expect(produceItem.priority).toMatch(/^(medium|high)$/);

    // Look for parking/accessibility item
    const parkingItem = results.business_actionable_items.find((item: any) => 
      item.category === 'accessibility' && 
      (item.description.toLowerCase().includes('parking') || 
       item.description.toLowerCase().includes('handikapp'))
    );
    expect(parkingItem).toBeDefined();
    expect(parkingItem.priority).toMatch(/^(medium|high|urgent)$/);

    // Should have detailed analysis summary
    expect(results.analysis_summary).toBeDefined();
    expect(results.analysis_summary.length).toBeGreaterThan(100);
    expect(results.analysis_summary.toLowerCase()).toContain('frukt');
    expect(results.analysis_summary.toLowerCase()).toContain('parkering');

    // Generate additional summary
    const summaryResponse = await request(app)
      .post('/ai/analysis/summary/generate')
      .set('Authorization', `Bearer ${validJWT}`)
      .send({
        call_session_id: callSetup.callSessionId,
        quality_threshold: 0.05,
        preserve_details: true,
        target_length: 'detailed'
      })
      .expect(200);

    expect(summaryResponse.body.summary_text).toBeDefined();
    expect(summaryResponse.body.key_insights).toBeDefined();
    expect(summaryResponse.body.key_insights.length).toBeGreaterThan(0);

    console.log('✅ Business insights generation passed - found specific actionable items');
  });

  // Helper functions
  async function setupCompleteCall(options: {
    feedback_type: string;
    transcript: any[];
    duration_seconds: number;
  }) {
    // Create verification
    const verificationResponse = await request(app)
      .post('/api/verification/create')
      .set('Authorization', `Bearer ${validJWT}`)
      .send({
        store_id: validStoreId,
        transaction_time: new Date().toISOString(),
        transaction_value: 75.50,
        phone_number: `+4670123456${Math.floor(Math.random() * 10)}`
      })
      .expect(201);

    // Initiate call
    const callResponse = await request(app)
      .post('/ai/calls/initiate')
      .set('Authorization', `Bearer ${validJWT}`)
      .send({
        customer_verification_id: verificationResponse.body.verification_id,
        phone_number: `+4670123456${Math.floor(Math.random() * 10)}`,
        store_id: validStoreId
      })
      .expect(202);

    // Submit transcript
    const transcriptResponse = await request(app)
      .post(`/ai/calls/${callResponse.body.call_session_id}/transcript`)
      .set('Authorization', `Bearer ${validJWT}`)
      .send({
        messages: options.transcript,
        total_duration_seconds: options.duration_seconds,
        openai_session_id: `sess_${options.feedback_type}_${Date.now()}`
      })
      .expect(201);

    return {
      callSessionId: callResponse.body.call_session_id,
      transcriptId: transcriptResponse.body.transcript_id
    };
  }

  async function waitForAnalysisCompletion(analysisId: string) {
    // In real implementation, this would poll the status endpoint
    // For testing, we simulate immediate completion
    const resultsResponse = await request(app)
      .get(`/ai/analysis/${analysisId}/results`)
      .set('Authorization', `Bearer ${validJWT}`)
      .expect(200);

    return resultsResponse.body;
  }

  function createDetailedTranscript(quality: string) {
    const transcripts = {
      exceptional: [
        {
          speaker: 'ai',
          content: 'Hej! Kan du berätta detaljerat om din shoppingupplevelse?',
          timestamp_ms: 0,
          message_order: 1,
          message_type: 'question',
          language_detected: 'sv'
        },
        {
          speaker: 'customer',
          content: 'Absolut! Jag är mycket imponerad av er service. Personalen i delikatessavdelningen var otroligt kunnig om ostarna och hjälpte mig välja perfekta kombinationer för min fest. Butiken var välorganiserad, alla priser var tydligt markerade, och checkout-processen var smidig trots kön. Jag uppskattar särskilt att ni har glutenfria alternativ väl märkta.',
          timestamp_ms: 8000,
          message_order: 2,
          message_type: 'response',
          confidence_score: 0.97,
          language_detected: 'sv'
        }
      ],
      good: [
        {
          speaker: 'ai',
          content: 'Hej! Hur var din upplevelse i butiken?',
          timestamp_ms: 0,
          message_order: 1,
          message_type: 'question',
          language_detected: 'sv'
        },
        {
          speaker: 'customer',
          content: 'Bra överlag! Personalen var hjälpsam och jag hittade allt jag behövde. Köavdelningen hade fräscha produkter men kassakön var lite lång under lunchtid.',
          timestamp_ms: 6000,
          message_order: 2,
          message_type: 'response',
          confidence_score: 0.92,
          language_detected: 'sv'
        }
      ],
      average: [
        {
          speaker: 'ai',
          content: 'Hej! Vad tyckte du om butiken?',
          timestamp_ms: 0,
          message_order: 1,
          message_type: 'question',
          language_detected: 'sv'
        },
        {
          speaker: 'customer',
          content: 'Det var okej. Inget särskilt bra eller dåligt. Vanlig matbutik.',
          timestamp_ms: 4000,
          message_order: 2,
          message_type: 'response',
          confidence_score: 0.87,
          language_detected: 'sv'
        }
      ],
      poor: [
        {
          speaker: 'ai',
          content: 'Hej! Kan du berätta om ditt besök?',
          timestamp_ms: 0,
          message_order: 1,
          message_type: 'question',
          language_detected: 'sv'
        },
        {
          speaker: 'customer',
          content: 'Mmm.',
          timestamp_ms: 2000,
          message_order: 2,
          message_type: 'response',
          confidence_score: 0.75,
          language_detected: 'sv'
        }
      ]
    };

    return transcripts[quality as keyof typeof transcripts] || transcripts.average;
  }
});