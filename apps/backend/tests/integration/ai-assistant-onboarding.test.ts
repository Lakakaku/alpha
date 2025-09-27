import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import { app } from '../../src/app';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@vocilia/types/database';

const supabase = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

describe('AI Assistant Onboarding Integration Test', () => {
  let businessId: string;
  let storeId: string;
  let accessToken: string;
  let conversationId: string;

  beforeEach(async () => {
    // Create test business and store
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .insert({
        business_name: 'Test Onboarding Business',
        email: 'onboarding-test@vocilia.com',
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
        store_name: 'Test Store',
        address: '123 Test Street',
        city: 'Test City',
        postal_code: '12345',
        country: 'Test Country'
      })
      .select()
      .single();

    if (storeError) throw storeError;
    storeId = store.id;

    // Create mock access token for testing
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
      .from('stores')
      .delete()
      .eq('business_id', businessId);
    
    await supabase
      .from('businesses')
      .delete()
      .eq('id', businessId);
  });

  test('Complete new business manager onboarding flow', async () => {
    // Step 1: Start new conversation
    const createResponse = await request(app)
      .post('/ai-assistant/conversations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        store_id: storeId,
        conversation_type: 'context_builder'
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body).toHaveProperty('id');
    expect(createResponse.body.status).toBe('active');
    conversationId = createResponse.body.id;

    // Step 2: Send initial message from business manager
    const messageResponse = await request(app)
      .post(`/ai-assistant/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        content: "Hi! I'm new to Vocilia and need help setting up my store context for customer feedback calls.",
        message_type: 'user'
      });

    expect(messageResponse.status).toBe(201);
    expect(messageResponse.body).toHaveProperty('ai_response');
    expect(messageResponse.body.ai_response.content).toContain('welcome');

    // Step 3: AI should ask about business type
    const businessTypeResponse = await request(app)
      .post(`/ai-assistant/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        content: "We're a coffee shop specializing in artisan coffee and pastries.",
        message_type: 'user'
      });

    expect(businessTypeResponse.status).toBe(201);
    expect(businessTypeResponse.body.ai_response.content).toMatch(/hours|location|customers/i);

    // Step 4: Provide operating hours information
    const hoursResponse = await request(app)
      .post(`/ai-assistant/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        content: "We're open Monday to Friday 7 AM to 6 PM, weekends 8 AM to 8 PM.",
        message_type: 'user'
      });

    expect(hoursResponse.status).toBe(201);

    // Step 5: Check context entries were created
    const contextResponse = await request(app)
      .get('/ai-assistant/context/entries')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ store_id: storeId });

    expect(contextResponse.status).toBe(200);
    expect(contextResponse.body.entries.length).toBeGreaterThan(0);
    
    const businessTypeEntry = contextResponse.body.entries.find(
      (entry: any) => entry.category === 'business_type'
    );
    expect(businessTypeEntry).toBeDefined();
    expect(businessTypeEntry.content).toContain('coffee shop');

    // Step 6: Check validation score improved
    const validationResponse = await request(app)
      .get('/ai-assistant/validation/score')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ store_id: storeId });

    expect(validationResponse.status).toBe(200);
    expect(validationResponse.body.score).toBeGreaterThan(20);
    expect(validationResponse.body.missing_categories.length).toBeLessThan(8);

    // Step 7: Check suggestions are generated
    const suggestionsResponse = await request(app)
      .get('/ai-assistant/suggestions')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ store_id: storeId });

    expect(suggestionsResponse.status).toBe(200);
    expect(suggestionsResponse.body.suggestions.length).toBeGreaterThan(0);
    
    const suggestions = suggestionsResponse.body.suggestions;
    expect(suggestions.some((s: any) => s.category === 'target_audience')).toBeTruthy();

    // Step 8: Accept a suggestion
    const firstSuggestion = suggestions[0];
    const acceptResponse = await request(app)
      .post(`/ai-assistant/suggestions/${firstSuggestion.id}/accept`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(acceptResponse.status).toBe(200);
    expect(acceptResponse.body.success).toBe(true);

    // Step 9: Verify context entry was created from suggestion
    const updatedContextResponse = await request(app)
      .get('/ai-assistant/context/entries')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ store_id: storeId });

    expect(updatedContextResponse.status).toBe(200);
    expect(updatedContextResponse.body.entries.length).toBeGreaterThan(contextResponse.body.entries.length);

    // Step 10: Verify conversation state is properly maintained
    const conversationResponse = await request(app)
      .get(`/ai-assistant/conversations/${conversationId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(conversationResponse.status).toBe(200);
    expect(conversationResponse.body.status).toBe('active');
    expect(conversationResponse.body.messages.length).toBeGreaterThanOrEqual(6);
    expect(conversationResponse.body.context_entries_count).toBeGreaterThan(0);
  });

  test('Should handle incomplete information gracefully', async () => {
    // Start conversation
    const createResponse = await request(app)
      .post('/ai-assistant/conversations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        store_id: storeId,
        conversation_type: 'context_builder'
      });

    conversationId = createResponse.body.id;

    // Send vague initial message
    const vagueResponse = await request(app)
      .post(`/ai-assistant/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        content: "I need help.",
        message_type: 'user'
      });

    expect(vagueResponse.status).toBe(201);
    expect(vagueResponse.body.ai_response.content).toMatch(/tell me more|what kind|business/i);

    // AI should ask clarifying questions
    expect(vagueResponse.body.ai_response.metadata.requires_clarification).toBe(true);
  });

  test('Should maintain conversation continuity across sessions', async () => {
    // Start first session
    const createResponse = await request(app)
      .post('/ai-assistant/conversations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        store_id: storeId,
        conversation_type: 'context_builder'
      });

    conversationId = createResponse.body.id;

    // Send message in first session
    await request(app)
      .post(`/ai-assistant/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        content: "We're a restaurant serving Italian cuisine.",
        message_type: 'user'
      });

    // "End" first session by updating conversation
    await request(app)
      .patch(`/ai-assistant/conversations/${conversationId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        status: 'paused'
      });

    // Start "new" session by resuming conversation
    const resumeResponse = await request(app)
      .patch(`/ai-assistant/conversations/${conversationId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        status: 'active'
      });

    expect(resumeResponse.status).toBe(200);

    // Continue conversation from where left off
    const continueResponse = await request(app)
      .post(`/ai-assistant/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        content: "What other information do you need about our restaurant?",
        message_type: 'user'
      });

    expect(continueResponse.status).toBe(201);
    expect(continueResponse.body.ai_response.content).toMatch(/hours|menu|atmosphere|target/i);
    
    // AI should remember previous context about being a restaurant
    expect(continueResponse.body.ai_response.metadata.context_aware).toBe(true);
  });
});