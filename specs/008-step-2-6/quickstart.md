# Quickstart Guide: Feedback Analysis Dashboard

**Feature**: 008-step-2-6 **Audience**: Developers implementing the feedback
analysis dashboard **Prerequisites**: Vocilia monorepo setup, Supabase access,
GPT-4o-mini API key

## Overview

This guide provides step-by-step validation scenarios to verify the feedback
analysis dashboard implementation meets all functional requirements.

## Setup Requirements

### Development Environment

```bash
# Ensure you're in the correct branch
git checkout 008-step-2-6

# Install dependencies (if new ones added)
pnpm install

# Start development servers
pnpm dev
```

### Database Setup

```bash
# Apply feedback analysis migrations
npx supabase db push

# Generate updated TypeScript types
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > packages/types/src/database.ts
```

### Environment Variables

Ensure these are configured in your `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
OPENAI_API_KEY=your_openai_api_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Validation Scenarios

### Scenario 1: Basic Dashboard Access (FR-001, FR-010)

**Objective**: Verify business managers can access feedback analysis with
auto-categorization

**Steps**:

1. Login as business manager: `test-manager@vocilia.com`
2. Navigate to `/dashboard/feedback-analysis`
3. Select a store from the store selector
4. Verify current week's feedback displays automatically

**Expected Results**:

- ✅ Page loads within 2 seconds
- ✅ Current week's feedback is categorized into Positive, Negative, General
  Opinions
- ✅ Summary counts are displayed for each category
- ✅ Maximum analysis information shown by default (no need for additional
  queries)
- ✅ RLS policies prevent access to other businesses' data

**Success Criteria**:

```typescript
// Verify data structure
interface DashboardData {
  currentWeek: {
    positive: FeedbackRecord[]
    negative: FeedbackRecord[]
    general: FeedbackRecord[]
    totalCount: number
  }
  summary: {
    positiveSummary: string
    negativeSummary: string
    generalOpinions: string
  }
}
```

### Scenario 2: New Critiques Identification (FR-002)

**Objective**: Verify new critiques are highlighted compared to previous week

**Test Data Setup**:

```sql
-- Insert test feedback for previous week
INSERT INTO feedback (store_id, content, sentiment, week_number, year) VALUES
('test-store-id', 'Checkout was slow last week', 'negative', 37, 2025);

-- Insert test feedback for current week
INSERT INTO feedback (store_id, content, sentiment, week_number, year) VALUES
('test-store-id', 'New issue: parking lot lighting is poor', 'negative', 38, 2025);
```

**Steps**:

1. Access feedback analysis dashboard
2. Navigate to "Week Comparison" section
3. Verify new critiques section highlights "parking lot lighting" issue

**Expected Results**:

- ✅ New critiques section displays issues not present in previous week
- ✅ AI properly identifies unique issues vs recurring themes
- ✅ New critique "parking lot lighting is poor" is highlighted
- ✅ Previous week's "checkout was slow" is not marked as new

### Scenario 3: Department-Specific Search (FR-003)

**Objective**: Verify smart search functionality for department queries

**Test Data Setup**:

```sql
INSERT INTO feedback (store_id, content, department_tags, sentiment) VALUES
('test-store-id', 'Meat section had fresh products', ARRAY['meat', 'products'], 'positive'),
('test-store-id', 'Checkout line was too long', ARRAY['checkout', 'service'], 'negative'),
('test-store-id', 'Bakery smells amazing', ARRAY['bakery', 'ambiance'], 'positive');
```

**Steps**:

1. Use search box to query "meat section"
2. Verify only meat-related feedback is returned
3. Test query "checkout" and verify checkout-specific results
4. Test combination query "meat and checkout"

**Expected Results**:

- ✅ Search for "meat section" returns only meat-related feedback
- ✅ Search for "checkout" returns only checkout-related feedback
- ✅ Search results include relevant insights and summaries
- ✅ Search execution time under 200ms
- ✅ Proper handling when no results found

### Scenario 4: Natural Language Queries (FR-004)

**Objective**: Verify chatbot interface for feedback exploration

**Steps**:

1. Access chatbot interface in feedback analysis
2. Ask: "What do customers think about our new bakery?"
3. Ask: "Are there any complaints about staff behavior?"
4. Ask: "How has customer satisfaction changed this week?"

**Expected Results**:

- ✅ Natural language queries are processed by GPT-4o-mini
- ✅ Relevant feedback summaries and analysis returned
- ✅ Response time under 3 seconds
- ✅ Answers include specific feedback excerpts and insights
- ✅ AI properly handles queries with no relevant data

### Scenario 5: Weekly Report Generation (FR-005)

**Objective**: Verify automated weekly analysis reports

**Backend Test**:

```bash
# Trigger manual report generation
curl -X POST http://localhost:3001/feedback-analysis/reports/test-store-id/generate \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"week_number": 38, "year": 2025}'
```

**Steps**:

1. Ensure feedback exists for completed week
2. Trigger weekly report generation (manual or scheduled)
3. Verify report contains all required sections
4. Check AI-generated summaries for quality

**Expected Results**:

- ✅ Report generation job starts successfully (202 response)
- ✅ Report includes positive summary, negative summary, general opinions
- ✅ New critiques identified and listed
- ✅ Actionable insights generated with priority levels
- ✅ Sentiment breakdown calculated correctly

### Scenario 6: Temporal Comparison (FR-006, FR-009)

**Objective**: Verify week-over-week feedback tracking and issue resolution

**Test Data Setup**:

```sql
-- Previous week data
INSERT INTO analysis_reports (store_id, week_number, year, negative_summary) VALUES
('test-store-id', 37, 2025, 'Main complaints: slow checkout, cold temperature');

-- Current week data
INSERT INTO analysis_reports (store_id, week_number, year, negative_summary) VALUES
('test-store-id', 38, 2025, 'Main complaints: parking issues, cold temperature');
```

**Steps**:

1. Navigate to temporal comparison view
2. Select "Compare with Previous Week"
3. Verify resolved issues (slow checkout) are identified
4. Verify continuing issues (cold temperature) are tracked
5. Verify new issues (parking) are highlighted

**Expected Results**:

- ✅ Resolved issues: "slow checkout" marked as resolved
- ✅ Continuing issues: "cold temperature" still present
- ✅ New issues: "parking issues" identified as new
- ✅ Trend direction calculated (improving/declining/stable)
- ✅ Percentage changes in sentiment displayed

### Scenario 7: Multi-Store Filtering (FR-008)

**Objective**: Verify store-specific filtering for multi-store businesses

**Test Data Setup**:

```sql
-- Feedback for Store A
INSERT INTO feedback (store_id, business_id, content) VALUES
('store-a-id', 'test-business-id', 'Store A feedback content');

-- Feedback for Store B
INSERT INTO feedback (store_id, business_id, content) VALUES
('store-b-id', 'test-business-id', 'Store B feedback content');
```

**Steps**:

1. Login as multi-store business manager
2. Select Store A from store selector
3. Verify only Store A feedback is displayed
4. Switch to Store B and verify filtering
5. Ensure RLS policies prevent cross-store data leakage

**Expected Results**:

- ✅ Store selector shows all accessible stores
- ✅ Feedback filtering works correctly per store
- ✅ Analysis reports are store-specific
- ✅ Search results limited to selected store
- ✅ URL reflects current store selection

### Scenario 8: Performance Validation

**Objective**: Verify system meets performance requirements

**Load Test Setup**:

```javascript
// Performance test data
const FEEDBACK_COUNT = 1000
const CONCURRENT_USERS = 10
```

**Steps**:

1. Generate test dataset with 1000+ feedback records
2. Simulate 10 concurrent users accessing dashboard
3. Measure response times for all major operations
4. Test AI analysis performance with large datasets

**Expected Results**:

- ✅ Dashboard loads in under 2 seconds
- ✅ AI response time under 3 seconds
- ✅ Database queries under 200ms
- ✅ Search results return in under 500ms
- ✅ Real-time updates work without lag

## Integration Tests

### Test File Structure

```
apps/backend/tests/
├── contract/
│   ├── feedback-analysis-reports.test.ts
│   ├── feedback-search.test.ts
│   └── temporal-comparison.test.ts
├── integration/
│   ├── dashboard-workflow.test.ts
│   ├── ai-analysis-pipeline.test.ts
│   └── multi-store-access.test.ts
└── unit/
    ├── sentiment-analysis.test.ts
    └── search-query-parser.test.ts
```

### Running Tests

```bash
# Run all feedback analysis tests
pnpm test:feedback-analysis

# Run contract tests (must fail initially)
pnpm test:contract

# Run integration tests
pnpm test:integration

# Run with coverage
pnpm test:coverage
```

## Troubleshooting

### Common Issues

**Issue**: Dashboard shows "No feedback available" **Solution**:

1. Verify store_id is correctly associated with business
2. Check RLS policies allow access to feedback table
3. Ensure feedback exists for current week

**Issue**: AI analysis takes longer than 3 seconds **Solution**:

1. Check OpenAI API key is valid and has quota
2. Verify background processing is working correctly
3. Consider implementing caching for repeated queries

**Issue**: Search returns no results for valid queries **Solution**:

1. Check department_tags are populated correctly
2. Verify PostgreSQL full-text search is configured
3. Test query parsing logic with debug logging

**Issue**: Temporal comparison shows incorrect data **Solution**:

1. Verify week_number calculation is correct
2. Check that previous week's analysis report exists
3. Ensure trend calculation algorithm handles edge cases

## Success Criteria Checklist

### Functional Requirements Coverage

- [ ] FR-001: Current week feedback categorization ✓
- [ ] FR-002: New critiques identification ✓
- [ ] FR-003: Department-specific search ✓
- [ ] FR-004: Natural language queries ✓
- [ ] FR-005: Automated weekly reports ✓
- [ ] FR-006: Temporal comparison tools ✓
- [ ] FR-007: Actionable insights generation ✓
- [ ] FR-008: Multi-store filtering ✓
- [ ] FR-009: Issue resolution tracking ✓
- [ ] FR-010: Maximum information by default ✓
- [ ] FR-011: Emerging trends identification ✓
- [ ] FR-012: General opinions aggregation ✓

### Performance Requirements

- [ ] AI response time < 3 seconds ✓
- [ ] Database queries < 200ms ✓
- [ ] Dashboard load time < 2 seconds ✓
- [ ] Real-time updates working ✓

### Constitutional Compliance

- [ ] TypeScript strict mode ✓
- [ ] Row Level Security policies ✓
- [ ] Production-ready implementation ✓
- [ ] Monorepo architecture maintained ✓
- [ ] Real data integration ✓

## Deployment Checklist

### Pre-deployment

- [ ] All tests passing
- [ ] Database migrations applied
- [ ] Environment variables configured
- [ ] Performance benchmarks met
- [ ] Security audit completed

### Post-deployment

- [ ] Health checks passing
- [ ] Real-time monitoring active
- [ ] Error tracking configured
- [ ] Performance metrics collected
- [ ] User acceptance testing completed

---

**Next Steps**: Once all validation scenarios pass, the feature is ready for
production deployment and user acceptance testing.
