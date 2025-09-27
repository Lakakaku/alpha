import { loggingService } from '../loggingService';

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface VerificationDeadlineReminderData {
  businessName: string;
  storeName: string;
  databaseId: string;
  transactionCount: number;
  deadline: Date;
  daysRemaining: number;
  downloadUrl: string;
  portalUrl: string;
}

export interface PaymentOverdueReminderData {
  businessName: string;
  storeName: string;
  invoiceId: string;
  totalAmount: number;
  rewardAmount: number;
  adminFee: number;
  daysOverdue: number;
  paymentUrl: string;
  originalDueDate: Date;
}

export interface WeeklyDigestData {
  businessName: string;
  storeName: string;
  weekStarting: Date;
  weekEnding: Date;
  stats: {
    totalTransactions: number;
    verifiedTransactions: number;
    fakeTransactions: number;
    pendingVerification: number;
    totalRewards: number;
    avgTransactionValue: number;
  };
  upcomingDeadlines: Array<{
    databaseId: string;
    deadline: Date;
    transactionCount: number;
  }>;
  portalUrl: string;
}

export interface CycleCompleteNotificationData {
  businessName: string;
  storeName: string;
  cycleId: string;
  weekStarting: Date;
  weekEnding: Date;
  verificationResults: {
    totalTransactions: number;
    verifiedCount: number;
    fakeCount: number;
    verificationRate: number;
  };
  paymentInfo: {
    totalRewards: number;
    adminFee: number;
    totalDue: number;
    paymentDueDate: Date;
  };
  feedbackDatabaseUrl?: string;
  portalUrl: string;
}

class VerificationEmailTemplateService {
  private readonly brandColor = '#2563eb';
  private readonly companyName = 'Vocilia';
  private readonly supportEmail = 'support@vocilia.com';
  private readonly logoUrl = 'https://vocilia.com/logo.png';

  // Deadline reminder templates
  generateDeadlineReminder(data: VerificationDeadlineReminderData): EmailTemplate {
    const urgencyLevel = data.daysRemaining <= 1 ? 'urgent' : 'normal';
    const subjectPrefix = urgencyLevel === 'urgent' ? '⚠️ URGENT: ' : '';
    
    const subject = `${subjectPrefix}Verification Deadline - ${data.daysRemaining} ${data.daysRemaining === 1 ? 'day' : 'days'} remaining`;

    const html = this.wrapInEmailLayout(`
      <div style="background: ${urgencyLevel === 'urgent' ? '#fef2f2' : '#f8fafc'}; border-left: 4px solid ${urgencyLevel === 'urgent' ? '#dc2626' : this.brandColor}; padding: 16px; margin-bottom: 24px;">
        <h2 style="color: ${urgencyLevel === 'urgent' ? '#dc2626' : this.brandColor}; margin: 0 0 8px 0;">
          ${urgencyLevel === 'urgent' ? 'Urgent: ' : ''}Verification Deadline Approaching
        </h2>
        <p style="margin: 0; color: #374151;">
          You have <strong>${data.daysRemaining} ${data.daysRemaining === 1 ? 'day' : 'days'}</strong> remaining to complete verification.
        </p>
      </div>

      <p>Hello ${data.businessName},</p>
      
      <p>This is a reminder that your weekly transaction verification for <strong>${data.storeName}</strong> is due soon.</p>
      
      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <h3 style="margin: 0 0 16px 0; color: #111827;">Verification Details</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Store:</td>
            <td style="padding: 8px 0; font-weight: 600;">${data.storeName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Transactions to verify:</td>
            <td style="padding: 8px 0; font-weight: 600;">${data.transactionCount}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Deadline:</td>
            <td style="padding: 8px 0; font-weight: 600; color: ${urgencyLevel === 'urgent' ? '#dc2626' : '#111827'};">
              ${this.formatDate(data.deadline)} (${data.daysRemaining} ${data.daysRemaining === 1 ? 'day' : 'days'} remaining)
            </td>
          </tr>
        </table>
      </div>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${data.portalUrl}" style="display: inline-block; background: ${this.brandColor}; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin-right: 12px;">
          Open Business Portal
        </a>
        <a href="${data.downloadUrl}" style="display: inline-block; background: #6b7280; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">
          Download Verification File
        </a>
      </div>

      <p><strong>What you need to do:</strong></p>
      <ol>
        <li>Download the verification database file</li>
        <li>Cross-reference each transaction with your POS system</li>
        <li>Mark each transaction as "verified" or "fake"</li>
        <li>Upload the completed verification file back to the portal</li>
      </ol>

      <p style="color: #dc2626; font-weight: 600;">
        ⚠️ Missing the deadline means you won't receive the feedback database for this week.
      </p>
    `);

    const text = `
Verification Deadline Reminder - ${data.daysRemaining} ${data.daysRemaining === 1 ? 'day' : 'days'} remaining

Hello ${data.businessName},

This is a reminder that your weekly transaction verification for ${data.storeName} is due soon.

Verification Details:
- Store: ${data.storeName}
- Transactions to verify: ${data.transactionCount}
- Deadline: ${this.formatDate(data.deadline)} (${data.daysRemaining} ${data.daysRemaining === 1 ? 'day' : 'days'} remaining)

Business Portal: ${data.portalUrl}
Download File: ${data.downloadUrl}

What you need to do:
1. Download the verification database file
2. Cross-reference each transaction with your POS system
3. Mark each transaction as "verified" or "fake"
4. Upload the completed verification file back to the portal

⚠️ Missing the deadline means you won't receive the feedback database for this week.

Best regards,
The ${this.companyName} Team
    `.trim();

    return { subject, html, text };
  }

  generatePaymentOverdueReminder(data: PaymentOverdueReminderData): EmailTemplate {
    const subject = `Payment Overdue - ${data.daysOverdue} ${data.daysOverdue === 1 ? 'day' : 'days'} past due`;

    const html = this.wrapInEmailLayout(`
      <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; margin-bottom: 24px;">
        <h2 style="color: #dc2626; margin: 0 0 8px 0;">Payment Overdue</h2>
        <p style="margin: 0; color: #374151;">
          Your payment is <strong>${data.daysOverdue} ${data.daysOverdue === 1 ? 'day' : 'days'}</strong> overdue.
        </p>
      </div>

      <p>Hello ${data.businessName},</p>
      
      <p>Your payment for the weekly verification cycle for <strong>${data.storeName}</strong> is now overdue.</p>
      
      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <h3 style="margin: 0 0 16px 0; color: #111827;">Payment Details</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Invoice ID:</td>
            <td style="padding: 8px 0; font-weight: 600;">${data.invoiceId}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Customer rewards:</td>
            <td style="padding: 8px 0; font-weight: 600;">${this.formatCurrency(data.rewardAmount)} SEK</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Administrative fee (20%):</td>
            <td style="padding: 8px 0; font-weight: 600;">${this.formatCurrency(data.adminFee)} SEK</td>
          </tr>
          <tr style="border-top: 2px solid #e5e7eb;">
            <td style="padding: 12px 0 8px 0; color: #111827; font-weight: 600;">Total amount due:</td>
            <td style="padding: 12px 0 8px 0; font-weight: 700; font-size: 18px; color: #dc2626;">
              ${this.formatCurrency(data.totalAmount)} SEK
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Original due date:</td>
            <td style="padding: 8px 0; font-weight: 600; color: #dc2626;">
              ${this.formatDate(data.originalDueDate)} (${data.daysOverdue} ${data.daysOverdue === 1 ? 'day' : 'days'} ago)
            </td>
          </tr>
        </table>
      </div>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${data.paymentUrl}" style="display: inline-block; background: #dc2626; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">
          Make Payment Now
        </a>
      </div>

      <p style="color: #dc2626; font-weight: 600;">
        ⚠️ Until payment is received, customer feedback databases cannot be delivered.
      </p>

      <p>If you have already made this payment, please contact our support team with your payment confirmation.</p>
    `);

    const text = `
Payment Overdue - ${data.daysOverdue} ${data.daysOverdue === 1 ? 'day' : 'days'} past due

Hello ${data.businessName},

Your payment for the weekly verification cycle for ${data.storeName} is now overdue.

Payment Details:
- Invoice ID: ${data.invoiceId}
- Customer rewards: ${this.formatCurrency(data.rewardAmount)} SEK
- Administrative fee (20%): ${this.formatCurrency(data.adminFee)} SEK
- Total amount due: ${this.formatCurrency(data.totalAmount)} SEK
- Original due date: ${this.formatDate(data.originalDueDate)} (${data.daysOverdue} ${data.daysOverdue === 1 ? 'day' : 'days'} ago)

Make Payment: ${data.paymentUrl}

⚠️ Until payment is received, customer feedback databases cannot be delivered.

If you have already made this payment, please contact our support team with your payment confirmation.

Best regards,
The ${this.companyName} Team
    `.trim();

    return { subject, html, text };
  }

  generateWeeklyDigest(data: WeeklyDigestData): EmailTemplate {
    const subject = `Weekly Digest - ${data.storeName} (${this.formatDateShort(data.weekStarting)} - ${this.formatDateShort(data.weekEnding)})`;

    const verificationRate = data.stats.totalTransactions > 0 
      ? Math.round((data.stats.verifiedTransactions / data.stats.totalTransactions) * 100)
      : 0;

    const html = this.wrapInEmailLayout(`
      <h2 style="color: ${this.brandColor}; margin: 0 0 16px 0;">Weekly Performance Summary</h2>
      
      <p>Hello ${data.businessName},</p>
      
      <p>Here's your weekly performance summary for <strong>${data.storeName}</strong> for the week of ${this.formatDateShort(data.weekStarting)} - ${this.formatDateShort(data.weekEnding)}.</p>
      
      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <h3 style="margin: 0 0 16px 0; color: #111827;">Transaction Statistics</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          <div style="text-align: center; padding: 16px; background: white; border-radius: 6px;">
            <div style="font-size: 28px; font-weight: 700; color: ${this.brandColor};">${data.stats.totalTransactions}</div>
            <div style="color: #6b7280; font-size: 14px;">Total Transactions</div>
          </div>
          <div style="text-align: center; padding: 16px; background: white; border-radius: 6px;">
            <div style="font-size: 28px; font-weight: 700; color: #10b981;">${verificationRate}%</div>
            <div style="color: #6b7280; font-size: 14px;">Verification Rate</div>
          </div>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Verified transactions:</td>
            <td style="padding: 8px 0; font-weight: 600; color: #10b981;">${data.stats.verifiedTransactions}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Fake transactions:</td>
            <td style="padding: 8px 0; font-weight: 600; color: #ef4444;">${data.stats.fakeTransactions}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Pending verification:</td>
            <td style="padding: 8px 0; font-weight: 600; color: #f59e0b;">${data.stats.pendingVerification}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Total rewards paid:</td>
            <td style="padding: 8px 0; font-weight: 600;">${this.formatCurrency(data.stats.totalRewards)} SEK</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Average transaction value:</td>
            <td style="padding: 8px 0; font-weight: 600;">${this.formatCurrency(data.stats.avgTransactionValue)} SEK</td>
          </tr>
        </table>
      </div>

      ${data.upcomingDeadlines.length > 0 ? `
        <div style="background: #fffbeb; border: 1px solid #fbbf24; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h3 style="margin: 0 0 16px 0; color: #92400e;">Upcoming Verification Deadlines</h3>
          ${data.upcomingDeadlines.map(deadline => `
            <div style="padding: 8px 0; border-bottom: 1px solid #fbbf24; last-child:border-bottom: none;">
              <strong>${deadline.transactionCount} transactions</strong> due by ${this.formatDate(deadline.deadline)}
            </div>
          `).join('')}
        </div>
      ` : ''}

      <div style="text-align: center; margin: 32px 0;">
        <a href="${data.portalUrl}" style="display: inline-block; background: ${this.brandColor}; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">
          Visit Business Portal
        </a>
      </div>
    `);

    const text = `
Weekly Digest - ${data.storeName} (${this.formatDateShort(data.weekStarting)} - ${this.formatDateShort(data.weekEnding)})

Hello ${data.businessName},

Here's your weekly performance summary for ${data.storeName} for the week of ${this.formatDateShort(data.weekStarting)} - ${this.formatDateShort(data.weekEnding)}.

Transaction Statistics:
- Total Transactions: ${data.stats.totalTransactions}
- Verified transactions: ${data.stats.verifiedTransactions}
- Fake transactions: ${data.stats.fakeTransactions}
- Pending verification: ${data.stats.pendingVerification}
- Total rewards paid: ${this.formatCurrency(data.stats.totalRewards)} SEK
- Average transaction value: ${this.formatCurrency(data.stats.avgTransactionValue)} SEK
- Verification Rate: ${verificationRate}%

${data.upcomingDeadlines.length > 0 ? `
Upcoming Verification Deadlines:
${data.upcomingDeadlines.map(deadline => 
  `- ${deadline.transactionCount} transactions due by ${this.formatDate(deadline.deadline)}`
).join('\n')}
` : ''}

Business Portal: ${data.portalUrl}

Best regards,
The ${this.companyName} Team
    `.trim();

    return { subject, html, text };
  }

  generateCycleCompleteNotification(data: CycleCompleteNotificationData): EmailTemplate {
    const subject = `Verification Cycle Complete - ${data.storeName} (Week ${this.formatDateShort(data.weekStarting)})`;

    const html = this.wrapInEmailLayout(`
      <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 16px; margin-bottom: 24px;">
        <h2 style="color: #10b981; margin: 0 0 8px 0;">✅ Verification Cycle Complete</h2>
        <p style="margin: 0; color: #374151;">
          Your verification for the week of ${this.formatDateShort(data.weekStarting)} is now complete.
        </p>
      </div>

      <p>Hello ${data.businessName},</p>
      
      <p>Great news! Your weekly verification cycle for <strong>${data.storeName}</strong> has been completed successfully.</p>
      
      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <h3 style="margin: 0 0 16px 0; color: #111827;">Verification Results</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Week period:</td>
            <td style="padding: 8px 0; font-weight: 600;">${this.formatDateShort(data.weekStarting)} - ${this.formatDateShort(data.weekEnding)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Total transactions:</td>
            <td style="padding: 8px 0; font-weight: 600;">${data.verificationResults.totalTransactions}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Verified as legitimate:</td>
            <td style="padding: 8px 0; font-weight: 600; color: #10b981;">${data.verificationResults.verifiedCount}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Marked as fake:</td>
            <td style="padding: 8px 0; font-weight: 600; color: #ef4444;">${data.verificationResults.fakeCount}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Verification rate:</td>
            <td style="padding: 8px 0; font-weight: 600;">${Math.round(data.verificationResults.verificationRate * 100)}%</td>
          </tr>
        </table>
      </div>

      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <h3 style="margin: 0 0 16px 0; color: #111827;">Payment Information</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Customer rewards total:</td>
            <td style="padding: 8px 0; font-weight: 600;">${this.formatCurrency(data.paymentInfo.totalRewards)} SEK</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Administrative fee (20%):</td>
            <td style="padding: 8px 0; font-weight: 600;">${this.formatCurrency(data.paymentInfo.adminFee)} SEK</td>
          </tr>
          <tr style="border-top: 2px solid #e5e7eb;">
            <td style="padding: 12px 0 8px 0; color: #111827; font-weight: 600;">Total payment due:</td>
            <td style="padding: 12px 0 8px 0; font-weight: 700; font-size: 18px; color: ${this.brandColor};">
              ${this.formatCurrency(data.paymentInfo.totalDue)} SEK
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Payment due date:</td>
            <td style="padding: 8px 0; font-weight: 600;">${this.formatDate(data.paymentInfo.paymentDueDate)}</td>
          </tr>
        </table>
      </div>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${data.portalUrl}" style="display: inline-block; background: ${this.brandColor}; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin-right: 12px;">
          Process Payment
        </a>
        ${data.feedbackDatabaseUrl ? `
          <a href="${data.feedbackDatabaseUrl}" style="display: inline-block; background: #10b981; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">
            Download Feedback Database
          </a>
        ` : ''}
      </div>

      <p><strong>Next Steps:</strong></p>
      <ol>
        <li>Complete payment by ${this.formatDate(data.paymentInfo.paymentDueDate)}</li>
        <li>Once payment is confirmed, your feedback database will be available for download</li>
        <li>Use the feedback insights to improve your customer experience</li>
      </ol>

      <p>Thank you for completing your verification on time!</p>
    `);

    const text = `
Verification Cycle Complete - ${data.storeName} (Week ${this.formatDateShort(data.weekStarting)})

Hello ${data.businessName},

Great news! Your weekly verification cycle for ${data.storeName} has been completed successfully.

Verification Results:
- Week period: ${this.formatDateShort(data.weekStarting)} - ${this.formatDateShort(data.weekEnding)}
- Total transactions: ${data.verificationResults.totalTransactions}
- Verified as legitimate: ${data.verificationResults.verifiedCount}
- Marked as fake: ${data.verificationResults.fakeCount}
- Verification rate: ${Math.round(data.verificationResults.verificationRate * 100)}%

Payment Information:
- Customer rewards total: ${this.formatCurrency(data.paymentInfo.totalRewards)} SEK
- Administrative fee (20%): ${this.formatCurrency(data.paymentInfo.adminFee)} SEK
- Total payment due: ${this.formatCurrency(data.paymentInfo.totalDue)} SEK
- Payment due date: ${this.formatDate(data.paymentInfo.paymentDueDate)}

Business Portal: ${data.portalUrl}
${data.feedbackDatabaseUrl ? `Feedback Database: ${data.feedbackDatabaseUrl}` : ''}

Next Steps:
1. Complete payment by ${this.formatDate(data.paymentInfo.paymentDueDate)}
2. Once payment is confirmed, your feedback database will be available for download
3. Use the feedback insights to improve your customer experience

Thank you for completing your verification on time!

Best regards,
The ${this.companyName} Team
    `.trim();

    return { subject, html, text };
  }

  private wrapInEmailLayout(content: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.companyName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: white;">
    <!-- Header -->
    <div style="background: ${this.brandColor}; padding: 20px; text-align: center;">
      <img src="${this.logoUrl}" alt="${this.companyName}" style="height: 40px;">
    </div>
    
    <!-- Content -->
    <div style="padding: 32px; line-height: 1.6; color: #374151;">
      ${content}
      
      <!-- Footer -->
      <div style="margin-top: 48px; padding-top: 24px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
        <p>Best regards,<br>The ${this.companyName} Team</p>
        
        <div style="margin-top: 20px; text-align: center;">
          <p style="margin: 8px 0;">
            Questions? Contact us at <a href="mailto:${this.supportEmail}" style="color: ${this.brandColor};">${this.supportEmail}</a>
          </p>
          <p style="margin: 8px 0; font-size: 12px;">
            ${this.companyName} • Stockholm, Sweden
          </p>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
  }

  private formatDateShort(date: Date): string {
    return date.toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('sv-SE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  // Template testing utilities
  async testTemplate(template: EmailTemplate): Promise<boolean> {
    try {
      // Basic validation
      if (!template.subject || !template.html || !template.text) {
        return false;
      }

      // Check for required elements in HTML
      const requiredElements = ['<!DOCTYPE html>', '<html>', '<body>', '</html>'];
      const hasAllElements = requiredElements.every(element => 
        template.html.includes(element)
      );

      await loggingService.logInfo('Email template validation', {
        hasSubject: !!template.subject,
        hasHtml: !!template.html,
        hasText: !!template.text,
        hasRequiredElements: hasAllElements,
        htmlLength: template.html.length,
        textLength: template.text.length
      });

      return hasAllElements;

    } catch (error) {
      await loggingService.logError('Email template validation failed', error as Error);
      return false;
    }
  }
}

export const verificationEmailTemplates = new VerificationEmailTemplateService();
export { VerificationEmailTemplateService };