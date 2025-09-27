import { createClient } from '@supabase/supabase-js';
import type {
  CustomQuestion,
  CreateQuestionRequest,
  UpdateQuestionRequest,
  QuestionsListParams,
} from '@vocilia/types/src/questions';

export class CustomQuestionModel {
  constructor(private supabase: ReturnType<typeof createClient>) {}

  async create(
    businessId: string,
    data: CreateQuestionRequest
  ): Promise<CustomQuestion> {
    const user = await this.supabase.auth.getUser();
    const userId = user.data.user?.id;

    const { data: question, error } = await this.supabase
      .from('custom_questions')
      .insert({
        business_id: businessId,
        title: data.title,
        question_text: data.question_text,
        question_type: data.question_type,
        category_id: data.category_id,
        store_id: data.store_id,
        options: data.options,
        required: data.required ?? true,
        priority: data.priority ?? 'medium',
        frequency_target: data.frequency_target ?? 100,
        frequency_window: data.frequency_window ?? 'daily',
        frequency_current: 0,
        frequency_reset_at: new Date().toISOString(),
        active_start_date: data.active_start_date,
        active_end_date: data.active_end_date,
        active_hours_start: data.active_hours_start,
        active_hours_end: data.active_hours_end,
        active_days_of_week: data.active_days_of_week,
        status: 'draft',
        is_active: false,
        created_by: userId,
        updated_by: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select(`
        *,
        category:question_categories(*)
      `)
      .single();

    if (error) throw error;
    return question;
  }

  async findById(questionId: string): Promise<CustomQuestion | null> {
    const { data: question, error } = await this.supabase
      .from('custom_questions')
      .select(`
        *,
        category:question_categories(*),
        triggers:question_triggers(*),
        business:businesses(id, business_name),
        store:stores(id, store_name, address)
      `)
      .eq('id', questionId)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
    return question;
  }

  async findMany(
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
        category:question_categories(*),
        business:businesses(id, business_name),
        store:stores(id, store_name, address)
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
    if (params.question_type) {
      query = query.eq('question_type', params.question_type);
    }
    if (params.search) {
      query = query.or(`title.ilike.%${params.search}%,question_text.ilike.%${params.search}%`);
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

  async update(
    questionId: string,
    data: UpdateQuestionRequest
  ): Promise<CustomQuestion> {
    const user = await this.supabase.auth.getUser();
    const userId = user.data.user?.id;

    const { data: question, error } = await this.supabase
      .from('custom_questions')
      .update({
        ...data,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', questionId)
      .select(`
        *,
        category:question_categories(*),
        business:businesses(id, business_name),
        store:stores(id, store_name, address)
      `)
      .single();

    if (error) throw error;
    return question;
  }

  async softDelete(questionId: string): Promise<void> {
    const user = await this.supabase.auth.getUser();
    const userId = user.data.user?.id;

    const { error } = await this.supabase
      .from('custom_questions')
      .update({
        status: 'archived',
        is_active: false,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', questionId);

    if (error) throw error;
  }

  async hardDelete(questionId: string): Promise<void> {
    const { error } = await this.supabase
      .from('custom_questions')
      .delete()
      .eq('id', questionId);

    if (error) throw error;
  }

  async activate(questionId: string): Promise<CustomQuestion> {
    const user = await this.supabase.auth.getUser();
    const userId = user.data.user?.id;

    const { data: question, error } = await this.supabase
      .from('custom_questions')
      .update({
        status: 'active',
        is_active: true,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', questionId)
      .select(`
        *,
        category:question_categories(*),
        business:businesses(id, business_name),
        store:stores(id, store_name, address)
      `)
      .single();

    if (error) throw error;
    return question;
  }

  async deactivate(questionId: string): Promise<CustomQuestion> {
    const user = await this.supabase.auth.getUser();
    const userId = user.data.user?.id;

    const { data: question, error } = await this.supabase
      .from('custom_questions')
      .update({
        status: 'inactive',
        is_active: false,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', questionId)
      .select(`
        *,
        category:question_categories(*),
        business:businesses(id, business_name),
        store:stores(id, store_name, address)
      `)
      .single();

    if (error) throw error;
    return question;
  }

  async findActive(
    businessId: string,
    storeId?: string
  ): Promise<CustomQuestion[]> {
    let query = this.supabase
      .from('custom_questions')
      .select(`
        *,
        category:question_categories(*),
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

  async countByBusiness(businessId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from('custom_questions')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .neq('status', 'archived');

    if (error) throw error;
    return count || 0;
  }

  async findByCategory(
    businessId: string,
    categoryId: string
  ): Promise<CustomQuestion[]> {
    const { data: questions, error } = await this.supabase
      .from('custom_questions')
      .select(`
        *,
        category:question_categories(*),
        business:businesses(id, business_name),
        store:stores(id, store_name, address)
      `)
      .eq('business_id', businessId)
      .eq('category_id', categoryId)
      .neq('status', 'archived')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return questions || [];
  }

  async incrementFrequency(questionId: string): Promise<void> {
    const { error } = await this.supabase.rpc('increment_question_frequency', {
      question_id: questionId,
    });

    if (error) throw error;
  }

  async resetFrequency(questionId: string): Promise<void> {
    const { error } = await this.supabase
      .from('custom_questions')
      .update({
        frequency_current: 0,
        frequency_reset_at: new Date().toISOString(),
      })
      .eq('id', questionId);

    if (error) throw error;
  }

  async checkFrequencyLimit(questionId: string): Promise<boolean> {
    const { data: result, error } = await this.supabase.rpc(
      'check_question_frequency_limit',
      { question_id: questionId }
    );

    if (error) throw error;
    return result || false;
  }

  async findEligible(
    businessId: string,
    storeId?: string,
    currentTime?: Date
  ): Promise<CustomQuestion[]> {
    const { data: questionIds, error } = await this.supabase.rpc(
      'get_eligible_questions',
      {
        p_business_id: businessId,
        p_store_id: storeId,
        p_current_time: currentTime?.toISOString() || new Date().toISOString(),
      }
    );

    if (error) throw error;

    if (!questionIds || questionIds.length === 0) {
      return [];
    }

    const ids = questionIds.map((row: { question_id: string }) => row.question_id);

    const { data: questions, error: questionsError } = await this.supabase
      .from('custom_questions')
      .select(`
        *,
        category:question_categories(*),
        triggers:question_triggers(*),
        business:businesses(id, business_name),
        store:stores(id, store_name, address)
      `)
      .in('id', ids);

    if (questionsError) throw questionsError;
    return questions || [];
  }
}

export default CustomQuestionModel;