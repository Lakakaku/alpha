// Customer support service for handling support requests and help system
// Manages support ticket lifecycle, FAQ content, and diagnostic reporting

import { supportService as dbSupportService } from '@vocilia/database/src/support';
import type { 
  SupportRequestCreate,
  SupportRequestStatus,
  SupportRequestPriority,
  DeviceInfo,
  DiagnosticReport 
} from '@vocilia/types';

export class CustomerSupportService {
  /**
   * Create and prioritize support request
   */
  async createSupportRequest(
    requestData: SupportRequestCreate,
    customerId?: string
  ): Promise<{ success: boolean; requestId?: string; priority?: SupportRequestPriority; error?: string }> {
    try {
      // Auto-detect priority based on content analysis
      const priority = this.detectPriority(requestData);

      // Enhance request with detected priority
      const enhancedRequest = {
        ...requestData,
        priority
      };

      // Create request in database
      const result = await dbSupportService.createSupportRequest(enhancedRequest, customerId);

      if (!result.success) {
        return result;
      }

      // Send notifications based on priority
      await this.sendSupportNotifications(result.requestId!, priority, requestData);

      // Auto-assign to appropriate team
      await this.autoAssignRequest(result.requestId!, requestData.category, priority);

      return {
        success: true,
        requestId: result.requestId,
        priority
      };

    } catch (error) {
      console.error('Error creating support request:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create support request'
      };
    }
  }

  /**
   * Detect priority based on request content
   */
  private detectPriority(requestData: SupportRequestCreate): SupportRequestPriority {
    const text = (requestData.subject + ' ' + requestData.description).toLowerCase();

    // High priority keywords
    const urgentKeywords = ['akut', 'brådskande', 'kan inte', 'fungerar inte', 'fel', 'problem'];
    const highKeywords = ['viktigt', 'snabbt', 'hjälp', 'behöver'];

    // Error logs or technical issues indicate higher priority
    if (requestData.error_logs && requestData.error_logs.length > 0) {
      return 'high';
    }

    // Check for urgent keywords
    if (urgentKeywords.some(keyword => text.includes(keyword))) {
      return 'high';
    }

    // Check for high priority keywords
    if (highKeywords.some(keyword => text.includes(keyword))) {
      return 'medium';
    }

    // Technical category gets medium priority by default
    if (requestData.category === 'technical') {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Send support notifications based on priority
   */
  private async sendSupportNotifications(
    requestId: string,
    priority: SupportRequestPriority,
    requestData: SupportRequestCreate
  ): Promise<void> {
    try {
      // Log notification (in a real system, this would send emails/SMS/Slack messages)
      console.log(`Support notification sent for request ${requestId}`, {
        priority,
        category: requestData.category,
        has_contact_email: !!requestData.contact_email
      });

      // High priority requests get immediate notifications
      if (priority === 'high') {
        // TODO: Send immediate notification to support team
        console.log(`HIGH PRIORITY support request: ${requestId}`);
      }

      // Send auto-reply email if contact email provided
      if (requestData.contact_email) {
        // TODO: Send auto-reply email
        console.log(`Auto-reply email sent to: ${requestData.contact_email}`);
      }

    } catch (error) {
      console.error('Error sending support notifications:', error);
    }
  }

  /**
   * Auto-assign request to appropriate team
   */
  private async autoAssignRequest(
    requestId: string,
    category: string,
    priority: SupportRequestPriority
  ): Promise<void> {
    try {
      // Assignment logic based on category and priority
      let assignedTeam = 'general_support';

      switch (category) {
        case 'technical':
          assignedTeam = 'tech_support';
          break;
        case 'verification':
          assignedTeam = 'verification_team';
          break;
        case 'payment':
          assignedTeam = 'billing_team';
          break;
        case 'app_usage':
          assignedTeam = 'customer_success';
          break;
      }

      // High priority goes to senior team members
      if (priority === 'high') {
        assignedTeam = `senior_${assignedTeam}`;
      }

      console.log(`Support request ${requestId} assigned to team: ${assignedTeam}`);

      // TODO: Update request with assignment in database
      // await dbSupportService.assignRequest(requestId, assignedTeam);

    } catch (error) {
      console.error('Error auto-assigning request:', error);
    }
  }

  /**
   * Analyze device info for common issues
   */
  analyzeDeviceInfo(deviceInfo: DeviceInfo): {
    potential_issues: string[];
    recommendations: string[];
    compatibility_score: number;
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let compatibilityScore = 100;

    // Check browser compatibility
    if (deviceInfo.browser === 'Internet Explorer') {
      issues.push('Webbläsare stöds inte');
      recommendations.push('Använd Chrome, Firefox, Safari eller Edge');
      compatibilityScore -= 30;
    }

    // Check if PWA is supported but not installed
    if (!deviceInfo.pwa_installed && deviceInfo.device_type === 'mobile') {
      recommendations.push('Installera appen för bättre prestanda');
    }

    // Check screen resolution for mobile
    if (deviceInfo.device_type === 'mobile') {
      const [width] = deviceInfo.screen_resolution.split('x').map(Number);
      if (width < 360) {
        issues.push('Liten skärmstorlek kan påverka användarupplevelsen');
        recommendations.push('Använd större skärm om möjligt');
        compatibilityScore -= 10;
      }
    }

    // Check connection type
    if (deviceInfo.connection_type === '2g') {
      issues.push('Långsam internetanslutning');
      recommendations.push('Använd WiFi eller bättre mobilnät för optimal prestanda');
      compatibilityScore -= 20;
    }

    return {
      potential_issues: issues,
      recommendations,
      compatibility_score: Math.max(0, compatibilityScore)
    };
  }

  /**
   * Generate diagnostic report
   */
  async generateDiagnosticReport(
    sessionId: string | null,
    deviceInfo: DeviceInfo,
    errorLogs: string[] = [],
    userActions: any[] = []
  ): Promise<{ success: boolean; reportId?: string; analysis?: any; error?: string }> {
    try {
      // Analyze device info
      const deviceAnalysis = this.analyzeDeviceInfo(deviceInfo);

      // Analyze error patterns
      const errorAnalysis = this.analyzeErrorLogs(errorLogs);

      // Create diagnostic report
      const diagnosticReport: Omit<DiagnosticReport, 'id' | 'generated_at'> = {
        session_id: sessionId,
        device_info: deviceInfo,
        performance_metrics: {
          page_load_time: 0, // Would be provided by client
          time_to_interactive: 0,
          largest_contentful_paint: 0,
          cumulative_layout_shift: 0,
          memory_usage: 0,
          cache_hit_rate: 0
        },
        error_logs: errorLogs.map(log => ({
          timestamp: new Date().toISOString(),
          level: 'error' as const,
          message: log,
          stack_trace: null,
          user_action: null,
          url: ''
        })),
        user_actions: userActions,
        network_info: {
          online: true,
          connection_type: deviceInfo.connection_type,
          effective_bandwidth: 0,
          latency: 0
        },
        storage_info: {
          local_storage_used: 0,
          session_storage_used: 0,
          indexeddb_used: 0,
          cache_storage_used: 0,
          quota_available: 0
        }
      };

      // Submit to database
      const result = await dbSupportService.submitDiagnosticReport(diagnosticReport);

      if (!result.success) {
        return result;
      }

      return {
        success: true,
        reportId: result.reportId,
        analysis: {
          device_analysis: deviceAnalysis,
          error_analysis: errorAnalysis,
          overall_health: this.calculateOverallHealth(deviceAnalysis, errorAnalysis)
        }
      };

    } catch (error) {
      console.error('Error generating diagnostic report:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate diagnostic report'
      };
    }
  }

  /**
   * Analyze error logs for patterns
   */
  private analyzeErrorLogs(errorLogs: string[]): {
    error_count: number;
    common_patterns: string[];
    severity: 'low' | 'medium' | 'high';
  } {
    const patterns = [];
    let severity: 'low' | 'medium' | 'high' = 'low';

    if (errorLogs.length === 0) {
      return { error_count: 0, common_patterns: [], severity: 'low' };
    }

    // Check for common error patterns
    const networkErrors = errorLogs.filter(log => 
      log.includes('network') || log.includes('fetch') || log.includes('timeout')
    );
    if (networkErrors.length > 0) {
      patterns.push('Nätverksfel');
    }

    const jsErrors = errorLogs.filter(log => 
      log.includes('TypeError') || log.includes('ReferenceError') || log.includes('undefined')
    );
    if (jsErrors.length > 0) {
      patterns.push('JavaScript-fel');
    }

    const authErrors = errorLogs.filter(log => 
      log.includes('auth') || log.includes('401') || log.includes('403')
    );
    if (authErrors.length > 0) {
      patterns.push('Autentiseringsfel');
    }

    // Determine severity based on error count and types
    if (errorLogs.length > 10 || authErrors.length > 0) {
      severity = 'high';
    } else if (errorLogs.length > 3 || jsErrors.length > 0) {
      severity = 'medium';
    }

    return {
      error_count: errorLogs.length,
      common_patterns: patterns,
      severity
    };
  }

  /**
   * Calculate overall system health score
   */
  private calculateOverallHealth(deviceAnalysis: any, errorAnalysis: any): {
    score: number;
    status: 'excellent' | 'good' | 'fair' | 'poor';
    primary_concerns: string[];
  } {
    let score = 100;
    const concerns: string[] = [];

    // Factor in device compatibility
    score = (score + deviceAnalysis.compatibility_score) / 2;
    if (deviceAnalysis.potential_issues.length > 0) {
      concerns.push(...deviceAnalysis.potential_issues);
    }

    // Factor in errors
    if (errorAnalysis.severity === 'high') {
      score -= 30;
      concerns.push('Allvarliga fel upptäckta');
    } else if (errorAnalysis.severity === 'medium') {
      score -= 15;
      concerns.push('Måttliga fel upptäckta');
    }

    // Determine status
    let status: 'excellent' | 'good' | 'fair' | 'poor';
    if (score >= 90) status = 'excellent';
    else if (score >= 70) status = 'good';
    else if (score >= 50) status = 'fair';
    else status = 'poor';

    return {
      score: Math.round(score),
      status,
      primary_concerns: concerns.slice(0, 3) // Top 3 concerns
    };
  }
}

// Export singleton instance
export const customerSupportService = new CustomerSupportService();