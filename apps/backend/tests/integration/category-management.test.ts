import request from 'supertest';
import { app } from '../../src/app';
import { createTestDatabase, cleanupTestDatabase } from '../helpers/database';
import { createTestBusinessUser, createTestSession } from '../helpers/auth';

describe('Category Management Integration Test', () => {
  let testDb: any;
  let authToken: string;
  let businessId: string;
  let storeId: string;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    const { token, business_id, store_id } = await createTestBusinessUser();
    authToken = token;
    businessId = business_id;
    storeId = store_id;
  });

  afterAll(async () => {
    await cleanupTestDatabase(testDb);
  });

  describe('User Scenario: Business Manager Organizes Questions by Categories', () => {
    it('should support complete category-based question organization workflow', async () => {
      // Step 1: View available categories
      const categoriesResponse = await request(app)
        .get('/api/questions/categories')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(categoriesResponse.body.success).toBe(true);
      expect(categoriesResponse.body.data.categories).toHaveLength(5);
      
      const categories = categoriesResponse.body.data.categories;
      const serviceCategory = categories.find(cat => cat.id === 'service_quality');
      const productCategory = categories.find(cat => cat.id === 'product_feedback');
      const storeCategory = categories.find(cat => cat.id === 'store_experience');

      expect(serviceCategory).toBeDefined();
      expect(productCategory).toBeDefined();
      expect(storeCategory).toBeDefined();

      // Step 2: Create questions in different categories
      const questionsByCategory = [
        {
          category: 'service_quality',
          questions: [
            {
              title: 'Service Speed Rating',
              question_text: 'How would you rate the speed of our service?',
              question_type: 'scale',
              options: [
                { text: '1 - Very Slow', value: 1 },
                { text: '2 - Slow', value: 2 },
                { text: '3 - Average', value: 3 },
                { text: '4 - Fast', value: 4 },
                { text: '5 - Very Fast', value: 5 }
              ]
            },
            {
              title: 'Staff Friendliness',
              question_text: 'How friendly was our staff?',
              question_type: 'scale',
              options: [
                { text: '1 - Unfriendly', value: 1 },
                { text: '2 - Below Average', value: 2 },
                { text: '3 - Average', value: 3 },
                { text: '4 - Friendly', value: 4 },
                { text: '5 - Very Friendly', value: 5 }
              ]
            }
          ]
        },
        {
          category: 'product_feedback',
          questions: [
            {
              title: 'Product Quality',
              question_text: 'How would you rate the quality of your purchase?',
              question_type: 'scale',
              options: [
                { text: '1 - Poor', value: 1 },
                { text: '2 - Fair', value: 2 },
                { text: '3 - Good', value: 3 },
                { text: '4 - Very Good', value: 4 },
                { text: '5 - Excellent', value: 5 }
              ]
            },
            {
              title: 'Product Selection',
              question_text: 'Which products would you like to see more of?',
              question_type: 'multiple_choice',
              options: [
                { text: 'Organic Options', value: 'organic' },
                { text: 'Vegan Options', value: 'vegan' },
                { text: 'Gluten-Free Options', value: 'gluten_free' },
                { text: 'Local Products', value: 'local' }
              ]
            }
          ]
        },
        {
          category: 'store_experience',
          questions: [
            {
              title: 'Store Cleanliness',
              question_text: 'How clean was our store?',
              question_type: 'scale',
              options: [
                { text: '1 - Very Dirty', value: 1 },
                { text: '2 - Below Average', value: 2 },
                { text: '3 - Average', value: 3 },
                { text: '4 - Clean', value: 4 },
                { text: '5 - Very Clean', value: 5 }
              ]
            },
            {
              title: 'Would Recommend',
              question_text: 'Would you recommend our store to friends?',
              question_type: 'boolean'
            }
          ]
        }
      ];

      const createdQuestions = [];

      // Create all questions
      for (const categoryGroup of questionsByCategory) {
        for (const questionData of categoryGroup.questions) {
          const fullQuestionData = {
            ...questionData,
            category: categoryGroup.category,
            required: true
          };

          const response = await request(app)
            .post('/api/questions')
            .set('Authorization', `Bearer ${authToken}`)
            .send(fullQuestionData)
            .expect(201);

          expect(response.body.success).toBe(true);
          expect(response.body.data.question.category).toBe(categoryGroup.category);
          
          createdQuestions.push({
            ...response.body.data.question,
            expectedCategory: categoryGroup.category
          });
        }
      }

      // Step 3: Verify category statistics are updated
      const updatedCategoriesResponse = await request(app)
        .get('/api/questions/categories?include_stats=true')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const updatedCategories = updatedCategoriesResponse.body.data.categories;
      
      // Service quality should have 2 questions
      const updatedServiceCategory = updatedCategories.find(cat => cat.id === 'service_quality');
      expect(updatedServiceCategory.question_count).toBe(2);
      
      // Product feedback should have 2 questions
      const updatedProductCategory = updatedCategories.find(cat => cat.id === 'product_feedback');
      expect(updatedProductCategory.question_count).toBe(2);
      
      // Store experience should have 2 questions
      const updatedStoreCategory = updatedCategories.find(cat => cat.id === 'store_experience');
      expect(updatedStoreCategory.question_count).toBe(2);

      // Step 4: Filter questions by category
      for (const categoryGroup of questionsByCategory) {
        const categoryQuestionsResponse = await request(app)
          .get(`/api/questions?category=${categoryGroup.category}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(categoryQuestionsResponse.body.success).toBe(true);
        expect(categoryQuestionsResponse.body.data.questions).toHaveLength(categoryGroup.questions.length);
        
        // Verify all questions in response belong to the requested category
        categoryQuestionsResponse.body.data.questions.forEach(question => {
          expect(question.category).toBe(categoryGroup.category);
        });
      }

      // Step 5: Activate questions in specific categories
      const serviceQuestions = createdQuestions.filter(q => q.expectedCategory === 'service_quality');
      
      for (const question of serviceQuestions) {
        await request(app)
          .post(`/api/questions/${question.id}/activate`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);
      }

      // Step 6: Verify active question counts by category
      const finalCategoriesResponse = await request(app)
        .get('/api/questions/categories?include_stats=true')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const finalServiceCategory = finalCategoriesResponse.body.data.categories.find(
        cat => cat.id === 'service_quality'
      );
      
      expect(finalServiceCategory.active_questions).toBe(2);
      expect(finalServiceCategory.question_count).toBe(2);

      // Step 7: Get active questions filtered by category
      const activeServiceQuestionsResponse = await request(app)
        .get('/api/questions?category=service_quality&status=active')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(activeServiceQuestionsResponse.body.data.questions).toHaveLength(2);
      activeServiceQuestionsResponse.body.data.questions.forEach(question => {
        expect(question.category).toBe('service_quality');
        expect(question.status).toBe('active');
      });
    });

    it('should maintain category integrity across question operations', async () => {
      // Create question in service_quality category
      const originalQuestionData = {
        title: 'Original Category Question',
        question_text: 'Testing category changes.',
        question_type: 'text',
        category: 'service_quality',
        required: false
      };

      const createResponse = await request(app)
        .post('/api/questions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(originalQuestionData)
        .expect(201);

      const questionId = createResponse.body.data.question.id;
      expect(createResponse.body.data.question.category).toBe('service_quality');

      // Update question to different category
      const updateData = {
        category: 'product_feedback',
        title: 'Updated Category Question'
      };

      const updateResponse = await request(app)
        .put(`/api/questions/${questionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(updateResponse.body.data.question.category).toBe('product_feedback');
      expect(updateResponse.body.data.question.title).toBe('Updated Category Question');

      // Verify question appears in new category filter
      const productCategoryResponse = await request(app)
        .get('/api/questions?category=product_feedback')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const foundQuestion = productCategoryResponse.body.data.questions.find(
        q => q.id === questionId
      );
      expect(foundQuestion).toBeDefined();
      expect(foundQuestion.category).toBe('product_feedback');

      // Verify question doesn't appear in old category filter
      const serviceCategoryResponse = await request(app)
        .get('/api/questions?category=service_quality')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const notFoundQuestion = serviceCategoryResponse.body.data.questions.find(
        q => q.id === questionId
      );
      expect(notFoundQuestion).toBeUndefined();

      // Verify category statistics are updated
      const categoriesResponse = await request(app)
        .get('/api/questions/categories?include_stats=true')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const categories = categoriesResponse.body.data.categories;
      const serviceCategory = categories.find(cat => cat.id === 'service_quality');
      const productCategory = categories.find(cat => cat.id === 'product_feedback');

      // Product category should have at least 1 question (our moved question)
      expect(productCategory.question_count).toBeGreaterThanOrEqual(1);
    });

    it('should handle category-based question previews', async () => {
      // Create questions in multiple categories
      const questionsData = [
        {
          title: 'Service Question',
          question_text: 'Rate our service.',
          question_type: 'scale',
          category: 'service_quality',
          options: Array.from({length: 5}, (_, i) => ({
            text: `${i + 1}`,
            value: i + 1
          }))
        },
        {
          title: 'Product Question',
          question_text: 'What did you purchase?',
          question_type: 'multiple_choice',
          category: 'product_feedback',
          options: [
            { text: 'Coffee', value: 'coffee' },
            { text: 'Tea', value: 'tea' },
            { text: 'Pastry', value: 'pastry' }
          ]
        },
        {
          title: 'Store Question',
          question_text: 'How was your experience?',
          question_type: 'text',
          category: 'store_experience'
        }
      ];

      const createdQuestions = [];

      for (const questionData of questionsData) {
        const response = await request(app)
          .post('/api/questions')
          .set('Authorization', `Bearer ${authToken}`)
          .send(questionData)
          .expect(201);

        createdQuestions.push(response.body.data.question);
      }

      // Preview questions with category-specific context
      for (const question of createdQuestions) {
        const contextData = {
          context: {
            category: question.category,
            store_name: 'Test Store',
            timestamp: new Date().toISOString()
          },
          format: 'html'
        };

        const previewResponse = await request(app)
          .post(`/api/questions/${question.id}/preview`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(contextData)
          .expect(200);

        expect(previewResponse.body.success).toBe(true);
        expect(previewResponse.body.data.preview.rendered.title).toBe(question.title);
        expect(previewResponse.body.data.preview.context.category).toBe(question.category);
      }
    });

    it('should support bulk operations by category', async () => {
      // Create multiple questions in service_quality category
      const serviceQuestions = [
        {
          title: 'Bulk Service Question 1',
          question_text: 'First bulk question.',
          question_type: 'text',
          category: 'service_quality'
        },
        {
          title: 'Bulk Service Question 2',
          question_text: 'Second bulk question.',
          question_type: 'text',
          category: 'service_quality'
        },
        {
          title: 'Bulk Service Question 3',
          question_text: 'Third bulk question.',
          question_type: 'text',
          category: 'service_quality'
        }
      ];

      const createdQuestionIds = [];

      for (const questionData of serviceQuestions) {
        const response = await request(app)
          .post('/api/questions')
          .set('Authorization', `Bearer ${authToken}`)
          .send(questionData)
          .expect(201);

        createdQuestionIds.push(response.body.data.question.id);
      }

      // Verify all questions are in draft status
      for (const questionId of createdQuestionIds) {
        const response = await request(app)
          .get(`/api/questions/${questionId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.data.question.status).toBe('draft');
      }

      // Activate all questions in service_quality category
      for (const questionId of createdQuestionIds) {
        await request(app)
          .post(`/api/questions/${questionId}/activate`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);
      }

      // Verify all questions are now active
      const activeServiceQuestionsResponse = await request(app)
        .get('/api/questions?category=service_quality&status=active')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const activeQuestionIds = activeServiceQuestionsResponse.body.data.questions.map(q => q.id);
      
      createdQuestionIds.forEach(questionId => {
        expect(activeQuestionIds).toContain(questionId);
      });

      // Verify category statistics reflect the changes
      const categoriesResponse = await request(app)
        .get('/api/questions/categories?include_stats=true')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const serviceCategory = categoriesResponse.body.data.categories.find(
        cat => cat.id === 'service_quality'
      );

      expect(serviceCategory.active_questions).toBeGreaterThanOrEqual(3);
    });

    it('should enforce business isolation for categories', async () => {
      // Create second business user
      const { token: secondToken, business_id: secondBusinessId } = await createTestBusinessUser();

      // Create question in first business
      const firstBusinessQuestionData = {
        title: 'First Business Question',
        question_text: 'Question from first business.',
        question_type: 'text',
        category: 'service_quality'
      };

      const firstResponse = await request(app)
        .post('/api/questions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(firstBusinessQuestionData)
        .expect(201);

      // Create question in second business
      const secondBusinessQuestionData = {
        title: 'Second Business Question',
        question_text: 'Question from second business.',
        question_type: 'text',
        category: 'service_quality'
      };

      const secondResponse = await request(app)
        .post('/api/questions')
        .set('Authorization', `Bearer ${secondToken}`)
        .send(secondBusinessQuestionData)
        .expect(201);

      // Verify category statistics are isolated
      const firstBusinessCategoriesResponse = await request(app)
        .get('/api/questions/categories?include_stats=true')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const secondBusinessCategoriesResponse = await request(app)
        .get('/api/questions/categories?include_stats=true')
        .set('Authorization', `Bearer ${secondToken}`)
        .expect(200);

      // Both should see the same category structure but different question counts
      expect(firstBusinessCategoriesResponse.body.data.categories).toHaveLength(5);
      expect(secondBusinessCategoriesResponse.body.data.categories).toHaveLength(5);

      // Verify questions are isolated by category filter
      const firstBusinessServiceQuestionsResponse = await request(app)
        .get('/api/questions?category=service_quality')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const secondBusinessServiceQuestionsResponse = await request(app)
        .get('/api/questions?category=service_quality')
        .set('Authorization', `Bearer ${secondToken}`)
        .expect(200);

      const firstBusinessQuestionIds = firstBusinessServiceQuestionsResponse.body.data.questions.map(q => q.id);
      const secondBusinessQuestionIds = secondBusinessServiceQuestionsResponse.body.data.questions.map(q => q.id);

      // Each business should only see their own questions
      expect(firstBusinessQuestionIds).toContain(firstResponse.body.data.question.id);
      expect(firstBusinessQuestionIds).not.toContain(secondResponse.body.data.question.id);
      
      expect(secondBusinessQuestionIds).toContain(secondResponse.body.data.question.id);
      expect(secondBusinessQuestionIds).not.toContain(firstResponse.body.data.question.id);
    });
  });
});