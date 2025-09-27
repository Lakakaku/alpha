import { Router } from 'express';
import { supabase } from '../../config/supabase';
import { authenticateRequest } from '../../middleware/auth';
import { validateStoreAccess } from '../../middleware/store-access';
import { validationScoringService } from '../../services/validation-scoring';
import { contextExtractionService } from '../../services/context-extraction';

const router = Router();

router.use(authenticateRequest);

router.get('/score', async (req, res) => {
  try {
    const { store_id, recalculate = false } = req.query;
    const businessId = req.user.businessId;

    if (!store_id) {
      return res.status(400).json({
        error: 'Missing required parameter: store_id'
      });
    }

    await validateStoreAccess(businessId, store_id as string);

    if (!recalculate) {
      const { data: existingResult } = await supabase
        .from('validation_results')
        .select('*')
        .eq('store_id', store_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (existingResult) {
        const isRecent = new Date(existingResult.created_at).getTime() > Date.now() - (5 * 60 * 1000);
        if (isRecent) {
          return res.json({
            validation: existingResult,
            cached: true
          });
        }
      }
    }

    const { data: contextEntries } = await supabase
      .from('context_entries')
      .select('*')
      .eq('store_id', store_id);

    const validationResult = await validationScoringService.calculateContextScore(
      store_id as string,
      contextEntries || []
    );

    const savedResult = {
      store_id,
      overall_score: validationResult.overallScore,
      category_scores: validationResult.categoryScores,
      missing_fields: validationResult.missingFields,
      recommendations: validationResult.recommendations,
      completion_level: validationResult.completionLevel,
      metadata: {
        entries_analyzed: contextEntries?.length || 0,
        calculation_timestamp: new Date().toISOString()
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: saved, error } = await supabase
      .from('validation_results')
      .insert(savedResult)
      .select()
      .single();

    if (error) {
      console.error('Error saving validation result:', error);
      return res.json({
        validation: validationResult,
        cached: false,
        warning: 'Could not save validation result'
      });
    }

    res.json({
      validation: saved,
      cached: false
    });
  } catch (error) {
    console.error('Validation scoring error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

router.get('/history', async (req, res) => {
  try {
    const { store_id, limit = 10, offset = 0 } = req.query;
    const businessId = req.user.businessId;

    if (!store_id) {
      return res.status(400).json({
        error: 'Missing required parameter: store_id'
      });
    }

    await validateStoreAccess(businessId, store_id as string);

    const { data: results, error } = await supabase
      .from('validation_results')
      .select('*')
      .eq('store_id', store_id)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (error) {
      console.error('Error fetching validation history:', error);
      return res.status(500).json({
        error: 'Failed to fetch validation history'
      });
    }

    const scoreProgression = (results || []).map(result => ({
      date: result.created_at,
      score: result.overall_score,
      completion_level: result.completion_level
    }));

    res.json({
      results: results || [],
      progression: scoreProgression,
      total: results?.length || 0
    });
  } catch (error) {
    console.error('Validation history error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

router.post('/gaps', async (req, res) => {
  try {
    const { store_id } = req.body;
    const businessId = req.user.businessId;

    if (!store_id) {
      return res.status(400).json({
        error: 'Missing required field: store_id'
      });
    }

    await validateStoreAccess(businessId, store_id);

    const { data: contextEntries } = await supabase
      .from('context_entries')
      .select('*')
      .eq('store_id', store_id);

    const gaps = await contextExtractionService.identifyContextGaps(
      store_id,
      contextEntries || []
    );

    res.json({
      gaps,
      total: gaps.length
    });
  } catch (error) {
    console.error('Gap identification error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

router.post('/entry/validate', async (req, res) => {
  try {
    const { store_id, category, type, content } = req.body;
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

    const entryToValidate = {
      id: 'temp_validation_id',
      store_id,
      category: category.toLowerCase().trim(),
      type: type.toLowerCase().trim(),
      content: content.trim(),
      confidence: 1.0,
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const validation = await validationScoringService.validateContextEntry(
      entryToValidate as any,
      existingEntries || []
    );

    res.json({
      validation: {
        isValid: validation.isValid,
        issues: validation.issues,
        suggestions: validation.suggestions
      },
      entry: entryToValidate
    });
  } catch (error) {
    console.error('Entry validation error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

router.get('/stats/:storeId', async (req, res) => {
  try {
    const { storeId } = req.params;
    const businessId = req.user.businessId;

    await validateStoreAccess(businessId, storeId);

    const { data: contextEntries } = await supabase
      .from('context_entries')
      .select('category, created_at')
      .eq('store_id', storeId);

    const { data: latestValidation } = await supabase
      .from('validation_results')
      .select('overall_score, completion_level, category_scores')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const categoryBreakdown = (contextEntries || []).reduce((acc, entry) => {
      acc[entry.category] = (acc[entry.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const entriesThisWeek = (contextEntries || []).filter(entry => {
      const entryDate = new Date(entry.created_at);
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return entryDate >= weekAgo;
    }).length;

    res.json({
      stats: {
        totalEntries: contextEntries?.length || 0,
        entriesThisWeek,
        categoryBreakdown,
        currentScore: latestValidation?.overall_score || 0,
        completionLevel: latestValidation?.completion_level || 'incomplete',
        categoryScores: latestValidation?.category_scores || {}
      }
    });
  } catch (error) {
    console.error('Validation stats error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

export default router;