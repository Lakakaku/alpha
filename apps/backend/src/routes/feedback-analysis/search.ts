/**
 * Feedback Analysis Search API Routes
 * Feature: 008-step-2-6
 * 
 * Provides natural language search capabilities for feedback analysis
 * with AI-powered query processing and comprehensive filtering.
 */

import express from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { SearchQueryService } from '@vocilia/database/feedback-analysis/search-queries';
import { SentimentAnalysisService } from '../../services/feedback-analysis/sentiment-analysis';
import { openaiService } from '../../config/openai';
import type { SearchRequest, SearchResponse } from '@vocilia/types/feedback-analysis';

const router = express.Router();

// Rate limiting - more restrictive for AI-powered endpoints
const searchRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Limit to 30 requests per minute per IP for search
  message: {
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'För många sökningar. Försök igen om en minut.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Validation schemas
const searchRequestSchema = z.object({
  query_text: z.string()
    .min(1, 'Söktext kan inte vara tom')
    .max(500, 'Söktext kan inte vara längre än 500 tecken')
    .trim(),
  limit: z.number()
    .int('Limit måste vara ett heltal')
    .min(1, 'Limit måste vara minst 1')
    .max(100, 'Limit kan inte vara större än 100')
    .default(20),
  departments: z.array(z.string())
    .optional()
    .refine((arr) => !arr || arr.length <= 10, 'Maximalt 10 avdelningar kan anges'),
  sentiment_filter: z.enum(['positive', 'negative', 'neutral', 'mixed', 'all'])
    .optional()
    .default('all'),
  date_range: z.object({
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Startdatum måste vara i format YYYY-MM-DD'),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Slutdatum måste vara i format YYYY-MM-DD'),
  }).optional().refine((range) => {
    if (!range) return true;
    const start = new Date(range.start_date);
    const end = new Date(range.end_date);
    const now = new Date();
    
    // Validate date range
    if (start > end) return false;
    if (start > now) return false;
    if (end > now) return false;
    
    // Maximum 1 year range
    const maxRange = 365 * 24 * 60 * 60 * 1000; // 1 year in ms
    return (end.getTime() - start.getTime()) <= maxRange;
  }, 'Ogiltigt datumintervall eller för stort intervall (max 1 år)'),
});

const storeIdSchema = z.string().uuid('Ogiltigt store ID format');

/**
 * POST /feedback-analysis/search/{storeId}
 * 
 * Search feedback using natural language queries with AI processing
 */
router.post('/search/:storeId', searchRateLimit, async (req, res) => {
  const startTime = Date.now();
  let searchLogId: string | undefined;

  try {
    // Validate store ID
    const storeIdResult = storeIdSchema.safeParse(req.params.storeId);
    if (!storeIdResult.success) {
      return res.status(400).json({
        code: 'INVALID_STORE_ID',
        message: storeIdResult.error.errors[0]?.message || 'Ogiltigt store ID',
      });
    }

    const storeId = storeIdResult.data;

    // Validate request body
    const requestResult = searchRequestSchema.safeParse(req.body);
    if (!requestResult.success) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: requestResult.error.errors[0]?.message || 'Ogiltiga sökparametrar',
        details: requestResult.error.errors,
      });
    }

    const searchRequest = requestResult.data;

    // Check store access (business ID should be set by auth middleware)
    const businessId = req.user?.businessId;
    if (!businessId) {
      return res.status(401).json({
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Autentisering krävs',
      });
    }

    // TODO: Validate store belongs to business (will be implemented with store access middleware)

    // Execute search with performance monitoring
    const searchStartTime = Date.now();
    
    const searchResponse: SearchResponse = await SearchQueryService.executeSearch(
      searchRequest,
      storeId,
      businessId,
      req.user?.id || 'anonymous'
    );

    const searchDuration = Date.now() - searchStartTime;
    const totalDuration = Date.now() - startTime;

    // Add performance headers
    res.set({
      'X-Search-Duration': searchDuration.toString(),
      'X-Total-Duration': totalDuration.toString(),
      'X-Search-Logged': searchResponse.search_query_id || 'false',
      'X-AI-Processed': searchResponse.ai_processed ? 'true' : 'false',
    });

    // Log performance warning if too slow
    if (searchDuration > 500) {
      console.warn(`Slow search query: ${searchDuration}ms for query "${searchRequest.query_text}"`);
    }

    // Set search log ID for analytics tracking
    searchLogId = searchResponse.search_query_id;

    return res.status(200).json(searchResponse);

  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.error('Search error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      storeId: req.params.storeId,
      query: req.body?.query_text,
      duration,
      searchLogId,
    });

    // Different error responses based on error type
    if (error instanceof Error) {
      if (error.message.includes('Store not found')) {
        return res.status(404).json({
          code: 'STORE_NOT_FOUND',
          message: 'Butik hittades inte',
        });
      }

      if (error.message.includes('Access denied')) {
        return res.status(403).json({
          code: 'STORE_ACCESS_DENIED',
          message: 'Åtkomst till butik nekad',
        });
      }

      if (error.message.includes('AI service unavailable')) {
        return res.status(503).json({
          code: 'AI_SERVICE_UNAVAILABLE',
          message: 'AI-tjänst temporärt otillgänglig. Försök igen senare.',
        });
      }

      if (error.message.includes('Rate limit')) {
        return res.status(429).json({
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'För många förfrågningar. Försök igen senare.',
        });
      }
    }

    return res.status(500).json({
      code: 'SEARCH_ERROR',
      message: 'Ett fel uppstod vid sökning. Försök igen.',
    });
  }
});

/**
 * GET /feedback-analysis/search/{storeId}/history
 * 
 * Get search history for analytics and user convenience
 */
router.get('/search/:storeId/history', async (req, res) => {
  try {
    // Validate store ID
    const storeIdResult = storeIdSchema.safeParse(req.params.storeId);
    if (!storeIdResult.success) {
      return res.status(400).json({
        code: 'INVALID_STORE_ID',
        message: storeIdResult.error.errors[0]?.message || 'Ogiltigt store ID',
      });
    }

    const storeId = storeIdResult.data;

    // Validate query parameters
    const limitSchema = z.coerce.number().int().min(1).max(50).default(10);
    const limit = limitSchema.parse(req.query.limit);

    // Check authentication
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Autentisering krävs',
      });
    }

    const history = await SearchQueryService.getSearchHistory(userId, storeId, limit);

    return res.status(200).json({
      history,
      total_count: history.length,
    });

  } catch (error) {
    console.error('Search history error:', error);
    return res.status(500).json({
      code: 'SEARCH_HISTORY_ERROR',
      message: 'Ett fel uppstod vid hämtning av sökhistorik',
    });
  }
});

/**
 * GET /feedback-analysis/search/{storeId}/popular-terms
 * 
 * Get popular search terms for autocomplete and suggestions
 */
router.get('/search/:storeId/popular-terms', async (req, res) => {
  try {
    // Validate store ID
    const storeIdResult = storeIdSchema.safeParse(req.params.storeId);
    if (!storeIdResult.success) {
      return res.status(400).json({
        code: 'INVALID_STORE_ID',
        message: storeIdResult.error.errors[0]?.message || 'Ogiltigt store ID',
      });
    }

    const storeId = storeIdResult.data;

    // Validate query parameters
    const daysSchema = z.coerce.number().int().min(1).max(90).default(30);
    const limitSchema = z.coerce.number().int().min(1).max(20).default(10);
    
    const days = daysSchema.parse(req.query.days);
    const limit = limitSchema.parse(req.query.limit);

    const popularTerms = await SearchQueryService.getPopularSearchTerms(storeId, days, limit);

    return res.status(200).json({
      popular_terms: popularTerms,
      period_days: days,
      total_count: popularTerms.length,
    });

  } catch (error) {
    console.error('Popular terms error:', error);
    return res.status(500).json({
      code: 'POPULAR_TERMS_ERROR',
      message: 'Ett fel uppstod vid hämtning av populära söktermer',
    });
  }
});

/**
 * POST /feedback-analysis/search/{storeId}/suggestions
 * 
 * Get AI-powered search suggestions based on partial query
 */
router.post('/search/:storeId/suggestions', searchRateLimit, async (req, res) => {
  try {
    // Validate store ID
    const storeIdResult = storeIdSchema.safeParse(req.params.storeId);
    if (!storeIdResult.success) {
      return res.status(400).json({
        code: 'INVALID_STORE_ID',
        message: storeIdResult.error.errors[0]?.message || 'Ogiltigt store ID',
      });
    }

    const storeId = storeIdResult.data;

    // Validate partial query
    const partialQuerySchema = z.object({
      partial_query: z.string().min(2).max(100).trim(),
      limit: z.number().int().min(1).max(10).default(5),
    });

    const bodyResult = partialQuerySchema.safeParse(req.body);
    if (!bodyResult.success) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: bodyResult.error.errors[0]?.message || 'Ogiltiga parametrar',
      });
    }

    const { partial_query, limit } = bodyResult.data;

    // Generate suggestions using AI with fallback
    let suggestions: string[] = [];
    let ai_generated = false;

    try {
      // Try AI-powered suggestions first
      const aiResponse = await openaiService.makeRequest(
        `Suggest ${limit} Swedish search query completions for partial query: "${partial_query}". Focus on retail/store feedback context. Return only JSON array of strings.`,
        'You are a search suggestion assistant for Swedish retail feedback. Return only a JSON array of suggested completions.',
        200
      );

      const parsed = JSON.parse(aiResponse);
      if (Array.isArray(parsed)) {
        suggestions = parsed.slice(0, limit);
        ai_generated = true;
      }
    } catch (aiError) {
      console.warn('AI suggestions failed, using fallback:', aiError);
    }

    // Fallback to popular terms if AI fails
    if (suggestions.length === 0) {
      const popularTerms = await SearchQueryService.getPopularSearchTerms(storeId, 30, 20);
      suggestions = popularTerms
        .filter(term => term.toLowerCase().includes(partial_query.toLowerCase()))
        .slice(0, limit);
    }

    return res.status(200).json({
      suggestions,
      ai_generated,
      partial_query,
    });

  } catch (error) {
    console.error('Search suggestions error:', error);
    return res.status(500).json({
      code: 'SUGGESTIONS_ERROR',
      message: 'Ett fel uppstod vid generering av sökförslag',
    });
  }
});

export default router;