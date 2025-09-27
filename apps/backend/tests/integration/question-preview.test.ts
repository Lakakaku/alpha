import request from 'supertest';
import { app } from '../../src/app';
import { createTestDatabase, cleanupTestDatabase } from '../helpers/database';
import { createTestBusinessUser, createTestSession } from '../helpers/auth';

describe('Question Preview Integration Test', () => {
  let testDb: any;
  let authToken: string;
  let businessId: string;
  let storeId: string;
  let testQuestions: any[] = [];

  beforeAll(async () => {
    testDb = await createTestDatabase();
    const { token, business_id, store_id } = await createTestBusinessUser();
    authToken = token;
    businessId = business_id;
    storeId = store_id;

    // Create different types of questions for preview testing
    const questionTypes = [
      {
        title: 'Service Rating Scale',
        question_text: 'How would you rate our service today?',
        question_type: 'scale',
        category: 'service_quality',
        options: [
          { text: '1 - Very Poor', value: 1 },
          { text: '2 - Poor', value: 2 },
          { text: '3 - Fair', value: 3 },
          { text: '4 - Good', value: 4 },
          { text: '5 - Excellent', value: 5 }
        ]
      },
      {
        title: 'Product Preference',
        question_text: 'Which product category do you prefer?',
        question_type: 'multiple_choice',
        category: 'product_feedback',
        options: [
          { text: 'Hot Beverages', value: 'hot_beverages' },
          { text: 'Cold Beverages', value: 'cold_beverages' },
          { text: 'Food Items', value: 'food' },
          { text: 'Retail Products', value: 'retail' }
        ]
      },
      {
        title: 'Recommendation',
        question_text: 'Would you recommend our store to friends and family?',
        question_type: 'boolean',
        category: 'store_experience'
      },
      {
        title: 'Additional Feedback',
        question_text: 'Please share any additional comments or suggestions.',
        question_type: 'text',
        category: 'suggestions'
      }
    ];

    for (const questionData of questionTypes) {
      const response = await request(app)
        .post('/api/questions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(questionData);
      
      testQuestions.push(response.body.data.question);
    }
  });

  afterAll(async () => {
    await cleanupTestDatabase(testDb);
  });

  describe('User Scenario: Business Manager Previews Questions Before Activation', () => {
    it('should generate HTML previews for all question types', async () => {
      for (const question of testQuestions) {
        const previewData = {
          context: {
            customer_name: 'John Smith',
            visit_time: '2025-09-21T15:30:00Z',
            store_name: 'Main Street Coffee',
            transaction_id: 'TXN-12345'
          },
          format: 'html',
          theme: {
            primaryColor: '#007bff',
            fontFamily: 'Arial, sans-serif',
            backgroundColor: '#ffffff'
          }
        };

        const response = await request(app)
          .post(`/api/questions/${question.id}/preview`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(previewData)
          .expect(200);

        expect(response.body.success).toBe(true);
        
        const preview = response.body.data.preview;
        expect(preview).toMatchObject({
          questionId: question.id,
          format: 'html',
          content: expect.stringContaining(question.title),
          rendered: {
            title: question.title,
            questionText: question.question_text,
            questionType: question.question_type
          },
          context: {
            customer_name: 'John Smith',
            visit_time: '2025-09-21T15:30:00Z',
            store_name: 'Main Street Coffee',
            transaction_id: 'TXN-12345'
          },
          theme: {
            primaryColor: '#007bff',
            fontFamily: 'Arial, sans-serif',
            backgroundColor: '#ffffff'
          }
        });

        // Verify HTML content includes theme styles
        expect(preview.content).toContain('#007bff');
        expect(preview.content).toContain('Arial');

        // Type-specific validations
        if (question.question_type === 'scale' || question.question_type === 'multiple_choice') {
          expect(preview.rendered.options).toBeDefined();
          expect(preview.rendered.options.length).toBeGreaterThan(0);
          expect(preview.content).toContain('input');
        }

        if (question.question_type === 'boolean') {
          expect(preview.content).toContain('radio');
          expect(preview.content).toContain('Yes');
          expect(preview.content).toContain('No');
        }

        if (question.question_type === 'text') {
          expect(preview.content).toContain('textarea');
        }
      }
    });

    it('should generate JSON previews for API integration testing', async () => {
      const question = testQuestions.find(q => q.question_type === 'scale');
      
      const previewData = {
        context: {
          customer_id: 'CUST-789',
          session_id: 'SESS-456',
          device_type: 'mobile'
        },
        format: 'json'
      };

      const response = await request(app)
        .post(`/api/questions/${question.id}/preview`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(previewData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.preview.format).toBe('json');

      // Parse and validate JSON content
      const jsonContent = JSON.parse(response.body.data.preview.content);
      expect(jsonContent).toMatchObject({
        question: {
          id: question.id,
          title: question.title,
          text: question.question_text,
          type: question.question_type,
          required: question.required,
          options: expect.any(Array)
        },
        context: {
          customer_id: 'CUST-789',
          session_id: 'SESS-456',
          device_type: 'mobile'
        },
        metadata: {
          category: question.category,
          business_id: businessId,
          store_id: storeId
        }
      });
    });

    it('should generate text previews for SMS/chat integration', async () => {
      const question = testQuestions.find(q => q.question_type === 'text');
      
      const previewData = {
        format: 'text',
        context: {
          channel: 'sms',
          phone_number: '+1234567890'
        }
      };

      const response = await request(app)
        .post(`/api/questions/${question.id}/preview`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(previewData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.preview.format).toBe('text');

      const textContent = response.body.data.preview.content;
      expect(typeof textContent).toBe('string');
      expect(textContent).toContain(question.title);
      expect(textContent).toContain(question.question_text);
      
      // Text format should be clean and readable
      expect(textContent.length).toBeLessThan(500); // SMS-friendly length
      expect(textContent).not.toContain('<'); // No HTML tags
      expect(textContent).not.toContain('>');
    });

    it('should support responsive viewport previews', async () => {
      const question = testQuestions.find(q => q.question_type === 'multiple_choice');
      
      const viewports = ['mobile', 'tablet', 'desktop'];
      
      for (const viewport of viewports) {
        const previewData = {
          format: 'html',
          viewport: viewport,
          theme: {
            primaryColor: '#28a745'
          }
        };

        const response = await request(app)
          .post(`/api/questions/${question.id}/preview`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(previewData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.preview.viewport).toBe(viewport);

        const content = response.body.data.preview.content;
        
        // Verify viewport-specific CSS is included
        if (viewport === 'mobile') {
          expect(content).toContain('max-width: 768px');
          expect(content).toContain('mobile');
        } else if (viewport === 'tablet') {
          expect(content).toContain('max-width: 1024px');
          expect(content).toContain('tablet');
        } else if (viewport === 'desktop') {
          expect(content).toContain('min-width: 1025px');
          expect(content).toContain('desktop');
        }
      }
    });

    it('should handle complex context data and personalization', async () => {
      const question = testQuestions.find(q => q.question_type === 'scale');
      
      const complexContext = {
        customer: {
          name: 'Alice Johnson',
          email: 'alice@example.com',
          loyalty_tier: 'gold',
          visit_count: 15,
          last_visit: '2025-09-15T10:30:00Z',
          preferences: ['coffee', 'pastries'],
          language: 'en'
        },
        visit: {
          date: '2025-09-21T16:45:00Z',
          duration_minutes: 12,
          items_purchased: [
            { name: 'Large Coffee', price: 4.50, category: 'beverage' },
            { name: 'Chocolate Croissant', price: 3.25, category: 'pastry' }
          ],
          total_amount: 7.75,
          payment_method: 'credit_card',
          staff_member: 'Sarah'
        },
        store: {
          name: 'Downtown Coffee House',
          location: 'Main Street',
          busy_level: 'moderate',
          weather: 'sunny',
          special_events: ['happy_hour']
        }
      };

      const previewData = {
        context: complexContext,
        format: 'html',
        personalization: true
      };

      const response = await request(app)
        .post(`/api/questions/${question.id}/preview`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(previewData)
        .expect(200);

      expect(response.body.success).toBe(true);
      
      const preview = response.body.data.preview;
      expect(preview.context.customer.name).toBe('Alice Johnson');
      expect(preview.context.visit.total_amount).toBe(7.75);
      
      // Verify personalization is applied
      const content = preview.content;
      expect(content).toContain('Alice'); // Customer name used in content
      expect(content).toContain('gold'); // Loyalty tier mentioned
      expect(content).toContain('Sarah'); // Staff member mentioned
    });

    it('should meet performance requirements for preview generation', async () => {
      const question = testQuestions.find(q => q.question_type === 'multiple_choice');
      
      const previewData = {
        context: {
          customer_name: 'Performance Test Customer',
          timestamp: new Date().toISOString()
        },
        format: 'html'
      };

      const startTime = Date.now();

      const response = await request(app)
        .post(`/api/questions/${question.id}/preview`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(previewData)
        .expect(200);

      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      expect(response.body.success).toBe(true);
      expect(totalDuration).toBeLessThan(100); // Overall API response time
      expect(response.body.data.preview.generationTime).toBeLessThan(50); // Preview generation time
    });

    it('should handle preview workflow with question updates', async () => {
      // Create a new question for this test
      const originalQuestionData = {
        title: 'Original Preview Question',
        question_text: 'Original question text for preview testing.',
        question_type: 'scale',
        category: 'service_quality',
        options: [
          { text: '1 - Poor', value: 1 },
          { text: '2 - Fair', value: 2 },
          { text: '3 - Good', value: 3 }
        ]
      };

      const createResponse = await request(app)
        .post('/api/questions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(originalQuestionData)
        .expect(201);

      const questionId = createResponse.body.data.question.id;

      // Step 1: Generate initial preview
      const initialPreviewResponse = await request(app)
        .post(`/api/questions/${questionId}/preview`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ format: 'html' })
        .expect(200);

      expect(initialPreviewResponse.body.data.preview.content).toContain('Original Preview Question');
      expect(initialPreviewResponse.body.data.preview.rendered.options).toHaveLength(3);

      // Step 2: Update question
      const updateData = {
        title: 'Updated Preview Question',
        question_text: 'Updated question text with more detail.',
        options: [
          { text: '1 - Very Poor', value: 1 },
          { text: '2 - Poor', value: 2 },
          { text: '3 - Fair', value: 3 },
          { text: '4 - Good', value: 4 },
          { text: '5 - Excellent', value: 5 }
        ]
      };

      await request(app)
        .put(`/api/questions/${questionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      // Step 3: Generate updated preview
      const updatedPreviewResponse = await request(app)
        .post(`/api/questions/${questionId}/preview`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ format: 'html' })
        .expect(200);

      expect(updatedPreviewResponse.body.data.preview.content).toContain('Updated Preview Question');
      expect(updatedPreviewResponse.body.data.preview.content).toContain('Updated question text with more detail');
      expect(updatedPreviewResponse.body.data.preview.rendered.options).toHaveLength(5);

      // Step 4: Compare preview timestamps
      const initialTimestamp = new Date(initialPreviewResponse.body.data.preview.generatedAt);
      const updatedTimestamp = new Date(updatedPreviewResponse.body.data.preview.generatedAt);
      
      expect(updatedTimestamp.getTime()).toBeGreaterThan(initialTimestamp.getTime());
    });

    it('should support batch preview generation for multiple questions', async () => {
      const previewPromises = testQuestions.map(question => {
        const previewData = {
          context: {
            batch_id: 'BATCH-001',
            question_position: testQuestions.indexOf(question) + 1,
            total_questions: testQuestions.length
          },
          format: 'html'
        };

        return request(app)
          .post(`/api/questions/${question.id}/preview`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(previewData)
          .expect(200);
      });

      const responses = await Promise.all(previewPromises);

      // Verify all previews were generated successfully
      responses.forEach((response, index) => {
        expect(response.body.success).toBe(true);
        expect(response.body.data.preview.context.batch_id).toBe('BATCH-001');
        expect(response.body.data.preview.context.question_position).toBe(index + 1);
        expect(response.body.data.preview.context.total_questions).toBe(testQuestions.length);
      });

      // Verify performance of batch operation
      const batchStartTime = Date.now();
      await Promise.all(previewPromises);
      const batchEndTime = Date.now();
      const batchDuration = batchEndTime - batchStartTime;

      // Batch should complete within reasonable time
      expect(batchDuration).toBeLessThan(500); // 500ms for all previews
    });

    it('should maintain preview consistency across formats', async () => {
      const question = testQuestions.find(q => q.question_type === 'scale');
      
      const sharedContext = {
        customer_name: 'Consistency Test User',
        visit_id: 'VISIT-789',
        store_id: storeId
      };

      // Generate previews in all formats
      const formats = ['html', 'json', 'text'];
      const previews = {};

      for (const format of formats) {
        const response = await request(app)
          .post(`/api/questions/${question.id}/preview`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            context: sharedContext,
            format: format
          })
          .expect(200);

        previews[format] = response.body.data.preview;
      }

      // Verify consistency across formats
      expect(previews.html.rendered.title).toBe(previews.json.rendered.title);
      expect(previews.html.rendered.questionText).toBe(previews.json.rendered.questionText);
      expect(previews.html.context.customer_name).toBe(previews.json.context.customer_name);
      expect(previews.json.context.customer_name).toBe(previews.text.context.customer_name);

      // Verify format-specific differences
      expect(previews.html.content).toContain('<');
      expect(previews.text.content).not.toContain('<');
      expect(typeof previews.json.content).toBe('string');
      expect(() => JSON.parse(previews.json.content)).not.toThrow();
    });
  });
});