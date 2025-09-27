import { Router, Request, Response, NextFunction } from 'express';
import { QuestionService } from '../../services/questions/QuestionService';
import { ValidationError, NotFoundError, ConflictError } from '../../middleware/errorHandler';
import type { CreateQuestionRequest } from '@vocilia/types/src/questions';

const router = Router();
const questionService = new QuestionService();

// POST /api/questions
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
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

    const requestData: CreateQuestionRequest = req.body;

    // Validate required fields
    if (!requestData.question_text || requestData.question_text.trim().length === 0) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Question text is required',
        details: {
          question_text: 'Question text is required and cannot be empty',
        },
      });
    }

    if (!requestData.question_type) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Question type is required',
        details: {
          question_type: 'Question type is required',
        },
      });
    }

    // Validate question text length
    if (requestData.question_text.length < 10 || requestData.question_text.length > 500) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Question text must be between 10 and 500 characters',
        details: {
          question_text: 'Question text must be between 10 and 500 characters',
        },
      });
    }

    // Validate question type
    const validQuestionTypes = ['text', 'rating', 'multiple_choice', 'yes_no'];
    if (!validQuestionTypes.includes(requestData.question_type)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid question type',
        details: {
          question_type: `Question type must be one of: ${validQuestionTypes.join(', ')}`,
        },
      });
    }

    // Validate priority if provided
    if (requestData.priority) {
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
    if (requestData.frequency_window) {
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
    if (requestData.active_start_date && requestData.active_end_date) {
      const startDate = new Date(requestData.active_start_date);
      const endDate = new Date(requestData.active_end_date);
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid date format',
          details: {
            active_start_date: 'Date must be in valid ISO format (YYYY-MM-DD)',
            active_end_date: 'Date must be in valid ISO format (YYYY-MM-DD)',
          },
        });
      }

      if (startDate >= endDate) {
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
    if (requestData.active_hours_start && requestData.active_hours_end) {
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      
      if (!timeRegex.test(requestData.active_hours_start) || !timeRegex.test(requestData.active_hours_end)) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid time format',
          details: {
            active_hours_start: 'Time must be in HH:MM format (24-hour)',
            active_hours_end: 'Time must be in HH:MM format (24-hour)',
          },
        });
      }

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

    // Validate days of week if provided
    if (requestData.active_days_of_week) {
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

    // Create the question
    const question = await questionService.createQuestion(userBusinessId, requestData);

    res.status(201).json(question);
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

    console.error('Error creating question:', error);
    next(error);
  }
});

export { router as questionsCreateRouter };