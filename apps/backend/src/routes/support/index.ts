// Customer support endpoints for help requests and FAQ system
// Handles support ticket creation, FAQ retrieval, and contextual help

import { Request, Response } from 'express';
import { supportService } from '@vocilia/database/src/support';
import type { 
  SupportRequestCreate,
  SupportRequestResponse,
  SupportFAQRequest,
  SupportFAQResponse,
  SupportRequestCategory 
} from '@vocilia/types';

/**
 * Create a new support request
 * POST /api/support/request
 */
export const createSupportRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const requestData: SupportRequestCreate = req.body;

    // Validate required fields
    if (!requestData.category || !requestData.subject || !requestData.description) {
      res.status(400).json({
        error: 'category, subject, and description are required'
      });
      return;
    }

    // Validate category
    const validCategories: SupportRequestCategory[] = ['technical', 'verification', 'app_usage', 'payment', 'general'];
    if (!validCategories.includes(requestData.category)) {
      res.status(400).json({
        error: 'Invalid category. Must be one of: ' + validCategories.join(', ')
      });
      return;
    }

    // Validate subject and description length
    if (requestData.subject.length < 5 || requestData.subject.length > 200) {
      res.status(400).json({
        error: 'Subject must be between 5 and 200 characters'
      });
      return;
    }

    if (requestData.description.length < 10 || requestData.description.length > 5000) {
      res.status(400).json({
        error: 'Description must be between 10 and 5000 characters'
      });
      return;
    }

    // Validate email format if provided
    if (requestData.contact_email && 
        !/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(requestData.contact_email)) {
      res.status(400).json({
        error: 'Invalid email format'
      });
      return;
    }

    // Get customer ID from auth context (if available)
    const customerId = (req as any).user?.id;

    // Create support request
    const result = await supportService.createSupportRequest(requestData, customerId);

    if (!result.success) {
      res.status(500).json({
        error: 'Failed to create support request',
        details: result.error
      });
      return;
    }

    // Calculate estimated response time based on category and current queue
    const estimatedResponseTime = calculateEstimatedResponseTime(requestData.category);

    // Build response
    const response: SupportRequestResponse = {
      success: true,
      request_id: result.requestId!,
      estimated_response_time: estimatedResponseTime,
      support_channels: {
        email: 'support@vocilia.se',
        phone: '+46 8 123 456 78',
        chat_available: true
      }
    };

    // Log support request creation
    console.log(`Support request created: ${result.requestId}`, {
      category: requestData.category,
      customer_id: customerId,
      has_contact_email: !!requestData.contact_email,
      has_session_context: !!requestData.session_id
    });

    res.status(201).json(response);

  } catch (error) {
    console.error('Failed to create support request:', error);

    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get FAQ entries
 * GET /api/support/faq
 */
export const getFAQEntries = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      category,
      search_query,
      language = 'sv',
      limit = 20
    } = req.query;

    // Validate limit
    const limitNum = parseInt(limit as string);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      res.status(400).json({
        error: 'limit must be a number between 1 and 100'
      });
      return;
    }

    // Validate category if provided
    if (category) {
      const validCategories: SupportRequestCategory[] = ['technical', 'verification', 'app_usage', 'payment', 'general'];
      if (!validCategories.includes(category as SupportRequestCategory)) {
        res.status(400).json({
          error: 'Invalid category. Must be one of: ' + validCategories.join(', ')
        });
        return;
      }
    }

    // Build FAQ request
    const faqRequest: SupportFAQRequest = {
      category: category as SupportRequestCategory,
      search_query: search_query as string,
      language: language as string,
      limit: limitNum
    };

    // Get FAQ entries
    const result = await supportService.getFAQEntries(faqRequest);

    if (!result.success) {
      res.status(500).json({
        error: 'Failed to get FAQ entries',
        details: result.error
      });
      return;
    }

    // Get suggested categories based on current results
    const suggestedCategories = await getSuggestedCategories(search_query as string);

    // Build response
    const response: SupportFAQResponse = {
      success: true,
      entries: result.entries || [],
      total_count: result.totalCount || 0,
      suggested_categories: suggestedCategories
    };

    res.json(response);

  } catch (error) {
    console.error('Failed to get FAQ entries:', error);

    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Update FAQ helpfulness rating
 * POST /api/support/faq/:faqId/helpful
 */
export const updateFAQHelpfulness = async (req: Request, res: Response): Promise<void> => {
  try {
    const { faqId } = req.params;
    const { helpful } = req.body;

    if (!faqId) {
      res.status(400).json({
        error: 'FAQ ID is required'
      });
      return;
    }

    if (typeof helpful !== 'boolean') {
      res.status(400).json({
        error: 'helpful must be a boolean value'
      });
      return;
    }

    // Update FAQ helpfulness
    const result = await supportService.updateFAQHelpfulness(faqId, helpful);

    if (!result.success) {
      res.status(500).json({
        error: 'Failed to update FAQ helpfulness',
        details: result.error
      });
      return;
    }

    res.json({
      success: true,
      message: 'FAQ helpfulness updated'
    });

  } catch (error) {
    console.error('Failed to update FAQ helpfulness:', error);

    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get contextual help for a page
 * GET /api/support/help/:pageId
 */
export const getContextualHelp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { pageId } = req.params;
    const { language = 'sv' } = req.query;

    if (!pageId) {
      res.status(400).json({
        error: 'Page ID is required'
      });
      return;
    }

    // Get contextual help
    const result = await supportService.getContextualHelp(pageId, language as string);

    if (!result.success) {
      res.status(500).json({
        error: 'Failed to get contextual help',
        details: result.error
      });
      return;
    }

    res.json({
      success: true,
      page_id: pageId,
      help_sections: result.helpSections || [],
      quick_actions: result.quickActions || [],
      related_faqs: result.relatedFAQs || []
    });

  } catch (error) {
    console.error('Failed to get contextual help:', error);

    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get user's support requests
 * GET /api/support/requests
 */
export const getUserSupportRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const customerId = (req as any).user?.id;

    if (!customerId) {
      res.status(401).json({
        error: 'Authentication required'
      });
      return;
    }

    const { limit = 20 } = req.query;
    const limitNum = parseInt(limit as string);

    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      res.status(400).json({
        error: 'limit must be a number between 1 and 100'
      });
      return;
    }

    // Get user's support requests
    const result = await supportService.getUserSupportRequests(customerId, limitNum);

    if (!result.success) {
      res.status(500).json({
        error: 'Failed to get support requests',
        details: result.error
      });
      return;
    }

    res.json({
      success: true,
      requests: result.requests || [],
      total_count: result.requests?.length || 0
    });

  } catch (error) {
    console.error('Failed to get user support requests:', error);

    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Submit diagnostic report
 * POST /api/support/diagnostics
 */
export const submitDiagnosticReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const diagnosticData = req.body;

    // Validate required fields
    if (!diagnosticData.device_info || !diagnosticData.performance_metrics) {
      res.status(400).json({
        error: 'device_info and performance_metrics are required'
      });
      return;
    }

    // Submit diagnostic report
    const result = await supportService.submitDiagnosticReport(diagnosticData);

    if (!result.success) {
      res.status(500).json({
        error: 'Failed to submit diagnostic report',
        details: result.error
      });
      return;
    }

    res.json({
      success: true,
      report_id: result.reportId,
      message: 'Diagnostic report submitted successfully'
    });

  } catch (error) {
    console.error('Failed to submit diagnostic report:', error);

    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Calculate estimated response time based on category and current queue
 */
function calculateEstimatedResponseTime(category: SupportRequestCategory): string {
  const now = new Date();
  
  // Base response times by category (in hours)
  const baseResponseTimes: { [key in SupportRequestCategory]: number } = {
    'urgent': 2,
    'technical': 8,
    'verification': 4,
    'app_usage': 12,
    'payment': 6,
    'general': 24
  };

  // Add base response time
  const responseTime = baseResponseTimes[category] || 24;
  now.setHours(now.getHours() + responseTime);

  // Adjust for business hours (9-17 Swedish time)
  const swedishTime = new Date(now.toLocaleString("en-US", {timeZone: "Europe/Stockholm"}));
  const hour = swedishTime.getHours();
  const day = swedishTime.getDay();

  // If outside business hours or weekend, extend to next business day
  if (hour < 9 || hour > 17 || day === 0 || day === 6) {
    // Move to next business day at 10 AM
    while (swedishTime.getDay() === 0 || swedishTime.getDay() === 6) {
      swedishTime.setDate(swedishTime.getDate() + 1);
    }
    swedishTime.setHours(10, 0, 0, 0);
  }

  return swedishTime.toISOString();
}

/**
 * Get suggested categories based on search query
 */
async function getSuggestedCategories(searchQuery?: string): Promise<SupportRequestCategory[]> {
  if (!searchQuery) {
    return ['technical', 'verification', 'app_usage'];
  }

  const query = searchQuery.toLowerCase();
  const suggestions: SupportRequestCategory[] = [];

  // Category keyword mapping
  if (query.includes('fel') || query.includes('problem') || query.includes('fungerar inte')) {
    suggestions.push('technical');
  }
  if (query.includes('verifiering') || query.includes('telefon') || query.includes('sms')) {
    suggestions.push('verification');
  }
  if (query.includes('app') || query.includes('använda') || query.includes('hjälp')) {
    suggestions.push('app_usage');
  }
  if (query.includes('betalning') || query.includes('pengar') || query.includes('belöning')) {
    suggestions.push('payment');
  }

  // Default fallback
  if (suggestions.length === 0) {
    suggestions.push('general');
  }

  return suggestions.slice(0, 3); // Max 3 suggestions
}