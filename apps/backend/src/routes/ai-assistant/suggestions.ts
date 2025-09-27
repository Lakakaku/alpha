import { Router } from 'express';
import { supabase } from '../../config/supabase';
import { authenticateRequest } from '../../middleware/auth';
import { validateStoreAccess } from '../../middleware/store-access';
import { suggestionGenerationService } from '../../services/suggestion-generation';

const router = Router();

router.use(authenticateRequest);

router.get('/', async (req, res) => {
  try {
    const { store_id, status, type, limit = 20, offset = 0 } = req.query;
    const businessId = req.user.businessId;

    if (!store_id) {
      return res.status(400).json({
        error: 'Missing required parameter: store_id'
      });
    }

    await validateStoreAccess(businessId, store_id as string);

    let query = supabase
      .from('ai_suggestions')
      .select('*')
      .eq('store_id', store_id)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (status) {
      query = query.eq('status', status);
    }

    if (type) {
      query = query.eq('type', type);
    }

    const { data: suggestions, error } = await query;

    if (error) {
      console.error('Error fetching suggestions:', error);
      return res.status(500).json({
        error: 'Failed to fetch suggestions'
      });
    }

    const grouped = (suggestions || []).reduce((acc, suggestion) => {
      if (!acc[suggestion.priority]) {
        acc[suggestion.priority] = [];
      }
      acc[suggestion.priority].push(suggestion);
      return acc;
    }, {} as Record<string, any[]>);

    res.json({
      suggestions: suggestions || [],
      grouped,
      total: suggestions?.length || 0
    });
  } catch (error) {
    console.error('Suggestions fetch error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

router.post('/generate', async (req, res) => {
  try {
    const { store_id, context_type, user_goals = [] } = req.body;
    const businessId = req.user.businessId;

    if (!store_id) {
      return res.status(400).json({
        error: 'Missing required field: store_id'
      });
    }

    await validateStoreAccess(businessId, store_id);

    const { data: existingContext } = await supabase
      .from('context_entries')
      .select('*')
      .eq('store_id', store_id);

    const { data: validationResult } = await supabase
      .from('validation_results')
      .select('*')
      .eq('store_id', store_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const suggestions = await suggestionGenerationService.generateSuggestions({
      storeId: store_id,
      existingContext: existingContext || [],
      validationResult,
      userGoals
    });

    const savedSuggestions = [];
    for (const suggestion of suggestions) {
      const suggestionData = {
        store_id,
        type: suggestion.type,
        category: suggestion.category,
        title: suggestion.title,
        description: suggestion.description,
        priority: suggestion.priority,
        impact: suggestion.impact,
        status: 'pending',
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: saved, error } = await supabase
        .from('ai_suggestions')
        .insert(suggestionData)
        .select()
        .single();

      if (!error && saved) {
        savedSuggestions.push(saved);
      }
    }

    res.json({
      suggestions: savedSuggestions,
      generated: savedSuggestions.length
    });
  } catch (error) {
    console.error('Suggestion generation error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

router.post('/:id/accept', async (req, res) => {
  try {
    const { id } = req.params;
    const { implementation_notes } = req.body;
    const businessId = req.user.businessId;

    const { data: suggestion, error: fetchError } = await supabase
      .from('ai_suggestions')
      .select(`
        *,
        stores!inner(business_id)
      `)
      .eq('id', id)
      .eq('stores.business_id', businessId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({
          error: 'Suggestion not found'
        });
      }
      console.error('Error fetching suggestion:', fetchError);
      return res.status(500).json({
        error: 'Failed to fetch suggestion'
      });
    }

    if (suggestion.status !== 'pending') {
      return res.status(400).json({
        error: 'Suggestion has already been processed'
      });
    }

    const updateData = {
      status: 'accepted',
      metadata: {
        ...suggestion.metadata,
        accepted_at: new Date().toISOString(),
        implementation_notes: implementation_notes || null
      },
      updated_at: new Date().toISOString()
    };

    const { data: updatedSuggestion, error: updateError } = await supabase
      .from('ai_suggestions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating suggestion:', updateError);
      return res.status(500).json({
        error: 'Failed to accept suggestion'
      });
    }

    res.json({
      suggestion: updatedSuggestion,
      success: true
    });
  } catch (error) {
    console.error('Suggestion acceptance error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

router.post('/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { rejection_reason } = req.body;
    const businessId = req.user.businessId;

    const { data: suggestion, error: fetchError } = await supabase
      .from('ai_suggestions')
      .select(`
        *,
        stores!inner(business_id)
      `)
      .eq('id', id)
      .eq('stores.business_id', businessId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({
          error: 'Suggestion not found'
        });
      }
      console.error('Error fetching suggestion:', fetchError);
      return res.status(500).json({
        error: 'Failed to fetch suggestion'
      });
    }

    if (suggestion.status !== 'pending') {
      return res.status(400).json({
        error: 'Suggestion has already been processed'
      });
    }

    const updateData = {
      status: 'rejected',
      metadata: {
        ...suggestion.metadata,
        rejected_at: new Date().toISOString(),
        rejection_reason: rejection_reason || null
      },
      updated_at: new Date().toISOString()
    };

    const { data: updatedSuggestion, error: updateError } = await supabase
      .from('ai_suggestions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating suggestion:', updateError);
      return res.status(500).json({
        error: 'Failed to reject suggestion'
      });
    }

    res.json({
      suggestion: updatedSuggestion,
      success: true
    });
  } catch (error) {
    console.error('Suggestion rejection error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const businessId = req.user.businessId;

    const { data: suggestion, error: fetchError } = await supabase
      .from('ai_suggestions')
      .select(`
        id,
        stores!inner(business_id)
      `)
      .eq('id', id)
      .eq('stores.business_id', businessId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({
          error: 'Suggestion not found'
        });
      }
      console.error('Error fetching suggestion:', fetchError);
      return res.status(500).json({
        error: 'Failed to fetch suggestion'
      });
    }

    const { error: deleteError } = await supabase
      .from('ai_suggestions')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting suggestion:', deleteError);
      return res.status(500).json({
        error: 'Failed to delete suggestion'
      });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Suggestion deletion error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

export default router;