import { Router, Request, Response, NextFunction } from 'express';
import { QuestionService } from '../../services/questions/QuestionService';
import { ValidationError, NotFoundError } from '../../middleware/errorHandler';

const router = Router();
const questionService = new QuestionService();

interface PreviewRequest {
  format?: 'responsive' | 'mobile' | 'desktop';
  personalization?: Record<string, any>;
  include_metadata?: boolean;
}

// POST /api/questions/:questionId/preview
router.post('/:questionId/preview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const userBusinessId = req.user?.business_id;
    const { questionId } = req.params;

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

    // Validate questionId format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(questionId)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid question ID format',
        details: {
          questionId: 'Question ID must be a valid UUID',
        },
      });
    }

    const requestData: PreviewRequest = req.body;

    // Validate format if provided
    if (requestData.format) {
      const validFormats = ['responsive', 'mobile', 'desktop'];
      if (!validFormats.includes(requestData.format)) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid preview format',
          details: {
            format: `Format must be one of: ${validFormats.join(', ')}`,
          },
        });
      }
    }

    // Get the question first to verify ownership
    const question = await questionService.getQuestion(questionId);

    // Check if the question belongs to the user's business
    if (question.business_id !== userBusinessId) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Access denied to this question',
      });
    }

    // Generate preview
    const preview = await questionService.generatePreview(questionId, {
      format: requestData.format || 'responsive',
      personalization: requestData.personalization || {},
    });

    // Calculate estimated completion time based on question type
    let estimated_completion_time = 30; // Default 30 seconds
    switch (question.question_type) {
      case 'text':
        estimated_completion_time = 45;
        break;
      case 'rating':
        estimated_completion_time = 15;
        break;
      case 'multiple_choice':
        estimated_completion_time = 20;
        break;
      case 'yes_no':
        estimated_completion_time = 10;
        break;
    }

    const response: any = {
      preview: {
        html: preview.html,
        json: preview.json,
        text: preview.text,
      },
      estimated_completion_time,
      question_metadata: {
        id: question.id,
        type: question.question_type,
        priority: question.priority,
        status: question.status,
        is_active: question.is_active,
      },
    };

    // Include additional metadata if requested
    if (requestData.include_metadata) {
      response.question_metadata = {
        ...response.question_metadata,
        category: question.category,
        frequency_config: {
          target: question.frequency_target,
          window: question.frequency_window,
          current: question.frequency_current,
        },
        scheduling: {
          start_date: question.active_start_date,
          end_date: question.active_end_date,
          hours_start: question.active_hours_start,
          hours_end: question.active_hours_end,
          days_of_week: question.active_days_of_week,
        },
        audit: {
          created_at: question.created_at,
          updated_at: question.updated_at,
          created_by: question.created_by,
          updated_by: question.updated_by,
        },
      };
    }

    res.status(200).json(response);
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

    console.error('Error generating question preview:', error);
    next(error);
  }
});

export { router as questionsPreviewRouter };