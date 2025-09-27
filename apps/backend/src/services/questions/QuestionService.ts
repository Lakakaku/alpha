import { database } from '@vocilia/database';
import { CustomQuestionModel } from '@vocilia/database/src/questions/models/CustomQuestion';
import { QuestionCategoryModel } from '@vocilia/database/src/questions/models/QuestionCategory';
import { QuestionTriggerModel } from '@vocilia/database/src/questions/models/QuestionTrigger';
import { QuestionResponseModel } from '@vocilia/database/src/questions/models/QuestionResponse';
import { ValidationError, NotFoundError, ConflictError } from '../../middleware/errorHandler';
import { QuestionPaginationService, PaginatedQuestionParams } from '../../utils/questionPagination';
import { QuestionPreviewService, PreviewOptions } from '../../utils/questionPreview';
import type {
  CustomQuestion,
  QuestionCategory,
  QuestionTrigger,
  QuestionResponse,
  CreateQuestionRequest,
  UpdateQuestionRequest,
  QuestionsListParams,
  CreateCategoryRequest,
  CreateTriggerRequest,
  QuestionPreviewOptions,
  QuestionAnalyticsSummary,
} from '@vocilia/types/src/questions';

export interface QuestionListResult {
  data: CustomQuestion[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CategoryListResult {
  categories: QuestionCategory[];
  total: number;
}

export interface QuestionStatsResult {
  total_responses: number;
  answered_responses: number;
  skipped_responses: number;
  average_rating?: number;
  average_response_time_ms?: number;
  response_rate: number;
}

export class QuestionService {
  private supabase = database.createClient();
  private questionModel: CustomQuestionModel;
  private categoryModel: QuestionCategoryModel;
  private triggerModel: QuestionTriggerModel;
  private responseModel: QuestionResponseModel;
  private paginationService: QuestionPaginationService;
  private previewService: QuestionPreviewService;

  constructor() {
    this.questionModel = new CustomQuestionModel(this.supabase);
    this.categoryModel = new QuestionCategoryModel(this.supabase);
    this.triggerModel = new QuestionTriggerModel(this.supabase);
    this.responseModel = new QuestionResponseModel(this.supabase);
    this.paginationService = new QuestionPaginationService(this.supabase);
    this.previewService = new QuestionPreviewService();
  }

  // Question CRUD Operations
  async createQuestion(
    businessId: string,
    data: CreateQuestionRequest
  ): Promise<CustomQuestion> {
    if (!businessId) {
      throw new ValidationError('Business ID is required');
    }

    // Validate required fields
    if (!data.title || data.title.trim().length === 0) {
      throw new ValidationError('Question title is required');
    }

    if (!data.question_text || data.question_text.trim().length === 0) {
      throw new ValidationError('Question text is required');
    }

    if (!data.question_type) {
      throw new ValidationError('Question type is required');
    }

    // Validate question type specific requirements
    if (data.question_type === 'multiple_choice' || data.question_type === 'checkbox') {
      if (!data.options || !Array.isArray(data.options) || data.options.length < 2) {
        throw new ValidationError(`${data.question_type} questions must have at least 2 options`);
      }
    }

    if (data.question_type === 'scale') {
      if (!data.options || !data.options.min_value || !data.options.max_value) {
        throw new ValidationError('Scale questions must have min_value and max_value');
      }
      if (data.options.min_value >= data.options.max_value) {
        throw new ValidationError('Scale min_value must be less than max_value');
      }
    }

    // Validate category exists if provided
    if (data.category_id) {
      const category = await this.categoryModel.findById(data.category_id);
      if (!category) {
        throw new NotFoundError('Question category not found');
      }
    }

    try {
      return await this.questionModel.create(businessId, data);
    } catch (error: any) {
      if (error.code === '23505') { // Unique constraint violation
        throw new ConflictError('A question with this title already exists');
      }
      throw new Error(`Failed to create question: ${error.message}`);
    }
  }

  async getQuestion(questionId: string): Promise<CustomQuestion> {
    if (!questionId) {
      throw new ValidationError('Question ID is required');
    }

    const question = await this.questionModel.findById(questionId);
    if (!question) {
      throw new NotFoundError('Question not found');
    }

    return question;
  }

  async listQuestions(
    businessId: string,
    params: PaginatedQuestionParams = {}
  ): Promise<QuestionListResult> {
    if (!businessId) {
      throw new ValidationError('Business ID is required');
    }

    // Use optimized pagination service
    const result = await this.paginationService.getPaginatedQuestions(businessId, params);
    
    return {
      data: result.data,
      pagination: result.pagination,
    };
  }

  async listQuestionsOptimized(
    businessId: string,
    params: PaginatedQuestionParams = {}
  ): Promise<QuestionListResult> {
    if (!businessId) {
      throw new ValidationError('Business ID is required');
    }

    // Use cached query for frequently accessed data
    const cacheKey = `questions_list_${businessId}_${JSON.stringify(params)}`;
    
    const result = await this.paginationService.getCachedQuery(
      cacheKey,
      () => this.paginationService.getPaginatedQuestions(businessId, params)
    );
    
    return {
      data: result.data,
      pagination: result.pagination,
    };
  }

  async updateQuestion(
    questionId: string,
    data: UpdateQuestionRequest
  ): Promise<CustomQuestion> {
    if (!questionId) {
      throw new ValidationError('Question ID is required');
    }

    // Get existing question to check if it's safe to update
    const existingQuestion = await this.getQuestion(questionId);
    
    // Prevent breaking changes if question is active and has responses
    if (existingQuestion.is_active && existingQuestion.status === 'active') {
      const responseCount = await this.responseModel.countResponsesInWindow(questionId, 60);
      if (responseCount > 0) {
        // Only allow safe updates for active questions with recent responses
        const safeFields = ['title', 'active_start_date', 'active_end_date', 'active_hours_start', 'active_hours_end', 'active_days_of_week', 'priority'];
        const changedFields = Object.keys(data);
        const unsafeChanges = changedFields.filter(field => !safeFields.includes(field));
        
        if (unsafeChanges.length > 0) {
          throw new ConflictError(`Cannot modify ${unsafeChanges.join(', ')} on active question with recent responses. Deactivate question first.`);
        }
      }
    }

    // Validate category exists if being updated
    if (data.category_id) {
      const category = await this.categoryModel.findById(data.category_id);
      if (!category) {
        throw new NotFoundError('Question category not found');
      }
    }

    try {
      return await this.questionModel.update(questionId, data);
    } catch (error: any) {
      if (error.code === '23505') {
        throw new ConflictError('A question with this title already exists');
      }
      throw new Error(`Failed to update question: ${error.message}`);
    }
  }

  async deleteQuestion(questionId: string, force: boolean = false): Promise<void> {
    if (!questionId) {
      throw new ValidationError('Question ID is required');
    }

    const question = await this.getQuestion(questionId);

    if (force) {
      // Hard delete - remove all associated data
      await this.responseModel.deleteByQuestionId(questionId);
      await this.questionModel.hardDelete(questionId);
    } else {
      // Soft delete - just mark as archived
      await this.questionModel.softDelete(questionId);
    }
  }

  async activateQuestion(questionId: string): Promise<CustomQuestion> {
    if (!questionId) {
      throw new ValidationError('Question ID is required');
    }

    const question = await this.getQuestion(questionId);
    
    if (question.status === 'active') {
      throw new ConflictError('Question is already active');
    }

    if (question.status === 'archived') {
      throw new ConflictError('Cannot activate archived question');
    }

    return await this.questionModel.activate(questionId);
  }

  async deactivateQuestion(questionId: string): Promise<CustomQuestion> {
    if (!questionId) {
      throw new ValidationError('Question ID is required');
    }

    return await this.questionModel.deactivate(questionId);
  }

  // Category Operations
  async createCategory(
    businessId: string,
    data: CreateCategoryRequest
  ): Promise<QuestionCategory> {
    if (!businessId) {
      throw new ValidationError('Business ID is required');
    }

    if (!data.name || data.name.trim().length === 0) {
      throw new ValidationError('Category name is required');
    }

    // Check for duplicate category name
    const existing = await this.categoryModel.findByName(businessId, data.name);
    if (existing) {
      throw new ConflictError('A category with this name already exists');
    }

    try {
      return await this.categoryModel.create(businessId, data);
    } catch (error: any) {
      throw new Error(`Failed to create category: ${error.message}`);
    }
  }

  async listCategories(businessId: string): Promise<CategoryListResult> {
    if (!businessId) {
      throw new ValidationError('Business ID is required');
    }

    const categories = await this.categoryModel.findManyWithStats(businessId);

    return {
      categories,
      total: categories.length,
    };
  }

  async listCategoriesPaginated(
    businessId: string,
    params: {
      page?: number;
      limit?: number;
      search?: string;
      sort?: string;
      order?: 'asc' | 'desc';
    } = {}
  ): Promise<QuestionListResult> {
    if (!businessId) {
      throw new ValidationError('Business ID is required');
    }

    const result = await this.paginationService.getPaginatedCategories(businessId, params);
    
    return {
      data: result.data,
      pagination: result.pagination,
    };
  }

  async getFilterSuggestions(businessId: string) {
    if (!businessId) {
      throw new ValidationError('Business ID is required');
    }

    return await this.paginationService.getFilterSuggestions(businessId);
  }

  async updateCategory(
    categoryId: string,
    data: Partial<CreateCategoryRequest>
  ): Promise<QuestionCategory> {
    if (!categoryId) {
      throw new ValidationError('Category ID is required');
    }

    const existingCategory = await this.categoryModel.findById(categoryId);
    if (!existingCategory) {
      throw new NotFoundError('Category not found');
    }

    try {
      return await this.categoryModel.update(categoryId, data);
    } catch (error: any) {
      if (error.code === '23505') {
        throw new ConflictError('A category with this name already exists');
      }
      throw new Error(`Failed to update category: ${error.message}`);
    }
  }

  async deleteCategory(categoryId: string): Promise<void> {
    if (!categoryId) {
      throw new ValidationError('Category ID is required');
    }

    try {
      await this.categoryModel.delete(categoryId);
    } catch (error: any) {
      if (error.message.includes('questions are still using')) {
        throw new ConflictError(error.message);
      }
      throw new Error(`Failed to delete category: ${error.message}`);
    }
  }

  // Trigger Operations
  async createTrigger(
    questionId: string,
    data: CreateTriggerRequest
  ): Promise<QuestionTrigger> {
    if (!questionId) {
      throw new ValidationError('Question ID is required');
    }

    if (!data.trigger_type) {
      throw new ValidationError('Trigger type is required');
    }

    // Validate the question exists
    await this.getQuestion(questionId);

    try {
      return await this.triggerModel.create(questionId, data);
    } catch (error: any) {
      throw new Error(`Failed to create trigger: ${error.message}`);
    }
  }

  async listTriggers(questionId: string): Promise<QuestionTrigger[]> {
    if (!questionId) {
      throw new ValidationError('Question ID is required');
    }

    return await this.triggerModel.findByQuestionId(questionId);
  }

  async updateTrigger(
    triggerId: string,
    data: Partial<CreateTriggerRequest>
  ): Promise<QuestionTrigger> {
    if (!triggerId) {
      throw new ValidationError('Trigger ID is required');
    }

    try {
      return await this.triggerModel.update(triggerId, data);
    } catch (error: any) {
      throw new Error(`Failed to update trigger: ${error.message}`);
    }
  }

  async deleteTrigger(triggerId: string): Promise<void> {
    if (!triggerId) {
      throw new ValidationError('Trigger ID is required');
    }

    try {
      await this.triggerModel.delete(triggerId);
    } catch (error: any) {
      throw new Error(`Failed to delete trigger: ${error.message}`);
    }
  }

  // Preview Operations
  async generatePreview(
    questionId: string,
    options: PreviewOptions = {}
  ): Promise<{
    html: string;
    json: Record<string, any>;
    text: string;
    metadata?: any;
  }> {
    if (!questionId) {
      throw new ValidationError('Question ID is required');
    }

    const question = await this.getQuestion(questionId);

    // Use optimized preview service
    const result = await this.previewService.generatePreview(question, options);

    return result;
  }

  async batchGeneratePreviews(
    questionIds: string[],
    options: PreviewOptions = {}
  ): Promise<Map<string, any>> {
    if (!questionIds || questionIds.length === 0) {
      throw new ValidationError('Question IDs are required');
    }

    // Get all questions in parallel
    const questions = await Promise.all(
      questionIds.map(id => this.getQuestion(id))
    );

    // Generate previews in batch
    return await this.previewService.batchGeneratePreviews(questions, options);
  }

  private generateHtmlPreview(
    question: CustomQuestion,
    format: string,
    personalization: Record<string, any>
  ): string {
    const title = this.personalizeText(question.title, personalization);
    const questionText = this.personalizeText(question.question_text, personalization);

    let optionsHtml = '';
    if (question.question_type === 'multiple_choice') {
      optionsHtml = question.options?.choices?.map((choice: string, index: number) => 
        `<div class="option"><input type="radio" id="option${index}" name="question" value="${choice}"><label for="option${index}">${choice}</label></div>`
      ).join('') || '';
    } else if (question.question_type === 'checkbox') {
      optionsHtml = question.options?.choices?.map((choice: string, index: number) => 
        `<div class="option"><input type="checkbox" id="option${index}" value="${choice}"><label for="option${index}">${choice}</label></div>`
      ).join('') || '';
    } else if (question.question_type === 'scale') {
      const min = question.options?.min_value || 1;
      const max = question.options?.max_value || 5;
      optionsHtml = `<div class="scale">`;
      for (let i = min; i <= max; i++) {
        optionsHtml += `<input type="radio" id="scale${i}" name="question" value="${i}"><label for="scale${i}">${i}</label>`;
      }
      optionsHtml += `</div>`;
    }

    return `
      <div class="question-preview ${format}">
        <h3 class="question-title">${title}</h3>
        <p class="question-text">${questionText}</p>
        <div class="question-options">
          ${optionsHtml}
        </div>
        ${question.required ? '<p class="required">* Required</p>' : ''}
      </div>
    `;
  }

  private generateJsonPreview(
    question: CustomQuestion,
    personalization: Record<string, any>
  ): Record<string, any> {
    return {
      id: question.id,
      title: this.personalizeText(question.title, personalization),
      question_text: this.personalizeText(question.question_text, personalization),
      question_type: question.question_type,
      options: question.options,
      required: question.required,
      category: question.category,
      priority: question.priority,
      personalization_applied: Object.keys(personalization).length > 0,
    };
  }

  private generateTextPreview(
    question: CustomQuestion,
    personalization: Record<string, any>
  ): string {
    const title = this.personalizeText(question.title, personalization);
    const questionText = this.personalizeText(question.question_text, personalization);
    
    let optionsText = '';
    if (question.question_type === 'multiple_choice' || question.question_type === 'checkbox') {
      optionsText = question.options?.choices?.map((choice: string, index: number) => 
        `${index + 1}. ${choice}`
      ).join('\n') || '';
    } else if (question.question_type === 'scale') {
      const min = question.options?.min_value || 1;
      const max = question.options?.max_value || 5;
      optionsText = `Scale: ${min} to ${max}`;
    }

    return `${title}\n\n${questionText}\n\n${optionsText}${question.required ? '\n\n* Required' : ''}`;
  }

  private personalizeText(text: string, personalization: Record<string, any>): string {
    let personalizedText = text;
    
    Object.entries(personalization).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      personalizedText = personalizedText.replace(new RegExp(placeholder, 'g'), String(value));
    });

    return personalizedText;
  }

  // Analytics Operations
  async getQuestionStats(questionId: string): Promise<QuestionStatsResult> {
    if (!questionId) {
      throw new ValidationError('Question ID is required');
    }

    return await this.responseModel.getQuestionStats(questionId);
  }

  async getQuestionAnalytics(
    questionId: string,
    periodType: 'hourly' | 'daily' | 'weekly' = 'daily',
    limit: number = 30
  ): Promise<QuestionAnalyticsSummary[]> {
    if (!questionId) {
      throw new ValidationError('Question ID is required');
    }

    return await this.responseModel.getAnalyticsSummary(questionId, periodType, limit);
  }

  // Utility Operations
  async getActiveQuestions(
    businessId: string,
    storeId?: string
  ): Promise<CustomQuestion[]> {
    if (!businessId) {
      throw new ValidationError('Business ID is required');
    }

    return await this.questionModel.findActive(businessId, storeId);
  }

  async getEligibleQuestions(
    businessId: string,
    storeId?: string,
    currentTime?: Date
  ): Promise<CustomQuestion[]> {
    if (!businessId) {
      throw new ValidationError('Business ID is required');
    }

    return await this.questionModel.findEligible(businessId, storeId, currentTime);
  }

  async incrementQuestionFrequency(questionId: string): Promise<void> {
    if (!questionId) {
      throw new ValidationError('Question ID is required');
    }

    await this.questionModel.incrementFrequency(questionId);
  }

  async checkFrequencyLimit(questionId: string): Promise<boolean> {
    if (!questionId) {
      throw new ValidationError('Question ID is required');
    }

    return await this.questionModel.checkFrequencyLimit(questionId);
  }
}

export default QuestionService;