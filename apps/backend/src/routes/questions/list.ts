import { Router, Request, Response, NextFunction } from 'express';
import { QuestionService } from '../../services/questions/QuestionService';
import { ValidationError, NotFoundError } from '../../middleware/errorHandler';
import type { QuestionsListParams } from '@vocilia/types/src/questions';

const router = Router();
const questionService = new QuestionService();

// GET /api/questions
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const userBusinessId = req.user?.business_id;

    if (!userId) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'User not authenticated',
      });
    }

    if (!userBusinessId) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'No business associated with user',
      });
    }

    // Extract query parameters
    const {
      store_id,
      category_id,
      status,
      priority,
      is_active,
      page,
      limit,
      sort_by,
      sort_order,
    } = req.query;

    // Validate query parameters
    const params: QuestionsListParams = {};

    if (store_id && typeof store_id === 'string') {
      params.store_id = store_id;
    }

    if (category_id && typeof category_id === 'string') {
      params.category_id = category_id;
    }

    if (status && typeof status === 'string') {
      if (!['draft', 'active', 'inactive', 'archived'].includes(status)) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid status value',
          details: {
            status: 'Must be one of: draft, active, inactive, archived',
          },
        });
      }
      params.status = status as any;
    }

    if (priority && typeof priority === 'string') {
      if (!['high', 'medium', 'low'].includes(priority)) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid priority value',
          details: {
            priority: 'Must be one of: high, medium, low',
          },
        });
      }
      params.priority = priority as any;
    }

    if (is_active !== undefined) {
      if (typeof is_active === 'string') {
        params.is_active = is_active === 'true';
      }
    }

    if (page && typeof page === 'string') {
      const pageNum = parseInt(page, 10);
      if (isNaN(pageNum) || pageNum < 1) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid page number',
          details: {
            page: 'Must be a positive integer',
          },
        });
      }
      params.page = pageNum;
    }

    if (limit && typeof limit === 'string') {
      const limitNum = parseInt(limit, 10);
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid limit value',
          details: {
            limit: 'Must be a positive integer between 1 and 100',
          },
        });
      }
      params.limit = limitNum;
    }

    if (sort_by && typeof sort_by === 'string') {
      if (!['created_at', 'updated_at', 'priority', 'question_text'].includes(sort_by)) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid sort_by value',
          details: {
            sort_by: 'Must be one of: created_at, updated_at, priority, question_text',
          },
        });
      }
      params.sort_by = sort_by as any;
    }

    if (sort_order && typeof sort_order === 'string') {
      if (!['asc', 'desc'].includes(sort_order)) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid sort_order value',
          details: {
            sort_order: 'Must be one of: asc, desc',
          },
        });
      }
      params.sort_order = sort_order as any;
    }

    // Get questions for the user's business
    const result = await questionService.listQuestions(userBusinessId, params);

    res.status(200).json({
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: error.message,
      });
    }

    if (error instanceof NotFoundError) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: error.message,
      });
    }

    console.error('Error listing questions:', error);
    next(error);
  }
});

export { router as questionsListRouter };