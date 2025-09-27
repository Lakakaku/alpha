import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import { app } from '../../src/app';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@vocilia/types/database';

const supabase = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

describe('AI Assistant Multi-Store Business Integration Test', () => {
  let businessId: string;
  let store1Id: string;
  let store2Id: string;
  let store3Id: string;
  let accessToken: string;
  let conversationIds: string[] = [];

  beforeEach(async () => {
    // Create test business
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .insert({
        business_name: 'Multi-Store Restaurant Chain',
        email: 'multistore-test@vocilia.com',
        verification_status: 'approved'
      })
      .select()
      .single();

    if (businessError) throw businessError;
    businessId = business.id;

    // Create multiple stores with different characteristics
    const { data: stores, error: storesError } = await supabase
      .from('stores')
      .insert([
        {
          business_id: businessId,
          store_name: 'Downtown Flagship',
          address: '100 Main Street',
          city: 'Metro City',
          postal_code: '10001',
          country: 'USA'
        },
        {
          business_id: businessId,
          store_name: 'Suburban Family Location',
          address: '200 Family Ave',
          city: 'Suburbia',
          postal_code: '20002',
          country: 'USA'
        },
        {
          business_id: businessId,
          store_name: 'Airport Terminal',
          address: '300 Terminal Blvd',
          city: 'Airport City',
          postal_code: '30003',
          country: 'USA'
        }
      ])
      .select();

    if (storesError) throw storesError;
    [store1Id, store2Id, store3Id] = stores.map(store => store.id);

    // Pre-populate store 1 with some context (flagship store)
    await supabase.from('context_entries').insert([
      {
        store_id: store1Id,
        category: 'business_type',
        content: 'Upscale casual dining restaurant with full bar and patio seating',
        confidence_score: 0.9,
        source: 'manual',
        version: 1
      },
      {
        store_id: store1Id,
        category: 'operating_hours',
        content: 'Monday-Thursday 11 AM - 10 PM, Friday-Saturday 11 AM - 11 PM, Sunday 10 AM - 9 PM',
        confidence_score: 0.8,
        source: 'manual',
        version: 1
      },
      {
        store_id: store1Id,
        category: 'target_audience',
        content: 'Urban professionals, tourists, business meetings, casual dining',
        confidence_score: 0.7,
        source: 'manual',
        version: 1
      }
    ]);

    accessToken = 'mock-token-' + businessId;
  });

  afterEach(async () => {
    // Cleanup test data
    for (const convId of conversationIds) {
      await supabase
        .from('ai_conversations')
        .delete()
        .eq('id', convId);
    }

    await supabase
      .from('context_entries')
      .delete()
      .in('store_id', [store1Id, store2Id, store3Id]);

    await supabase
      .from('stores')
      .delete()
      .eq('business_id', businessId);
    
    await supabase
      .from('businesses')
      .delete()
      .eq('id', businessId);
  });

  test('Should handle context building for multiple distinct store locations', async () => {
    // Build context for suburban family location (store 2)
    const createConv2Response = await request(app)
      .post('/ai-assistant/conversations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        store_id: store2Id,
        conversation_type: 'context_builder'
      });

    expect(createConv2Response.status).toBe(201);
    const conv2Id = createConv2Response.body.id;
    conversationIds.push(conv2Id);

    // Describe the suburban location characteristics
    const suburbanResponse = await request(app)
      .post(`/ai-assistant/conversations/${conv2Id}/messages`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        content: "This is our family-friendly location with a large kids' menu, play area, and birthday party packages. We focus on affordable family dining.",
        message_type: 'user'
      });

    expect(suburbanResponse.status).toBe(201);
    expect(suburbanResponse.body.ai_response.content).toMatch(/family|kids|affordable/i);

    // Add operating hours different from flagship
    const hoursResponse = await request(app)
      .post(`/ai-assistant/conversations/${conv2Id}/messages`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        content: "We open earlier here for breakfast at 8 AM and close by 9 PM to accommodate families. No alcohol service at this location.",
        message_type: 'user'
      });

    expect(hoursResponse.status).toBe(201);

    // Build context for airport location (store 3)
    const createConv3Response = await request(app)
      .post('/ai-assistant/conversations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        store_id: store3Id,
        conversation_type: 'context_builder'
      });

    expect(createConv3Response.status).toBe(201);
    const conv3Id = createConv3Response.body.id;
    conversationIds.push(conv3Id);

    // Describe airport location characteristics
    const airportResponse = await request(app)
      .post(`/ai-assistant/conversations/${conv3Id}/messages`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        content: "This is our airport terminal location. We serve travelers with quick service, grab-and-go options, and extended hours. Limited seating, focus on speed.",
        message_type: 'user'
      });

    expect(airportResponse.status).toBe(201);
    expect(airportResponse.body.ai_response.content).toMatch(/travelers|quick|grab.*go|speed/i);

    // Verify distinct contexts were created for each store
    const store1Context = await request(app)
      .get('/ai-assistant/context/entries')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ store_id: store1Id });

    const store2Context = await request(app)
      .get('/ai-assistant/context/entries')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ store_id: store2Id });

    const store3Context = await request(app)
      .get('/ai-assistant/context/entries')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ store_id: store3Id });

    // Store 1 (flagship) should have upscale content
    const store1BusinessType = store1Context.body.entries.find(
      (entry: any) => entry.category === 'business_type'
    );
    expect(store1BusinessType.content).toMatch(/upscale|full bar|patio/i);

    // Store 2 (suburban) should have family content
    const store2BusinessType = store2Context.body.entries.find(
      (entry: any) => entry.category === 'business_type'
    );
    expect(store2BusinessType.content).toMatch(/family.*friendly|kids.*menu|play area/i);

    // Store 3 (airport) should have travel content
    const store3BusinessType = store3Context.body.entries.find(
      (entry: any) => entry.category === 'business_type'
    );
    expect(store3BusinessType.content).toMatch(/airport|travelers|quick service|grab.*go/i);

    // Verify operating hours are different for each location
    const store1Hours = store1Context.body.entries.find(
      (entry: any) => entry.category === 'operating_hours'
    );
    const store2Hours = store2Context.body.entries.find(
      (entry: any) => entry.category === 'operating_hours'
    );

    expect(store1Hours.content).toMatch(/11 AM.*10 PM|11 AM.*11 PM/);
    expect(store2Hours.content).toMatch(/8 AM.*9 PM/);
  });

  test('Should provide location-specific suggestions based on store characteristics', async () => {
    // Get suggestions for suburban family location
    const store2Suggestions = await request(app)
      .get('/ai-assistant/suggestions')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ store_id: store2Id });

    expect(store2Suggestions.status).toBe(200);
    
    // Should suggest family-specific enhancements
    const familySuggestions = store2Suggestions.body.suggestions;
    const kidsFriendlySuggestion = familySuggestions.find(
      (s: any) => s.content.toLowerCase().includes('kids') || 
                  s.content.toLowerCase().includes('family') ||
                  s.category === 'family_amenities'
    );
    expect(kidsFriendlySuggestion).toBeDefined();

    // Get suggestions for airport location  
    const store3Suggestions = await request(app)
      .get('/ai-assistant/suggestions')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ store_id: store3Id });

    expect(store3Suggestions.status).toBe(200);
    
    // Should suggest travel-specific enhancements
    const travelSuggestions = store3Suggestions.body.suggestions;
    const travelSuggestion = travelSuggestions.find(
      (s: any) => s.content.toLowerCase().includes('travel') || 
                  s.content.toLowerCase().includes('quick') ||
                  s.content.toLowerCase().includes('mobile order') ||
                  s.category === 'travel_services'
    );
    expect(travelSuggestion).toBeDefined();
  });

  test('Should handle cross-store context sharing and chain-level insights', async () => {
    // Start conversation about chain-wide policies
    const createChainResponse = await request(app)
      .post('/ai-assistant/conversations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        store_id: store1Id,
        conversation_type: 'context_enhancement'
      });

    const chainConvId = createChainResponse.body.id;
    conversationIds.push(chainConvId);

    // Mention chain-wide policies
    const chainPolicyResponse = await request(app)
      .post(`/ai-assistant/conversations/${chainConvId}/messages`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        content: "We have some chain-wide policies: all locations use the same loyalty program, we source ingredients locally when possible, and we have standardized allergy protocols.",
        message_type: 'user'
      });

    expect(chainPolicyResponse.status).toBe(201);
    expect(chainPolicyResponse.body.ai_response.metadata.chain_level_info).toBe(true);

    // AI should ask about applying to other locations
    expect(chainPolicyResponse.body.ai_response.content).toMatch(/other locations|all stores|chain.*wide/i);

    // Confirm applying to all locations
    const applyAllResponse = await request(app)
      .post(`/ai-assistant/conversations/${chainConvId}/messages`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        content: "Yes, please apply the loyalty program and allergy protocols to all our locations.",
        message_type: 'user'
      });

    expect(applyAllResponse.status).toBe(201);

    // Check that chain-wide context was added to all stores
    const checkStores = [store1Id, store2Id, store3Id];
    for (const storeId of checkStores) {
      const storeContext = await request(app)
        .get('/ai-assistant/context/entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ store_id: storeId });

      const loyaltyEntry = storeContext.body.entries.find(
        (entry: any) => entry.content.toLowerCase().includes('loyalty program')
      );
      expect(loyaltyEntry).toBeDefined();

      const allergyEntry = storeContext.body.entries.find(
        (entry: any) => entry.content.toLowerCase().includes('allergy protocols')
      );
      expect(allergyEntry).toBeDefined();
    }
  });

  test('Should maintain store isolation while allowing business-level insights', async () => {
    // Create specific context for store 2
    const createStore2Response = await request(app)
      .post('/ai-assistant/conversations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        store_id: store2Id,
        conversation_type: 'context_builder'
      });

    const store2ConvId = createStore2Response.body.id;
    conversationIds.push(store2ConvId);

    // Add location-specific information
    const specificInfoResponse = await request(app)
      .post(`/ai-assistant/conversations/${store2ConvId}/messages`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        content: "This location has a special partnership with the local elementary school for field trips and fundraising events.",
        message_type: 'user'
      });

    expect(specificInfoResponse.status).toBe(201);

    // Verify store 2 has the specific context
    const store2Context = await request(app)
      .get('/ai-assistant/context/entries')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ store_id: store2Id });

    const schoolPartnershipEntry = store2Context.body.entries.find(
      (entry: any) => entry.content.toLowerCase().includes('elementary school')
    );
    expect(schoolPartnershipEntry).toBeDefined();

    // Verify other stores don't have this specific context
    const store1Context = await request(app)
      .get('/ai-assistant/context/entries')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ store_id: store1Id });

    const store1SchoolEntry = store1Context.body.entries.find(
      (entry: any) => entry.content.toLowerCase().includes('elementary school')
    );
    expect(store1SchoolEntry).toBeUndefined();

    // But AI should be aware of business-level patterns when asked
    const createInsightResponse = await request(app)
      .post('/ai-assistant/conversations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        store_id: store1Id,
        conversation_type: 'context_enhancement'
      });

    const insightConvId = createInsightResponse.body.id;
    conversationIds.push(insightConvId);

    const businessInsightResponse = await request(app)
      .post(`/ai-assistant/conversations/${insightConvId}/messages`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        content: "What patterns do you see across our different locations that might help improve customer experience?",
        message_type: 'user'
      });

    expect(businessInsightResponse.status).toBe(201);
    expect(businessInsightResponse.body.ai_response.content).toMatch(/locations|family.*friendly|airport|downtown/i);
    expect(businessInsightResponse.body.ai_response.metadata.cross_store_analysis).toBe(true);
  });

  test('Should handle validation scoring differences across store types', async () => {
    // Get validation scores for different store types
    const store1Validation = await request(app)
      .get('/ai-assistant/validation/score')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ store_id: store1Id });

    const store2Validation = await request(app)
      .get('/ai-assistant/validation/score')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ store_id: store2Id });

    const store3Validation = await request(app)
      .get('/ai-assistant/validation/score')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ store_id: store3Id });

    expect(store1Validation.status).toBe(200);
    expect(store2Validation.status).toBe(200);
    expect(store3Validation.status).toBe(200);

    // Store 1 should have higher score due to existing context
    expect(store1Validation.body.score).toBeGreaterThan(store2Validation.body.score);
    expect(store1Validation.body.score).toBeGreaterThan(store3Validation.body.score);

    // Each store should have different missing categories based on their type
    const store1Missing = store1Validation.body.missing_categories;
    const store2Missing = store2Validation.body.missing_categories;
    const store3Missing = store3Validation.body.missing_categories;

    // Stores 2 and 3 should be missing basic categories that store 1 has
    expect(store2Missing).toContain('business_type');
    expect(store3Missing).toContain('business_type');
    expect(store1Missing).not.toContain('business_type');
  });

  test('Should support concurrent context building across multiple stores', async () => {
    // Start conversations for stores 2 and 3 simultaneously
    const [createConv2Response, createConv3Response] = await Promise.all([
      request(app)
        .post('/ai-assistant/conversations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          store_id: store2Id,
          conversation_type: 'context_builder'
        }),
      request(app)
        .post('/ai-assistant/conversations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          store_id: store3Id,
          conversation_type: 'context_builder'
        })
    ]);

    const conv2Id = createConv2Response.body.id;
    const conv3Id = createConv3Response.body.id;
    conversationIds.push(conv2Id, conv3Id);

    // Send messages to both conversations simultaneously
    const [store2Message, store3Message] = await Promise.all([
      request(app)
        .post(`/ai-assistant/conversations/${conv2Id}/messages`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          content: "We're a family restaurant with a playground and kids eat free on Sundays.",
          message_type: 'user'
        }),
      request(app)
        .post(`/ai-assistant/conversations/${conv3Id}/messages`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          content: "We're a quick-service location for travelers with mobile ordering and 24/7 hours.",
          message_type: 'user'
        })
    ]);

    expect(store2Message.status).toBe(201);
    expect(store3Message.status).toBe(201);

    // Verify both conversations created appropriate context entries
    const [store2Context, store3Context] = await Promise.all([
      request(app)
        .get('/ai-assistant/context/entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ store_id: store2Id }),
      request(app)
        .get('/ai-assistant/context/entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ store_id: store3Id })
    ]);

    // Verify store 2 context
    const store2FamilyEntry = store2Context.body.entries.find(
      (entry: any) => entry.content.toLowerCase().includes('family') || 
                     entry.content.toLowerCase().includes('playground')
    );
    expect(store2FamilyEntry).toBeDefined();

    // Verify store 3 context
    const store3TravelEntry = store3Context.body.entries.find(
      (entry: any) => entry.content.toLowerCase().includes('travelers') || 
                     entry.content.toLowerCase().includes('mobile ordering')
    );
    expect(store3TravelEntry).toBeDefined();

    // Verify no cross-contamination of context
    const store2TravelEntry = store2Context.body.entries.find(
      (entry: any) => entry.content.toLowerCase().includes('travelers')
    );
    expect(store2TravelEntry).toBeUndefined();

    const store3FamilyEntry = store3Context.body.entries.find(
      (entry: any) => entry.content.toLowerCase().includes('playground')
    );
    expect(store3FamilyEntry).toBeUndefined();
  });
});