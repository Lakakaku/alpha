import { Request, Response } from 'express';
import { QuestionEvaluationService } from '../../services/questions/evaluation-service';
import { supabase } from '@vocilia/database';
import { Question, CustomerContext, EvaluationRequest, EvaluationResult } from '@vocilia/types/questions';

interface QuestionEvaluationRequest {
  business_id: string;
  customer_context: CustomerContext;
  available_questions?: string[];
  max_call_duration_seconds?: number;
  priority_threshold?: number;
  optimization_algorithm?: 'greedy_priority' | 'dynamic_programming' | 'time_balanced' | 'token_estimation';
}

interface QuestionEvaluationResponse {
  selected_questions: Question[];
  estimated_duration_seconds: number;
  priority_distribution: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    optional: number;
  };
  optimization_details: {
    algorithm_used: string;
    questions_considered: number;
    questions_selected: number;
    time_utilization_percent: number;
    priority_score: number;
  };
  trigger_results: {
    triggered_questions: string[];
    trigger_logs: any[];
  };
  processing_time_ms: number;
  performance_valid: boolean;
}

const evaluationService = new QuestionEvaluationService();

export const evaluateQuestions = async (req: Request, res: Response): Promise<void> => {
  try {
    const startTime = Date.now();
    const requestData: QuestionEvaluationRequest = req.body;

    // Validate required fields
    const validation = validateEvaluationRequest(requestData);
    if (!validation.valid) {
      res.status(400).json({ 
        error: 'Invalid evaluation request',
        details: validation.errors
      });
      return;
    }

    // Fetch available questions for business
    const questionsQuery = requestData.available_questions 
      ? supabase.from('questions').select('*').in('id', requestData.available_questions)
      : supabase.from('questions').select('*').eq('business_id', requestData.business_id).eq('active', true);

    const { data: questions, error: questionsError } = await questionsQuery;

    if (questionsError) {
      console.error('Error fetching questions:', questionsError);
      res.status(500).json({ 
        error: 'Failed to fetch questions',
        details: questionsError.message
      });
      return;
    }

    if (!questions || questions.length === 0) {
      res.status(200).json({
        selected_questions: [],
        estimated_duration_seconds: 0,
        priority_distribution: { critical: 0, high: 0, medium: 0, low: 0, optional: 0 },
        optimization_details: {
          algorithm_used: 'none',
          questions_considered: 0,
          questions_selected: 0,
          time_utilization_percent: 0,
          priority_score: 0
        },
        trigger_results: {
          triggered_questions: [],
          trigger_logs: []
        },
        processing_time_ms: Date.now() - startTime,
        performance_valid: true
      });
      return;
    }

    // Build evaluation request
    const evaluationRequest: EvaluationRequest = {
      business_id: requestData.business_id,
      questions: questions as Question[],
      customer_context: requestData.customer_context,
      constraints: {
        max_duration_seconds: requestData.max_call_duration_seconds || 90,
        priority_threshold: requestData.priority_threshold || 2,
        algorithm: requestData.optimization_algorithm || 'greedy_priority'
      }
    };

    // Execute question evaluation
    const evaluationResult = await evaluationService.evaluateQuestions(evaluationRequest);

    const processingTime = Date.now() - startTime;
    const performanceValid = processingTime <= 500;

    if (!performanceValid) {
      console.warn(`Question evaluation exceeded 500ms: ${processingTime}ms`);
    }

    // Build response
    const response: QuestionEvaluationResponse = {
      selected_questions: evaluationResult.selected_questions,
      estimated_duration_seconds: evaluationResult.estimated_duration,
      priority_distribution: calculatePriorityDistribution(evaluationResult.selected_questions),
      optimization_details: {
        algorithm_used: evaluationRequest.constraints.algorithm,
        questions_considered: questions.length,
        questions_selected: evaluationResult.selected_questions.length,
        time_utilization_percent: (evaluationResult.estimated_duration / evaluationRequest.constraints.max_duration_seconds) * 100,
        priority_score: calculateAveragePriority(evaluationResult.selected_questions)
      },
      trigger_results: {
        triggered_questions: evaluationResult.trigger_logs.map(log => log.question_id),
        trigger_logs: evaluationResult.trigger_logs
      },
      processing_time_ms: processingTime,
      performance_valid: performanceValid
    };

    // Log evaluation metrics for analytics
    await logEvaluationMetrics(requestData.business_id, response, evaluationResult);

    res.status(200).json(response);

  } catch (error) {
    console.error('Error in evaluateQuestions:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const getEvaluationHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const startTime = Date.now();
    const { business_id, customer_id, limit = 50, offset = 0 } = req.query;

    if (!business_id) {
      res.status(400).json({ 
        error: 'Business ID is required'
      });
      return;
    }

    let query = supabase
      .from('question_evaluation_logs')
      .select(`
        *,
        selected_questions:question_evaluation_questions(
          question:questions(*)
        )
      `)
      .eq('business_id', business_id)
      .range(Number(offset), Number(offset) + Number(limit) - 1)
      .order('created_at', { ascending: false });

    if (customer_id) {
      query = query.eq('customer_id', customer_id);
    }

    const { data: evaluationHistory, error, count } = await query;

    if (error) {
      console.error('Error fetching evaluation history:', error);
      res.status(500).json({ 
        error: 'Failed to fetch evaluation history',
        details: error.message
      });
      return;
    }

    const processingTime = Date.now() - startTime;

    res.status(200).json({
      evaluations: evaluationHistory || [],
      total_count: count,
      processing_time_ms: processingTime,
      pagination: {
        limit: Number(limit),
        offset: Number(offset),
        has_more: count ? Number(offset) + Number(limit) < count : false
      }
    });

  } catch (error) {
    console.error('Error in getEvaluationHistory:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const getEvaluationMetrics = async (req: Request, res: Response): Promise<void> => {
  try {
    const startTime = Date.now();
    const { business_id, time_period = '7d' } = req.query;

    if (!business_id) {
      res.status(400).json({ 
        error: 'Business ID is required'
      });
      return;
    }

    const timeFilter = getTimePeriodFilter(time_period as string);

    // Fetch evaluation metrics
    const { data: metrics, error } = await supabase
      .from('question_evaluation_logs')
      .select(`
        id,
        questions_considered,
        questions_selected,
        estimated_duration,
        actual_duration,
        optimization_algorithm,
        priority_score,
        created_at
      `)
      .eq('business_id', business_id)
      .gte('created_at', timeFilter);

    if (error) {
      console.error('Error fetching evaluation metrics:', error);
      res.status(500).json({ 
        error: 'Failed to fetch evaluation metrics',
        details: error.message
      });
      return;
    }

    const summary = calculateMetricsSummary(metrics || []);
    const processingTime = Date.now() - startTime;

    res.status(200).json({
      metrics: summary,
      time_period: time_period,
      data_points: metrics?.length || 0,
      processing_time_ms: processingTime
    });

  } catch (error) {
    console.error('Error in getEvaluationMetrics:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Helper functions
function validateEvaluationRequest(data: QuestionEvaluationRequest): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.business_id || data.business_id.trim().length === 0) {
    errors.push('Business ID is required');
  }
  if (!data.customer_context) {
    errors.push('Customer context is required');
  }
  if (data.customer_context && !data.customer_context.customer_id) {
    errors.push('Customer ID is required in customer context');
  }
  if (data.max_call_duration_seconds && data.max_call_duration_seconds < 30) {
    errors.push('Maximum call duration must be at least 30 seconds');
  }
  if (data.priority_threshold && (data.priority_threshold < 1 || data.priority_threshold > 5)) {
    errors.push('Priority threshold must be between 1 and 5');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function calculatePriorityDistribution(questions: Question[]): QuestionEvaluationResponse['priority_distribution'] {
  const distribution = { critical: 0, high: 0, medium: 0, low: 0, optional: 0 };
  
  questions.forEach(question => {
    switch (question.priority_weight) {
      case 5:
        distribution.critical++;
        break;
      case 4:
        distribution.high++;
        break;
      case 3:
        distribution.medium++;
        break;
      case 2:
        distribution.low++;
        break;
      case 1:
        distribution.optional++;
        break;
    }
  });

  return distribution;
}

function calculateAveragePriority(questions: Question[]): number {
  if (questions.length === 0) return 0;
  
  const totalPriority = questions.reduce((sum, question) => sum + question.priority_weight, 0);
  return Math.round((totalPriority / questions.length) * 100) / 100;
}

async function logEvaluationMetrics(
  businessId: string, 
  response: QuestionEvaluationResponse, 
  evaluationResult: EvaluationResult
): Promise<void> {
  try {
    const { data: logEntry, error: logError } = await supabase
      .from('question_evaluation_logs')
      .insert([{
        business_id: businessId,
        customer_id: evaluationResult.customer_context?.customer_id,
        questions_considered: response.optimization_details.questions_considered,
        questions_selected: response.optimization_details.questions_selected,
        estimated_duration: response.estimated_duration_seconds,
        optimization_algorithm: response.optimization_details.algorithm_used,
        priority_score: response.optimization_details.priority_score,
        time_utilization_percent: response.optimization_details.time_utilization_percent,
        processing_time_ms: response.processing_time_ms,
        performance_valid: response.performance_valid
      }])
      .select()
      .single();

    if (logError) {
      console.error('Error logging evaluation metrics:', logError);
      return;
    }

    // Log selected questions
    if (response.selected_questions.length > 0) {
      const questionEntries = response.selected_questions.map((question, index) => ({
        evaluation_log_id: logEntry.id,
        question_id: question.id,
        selection_order: index + 1,
        estimated_duration: question.estimated_duration_seconds || 0
      }));

      await supabase
        .from('question_evaluation_questions')
        .insert(questionEntries);
    }

  } catch (error) {
    console.error('Error in logEvaluationMetrics:', error);
  }
}

function getTimePeriodFilter(period: string): string {
  const now = new Date();
  
  switch (period) {
    case '1d':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    case '90d':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
    default:
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  }
}

function calculateMetricsSummary(metrics: any[]): any {
  if (metrics.length === 0) {
    return {
      total_evaluations: 0,
      avg_questions_considered: 0,
      avg_questions_selected: 0,
      avg_selection_rate: 0,
      avg_estimated_duration: 0,
      avg_priority_score: 0,
      algorithm_distribution: {},
      performance_stats: {
        avg_processing_time_ms: 0,
        performance_valid_rate: 0
      }
    };
  }

  const total = metrics.length;
  const avgQuestionsConsidered = metrics.reduce((sum, m) => sum + (m.questions_considered || 0), 0) / total;
  const avgQuestionsSelected = metrics.reduce((sum, m) => sum + (m.questions_selected || 0), 0) / total;
  const avgSelectionRate = avgQuestionsConsidered > 0 ? (avgQuestionsSelected / avgQuestionsConsidered) * 100 : 0;
  const avgEstimatedDuration = metrics.reduce((sum, m) => sum + (m.estimated_duration || 0), 0) / total;
  const avgPriorityScore = metrics.reduce((sum, m) => sum + (m.priority_score || 0), 0) / total;

  // Algorithm distribution
  const algorithmCounts: Record<string, number> = {};
  metrics.forEach(m => {
    const algo = m.optimization_algorithm || 'unknown';
    algorithmCounts[algo] = (algorithmCounts[algo] || 0) + 1;
  });

  const algorithmDistribution: Record<string, number> = {};
  Object.keys(algorithmCounts).forEach(algo => {
    algorithmDistribution[algo] = (algorithmCounts[algo] / total) * 100;
  });

  return {
    total_evaluations: total,
    avg_questions_considered: Math.round(avgQuestionsConsidered * 100) / 100,
    avg_questions_selected: Math.round(avgQuestionsSelected * 100) / 100,
    avg_selection_rate: Math.round(avgSelectionRate * 100) / 100,
    avg_estimated_duration: Math.round(avgEstimatedDuration * 100) / 100,
    avg_priority_score: Math.round(avgPriorityScore * 100) / 100,
    algorithm_distribution: algorithmDistribution,
    performance_stats: {
      avg_processing_time_ms: Math.round(metrics.reduce((sum, m) => sum + (m.processing_time_ms || 0), 0) / total),
      performance_valid_rate: Math.round((metrics.filter(m => m.performance_valid).length / total) * 100)
    }
  };
}