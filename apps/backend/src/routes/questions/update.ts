import { Router, Request, Response, NextFunction } from 'express';
import { QuestionService } from '../../services/questions/QuestionService';
import { ValidationError, NotFoundError, ConflictError } from '../../middleware/errorHandler';
import type { UpdateQuestionRequest } from '@vocilia/types/src/questions';

const router = Router();
const questionService = new QuestionService();

// PUT /api/questions/:questionId
router.put('/:questionId', async (req: Request, res: Response, next: NextFunction) => {
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

    const requestData: UpdateQuestionRequest = req.body;

    // Validate that at least one field is being updated
    const updateableFields = [
      'question_text', 'formatting_options', 'category_id', 'department', 
      'priority', 'status', 'frequency_target', 'frequency_window',
      'active_start_date', 'active_end_date', 'active_hours_start', 
      'active_hours_end', 'active_days_of_week'
    ];

    const fieldsToUpdate = Object.keys(requestData).filter(key => 
      updateableFields.includes(key) && requestData[key as keyof UpdateQuestionRequest] !== undefined
    );

    if (fieldsToUpdate.length === 0) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'No valid fields provided for update',
        details: {
          updateableFields: updateableFields.join(', '),
        },
      });
    }

    // Validate question text if provided
    if (requestData.question_text !== undefined) {
      if (!requestData.question_text || requestData.question_text.trim().length === 0) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Question text cannot be empty',
          details: {
            question_text: 'Question text is required and cannot be empty',
          },
        });
      }

      if (requestData.question_text.length < 10 || requestData.question_text.length > 500) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Question text must be between 10 and 500 characters',
          details: {
            question_text: 'Question text must be between 10 and 500 characters',
          },
        });
      }
    }

    // Validate priority if provided
    if (requestData.priority !== undefined) {
      const validPriorities = ['high', 'medium', 'low'];
      if (!validPriorities.includes(requestData.priority)) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid priority value',
          details: {
            priority: `Priority must be one of: ${validPriorities.join(', ')}`,
          },
        });
      }
    }

    // Validate status if provided
    if (requestData.status !== undefined) {
      const validStatuses = ['draft', 'active', 'inactive', 'archived'];
      if (!validStatuses.includes(requestData.status)) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid status value',
          details: {
            status: `Status must be one of: ${validStatuses.join(', ')}`,
          },
        });
      }
    }

    // Validate frequency target if provided
    if (requestData.frequency_target !== undefined) {
      if (!Number.isInteger(requestData.frequency_target) || 
          requestData.frequency_target < 1 || 
          requestData.frequency_target > 100) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid frequency target',
          details: {
            frequency_target: 'Frequency target must be an integer between 1 and 100',
          },
        });
      }
    }

    // Validate frequency window if provided
    if (requestData.frequency_window !== undefined) {
      const validWindows = ['hourly', 'daily', 'weekly'];
      if (!validWindows.includes(requestData.frequency_window)) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid frequency window',
          details: {
            frequency_window: `Frequency window must be one of: ${validWindows.join(', ')}`,
          },
        });
      }
    }

    // Validate date range if provided
    if (requestData.active_start_date !== undefined || requestData.active_end_date !== undefined) {
      // If either date is provided, we need to check against the existing question
      const existingQuestion = await questionService.getQuestion(questionId);
      
      // Check business access
      if (existingQuestion.business_id !== userBusinessId) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'Access denied to this question',
        });
      }

      const startDate = requestData.active_start_date ? 
        new Date(requestData.active_start_date) : 
        (existingQuestion.active_start_date ? new Date(existingQuestion.active_start_date) : null);
      
      const endDate = requestData.active_end_date ? 
        new Date(requestData.active_end_date) : 
        (existingQuestion.active_end_date ? new Date(existingQuestion.active_end_date) : null);

      if (requestData.active_start_date && isNaN(new Date(requestData.active_start_date).getTime())) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid start date format',
          details: {
            active_start_date: 'Date must be in valid ISO format (YYYY-MM-DD)',
          },
        });
      }

      if (requestData.active_end_date && isNaN(new Date(requestData.active_end_date).getTime())) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid end date format',
          details: {
            active_end_date: 'Date must be in valid ISO format (YYYY-MM-DD)',
          },
        });
      }

      if (startDate && endDate && startDate >= endDate) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid date range',
          details: {
            active_start_date: 'Start date must be before end date',
          },
        });
      }
    }

    // Validate time range if provided
    if (requestData.active_hours_start !== undefined || requestData.active_hours_end !== undefined) {
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      
      if (requestData.active_hours_start !== undefined && !timeRegex.test(requestData.active_hours_start)) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid start time format',
          details: {
            active_hours_start: 'Time must be in HH:MM format (24-hour)',
          },
        });
      }

      if (requestData.active_hours_end !== undefined && !timeRegex.test(requestData.active_hours_end)) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid end time format',
          details: {
            active_hours_end: 'Time must be in HH:MM format (24-hour)',
          },
        });
      }

      // If both times are provided, validate the range
      if (requestData.active_hours_start && requestData.active_hours_end) {
        const [startHour, startMinute] = requestData.active_hours_start.split(':').map(Number);
        const [endHour, endMinute] = requestData.active_hours_end.split(':').map(Number);
        const startMinutes = startHour * 60 + startMinute;
        const endMinutes = endHour * 60 + endMinute;

        if (startMinutes >= endMinutes) {
          return res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: 'Invalid time range',
            details: {
              active_hours_start: 'Start time must be before end time',
            },
          });
        }
      }
    }

    // Validate days of week if provided
    if (requestData.active_days_of_week !== undefined) {
      if (!Array.isArray(requestData.active_days_of_week)) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid days of week format',
          details: {
            active_days_of_week: 'Days of week must be an array of integers (0-6)',
          },
        });
      }

      const validDays = requestData.active_days_of_week.every(day => 
        Number.isInteger(day) && day >= 0 && day <= 6
      );

      if (!validDays) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid days of week values',
          details: {
            active_days_of_week: 'Each day must be an integer between 0 (Sunday) and 6 (Saturday)',
          },
        });
      }
    }

    // Update the question
    const updatedQuestion = await questionService.updateQuestion(questionId, requestData);

    res.status(200).json(updatedQuestion);
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

    console.error('Error updating question:', error);
    next(error);
  }
});

export { router as questionsUpdateRouter };