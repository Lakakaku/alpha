import { Request, Response } from 'express';
import { QuestionSelector } from '../../services/calls/QuestionSelector';
import { QuestionConfiguration } from '../../models/QuestionConfiguration';

export interface SelectQuestionsRequest {
  businessId: string;
  customerCount: number;
  timeBudgetSeconds?: number;
  departmentTags?: string[];
  excludeQuestionIds?: string[];
  maxQuestions?: number;
}

export interface SelectQuestionsResponse {
  questions: Array<{
    id: string;
    text: string;
    responseType: 'rating' | 'text' | 'boolean';
    estimatedSeconds: number;
    frequency: number;
    priority: number;
    departmentTags: string[];
  }>;
  totalEstimatedSeconds: number;
  selectionCriteria: {
    customerCount: number;
    timeBudgetSeconds: number;
    departmentTags?: string[];
    questionsConsidered: number;
    questionsSelected: number;
  };
}

export const selectQuestions = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      businessId,
      customerCount,
      timeBudgetSeconds = 120, // 2 minutes default
      departmentTags,
      excludeQuestionIds = [],
      maxQuestions = 5
    }: SelectQuestionsRequest = req.body;

    // Validate required fields
    if (!businessId || customerCount === undefined) {
      res.status(400).json({
        error: 'Missing required fields: businessId, customerCount'
      });
      return;
    }

    // Validate customer count
    if (customerCount < 1) {
      res.status(400).json({
        error: 'Customer count must be a positive integer'
      });
      return;
    }

    // Validate time budget
    if (timeBudgetSeconds < 30 || timeBudgetSeconds > 300) {
      res.status(400).json({
        error: 'Time budget must be between 30 and 300 seconds'
      });
      return;
    }

    // Initialize question selector
    const selector = new QuestionSelector();

    // Get all available questions for the business
    const availableQuestions = await QuestionConfiguration.findByBusinessId(businessId);

    if (!availableQuestions || availableQuestions.length === 0) {
      res.status(404).json({
        error: 'No questions configured for this business'
      });
      return;
    }

    // Filter out excluded questions
    const filteredQuestions = availableQuestions.filter(
      question => !excludeQuestionIds.includes(question.id)
    );

    if (filteredQuestions.length === 0) {
      res.status(400).json({
        error: 'No questions available after applying exclusions'
      });
      return;
    }

    // Select questions using the algorithm
    const selectedQuestions = await selector.selectQuestions({
      businessId,
      customerCount,
      timeBudgetSeconds,
      departmentTags,
      maxQuestions
    });

    if (selectedQuestions.length === 0) {
      res.status(404).json({
        error: 'No questions match the selection criteria',
        details: {
          customerCount,
          timeBudgetSeconds,
          departmentTags,
          availableQuestions: filteredQuestions.length
        }
      });
      return;
    }

    // Format questions for response
    const formattedQuestions = selectedQuestions.map(question => ({
      id: question.id,
      text: question.text,
      responseType: question.responseType,
      estimatedSeconds: question.estimatedResponseTime,
      frequency: question.frequency,
      priority: question.priority,
      departmentTags: question.departmentTags || []
    }));

    // Calculate total estimated time
    const totalEstimatedSeconds = formattedQuestions.reduce(
      (sum, q) => sum + q.estimatedSeconds,
      0
    );

    // Build response
    const response: SelectQuestionsResponse = {
      questions: formattedQuestions,
      totalEstimatedSeconds,
      selectionCriteria: {
        customerCount,
        timeBudgetSeconds,
        departmentTags,
        questionsConsidered: filteredQuestions.length,
        questionsSelected: selectedQuestions.length
      }
    };

    res.json(response);

  } catch (error) {
    console.error('Failed to select questions:', error);

    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const getQuestionConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const { businessId } = req.params;

    if (!businessId) {
      res.status(400).json({
        error: 'Business ID is required'
      });
      return;
    }

    // Get all questions for the business
    const questions = await QuestionConfiguration.findByBusinessId(businessId);

    if (!questions || questions.length === 0) {
      res.status(404).json({
        error: 'No questions configured for this business'
      });
      return;
    }

    // Format questions for response
    const formattedQuestions = questions.map(question => ({
      id: question.id,
      text: question.text,
      responseType: question.responseType,
      estimatedSeconds: question.estimatedResponseTime,
      frequency: question.frequency,
      priority: question.priority,
      departmentTags: question.departmentTags || [],
      isActive: question.isActive,
      validFrom: question.validFrom,
      validUntil: question.validUntil,
      createdAt: question.createdAt,
      updatedAt: question.updatedAt
    }));

    res.json({
      businessId,
      questions: formattedQuestions,
      totalQuestions: formattedQuestions.length,
      activeQuestions: formattedQuestions.filter(q => q.isActive).length
    });

  } catch (error) {
    console.error('Failed to get question configuration:', error);

    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};