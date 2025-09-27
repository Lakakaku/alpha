/**
 * Integration Test: Red flag keyword detection
 * Task: T024 - Integration test: Red flag keyword detection
 *
 * CRITICAL: This test MUST FAIL until red flag keyword detection integration is implemented
 */

import request from 'supertest';
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';

// Mock app setup - will be replaced with actual Express app
const mockApp = {
  post: () => ({ status: () => ({ json: () => null }) }),
  get: () => ({ status: () => ({ json: () => null }) }),
  listen: () => null
};

// Mock database setup - will be replaced with actual Supabase client
const mockDatabase = {
  from: () => ({
    insert: () => ({ data: null, error: null }),
    select: () => ({ data: [], error: null }),
    update: () => ({ data: null, error: null }),
    delete: () => ({ data: null, error: null })
  })
};

describe('Red flag keyword detection - Integration Test', () => {
  beforeEach(async () => {
    // Setup test database state with default Swedish red flag keywords
    // Insert test keywords: flygande elefanter, bomb, gratis pengar, etc.
  });

  afterEach(async () => {
    // Cleanup test database state
    // Reset keyword detection cache
  });

  test('Should detect Swedish nonsensical keywords in feedback content', async () => {
    // INTENTIONAL FAILURE: Integration not implemented yet
    const nonsensicalFeedback = {
      phone_hash: 'hash123nonsense',
      feedback_content: 'Maten var bra men jag såg flygande elefanter i köket som åt min pizza',
      business_context: {
        business_type: 'restaurant',
        location: 'Stockholm',
        language: 'sv'
      }
    };

    const response = await request(mockApp as any)
      .post('/api/fraud/analyze')
      .send(nonsensicalFeedback)
      .expect(200);

    // Verify keyword detection results
    expect(response.body.keyword_analysis).toMatchObject({
      detected_keywords: expect.arrayContaining([
        expect.objectContaining({
          keyword: 'flygande elefanter',
          category: 'nonsensical',
          severity_level: expect.any(Number),
          positions: expect.any(Array)
        })
      ]),
      total_matches: expect.any(Number),
      highest_severity: expect.any(Number),
      risk_score: expect.any(Number)
    });

    // Verify fraud scoring impact (20% weight for keyword detection)
    expect(response.body.fraud_score.keyword_detection_score).toBeLessThan(50);
    expect(response.body.fraud_score.keyword_detection_weight).toBe(20);
    expect(response.body.is_fraudulent).toBe(true);
  });

  test('Should detect Swedish threat keywords with high severity', async () => {
    const threatFeedback = {
      phone_hash: 'hash456threat',
      feedback_content: 'Om ni inte ger mig gratis mat så kommer jag med en bomb imorgon',
      business_context: {
        business_type: 'restaurant',
        location: 'Göteborg',
        language: 'sv'
      }
    };

    const response = await request(mockApp as any)
      .post('/api/fraud/analyze')
      .send(threatFeedback)
      .expect(200);

    // Verify high severity threat detection
    expect(response.body.keyword_analysis.detected_keywords).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          keyword: 'bomb',
          category: 'threats',
          severity_level: 10, // Maximum severity
          positions: expect.any(Array)
        })
      ])
    );

    expect(response.body.keyword_analysis.highest_severity).toBe(10);
    expect(response.body.keyword_analysis.risk_score).toBeGreaterThan(90);
    expect(response.body.fraud_score.overall_score).toBeLessThan(30); // Very low due to threats
  });

  test('Should detect Swedish profanity keywords', async () => {
    const profanityFeedback = {
      phone_hash: 'hash789profanity',
      feedback_content: 'Den jävla maten var skit och personalen var idioter',
      business_context: {
        business_type: 'restaurant',
        location: 'Malmö',
        language: 'sv'
      }
    };

    const response = await request(mockApp as any)
      .post('/api/fraud/analyze')
      .send(profanityFeedback)
      .expect(200);

    // Verify profanity detection
    expect(response.body.keyword_analysis.detected_keywords).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'profanity',
          severity_level: expect.any(Number)
        })
      ])
    );

    expect(response.body.keyword_analysis.total_matches).toBeGreaterThan(0);
    expect(response.body.fraud_score.keyword_detection_score).toBeLessThan(70);
  });

  test('Should detect impossible scenario keywords', async () => {
    const impossibleFeedback = {
      phone_hash: 'hash012impossible',
      feedback_content: 'Jag åt middag med drakar och sedan flög vi till månen för efterrätt',
      business_context: {
        business_type: 'restaurant',
        location: 'Uppsala',
        language: 'sv'
      }
    };

    const response = await request(mockApp as any)
      .post('/api/fraud/analyze')
      .send(impossibleFeedback)
      .expect(200);

    // Verify impossible scenario detection
    expect(response.body.keyword_analysis.detected_keywords).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'impossible',
          severity_level: expect.any(Number)
        })
      ])
    );

    expect(response.body.keyword_analysis.risk_score).toBeGreaterThan(80);
  });

  test('Should handle regex pattern matching for advanced keywords', async () => {
    const patternFeedback = {
      phone_hash: 'hash345pattern',
      feedback_content: 'Ring 0700-123456 för gratis pengar! Begränsad tid!',
      business_context: {
        business_type: 'restaurant',
        location: 'Västerås',
        language: 'sv'
      }
    };

    const response = await request(mockApp as any)
      .post('/api/fraud/analyze')
      .send(patternFeedback)
      .expect(200);

    // Verify regex pattern detection for phone numbers and suspicious phrases
    expect(response.body.keyword_analysis.detected_keywords).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          keyword: 'gratis pengar',
          detection_pattern: expect.any(String),
          positions: expect.any(Array)
        })
      ])
    );

    expect(response.body.keyword_analysis.pattern_matches).toBeGreaterThan(0);
  });

  test('Should persist keyword detection results to database', async () => {
    const testFeedback = {
      phone_hash: 'hash678database',
      feedback_content: 'Flygande elefanter serverade mig middag på restaurangen',
      business_context: {
        business_type: 'restaurant',
        location: 'Linköping',
        language: 'sv'
      }
    };

    const response = await request(mockApp as any)
      .post('/api/fraud/analyze')
      .send(testFeedback)
      .expect(200);

    // Verify database persistence
    expect(response.body.keyword_analysis.detection_id).toMatch(
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
    );

    expect(response.body.keyword_analysis).toMatchObject({
      detection_id: expect.any(String),
      phone_hash: 'hash678database',
      detection_timestamp: expect.stringMatching(/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d{3})?Z$/),
      keywords_version: expect.any(String) // Version of keyword database used
    });
  });

  test('Should load and cache red flag keywords from database', async () => {
    // Test keyword retrieval endpoint
    const keywordsResponse = await request(mockApp as any)
      .get('/api/fraud/keywords')
      .set('Authorization', 'Bearer admin-token')
      .expect(200);

    // Verify default Swedish keywords are loaded
    expect(keywordsResponse.body.keywords).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          keyword: 'flygande elefanter',
          category: 'nonsensical',
          severity_level: expect.any(Number),
          language_code: 'sv'
        }),
        expect.objectContaining({
          keyword: 'bomb',
          category: 'threats',
          severity_level: 10,
          language_code: 'sv'
        })
      ])
    );

    expect(keywordsResponse.body.keywords.length).toBeGreaterThan(10); // Should have substantial keyword base
  });

  test('Should support dynamic keyword management', async () => {
    // Add new keyword via admin API
    const newKeyword = {
      keyword: 'test-fraudulent-word',
      category: 'nonsensical',
      severity_level: 6,
      language_code: 'sv',
      detection_pattern: '\\btest-fraudulent-word\\b'
    };

    const addResponse = await request(mockApp as any)
      .post('/api/fraud/keywords')
      .set('Authorization', 'Bearer admin-token')
      .send(newKeyword)
      .expect(201);

    expect(addResponse.body.success).toBe(true);

    // Test detection with new keyword
    const testFeedback = {
      phone_hash: 'hash901dynamic',
      feedback_content: 'This test-fraudulent-word should be detected now',
      business_context: {
        business_type: 'restaurant',
        location: 'Helsingborg',
        language: 'sv'
      }
    };

    const detectionResponse = await request(mockApp as any)
      .post('/api/fraud/analyze')
      .send(testFeedback)
      .expect(200);

    // Verify new keyword is detected
    expect(detectionResponse.body.keyword_analysis.detected_keywords).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          keyword: 'test-fraudulent-word',
          category: 'nonsensical',
          severity_level: 6
        })
      ])
    );
  });

  test('Should handle case-insensitive and diacritical matching', async () => {
    const diacriticalFeedback = {
      phone_hash: 'hash234diacritics',
      feedback_content: 'FLYGANDE ELEFANTER och månen åt min kött',
      business_context: {
        business_type: 'restaurant',
        location: 'Örebro',
        language: 'sv'
      }
    };

    const response = await request(mockApp as any)
      .post('/api/fraud/analyze')
      .send(diacriticalFeedback)
      .expect(200);

    // Verify case-insensitive detection
    expect(response.body.keyword_analysis.detected_keywords).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          keyword: 'flygande elefanter',
          matched_text: 'FLYGANDE ELEFANTER',
          case_variant: true
        })
      ])
    );
  });

  test('Should calculate accurate risk scores based on keyword severity', async () => {
    const multiKeywordFeedback = {
      phone_hash: 'hash567multi',
      feedback_content: 'Flygande elefanter med bomb i restaurangen, helt gratis pengar!',
      business_context: {
        business_type: 'restaurant',
        location: 'Sundsvall',
        language: 'sv'
      }
    };

    const response = await request(mockApp as any)
      .post('/api/fraud/analyze')
      .send(multiKeywordFeedback)
      .expect(200);

    // Verify risk score calculation
    const keywordAnalysis = response.body.keyword_analysis;
    expect(keywordAnalysis.total_matches).toBeGreaterThan(2);
    expect(keywordAnalysis.highest_severity).toBe(10); // From 'bomb'
    
    // Risk score should be very high due to multiple severe keywords
    expect(keywordAnalysis.risk_score).toBeGreaterThan(95);
    expect(response.body.fraud_score.keyword_detection_score).toBeLessThan(10);
  });

  test('Should integrate with fraud scoring system (20% weight)', async () => {
    const testFeedback = {
      phone_hash: 'hash890integration',
      feedback_content: 'Maten var bra, personalen trevlig', // Clean content
      business_context: {
        business_type: 'restaurant',
        location: 'Umeå',
        language: 'sv'
      }
    };

    const response = await request(mockApp as any)
      .post('/api/fraud/analyze')
      .send(testFeedback)
      .expect(200);

    // Verify clean content gets high keyword score
    expect(response.body.keyword_analysis.detected_keywords).toHaveLength(0);
    expect(response.body.keyword_analysis.risk_score).toBeLessThan(10);
    expect(response.body.fraud_score.keyword_detection_score).toBeGreaterThan(90);
    expect(response.body.fraud_score.keyword_detection_weight).toBe(20);

    // Verify keyword detection contributes 20% to overall score
    const keywordScore = response.body.fraud_score.keyword_detection_score;
    const expectedContribution = Math.round(keywordScore * 0.2);
    
    expect(response.body.fraud_score).toMatchObject({
      keyword_detection_score: keywordScore,
      context_analysis_score: expect.any(Number),
      behavioral_pattern_score: expect.any(Number),
      transaction_verification_score: expect.any(Number),
      overall_score: expect.any(Number)
    });
  });

  test('Should provide keyword position information for highlighting', async () => {
    const positionFeedback = {
      phone_hash: 'hash123positions',
      feedback_content: 'Normal text här, men sedan flygande elefanter i slutet',
      business_context: {
        business_type: 'restaurant',
        location: 'Karlstad',
        language: 'sv'
      }
    };

    const response = await request(mockApp as any)
      .post('/api/fraud/analyze')
      .send(positionFeedback)
      .expect(200);

    // Verify position information for UI highlighting
    expect(response.body.keyword_analysis.detected_keywords[0]).toMatchObject({
      keyword: 'flygande elefanter',
      positions: expect.arrayContaining([
        expect.objectContaining({
          start: expect.any(Number),
          end: expect.any(Number),
          matched_text: 'flygande elefanter'
        })
      ])
    });

    // Verify position accuracy
    const position = response.body.keyword_analysis.detected_keywords[0].positions[0];
    const extractedText = positionFeedback.feedback_content.substring(position.start, position.end);
    expect(extractedText).toBe('flygande elefanter');
  });
});

// NOTE: This test file will FAIL until the red flag keyword detection integration is implemented
// This is intentional and required for TDD approach