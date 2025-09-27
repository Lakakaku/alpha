import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import { app } from '../../src/app';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@vocilia/types/database';

const supabase = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

describe('AI Assistant Context Enhancement Integration Test', () => {
  let businessId: string;
  let storeId: string;
  let accessToken: string;
  let conversationId: string;
  let existingContextEntries: string[] = [];

  beforeEach(async () => {
    // Create test business and store
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .insert({
        business_name: 'Established Enhancement Business',
        email: 'enhancement-test@vocilia.com',
        verification_status: 'approved'
      })
      .select()
      .single();

    if (businessError) throw businessError;
    businessId = business.id;

    const { data: store, error: storeError } = await supabase
      .from('stores')
      .insert({
        business_id: businessId,
        store_name: 'Established Store',
        address: '456 Enhancement Ave',
        city: 'Enhancement City',
        postal_code: '67890',
        country: 'Enhancement Country'
      })
      .select()
      .single();

    if (storeError) throw storeError;
    storeId = store.id;

    // Pre-populate with existing context entries (simulating returning user)
    const existingEntries = [
      {
        store_id: storeId,
        category: 'business_type',
        content: 'Upscale steakhouse specializing in premium cuts and wine pairings',
        confidence_score: 0.9,
        source: 'manual',
        version: 1
      },
      {
        store_id: storeId,
        category: 'operating_hours',
        content: 'Tuesday-Saturday 5:00 PM - 11:00 PM, closed Sunday-Monday',
        confidence_score: 0.8,
        source: 'manual',
        version: 1
      },
      {
        store_id: storeId,
        category: 'target_audience',
        content: 'Business professionals, couples on date nights, food enthusiasts',
        confidence_score: 0.7,
        source: 'manual',
        version: 1
      },
      {
        store_id: storeId,
        category: 'price_range',
        content: 'High-end dining, $80-150 per person',
        confidence_score: 0.8,
        source: 'manual',
        version: 1
      }
    ];

    const { data: contextData, error: contextError } = await supabase
      .from('context_entries')
      .insert(existingEntries)
      .select();

    if (contextError) throw contextError;
    existingContextEntries = contextData.map(entry => entry.id);

    accessToken = 'mock-token-' + businessId;
  });

  afterEach(async () => {
    // Cleanup test data
    if (conversationId) {
      await supabase
        .from('ai_conversations')
        .delete()
        .eq('id', conversationId);
    }

    await supabase
      .from('context_entries')
      .delete()
      .eq('store_id', storeId);

    await supabase
      .from('stores')
      .delete()
      .eq('business_id', businessId);
    
    await supabase
      .from('businesses')
      .delete()
      .eq('id', businessId);
  });

  test('Should enhance existing context with new detailed information', async () => {
    // Get initial validation score
    const initialValidationResponse = await request(app)
      .get('/ai-assistant/validation/score')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ store_id: storeId });

    expect(initialValidationResponse.status).toBe(200);
    const initialScore = initialValidationResponse.body.score;
    expect(initialScore).toBeGreaterThan(40); // Should have decent score from existing context

    // Start enhancement conversation
    const createResponse = await request(app)
      .post('/ai-assistant/conversations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        store_id: storeId,
        conversation_type: 'context_enhancement'
      });

    expect(createResponse.status).toBe(201);
    conversationId = createResponse.body.id;

    // AI should recognize existing context and suggest enhancements
    const initialMessage = await request(app)
      .post(`/ai-assistant/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        content: "I want to improve our customer feedback system. Can you help enhance our store context?",
        message_type: 'user'
      });

    expect(initialMessage.status).toBe(201);
    expect(initialMessage.body.ai_response.content).toMatch(/steakhouse|existing context|enhance/i);
    expect(initialMessage.body.ai_response.metadata.context_analysis).toBeDefined();

    // Add new service information
    const serviceResponse = await request(app)
      .post(`/ai-assistant/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        content: "We also offer private dining rooms for groups up to 20 people, wine tastings on Wednesdays, and a chef's table experience.",
        message_type: 'user'
      });

    expect(serviceResponse.status).toBe(201);

    // Add seasonal menu information
    const seasonalResponse = await request(app)
      .post(`/ai-assistant/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        content: "Our menu changes seasonally. Right now we're featuring fall specials with truffle dishes and game meats.",
        message_type: 'user'
      });

    expect(seasonalResponse.status).toBe(201);

    // Check that new context entries were created
    const updatedContextResponse = await request(app)
      .get('/ai-assistant/context/entries')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ store_id: storeId });

    expect(updatedContextResponse.status).toBe(200);
    expect(updatedContextResponse.body.entries.length).toBeGreaterThan(4);

    const specialServicesEntry = updatedContextResponse.body.entries.find(
      (entry: any) => entry.category === 'special_services'
    );
    expect(specialServicesEntry).toBeDefined();
    expect(specialServicesEntry.content).toMatch(/private dining|wine tasting|chef's table/i);

    const menuInfoEntry = updatedContextResponse.body.entries.find(
      (entry: any) => entry.category === 'menu_information'
    );
    expect(menuInfoEntry).toBeDefined();
    expect(menuInfoEntry.content).toMatch(/seasonal|fall|truffle|game meats/i);

    // Check improved validation score
    const finalValidationResponse = await request(app)
      .get('/ai-assistant/validation/score')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ store_id: storeId });

    expect(finalValidationResponse.status).toBe(200);
    expect(finalValidationResponse.body.score).toBeGreaterThan(initialScore);
    expect(finalValidationResponse.body.completeness_details.special_services).toBeDefined();
  });

  test('Should identify and suggest corrections for outdated information', async () => {
    // Start conversation
    const createResponse = await request(app)
      .post('/ai-assistant/conversations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        store_id: storeId,
        conversation_type: 'context_enhancement'
      });

    conversationId = createResponse.body.id;

    // Report that operating hours have changed
    const hoursUpdateResponse = await request(app)
      .post(`/ai-assistant/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        content: "We've extended our hours. We're now open Monday through Saturday 4:30 PM to midnight, and we added Sunday brunch from 10 AM to 3 PM.",
        message_type: 'user'
      });

    expect(hoursUpdateResponse.status).toBe(201);
    expect(hoursUpdateResponse.body.ai_response.metadata.detected_changes).toBeDefined();

    // Check that AI identified the conflict and created an updated entry
    const contextResponse = await request(app)
      .get('/ai-assistant/context/entries')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ store_id: storeId });

    const operatingHoursEntries = contextResponse.body.entries.filter(
      (entry: any) => entry.category === 'operating_hours'
    );

    expect(operatingHoursEntries.length).toBeGreaterThanOrEqual(1);
    
    // Should have updated entry with new hours
    const latestHoursEntry = operatingHoursEntries.sort((a: any, b: any) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];
    
    expect(latestHoursEntry.content).toMatch(/Monday.*Saturday.*4:30.*midnight|Sunday.*brunch/i);
    expect(latestHoursEntry.version).toBeGreaterThan(1);
  });

  test('Should provide intelligent suggestions based on existing context', async () => {
    // Get suggestions based on existing steakhouse context
    const suggestionsResponse = await request(app)
      .get('/ai-assistant/suggestions')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ store_id: storeId });

    expect(suggestionsResponse.status).toBe(200);
    expect(suggestionsResponse.body.suggestions.length).toBeGreaterThan(0);

    const suggestions = suggestionsResponse.body.suggestions;
    
    // Should suggest steakhouse-specific enhancements
    const wineListSuggestion = suggestions.find(
      (s: any) => s.category === 'wine_program' || s.content.toLowerCase().includes('wine')
    );
    expect(wineListSuggestion).toBeDefined();

    const dressCodSuggestion = suggestions.find(
      (s: any) => s.category === 'dress_code' || s.content.toLowerCase().includes('dress code')
    );
    expect(dressCodSuggestion).toBeDefined();

    // Start conversation to accept suggestions
    const createResponse = await request(app)
      .post('/ai-assistant/conversations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        store_id: storeId,
        conversation_type: 'context_enhancement'
      });

    conversationId = createResponse.body.id;

    // Accept wine program suggestion
    if (wineListSuggestion) {
      const acceptResponse = await request(app)
        .post(`/ai-assistant/suggestions/${wineListSuggestion.id}/accept`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(acceptResponse.status).toBe(200);

      // Verify new context entry was created
      const updatedContextResponse = await request(app)
        .get('/ai-assistant/context/entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ store_id: storeId });

      const wineEntry = updatedContextResponse.body.entries.find(
        (entry: any) => entry.category === 'wine_program'
      );
      expect(wineEntry).toBeDefined();
    }
  });

  test('Should handle context conflicts intelligently', async () => {
    // Start conversation
    const createResponse = await request(app)
      .post('/ai-assistant/conversations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        store_id: storeId,
        conversation_type: 'context_enhancement'
      });

    conversationId = createResponse.body.id;

    // Provide conflicting information about business type
    const conflictResponse = await request(app)
      .post(`/ai-assistant/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        content: "Actually, we're not just a steakhouse anymore. We've expanded to be a full American bistro with seafood, pasta, and vegetarian options.",
        message_type: 'user'
      });

    expect(conflictResponse.status).toBe(201);
    expect(conflictResponse.body.ai_response.metadata.conflict_detected).toBe(true);
    expect(conflictResponse.body.ai_response.content).toMatch(/clarify|changed|expanded/i);

    // AI should ask for clarification about the business type change
    const clarificationResponse = await request(app)
      .post(`/ai-assistant/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        content: "Yes, we rebranded last month. We still specialize in steaks but added many other options to attract more customers.",
        message_type: 'user'
      });

    expect(clarificationResponse.status).toBe(201);

    // Check that business type was updated appropriately
    const contextResponse = await request(app)
      .get('/ai-assistant/context/entries')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ store_id: storeId });

    const businessTypeEntries = contextResponse.body.entries.filter(
      (entry: any) => entry.category === 'business_type'
    );

    const latestBusinessType = businessTypeEntries.sort((a: any, b: any) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];

    expect(latestBusinessType.content).toMatch(/American bistro|seafood|pasta|vegetarian/i);
    expect(latestBusinessType.version).toBeGreaterThan(1);
  });

  test('Should maintain conversation context across enhancement sessions', async () => {
    // First enhancement session
    const createResponse1 = await request(app)
      .post('/ai-assistant/conversations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        store_id: storeId,
        conversation_type: 'context_enhancement'
      });

    const conversation1Id = createResponse1.body.id;

    await request(app)
      .post(`/ai-assistant/conversations/${conversation1Id}/messages`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        content: "We're planning to add a rooftop bar next month.",
        message_type: 'user'
      });

    // End first session
    await request(app)
      .patch(`/ai-assistant/conversations/${conversation1Id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ status: 'completed' });

    // Second enhancement session
    const createResponse2 = await request(app)
      .post('/ai-assistant/conversations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        store_id: storeId,
        conversation_type: 'context_enhancement'
      });

    conversationId = createResponse2.body.id;

    // AI should remember previous context including rooftop bar mention
    const followUpResponse = await request(app)
      .post(`/ai-assistant/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        content: "The rooftop bar is ready! We're now serving cocktails and light bites upstairs.",
        message_type: 'user'
      });

    expect(followUpResponse.status).toBe(201);
    expect(followUpResponse.body.ai_response.content).toMatch(/rooftop|cocktails|remember|mentioned/i);

    // Check that rooftop bar context was added
    const contextResponse = await request(app)
      .get('/ai-assistant/context/entries')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ store_id: storeId });

    const rooftopEntry = contextResponse.body.entries.find(
      (entry: any) => entry.content.toLowerCase().includes('rooftop')
    );
    expect(rooftopEntry).toBeDefined();
  });
});