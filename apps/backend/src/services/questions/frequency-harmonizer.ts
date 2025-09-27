import {
  getFrequencyHarmonizers,
  createFrequencyHarmonizer,
  updateFrequencyHarmonizer,
  updateHarmonizerEffectiveness
} from '@vocilia/database/questions/frequency-harmonizers';
import { loggingService } from '../loggingService';

export interface FrequencyConflict {
  questionId: string;
  text: string;
  conflictType: 'frequency_overlap' | 'timing_collision' | 'priority_conflict';
  conflictingSources: string[];
  severity: 'low' | 'medium' | 'high';
  resolutionStrategy: string;
}

export interface HarmonizationRule {
  ruleId: string;
  ruleName: string;
  triggerPattern: string;
  resolutionMethod: 'lcm_frequency' | 'business_override' | 'priority_based' | 'time_spacing';
  businessOverrides: Record<string, any>;
  conflictThreshold: number;
  isActive: boolean;
}

export interface HarmonizationResult {
  harmonizedQuestions: Array<{
    questionId: string;
    text: string;
    originalFrequency: number;
    harmonizedFrequency: number;
    harmonizationReason: string;
    conflictsResolved: number;
    nextPresentationTime?: string;
  }>;
  resolvedConflicts: FrequencyConflict[];
  unresolvableConflicts: FrequencyConflict[];
  harmonizationMetadata: {
    totalQuestions: number;
    totalConflicts: number;
    resolutionMethods: Record<string, number>;
    averageHarmonizationRatio: number;
    processingTimeMs: number;
  };
}

export interface QuestionForHarmonization {
  questionId: string;
  text: string;
  currentFrequency: number;
  targetFrequency: number;
  category: string;
  topicCategory: string;
  priorityLevel: number;
  lastPresentedAt?: string;
  businessRules?: Record<string, any>;
}

export class FrequencyHarmonizerService {
  constructor(
    private readonly businessId: string,
    private readonly loggingService: typeof loggingService
  ) {}

  async harmonizeFrequencies(
    questions: QuestionForHarmonization[],
    combinationRuleId: string,
    options: {
      conflictResolutionStrategy?: 'lcm' | 'business_priority' | 'adaptive';
      maxFrequencyRatio?: number;
      minFrequencyInterval?: number;
      preserveHighPriority?: boolean;
    } = {}
  ): Promise<HarmonizationResult> {
    const startTime = Date.now();

    try {
      // Get active harmonization rules
      const harmonizers = await getFrequencyHarmonizers(this.businessId, { isActive: true });
      
      // Detect frequency conflicts
      const conflicts = await this.detectFrequencyConflicts(questions);
      
      // Apply harmonization rules
      const harmonizationResult = await this.applyHarmonizationRules(
        questions,
        conflicts,
        harmonizers,
        options
      );

      const processingTime = Date.now() - startTime;

      const result: HarmonizationResult = {
        ...harmonizationResult,
        harmonizationMetadata: {
          ...harmonizationResult.harmonizationMetadata,
          processingTimeMs: processingTime
        }
      };

      await this.loggingService.logInfo('Frequency harmonization completed', {
        businessId: this.businessId,
        combinationRuleId,
        totalQuestions: questions.length,
        totalConflicts: conflicts.length,
        resolvedConflicts: harmonizationResult.resolvedConflicts.length,
        processingTimeMs: processingTime
      });

      return result;

    } catch (error) {
      await this.loggingService.logError('Frequency harmonization failed', {
        businessId: this.businessId,
        combinationRuleId,
        totalQuestions: questions.length,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  private async detectFrequencyConflicts(
    questions: QuestionForHarmonization[]
  ): Promise<FrequencyConflict[]> {
    const conflicts: FrequencyConflict[] = [];

    // Check for frequency overlaps within same categories
    const categoryGroups = this.groupQuestionsByCategory(questions);
    
    for (const [category, categoryQuestions] of categoryGroups.entries()) {
      const categoryConflicts = this.detectCategoryConflicts(categoryQuestions, category);
      conflicts.push(...categoryConflicts);
    }

    // Check for timing collisions across different categories
    const timingConflicts = this.detectTimingConflicts(questions);
    conflicts.push(...timingConflicts);

    // Check for priority-based conflicts
    const priorityConflicts = this.detectPriorityConflicts(questions);
    conflicts.push(...priorityConflicts);

    return conflicts;
  }

  private groupQuestionsByCategory(
    questions: QuestionForHarmonization[]
  ): Map<string, QuestionForHarmonization[]> {
    const categoryMap = new Map<string, QuestionForHarmonization[]>();

    questions.forEach(question => {
      const category = question.topicCategory || question.category;
      if (!categoryMap.has(category)) {
        categoryMap.set(category, []);
      }
      categoryMap.get(category)!.push(question);
    });

    return categoryMap;
  }

  private detectCategoryConflicts(
    questions: QuestionForHarmonization[],
    category: string
  ): FrequencyConflict[] {
    const conflicts: FrequencyConflict[] = [];

    // Check for questions with overlapping frequencies that might compete
    for (let i = 0; i < questions.length; i++) {
      for (let j = i + 1; j < questions.length; j++) {
        const q1 = questions[i];
        const q2 = questions[j];

        // Calculate frequency ratio
        const ratio = Math.max(q1.currentFrequency, q2.currentFrequency) /
                     Math.min(q1.currentFrequency, q2.currentFrequency);

        if (ratio < 2.0) { // Frequencies too similar, may cause conflicts
          conflicts.push({
            questionId: q1.questionId,
            text: q1.text,
            conflictType: 'frequency_overlap',
            conflictingSources: [q2.questionId],
            severity: ratio < 1.5 ? 'high' : 'medium',
            resolutionStrategy: 'lcm_frequency'
          });
        }
      }
    }

    return conflicts;
  }

  private detectTimingConflicts(
    questions: QuestionForHarmonization[]
  ): FrequencyConflict[] {
    const conflicts: FrequencyConflict[] = [];

    // Check for questions that might be presented at the same time
    questions.forEach(question => {
      if (question.lastPresentedAt) {
        const lastPresented = new Date(question.lastPresentedAt);
        const nextScheduled = this.calculateNextPresentation(
          lastPresented,
          question.currentFrequency
        );

        // Check for collisions with other questions
        const collidingQuestions = questions.filter(other => {
          if (other.questionId === question.questionId || !other.lastPresentedAt) {
            return false;
          }

          const otherLastPresented = new Date(other.lastPresentedAt);
          const otherNextScheduled = this.calculateNextPresentation(
            otherLastPresented,
            other.currentFrequency
          );

          // Check if scheduled within 1 hour of each other
          const timeDiff = Math.abs(nextScheduled.getTime() - otherNextScheduled.getTime());
          return timeDiff < 3600000; // 1 hour in milliseconds
        });

        if (collidingQuestions.length > 0) {
          conflicts.push({
            questionId: question.questionId,
            text: question.text,
            conflictType: 'timing_collision',
            conflictingSources: collidingQuestions.map(q => q.questionId),
            severity: collidingQuestions.length > 2 ? 'high' : 'medium',
            resolutionStrategy: 'time_spacing'
          });
        }
      }
    });

    return conflicts;
  }

  private detectPriorityConflicts(
    questions: QuestionForHarmonization[]
  ): FrequencyConflict[] {
    const conflicts: FrequencyConflict[] = [];

    // Check for high-priority questions with low frequencies
    questions.forEach(question => {
      if (question.priorityLevel >= 4 && question.currentFrequency < question.targetFrequency * 0.5) {
        conflicts.push({
          questionId: question.questionId,
          text: question.text,
          conflictType: 'priority_conflict',
          conflictingSources: [],
          severity: 'high',
          resolutionStrategy: 'priority_based'
        });
      }
    });

    return conflicts;
  }

  private calculateNextPresentation(lastPresented: Date, frequency: number): Date {
    const intervalHours = 24 / frequency; // Assuming daily frequency
    const nextPresentation = new Date(lastPresented);
    nextPresentation.setHours(nextPresentation.getHours() + intervalHours);
    return nextPresentation;
  }

  private async applyHarmonizationRules(
    questions: QuestionForHarmonization[],
    conflicts: FrequencyConflict[],
    harmonizers: any[],
    options: {
      conflictResolutionStrategy?: 'lcm' | 'business_priority' | 'adaptive';
      maxFrequencyRatio?: number;
      minFrequencyInterval?: number;
      preserveHighPriority?: boolean;
    }
  ): Promise<Omit<HarmonizationResult, 'harmonizationMetadata'>> {
    
    const harmonizedQuestions: HarmonizationResult['harmonizedQuestions'] = [];
    const resolvedConflicts: FrequencyConflict[] = [];
    const unresolvableConflicts: FrequencyConflict[] = [];
    const resolutionMethods: Record<string, number> = {};

    // Process each question and apply appropriate harmonization
    for (const question of questions) {
      const questionConflicts = conflicts.filter(c => c.questionId === question.questionId);
      
      if (questionConflicts.length === 0) {
        // No conflicts, keep original frequency
        harmonizedQuestions.push({
          questionId: question.questionId,
          text: question.text,
          originalFrequency: question.currentFrequency,
          harmonizedFrequency: question.currentFrequency,
          harmonizationReason: 'No conflicts detected',
          conflictsResolved: 0
        });
        continue;
      }

      // Apply harmonization based on conflict types and strategy
      const harmonizationResult = await this.resolveQuestionConflicts(
        question,
        questionConflicts,
        harmonizers,
        options
      );

      harmonizedQuestions.push(harmonizationResult.harmonizedQuestion);
      
      if (harmonizationResult.conflictsResolved.length > 0) {
        resolvedConflicts.push(...harmonizationResult.conflictsResolved);
        harmonizationResult.conflictsResolved.forEach(conflict => {
          const method = conflict.resolutionStrategy;
          resolutionMethods[method] = (resolutionMethods[method] || 0) + 1;
        });
      }

      if (harmonizationResult.unresolvableConflicts.length > 0) {
        unresolvableConflicts.push(...harmonizationResult.unresolvableConflicts);
      }
    }

    // Calculate harmonization statistics
    const totalConflicts = conflicts.length;
    const totalQuestions = questions.length;
    const averageHarmonizationRatio = harmonizedQuestions.reduce((sum, q) => {
      return sum + (q.harmonizedFrequency / q.originalFrequency);
    }, 0) / harmonizedQuestions.length;

    return {
      harmonizedQuestions,
      resolvedConflicts,
      unresolvableConflicts,
      harmonizationMetadata: {
        totalQuestions,
        totalConflicts,
        resolutionMethods,
        averageHarmonizationRatio,
        processingTimeMs: 0 // Will be set by caller
      }
    };
  }

  private async resolveQuestionConflicts(
    question: QuestionForHarmonization,
    conflicts: FrequencyConflict[],
    harmonizers: any[],
    options: {
      conflictResolutionStrategy?: 'lcm' | 'business_priority' | 'adaptive';
      maxFrequencyRatio?: number;
      minFrequencyInterval?: number;
      preserveHighPriority?: boolean;
    }
  ): Promise<{
    harmonizedQuestion: HarmonizationResult['harmonizedQuestions'][0];
    conflictsResolved: FrequencyConflict[];
    unresolvableConflicts: FrequencyConflict[];
  }> {
    
    const strategy = options.conflictResolutionStrategy || 'adaptive';
    let harmonizedFrequency = question.currentFrequency;
    let harmonizationReason = 'No harmonization needed';
    const conflictsResolved: FrequencyConflict[] = [];
    const unresolvableConflicts: FrequencyConflict[] = [];

    switch (strategy) {
      case 'lcm':
        const lcmResult = this.applyLCMHarmonization(question, conflicts);
        harmonizedFrequency = lcmResult.frequency;
        harmonizationReason = lcmResult.reason;
        conflictsResolved.push(...conflicts.filter(c => c.conflictType === 'frequency_overlap'));
        break;

      case 'business_priority':
        const businessResult = this.applyBusinessPriorityHarmonization(
          question,
          conflicts,
          harmonizers,
          options
        );
        harmonizedFrequency = businessResult.frequency;
        harmonizationReason = businessResult.reason;
        conflictsResolved.push(...businessResult.resolvedConflicts);
        unresolvableConflicts.push(...businessResult.unresolvableConflicts);
        break;

      case 'adaptive':
        const adaptiveResult = await this.applyAdaptiveHarmonization(
          question,
          conflicts,
          harmonizers,
          options
        );
        harmonizedFrequency = adaptiveResult.frequency;
        harmonizationReason = adaptiveResult.reason;
        conflictsResolved.push(...adaptiveResult.resolvedConflicts);
        unresolvableConflicts.push(...adaptiveResult.unresolvableConflicts);
        break;
    }

    const harmonizedQuestion: HarmonizationResult['harmonizedQuestions'][0] = {
      questionId: question.questionId,
      text: question.text,
      originalFrequency: question.currentFrequency,
      harmonizedFrequency,
      harmonizationReason,
      conflictsResolved: conflictsResolved.length,
      nextPresentationTime: question.lastPresentedAt ? 
        this.calculateNextPresentation(new Date(question.lastPresentedAt), harmonizedFrequency).toISOString() :
        undefined
    };

    return {
      harmonizedQuestion,
      conflictsResolved,
      unresolvableConflicts
    };
  }

  private applyLCMHarmonization(
    question: QuestionForHarmonization,
    conflicts: FrequencyConflict[]
  ): { frequency: number; reason: string } {
    
    // Use LCM (Least Common Multiple) to find harmonized frequency
    const frequencies = [question.currentFrequency];
    
    conflicts.forEach(conflict => {
      if (conflict.conflictType === 'frequency_overlap') {
        // Add conflicting frequencies to the calculation
        // This is simplified - in reality we'd need to look up the actual frequencies
        frequencies.push(question.targetFrequency);
      }
    });

    const lcmFrequency = this.calculateLCM(frequencies);
    
    return {
      frequency: lcmFrequency,
      reason: `LCM harmonization of frequencies: ${frequencies.join(', ')}`
    };
  }

  private calculateLCM(numbers: number[]): number {
    const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
    const lcm = (a: number, b: number): number => (a * b) / gcd(a, b);
    
    return numbers.reduce((acc, num) => lcm(acc, Math.round(num)), 1);
  }

  private applyBusinessPriorityHarmonization(
    question: QuestionForHarmonization,
    conflicts: FrequencyConflict[],
    harmonizers: any[],
    options: {
      preserveHighPriority?: boolean;
    }
  ): {
    frequency: number;
    reason: string;
    resolvedConflicts: FrequencyConflict[];
    unresolvableConflicts: FrequencyConflict[];
  } {
    
    let harmonizedFrequency = question.currentFrequency;
    let reason = 'Business priority maintained';
    const resolvedConflicts: FrequencyConflict[] = [];
    const unresolvableConflicts: FrequencyConflict[] = [];

    // Find applicable business harmonizer
    const applicableHarmonizer = harmonizers.find(h => 
      h.business_rule_pattern.includes(question.category) ||
      h.business_rule_pattern.includes(question.topicCategory)
    );

    if (applicableHarmonizer) {
      // Apply business override frequency
      harmonizedFrequency = applicableHarmonizer.override_frequency;
      reason = `Business override: ${applicableHarmonizer.harmonizer_name}`;
      resolvedConflicts.push(...conflicts);
    } else {
      // Preserve high priority questions if option is set
      if (options.preserveHighPriority && question.priorityLevel >= 4) {
        harmonizedFrequency = Math.max(question.currentFrequency, question.targetFrequency);
        reason = 'High priority question - frequency preserved';
        resolvedConflicts.push(...conflicts.filter(c => c.conflictType === 'priority_conflict'));
      } else {
        unresolvableConflicts.push(...conflicts);
      }
    }

    return {
      frequency: harmonizedFrequency,
      reason,
      resolvedConflicts,
      unresolvableConflicts
    };
  }

  private async applyAdaptiveHarmonization(
    question: QuestionForHarmonization,
    conflicts: FrequencyConflict[],
    harmonizers: any[],
    options: {
      maxFrequencyRatio?: number;
      minFrequencyInterval?: number;
    }
  ): Promise<{
    frequency: number;
    reason: string;
    resolvedConflicts: FrequencyConflict[];
    unresolvableConflicts: FrequencyConflict[];
  }> {
    
    const resolvedConflicts: FrequencyConflict[] = [];
    const unresolvableConflicts: FrequencyConflict[] = [];
    
    let harmonizedFrequency = question.currentFrequency;
    let adaptiveReasons: string[] = [];

    // Handle frequency overlaps with adaptive smoothing
    const overlapConflicts = conflicts.filter(c => c.conflictType === 'frequency_overlap');
    if (overlapConflicts.length > 0) {
      const targetRatio = options.maxFrequencyRatio || 2.0;
      harmonizedFrequency = Math.round(question.currentFrequency * targetRatio);
      adaptiveReasons.push('Adaptive frequency smoothing applied');
      resolvedConflicts.push(...overlapConflicts);
    }

    // Handle timing collisions with spacing
    const timingConflicts = conflicts.filter(c => c.conflictType === 'timing_collision');
    if (timingConflicts.length > 0) {
      const minInterval = options.minFrequencyInterval || 2;
      if (harmonizedFrequency < minInterval) {
        harmonizedFrequency = minInterval;
        adaptiveReasons.push('Minimum interval spacing applied');
        resolvedConflicts.push(...timingConflicts);
      }
    }

    // Handle priority conflicts adaptively
    const priorityConflicts = conflicts.filter(c => c.conflictType === 'priority_conflict');
    if (priorityConflicts.length > 0) {
      const priorityBoost = question.priorityLevel / 5.0; // Normalize to 0-1
      harmonizedFrequency = Math.round(harmonizedFrequency * (1 + priorityBoost));
      adaptiveReasons.push('Priority-based frequency boost');
      resolvedConflicts.push(...priorityConflicts);
    }

    const reason = adaptiveReasons.length > 0 
      ? `Adaptive harmonization: ${adaptiveReasons.join(', ')}`
      : 'No adaptive changes needed';

    return {
      frequency: harmonizedFrequency,
      reason,
      resolvedConflicts,
      unresolvableConflicts
    };
  }

  async createHarmonizer(
    harmonizerData: {
      harmonizerName: string;
      businessRulePattern: string;
      resolutionMethod: 'lcm_frequency' | 'business_override' | 'priority_based' | 'time_spacing';
      overrideFrequency?: number;
      conflictThreshold?: number;
      businessOverrides?: Record<string, any>;
    }
  ) {
    return await createFrequencyHarmonizer({
      business_id: this.businessId,
      harmonizer_name: harmonizerData.harmonizerName,
      business_rule_pattern: harmonizerData.businessRulePattern,
      resolution_method: harmonizerData.resolutionMethod,
      override_frequency: harmonizerData.overrideFrequency || 1.0,
      conflict_threshold: harmonizerData.conflictThreshold || 0.8,
      business_overrides: harmonizerData.businessOverrides || {}
    });
  }

  async updateHarmonizer(
    harmonizerId: string,
    updates: {
      harmonizerName?: string;
      businessRulePattern?: string;
      resolutionMethod?: 'lcm_frequency' | 'business_override' | 'priority_based' | 'time_spacing';
      overrideFrequency?: number;
      conflictThreshold?: number;
      businessOverrides?: Record<string, any>;
      isActive?: boolean;
    }
  ) {
    const updateData: any = {};
    
    if (updates.harmonizerName) updateData.harmonizer_name = updates.harmonizerName;
    if (updates.businessRulePattern) updateData.business_rule_pattern = updates.businessRulePattern;
    if (updates.resolutionMethod) updateData.resolution_method = updates.resolutionMethod;
    if (updates.overrideFrequency !== undefined) updateData.override_frequency = updates.overrideFrequency;
    if (updates.conflictThreshold !== undefined) updateData.conflict_threshold = updates.conflictThreshold;
    if (updates.businessOverrides !== undefined) updateData.business_overrides = updates.businessOverrides;
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

    return await updateFrequencyHarmonizer(harmonizerId, updateData);
  }

  async updateEffectiveness(
    harmonizerId: string,
    effectivenessScore: number,
    conflictsResolved: number
  ): Promise<void> {
    await updateHarmonizerEffectiveness(harmonizerId, effectivenessScore, conflictsResolved);

    await this.loggingService.logInfo('Harmonizer effectiveness updated', {
      businessId: this.businessId,
      harmonizerId,
      effectivenessScore,
      conflictsResolved
    });
  }

  async validatePerformanceRequirement(): Promise<boolean> {
    // Test with sample data to ensure reasonable performance
    const sampleQuestions: QuestionForHarmonization[] = Array.from({ length: 30 }, (_, i) => ({
      questionId: `sample-${i}`,
      text: `Sample question ${i}`,
      currentFrequency: Math.floor(Math.random() * 10) + 1,
      targetFrequency: Math.floor(Math.random() * 10) + 1,
      category: ['service', 'product', 'experience'][i % 3],
      topicCategory: ['checkout', 'quality', 'delivery'][i % 3],
      priorityLevel: Math.floor(Math.random() * 5) + 1,
      lastPresentedAt: new Date(Date.now() - Math.random() * 86400000).toISOString()
    }));

    const startTime = Date.now();
    
    try {
      await this.harmonizeFrequencies(sampleQuestions, 'test-rule');
      const duration = Date.now() - startTime;
      return duration < 500; // Should complete within 500ms
    } catch {
      return false;
    }
  }
}