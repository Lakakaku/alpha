/**
 * Context Analysis Service
 * Task: T039 - Context analysis service using GPT-4o-mini in apps/backend/src/services/fraud/contextAnalysisService.ts
 * 
 * Provides AI-powered context analysis for fraud detection using GPT-4o-mini.
 * Analyzes Swedish customer feedback for legitimacy, cultural context, and impossible claims.
 */

import { OpenAI } from 'openai';
import { ContextAnalysisModel } from '../../../../../packages/database/src/fraud/context-analysis';
import { 
  ContextAnalysisRequest,
  ContextAnalysisResult,
  LegitimacyIndicator,
  CulturalContext,
  ImpossibleClaim
} from '../../../../../packages/types/src/fraud';

export class ContextAnalysisService {
  private openai: OpenAI;
  private readonly MODEL_NAME = 'gpt-4o-mini';
  private readonly MAX_TOKENS = 1000;
  private readonly TEMPERATURE = 0.1; // Low temperature for consistent analysis

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key is required for context analysis');
    }
  }

  /**
   * Analyze context for legitimacy indicators
   */
  async analyzeContext(request: ContextAnalysisRequest): Promise<ContextAnalysisResult> {
    try {
      const analysis = await this.performGPTAnalysis(request);
      
      // Store analysis in database
      const dbResult = await ContextAnalysisModel.create({
        phone_hash: request.phone_hash,
        call_transcript: request.call_transcript,
        feedback_content: request.feedback_content,
        context_metadata: request.context_metadata || {},
        legitimacy_score: analysis.legitimacy_score,
        cultural_context_score: analysis.cultural_context_score,
        impossible_claims_score: analysis.impossible_claims_score,
        confidence_level: analysis.confidence_level,
        analysis_reasoning: analysis.reasoning,
        detected_patterns: analysis.patterns,
        red_flag_indicators: analysis.red_flags,
        ai_model_version: this.MODEL_NAME,
        processing_time_ms: analysis.processing_time_ms
      });

      return {
        analysis_id: dbResult.id,
        phone_hash: request.phone_hash,
        legitimacy_score: analysis.legitimacy_score,
        cultural_context_score: analysis.cultural_context_score,
        impossible_claims_score: analysis.impossible_claims_score,
        overall_context_score: this.calculateOverallScore(analysis),
        confidence_level: analysis.confidence_level,
        legitimacy_indicators: analysis.legitimacy_indicators,
        cultural_context: analysis.cultural_context,
        impossible_claims: analysis.impossible_claims,
        reasoning: analysis.reasoning,
        patterns_detected: analysis.patterns,
        red_flags: analysis.red_flags,
        processing_time_ms: analysis.processing_time_ms,
        analyzed_at: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Context analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Perform GPT-4o-mini analysis
   */
  private async performGPTAnalysis(request: ContextAnalysisRequest): Promise<{
    legitimacy_score: number;
    cultural_context_score: number;
    impossible_claims_score: number;
    confidence_level: number;
    legitimacy_indicators: LegitimacyIndicator[];
    cultural_context: CulturalContext;
    impossible_claims: ImpossibleClaim[];
    reasoning: string;
    patterns: string[];
    red_flags: string[];
    processing_time_ms: number;
  }> {
    const startTime = Date.now();

    try {
      const systemPrompt = this.buildSystemPrompt();
      const userPrompt = this.buildUserPrompt(request);

      const completion = await this.openai.chat.completions.create({
        model: this.MODEL_NAME,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: this.MAX_TOKENS,
        temperature: this.TEMPERATURE,
        response_format: { type: 'json_object' }
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('No response from GPT-4o-mini');
      }

      const analysisResult = JSON.parse(response);
      const processingTime = Date.now() - startTime;

      return {
        ...analysisResult,
        processing_time_ms: processingTime
      };
    } catch (error) {
      throw new Error(`GPT analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Build system prompt for GPT-4o-mini
   */
  private buildSystemPrompt(): string {
    return `Du är en expert på att analysera svensk kundfeedback för att upptäcka potentiellt bedrägliga eller falska påståenden. 

Ditt uppdrag är att analysera telefonsamtal och feedback från svenska kunder för att bedöma legitimitet baserat på tre huvudområden:

1. LEGITIMACY INDICATORS (0-40 poäng)
- Konsistens i berättelsen
- Logisk följd av händelser  
- Rimliga tidsramar och datum
- Trovärdiga detaljer och specifika påståenden
- Känslomässig äkthet i uttryck

2. CULTURAL CONTEXT (0-30 poäng)
- Korrekt användning av svenska uttryck och ordval
- Kulturell förståelse för svenska affärsmetoder
- Kännedom om svenska lagar och regler
- Realistiska referenser till svenska platser/företag
- Naturlig språkanvändning för ålder/bakgrund

3. IMPOSSIBLE CLAIMS (0-30 poäng - Inverted scoring)
- Påståenden som bryter mot fysikens lagar
- Omöjliga tidshorisonter eller logistik
- Felaktiga tekniska specifikationer
- Orealistiska ekonomiska erbjudanden
- Motsägelsefulla eller förvirrade detaljer

Svara ALLTID med gyldig JSON i detta format:
{
  "legitimacy_score": 0-40,
  "cultural_context_score": 0-30,  
  "impossible_claims_score": 0-30,
  "confidence_level": 0.0-1.0,
  "legitimacy_indicators": [
    {
      "type": "consistency|logic|timing|details|emotion",
      "description": "Beskrivning på svenska",
      "impact": "positive|negative|neutral",
      "weight": 0.0-1.0
    }
  ],
  "cultural_context": {
    "language_authenticity": 0.0-1.0,
    "cultural_knowledge": 0.0-1.0,
    "local_references": 0.0-1.0,
    "business_understanding": 0.0-1.0,
    "overall_cultural_fit": 0.0-1.0
  },
  "impossible_claims": [
    {
      "claim": "Påstående",
      "impossibility_type": "physics|logistics|technical|economic|logical",
      "severity": 1-10,
      "explanation": "Varför detta är omöjligt"
    }
  ],
  "reasoning": "Detaljerad analys på svenska",
  "patterns": ["Lista över upptäckta mönster"],
  "red_flags": ["Lista över röda flaggor"]
}`;
  }

  /**
   * Build user prompt with request data
   */
  private buildUserPrompt(request: ContextAnalysisRequest): string {
    const contextInfo = request.context_metadata 
      ? `\nKontext: ${JSON.stringify(request.context_metadata, null, 2)}`
      : '';

    return `Analysera följande kundfeedback för legitimitet:

TELEFONSAMTAL TRANSKRIPT:
${request.call_transcript || 'Ej tillgängligt'}

FEEDBACK INNEHÅLL:
${request.feedback_content}

TELEFONNUMMER HASH: ${request.phone_hash}
${contextInfo}

Utför en grundlig analys och bedöm legitimiteten baserat på de tre huvudkategorierna. Var särskilt uppmärksam på:
- Svenska språkliga nyanser
- Kulturell kontext för svenska företag
- Tekniska och logiska omöjligheter
- Tidsmässiga inconsistenser
- Känslomässig äkthet

Ge din analys i JSON-format enligt instruktionerna.`;
  }

  /**
   * Calculate overall context score (weighted average)
   */
  private calculateOverallScore(analysis: {
    legitimacy_score: number;
    cultural_context_score: number;
    impossible_claims_score: number;
  }): number {
    // Weights: Legitimacy 40%, Cultural 30%, Impossible Claims 30%
    const weightedScore = (
      (analysis.legitimacy_score * 0.4) +
      (analysis.cultural_context_score * 0.3) +
      (analysis.impossible_claims_score * 0.3)
    );

    return Math.round(weightedScore * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Analyze multiple contexts in batch
   */
  async batchAnalyzeContexts(requests: ContextAnalysisRequest[]): Promise<ContextAnalysisResult[]> {
    try {
      const results: ContextAnalysisResult[] = [];
      const batchSize = 5; // Process 5 at a time to avoid rate limits

      for (let i = 0; i < requests.length; i += batchSize) {
        const batch = requests.slice(i, i + batchSize);
        const batchPromises = batch.map(request => this.analyzeContext(request));
        
        const batchResults = await Promise.allSettled(batchPromises);
        
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            console.error(`Batch analysis failed for request ${i + index}: ${result.reason}`);
          }
        });

        // Small delay between batches to respect rate limits
        if (i + batchSize < requests.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      return results;
    } catch (error) {
      throw new Error(`Batch context analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get analysis statistics
   */
  async getAnalysisStatistics(timeWindow: string = '24h'): Promise<{
    total_analyses: number;
    average_legitimacy_score: number;
    average_cultural_score: number;
    average_impossible_claims_score: number;
    high_risk_analyses: number;
    processing_time_avg: number;
  }> {
    try {
      const hours = this.parseTimeWindow(timeWindow);
      const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

      const stats = await ContextAnalysisModel.getStatistics({ since });

      return {
        total_analyses: stats.total_count,
        average_legitimacy_score: stats.avg_legitimacy_score,
        average_cultural_score: stats.avg_cultural_context_score,
        average_impossible_claims_score: stats.avg_impossible_claims_score,
        high_risk_analyses: stats.high_risk_count,
        processing_time_avg: stats.avg_processing_time_ms
      };
    } catch (error) {
      throw new Error(`Statistics retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse time window string to hours
   */
  private parseTimeWindow(timeWindow: string): number {
    const match = timeWindow.match(/^(\d+)([hmd])$/);
    if (!match) return 24; // Default to 24 hours

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 'm': return value / 60;
      case 'h': return value;
      case 'd': return value * 24;
      default: return 24;
    }
  }

  /**
   * Re-analyze existing context
   */
  async reAnalyzeContext(analysisId: string): Promise<ContextAnalysisResult> {
    try {
      const existingAnalysis = await ContextAnalysisModel.getById(analysisId);
      if (!existingAnalysis) {
        throw new Error('Analysis not found');
      }

      const request: ContextAnalysisRequest = {
        phone_hash: existingAnalysis.phone_hash,
        call_transcript: existingAnalysis.call_transcript,
        feedback_content: existingAnalysis.feedback_content,
        context_metadata: existingAnalysis.context_metadata
      };

      return await this.analyzeContext(request);
    } catch (error) {
      throw new Error(`Re-analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}