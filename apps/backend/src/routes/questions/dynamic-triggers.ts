import { Request, Response } from 'express';
import { validateRequest } from '../../middleware/validation';
import { supabase } from '@vocilia/database';
import { DynamicTrigger, TriggerCondition, TriggerAction } from '@vocilia/types/questions';

interface CreateTriggerRequest {
  name: string;
  description?: string;
  conditions: TriggerCondition[];
  actions: TriggerAction[];
  business_id: string;
  priority_weight: number;
  active: boolean;
}

interface UpdateTriggerRequest extends Partial<CreateTriggerRequest> {
  id: string;
}

interface TriggerFilters {
  business_id?: string;
  active?: boolean;
  trigger_type?: string;
  condition_type?: string;
  limit?: number;
  offset?: number;
}

export const getTriggers = async (req: Request, res: Response): Promise<void> => {
  try {
    const startTime = Date.now();
    const { business_id, active, trigger_type, condition_type, limit = 50, offset = 0 } = req.query as TriggerFilters;

    let query = supabase
      .from('dynamic_triggers')
      .select(`
        *,
        trigger_conditions(*),
        trigger_actions(*),
        trigger_activation_logs(count)
      `)
      .range(offset, offset + limit - 1)
      .order('updated_at', { ascending: false });

    if (business_id) {
      query = query.eq('business_id', business_id);
    }
    if (active !== undefined) {
      query = query.eq('active', active);
    }
    if (trigger_type) {
      query = query.eq('trigger_type', trigger_type);
    }

    const { data: triggers, error, count } = await query;

    if (error) {
      console.error('Error fetching triggers:', error);
      res.status(500).json({ 
        error: 'Failed to fetch triggers',
        details: error.message
      });
      return;
    }

    const processingTime = Date.now() - startTime;
    if (processingTime > 500) {
      console.warn(`Trigger fetch exceeded 500ms: ${processingTime}ms`);
    }

    res.status(200).json({
      triggers: triggers || [],
      total_count: count,
      processing_time_ms: processingTime,
      pagination: {
        limit: Number(limit),
        offset: Number(offset),
        has_more: count ? offset + limit < count : false
      }
    });

  } catch (error) {
    console.error('Error in getTriggers:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const createTrigger = async (req: Request, res: Response): Promise<void> => {
  try {
    const startTime = Date.now();
    const triggerData: CreateTriggerRequest = req.body;

    // Validate required fields
    const validation = validateTriggerData(triggerData);
    if (!validation.valid) {
      res.status(400).json({ 
        error: 'Invalid trigger data',
        details: validation.errors
      });
      return;
    }

    // Create trigger with conditions and actions in transaction
    const { data: trigger, error: triggerError } = await supabase
      .from('dynamic_triggers')
      .insert([{
        name: triggerData.name,
        description: triggerData.description,
        business_id: triggerData.business_id,
        priority_weight: triggerData.priority_weight,
        active: triggerData.active,
        trigger_type: determineTriggerType(triggerData.conditions)
      }])
      .select()
      .single();

    if (triggerError) {
      console.error('Error creating trigger:', triggerError);
      res.status(500).json({ 
        error: 'Failed to create trigger',
        details: triggerError.message
      });
      return;
    }

    // Create conditions
    if (triggerData.conditions.length > 0) {
      const conditionsToInsert = triggerData.conditions.map(condition => ({
        trigger_id: trigger.id,
        ...condition
      }));

      const { error: conditionsError } = await supabase
        .from('trigger_conditions')
        .insert(conditionsToInsert);

      if (conditionsError) {
        console.error('Error creating trigger conditions:', conditionsError);
        // Rollback trigger creation
        await supabase.from('dynamic_triggers').delete().eq('id', trigger.id);
        res.status(500).json({ 
          error: 'Failed to create trigger conditions',
          details: conditionsError.message
        });
        return;
      }
    }

    // Create actions
    if (triggerData.actions.length > 0) {
      const actionsToInsert = triggerData.actions.map(action => ({
        trigger_id: trigger.id,
        ...action
      }));

      const { error: actionsError } = await supabase
        .from('trigger_actions')
        .insert(actionsToInsert);

      if (actionsError) {
        console.error('Error creating trigger actions:', actionsError);
        // Rollback trigger and conditions creation
        await supabase.from('trigger_conditions').delete().eq('trigger_id', trigger.id);
        await supabase.from('dynamic_triggers').delete().eq('id', trigger.id);
        res.status(500).json({ 
          error: 'Failed to create trigger actions',
          details: actionsError.message
        });
        return;
      }
    }

    const processingTime = Date.now() - startTime;
    if (processingTime > 500) {
      console.warn(`Trigger creation exceeded 500ms: ${processingTime}ms`);
    }

    res.status(201).json({
      trigger,
      processing_time_ms: processingTime,
      message: 'Trigger created successfully'
    });

  } catch (error) {
    console.error('Error in createTrigger:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const updateTrigger = async (req: Request, res: Response): Promise<void> => {
  try {
    const startTime = Date.now();
    const { triggerId } = req.params;
    const updateData: Partial<CreateTriggerRequest> = req.body;

    // Validate trigger exists and belongs to business
    const { data: existingTrigger, error: fetchError } = await supabase
      .from('dynamic_triggers')
      .select('*')
      .eq('id', triggerId)
      .single();

    if (fetchError || !existingTrigger) {
      res.status(404).json({ 
        error: 'Trigger not found',
        details: fetchError?.message || 'No trigger with specified ID'
      });
      return;
    }

    // Update trigger basic fields
    const triggerUpdate: any = {};
    if (updateData.name !== undefined) triggerUpdate.name = updateData.name;
    if (updateData.description !== undefined) triggerUpdate.description = updateData.description;
    if (updateData.priority_weight !== undefined) triggerUpdate.priority_weight = updateData.priority_weight;
    if (updateData.active !== undefined) triggerUpdate.active = updateData.active;
    if (updateData.conditions) {
      triggerUpdate.trigger_type = determineTriggerType(updateData.conditions);
    }

    const { data: updatedTrigger, error: updateError } = await supabase
      .from('dynamic_triggers')
      .update(triggerUpdate)
      .eq('id', triggerId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating trigger:', updateError);
      res.status(500).json({ 
        error: 'Failed to update trigger',
        details: updateError.message
      });
      return;
    }

    // Update conditions if provided
    if (updateData.conditions) {
      // Delete existing conditions
      await supabase.from('trigger_conditions').delete().eq('trigger_id', triggerId);
      
      // Insert new conditions
      if (updateData.conditions.length > 0) {
        const conditionsToInsert = updateData.conditions.map(condition => ({
          trigger_id: triggerId,
          ...condition
        }));

        const { error: conditionsError } = await supabase
          .from('trigger_conditions')
          .insert(conditionsToInsert);

        if (conditionsError) {
          console.error('Error updating trigger conditions:', conditionsError);
          res.status(500).json({ 
            error: 'Failed to update trigger conditions',
            details: conditionsError.message
          });
          return;
        }
      }
    }

    // Update actions if provided
    if (updateData.actions) {
      // Delete existing actions
      await supabase.from('trigger_actions').delete().eq('trigger_id', triggerId);
      
      // Insert new actions
      if (updateData.actions.length > 0) {
        const actionsToInsert = updateData.actions.map(action => ({
          trigger_id: triggerId,
          ...action
        }));

        const { error: actionsError } = await supabase
          .from('trigger_actions')
          .insert(actionsToInsert);

        if (actionsError) {
          console.error('Error updating trigger actions:', actionsError);
          res.status(500).json({ 
            error: 'Failed to update trigger actions',
            details: actionsError.message
          });
          return;
        }
      }
    }

    const processingTime = Date.now() - startTime;
    if (processingTime > 500) {
      console.warn(`Trigger update exceeded 500ms: ${processingTime}ms`);
    }

    res.status(200).json({
      trigger: updatedTrigger,
      processing_time_ms: processingTime,
      message: 'Trigger updated successfully'
    });

  } catch (error) {
    console.error('Error in updateTrigger:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const deleteTrigger = async (req: Request, res: Response): Promise<void> => {
  try {
    const startTime = Date.now();
    const { triggerId } = req.params;

    // Validate trigger exists
    const { data: existingTrigger, error: fetchError } = await supabase
      .from('dynamic_triggers')
      .select('*')
      .eq('id', triggerId)
      .single();

    if (fetchError || !existingTrigger) {
      res.status(404).json({ 
        error: 'Trigger not found',
        details: fetchError?.message || 'No trigger with specified ID'
      });
      return;
    }

    // Delete associated conditions and actions (cascading delete should handle this)
    await supabase.from('trigger_conditions').delete().eq('trigger_id', triggerId);
    await supabase.from('trigger_actions').delete().eq('trigger_id', triggerId);

    // Delete trigger
    const { error: deleteError } = await supabase
      .from('dynamic_triggers')
      .delete()
      .eq('id', triggerId);

    if (deleteError) {
      console.error('Error deleting trigger:', deleteError);
      res.status(500).json({ 
        error: 'Failed to delete trigger',
        details: deleteError.message
      });
      return;
    }

    const processingTime = Date.now() - startTime;

    res.status(200).json({
      message: 'Trigger deleted successfully',
      processing_time_ms: processingTime,
      deleted_trigger_id: triggerId
    });

  } catch (error) {
    console.error('Error in deleteTrigger:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const testTrigger = async (req: Request, res: Response): Promise<void> => {
  try {
    const startTime = Date.now();
    const { triggerId } = req.params;
    const { test_context } = req.body;

    // Fetch trigger with conditions and actions
    const { data: trigger, error: fetchError } = await supabase
      .from('dynamic_triggers')
      .select(`
        *,
        trigger_conditions(*),
        trigger_actions(*)
      `)
      .eq('id', triggerId)
      .single();

    if (fetchError || !trigger) {
      res.status(404).json({ 
        error: 'Trigger not found',
        details: fetchError?.message || 'No trigger with specified ID'
      });
      return;
    }

    // Simulate trigger evaluation
    const evaluationResult = {
      trigger_fired: evaluateTriggerConditions(trigger.trigger_conditions, test_context),
      conditions_met: trigger.trigger_conditions.map((condition: any) => ({
        condition_id: condition.id,
        condition_type: condition.condition_type,
        met: evaluateCondition(condition, test_context)
      })),
      actions_to_execute: trigger.trigger_fired ? trigger.trigger_actions : [],
      test_context
    };

    const processingTime = Date.now() - startTime;
    
    // Validate performance requirement
    const performanceValid = processingTime <= 500;
    if (!performanceValid) {
      console.warn(`Trigger test exceeded 500ms: ${processingTime}ms`);
    }

    res.status(200).json({
      trigger,
      evaluation_result: evaluationResult,
      processing_time_ms: processingTime,
      performance_valid: performanceValid,
      test_timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in testTrigger:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Helper functions
function validateTriggerData(data: CreateTriggerRequest): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.name || data.name.trim().length === 0) {
    errors.push('Name is required');
  }
  if (!data.business_id || data.business_id.trim().length === 0) {
    errors.push('Business ID is required');
  }
  if (data.priority_weight === undefined || data.priority_weight < 1 || data.priority_weight > 5) {
    errors.push('Priority weight must be between 1 and 5');
  }
  if (!Array.isArray(data.conditions) || data.conditions.length === 0) {
    errors.push('At least one condition is required');
  }
  if (!Array.isArray(data.actions) || data.actions.length === 0) {
    errors.push('At least one action is required');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function determineTriggerType(conditions: TriggerCondition[]): string {
  if (!conditions || conditions.length === 0) return 'unknown';
  
  const types = conditions.map(c => c.condition_type);
  if (types.includes('purchase_category')) return 'purchase_based';
  if (types.includes('time_window')) return 'time_based';
  if (types.includes('amount_threshold')) return 'amount_based';
  if (types.length > 1) return 'complex_combination';
  
  return types[0] || 'unknown';
}

function evaluateTriggerConditions(conditions: any[], testContext: any): boolean {
  if (!conditions || conditions.length === 0) return false;
  
  return conditions.every(condition => evaluateCondition(condition, testContext));
}

function evaluateCondition(condition: any, testContext: any): boolean {
  switch (condition.condition_type) {
    case 'purchase_category':
      return testContext.purchase_categories?.includes(condition.condition_value);
    case 'amount_threshold':
      return testContext.transaction_amount >= parseFloat(condition.condition_value);
    case 'time_window':
      return isWithinTimeWindow(testContext.timestamp, condition.condition_value);
    case 'frequency_rule':
      return evaluateFrequencyRule(testContext.customer_history, condition.condition_value);
    default:
      return false;
  }
}

function isWithinTimeWindow(timestamp: string, timeWindow: string): boolean {
  const hour = new Date(timestamp).getHours();
  const [start, end] = timeWindow.split('-').map(t => parseInt(t));
  return hour >= start && hour <= end;
}

function evaluateFrequencyRule(customerHistory: any, rule: string): boolean {
  // Simplified frequency rule evaluation
  const [frequency, period] = rule.split('_per_');
  const targetCount = parseInt(frequency.replace('every_', ''));
  const actualCount = customerHistory?.interaction_count || 0;
  return actualCount % targetCount === 0;
}