import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { KeywordDetectionService } from '../../services/fraud/keywordDetectionService';
import { adminAuth } from '../../middleware/admin-auth';
import { AuditLoggingService } from '../../services/security/auditLoggingService';

const router = Router();
const keywordService = new KeywordDetectionService();
const auditService = new AuditLoggingService();

// Validation schemas
const createKeywordSchema = z.object({
  keyword: z.string().min(1).max(100),
  category: z.enum(['profanity', 'threats', 'nonsensical', 'impossible']),
  severity_level: z.number().min(1).max(10),
  language_code: z.string().length(2).default('sv'),
  detection_pattern: z.string().optional(),
  is_active: z.boolean().default(true)
});

const updateKeywordSchema = z.object({
  keyword: z.string().min(1).max(100).optional(),
  category: z.enum(['profanity', 'threats', 'nonsensical', 'impossible']).optional(),
  severity_level: z.number().min(1).max(10).optional(),
  language_code: z.string().length(2).optional(),
  detection_pattern: z.string().optional(),
  is_active: z.boolean().optional()
});

const querySchema = z.object({
  category: z.enum(['profanity', 'threats', 'nonsensical', 'impossible']).optional(),
  language_code: z.string().length(2).optional(),
  severity_min: z.coerce.number().min(1).max(10).optional(),
  severity_max: z.coerce.number().min(1).max(10).optional(),
  is_active: z.coerce.boolean().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
  search: z.string().optional()
});

/**
 * GET /api/fraud/keywords
 * Get filtered list of red flag keywords
 */
router.get('/', adminAuth, async (req: Request, res: Response) => {
  try {
    const filters = querySchema.parse(req.query);
    
    const keywords = await keywordService.getKeywords(filters);
    const totalCount = await keywordService.getKeywordCount(filters);

    // Log data access
    await auditService.logEvent({
      event_type: 'data_access',
      user_id: req.user?.id,
      user_type: 'admin',
      action_performed: 'list_fraud_keywords',
      resource_type: 'red_flag_keywords',
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      result_status: 'success',
      event_metadata: {
        filters: filters,
        result_count: keywords.length,
        total_count: totalCount
      }
    });

    res.json({
      success: true,
      data: keywords,
      pagination: {
        limit: filters.limit,
        offset: filters.offset,
        total: totalCount,
        hasMore: filters.offset + keywords.length < totalCount
      }
    });
  } catch (error) {
    console.error('Error fetching fraud keywords:', error);

    // Log error
    await auditService.logEvent({
      event_type: 'data_access',
      user_id: req.user?.id,
      user_type: 'admin',
      action_performed: 'list_fraud_keywords',
      resource_type: 'red_flag_keywords',
      ip_address: req.ip,
      result_status: 'failure',
      event_metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
        filters: req.query
      }
    });

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to fetch fraud keywords'
    });
  }
});

/**
 * POST /api/fraud/keywords
 * Create new red flag keyword
 */
router.post('/', adminAuth, async (req: Request, res: Response) => {
  try {
    const keywordData = createKeywordSchema.parse(req.body);
    
    const newKeyword = await keywordService.createKeyword({
      ...keywordData,
      created_by: req.user!.id
    });

    // Log keyword creation
    await auditService.logEvent({
      event_type: 'data_modification',
      user_id: req.user?.id,
      user_type: 'admin',
      action_performed: 'create_fraud_keyword',
      resource_type: 'red_flag_keywords',
      resource_id: newKeyword.id,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      result_status: 'success',
      event_metadata: {
        keyword: keywordData.keyword,
        category: keywordData.category,
        severity_level: keywordData.severity_level,
        language_code: keywordData.language_code
      }
    });

    res.status(201).json({
      success: true,
      data: newKeyword
    });
  } catch (error) {
    console.error('Error creating fraud keyword:', error);

    // Log error
    await auditService.logEvent({
      event_type: 'data_modification',
      user_id: req.user?.id,
      user_type: 'admin',
      action_performed: 'create_fraud_keyword',
      resource_type: 'red_flag_keywords',
      ip_address: req.ip,
      result_status: 'failure',
      event_metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
        request_data: req.body
      }
    });

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid keyword data',
        details: error.errors
      });
    }

    if (error instanceof Error && error.message.includes('duplicate key')) {
      return res.status(409).json({
        success: false,
        error: 'Keyword already exists for this language'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to create fraud keyword'
    });
  }
});

/**
 * GET /api/fraud/keywords/:id
 * Get specific keyword by ID
 */
router.get('/:id', adminAuth, async (req: Request, res: Response) => {
  try {
    const keywordId = req.params.id;
    
    const keyword = await keywordService.getKeywordById(keywordId);
    
    if (!keyword) {
      await auditService.logEvent({
        event_type: 'data_access',
        user_id: req.user?.id,
        user_type: 'admin',
        action_performed: 'get_fraud_keyword',
        resource_type: 'red_flag_keywords',
        resource_id: keywordId,
        ip_address: req.ip,
        result_status: 'failure',
        event_metadata: { error: 'Keyword not found' }
      });

      return res.status(404).json({
        success: false,
        error: 'Keyword not found'
      });
    }

    await auditService.logEvent({
      event_type: 'data_access',
      user_id: req.user?.id,
      user_type: 'admin',
      action_performed: 'get_fraud_keyword',
      resource_type: 'red_flag_keywords',
      resource_id: keywordId,
      ip_address: req.ip,
      result_status: 'success'
    });

    res.json({
      success: true,
      data: keyword
    });
  } catch (error) {
    console.error('Error fetching fraud keyword:', error);
    
    await auditService.logEvent({
      event_type: 'data_access',
      user_id: req.user?.id,
      user_type: 'admin',
      action_performed: 'get_fraud_keyword',
      resource_type: 'red_flag_keywords',
      resource_id: req.params.id,
      ip_address: req.ip,
      result_status: 'failure',
      event_metadata: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });

    res.status(500).json({
      success: false,
      error: 'Failed to fetch fraud keyword'
    });
  }
});

/**
 * PUT /api/fraud/keywords/:id
 * Update existing keyword
 */
router.put('/:id', adminAuth, async (req: Request, res: Response) => {
  try {
    const keywordId = req.params.id;
    const updateData = updateKeywordSchema.parse(req.body);
    
    const updatedKeyword = await keywordService.updateKeyword(keywordId, updateData);
    
    if (!updatedKeyword) {
      await auditService.logEvent({
        event_type: 'data_modification',
        user_id: req.user?.id,
        user_type: 'admin',
        action_performed: 'update_fraud_keyword',
        resource_type: 'red_flag_keywords',
        resource_id: keywordId,
        ip_address: req.ip,
        result_status: 'failure',
        event_metadata: { error: 'Keyword not found' }
      });

      return res.status(404).json({
        success: false,
        error: 'Keyword not found'
      });
    }

    await auditService.logEvent({
      event_type: 'data_modification',
      user_id: req.user?.id,
      user_type: 'admin',
      action_performed: 'update_fraud_keyword',
      resource_type: 'red_flag_keywords',
      resource_id: keywordId,
      ip_address: req.ip,
      result_status: 'success',
      event_metadata: {
        changes: updateData
      }
    });

    res.json({
      success: true,
      data: updatedKeyword
    });
  } catch (error) {
    console.error('Error updating fraud keyword:', error);
    
    await auditService.logEvent({
      event_type: 'data_modification',
      user_id: req.user?.id,
      user_type: 'admin',
      action_performed: 'update_fraud_keyword',
      resource_type: 'red_flag_keywords',
      resource_id: req.params.id,
      ip_address: req.ip,
      result_status: 'failure',
      event_metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
        request_data: req.body
      }
    });

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid update data',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update fraud keyword'
    });
  }
});

/**
 * DELETE /api/fraud/keywords/:id
 * Delete keyword (soft delete by setting is_active to false)
 */
router.delete('/:id', adminAuth, async (req: Request, res: Response) => {
  try {
    const keywordId = req.params.id;
    
    const deletedKeyword = await keywordService.deactivateKeyword(keywordId);
    
    if (!deletedKeyword) {
      await auditService.logEvent({
        event_type: 'data_modification',
        user_id: req.user?.id,
        user_type: 'admin',
        action_performed: 'delete_fraud_keyword',
        resource_type: 'red_flag_keywords',
        resource_id: keywordId,
        ip_address: req.ip,
        result_status: 'failure',
        event_metadata: { error: 'Keyword not found' }
      });

      return res.status(404).json({
        success: false,
        error: 'Keyword not found'
      });
    }

    await auditService.logEvent({
      event_type: 'data_modification',
      user_id: req.user?.id,
      user_type: 'admin',
      action_performed: 'delete_fraud_keyword',
      resource_type: 'red_flag_keywords',
      resource_id: keywordId,
      ip_address: req.ip,
      result_status: 'success',
      event_metadata: {
        keyword: deletedKeyword.keyword,
        category: deletedKeyword.category
      }
    });

    res.json({
      success: true,
      message: 'Keyword deactivated successfully'
    });
  } catch (error) {
    console.error('Error deleting fraud keyword:', error);
    
    await auditService.logEvent({
      event_type: 'data_modification',
      user_id: req.user?.id,
      user_type: 'admin',
      action_performed: 'delete_fraud_keyword',
      resource_type: 'red_flag_keywords',
      resource_id: req.params.id,
      ip_address: req.ip,
      result_status: 'failure',
      event_metadata: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });

    res.status(500).json({
      success: false,
      error: 'Failed to delete fraud keyword'
    });
  }
});

/**
 * POST /api/fraud/keywords/bulk
 * Bulk import keywords from CSV or JSON
 */
router.post('/bulk', adminAuth, async (req: Request, res: Response) => {
  try {
    const { keywords, format = 'json' } = req.body;
    
    if (!Array.isArray(keywords) || keywords.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Keywords array is required and must not be empty'
      });
    }

    const validationResults = [];
    const validKeywords = [];
    
    // Validate each keyword
    for (const [index, keyword] of keywords.entries()) {
      try {
        const validatedKeyword = createKeywordSchema.parse(keyword);
        validKeywords.push({
          ...validatedKeyword,
          created_by: req.user!.id
        });
        validationResults.push({ index, status: 'valid' });
      } catch (error) {
        validationResults.push({ 
          index, 
          status: 'invalid', 
          error: error instanceof z.ZodError ? error.errors : 'Unknown validation error' 
        });
      }
    }

    // Import valid keywords
    const importResults = await keywordService.bulkCreateKeywords(validKeywords);

    await auditService.logEvent({
      event_type: 'data_modification',
      user_id: req.user?.id,
      user_type: 'admin',
      action_performed: 'bulk_import_fraud_keywords',
      resource_type: 'red_flag_keywords',
      ip_address: req.ip,
      result_status: 'success',
      event_metadata: {
        total_submitted: keywords.length,
        valid_keywords: validKeywords.length,
        imported_successfully: importResults.successful,
        import_errors: importResults.errors,
        format
      }
    });

    res.json({
      success: true,
      data: {
        total_submitted: keywords.length,
        valid_keywords: validKeywords.length,
        imported_successfully: importResults.successful,
        validation_errors: validationResults.filter(r => r.status === 'invalid'),
        import_errors: importResults.errors
      }
    });
  } catch (error) {
    console.error('Error bulk importing fraud keywords:', error);
    
    await auditService.logEvent({
      event_type: 'data_modification',
      user_id: req.user?.id,
      user_type: 'admin',
      action_performed: 'bulk_import_fraud_keywords',
      resource_type: 'red_flag_keywords',
      ip_address: req.ip,
      result_status: 'failure',
      event_metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
        request_size: Array.isArray(req.body?.keywords) ? req.body.keywords.length : 0
      }
    });

    res.status(500).json({
      success: false,
      error: 'Failed to bulk import fraud keywords'
    });
  }
});

export default router;