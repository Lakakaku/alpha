import { createClient } from '@supabase/supabase-js';
import type {
  QuestionTrigger,
  CreateTriggerRequest,
} from '@vocilia/types/src/questions';

export class QuestionTriggerModel {
  constructor(private supabase: ReturnType<typeof createClient>) {}

  async create(
    questionId: string,
    data: CreateTriggerRequest
  ): Promise<QuestionTrigger> {
    const { data: trigger, error } = await this.supabase
      .from('question_triggers')
      .insert({
        question_id: questionId,
        trigger_type: data.trigger_type,
        conditions: data.conditions,
        is_enabled: data.is_enabled ?? true,
        priority: data.priority ?? 'medium',
        cooldown_period: data.cooldown_period,
        max_activations: data.max_activations,
        current_activations: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error) throw error;
    return trigger;
  }

  async findById(triggerId: string): Promise<QuestionTrigger | null> {
    const { data: trigger, error } = await this.supabase
      .from('question_triggers')
      .select(`
        *,
        question:custom_questions(
          id,
          title,
          business_id,
          store_id
        )
      `)
      .eq('id', triggerId)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
    return trigger;
  }

  async findByQuestionId(questionId: string): Promise<QuestionTrigger[]> {
    const { data: triggers, error } = await this.supabase
      .from('question_triggers')
      .select('*')
      .eq('question_id', questionId)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) throw error;
    return triggers || [];
  }

  async findEnabled(questionId: string): Promise<QuestionTrigger[]> {
    const { data: triggers, error } = await this.supabase
      .from('question_triggers')
      .select('*')
      .eq('question_id', questionId)
      .eq('is_enabled', true)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) throw error;
    return triggers || [];
  }

  async update(
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

  async delete(triggerId: string): Promise<void> {
    const { error } = await this.supabase
      .from('question_triggers')
      .delete()
      .eq('id', triggerId);

    if (error) throw error;
  }

  async enable(triggerId: string): Promise<QuestionTrigger> {
    const { data: trigger, error } = await this.supabase
      .from('question_triggers')
      .update({
        is_enabled: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', triggerId)
      .select('*')
      .single();

    if (error) throw error;
    return trigger;
  }

  async disable(triggerId: string): Promise<QuestionTrigger> {
    const { data: trigger, error } = await this.supabase
      .from('question_triggers')
      .update({
        is_enabled: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', triggerId)
      .select('*')
      .single();

    if (error) throw error;
    return trigger;
  }

  async incrementActivation(triggerId: string): Promise<void> {
    const { error } = await this.supabase.rpc('increment_trigger_activation', {
      trigger_id: triggerId,
    });

    if (error) throw error;
  }

  async resetActivations(triggerId: string): Promise<void> {
    const { error } = await this.supabase
      .from('question_triggers')
      .update({
        current_activations: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', triggerId);

    if (error) throw error;
  }

  async checkCooldown(triggerId: string): Promise<boolean> {
    const trigger = await this.findById(triggerId);
    if (!trigger || !trigger.cooldown_period) {
      return true; // No cooldown means always ready
    }

    const { data: lastActivation, error } = await this.supabase
      .from('question_trigger_activations')
      .select('activated_at')
      .eq('trigger_id', triggerId)
      .order('activated_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    if (!lastActivation) {
      return true; // No previous activation
    }

    const cooldownMs = trigger.cooldown_period * 60 * 1000; // Convert minutes to milliseconds
    const timeSinceLastActivation = Date.now() - new Date(lastActivation.activated_at).getTime();
    
    return timeSinceLastActivation >= cooldownMs;
  }

  async checkMaxActivations(triggerId: string): Promise<boolean> {
    const trigger = await this.findById(triggerId);
    if (!trigger || !trigger.max_activations) {
      return true; // No limit means always allowed
    }

    return trigger.current_activations < trigger.max_activations;
  }

  async evaluateConditions(
    triggerId: string,
    context: {
      customerData?: Record<string, any>;
      storeData?: Record<string, any>;
      timeContext?: {
        currentTime: Date;
        dayOfWeek: number;
        hour: number;
      };
      sessionData?: Record<string, any>;
    }
  ): Promise<boolean> {
    const trigger = await this.findById(triggerId);
    if (!trigger || !trigger.conditions) {
      return true; // No conditions means always triggered
    }

    try {
      return this.evaluateConditionTree(trigger.conditions, context);
    } catch (error) {
      console.error('Error evaluating trigger conditions:', error);
      return false; // Fail safe - don't trigger on evaluation error
    }
  }

  private evaluateConditionTree(
    conditions: any,
    context: Record<string, any>
  ): boolean {
    if (!conditions || typeof conditions !== 'object') {
      return true;
    }

    // Handle logical operators
    if (conditions.and) {
      return conditions.and.every((condition: any) =>
        this.evaluateConditionTree(condition, context)
      );
    }

    if (conditions.or) {
      return conditions.or.some((condition: any) =>
        this.evaluateConditionTree(condition, context)
      );
    }

    if (conditions.not) {
      return !this.evaluateConditionTree(conditions.not, context);
    }

    // Handle individual conditions
    return this.evaluateCondition(conditions, context);
  }

  private evaluateCondition(
    condition: any,
    context: Record<string, any>
  ): boolean {
    const { field, operator, value } = condition;
    const actualValue = this.getNestedValue(context, field);

    switch (operator) {
      case 'equals':
        return actualValue === value;
      case 'not_equals':
        return actualValue !== value;
      case 'greater_than':
        return typeof actualValue === 'number' && actualValue > value;
      case 'less_than':
        return typeof actualValue === 'number' && actualValue < value;
      case 'greater_than_or_equal':
        return typeof actualValue === 'number' && actualValue >= value;
      case 'less_than_or_equal':
        return typeof actualValue === 'number' && actualValue <= value;
      case 'contains':
        return typeof actualValue === 'string' && actualValue.includes(value);
      case 'not_contains':
        return typeof actualValue === 'string' && !actualValue.includes(value);
      case 'starts_with':
        return typeof actualValue === 'string' && actualValue.startsWith(value);
      case 'ends_with':
        return typeof actualValue === 'string' && actualValue.endsWith(value);
      case 'in':
        return Array.isArray(value) && value.includes(actualValue);
      case 'not_in':
        return Array.isArray(value) && !value.includes(actualValue);
      case 'exists':
        return actualValue !== undefined && actualValue !== null;
      case 'not_exists':
        return actualValue === undefined || actualValue === null;
      case 'regex':
        return typeof actualValue === 'string' && new RegExp(value).test(actualValue);
      default:
        console.warn(`Unknown condition operator: ${operator}`);
        return false;
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  async findByBusinessId(businessId: string): Promise<QuestionTrigger[]> {
    const { data: triggers, error } = await this.supabase
      .from('question_triggers')
      .select(`
        *,
        question:custom_questions!inner(
          id,
          title,
          business_id,
          store_id
        )
      `)
      .eq('question.business_id', businessId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return triggers || [];
  }

  async findByType(
    questionId: string,
    triggerType: string
  ): Promise<QuestionTrigger[]> {
    const { data: triggers, error } = await this.supabase
      .from('question_triggers')
      .select('*')
      .eq('question_id', questionId)
      .eq('trigger_type', triggerType)
      .eq('is_enabled', true)
      .order('priority', { ascending: false });

    if (error) throw error;
    return triggers || [];
  }

  async recordActivation(
    triggerId: string,
    context?: Record<string, any>
  ): Promise<void> {
    const { error } = await this.supabase
      .from('question_trigger_activations')
      .insert({
        trigger_id: triggerId,
        activated_at: new Date().toISOString(),
        context: context || {},
      });

    if (error) throw error;

    // Increment the activation counter
    await this.incrementActivation(triggerId);
  }

  async getActivationHistory(
    triggerId: string,
    limit: number = 50
  ): Promise<Array<{
    id: string;
    activated_at: string;
    context: Record<string, any>;
  }>> {
    const { data: activations, error } = await this.supabase
      .from('question_trigger_activations')
      .select('id, activated_at, context')
      .eq('trigger_id', triggerId)
      .order('activated_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return activations || [];
  }

  async duplicateTrigger(
    triggerId: string,
    newQuestionId: string
  ): Promise<QuestionTrigger> {
    const original = await this.findById(triggerId);
    if (!original) {
      throw new Error('Trigger not found');
    }

    const { data: duplicate, error } = await this.supabase
      .from('question_triggers')
      .insert({
        question_id: newQuestionId,
        trigger_type: original.trigger_type,
        conditions: original.conditions,
        is_enabled: original.is_enabled,
        priority: original.priority,
        cooldown_period: original.cooldown_period,
        max_activations: original.max_activations,
        current_activations: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error) throw error;
    return duplicate;
  }
}

export default QuestionTriggerModel;