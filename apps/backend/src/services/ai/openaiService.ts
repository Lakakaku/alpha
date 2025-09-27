import OpenAI from 'openai';
import { ConversationMessage } from '../../models/conversationTranscript';
import { QualityScores, ActionableItem } from '../../models/qualityAssessment';
import { BusinessContextProfile } from '../../models/businessContextProfile';

export class OpenAIService {
  private client: OpenAI;
  private realtimeClient: any; // OpenAI Realtime client will be initialized separately

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async initializeRealtimeSession(sessionConfig: RealtimeSessionConfig): Promise<string> {
    // Initialize OpenAI Realtime API session for Swedish voice conversation
    const session = await this.client.beta.realtime.sessions.create({
      model: 'gpt-4o-mini-realtime',
      modalities: ['audio', 'text'],
      instructions: this.buildSwedishConversationInstructions(sessionConfig.businessContext),
      voice: 'alloy', // Swedish-optimized voice
      input_audio_format: 'pcm16',
      output_audio_format: 'pcm16',
      turn_detection: {
        type: 'server_vad',
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 500
      },
      temperature: 0.7,
      max_tokens: 150
    });

    return session.id;
  }

  async analyzeConversationQuality(
    transcript: ConversationMessage[], 
    businessContext: BusinessContextProfile
  ): Promise<QualityAnalysisResult> {
    const prompt = this.buildQualityAnalysisPrompt(transcript, businessContext);
    
    const response = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert feedback quality analyst for Swedish retail businesses. Analyze customer feedback conversations and provide structured quality assessments.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2
    });

    const analysis = JSON.parse(response.choices[0].message.content || '{}');
    return this.parseQualityAnalysis(analysis);
  }

  async detectFraud(
    transcript: ConversationMessage[],
    businessContext: BusinessContextProfile,
    checkTypes: string[]
  ): Promise<FraudAnalysisResult> {
    const prompt = this.buildFraudDetectionPrompt(transcript, businessContext, checkTypes);
    
    const response = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a fraud detection specialist for customer feedback systems. Detect suspicious patterns, timing anomalies, and context inconsistencies in Swedish retail feedback conversations.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1 // Lower temperature for consistent fraud detection
    });

    const analysis = JSON.parse(response.choices[0].message.content || '{}');
    return this.parseFraudAnalysis(analysis);
  }

  async generateFeedbackSummary(
    transcript: ConversationMessage[],
    qualityScore: number,
    preserveDetails: boolean = true
  ): Promise<FeedbackSummary> {
    if (qualityScore < 0.02) {
      throw new Error('Feedback quality too low for summarization');
    }

    const prompt = this.buildSummaryPrompt(transcript, preserveDetails);
    
    const response = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a professional feedback summarization specialist. Create concise, actionable summaries of customer feedback while preserving key insights and specific details.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3
    });

    const summary = JSON.parse(response.choices[0].message.content || '{}');
    return this.parseFeedbackSummary(summary);
  }

  async generateWeeklyAnalysis(
    feedbackSummaries: string[],
    storeContext: BusinessContextProfile,
    historicalData?: any[]
  ): Promise<WeeklyAnalysisResult> {
    const prompt = this.buildWeeklyAnalysisPrompt(feedbackSummaries, storeContext, historicalData);
    
    const response = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a business intelligence analyst specializing in Swedish retail customer feedback analysis. Generate comprehensive weekly reports with trends, issues, and actionable recommendations.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.4
    });

    const analysis = JSON.parse(response.choices[0].message.content || '{}');
    return this.parseWeeklyAnalysis(analysis);
  }

  private buildSwedishConversationInstructions(businessContext: BusinessContextProfile): string {
    return `
Du är en vänlig AI-assistent som ringer svenska kunder för att samla feedback om deras butiksupplevelse.

VIKTIGA REGLER:
- Tala ENDAST svenska
- Var naturlig, varm och professionell
- Håll samtalet mellan 60-120 sekunder
- Ställ 2-3 fokuserade frågor baserat på affärskontexten
- Uppmuntra detaljerade svar men respektera om kunden vill avsluta
- Avsluta alltid med tack och bekräftelse

AFFÄRSKONTEXT:
${JSON.stringify(businessContext, null, 2)}

EXEMPEL PÅ INLEDNING:
"Hej! Jag ringer från [Butiksnamn] för att höra vad du tyckte om ditt senaste besök. Det tar bara ett par minuter - har du tid att prata?"

FÖLJDFRÅGOR baserat på affärskontexten och kundens svar.
    `;
  }

  private buildQualityAnalysisPrompt(transcript: ConversationMessage[], businessContext: BusinessContextProfile): string {
    return `
Analyze this Swedish customer feedback conversation for quality and reward eligibility.

CONVERSATION TRANSCRIPT:
${transcript.map(msg => `${msg.speaker}: ${msg.content}`).join('\n')}

BUSINESS CONTEXT:
${JSON.stringify(businessContext, null, 2)}

Analyze and provide JSON response with:
{
  "legitimacy_score": 0.0-1.0, // How genuine/non-fraudulent is this feedback
  "depth_score": 0.0-1.0, // Level of detail and specificity
  "usefulness_score": 0.0-1.0, // Actionable insights for business
  "overall_quality_score": 0.0-1.0, // Combined quality metric
  "is_fraudulent": boolean,
  "fraud_reasons": ["reason1", "reason2"], // If fraudulent
  "key_insights": ["insight1", "insight2"],
  "actionable_items": [
    {
      "category": "product|service|environment|staff|pricing|accessibility",
      "description": "specific actionable item",
      "priority": "low|medium|high|urgent",
      "estimated_impact": "minor|moderate|significant|major"
    }
  ],
  "business_value_reasoning": "explanation of why this feedback is valuable"
}

QUALITY CRITERIA:
- Legitimacy: Consistent with business context, realistic timing, authentic language
- Depth: Specific details, examples, constructive feedback
- Usefulness: Actionable insights, improvement suggestions, clear problems/praise
    `;
  }

  private buildFraudDetectionPrompt(transcript: ConversationMessage[], businessContext: BusinessContextProfile, checkTypes: string[]): string {
    return `
Perform fraud detection analysis on this customer feedback conversation.

CONVERSATION TRANSCRIPT:
${transcript.map(msg => `${msg.speaker}: ${msg.content} [${msg.timestamp_ms}ms]`).join('\n')}

BUSINESS CONTEXT:
${JSON.stringify(businessContext, null, 2)}

CHECK TYPES TO PERFORM: ${checkTypes.join(', ')}

Analyze and provide JSON response with:
{
  "fraud_results": [
    {
      "check_type": "timing|content|context|pattern",
      "is_suspicious": boolean,
      "confidence_level": 0.0-1.0,
      "fraud_indicators": ["indicator1", "indicator2"],
      "context_violations": [
        {
          "violation_type": "hours|location|product|service",
          "expected_value": "expected",
          "actual_value": "actual",
          "severity": "low|medium|high|critical"
        }
      ],
      "reasoning": "detailed explanation"
    }
  ],
  "overall_is_fraudulent": boolean,
  "confidence_level": 0.0-1.0,
  "should_exclude_from_rewards": boolean,
  "summary_reasoning": "overall fraud assessment explanation"
}

FRAUD DETECTION CRITERIA:
- Timing: Conversation during closed hours, unrealistic response patterns
- Content: Generic responses, copy-paste language, impossible claims
- Context: Inconsistent with business reality (wrong products, services, layout)
- Pattern: Similar to known fraudulent conversations, suspicious linguistic patterns
    `;
  }

  private buildSummaryPrompt(transcript: ConversationMessage[], preserveDetails: boolean): string {
    return `
Create a professional summary of this customer feedback conversation.

CONVERSATION TRANSCRIPT:
${transcript.map(msg => `${msg.speaker}: ${msg.content}`).join('\n')}

Provide JSON response with:
{
  "summary_text": "concise but comprehensive summary",
  "key_insights": ["insight1", "insight2", "insight3"],
  "actionable_items": [
    {
      "category": "product|service|environment|staff|pricing|accessibility",
      "description": "specific action needed",
      "priority": "low|medium|high|urgent"
    }
  ],
  "customer_sentiment": "positive|neutral|negative|mixed",
  "main_topics_discussed": ["topic1", "topic2"],
  "specific_details": ["detail1", "detail2"] // Only if preserveDetails is true
}

SUMMARY REQUIREMENTS:
- Preserve all important feedback points
- Focus on actionable insights
- Maintain customer's original sentiment and concerns
- Include specific examples and details
- Professional tone suitable for business review
    `;
  }

  private buildWeeklyAnalysisPrompt(feedbackSummaries: string[], storeContext: BusinessContextProfile, historicalData?: any[]): string {
    return `
Generate comprehensive weekly analysis for this retail store based on customer feedback.

FEEDBACK SUMMARIES:
${feedbackSummaries.join('\n---\n')}

STORE CONTEXT:
${JSON.stringify(storeContext, null, 2)}

${historicalData ? `HISTORICAL DATA:\n${JSON.stringify(historicalData, null, 2)}` : ''}

Provide JSON response with:
{
  "positive_trends": [
    {
      "category": "customer_service|product_quality|store_environment|pricing|accessibility",
      "description": "specific positive trend",
      "trend_strength": "weak|moderate|strong|very_strong",
      "supporting_feedback_count": number
    }
  ],
  "negative_issues": [
    {
      "category": "customer_service|product_quality|store_environment|pricing|accessibility",
      "description": "specific issue",
      "severity": "minor|moderate|serious|critical",
      "frequency": number
    }
  ],
  "department_insights": {
    "department_name": {
      "feedback_count": number,
      "top_positive_aspects": ["aspect1", "aspect2"],
      "top_concerns": ["concern1", "concern2"],
      "improvement_trend": "improving|stable|declining"
    }
  },
  "actionable_recommendations": [
    {
      "title": "recommendation title",
      "description": "detailed recommendation",
      "category": "product|service|environment|staff|pricing|accessibility",
      "priority": "low|medium|high|urgent",
      "implementation_complexity": "simple|moderate|complex",
      "estimated_impact": "minor|moderate|significant|major"
    }
  ],
  "predictive_insights": [
    {
      "insight_type": "opportunity|risk|trend_continuation|seasonal_prediction",
      "description": "insight description",
      "confidence_level": 0.0-1.0,
      "time_horizon": "next_week|next_month|next_quarter"
    }
  ]
}
    `;
  }

  private parseQualityAnalysis(analysis: any): QualityAnalysisResult {
    return {
      scores: {
        legitimacy_score: analysis.legitimacy_score || 0,
        depth_score: analysis.depth_score || 0,
        usefulness_score: analysis.usefulness_score || 0,
        overall_quality_score: analysis.overall_quality_score || 0
      },
      reward_percentage: this.calculateRewardPercentage(analysis.overall_quality_score || 0),
      is_fraudulent: analysis.is_fraudulent || false,
      fraud_reasons: analysis.fraud_reasons || [],
      actionable_items: analysis.actionable_items || [],
      key_insights: analysis.key_insights || [],
      business_value_reasoning: analysis.business_value_reasoning || ''
    };
  }

  private parseFraudAnalysis(analysis: any): FraudAnalysisResult {
    return {
      fraud_results: analysis.fraud_results || [],
      overall_is_fraudulent: analysis.overall_is_fraudulent || false,
      confidence_level: analysis.confidence_level || 0,
      should_exclude_from_rewards: analysis.should_exclude_from_rewards || false,
      summary_reasoning: analysis.summary_reasoning || ''
    };
  }

  private parseFeedbackSummary(summary: any): FeedbackSummary {
    return {
      summary_text: summary.summary_text || '',
      key_insights: summary.key_insights || [],
      actionable_items: summary.actionable_items || [],
      customer_sentiment: summary.customer_sentiment || 'neutral',
      main_topics_discussed: summary.main_topics_discussed || [],
      specific_details: summary.specific_details || []
    };
  }

  private parseWeeklyAnalysis(analysis: any): WeeklyAnalysisResult {
    return {
      positive_trends: analysis.positive_trends || [],
      negative_issues: analysis.negative_issues || [],
      department_insights: analysis.department_insights || {},
      actionable_recommendations: analysis.actionable_recommendations || [],
      predictive_insights: analysis.predictive_insights || []
    };
  }

  private calculateRewardPercentage(qualityScore: number): number {
    // Convert 0-1 quality score to 2-15% reward range
    if (qualityScore < 0.02) return 0; // Below minimum threshold
    
    // Linear mapping: 0.02-1.0 quality → 2-15% reward
    const minReward = 2.0;
    const maxReward = 15.0;
    const minQuality = 0.02;
    const maxQuality = 1.0;
    
    const rewardPercentage = minReward + 
      ((qualityScore - minQuality) / (maxQuality - minQuality)) * (maxReward - minReward);
    
    return Math.min(Math.max(rewardPercentage, minReward), maxReward);
  }
}

// Type definitions
export interface RealtimeSessionConfig {
  businessContext: BusinessContextProfile;
  customerPhone: string;
  maxDurationSeconds?: number;
}

export interface QualityAnalysisResult {
  scores: QualityScores;
  reward_percentage: number;
  is_fraudulent: boolean;
  fraud_reasons: string[];
  actionable_items: ActionableItem[];
  key_insights: string[];
  business_value_reasoning: string;
}

export interface FraudAnalysisResult {
  fraud_results: any[];
  overall_is_fraudulent: boolean;
  confidence_level: number;
  should_exclude_from_rewards: boolean;
  summary_reasoning: string;
}

export interface FeedbackSummary {
  summary_text: string;
  key_insights: string[];
  actionable_items: ActionableItem[];
  customer_sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
  main_topics_discussed: string[];
  specific_details: string[];
}

export interface WeeklyAnalysisResult {
  positive_trends: any[];
  negative_issues: any[];
  department_insights: Record<string, any>;
  actionable_recommendations: any[];
  predictive_insights: any[];
}