import { Router, Request, Response, NextFunction } from 'express';
import { QuestionService } from '../../services/questions/QuestionService';
import { ValidationError, NotFoundError } from '../../middleware/errorHandler';

const router = Router();
const questionService = new QuestionService();

// DELETE /api/questions/:questionId
router.delete('/:questionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const userBusinessId = req.user?.business_id;
    const { questionId } = req.params;
    const { force } = req.query;

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

    // Get the question first to verify ownership
    const question = await questionService.getQuestion(questionId);

    // Check if the question belongs to the user's business
    if (question.business_id !== userBusinessId) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Access denied to this question',
      });
    }

    // Parse force parameter
    const forceDelete = force === 'true';

    // Delete the question
    await questionService.deleteQuestion(questionId, forceDelete);

    res.status(204).send();
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

    console.error('Error deleting question:', error);
    next(error);
  }
});

export { router as questionsDeleteRouter };