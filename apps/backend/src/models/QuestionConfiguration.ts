import { QuestionConfiguration, QuestionPriority } from '@vocilia/types';
import { supabase } from '../config/supabase';

export class QuestionConfigurationModel {
  static async create(data: {
    business_id: string;
    question_text: string;
    frequency: number;
    priority: QuestionPriority;
    department_tags: string[];
    active_from?: string;
    active_until?: string;
    max_response_time?: number;
    follow_up_prompts?: string[];
  }): Promise<QuestionConfiguration> {
    const { data: config, error } = await supabase
      .from('question_configurations')
      .insert({
        ...data,
        is_active: true,
        max_response_time: data.max_response_time || 30,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create question configuration: ${error.message}`);
    }

    return config;
  }

  static async findById(id: string): Promise<QuestionConfiguration | null> {
    const { data: config, error } = await supabase
      .from('question_configurations')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to find question configuration: ${error.message}`);
    }

    return config;
  }

  static async findByBusinessId(businessId: string, options?: {
    active?: boolean;
    priority?: QuestionPriority;
    departmentTag?: string;
    limit?: number;
    offset?: number;
  }): Promise<QuestionConfiguration[]> {
    let query = supabase
      .from('question_configurations')
      .select('*')
      .eq('business_id', businessId)
      .order('priority', { ascending: false }) // High priority first
      .order('created_at', { ascending: false });

    if (options?.active !== undefined) {
      query = query.eq('is_active', options.active);
    }

    if (options?.priority) {
      query = query.eq('priority', options.priority);
    }

    if (options?.departmentTag) {
      query = query.contains('department_tags', [options.departmentTag]);
    }

    // Filter by active date range
    const now = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    query = query.or(`active_from.is.null,active_from.lte.${now}`)
                 .or(`active_until.is.null,active_until.gte.${now}`);

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }

    const { data: configs, error } = await query;

    if (error) {
      throw new Error(`Failed to find question configurations: ${error.message}`);
    }

    return configs || [];
  }

  static async findActiveByBusinessId(businessId: string): Promise<QuestionConfiguration[]> {
    return this.findByBusinessId(businessId, { active: true });
  }

  static async findByFrequency(businessId: string, customerCount: number): Promise<QuestionConfiguration[]> {
    const { data: configs, error } = await supabase
      .from('question_configurations')
      .select('*')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .lte('frequency', customerCount) // Questions due based on frequency
      .order('priority', { ascending: false });

    if (error) {
      throw new Error(`Failed to find questions by frequency: ${error.message}`);
    }

    // Filter questions where customerCount is divisible by frequency
    const dueQuestions = (configs || []).filter(config => 
      customerCount % config.frequency === 0
    );

    return dueQuestions;
  }

  static async findByDepartment(businessId: string, departmentTags: string[]): Promise<QuestionConfiguration[]> {
    const { data: configs, error } = await supabase
      .from('question_configurations')
      .select('*')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .overlaps('department_tags', departmentTags)
      .order('priority', { ascending: false });

    if (error) {
      throw new Error(`Failed to find questions by department: ${error.message}`);
    }

    return configs || [];
  }

  static async update(id: string, updates: Partial<QuestionConfiguration>): Promise<QuestionConfiguration> {
    const { data: config, error } = await supabase
      .from('question_configurations')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update question configuration: ${error.message}`);
    }

    return config;
  }

  static async setActive(id: string, isActive: boolean): Promise<QuestionConfiguration> {
    return this.update(id, { is_active: isActive });
  }

  static async updateFrequency(id: string, frequency: number): Promise<QuestionConfiguration> {
    if (frequency < 1 || frequency > 100) {
      throw new Error('Frequency must be between 1 and 100');
    }
    return this.update(id, { frequency });
  }

  static async updatePriority(id: string, priority: QuestionPriority): Promise<QuestionConfiguration> {
    return this.update(id, { priority });
  }

  static async updateDepartmentTags(id: string, departmentTags: string[]): Promise<QuestionConfiguration> {
    if (departmentTags.length === 0) {
      throw new Error('At least one department tag is required');
    }
    return this.update(id, { department_tags: departmentTags });
  }

  static async updateActivePeriod(id: string, activeFrom?: string, activeUntil?: string): Promise<QuestionConfiguration> {
    if (activeFrom && activeUntil && activeFrom > activeUntil) {
      throw new Error('Active from date must be before active until date');
    }
    return this.update(id, { active_from: activeFrom, active_until: activeUntil });
  }

  static async deleteById(id: string): Promise<void> {
    const { error } = await supabase
      .from('question_configurations')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete question configuration: ${error.message}`);
    }
  }

  static async getConfigurationStats(businessId: string): Promise<{
    totalConfigurations: number;
    activeConfigurations: number;
    highPriorityConfigurations: number;
    averageFrequency: number;
    departmentCoverage: string[];
  }> {
    const { data: configs, error } = await supabase
      .from('question_configurations')
      .select('is_active, priority, frequency, department_tags')
      .eq('business_id', businessId);

    if (error) {
      throw new Error(`Failed to get configuration stats: ${error.message}`);
    }

    const allConfigs = configs || [];
    const activeConfigs = allConfigs.filter(c => c.is_active);
    const highPriorityConfigs = allConfigs.filter(c => c.priority === 'high');
    
    const averageFrequency = allConfigs.length > 0 
      ? allConfigs.reduce((sum, c) => sum + c.frequency, 0) / allConfigs.length 
      : 0;

    const allDepartments = new Set<string>();
    allConfigs.forEach(config => {
      config.department_tags?.forEach((tag: string) => allDepartments.add(tag));
    });

    return {
      totalConfigurations: allConfigs.length,
      activeConfigurations: activeConfigs.length,
      highPriorityConfigurations: highPriorityConfigs.length,
      averageFrequency: Math.round(averageFrequency * 100) / 100,
      departmentCoverage: Array.from(allDepartments),
    };
  }

  static async findDuplicateQuestions(businessId: string, questionText: string): Promise<QuestionConfiguration[]> {
    const { data: configs, error } = await supabase
      .from('question_configurations')
      .select('*')
      .eq('business_id', businessId)
      .ilike('question_text', `%${questionText}%`);

    if (error) {
      throw new Error(`Failed to find duplicate questions: ${error.message}`);
    }

    return configs || [];
  }

  static async validateConfiguration(config: Partial<QuestionConfiguration>): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (config.question_text) {
      if (config.question_text.length < 10) {
        errors.push('Question text must be at least 10 characters long');
      }
      if (config.question_text.length > 500) {
        errors.push('Question text must be no more than 500 characters long');
      }
    }

    if (config.frequency !== undefined) {
      if (config.frequency < 1 || config.frequency > 100) {
        errors.push('Frequency must be between 1 and 100');
      }
    }

    if (config.max_response_time !== undefined) {
      if (config.max_response_time < 10 || config.max_response_time > 60) {
        errors.push('Max response time must be between 10 and 60 seconds');
      }
    }

    if (config.department_tags) {
      if (config.department_tags.length === 0) {
        errors.push('At least one department tag is required');
      }
    }

    if (config.active_from && config.active_until) {
      if (config.active_from > config.active_until) {
        errors.push('Active from date must be before active until date');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  static async findExpiringSoon(businessId: string, daysAhead: number = 7): Promise<QuestionConfiguration[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);
    const futureDateStr = futureDate.toISOString().split('T')[0];

    const { data: configs, error } = await supabase
      .from('question_configurations')
      .select('*')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .not('active_until', 'is', null)
      .lte('active_until', futureDateStr);

    if (error) {
      throw new Error(`Failed to find expiring configurations: ${error.message}`);
    }

    return configs || [];
  }
}