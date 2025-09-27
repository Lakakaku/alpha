import { createClient } from '@supabase/supabase-js';
import type {
  QuestionResponse,
  QuestionAnalyticsSummary,
} from '@vocilia/types/src/questions';

export class QuestionResponseModel {
  constructor(private supabase: ReturnType<typeof createClient>) {}

  async create(data: {
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
    response_time_ms?: number;
  }): Promise<QuestionResponse> {
    const { data: response, error } = await this.supabase
      .from('question_responses')
      .insert({
        question_id: data.question_id,
        business_id: data.business_id,
        store_id: data.store_id,
        response_text: data.response_text,
        response_rating: data.response_rating,
        response_value: data.response_value,
        customer_session_id: data.customer_session_id,
        trigger_context: data.trigger_context,
        was_answered: data.was_answered,
        was_skipped: data.was_skipped,
        response_time_ms: data.response_time_ms,
        responded_at: data.was_answered ? new Date().toISOString() : null,
        created_at: new Date().toISOString(),
      })
      .select(`
        *,
        question:custom_questions(
          id,
          title,
          question_type
        ),
        business:businesses(
          id,
          business_name
        ),
        store:stores(
          id,
          store_name
        )
      `)
      .single();

    if (error) throw error;
    return response;
  }

  async findById(responseId: string): Promise<QuestionResponse | null> {
    const { data: response, error } = await this.supabase
      .from('question_responses')
      .select(`
        *,
        question:custom_questions(
          id,
          title,
          question_type,
          question_text,
          options
        ),
        business:businesses(
          id,
          business_name
        ),
        store:stores(
          id,
          store_name,
          address
        )
      `)
      .eq('id', responseId)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
    return response;
  }

  async findByQuestionId(
    questionId: string,
    params: {
      limit?: number;
      offset?: number;
      start_date?: string;
      end_date?: string;
      store_id?: string;
      was_answered?: boolean;
    } = {}
  ): Promise<{
    data: QuestionResponse[];
    count: number;
  }> {
    let query = this.supabase
      .from('question_responses')
      .select(`
        *,
        question:custom_questions(
          id,
          title,
          question_type
        ),
        business:businesses(
          id,
          business_name
        ),
        store:stores(
          id,
          store_name
        )
      `, { count: 'exact' })
      .eq('question_id', questionId);

    // Apply filters
    if (params.store_id) {
      query = query.eq('store_id', params.store_id);
    }
    if (params.was_answered !== undefined) {
      query = query.eq('was_answered', params.was_answered);
    }
    if (params.start_date) {
      query = query.gte('created_at', params.start_date);
    }
    if (params.end_date) {
      query = query.lte('created_at', params.end_date);
    }

    // Apply pagination
    const limit = params.limit || 50;
    const offset = params.offset || 0;
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;
    return { data: data || [], count: count || 0 };
  }

  async findByBusinessId(
    businessId: string,
    params: {
      limit?: number;
      offset?: number;
      start_date?: string;
      end_date?: string;
      store_id?: string;
      question_id?: string;
      was_answered?: boolean;
    } = {}
  ): Promise<{
    data: QuestionResponse[];
    count: number;
  }> {
    let query = this.supabase
      .from('question_responses')
      .select(`
        *,
        question:custom_questions(
          id,
          title,
          question_type,
          category:question_categories(
            id,
            name,
            color
          )
        ),
        business:businesses(
          id,
          business_name
        ),
        store:stores(
          id,
          store_name
        )
      `, { count: 'exact' })
      .eq('business_id', businessId);

    // Apply filters
    if (params.store_id) {
      query = query.eq('store_id', params.store_id);
    }
    if (params.question_id) {
      query = query.eq('question_id', params.question_id);
    }
    if (params.was_answered !== undefined) {
      query = query.eq('was_answered', params.was_answered);
    }
    if (params.start_date) {
      query = query.gte('created_at', params.start_date);
    }
    if (params.end_date) {
      query = query.lte('created_at', params.end_date);
    }

    // Apply pagination
    const limit = params.limit || 50;
    const offset = params.offset || 0;
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;
    return { data: data || [], count: count || 0 };
  }

  async getAnalyticsSummary(
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

  async getQuestionStats(questionId: string): Promise<{
    total_responses: number;
    answered_responses: number;
    skipped_responses: number;
    average_rating?: number;
    average_response_time_ms?: number;
    response_rate: number;
  }> {
    const { data: stats, error } = await this.supabase
      .from('question_responses')
      .select(`
        was_answered,
        was_skipped,
        response_rating,
        response_time_ms
      `)
      .eq('question_id', questionId);

    if (error) throw error;

    const responses = stats || [];
    const total_responses = responses.length;
    const answered_responses = responses.filter(r => r.was_answered).length;
    const skipped_responses = responses.filter(r => r.was_skipped).length;
    
    const ratings = responses
      .filter(r => r.response_rating !== null)
      .map(r => r.response_rating);
    const average_rating = ratings.length > 0
      ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
      : undefined;

    const response_times = responses
      .filter(r => r.response_time_ms !== null)
      .map(r => r.response_time_ms);
    const average_response_time_ms = response_times.length > 0
      ? response_times.reduce((sum, time) => sum + time, 0) / response_times.length
      : undefined;

    const response_rate = total_responses > 0
      ? (answered_responses / total_responses) * 100
      : 0;

    return {
      total_responses,
      answered_responses,
      skipped_responses,
      average_rating,
      average_response_time_ms,
      response_rate,
    };
  }

  async getBusinessStats(
    businessId: string,
    params: {
      start_date?: string;
      end_date?: string;
      store_id?: string;
    } = {}
  ): Promise<{
    total_responses: number;
    answered_responses: number;
    skipped_responses: number;
    response_rate: number;
    questions_with_responses: number;
    most_active_question?: {
      question_id: string;
      question_title: string;
      response_count: number;
    };
  }> {
    let query = this.supabase
      .from('question_responses')
      .select(`
        was_answered,
        was_skipped,
        question_id,
        question:custom_questions(
          id,
          title
        )
      `)
      .eq('business_id', businessId);

    // Apply filters
    if (params.store_id) {
      query = query.eq('store_id', params.store_id);
    }
    if (params.start_date) {
      query = query.gte('created_at', params.start_date);
    }
    if (params.end_date) {
      query = query.lte('created_at', params.end_date);
    }

    const { data: responses, error } = await query;

    if (error) throw error;

    const responseData = responses || [];
    const total_responses = responseData.length;
    const answered_responses = responseData.filter(r => r.was_answered).length;
    const skipped_responses = responseData.filter(r => r.was_skipped).length;
    const response_rate = total_responses > 0
      ? (answered_responses / total_responses) * 100
      : 0;

    // Count unique questions with responses
    const questionsWithResponses = new Set(responseData.map(r => r.question_id));
    const questions_with_responses = questionsWithResponses.size;

    // Find most active question
    const questionCounts = responseData.reduce((acc, response) => {
      const questionId = response.question_id;
      if (!acc[questionId]) {
        acc[questionId] = {
          count: 0,
          title: response.question?.title || 'Unknown Question',
        };
      }
      acc[questionId].count++;
      return acc;
    }, {} as Record<string, { count: number; title: string }>);

    const mostActive = Object.entries(questionCounts)
      .sort(([, a], [, b]) => b.count - a.count)[0];

    const most_active_question = mostActive
      ? {
          question_id: mostActive[0],
          question_title: mostActive[1].title,
          response_count: mostActive[1].count,
        }
      : undefined;

    return {
      total_responses,
      answered_responses,
      skipped_responses,
      response_rate,
      questions_with_responses,
      most_active_question,
    };
  }

  async deleteByQuestionId(questionId: string): Promise<void> {
    const { error } = await this.supabase
      .from('question_responses')
      .delete()
      .eq('question_id', questionId);

    if (error) throw error;
  }

  async exportResponses(
    businessId: string,
    params: {
      start_date?: string;
      end_date?: string;
      store_id?: string;
      question_id?: string;
      format?: 'csv' | 'json';
      include_personal_data?: boolean;
    } = {}
  ): Promise<{
    data: any[];
    total_count: number;
  }> {
    let query = this.supabase
      .from('question_responses')
      .select(`
        id,
        created_at,
        responded_at,
        was_answered,
        was_skipped,
        response_rating,
        response_time_ms,
        ${params.include_personal_data ? 'response_text, response_value,' : ''}
        question:custom_questions(
          id,
          title,
          question_type,
          category:question_categories(
            name
          )
        ),
        store:stores(
          id,
          store_name
        )
      `, { count: 'exact' })
      .eq('business_id', businessId);

    // Apply filters
    if (params.store_id) {
      query = query.eq('store_id', params.store_id);
    }
    if (params.question_id) {
      query = query.eq('question_id', params.question_id);
    }
    if (params.start_date) {
      query = query.gte('created_at', params.start_date);
    }
    if (params.end_date) {
      query = query.lte('created_at', params.end_date);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false });

    if (error) throw error;

    return {
      data: data || [],
      total_count: count || 0,
    };
  }

  async findRecentByCustomer(
    customerSessionId: string,
    questionId: string,
    withinHours: number = 24
  ): Promise<QuestionResponse[]> {
    const cutoffTime = new Date(Date.now() - withinHours * 60 * 60 * 1000).toISOString();

    const { data: responses, error } = await this.supabase
      .from('question_responses')
      .select('*')
      .eq('customer_session_id', customerSessionId)
      .eq('question_id', questionId)
      .gte('created_at', cutoffTime)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return responses || [];
  }

  async countResponsesInWindow(
    questionId: string,
    windowMinutes: number = 60
  ): Promise<number> {
    const cutoffTime = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

    const { count, error } = await this.supabase
      .from('question_responses')
      .select('*', { count: 'exact', head: true })
      .eq('question_id', questionId)
      .gte('created_at', cutoffTime);

    if (error) throw error;
    return count || 0;
  }
}

export default QuestionResponseModel;