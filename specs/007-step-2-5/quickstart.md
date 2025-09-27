# Quickstart: AI Assistant Interface (Context Builder)

**Date**: 2025-09-21 **Feature**: AI Assistant Interface for business context
building **Prerequisites**: Business authentication, store access, development
environment

## Development Setup

### 1. Environment Preparation

```bash
# Navigate to project root
cd /path/to/vocilia-alpha

# Install dependencies (if not already done)
pnpm install

# Start development servers
pnpm dev  # Starts all apps including business dashboard
```

### 2. Database Migration

```bash
# Apply AI assistant database schema
npx supabase db push

# Generate updated TypeScript types
npx supabase gen types --lang=typescript --local > packages/types/src/database.d.ts
```

### 3. Environment Variables

Add to your `.env.local` files:

**Business App (`apps/business/.env.local`)**:

```env
# OpenAI API for AI assistant
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini

# Feature flags
ENABLE_AI_ASSISTANT=true
AI_ASSISTANT_STREAMING=true
```

**Backend (`apps/backend/.env.local`)**:

```env
# OpenAI configuration
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini
OPENAI_MAX_TOKENS=2000

# Validation settings
CONTEXT_VALIDATION_CACHE_TTL=300
AI_SUGGESTION_BATCH_SIZE=10
```

## User Journey Validation

### Test Scenario 1: New Business Manager First Use

**Objective**: Validate complete onboarding flow through AI assistant

**Steps**:

1. **Access AI Assistant**

   ```
   Navigate to: /context/ai-assistant
   Expected: Chat interface loads with welcome message
   Expected: "Get started" suggestions appear
   ```

2. **Start Conversation**

   ```
   User Input: "I need help setting up context for my grocery store"
   Expected: AI responds with store type questions
   Expected: Auto-save indicator shows activity
   ```

3. **Provide Store Information**

   ```
   User Input: "We're a medium-sized grocery store, about 5000 sq ft"
   Expected: AI extracts store_type=grocery, size=5000
   Expected: Context entries appear in sidebar
   Expected: Completeness score updates (initial ~15%)
   ```

4. **Follow AI Guidance**

   ```
   User continues conversation following AI prompts
   Expected: Context score gradually increases
   Expected: Suggestions appear for missing information
   Expected: Fraud detection questions arise naturally
   ```

5. **Review Completeness**
   ```
   Check: Final completeness score >70%
   Check: All critical context categories covered
   Check: Fraud detection baseline facts configured
   ```

**Success Criteria**:

- ✅ Conversation saves automatically every 2 seconds
- ✅ Context score reaches >70% within 10 minutes
- ✅ AI provides relevant suggestions throughout
- ✅ No browser console errors
- ✅ All extracted information is accurate

### Test Scenario 2: Returning User Context Enhancement

**Objective**: Validate conversation resume and context improvement

**Steps**:

1. **Resume Existing Conversation**

   ```
   Navigate to: /context/ai-assistant
   Expected: Previous conversation loads
   Expected: Chat history displays correctly
   Expected: Current context score visible
   ```

2. **Review AI Suggestions**

   ```
   Check suggestions panel
   Expected: Context gap suggestions visible
   Expected: Question optimization recommendations
   Expected: Fraud improvement suggestions
   ```

3. **Accept Suggestion**

   ```
   Click "Accept" on high-priority suggestion
   Expected: Suggestion implements immediately
   Expected: Context score increases
   Expected: New conversation messages reflect change
   ```

4. **Manual Context Update**
   ```
   User Input: "We've added a new bakery section last month"
   Expected: AI extracts layout change with date
   Expected: Follow-up questions about bakery operations
   Expected: Seasonal variation suggestions appear
   ```

**Success Criteria**:

- ✅ Conversation history loads <1 second
- ✅ Suggestions apply correctly when accepted
- ✅ Manual updates trigger relevant follow-up questions
- ✅ Context versioning tracks all changes

### Test Scenario 3: Multi-Store Business Context

**Objective**: Validate store-specific context management

**Steps**:

1. **Select Specific Store**

   ```
   Use store selector to choose Store A
   Expected: Context loads for Store A only
   Expected: Conversation history filtered to Store A
   ```

2. **Store-Specific Questions**

   ```
   User Input: "This location has limited parking"
   Expected: AI asks follow-up about parking impact
   Expected: Context entry tagged to Store A only
   Expected: Suggestions consider store-specific constraints
   ```

3. **Switch to Different Store**
   ```
   Change store selector to Store B
   Expected: Different context and conversation loads
   Expected: Store A information not visible
   Expected: Separate completeness scores displayed
   ```

**Success Criteria**:

- ✅ Store context isolation works correctly
- ✅ No data leakage between stores
- ✅ Performance acceptable when switching stores
- ✅ Store-specific suggestions are relevant

## API Contract Validation

### Conversation Management Tests

```bash
# Test conversation creation
curl -X POST http://localhost:3001/api/ai-assistant/conversations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"store_id": "uuid", "title": "Test Conversation"}'

# Expected: 201 Created with conversation object
# Expected: conversation.id is valid UUID
# Expected: conversation.status is "active"
```

### Message Exchange Tests

```bash
# Test message sending
curl -X POST http://localhost:3001/api/ai-assistant/conversations/$CONV_ID/messages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content": "Tell me about setting up context for a restaurant"}'

# Expected: 200 OK with user_message and ai_response
# Expected: ai_response.content contains relevant restaurant questions
# Expected: context_updates array may contain extracted info
```

### Context Entry Tests

```bash
# Test context retrieval
curl -X GET "http://localhost:3001/api/ai-assistant/context/entries?category=store_profile" \
  -H "Authorization: Bearer $TOKEN"

# Expected: 200 OK with entries array
# Expected: All entries have required fields
# Expected: Confidence scores between 0-1
```

### Validation Tests

```bash
# Test context scoring
curl -X GET "http://localhost:3001/api/ai-assistant/validation/score?recalculate=true" \
  -H "Authorization: Bearer $TOKEN"

# Expected: 200 OK with ValidationResult
# Expected: overall_score between 0-100
# Expected: category_scores object with all categories
# Expected: improvement_suggestions array not empty
```

## Performance Validation

### Response Time Requirements

- **AI Response**: <3 seconds for typical queries
- **Context Validation**: <2 seconds for scoring
- **Conversation Load**: <1 second for recent conversations
- **Auto-save**: <500ms for context updates

### Load Testing

```bash
# Simulate concurrent conversations
# Run 10 concurrent users for 5 minutes
# Monitor response times and error rates
# Validate database connection pool handling
```

### Memory and Resource Usage

- Monitor browser memory usage during long conversations
- Check for memory leaks in React components
- Validate WebSocket connection stability
- Monitor OpenAI API rate limiting

## Security Validation

### Authentication Tests

- Verify JWT token validation on all endpoints
- Test token expiration handling
- Validate refresh token flow
- Check unauthorized access rejection

### Row Level Security Tests

```sql
-- Test business isolation
-- User A should not see User B's conversations
-- Store access should respect business_stores permissions
-- Context entries should be properly isolated
```

### Data Privacy Tests

- Verify no sensitive data in browser console
- Check that API responses don't include other businesses' data
- Validate that conversation content is properly anonymized
- Test data retention and deletion policies

## Troubleshooting Guide

### Common Issues

**AI Assistant Not Responding**

```bash
# Check OpenAI API configuration
curl -X GET "https://api.openai.com/v1/models" \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# Verify environment variables are set
echo $OPENAI_API_KEY
echo $OPENAI_MODEL
```

**Conversation Not Saving**

```sql
-- Check database connectivity
SELECT COUNT(*) FROM ai_conversations WHERE business_id = 'your-business-id';

-- Verify RLS policies
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM ai_conversations WHERE business_id = 'your-business-id';
```

**Poor Completeness Scores**

- Check validation rules in database
- Verify category scoring weights
- Review context entry data quality
- Examine AI extraction accuracy

**Slow Response Times**

- Monitor OpenAI API latency
- Check database query performance
- Review React component re-renders
- Validate caching effectiveness

### Debug Mode

Enable detailed logging:

```env
# Add to environment
DEBUG_AI_ASSISTANT=true
LOG_LEVEL=debug
TRACE_API_CALLS=true
```

### Health Checks

```bash
# Verify all systems operational
curl http://localhost:3001/health
curl http://localhost:3000/api/health

# Check database connectivity
npx supabase status

# Test OpenAI integration
node -e "console.log('OpenAI test:', process.env.OPENAI_API_KEY ? 'OK' : 'MISSING')"
```

## Success Metrics

### Feature Completion Checklist

- [ ] All user scenarios complete successfully
- [ ] API contracts pass validation
- [ ] Performance requirements met
- [ ] Security tests pass
- [ ] Integration tests green
- [ ] TypeScript compilation clean
- [ ] RLS policies enforced
- [ ] Real-time features working
- [ ] Error handling robust
- [ ] Documentation complete

### Quality Gates

- **Test Coverage**: >85% for new code
- **Performance**: All response times <3s
- **Security**: Zero SQL injection vulnerabilities
- **Accessibility**: WCAG 2.1 AA compliance
- **Browser Support**: Chrome, Firefox, Safari latest
- **Mobile**: Responsive design functions correctly

### Production Readiness

- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] Monitoring and alerts set up
- [ ] Error tracking configured
- [ ] Performance metrics baseline established
- [ ] Backup and recovery tested
- [ ] Rate limiting configured
- [ ] CORS policies set correctly
