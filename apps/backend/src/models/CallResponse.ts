import { CallResponse } from '@vocilia/types';
import { supabase } from '../config/supabase';

export class CallResponseModel {
  static async create(data: {
    call_session_id: string;
    question_id: string;
    question_text: string;
    response_text: string;
    response_duration: number;
    confidence_score?: number;
    sentiment_score?: number;
    asked_at: string;
    responded_at?: string;
    ai_analysis?: Record<string, any>;
  }): Promise<CallResponse> {
    const { data: response, error } = await supabase
      .from('call_responses')
      .insert({
        ...data,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create call response: ${error.message}`);
    }

    return response;
  }

  static async findById(id: string): Promise<CallResponse | null> {
    const { data: response, error } = await supabase
      .from('call_responses')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to find call response: ${error.message}`);
    }

    return response;
  }

  static async findBySessionId(sessionId: string, options?: {
    questionId?: string;
    limit?: number;
    offset?: number;
  }): Promise<CallResponse[]> {
    let query = supabase
      .from('call_responses')
      .select('*')
      .eq('call_session_id', sessionId)
      .order('asked_at', { ascending: true });

    if (options?.questionId) {
      query = query.eq('question_id', options.questionId);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }

    const { data: responses, error } = await query;

    if (error) {
      throw new Error(`Failed to find call responses: ${error.message}`);
    }

    return responses || [];
  }

  static async findByQuestionId(questionId: string, options?: {
    sessionId?: string;
    limit?: number;
    offset?: number;
  }): Promise<CallResponse[]> {
    let query = supabase
      .from('call_responses')
      .select('*')
      .eq('question_id', questionId)
      .order('created_at', { ascending: false });

    if (options?.sessionId) {
      query = query.eq('call_session_id', options.sessionId);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }

    const { data: responses, error } = await query;

    if (error) {
      throw new Error(`Failed to find responses by question: ${error.message}`);
    }

    return responses || [];
  }

  static async update(id: string, updates: Partial<CallResponse>): Promise<CallResponse> {
    const { data: response, error } = await supabase
      .from('call_responses')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update call response: ${error.message}`);
    }

    return response;
  }

  static async updateAiAnalysis(id: string, aiAnalysis: Record<string, any>): Promise<CallResponse> {
    return this.update(id, { ai_analysis: aiAnalysis });
  }

  static async updateSentimentScore(id: string, sentimentScore: number): Promise<CallResponse> {
    if (sentimentScore < -1 || sentimentScore > 1) {
      throw new Error('Sentiment score must be between -1 and 1');
    }
    return this.update(id, { sentiment_score: sentimentScore });
  }

  static async updateConfidenceScore(id: string, confidenceScore: number): Promise<CallResponse> {
    if (confidenceScore < 0 || confidenceScore > 1) {
      throw new Error('Confidence score must be between 0 and 1');
    }
    return this.update(id, { confidence_score: confidenceScore });
  }

  static async deleteById(id: string): Promise<void> {
    const { error } = await supabase
      .from('call_responses')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete call response: ${error.message}`);
    }
  }

  static async deleteBySessionId(sessionId: string): Promise<void> {
    const { error } = await supabase
      .from('call_responses')
      .delete()
      .eq('call_session_id', sessionId);

    if (error) {
      throw new Error(`Failed to delete call responses: ${error.message}`);
    }
  }

  static async getResponseStats(sessionId: string): Promise<{
    totalResponses: number;
    averageResponseTime: number;
    averageConfidence: number;
    averageSentiment: number;
    responsesWithAnalysis: number;
  }> {
    const { data: responses, error } = await supabase
      .from('call_responses')
      .select('response_duration, confidence_score, sentiment_score, ai_analysis')
      .eq('call_session_id', sessionId);

    if (error) {
      throw new Error(`Failed to get response stats: ${error.message}`);
    }

    const allResponses = responses || [];
    const totalResponses = allResponses.length;

    if (totalResponses === 0) {
      return {
        totalResponses: 0,
        averageResponseTime: 0,
        averageConfidence: 0,
        averageSentiment: 0,
        responsesWithAnalysis: 0,
      };
    }

    const averageResponseTime = allResponses.reduce((sum, r) => sum + r.response_duration, 0) / totalResponses;
    
    const responsesWithConfidence = allResponses.filter(r => r.confidence_score !== null);
    const averageConfidence = responsesWithConfidence.length > 0
      ? responsesWithConfidence.reduce((sum, r) => sum + r.confidence_score, 0) / responsesWithConfidence.length
      : 0;

    const responsesWithSentiment = allResponses.filter(r => r.sentiment_score !== null);
    const averageSentiment = responsesWithSentiment.length > 0
      ? responsesWithSentiment.reduce((sum, r) => sum + r.sentiment_score, 0) / responsesWithSentiment.length
      : 0;

    const responsesWithAnalysis = allResponses.filter(r => r.ai_analysis !== null).length;

    return {
      totalResponses,
      averageResponseTime: Math.round(averageResponseTime * 100) / 100,
      averageConfidence: Math.round(averageConfidence * 1000) / 1000,
      averageSentiment: Math.round(averageSentiment * 1000) / 1000,
      responsesWithAnalysis,
    };
  }

  static async getResponsesByBusinessId(businessId: string, options?: {
    questionId?: string;
    fromDate?: string;
    toDate?: string;
    minSentiment?: number;
    maxSentiment?: number;
    minConfidence?: number;
    limit?: number;
  }): Promise<CallResponse[]> {
    let query = supabase
      .from('call_responses')
      .select(`
        *,
        call_sessions!inner(business_id)
      `)
      .eq('call_sessions.business_id', businessId)
      .order('created_at', { ascending: false });

    if (options?.questionId) {
      query = query.eq('question_id', options.questionId);
    }

    if (options?.fromDate) {
      query = query.gte('created_at', options.fromDate);
    }

    if (options?.toDate) {
      query = query.lte('created_at', options.toDate);
    }

    if (options?.minSentiment !== undefined) {
      query = query.gte('sentiment_score', options.minSentiment);
    }

    if (options?.maxSentiment !== undefined) {
      query = query.lte('sentiment_score', options.maxSentiment);
    }

    if (options?.minConfidence !== undefined) {
      query = query.gte('confidence_score', options.minConfidence);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data: responses, error } = await query;

    if (error) {
      throw new Error(`Failed to find responses by business: ${error.message}`);
    }

    return responses || [];
  }

  static async analyzeResponseSentiment(responseText: string): Promise<number> {
    // Simple sentiment analysis based on keywords
    // In production, this would call an external sentiment analysis service
    const positiveWords = ['bra', 'mycket bra', 'fantastisk', 'utmärkt', 'nöjd', 'perfekt', 'härlig', 'underbar'];
    const negativeWords = ['dålig', 'mycket dålig', 'fruktansvärd', 'besviken', 'missnöjd', 'hemsk', 'förfärlig'];
    
    const text = responseText.toLowerCase();
    let sentiment = 0;
    
    positiveWords.forEach(word => {
      if (text.includes(word)) sentiment += 0.2;
    });
    
    negativeWords.forEach(word => {
      if (text.includes(word)) sentiment -= 0.2;
    });
    
    // Clamp between -1 and 1
    return Math.max(-1, Math.min(1, sentiment));
  }

  static async findSimilarResponses(responseText: string, questionId: string, threshold: number = 0.7): Promise<CallResponse[]> {
    // Simple text similarity based on common words
    // In production, this would use more sophisticated similarity algorithms
    const { data: responses, error } = await supabase
      .from('call_responses')
      .select('*')
      .eq('question_id', questionId)
      .neq('response_text', responseText)
      .limit(100);

    if (error) {
      throw new Error(`Failed to find similar responses: ${error.message}`);
    }

    const responseWords = responseText.toLowerCase().split(/\s+/);
    
    const similarResponses = (responses || []).filter(response => {
      const words = response.response_text.toLowerCase().split(/\s+/);
      const commonWords = responseWords.filter(word => words.includes(word));
      const similarity = commonWords.length / Math.max(responseWords.length, words.length);
      return similarity >= threshold;
    });

    return similarResponses;
  }

  static async getQuestionResponseTrends(questionId: string, days: number = 30): Promise<{
    totalResponses: number;
    averageSentiment: number;
    sentimentTrend: 'improving' | 'declining' | 'stable';
    commonThemes: string[];
  }> {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);
    
    const { data: responses, error } = await supabase
      .from('call_responses')
      .select('response_text, sentiment_score, created_at')
      .eq('question_id', questionId)
      .gte('created_at', fromDate.toISOString())
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to get response trends: ${error.message}`);
    }

    const allResponses = responses || [];
    const totalResponses = allResponses.length;

    if (totalResponses === 0) {
      return {
        totalResponses: 0,
        averageSentiment: 0,
        sentimentTrend: 'stable',
        commonThemes: [],
      };
    }

    const responsesWithSentiment = allResponses.filter(r => r.sentiment_score !== null);
    const averageSentiment = responsesWithSentiment.length > 0
      ? responsesWithSentiment.reduce((sum, r) => sum + r.sentiment_score, 0) / responsesWithSentiment.length
      : 0;

    // Calculate trend (simple linear regression on sentiment over time)
    let sentimentTrend: 'improving' | 'declining' | 'stable' = 'stable';
    if (responsesWithSentiment.length >= 2) {
      const firstHalf = responsesWithSentiment.slice(0, Math.floor(responsesWithSentiment.length / 2));
      const secondHalf = responsesWithSentiment.slice(Math.floor(responsesWithSentiment.length / 2));
      
      const firstHalfAvg = firstHalf.reduce((sum, r) => sum + r.sentiment_score, 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((sum, r) => sum + r.sentiment_score, 0) / secondHalf.length;
      
      const difference = secondHalfAvg - firstHalfAvg;
      if (Math.abs(difference) > 0.1) {
        sentimentTrend = difference > 0 ? 'improving' : 'declining';
      }
    }

    // Extract common themes (simple word frequency analysis)
    const allText = allResponses.map(r => r.response_text).join(' ').toLowerCase();
    const words = allText.split(/\s+/).filter(word => word.length > 3);
    const wordCounts: Record<string, number> = {};
    
    words.forEach(word => {
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    });
    
    const commonThemes = Object.entries(wordCounts)
      .filter(([_, count]) => count >= Math.max(2, totalResponses * 0.1))
      .sort(([_, a], [__, b]) => b - a)
      .slice(0, 5)
      .map(([word, _]) => word);

    return {
      totalResponses,
      averageSentiment: Math.round(averageSentiment * 1000) / 1000,
      sentimentTrend,
      commonThemes,
    };
  }

  static async validateResponseData(data: Partial<CallResponse>): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (data.response_duration !== undefined) {
      if (data.response_duration < 0 || data.response_duration > 60) {
        errors.push('Response duration must be between 0 and 60 seconds');
      }
    }

    if (data.confidence_score !== undefined) {
      if (data.confidence_score < 0 || data.confidence_score > 1) {
        errors.push('Confidence score must be between 0 and 1');
      }
    }

    if (data.sentiment_score !== undefined) {
      if (data.sentiment_score < -1 || data.sentiment_score > 1) {
        errors.push('Sentiment score must be between -1 and 1');
      }
    }

    if (data.asked_at && data.responded_at) {
      const askedTime = new Date(data.asked_at).getTime();
      const respondedTime = new Date(data.responded_at).getTime();
      
      if (respondedTime < askedTime) {
        errors.push('Response time cannot be before question time');
      }
    }

    if (data.response_text) {
      if (data.response_text.trim().length === 0) {
        errors.push('Response text cannot be empty');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}