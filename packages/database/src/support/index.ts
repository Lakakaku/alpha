// Database queries for customer support requests and FAQ system
// Handles support ticket creation, FAQ retrieval, and help system

import { createClient } from '../client/supabase';
import type { 
  CustomerSupportRequest,
  SupportRequestCreate,
  SupportRequestStatus,
  SupportRequestPriority,
  SupportRequestCategory,
  SupportFAQEntry,
  SupportFAQRequest,
  DiagnosticReport,
  DeviceInfo
} from '@vocilia/types';

const supabase = createClient();

export class SupportService {
  /**
   * Create a new support request
   */
  async createSupportRequest(
    requestData: SupportRequestCreate,
    customerId?: string
  ): Promise<{ success: boolean; requestId?: string; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('customer_support_requests')
        .insert({
          customer_id: customerId || null,
          category: requestData.category,
          subject: requestData.subject,
          description: requestData.description,
          contact_email: requestData.contact_email || null,
          contact_phone: requestData.contact_phone || null,
          session_id: requestData.session_id || null,
          device_info: requestData.device_info || null,
          error_logs: requestData.error_logs || null,
          screenshots: requestData.screenshots || null,
          priority: 'medium' as SupportRequestPriority,
          status: 'open' as SupportRequestStatus
        })
        .select('id')
        .single();

      if (error) {
        console.error('Failed to create support request:', error);
        return { success: false, error: error.message };
      }

      return { success: true, requestId: data.id };
    } catch (error) {
      console.error('Error creating support request:', error);
      return { success: false, error: 'Failed to create support request' };
    }
  }

  /**
   * Get support requests for a user
   */
  async getUserSupportRequests(
    customerId: string,
    limit: number = 20
  ): Promise<{ success: boolean; requests?: CustomerSupportRequest[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('customer_support_requests')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Failed to get user support requests:', error);
        return { success: false, error: error.message };
      }

      return { success: true, requests: data || [] };
    } catch (error) {
      console.error('Error getting user support requests:', error);
      return { success: false, error: 'Failed to get user support requests' };
    }
  }

  /**
   * Update support request status
   */
  async updateSupportRequestStatus(
    requestId: string,
    status: SupportRequestStatus,
    resolutionNotes?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const updateData: any = {
        status,
        updated_at: new Date().toISOString()
      };

      if (status === 'resolved' || status === 'closed') {
        updateData.resolved_at = new Date().toISOString();
        if (resolutionNotes) {
          updateData.resolution_notes = resolutionNotes;
        }
      }

      const { error } = await supabase
        .from('customer_support_requests')
        .update(updateData)
        .eq('id', requestId);

      if (error) {
        console.error('Failed to update support request status:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error updating support request status:', error);
      return { success: false, error: 'Failed to update support request status' };
    }
  }

  /**
   * Get FAQ entries
   */
  async getFAQEntries(
    request: SupportFAQRequest
  ): Promise<{ success: boolean; entries?: SupportFAQEntry[]; totalCount?: number; error?: string }> {
    try {
      let query = supabase
        .from('support_faq_entries')
        .select('*', { count: 'exact' })
        .eq('published', true)
        .eq('language', request.language || 'sv')
        .order('priority', { ascending: true });

      if (request.category) {
        query = query.eq('category', request.category);
      }

      if (request.search_query) {
        query = query.or(`question.ilike.%${request.search_query}%,answer.ilike.%${request.search_query}%,keywords.cs.{${request.search_query}}`);
      }

      if (request.limit) {
        query = query.limit(request.limit);
      }

      const { data, error, count } = await query;

      if (error) {
        console.error('Failed to get FAQ entries:', error);
        return { success: false, error: error.message };
      }

      return { success: true, entries: data || [], totalCount: count || 0 };
    } catch (error) {
      console.error('Error getting FAQ entries:', error);
      return { success: false, error: 'Failed to get FAQ entries' };
    }
  }

  /**
   * Update FAQ helpfulness rating
   */
  async updateFAQHelpfulness(
    faqId: string,
    helpful: boolean
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const incrementField = helpful ? 'helpful_count' : 'not_helpful_count';
      
      const { error } = await supabase
        .rpc('increment_faq_helpfulness', {
          faq_id: faqId,
          is_helpful: helpful
        });

      if (error) {
        console.error('Failed to update FAQ helpfulness:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error updating FAQ helpfulness:', error);
      return { success: false, error: 'Failed to update FAQ helpfulness' };
    }
  }

  /**
   * Submit diagnostic report
   */
  async submitDiagnosticReport(
    diagnosticData: Omit<DiagnosticReport, 'id' | 'generated_at'>
  ): Promise<{ success: boolean; reportId?: string; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('diagnostic_reports')
        .insert({
          ...diagnosticData,
          generated_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (error) {
        console.error('Failed to submit diagnostic report:', error);
        return { success: false, error: error.message };
      }

      return { success: true, reportId: data.id };
    } catch (error) {
      console.error('Error submitting diagnostic report:', error);
      return { success: false, error: 'Failed to submit diagnostic report' };
    }
  }

  /**
   * Get contextual help for a page
   */
  async getContextualHelp(
    pageId: string,
    language: string = 'sv'
  ): Promise<{ success: boolean; helpSections?: any[]; quickActions?: any[]; relatedFAQs?: SupportFAQEntry[]; error?: string }> {
    try {
      // Get contextual help sections
      const { data: helpSections, error: helpError } = await supabase
        .from('contextual_help_sections')
        .select('*')
        .eq('page_id', pageId)
        .eq('language', language)
        .order('priority', { ascending: true });

      if (helpError) {
        console.error('Failed to get contextual help:', helpError);
        return { success: false, error: helpError.message };
      }

      // Get quick actions
      const { data: quickActions, error: actionsError } = await supabase
        .from('contextual_quick_actions')
        .select('*')
        .eq('page_id', pageId)
        .order('priority', { ascending: true });

      if (actionsError) {
        console.error('Failed to get quick actions:', actionsError);
      }

      // Get related FAQs
      const { data: relatedFAQs, error: faqError } = await supabase
        .from('support_faq_entries')
        .select('*')
        .contains('page_contexts', [pageId])
        .eq('language', language)
        .eq('published', true)
        .limit(5);

      if (faqError) {
        console.error('Failed to get related FAQs:', faqError);
      }

      return {
        success: true,
        helpSections: helpSections || [],
        quickActions: quickActions || [],
        relatedFAQs: relatedFAQs || []
      };
    } catch (error) {
      console.error('Error getting contextual help:', error);
      return { success: false, error: 'Failed to get contextual help' };
    }
  }

  /**
   * Get support statistics
   */
  async getSupportStats(
    businessId?: string
  ): Promise<{ success: boolean; stats?: any; error?: string }> {
    try {
      const { data, error } = await supabase
        .rpc('get_support_stats', {
          business_id: businessId || null
        });

      if (error) {
        console.error('Failed to get support stats:', error);
        return { success: false, error: error.message };
      }

      return { success: true, stats: data };
    } catch (error) {
      console.error('Error getting support stats:', error);
      return { success: false, error: 'Failed to get support stats' };
    }
  }
}

// Export singleton instance
export const supportService = new SupportService();

// Export individual functions for compatibility
export const {
  createSupportRequest,
  getUserSupportRequests,
  updateSupportRequestStatus,
  getFAQEntries,
  updateFAQHelpfulness,
  submitDiagnosticReport,
  getContextualHelp,
  getSupportStats
} = supportService;