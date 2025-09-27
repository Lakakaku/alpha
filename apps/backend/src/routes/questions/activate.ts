import { Router, Request, Response, NextFunction } from 'express';
import { QuestionService } from '../../services/questions/QuestionService';
import { ValidationError, NotFoundError, ConflictError } from '../../middleware/errorHandler';

const router = Router();
const questionService = new QuestionService();

interface ActivateRequest {
  action: 'activate' | 'deactivate';
}

// POST /api/questions/:questionId/activate
router.post('/:questionId/activate', async (req: Request, res: Response, next: NextFunction) => {
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

    const requestData: ActivateRequest = req.body;

    // Validate action
    if (!requestData.action) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Action is required',
        details: {
          action: 'Action must be either "activate" or "deactivate"',
        },
      });
    }

    const validActions = ['activate', 'deactivate'];
    if (!validActions.includes(requestData.action)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid action',
        details: {
          action: `Action must be one of: ${validActions.join(', ')}`,
        },
      });
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

    let updatedQuestion;

    if (requestData.action === 'activate') {
      updatedQuestion = await questionService.activateQuestion(questionId);
    } else {
      updatedQuestion = await questionService.deactivateQuestion(questionId);
    }

    res.status(200).json({
      data: updatedQuestion,
      message: `Question ${requestData.action}d successfully`,
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: error.message,
      });
    }

    if (error instanceof ConflictError) {
      return res.status(409).json({
        error: 'CONFLICT',
        message: error.message,
      });
    }

    if (error instanceof NotFoundError) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: error.message,
      });
    }

    console.error('Error activating/deactivating question:', error);
    next(error);
  }
});

export { router as questionsActivateRouter };