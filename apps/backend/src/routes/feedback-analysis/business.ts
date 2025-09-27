import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { BusinessIntelligenceService } from '../../services/feedback-analysis/businessIntelligenceService';
import { supabase } from '../../config/database';
import { AuthenticatedRequest } from '../../middleware/auth';

const router = Router();
const businessIntelligence = new BusinessIntelligenceService();

// Rate limiting: 10 requests per minute for report generation
const rateLimiter = require('../../middleware/rateLimiter')({ 
  windowMs: 60 * 1000, 
  max: 10,
  message: 'Too many report requests, try again later'
});

// POST /api/ai/business/reports/generate
router.post('/reports/generate',
  rateLimiter,
  [
    body('business_id').isUUID().withMessage('Valid business ID required'),
    body('store_ids').optional().isArray().withMessage('Store IDs must be an array'),
    body('store_ids.*').optional().isUUID().withMessage('Each store ID must be valid UUID'),
    body('start_date').isISO8601().withMessage('Valid start date required (ISO 8601)'),
    body('end_date').isISO8601().withMessage('Valid end date required (ISO 8601)'),
    body('report_type').isIn(['weekly', 'monthly', 'custom']).withMessage('Report type must be weekly, monthly, or custom'),
    body('include_recommendations').optional().isBoolean().withMessage('Include recommendations must be boolean'),
    body('include_trends').optional().isBoolean().withMessage('Include trends must be boolean')
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid request parameters',
          details: errors.array()
        });
      }

      const { 
        business_id, 
        store_ids, 
        start_date, 
        end_date, 
        report_type,
        include_recommendations = true,
        include_trends = true
      } = req.body;

      // Validate date range
      const startDate = new Date(start_date);
      const endDate = new Date(end_date);
      
      if (startDate >= endDate) {
        return res.status(400).json({
          error: 'INVALID_DATE_RANGE',
          message: 'Start date must be before end date'
        });
      }

      // Validate business access
      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .select('id, name')
        .eq('id', business_id)
        .eq('user_id', req.user.id)
        .single();

      if (businessError || !business) {
        return res.status(404).json({
          error: 'BUSINESS_NOT_FOUND',
          message: 'Business not found or access denied'
        });
      }

      // Generate report
      const report = await businessIntelligence.generateReport({
        businessId: business_id,
        storeIds: store_ids,
        startDate,
        endDate,
        reportType: report_type,
        includeRecommendations: include_recommendations,
        includeTrends: include_trends,
        userId: req.user.id
      });

      res.status(201).json({
        report_id: report.id,
        status: report.status,
        generated_at: report.generatedAt,
        expires_at: report.expiresAt,
        download_url: `/api/ai/business/reports/${report.id}`
      });

    } catch (error: any) {
      console.error('Report generation error:', error);
      
      if (error.code === 'INSUFFICIENT_DATA') {
        return res.status(422).json({
          error: 'INSUFFICIENT_DATA',
          message: 'Not enough feedback data for the specified period',
          minimum_required: error.minimumRequired
        });
      }

      res.status(500).json({
        error: 'REPORT_GENERATION_FAILED',
        message: 'Failed to generate business report'
      });
    }
  }
);

// GET /api/ai/business/reports/{reportId}
router.get('/reports/:reportId',
  [
    param('reportId').isUUID().withMessage('Valid report ID required')
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid report ID format',
          details: errors.array()
        });
      }

      const { reportId } = req.params;

      const report = await businessIntelligence.getReport(reportId, req.user.id);

      if (!report) {
        return res.status(404).json({
          error: 'REPORT_NOT_FOUND',
          message: 'Report not found or access denied'
        });
      }

      // Check if report has expired
      if (report.expiresAt && new Date() > report.expiresAt) {
        return res.status(410).json({
          error: 'REPORT_EXPIRED',
          message: 'Report has expired and is no longer available'
        });
      }

      res.json({
        id: report.id,
        business_id: report.businessId,
        report_type: report.reportType,
        status: report.status,
        generated_at: report.generatedAt,
        expires_at: report.expiresAt,
        data: report.data,
        summary: report.summary,
        recommendations: report.recommendations,
        trends: report.trends,
        metadata: report.metadata
      });

    } catch (error: any) {
      console.error('Report retrieval error:', error);
      res.status(500).json({
        error: 'REPORT_RETRIEVAL_FAILED',
        message: 'Failed to retrieve business report'
      });
    }
  }
);

// GET /api/ai/business/reports
router.get('/reports',
  [
    query('business_id').optional().isUUID().withMessage('Business ID must be valid UUID'),
    query('report_type').optional().isIn(['weekly', 'monthly', 'custom']).withMessage('Invalid report type'),
    query('status').optional().isIn(['pending', 'processing', 'completed', 'failed']).withMessage('Invalid status'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative')
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details: errors.array()
        });
      }

      const { 
        business_id, 
        report_type, 
        status, 
        limit = 20, 
        offset = 0 
      } = req.query;

      const reports = await businessIntelligence.listReports({
        userId: req.user.id,
        businessId: business_id as string,
        reportType: report_type as string,
        status: status as string,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });

      res.json({
        reports: reports.items.map(report => ({
          id: report.id,
          business_id: report.businessId,
          business_name: report.businessName,
          report_type: report.reportType,
          status: report.status,
          generated_at: report.generatedAt,
          expires_at: report.expiresAt,
          summary: report.summary
        })),
        pagination: {
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          total: reports.total,
          has_more: reports.hasMore
        }
      });

    } catch (error: any) {
      console.error('Reports listing error:', error);
      res.status(500).json({
        error: 'REPORTS_LISTING_FAILED',
        message: 'Failed to retrieve business reports'
      });
    }
  }
);

// GET /api/ai/business/search
router.get('/search',
  [
    query('business_id').isUUID().withMessage('Valid business ID required'),
    query('query').isString().isLength({ min: 2, max: 100 }).withMessage('Query must be 2-100 characters'),
    query('search_type').optional().isIn(['feedback', 'trends', 'issues', 'recommendations']).withMessage('Invalid search type'),
    query('date_from').optional().isISO8601().withMessage('Invalid from date format'),
    query('date_to').optional().isISO8601().withMessage('Invalid to date format'),
    query('store_ids').optional().custom((value) => {
      if (typeof value === 'string') {
        const ids = value.split(',');
        return ids.every(id => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id));
      }
      return false;
    }).withMessage('Invalid store IDs format'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid search parameters',
          details: errors.array()
        });
      }

      const { 
        business_id, 
        query: searchQuery, 
        search_type = 'feedback',
        date_from,
        date_to,
        store_ids,
        limit = 20
      } = req.query;

      // Validate business access
      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .select('id')
        .eq('id', business_id)
        .eq('user_id', req.user.id)
        .single();

      if (businessError || !business) {
        return res.status(404).json({
          error: 'BUSINESS_NOT_FOUND',
          message: 'Business not found or access denied'
        });
      }

      const searchResults = await businessIntelligence.searchFeedback({
        businessId: business_id as string,
        query: searchQuery as string,
        searchType: search_type as string,
        dateFrom: date_from ? new Date(date_from as string) : undefined,
        dateTo: date_to ? new Date(date_to as string) : undefined,
        storeIds: store_ids ? (store_ids as string).split(',') : undefined,
        limit: parseInt(limit as string)
      });

      res.json({
        results: searchResults.items,
        summary: {
          total_found: searchResults.totalFound,
          search_type: search_type,
          query: searchQuery,
          date_range: {
            from: date_from,
            to: date_to
          }
        },
        suggestions: searchResults.suggestions
      });

    } catch (error: any) {
      console.error('Business search error:', error);
      res.status(500).json({
        error: 'SEARCH_FAILED',
        message: 'Failed to search business data'
      });
    }
  }
);

// GET /api/ai/business/trends
router.get('/trends',
  [
    query('business_id').isUUID().withMessage('Valid business ID required'),
    query('metric').isIn(['quality_scores', 'call_volume', 'reward_percentages', 'completion_rates', 'customer_satisfaction']).withMessage('Invalid metric'),
    query('period').optional().isIn(['7d', '30d', '90d', '1y']).withMessage('Invalid period'),
    query('store_ids').optional().custom((value) => {
      if (typeof value === 'string') {
        const ids = value.split(',');
        return ids.every(id => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id));
      }
      return false;
    }).withMessage('Invalid store IDs format'),
    query('granularity').optional().isIn(['hourly', 'daily', 'weekly', 'monthly']).withMessage('Invalid granularity')
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid trend parameters',
          details: errors.array()
        });
      }

      const { 
        business_id, 
        metric, 
        period = '30d',
        store_ids,
        granularity = 'daily'
      } = req.query;

      // Validate business access
      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .select('id, name')
        .eq('id', business_id)
        .eq('user_id', req.user.id)
        .single();

      if (businessError || !business) {
        return res.status(404).json({
          error: 'BUSINESS_NOT_FOUND',
          message: 'Business not found or access denied'
        });
      }

      const trends = await businessIntelligence.getTrends({
        businessId: business_id as string,
        metric: metric as string,
        period: period as string,
        storeIds: store_ids ? (store_ids as string).split(',') : undefined,
        granularity: granularity as string
      });

      res.json({
        business_name: business.name,
        metric,
        period,
        granularity,
        data_points: trends.dataPoints,
        summary: {
          total_data_points: trends.totalDataPoints,
          trend_direction: trends.trendDirection,
          change_percentage: trends.changePercentage,
          average_value: trends.averageValue,
          peak_value: trends.peakValue,
          lowest_value: trends.lowestValue
        },
        insights: trends.insights,
        generated_at: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('Trends analysis error:', error);
      res.status(500).json({
        error: 'TRENDS_ANALYSIS_FAILED',
        message: 'Failed to analyze business trends'
      });
    }
  }
);

// GET /api/ai/business/recommendations
router.get('/recommendations',
  [
    query('business_id').isUUID().withMessage('Valid business ID required'),
    query('category').optional().isIn(['quality_improvement', 'operational_efficiency', 'customer_experience', 'cost_optimization']).withMessage('Invalid category'),
    query('priority').optional().isIn(['high', 'medium', 'low']).withMessage('Invalid priority'),
    query('store_ids').optional().custom((value) => {
      if (typeof value === 'string') {
        const ids = value.split(',');
        return ids.every(id => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id));
      }
      return false;
    }).withMessage('Invalid store IDs format'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid recommendation parameters',
          details: errors.array()
        });
      }

      const { 
        business_id, 
        category, 
        priority,
        store_ids,
        limit = 20
      } = req.query;

      // Validate business access
      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .select('id, name')
        .eq('id', business_id)
        .eq('user_id', req.user.id)
        .single();

      if (businessError || !business) {
        return res.status(404).json({
          error: 'BUSINESS_NOT_FOUND',
          message: 'Business not found or access denied'
        });
      }

      const recommendations = await businessIntelligence.getRecommendations({
        businessId: business_id as string,
        category: category as string,
        priority: priority as string,
        storeIds: store_ids ? (store_ids as string).split(',') : undefined,
        limit: parseInt(limit as string)
      });

      res.json({
        business_name: business.name,
        recommendations: recommendations.items.map(rec => ({
          id: rec.id,
          title: rec.title,
          description: rec.description,
          category: rec.category,
          priority: rec.priority,
          impact_score: rec.impactScore,
          implementation_effort: rec.implementationEffort,
          expected_outcome: rec.expectedOutcome,
          action_items: rec.actionItems,
          supporting_data: rec.supportingData,
          created_at: rec.createdAt
        })),
        summary: {
          total_recommendations: recommendations.total,
          high_priority_count: recommendations.highPriorityCount,
          categories_covered: recommendations.categoriesCovered
        },
        generated_at: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('Recommendations error:', error);
      res.status(500).json({
        error: 'RECOMMENDATIONS_FAILED',
        message: 'Failed to generate business recommendations'
      });
    }
  }
);

export default router;