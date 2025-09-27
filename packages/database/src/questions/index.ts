// Custom Questions Database Utilities
// Feature: 006-step-2-4

import { createClient } from '@supabase/supabase-js';
import type {
  CustomQuestion,
  QuestionCategory,
  QuestionTrigger,
  QuestionResponse,
  QuestionAnalyticsSummary,
  QuestionsListParams,
  CreateQuestionRequest,
  UpdateQuestionRequest,
  CreateCategoryRequest,
  CreateTriggerRequest,
} from '@vocilia/types/src/questions';

export class QuestionsDatabase {
  constructor(private supabase: ReturnType<typeof createClient>) {}

  // Custom Questions CRUD operations
  async createQuestion(
    businessId: string,
    data: CreateQuestionRequest
  ): Promise<CustomQuestion> {
    const { data: question, error } = await this.supabase
      .from('custom_questions')
      .insert({
        business_id: businessId,
        ...data,
        created_by: (await this.supabase.auth.getUser()).data.user?.id,
        updated_by: (await this.supabase.auth.getUser()).data.user?.id,
      })
      .select('*')
      .single();

    if (error) throw error;
    return question;
  }

  async getQuestion(questionId: string): Promise<CustomQuestion | null> {
    const { data: question, error } = await this.supabase
      .from('custom_questions')
      .select(`
        *,
        category:question_categories(*)
      `)
      .eq('id', questionId)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
    return question;
  }

  async listQuestions(
    businessId: string,
    params: QuestionsListParams = {}
  ): Promise<{
    data: CustomQuestion[];
    count: number;
  }> {
    let query = this.supabase
      .from('custom_questions')
      .select(`
        *,
        category:question_categories(*)
      `, { count: 'exact' })
      .eq('business_id', businessId);

    // Apply filters
    if (params.store_id) {
      query = query.eq('store_id', params.store_id);
    }
    if (params.category_id) {
      query = query.eq('category_id', params.category_id);
    }
    if (params.status) {
      query = query.eq('status', params.status);
    }
    if (params.priority) {
      query = query.eq('priority', params.priority);
    }
    if (params.is_active !== undefined) {
      query = query.eq('is_active', params.is_active);
    }

    // Apply sorting
    const sortBy = params.sort_by || 'created_at';
    const sortOrder = params.sort_order || 'desc';
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // Apply pagination
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;
    return { data: data || [], count: count || 0 };
  }

  async updateQuestion(
    questionId: string,
    data: UpdateQuestionRequest
  ): Promise<CustomQuestion> {
    const { data: question, error } = await this.supabase
      .from('custom_questions')
      .update({
        ...data,
        updated_by: (await this.supabase.auth.getUser()).data.user?.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', questionId)
      .select('*')
      .single();

    if (error) throw error;
    return question;
  }

  async deleteQuestion(questionId: string): Promise<void> {
    const { error } = await this.supabase
      .from('custom_questions')
      .update({
        status: 'archived',
        is_active: false,
        updated_by: (await this.supabase.auth.getUser()).data.user?.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', questionId);

    if (error) throw error;
  }

  async activateQuestion(questionId: string): Promise<CustomQuestion> {
    const { data: question, error } = await this.supabase
      .from('custom_questions')
      .update({
        status: 'active',
        is_active: true,
        updated_by: (await this.supabase.auth.getUser()).data.user?.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', questionId)
      .select('*')
      .single();

    if (error) throw error;
    return question;
  }

  async deactivateQuestion(questionId: string): Promise<CustomQuestion> {
    const { data: question, error } = await this.supabase
      .from('custom_questions')
      .update({
        status: 'inactive',
        is_active: false,
        updated_by: (await this.supabase.auth.getUser()).data.user?.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', questionId)
      .select('*')
      .single();

    if (error) throw error;
    return question;
  }

  // Question Categories CRUD operations
  async createCategory(
    businessId: string,
    data: CreateCategoryRequest
  ): Promise<QuestionCategory> {
    const { data: category, error } = await this.supabase
      .from('question_categories')
      .insert({
        business_id: businessId,
        ...data,
      })
      .select('*')
      .single();

    if (error) throw error;
    return category;
  }

  async listCategories(businessId: string): Promise<QuestionCategory[]> {
    const { data: categories, error } = await this.supabase
      .from('question_categories')
      .select('*')
      .eq('business_id', businessId)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return categories || [];
  }

  async updateCategory(
    categoryId: string,
    data: Partial<CreateCategoryRequest>
  ): Promise<QuestionCategory> {
    const { data: category, error } = await this.supabase
      .from('question_categories')
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', categoryId)
      .select('*')
      .single();

    if (error) throw error;
    return category;
  }

  async deleteCategory(categoryId: string): Promise<void> {
    const { error } = await this.supabase
      .from('question_categories')
      .delete()
      .eq('id', categoryId);

    if (error) throw error;
  }

  // Question Triggers CRUD operations
  async createTrigger(
    questionId: string,
    data: CreateTriggerRequest
  ): Promise<QuestionTrigger> {
    const { data: trigger, error } = await this.supabase
      .from('question_triggers')
      .insert({
        question_id: questionId,
        ...data,
      })
      .select('*')
      .single();

    if (error) throw error;
    return trigger;
  }

  async listTriggers(questionId: string): Promise<QuestionTrigger[]> {
    const { data: triggers, error } = await this.supabase
      .from('question_triggers')
      .select('*')
      .eq('question_id', questionId)
      .eq('is_enabled', true)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return triggers || [];
  }

  async updateTrigger(
    triggerId: string,
    data: Partial<CreateTriggerRequest>
  ): Promise<QuestionTrigger> {
    const { data: trigger, error } = await this.supabase
      .from('question_triggers')
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', triggerId)
      .select('*')
      .single();

    if (error) throw error;
    return trigger;
  }

  async deleteTrigger(triggerId: string): Promise<void> {
    const { error } = await this.supabase
      .from('question_triggers')
      .delete()
      .eq('id', triggerId);

    if (error) throw error;
  }

  // Question Responses operations (for analytics)
  async recordResponse(data: {
    question_id: string;
    business_id: string;
    store_id?: string;
    response_text?: string;
    response_rating?: number;
    response_value?: Record<string, any>;
    customer_session_id?: string;
    trigger_context?: Record<string, any>;
    was_answered: boolean;
    was_skipped: boolean;
  }): Promise<QuestionResponse> {
    const { data: response, error } = await this.supabase
      .from('question_responses')
      .insert({
        ...data,
        responded_at: data.was_answered ? new Date().toISOString() : null,
      })
      .select('*')
      .single();

    if (error) throw error;
    return response;
  }

  async getQuestionAnalytics(
    questionId: string,
    periodType: 'hourly' | 'daily' | 'weekly' = 'daily',
    limit: number = 30
  ): Promise<QuestionAnalyticsSummary[]> {
    const { data: analytics, error } = await this.supabase
      .from('question_analytics_summary')
      .select('*')
      .eq('question_id', questionId)
      .eq('period_type', periodType)
      .order('period_start', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return analytics || [];
  }

  // Frequency management
  async incrementFrequencyCounter(questionId: string): Promise<void> {
    const { error } = await this.supabase.rpc('increment_question_frequency', {
      question_id: questionId,
    });

    if (error) throw error;
  }

  async resetFrequencyCounter(questionId: string): Promise<void> {
    const { error } = await this.supabase
      .from('custom_questions')
      .update({
        frequency_current: 0,
        frequency_reset_at: new Date().toISOString(),
      })
      .eq('id', questionId);

    if (error) throw error;
  }

  async getActiveQuestions(
    businessId: string,
    storeId?: string
  ): Promise<CustomQuestion[]> {
    let query = this.supabase
      .from('custom_questions')
      .select(`
        *,
        triggers:question_triggers!inner(*)
      `)
      .eq('business_id', businessId)
      .eq('is_active', true)
      .eq('status', 'active');

    if (storeId) {
      query = query.or(`store_id.is.null,store_id.eq.${storeId}`);
    } else {
      query = query.is('store_id', null);
    }

    // Check date range
    const now = new Date().toISOString().split('T')[0]; // Today's date
    query = query.or(`active_start_date.is.null,active_start_date.lte.${now}`);
    query = query.or(`active_end_date.is.null,active_end_date.gte.${now}`);

    const { data: questions, error } = await query.order('priority', {
      ascending: false,
    }); // High priority first

    if (error) throw error;
    return questions || [];
  }

  // Utility functions
  async getBusinessQuestionCount(businessId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from('custom_questions')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .neq('status', 'archived');

    if (error) throw error;
    return count || 0;
  }

  async getQuestionsByCategory(
    businessId: string,
    categoryId: string
  ): Promise<CustomQuestion[]> {
    const { data: questions, error } = await this.supabase
      .from('custom_questions')
      .select('*')
      .eq('business_id', businessId)
      .eq('category_id', categoryId)
      .neq('status', 'archived')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return questions || [];
  }
}

// Factory function to create database instance
export function createQuestionsDatabase(supabase: ReturnType<typeof createClient>) {
  return new QuestionsDatabase(supabase);
}

// Database functions for Supabase (to be created as SQL functions)
export const DATABASE_FUNCTIONS = {
  // Function to increment frequency counter atomically
  INCREMENT_FREQUENCY: `
    CREATE OR REPLACE FUNCTION increment_question_frequency(question_id UUID)
    RETURNS void AS $$
    BEGIN
      UPDATE custom_questions
      SET frequency_current = frequency_current + 1
      WHERE id = question_id;
    END;
    $$ LANGUAGE plpgsql;
  `,

  // Function to check if question should be presented based on frequency
  CHECK_FREQUENCY_LIMIT: `
    CREATE OR REPLACE FUNCTION check_question_frequency_limit(question_id UUID)
    RETURNS boolean AS $$
    DECLARE
      question_record RECORD;
      should_present boolean := false;
    BEGIN
      SELECT frequency_target, frequency_current, frequency_window, frequency_reset_at
      INTO question_record
      FROM custom_questions
      WHERE id = question_id;

      -- Check if frequency needs reset
      IF question_record.frequency_reset_at IS NULL OR
         (question_record.frequency_window = 'hourly' AND question_record.frequency_reset_at < NOW() - INTERVAL '1 hour') OR
         (question_record.frequency_window = 'daily' AND question_record.frequency_reset_at < NOW() - INTERVAL '1 day') OR
         (question_record.frequency_window = 'weekly' AND question_record.frequency_reset_at < NOW() - INTERVAL '1 week') THEN

        -- Reset frequency counter
        UPDATE custom_questions
        SET frequency_current = 0,
            frequency_reset_at = NOW()
        WHERE id = question_id;

        should_present := true;
      ELSE
        -- Check if under frequency limit
        should_present := question_record.frequency_current < question_record.frequency_target;
      END IF;

      RETURN should_present;
    END;
    $$ LANGUAGE plpgsql;
  `,

  // Function to get questions that should be presented to customer
  GET_ELIGIBLE_QUESTIONS: `
    CREATE OR REPLACE FUNCTION get_eligible_questions(
      p_business_id UUID,
      p_store_id UUID DEFAULT NULL,
      p_current_time TIMESTAMPTZ DEFAULT NOW()
    )
    RETURNS TABLE(question_id UUID) AS $$
    BEGIN
      RETURN QUERY
      SELECT cq.id
      FROM custom_questions cq
      WHERE cq.business_id = p_business_id
        AND cq.is_active = true
        AND cq.status = 'active'
        AND (p_store_id IS NULL OR cq.store_id IS NULL OR cq.store_id = p_store_id)
        AND (cq.active_start_date IS NULL OR cq.active_start_date <= p_current_time::date)
        AND (cq.active_end_date IS NULL OR cq.active_end_date >= p_current_time::date)
        AND (cq.active_hours_start IS NULL OR cq.active_hours_start <= p_current_time::time)
        AND (cq.active_hours_end IS NULL OR cq.active_hours_end >= p_current_time::time)
        AND (cq.active_days_of_week IS NULL OR EXTRACT(DOW FROM p_current_time) = ANY(cq.active_days_of_week))
        AND check_question_frequency_limit(cq.id)
      ORDER BY
        CASE cq.priority
          WHEN 'high' THEN 3
          WHEN 'medium' THEN 2
          WHEN 'low' THEN 1
        END DESC,
        cq.created_at ASC;
    END;
    $$ LANGUAGE plpgsql;
  `
};

export default QuestionsDatabase;