import {
  getQuestionGroups,
  createQuestionGroup,
  updateQuestionGroup,
  getQuestionGroupsByCompatibility,
  updateQuestionGroupEffectiveness
} from '@vocilia/database/questions/question-groups';
import { loggingService } from '../loggingService';

export interface TopicGroupingResult {
  groups: Array<{
    groupId: string;
    groupName: string;
    topicCategory: string;
    questions: Array<{
      questionId: string;
      text: string;
      estimatedDuration: number;
      compatibilityScore: number;
      priorityLevel: number;
    }>;
    totalDuration: number;
    averageCompatibility: number;
    groupPriorityBoost: number;
  }>;
  ungroupedQuestions: Array<{
    questionId: string;
    text: string;
    reason: string;
  }>;
  groupingMetadata: {
    totalGroups: number;
    averageGroupSize: number;
    groupingConfidence: number;
    processingTimeMs: number;
  };
}

export interface QuestionForGrouping {
  questionId: string;
  text: string;
  category: string;
  topicCategory: string;
  estimatedTokens: number;
  priorityLevel: number;
  keywords?: string[];
  semanticVector?: number[];
}

export class TopicGroupingService {
  constructor(
    private readonly businessId: string,
    private readonly loggingService: typeof loggingService
  ) {}

  async groupQuestionsByTopic(
    questions: QuestionForGrouping[],
    options: {
      maxGroupSize?: number;
      minCompatibilityScore?: number;
      useSemanticSimilarity?: boolean;
      preserveExistingGroups?: boolean;
    } = {}
  ): Promise<TopicGroupingResult> {
    const startTime = Date.now();
    
    try {
      const {
        maxGroupSize = 4,
        minCompatibilityScore = 0.6,
        useSemanticSimilarity = true,
        preserveExistingGroups = true
      } = options;

      // Get existing question groups for this business
      const existingGroups = preserveExistingGroups 
        ? await getQuestionGroups(this.businessId, { isActive: true })
        : [];

      // Initialize result structure
      const resultGroups: TopicGroupingResult['groups'] = [];
      const ungroupedQuestions: TopicGroupingResult['ungroupedQuestions'] = [];
      const processedQuestions = new Set<string>();

      // First, try to assign questions to existing groups
      if (existingGroups.length > 0) {
        await this.assignToExistingGroups(
          questions,
          existingGroups,
          resultGroups,
          processedQuestions,
          minCompatibilityScore
        );
      }

      // Group remaining questions by topic category
      const remainingQuestions = questions.filter(q => !processedQuestions.has(q.questionId));
      const categoryGroups = this.groupByTopicCategory(remainingQuestions);

      // Apply semantic similarity grouping within categories if enabled
      if (useSemanticSimilarity) {
        await this.applySemanticGrouping(categoryGroups, maxGroupSize, minCompatibilityScore);
      }

      // Create result groups for new groupings
      for (const [category, categoryQuestions] of categoryGroups.entries()) {
        if (categoryQuestions.length === 0) continue;

        // Create subgroups if category has too many questions
        const subgroups = this.createSubgroups(categoryQuestions, maxGroupSize);
        
        for (let i = 0; i < subgroups.length; i++) {
          const subgroup = subgroups[i];
          const groupName = subgroups.length > 1 
            ? `${category.replace('_', ' ')} - Group ${i + 1}`
            : category.replace('_', ' ');

          const totalDuration = subgroup.reduce((sum, q) => sum + (q.estimatedTokens / 4.2), 0);
          const averageCompatibility = this.calculateGroupCompatibility(subgroup);
          const groupPriorityBoost = this.calculatePriorityBoost(subgroup);

          resultGroups.push({
            groupId: `new-${category}-${i}`,
            groupName,
            topicCategory: category,
            questions: subgroup.map(q => ({
              questionId: q.questionId,
              text: q.text,
              estimatedDuration: q.estimatedTokens / 4.2,
              compatibilityScore: averageCompatibility,
              priorityLevel: q.priorityLevel
            })),
            totalDuration,
            averageCompatibility,
            groupPriorityBoost
          });

          subgroup.forEach(q => processedQuestions.add(q.questionId));
        }
      }

      // Handle questions that couldn't be grouped
      const finalUngrouped = questions.filter(q => !processedQuestions.has(q.questionId));
      finalUngrouped.forEach(q => {
        ungroupedQuestions.push({
          questionId: q.questionId,
          text: q.text,
          reason: 'Low compatibility with existing groups or insufficient similar questions'
        });
      });

      const processingTime = Date.now() - startTime;
      
      const result: TopicGroupingResult = {
        groups: resultGroups,
        ungroupedQuestions,
        groupingMetadata: {
          totalGroups: resultGroups.length,
          averageGroupSize: resultGroups.length > 0 
            ? resultGroups.reduce((sum, g) => sum + g.questions.length, 0) / resultGroups.length 
            : 0,
          groupingConfidence: this.calculateOverallConfidence(resultGroups),
          processingTimeMs: processingTime
        }
      };

      await this.loggingService.logInfo('Topic grouping completed', {
        businessId: this.businessId,
        totalQuestions: questions.length,
        totalGroups: resultGroups.length,
        ungroupedQuestions: ungroupedQuestions.length,
        processingTimeMs: processingTime
      });

      return result;

    } catch (error) {
      await this.loggingService.logError('Topic grouping failed', {
        businessId: this.businessId,
        totalQuestions: questions.length,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  private async assignToExistingGroups(
    questions: QuestionForGrouping[],
    existingGroups: any[],
    resultGroups: TopicGroupingResult['groups'],
    processedQuestions: Set<string>,
    minCompatibilityScore: number
  ): Promise<void> {
    for (const group of existingGroups) {
      const matchingQuestions = questions.filter(q => 
        q.topicCategory === group.topic_category && 
        !processedQuestions.has(q.questionId)
      );

      if (matchingQuestions.length === 0) continue;

      // Filter by compatibility score
      const compatibleQuestions = matchingQuestions.filter(q => 
        this.calculateQuestionCompatibility(q, group) >= minCompatibilityScore
      );

      if (compatibleQuestions.length > 0) {
        const totalDuration = compatibleQuestions.reduce((sum, q) => sum + (q.estimatedTokens / 4.2), 0);
        const averageCompatibility = this.calculateGroupCompatibility(compatibleQuestions);

        resultGroups.push({
          groupId: group.id,
          groupName: group.group_name,
          topicCategory: group.topic_category,
          questions: compatibleQuestions.map(q => ({
            questionId: q.questionId,
            text: q.text,
            estimatedDuration: q.estimatedTokens / 4.2,
            compatibilityScore: this.calculateQuestionCompatibility(q, group),
            priorityLevel: q.priorityLevel
          })),
          totalDuration,
          averageCompatibility,
          groupPriorityBoost: group.priority_boost
        });

        compatibleQuestions.forEach(q => processedQuestions.add(q.questionId));
      }
    }
  }

  private groupByTopicCategory(questions: QuestionForGrouping[]): Map<string, QuestionForGrouping[]> {
    const categoryMap = new Map<string, QuestionForGrouping[]>();

    questions.forEach(question => {
      const category = question.topicCategory || question.category || 'general';
      if (!categoryMap.has(category)) {
        categoryMap.set(category, []);
      }
      categoryMap.get(category)!.push(question);
    });

    return categoryMap;
  }

  private async applySemanticGrouping(
    categoryGroups: Map<string, QuestionForGrouping[]>,
    maxGroupSize: number,
    minCompatibilityScore: number
  ): Promise<void> {
    // Apply semantic similarity within each category
    for (const [category, questions] of categoryGroups.entries()) {
      if (questions.length <= 1) continue;

      // Calculate semantic similarity matrix
      const similarityMatrix = this.calculateSimilarityMatrix(questions);
      
      // Apply clustering based on similarity
      const clusters = this.clusterBySimilarity(questions, similarityMatrix, minCompatibilityScore);
      
      // Update the category group with clustered results
      categoryGroups.set(category, clusters.flat());
    }
  }

  private calculateSimilarityMatrix(questions: QuestionForGrouping[]): number[][] {
    const n = questions.length;
    const matrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = i; j < n; j++) {
        if (i === j) {
          matrix[i][j] = 1.0;
        } else {
          const similarity = this.calculateSemanticSimilarity(questions[i], questions[j]);
          matrix[i][j] = similarity;
          matrix[j][i] = similarity;
        }
      }
    }

    return matrix;
  }

  private calculateSemanticSimilarity(q1: QuestionForGrouping, q2: QuestionForGrouping): number {
    // Simple semantic similarity based on keywords and category
    let similarity = 0;

    // Category match
    if (q1.category === q2.category) {
      similarity += 0.3;
    }

    if (q1.topicCategory === q2.topicCategory) {
      similarity += 0.2;
    }

    // Keyword overlap
    if (q1.keywords && q2.keywords) {
      const intersection = q1.keywords.filter(k => q2.keywords!.includes(k));
      const union = [...new Set([...q1.keywords, ...q2.keywords])];
      similarity += 0.3 * (intersection.length / union.length);
    }

    // Text similarity (simple word overlap)
    const words1 = q1.text.toLowerCase().split(/\s+/);
    const words2 = q2.text.toLowerCase().split(/\s+/);
    const wordIntersection = words1.filter(w => words2.includes(w) && w.length > 3);
    const wordUnion = [...new Set([...words1, ...words2])];
    similarity += 0.2 * (wordIntersection.length / wordUnion.length);

    return Math.min(1.0, similarity);
  }

  private clusterBySimilarity(
    questions: QuestionForGrouping[],
    similarityMatrix: number[][],
    minSimilarity: number
  ): QuestionForGrouping[][] {
    const clusters: QuestionForGrouping[][] = [];
    const processed = new Set<number>();

    for (let i = 0; i < questions.length; i++) {
      if (processed.has(i)) continue;

      const cluster = [questions[i]];
      processed.add(i);

      // Find similar questions
      for (let j = i + 1; j < questions.length; j++) {
        if (processed.has(j)) continue;
        
        if (similarityMatrix[i][j] >= minSimilarity) {
          cluster.push(questions[j]);
          processed.add(j);
        }
      }

      clusters.push(cluster);
    }

    return clusters;
  }

  private createSubgroups(questions: QuestionForGrouping[], maxGroupSize: number): QuestionForGrouping[][] {
    if (questions.length <= maxGroupSize) {
      return [questions];
    }

    const subgroups: QuestionForGrouping[][] = [];
    const sortedQuestions = [...questions].sort((a, b) => b.priorityLevel - a.priorityLevel);

    for (let i = 0; i < sortedQuestions.length; i += maxGroupSize) {
      subgroups.push(sortedQuestions.slice(i, i + maxGroupSize));
    }

    return subgroups;
  }

  private calculateQuestionCompatibility(question: QuestionForGrouping, group: any): number {
    let compatibility = 0;

    // Topic category match
    if (question.topicCategory === group.topic_category) {
      compatibility += 0.4;
    }

    // Category match
    if (question.category === group.topic_category) {
      compatibility += 0.3;
    }

    // Duration compatibility (similar estimated duration)
    const questionDuration = question.estimatedTokens / 4.2;
    const groupDuration = group.estimated_duration_seconds || 30;
    const durationRatio = Math.min(questionDuration, groupDuration) / Math.max(questionDuration, groupDuration);
    compatibility += 0.3 * durationRatio;

    return Math.min(1.0, compatibility);
  }

  private calculateGroupCompatibility(questions: QuestionForGrouping[]): number {
    if (questions.length <= 1) return 1.0;

    let totalSimilarity = 0;
    let comparisons = 0;

    for (let i = 0; i < questions.length; i++) {
      for (let j = i + 1; j < questions.length; j++) {
        totalSimilarity += this.calculateSemanticSimilarity(questions[i], questions[j]);
        comparisons++;
      }
    }

    return comparisons > 0 ? totalSimilarity / comparisons : 0;
  }

  private calculatePriorityBoost(questions: QuestionForGrouping[]): number {
    const averagePriority = questions.reduce((sum, q) => sum + q.priorityLevel, 0) / questions.length;
    
    // Convert average priority to boost factor
    return Math.max(1.0, averagePriority / 3.0);
  }

  private calculateOverallConfidence(groups: TopicGroupingResult['groups']): number {
    if (groups.length === 0) return 0;

    const totalConfidence = groups.reduce((sum, group) => sum + group.averageCompatibility, 0);
    return totalConfidence / groups.length;
  }

  async createQuestionGroup(
    groupData: {
      groupName: string;
      topicCategory: string;
      compatibilityScore?: number;
      estimatedDurationSeconds?: number;
      priorityBoost?: number;
    }
  ) {
    return await createQuestionGroup({
      business_id: this.businessId,
      group_name: groupData.groupName,
      topic_category: groupData.topicCategory,
      compatibility_score: groupData.compatibilityScore || 0.8,
      estimated_duration_seconds: groupData.estimatedDurationSeconds || 30,
      priority_boost: groupData.priorityBoost || 1.0
    });
  }

  async updateGroupEffectiveness(
    groupId: string,
    effectivenessMetrics: {
      compatibilityScore?: number;
      averageCallDuration?: number;
      customerSatisfaction?: number;
    }
  ): Promise<void> {
    if (effectivenessMetrics.compatibilityScore) {
      await updateQuestionGroupEffectiveness(groupId, effectivenessMetrics.compatibilityScore);
    }

    await this.loggingService.logInfo('Question group effectiveness updated', {
      businessId: this.businessId,
      groupId,
      metrics: effectivenessMetrics
    });
  }

  async getOptimalGroupConfiguration(
    questions: QuestionForGrouping[],
    maxCallDuration: number
  ): Promise<{
    recommendedGroups: TopicGroupingResult['groups'];
    maxQuestionsPerCall: number;
    estimatedCoverage: number;
  }> {
    // Try different grouping configurations to find optimal
    const configurations = [
      { maxGroupSize: 3, minCompatibility: 0.7 },
      { maxGroupSize: 4, minCompatibility: 0.6 },
      { maxGroupSize: 5, minCompatibility: 0.5 }
    ];

    let bestConfig = null;
    let bestScore = 0;

    for (const config of configurations) {
      const result = await this.groupQuestionsByTopic(questions, config);
      
      // Score based on coverage, compatibility, and group balance
      const coverage = (questions.length - result.ungroupedQuestions.length) / questions.length;
      const avgCompatibility = result.groupingMetadata.groupingConfidence;
      const groupBalance = 1 / (Math.abs(result.groupingMetadata.averageGroupSize - 3) + 1);
      
      const score = coverage * 0.5 + avgCompatibility * 0.3 + groupBalance * 0.2;

      if (score > bestScore) {
        bestScore = score;
        bestConfig = result;
      }
    }

    if (!bestConfig) {
      throw new Error('Failed to find optimal group configuration');
    }

    // Calculate max questions per call based on duration constraint
    const avgQuestionDuration = questions.reduce((sum, q) => sum + q.estimatedTokens, 0) / questions.length / 4.2;
    const maxQuestionsPerCall = Math.floor(maxCallDuration / avgQuestionDuration);
    const estimatedCoverage = Math.min(1.0, maxQuestionsPerCall / questions.length);

    return {
      recommendedGroups: bestConfig.groups,
      maxQuestionsPerCall,
      estimatedCoverage
    };
  }
}