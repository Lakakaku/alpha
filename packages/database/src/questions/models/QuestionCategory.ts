import { createClient } from '@supabase/supabase-js';
import type {
  QuestionCategory,
  CreateCategoryRequest,
} from '@vocilia/types/src/questions';

export class QuestionCategoryModel {
  constructor(private supabase: ReturnType<typeof createClient>) {}

  async create(
    businessId: string,
    data: CreateCategoryRequest
  ): Promise<QuestionCategory> {
    const { data: category, error } = await this.supabase
      .from('question_categories')
      .insert({
        business_id: businessId,
        name: data.name,
        description: data.description,
        color: data.color ?? '#6366f1',
        icon: data.icon,
        sort_order: data.sort_order ?? 0,
        is_default: data.is_default ?? false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error) throw error;
    return category;
  }

  async findById(categoryId: string): Promise<QuestionCategory | null> {
    const { data: category, error } = await this.supabase
      .from('question_categories')
      .select(`
        *,
        questions:custom_questions(count)
      `)
      .eq('id', categoryId)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
    return category;
  }

  async findMany(businessId: string): Promise<QuestionCategory[]> {
    const { data: categories, error } = await this.supabase
      .from('question_categories')
      .select(`
        *,
        questions:custom_questions(count)
      `)
      .eq('business_id', businessId)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;
    return categories || [];
  }

  async findManyWithStats(businessId: string): Promise<(QuestionCategory & {
    question_count: number;
    active_question_count: number;
    response_count: number;
  })[]> {
    const { data: categories, error } = await this.supabase
      .from('question_categories')
      .select(`
        *,
        questions:custom_questions(
          id,
          status,
          is_active,
          responses:question_responses(count)
        )
      `)
      .eq('business_id', businessId)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;

    // Calculate statistics for each category
    return (categories || []).map(category => {
      const questions = category.questions || [];
      const question_count = questions.length;
      const active_question_count = questions.filter(
        (q: any) => q.is_active && q.status === 'active'
      ).length;
      const response_count = questions.reduce(
        (total: number, q: any) => total + (q.responses?.[0]?.count || 0),
        0
      );

      return {
        ...category,
        question_count,
        active_question_count,
        response_count,
      };
    });
  }

  async update(
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

  async delete(categoryId: string): Promise<void> {
    // First check if category has associated questions
    const { count: questionCount, error: countError } = await this.supabase
      .from('custom_questions')
      .select('*', { count: 'exact', head: true })
      .eq('category_id', categoryId)
      .neq('status', 'archived');

    if (countError) throw countError;

    if (questionCount && questionCount > 0) {
      throw new Error(
        `Cannot delete category: ${questionCount} questions are still using this category. Please move or delete those questions first.`
      );
    }

    const { error } = await this.supabase
      .from('question_categories')
      .delete()
      .eq('id', categoryId);

    if (error) throw error;
  }

  async updateSortOrders(
    businessId: string,
    categoryOrders: { id: string; sort_order: number }[]
  ): Promise<void> {
    const promises = categoryOrders.map(({ id, sort_order }) =>
      this.supabase
        .from('question_categories')
        .update({
          sort_order,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('business_id', businessId)
    );

    const results = await Promise.all(promises);
    
    for (const result of results) {
      if (result.error) throw result.error;
    }
  }

  async findDefault(businessId: string): Promise<QuestionCategory | null> {
    const { data: category, error } = await this.supabase
      .from('question_categories')
      .select('*')
      .eq('business_id', businessId)
      .eq('is_default', true)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
    return category;
  }

  async setDefault(categoryId: string, businessId: string): Promise<void> {
    // First, unset any existing default
    await this.supabase
      .from('question_categories')
      .update({
        is_default: false,
        updated_at: new Date().toISOString(),
      })
      .eq('business_id', businessId)
      .eq('is_default', true);

    // Then set the new default
    const { error } = await this.supabase
      .from('question_categories')
      .update({
        is_default: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', categoryId)
      .eq('business_id', businessId);

    if (error) throw error;
  }

  async findByName(
    businessId: string,
    name: string
  ): Promise<QuestionCategory | null> {
    const { data: category, error } = await this.supabase
      .from('question_categories')
      .select('*')
      .eq('business_id', businessId)
      .ilike('name', name)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
    return category;
  }

  async count(businessId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from('question_categories')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId);

    if (error) throw error;
    return count || 0;
  }

  async createDefaultCategories(businessId: string): Promise<QuestionCategory[]> {
    const defaultCategories = [
      {
        name: 'Service Quality',
        description: 'Questions about the quality of service provided',
        color: '#6366f1',
        icon: 'star',
        sort_order: 1,
        is_default: true,
      },
      {
        name: 'Product Feedback',
        description: 'Questions about specific products or offerings',
        color: '#10b981',
        icon: 'shopping-bag',
        sort_order: 2,
        is_default: false,
      },
      {
        name: 'Overall Experience',
        description: 'Questions about the general customer experience',
        color: '#f59e0b',
        icon: 'heart',
        sort_order: 3,
        is_default: false,
      },
      {
        name: 'Suggestions',
        description: 'Questions asking for customer suggestions and improvements',
        color: '#8b5cf6',
        icon: 'lightbulb',
        sort_order: 4,
        is_default: false,
      },
    ];

    const promises = defaultCategories.map(category =>
      this.create(businessId, category)
    );

    const results = await Promise.all(promises);
    return results;
  }

  async duplicateCategory(
    categoryId: string,
    newName: string,
    businessId: string
  ): Promise<QuestionCategory> {
    // Get the original category
    const original = await this.findById(categoryId);
    if (!original) {
      throw new Error('Category not found');
    }

    // Create a duplicate with the new name
    const { data: duplicate, error } = await this.supabase
      .from('question_categories')
      .insert({
        business_id: businessId,
        name: newName,
        description: original.description,
        color: original.color,
        icon: original.icon,
        sort_order: original.sort_order + 1,
        is_default: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error) throw error;
    return duplicate;
  }
}

export default QuestionCategoryModel;