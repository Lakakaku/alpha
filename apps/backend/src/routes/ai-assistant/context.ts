import { Router } from 'express';
import { supabase } from '../../config/supabase';
import { authenticateRequest } from '../../middleware/auth';
import { validateStoreAccess } from '../../middleware/store-access';
import { validationScoringService } from '../../services/validation-scoring';
import { contextExtractionService } from '../../services/context-extraction';

const router = Router();

router.use(authenticateRequest);

router.get('/entries', async (req, res) => {
  try {
    const { store_id, category, limit = 100, offset = 0 } = req.query;
    const businessId = req.user.businessId;

    if (!store_id) {
      return res.status(400).json({
        error: 'Missing required parameter: store_id'
      });
    }

    await validateStoreAccess(businessId, store_id as string);

    let query = supabase
      .from('context_entries')
      .select('*')
      .eq('store_id', store_id)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (category) {
      query = query.eq('category', category);
    }

    const { data: entries, error } = await query;

    if (error) {
      console.error('Error fetching context entries:', error);
      return res.status(500).json({
        error: 'Failed to fetch context entries'
      });
    }

    const grouped = (entries || []).reduce((acc, entry) => {
      if (!acc[entry.category]) {
        acc[entry.category] = [];
      }
      acc[entry.category].push(entry);
      return acc;
    }, {} as Record<string, any[]>);

    res.json({
      entries: entries || [],
      grouped,
      total: entries?.length || 0
    });
  } catch (error) {
    console.error('Context entries fetch error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

router.post('/entries', async (req, res) => {
  try {
    const { store_id, category, type, content, metadata = {} } = req.body;
    const businessId = req.user.businessId;

    if (!store_id || !category || !type || !content) {
      return res.status(400).json({
        error: 'Missing required fields: store_id, category, type, content'
      });
    }

    await validateStoreAccess(businessId, store_id);

    const { data: existingEntries } = await supabase
      .from('context_entries')
      .select('*')
      .eq('store_id', store_id);

    const newEntry = {
      id: `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      store_id,
      category: category.toLowerCase().trim(),
      type: type.toLowerCase().trim(),
      content: content.trim(),
      confidence: 1.0,
      metadata,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const validation = await validationScoringService.validateContextEntry(
      newEntry as any,
      existingEntries || []
    );

    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Invalid context entry',
        issues: validation.issues,
        suggestions: validation.suggestions
      });
    }

    const { data: savedEntry, error } = await supabase
      .from('context_entries')
      .insert(newEntry)
      .select()
      .single();

    if (error) {
      console.error('Error saving context entry:', error);
      return res.status(500).json({
        error: 'Failed to save context entry'
      });
    }

    const updatedScore = await validationScoringService.calculateContextScore(
      store_id,
      [...(existingEntries || []), savedEntry]
    );

    res.status(201).json({
      entry: savedEntry,
      validation: {
        isValid: validation.isValid,
        suggestions: validation.suggestions
      },
      contextScore: updatedScore.overallScore
    });
  } catch (error) {
    console.error('Context entry creation error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

router.get('/entries/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const businessId = req.user.businessId;

    const { data: entry, error } = await supabase
      .from('context_entries')
      .select(`
        *,
        stores!inner(business_id)
      `)
      .eq('id', id)
      .eq('stores.business_id', businessId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          error: 'Context entry not found'
        });
      }
      console.error('Error fetching context entry:', error);
      return res.status(500).json({
        error: 'Failed to fetch context entry'
      });
    }

    res.json({
      entry
    });
  } catch (error) {
    console.error('Context entry fetch error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

router.put('/entries/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { category, type, content, metadata } = req.body;
    const businessId = req.user.businessId;

    if (!category && !type && !content && !metadata) {
      return res.status(400).json({
        error: 'At least one field must be provided for update'
      });
    }

    const { data: existingEntry, error: fetchError } = await supabase
      .from('context_entries')
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
          error: 'Context entry not found'
        });
      }
      console.error('Error fetching context entry:', fetchError);
      return res.status(500).json({
        error: 'Failed to fetch context entry'
      });
    }

    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (category) updateData.category = category.toLowerCase().trim();
    if (type) updateData.type = type.toLowerCase().trim();
    if (content) updateData.content = content.trim();
    if (metadata) updateData.metadata = metadata;

    const { data: allEntries } = await supabase
      .from('context_entries')
      .select('*')
      .eq('store_id', existingEntry.store_id);

    const otherEntries = (allEntries || []).filter(e => e.id !== id);
    const updatedEntry = { ...existingEntry, ...updateData };

    const validation = await validationScoringService.validateContextEntry(
      updatedEntry as any,
      otherEntries
    );

    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Invalid context entry update',
        issues: validation.issues,
        suggestions: validation.suggestions
      });
    }

    const { data: savedEntry, error: updateError } = await supabase
      .from('context_entries')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating context entry:', updateError);
      return res.status(500).json({
        error: 'Failed to update context entry'
      });
    }

    const updatedAllEntries = otherEntries.map(e => e.id === id ? savedEntry : e);
    const updatedScore = await validationScoringService.calculateContextScore(
      existingEntry.store_id,
      updatedAllEntries
    );

    res.json({
      entry: savedEntry,
      validation: {
        isValid: validation.isValid,
        suggestions: validation.suggestions
      },
      contextScore: updatedScore.overallScore
    });
  } catch (error) {
    console.error('Context entry update error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

router.delete('/entries/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const businessId = req.user.businessId;

    const { data: entry, error: fetchError } = await supabase
      .from('context_entries')
      .select(`
        store_id,
        stores!inner(business_id)
      `)
      .eq('id', id)
      .eq('stores.business_id', businessId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({
          error: 'Context entry not found'
        });
      }
      console.error('Error fetching context entry:', fetchError);
      return res.status(500).json({
        error: 'Failed to fetch context entry'
      });
    }

    const { error: deleteError } = await supabase
      .from('context_entries')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting context entry:', deleteError);
      return res.status(500).json({
        error: 'Failed to delete context entry'
      });
    }

    const { data: remainingEntries } = await supabase
      .from('context_entries')
      .select('*')
      .eq('store_id', entry.store_id);

    const updatedScore = await validationScoringService.calculateContextScore(
      entry.store_id,
      remainingEntries || []
    );

    res.json({
      success: true,
      contextScore: updatedScore.overallScore
    });
  } catch (error) {
    console.error('Context entry deletion error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

router.post('/extract', async (req, res) => {
  try {
    const { store_id, message } = req.body;
    const businessId = req.user.businessId;

    if (!store_id || !message) {
      return res.status(400).json({
        error: 'Missing required fields: store_id, message'
      });
    }

    await validateStoreAccess(businessId, store_id);

    const { data: existingContext } = await supabase
      .from('context_entries')
      .select('*')
      .eq('store_id', store_id);

    const extractionResult = await contextExtractionService.extractContextFromMessage(
      message,
      store_id,
      existingContext || []
    );

    res.json({
      extracted: extractionResult.extracted,
      suggestions: extractionResult.suggestions,
      gaps: extractionResult.gaps
    });
  } catch (error) {
    console.error('Context extraction error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

export default router;