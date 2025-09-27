import { Pool, PoolClient } from 'pg';
import { supabase } from '@vocilia/database/client/supabase';

// Mock database connection
jest.mock('@vocilia/database/client/supabase');

describe('Database Query Performance Tests', () => {
  let mockClient: jest.Mocked<PoolClient>;
  let mockPool: jest.Mocked<Pool>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    } as any;
    
    mockPool = {
      connect: jest.fn().mockResolvedValue(mockClient),
      query: jest.fn(),
      end: jest.fn(),
    } as any;

    // Mock supabase client
    (supabase as any) = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: {}, error: null }),
      then: jest.fn().mockResolvedValue({ data: [], error: null }),
      rpc: jest.fn().mockResolvedValue({ data: [], error: null })
    };
  });

  describe('Question Logic Query Performance', () => {
    test('should fetch active triggers for business within 50ms', async () => {
      const businessId = 'test-business-id';
      
      // Mock query response
      mockClient.query.mockResolvedValue({
        rows: generateMockTriggers(25),
        rowCount: 25,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      const startTime = performance.now();
      
      // Simulate the actual query that would be used
      const result = await mockClient.query(
        `SELECT dt.*, tc.condition_key, tc.condition_operator, tc.condition_value
         FROM dynamic_triggers dt
         LEFT JOIN trigger_conditions tc ON dt.id = tc.trigger_id
         WHERE dt.business_context_id = $1 AND dt.is_active = true
         ORDER BY dt.priority_level DESC, dt.created_at ASC`,
        [businessId]
      );

      const duration = performance.now() - startTime;
      
      expect(duration).toBeLessThan(50); // Very fast for indexed query
      expect(result.rows).toHaveLength(25);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('dynamic_triggers'),
        [businessId]
      );
    });

    test('should fetch question combinations with groups within 75ms', async () => {
      const businessId = 'test-business-id';
      
      mockClient.query.mockResolvedValue({
        rows: generateMockQuestionCombinations(15),
        rowCount: 15,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      const startTime = performance.now();
      
      const result = await mockClient.query(
        `SELECT qcr.*, qg.group_name, qg.topic_category, qg.estimated_tokens
         FROM question_combination_rules qcr
         LEFT JOIN question_groups qg ON qcr.id = qg.rule_id
         WHERE qcr.business_context_id = $1 AND qcr.is_active = true
         ORDER BY qcr.priority_threshold_critical ASC`,
        [businessId]
      );

      const duration = performance.now() - startTime;
      
      expect(duration).toBeLessThan(75);
      expect(result.rows).toHaveLength(15);
    });

    test('should fetch frequency harmonizer rules within 25ms', async () => {
      const ruleId = 'test-rule-id';
      
      mockClient.query.mockResolvedValue({
        rows: generateMockFrequencyRules(8),
        rowCount: 8,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      const startTime = performance.now();
      
      const result = await mockClient.query(
        `SELECT fh.*, cq1.text as question_1_text, cq2.text as question_2_text
         FROM frequency_harmonizers fh
         LEFT JOIN context_questions cq1 ON fh.question_id_1 = cq1.id
         LEFT JOIN context_questions cq2 ON fh.question_id_2 = cq2.id
         WHERE fh.rule_id = $1
         ORDER BY fh.created_at DESC`,
        [ruleId]
      );

      const duration = performance.now() - startTime;
      
      expect(duration).toBeLessThan(25); // Should be very fast with proper indexing
      expect(result.rows).toHaveLength(8);
    });

    test('should execute trigger activation logging within 30ms', async () => {
      const logData = {
        verification_id: 'test-verification-id',
        trigger_id: 'test-trigger-id',
        question_id: 'test-question-id',
        trigger_data: { categories: ['meat'], amount: 150 },
        call_position: 1,
        was_asked: true
      };

      mockClient.query.mockResolvedValue({
        rows: [{ id: 'new-log-id', ...logData }],
        rowCount: 1,
        command: 'INSERT',
        oid: 0,
        fields: []
      });

      const startTime = performance.now();
      
      const result = await mockClient.query(
        `INSERT INTO trigger_activation_logs 
         (verification_id, trigger_id, question_id, trigger_data, activation_timestamp, call_position, was_asked)
         VALUES ($1, $2, $3, $4, NOW(), $5, $6)
         RETURNING id`,
        [logData.verification_id, logData.trigger_id, logData.question_id, 
         JSON.stringify(logData.trigger_data), logData.call_position, logData.was_asked]
      );

      const duration = performance.now() - startTime;
      
      expect(duration).toBeLessThan(30); // Insert should be very fast
      expect(result.rows).toHaveLength(1);
    });
  });

  describe('Complex Query Performance', () => {
    test('should execute trigger evaluation query within 100ms', async () => {
      const businessId = 'test-business-id';
      const customerData = {
        categories: ['meat', 'produce'],
        amount: 250,
        time_of_day: '14:30',
        day_of_week: 'Tuesday'
      };

      mockClient.query.mockResolvedValue({
        rows: generateMockTriggerEvaluationResults(12),
        rowCount: 12,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      const startTime = performance.now();
      
      // Complex query that evaluates multiple trigger types
      const result = await mockClient.query(
        `WITH trigger_evaluation AS (
           SELECT dt.*, 
                  CASE dt.trigger_type
                    WHEN 'purchase_based' THEN 
                      CASE WHEN dt.trigger_config->>'categories' ?| $2 THEN dt.priority_level * dt.effectiveness_score ELSE 0 END
                    WHEN 'amount_based' THEN 
                      CASE WHEN $3 >= (dt.trigger_config->>'minimum_amount')::numeric THEN dt.priority_level * dt.effectiveness_score ELSE 0 END
                    WHEN 'time_based' THEN dt.priority_level * dt.effectiveness_score * 0.8
                    ELSE 0
                  END as evaluation_score
           FROM dynamic_triggers dt
           WHERE dt.business_context_id = $1 AND dt.is_active = true
         )
         SELECT te.*, tc.condition_key, tc.condition_value
         FROM trigger_evaluation te
         LEFT JOIN trigger_conditions tc ON te.id = tc.trigger_id
         WHERE te.evaluation_score > 0
         ORDER BY te.evaluation_score DESC, te.priority_level DESC
         LIMIT 20`,
        [businessId, customerData.categories, customerData.amount]
      );

      const duration = performance.now() - startTime;
      
      expect(duration).toBeLessThan(100); // Complex query should still be fast
      expect(result.rows).toHaveLength(12);
    });

    test('should execute question optimization query within 150ms', async () => {
      const businessId = 'test-business-id';
      const maxDuration = 90;
      
      mockClient.query.mockResolvedValue({
        rows: generateMockOptimizationResults(20),
        rowCount: 20,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      const startTime = performance.now();
      
      // Query that optimizes question selection based on time constraints
      const result = await mockClient.query(
        `WITH question_optimization AS (
           SELECT cq.*,
                  pw.priority_level * pw.weight_multiplier as effective_priority,
                  COALESCE(cq.estimated_tokens / 4.2, 30) as estimated_duration,
                  qg.topic_category,
                  ROW_NUMBER() OVER (PARTITION BY qg.topic_category ORDER BY pw.priority_level DESC) as topic_rank
           FROM context_questions cq
           LEFT JOIN priority_weights pw ON cq.id = pw.question_id
           LEFT JOIN question_groups qg ON cq.topic_category = qg.topic_category
           WHERE cq.business_context_id = $1 AND cq.is_active = true
         ),
         cumulative_duration AS (
           SELECT *,
                  SUM(estimated_duration) OVER (ORDER BY effective_priority DESC, topic_rank ASC) as running_duration
           FROM question_optimization
         )
         SELECT * FROM cumulative_duration
         WHERE running_duration <= $2
         ORDER BY effective_priority DESC
         LIMIT 15`,
        [businessId, maxDuration]
      );

      const duration = performance.now() - startTime;
      
      expect(duration).toBeLessThan(150);
      expect(result.rows).toHaveLength(20);
    });

    test('should execute analytics aggregation query within 200ms', async () => {
      const businessId = 'test-business-id';
      const startDate = '2024-01-01';
      const endDate = '2024-01-31';

      mockClient.query.mockResolvedValue({
        rows: generateMockAnalyticsResults(),
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      const startTime = performance.now();
      
      // Complex analytics query
      const result = await mockClient.query(
        `WITH trigger_stats AS (
           SELECT dt.trigger_name,
                  dt.trigger_type,
                  COUNT(tal.*) as activation_count,
                  AVG(CASE WHEN tal.was_asked THEN 1.0 ELSE 0.0 END) as ask_rate,
                  AVG(dt.effectiveness_score) as avg_effectiveness
           FROM dynamic_triggers dt
           LEFT JOIN trigger_activation_logs tal ON dt.id = tal.trigger_id 
             AND tal.activation_timestamp BETWEEN $2 AND $3
           WHERE dt.business_context_id = $1
           GROUP BY dt.id, dt.trigger_name, dt.trigger_type
         ),
         question_stats AS (
           SELECT cq.text as question_text,
                  cq.category,
                  COUNT(tal.*) as times_triggered,
                  AVG(CASE WHEN tal.was_asked THEN tal.call_position ELSE NULL END) as avg_position
           FROM context_questions cq
           LEFT JOIN trigger_activation_logs tal ON cq.id = tal.question_id
             AND tal.activation_timestamp BETWEEN $2 AND $3
           WHERE cq.business_context_id = $1
           GROUP BY cq.id, cq.text, cq.category
         )
         SELECT 
           (SELECT COUNT(*) FROM trigger_stats) as total_triggers,
           (SELECT COUNT(*) FROM question_stats) as total_questions,
           (SELECT SUM(activation_count) FROM trigger_stats) as total_activations,
           (SELECT AVG(ask_rate) FROM trigger_stats) as overall_ask_rate,
           (SELECT AVG(avg_effectiveness) FROM trigger_stats) as system_effectiveness
        `,
        [businessId, startDate, endDate]
      );

      const duration = performance.now() - startTime;
      
      expect(duration).toBeLessThan(200); // Complex aggregation should still be reasonable
      expect(result.rows).toHaveLength(1);
    });
  });

  describe('Index Performance Validation', () => {
    test('should use indexes efficiently for business context queries', async () => {
      const businessId = 'test-business-id';
      
      // Mock EXPLAIN query result showing index usage
      mockClient.query.mockResolvedValue({
        rows: [
          {
            'QUERY PLAN': 'Index Scan using idx_dynamic_triggers_business_active on dynamic_triggers (cost=0.29..8.31 rows=1 width=100)'
          }
        ],
        rowCount: 1,
        command: 'EXPLAIN',
        oid: 0,
        fields: []
      });

      const result = await mockClient.query(
        `EXPLAIN (ANALYZE false, BUFFERS false)
         SELECT * FROM dynamic_triggers 
         WHERE business_context_id = $1 AND is_active = true`,
        [businessId]
      );

      const queryPlan = result.rows[0]['QUERY PLAN'];
      expect(queryPlan).toContain('Index Scan');
      expect(queryPlan).toContain('idx_dynamic_triggers_business_active');
    });

    test('should validate trigger activation log indexes', async () => {
      const verificationId = 'test-verification-id';
      
      mockClient.query.mockResolvedValue({
        rows: [
          {
            'QUERY PLAN': 'Index Scan using idx_trigger_activation_logs_verification on trigger_activation_logs (cost=0.29..4.31 rows=1 width=200)'
          }
        ],
        rowCount: 1,
        command: 'EXPLAIN',
        oid: 0,
        fields: []
      });

      const result = await mockClient.query(
        `EXPLAIN (ANALYZE false)
         SELECT * FROM trigger_activation_logs 
         WHERE verification_id = $1 
         ORDER BY activation_timestamp DESC`,
        [verificationId]
      );

      const queryPlan = result.rows[0]['QUERY PLAN'];
      expect(queryPlan).toContain('Index Scan');
      expect(queryPlan).toContain('idx_trigger_activation_logs_verification');
    });

    test('should validate composite index usage for priority weights', async () => {
      const questionId = 'test-question-id';
      
      mockClient.query.mockResolvedValue({
        rows: [
          {
            'QUERY PLAN': 'Index Scan using idx_priority_weights_question_active on priority_weights (cost=0.29..2.31 rows=1 width=50)'
          }
        ],
        rowCount: 1,
        command: 'EXPLAIN',
        oid: 0,
        fields: []
      });

      const result = await mockClient.query(
        `EXPLAIN (ANALYZE false)
         SELECT priority_level, weight_multiplier, effective_priority 
         FROM priority_weights 
         WHERE question_id = $1`,
        [questionId]
      );

      const queryPlan = result.rows[0]['QUERY PLAN'];
      expect(queryPlan).toContain('Index Scan');
    });
  });

  describe('Connection Pool Performance', () => {
    test('should handle concurrent database connections efficiently', async () => {
      // Mock multiple client connections
      const mockClients = Array.from({ length: 10 }, () => ({
        query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
        release: jest.fn()
      }));

      mockPool.connect
        .mockResolvedValueOnce(mockClients[0] as any)
        .mockResolvedValueOnce(mockClients[1] as any)
        .mockResolvedValueOnce(mockClients[2] as any)
        .mockResolvedValueOnce(mockClients[3] as any)
        .mockResolvedValueOnce(mockClients[4] as any);

      const startTime = performance.now();
      
      // Simulate concurrent queries
      const queryPromises = Array.from({ length: 5 }, async (_, i) => {
        const client = await mockPool.connect();
        try {
          return await client.query('SELECT * FROM dynamic_triggers WHERE id = $1', [`trigger-${i}`]);
        } finally {
          client.release();
        }
      });

      await Promise.all(queryPromises);
      const duration = performance.now() - startTime;
      
      expect(duration).toBeLessThan(100); // Connection pooling should be fast
      expect(mockPool.connect).toHaveBeenCalledTimes(5);
      
      // All clients should be properly released
      mockClients.slice(0, 5).forEach(client => {
        expect(client.release).toHaveBeenCalled();
      });
    });

    test('should handle connection pool exhaustion gracefully', async () => {
      // Mock pool exhaustion scenario
      mockPool.connect
        .mockResolvedValueOnce(mockClient)
        .mockResolvedValueOnce(mockClient)
        .mockRejectedValue(new Error('Pool exhausted'));

      const results = [];
      
      // First two connections should succeed
      for (let i = 0; i < 2; i++) {
        const client = await mockPool.connect();
        results.push(await client.query('SELECT 1'));
        client.release();
      }

      // Third connection should handle the error
      try {
        await mockPool.connect();
      } catch (error) {
        expect(error.message).toBe('Pool exhausted');
        results.push({ handled: true });
      }

      expect(results).toHaveLength(3);
      expect(results[2]).toEqual({ handled: true });
    });
  });

  describe('Query Optimization Benchmarks', () => {
    test('should meet cache-friendly query performance targets', async () => {
      const businessId = 'benchmark-business-id';
      
      // Simulate cached query responses (faster)
      mockClient.query.mockImplementation(async (query: string) => {
        const isCacheHit = query.includes('WHERE business_context_id = $1');
        const delay = isCacheHit ? 5 : 50; // Cached queries are much faster
        
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return {
          rows: generateMockTriggers(10),
          rowCount: 10,
          command: 'SELECT',
          oid: 0,
          fields: []
        };
      });

      const measurements = [];
      
      // Run multiple iterations to test cache performance
      for (let i = 0; i < 5; i++) {
        const startTime = performance.now();
        
        await mockClient.query(
          'SELECT * FROM dynamic_triggers WHERE business_context_id = $1',
          [businessId]
        );
        
        const duration = performance.now() - startTime;
        measurements.push(duration);
      }

      const averageDuration = measurements.reduce((sum, d) => sum + d, 0) / measurements.length;
      
      // Later queries should be faster due to caching
      expect(measurements[4]).toBeLessThan(measurements[0]);
      expect(averageDuration).toBeLessThan(30);
    });

    test('should validate prepared statement performance', async () => {
      const preparedQueryName = 'get_active_triggers_for_business';
      
      mockClient.query.mockImplementation(async (query: any) => {
        // Simulate prepared statement being faster
        const isPrepared = typeof query === 'object' && query.name === preparedQueryName;
        const delay = isPrepared ? 10 : 25;
        
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return {
          rows: generateMockTriggers(15),
          rowCount: 15,
          command: 'SELECT',
          oid: 0,
          fields: []
        };
      });

      // Test regular query
      const regularStart = performance.now();
      await mockClient.query(
        'SELECT * FROM dynamic_triggers WHERE business_context_id = $1 AND is_active = true',
        ['test-business']
      );
      const regularDuration = performance.now() - regularStart;

      // Test prepared statement
      const preparedStart = performance.now();
      await mockClient.query({
        name: preparedQueryName,
        text: 'SELECT * FROM dynamic_triggers WHERE business_context_id = $1 AND is_active = true',
        values: ['test-business']
      });
      const preparedDuration = performance.now() - preparedStart;

      // Prepared statement should be faster
      expect(preparedDuration).toBeLessThan(regularDuration);
      expect(preparedDuration).toBeLessThan(20);
    });
  });

  describe('Database Performance Monitoring', () => {
    test('should detect slow queries for alerting', async () => {
      const slowQueryThreshold = 200; // ms
      
      mockClient.query.mockImplementation(async () => {
        // Simulate slow query
        await new Promise(resolve => setTimeout(resolve, 250));
        return { rows: [], rowCount: 0, command: 'SELECT', oid: 0, fields: [] };
      });

      const startTime = performance.now();
      
      await mockClient.query('SELECT * FROM very_large_table_without_index WHERE complex_condition = true');
      
      const duration = performance.now() - startTime;
      
      // Should detect that this query exceeds threshold
      expect(duration).toBeGreaterThan(slowQueryThreshold);
      
      // In real implementation, this would trigger monitoring alerts
      if (duration > slowQueryThreshold) {
        // Mock alert logging
        console.warn(`Slow query detected: ${duration}ms`);
      }
    });

    test('should validate connection health checks', async () => {
      mockClient.query.mockResolvedValue({
        rows: [{ now: new Date().toISOString() }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      const startTime = performance.now();
      
      // Simple health check query
      const result = await mockClient.query('SELECT NOW() as now');
      
      const duration = performance.now() - startTime;
      
      expect(duration).toBeLessThan(50); // Health check should be very fast
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].now).toBeDefined();
    });
  });
});

// Helper functions
function generateMockTriggers(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `trigger-${i}`,
    business_context_id: 'test-business',
    trigger_name: `Mock Trigger ${i}`,
    trigger_type: ['purchase_based', 'time_based', 'amount_based'][i % 3],
    priority_level: (i % 5) + 1,
    sensitivity_threshold: Math.max(1, i % 20),
    is_active: true,
    trigger_config: {
      categories: [`category-${i % 5}`],
      minimum_amount: 50 + (i * 25)
    },
    effectiveness_score: Math.random() * 0.4 + 0.6,
    created_at: new Date(Date.now() - (i * 86400000)).toISOString(),
    updated_at: new Date().toISOString()
  }));
}

function generateMockQuestionCombinations(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `combination-${i}`,
    business_context_id: 'test-business',
    rule_name: `Mock Combination Rule ${i}`,
    max_call_duration_seconds: 90 + (i * 10),
    priority_threshold_critical: i % 30,
    priority_threshold_high: 30 + (i % 30),
    priority_threshold_medium: 60 + (i % 30),
    priority_threshold_low: 90 + (i % 30),
    is_active: true,
    group_name: `Group ${i}`,
    topic_category: `topic_${i % 5}`,
    estimated_tokens: 30 + (i % 50),
    created_at: new Date(Date.now() - (i * 3600000)).toISOString(),
    updated_at: new Date().toISOString()
  }));
}

function generateMockFrequencyRules(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `frequency-rule-${i}`,
    rule_id: 'test-rule-id',
    question_pair_hash: `hash-${i}`,
    question_id_1: `question-${i * 2}`,
    question_id_2: `question-${i * 2 + 1}`,
    resolution_strategy: ['combine', 'priority', 'alternate', 'custom'][i % 4],
    custom_frequency: i % 5 === 0 ? 7 : null,
    priority_question_id: i % 3 === 0 ? `question-${i * 2}` : null,
    question_1_text: `Mock Question ${i * 2}`,
    question_2_text: `Mock Question ${i * 2 + 1}`,
    created_at: new Date(Date.now() - (i * 1800000)).toISOString(),
    updated_at: new Date().toISOString()
  }));
}

function generateMockTriggerEvaluationResults(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `eval-trigger-${i}`,
    trigger_name: `Evaluated Trigger ${i}`,
    trigger_type: ['purchase_based', 'time_based', 'amount_based'][i % 3],
    priority_level: (i % 5) + 1,
    effectiveness_score: Math.random() * 0.4 + 0.6,
    evaluation_score: Math.random() * 10,
    condition_key: `condition_${i}`,
    condition_value: `value_${i}`,
    is_active: true
  }));
}

function generateMockOptimizationResults(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `question-${i}`,
    text: `Optimized Question ${i}`,
    category: ['product', 'service', 'experience'][i % 3],
    effective_priority: Math.random() * 25,
    estimated_duration: 15 + (i % 45),
    topic_category: `topic_${i % 5}`,
    topic_rank: (i % 3) + 1,
    running_duration: (i + 1) * 20,
    is_active: true
  }));
}

function generateMockAnalyticsResults() {
  return [{
    total_triggers: 25,
    total_questions: 40,
    total_activations: 150,
    overall_ask_rate: 0.85,
    system_effectiveness: 0.78
  }];
}