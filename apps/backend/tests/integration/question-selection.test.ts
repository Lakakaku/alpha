// Jest globals are available globally
import request from 'supertest';
import { app } from '../../src/app';
import { supabase } from '../../src/config/database';

describe('Question Selection Integration', () => {
  let businessId: string;
  let questionConfigs: any[] = [];

  beforeEach(async () => {
    // Create test business
    const { data: business } = await supabase
      .from('businesses')
      .insert({
        name: 'Test Business for Question Selection',
        email: 'test-questions@example.com',
        phone: '+46700000001'
      })
      .select()
      .single();
    
    businessId = business.id;

    // Create test question configurations
    const questions = [
      {
        business_id: businessId,
        question_text: 'Hur var din upplevelse av vår service idag?',
        frequency: 2, // Every 2nd customer
        priority: 'high',
        department_tags: ['service'],
        is_active: true,
        max_response_time: 30
      },
      {
        business_id: businessId,
        question_text: 'Vad tycker du om våra öppettider?',
        frequency: 5, // Every 5th customer
        priority: 'medium',
        department_tags: ['operations'],
        is_active: true,
        max_response_time: 25
      },
      {
        business_id: businessId,
        question_text: 'Hur var vårt kött- och charksortiment?',
        frequency: 3, // Every 3rd customer
        priority: 'low',
        department_tags: ['products'],
        is_active: true,
        max_response_time: 35
      },
      {
        business_id: businessId,
        question_text: 'Hur upplevde du vår kundservice idag?',
        frequency: 10, // Every 10th customer
        priority: 'high',
        department_tags: ['service'],
        is_active: false, // Inactive question
        max_response_time: 30
      }
    ];

    const { data: createdQuestions } = await supabase
      .from('question_configurations')
      .insert(questions)
      .select();
    
    questionConfigs = createdQuestions || [];
  });

  afterEach(async () => {
    // Clean up test data
    await supabase
      .from('question_configurations')
      .delete()
      .eq('business_id', businessId);
    
    await supabase
      .from('businesses')
      .delete()
      .eq('id', businessId);
  });

  describe('POST /api/questions/select', () => {
    it('should select questions based on frequency for customer #2', async () => {
      const response = await request(app)
        .post('/api/questions/select')
        .send({
          businessId,
          customerCount: 2, // Should trigger frequency 2 question
          timeBudgetSeconds: 90
        });

      expect(response.status).toBe(200);
      expect(response.body.selectedQuestions).toHaveLength(1);
      expect(response.body.selectedQuestions[0].questionText).toBe('Hur var din upplevelse av vår service idag?');
      expect(response.body.estimatedDuration).toBeLessThanOrEqual(90);
    });

    it('should select multiple questions for customer #6 (frequency 2 and 3)', async () => {
      const response = await request(app)
        .post('/api/questions/select')
        .send({
          businessId,
          customerCount: 6, // Should trigger frequency 2 and 3 questions
          timeBudgetSeconds: 90
        });

      expect(response.status).toBe(200);
      expect(response.body.selectedQuestions).toHaveLength(2);
      
      const questionTexts = response.body.selectedQuestions.map((q: any) => q.questionText);
      expect(questionTexts).toContain('Hur var din upplevelse av vår service idag?'); // frequency 2
      expect(questionTexts).toContain('Hur var vårt kött- och charksortiment?'); // frequency 3
    });

    it('should select multiple questions for customer #10 (frequency 2, 5, and 10)', async () => {
      const response = await request(app)
        .post('/api/questions/select')
        .send({
          businessId,
          customerCount: 10, // Should trigger frequency 2, 5, and 10 questions
          timeBudgetSeconds: 120
        });

      expect(response.status).toBe(200);
      expect(response.body.selectedQuestions).toHaveLength(2); // Only 2 because one is inactive
      
      const questionTexts = response.body.selectedQuestions.map((q: any) => q.questionText);
      expect(questionTexts).toContain('Hur var din upplevelse av vår service idag?'); // frequency 2, high priority
      expect(questionTexts).toContain('Vad tycker du om våra öppettider?'); // frequency 5, medium priority
      // Should NOT contain the inactive frequency 10 question
    });

    it('should prioritize high priority questions when time budget is limited', async () => {
      const response = await request(app)
        .post('/api/questions/select')
        .send({
          businessId,
          customerCount: 6, // Multiple questions available
          timeBudgetSeconds: 45 // Limited time budget
        });

      expect(response.status).toBe(200);
      expect(response.body.selectedQuestions).toHaveLength(1);
      expect(response.body.selectedQuestions[0].priority).toBe('high');
      expect(response.body.estimatedDuration).toBeLessThanOrEqual(45);
    });

    it('should handle case with no questions due to frequency', async () => {
      const response = await request(app)
        .post('/api/questions/select')
        .send({
          businessId,
          customerCount: 1, // No questions triggered by frequency
          timeBudgetSeconds: 90
        });

      expect(response.status).toBe(200);
      expect(response.body.selectedQuestions).toHaveLength(0);
      expect(response.body.estimatedDuration).toBe(0);
    });

    it('should respect time budget when selecting questions', async () => {
      const response = await request(app)
        .post('/api/questions/select')
        .send({
          businessId,
          customerCount: 30, // Would trigger all frequencies
          timeBudgetSeconds: 60 // Very tight budget
        });

      expect(response.status).toBe(200);
      expect(response.body.estimatedDuration).toBeLessThanOrEqual(60);
      // Should select only highest priority questions that fit
    });

    it('should create question selection log entry', async () => {
      await request(app)
        .post('/api/questions/select')
        .send({
          businessId,
          customerCount: 6,
          timeBudgetSeconds: 90
        });

      // Verify log entry was created
      const { data: logs } = await supabase
        .from('question_selection_logs')
        .select('*')
        .eq('business_id', businessId)
        .eq('customer_count', 6);

      expect(logs).toHaveLength(1);
      expect(logs![0].time_budget_seconds).toBe(90);
      expect(logs![0].selected_questions).toHaveLength(2);
    });

    it('should return 400 for invalid business ID', async () => {
      const response = await request(app)
        .post('/api/questions/select')
        .send({
          businessId: 'invalid-uuid',
          customerCount: 5,
          timeBudgetSeconds: 90
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid business ID');
    });

    it('should return 400 for invalid customer count', async () => {
      const response = await request(app)
        .post('/api/questions/select')
        .send({
          businessId,
          customerCount: 0, // Invalid
          timeBudgetSeconds: 90
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Customer count must be positive');
    });

    it('should return 400 for invalid time budget', async () => {
      const response = await request(app)
        .post('/api/questions/select')
        .send({
          businessId,
          customerCount: 5,
          timeBudgetSeconds: 30 // Too low
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Time budget must be between 60 and 120 seconds');
    });
  });

  describe('Question Selection Algorithm', () => {
    it('should correctly calculate frequency-based selection', async () => {
      // Test various customer counts and their expected question triggers
      const testCases = [
        { customer: 1, expected: [] },
        { customer: 2, expected: ['frequency_2'] },
        { customer: 3, expected: ['frequency_3'] },
        { customer: 4, expected: ['frequency_2'] },
        { customer: 5, expected: ['frequency_5'] },
        { customer: 6, expected: ['frequency_2', 'frequency_3'] },
        { customer: 10, expected: ['frequency_2', 'frequency_5'] }, // frequency_10 is inactive
        { customer: 15, expected: ['frequency_3', 'frequency_5'] },
        { customer: 20, expected: ['frequency_2', 'frequency_5'] }
      ];

      for (const testCase of testCases) {
        const response = await request(app)
          .post('/api/questions/select')
          .send({
            businessId,
            customerCount: testCase.customer,
            timeBudgetSeconds: 120 // Generous budget
          });

        expect(response.status).toBe(200);
        expect(response.body.selectedQuestions).toHaveLength(testCase.expected.length);
      }
    });

    it('should handle priority ordering when multiple questions are due', async () => {
      const response = await request(app)
        .post('/api/questions/select')
        .send({
          businessId,
          customerCount: 30, // Triggers multiple frequencies
          timeBudgetSeconds: 120
        });

      expect(response.status).toBe(200);
      
      // Should be ordered by priority: high -> medium -> low
      const priorities = response.body.selectedQuestions.map((q: any) => q.priority);
      const highIndex = priorities.indexOf('high');
      const mediumIndex = priorities.indexOf('medium');
      const lowIndex = priorities.indexOf('low');
      
      if (highIndex !== -1 && mediumIndex !== -1) {
        expect(highIndex).toBeLessThan(mediumIndex);
      }
      if (mediumIndex !== -1 && lowIndex !== -1) {
        expect(mediumIndex).toBeLessThan(lowIndex);
      }
    });
  });
});