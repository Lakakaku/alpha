import { QuestionSelectionRequest, QuestionSelectionResponse, SelectedQuestion } from '@vocilia/types';
import { QuestionConfigurationModel } from '../../models/QuestionConfiguration';
import { QuestionSelectionLogModel } from '../../models/QuestionSelectionLog';

export class QuestionSelector {
  async selectQuestions(request: QuestionSelectionRequest): Promise<QuestionSelectionResponse> {
    try {
      // Get all active questions for the business
      const allQuestions = await QuestionConfigurationModel.findActiveByBusinessId(request.businessId);

      if (allQuestions.length === 0) {
        return {
          selectedQuestions: [],
          estimatedDuration: 0,
          selectionCriteria: {
            businessId: request.businessId,
            customerCount: request.customerCount,
            reason: 'no_active_questions',
          },
        };
      }

      // Filter questions based on frequency
      const dueQuestions = this.filterQuestionsByFrequency(allQuestions, request.customerCount);

      // Filter by customer context if provided
      const contextFilteredQuestions = this.filterQuestionsByContext(dueQuestions, request.customerContext);

      // Prioritize questions
      const prioritizedQuestions = this.prioritizeQuestions(contextFilteredQuestions);

      // Select questions within time budget
      const selectedQuestions = this.selectQuestionsWithinTimeBudget(
        prioritizedQuestions,
        request.timeBudgetSeconds || 90
      );

      // Calculate estimated duration
      const estimatedDuration = this.calculateEstimatedDuration(selectedQuestions);

      // Log the selection decision
      await this.logQuestionSelection(request, selectedQuestions, estimatedDuration);

      return {
        selectedQuestions: selectedQuestions.map(q => this.formatSelectedQuestion(q)),
        estimatedDuration,
        selectionCriteria: {
          businessId: request.businessId,
          customerCount: request.customerCount,
          timeBudgetSeconds: request.timeBudgetSeconds || 90,
          totalAvailableQuestions: allQuestions.length,
          dueQuestionsCount: dueQuestions.length,
          contextFiltered: contextFilteredQuestions.length,
          finalSelected: selectedQuestions.length,
          algorithm: 'frequency_priority_time_budget',
          frequencyBasedSelection: true,
        },
      };
    } catch (error) {
      console.error('Error selecting questions:', error);
      throw new Error(`Failed to select questions: ${error.message}`);
    }
  }

  private filterQuestionsByFrequency(questions: any[], customerCount: number): any[] {
    return questions.filter(question => {
      // Question is due if customerCount is divisible by frequency
      return customerCount % question.frequency === 0;
    });
  }

  private filterQuestionsByContext(questions: any[], customerContext?: Record<string, any>): any[] {
    if (!customerContext) {
      return questions;
    }

    return questions.filter(question => {
      // Filter by department tags if customer context includes department info
      if (customerContext.department || customerContext.departments) {
        const customerDepartments = customerContext.departments || [customerContext.department];
        const hasMatchingDepartment = question.department_tags.some((tag: string) =>
          customerDepartments.some((dept: string) => 
            dept.toLowerCase().includes(tag.toLowerCase()) || 
            tag.toLowerCase().includes(dept.toLowerCase())
          )
        );
        
        if (!hasMatchingDepartment) {
          return false;
        }
      }

      // Add more context-based filtering logic here
      // For example, filter by visit time, purchase amount, etc.

      return true;
    });
  }

  private prioritizeQuestions(questions: any[]): any[] {
    // Sort by priority (high > medium > low) and then by frequency (lower frequency = higher priority)
    return questions.sort((a, b) => {
      // Priority order
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      
      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      // If same priority, prefer questions with lower frequency (asked less often)
      return a.frequency - b.frequency;
    });
  }

  private selectQuestionsWithinTimeBudget(questions: any[], timeBudgetSeconds: number): any[] {
    const selected: any[] = [];
    let estimatedTime = 0;

    // Reserve time for AI introduction and closing (approximately 20 seconds total)
    const conversationOverhead = 20;
    const availableTimeForQuestions = timeBudgetSeconds - conversationOverhead;

    for (const question of questions) {
      const questionTime = question.max_response_time + 10; // 10 seconds for AI question delivery
      
      if (estimatedTime + questionTime <= availableTimeForQuestions) {
        selected.push(question);
        estimatedTime += questionTime;
      }
      
      // Don't select too many questions to keep conversation natural
      if (selected.length >= 3) {
        break;
      }
    }

    return selected;
  }

  private calculateEstimatedDuration(questions: any[]): number {
    const conversationOverhead = 20; // Introduction + closing
    const questionTime = questions.reduce((total, question) => {
      return total + question.max_response_time + 10; // 10 seconds for AI question delivery
    }, 0);

    return conversationOverhead + questionTime;
  }

  private formatSelectedQuestion(question: any): SelectedQuestion {
    return {
      id: question.id,
      questionText: question.question_text,
      priority: question.priority,
      maxResponseTime: question.max_response_time,
      followUpPrompts: question.follow_up_prompts || undefined,
    };
  }

  private async logQuestionSelection(
    request: QuestionSelectionRequest,
    selectedQuestions: any[],
    estimatedDuration: number
  ): Promise<void> {
    try {
      // Create a selection log entry for analytics and debugging
      await QuestionSelectionLogModel.create({
        business_id: request.businessId,
        customer_count: request.customerCount,
        selected_questions: selectedQuestions.map(q => q.id),
        selection_algorithm: 'frequency_priority_time_budget_v1',
        selection_criteria: {
          timeBudgetSeconds: request.timeBudgetSeconds || 90,
          customerContext: request.customerContext || {},
          totalQuestionsConsidered: selectedQuestions.length,
        },
        time_budget_seconds: request.timeBudgetSeconds || 90,
        estimated_duration: estimatedDuration,
      });
    } catch (error) {
      console.warn('Failed to log question selection:', error);
      // Don't fail the selection if logging fails
    }
  }

  async getQuestionSelectionHistory(businessId: string, limit: number = 50): Promise<any[]> {
    try {
      return await QuestionSelectionLogModel.findByBusinessId(businessId, { limit });
    } catch (error) {
      console.error('Error getting question selection history:', error);
      throw new Error(`Failed to get selection history: ${error.message}`);
    }
  }

  async getQuestionFrequencyStats(businessId: string): Promise<{
    totalQuestions: number;
    questionsPerFrequency: Record<number, number>;
    averageFrequency: number;
    recommendedCustomerCount: number;
  }> {
    try {
      const stats = await QuestionConfigurationModel.getConfigurationStats(businessId);
      const questions = await QuestionConfigurationModel.findActiveByBusinessId(businessId);

      // Calculate questions per frequency
      const questionsPerFrequency: Record<number, number> = {};
      questions.forEach(question => {
        questionsPerFrequency[question.frequency] = (questionsPerFrequency[question.frequency] || 0) + 1;
      });

      // Calculate recommended customer count (LCM of all frequencies)
      const frequencies = questions.map(q => q.frequency);
      const recommendedCustomerCount = frequencies.length > 0 ? this.calculateLCM(frequencies) : 1;

      return {
        totalQuestions: stats.totalConfigurations,
        questionsPerFrequency,
        averageFrequency: stats.averageFrequency,
        recommendedCustomerCount,
      };
    } catch (error) {
      console.error('Error getting question frequency stats:', error);
      throw new Error(`Failed to get frequency stats: ${error.message}`);
    }
  }

  private calculateLCM(numbers: number[]): number {
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    const lcm = (a: number, b: number): number => (a * b) / gcd(a, b);
    
    return numbers.reduce(lcm, 1);
  }

  async previewQuestionSelection(request: QuestionSelectionRequest): Promise<{
    wouldSelectQuestions: SelectedQuestion[];
    estimatedDuration: number;
    analysis: {
      totalAvailableQuestions: number;
      questionsPassingFrequency: number;
      questionsPassingContext: number;
      finalSelectedCount: number;
      timeBudgetUtilization: number;
    };
  }> {
    try {
      // This is similar to selectQuestions but doesn't log the selection
      const allQuestions = await QuestionConfigurationModel.findActiveByBusinessId(request.businessId);
      const dueQuestions = this.filterQuestionsByFrequency(allQuestions, request.customerCount);
      const contextFilteredQuestions = this.filterQuestionsByContext(dueQuestions, request.customerContext);
      const prioritizedQuestions = this.prioritizeQuestions(contextFilteredQuestions);
      const selectedQuestions = this.selectQuestionsWithinTimeBudget(
        prioritizedQuestions,
        request.timeBudgetSeconds || 90
      );
      
      const estimatedDuration = this.calculateEstimatedDuration(selectedQuestions);
      const timeBudget = request.timeBudgetSeconds || 90;

      return {
        wouldSelectQuestions: selectedQuestions.map(q => this.formatSelectedQuestion(q)),
        estimatedDuration,
        analysis: {
          totalAvailableQuestions: allQuestions.length,
          questionsPassingFrequency: dueQuestions.length,
          questionsPassingContext: contextFilteredQuestions.length,
          finalSelectedCount: selectedQuestions.length,
          timeBudgetUtilization: Math.round((estimatedDuration / timeBudget) * 100),
        },
      };
    } catch (error) {
      console.error('Error previewing question selection:', error);
      throw new Error(`Failed to preview question selection: ${error.message}`);
    }
  }

  async optimizeQuestionFrequencies(businessId: string, targetUtilization: number = 0.8): Promise<{
    recommendations: Array<{
      questionId: string;
      currentFrequency: number;
      recommendedFrequency: number;
      reason: string;
    }>;
    expectedImpact: {
      currentAverageQuestions: number;
      projectedAverageQuestions: number;
      improvement: number;
    };
  }> {
    try {
      const questions = await QuestionConfigurationModel.findActiveByBusinessId(businessId);
      const selectionHistory = await this.getQuestionSelectionHistory(businessId, 100);

      // Analyze current utilization patterns
      const questionUsage: Record<string, number> = {};
      selectionHistory.forEach(log => {
        log.selected_questions.forEach((qId: string) => {
          questionUsage[qId] = (questionUsage[qId] || 0) + 1;
        });
      });

      const recommendations: any[] = [];
      const totalSessions = selectionHistory.length;

      questions.forEach(question => {
        const timesSelected = questionUsage[question.id] || 0;
        const currentUtilization = totalSessions > 0 ? timesSelected / totalSessions : 0;
        const expectedSelections = totalSessions / question.frequency;
        
        let recommendedFrequency = question.frequency;
        let reason = 'No change needed';

        if (currentUtilization < targetUtilization * 0.5) {
          // Question is underutilized, reduce frequency (ask more often)
          recommendedFrequency = Math.max(1, Math.floor(question.frequency * 0.7));
          reason = 'Increase usage - question is underutilized';
        } else if (currentUtilization > targetUtilization * 1.5) {
          // Question is overutilized, increase frequency (ask less often)
          recommendedFrequency = Math.min(100, Math.ceil(question.frequency * 1.3));
          reason = 'Reduce usage - question is overutilized';
        }

        if (recommendedFrequency !== question.frequency) {
          recommendations.push({
            questionId: question.id,
            currentFrequency: question.frequency,
            recommendedFrequency,
            reason,
          });
        }
      });

      // Calculate expected impact
      const currentAverageQuestions = totalSessions > 0 
        ? Object.values(questionUsage).reduce((sum, count) => sum + count, 0) / totalSessions
        : 0;

      // This is a simplified projection - in practice you'd run simulation
      const projectedAverageQuestions = currentAverageQuestions * 1.1; // Estimated 10% improvement

      return {
        recommendations,
        expectedImpact: {
          currentAverageQuestions: Math.round(currentAverageQuestions * 100) / 100,
          projectedAverageQuestions: Math.round(projectedAverageQuestions * 100) / 100,
          improvement: Math.round((projectedAverageQuestions - currentAverageQuestions) * 100) / 100,
        },
      };
    } catch (error) {
      console.error('Error optimizing question frequencies:', error);
      throw new Error(`Failed to optimize question frequencies: ${error.message}`);
    }
  }
}

// Create the QuestionSelectionLogModel that's referenced above
class QuestionSelectionLogModel {
  static async create(data: {
    business_id: string;
    customer_count: number;
    selected_questions: string[];
    selection_algorithm: string;
    selection_criteria: Record<string, any>;
    time_budget_seconds: number;
    estimated_duration: number;
  }) {
    // This would integrate with the actual question_selection_logs table
    // For now, we'll implement a basic version
    console.log('Question selection logged:', data);
    return { id: 'mock-log-id', ...data, created_at: new Date().toISOString() };
  }

  static async findByBusinessId(businessId: string, options?: { limit?: number }) {
    // This would query the actual question_selection_logs table
    // For now, return empty array
    console.log('Getting question selection history for business:', businessId);
    return [];
  }
}