import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import CustomerSupportPage from '../../src/components/support/CustomerSupportPage';
import SupportRequestForm from '../../src/components/support/SupportRequestForm';
import ContextualFAQ from '../../src/components/support/ContextualFAQ';
import DiagnosticReporter from '../../src/components/support/DiagnosticReporter';

// Mock fetch for API calls
global.fetch = jest.fn();

// Mock console methods to avoid test output noise
const originalConsole = global.console;
beforeEach(() => {
  global.console = {
    ...originalConsole,
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
});

afterEach(() => {
  global.console = originalConsole;
});

// Mock user agent and device detection
Object.defineProperty(window.navigator, 'userAgent', {
  writable: true,
  value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1'
});

// Mock network information API
Object.defineProperty(window.navigator, 'connection', {
  writable: true,
  value: {
    effectiveType: '4g',
    downlink: 10,
    rtt: 100,
    type: 'cellular'
  }
});

// Mock service worker registration
Object.defineProperty(window.navigator, 'serviceWorker', {
  writable: true,
  value: {
    ready: Promise.resolve({
      active: { state: 'activated' }
    }),
    register: jest.fn().mockResolvedValue({}),
    getRegistration: jest.fn().mockResolvedValue({ active: true })
  }
});

describe('Customer Support Integration Tests (T021)', () => {
  const mockSupportData = {
    customer_phone_hash: 'hash_070123456_test',
    store_id: '550e8400-e29b-41d4-a716-446655440000',
    call_session_id: '660e8400-e29b-41d4-a716-446655440001'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset localStorage and sessionStorage
    localStorage.clear();
    sessionStorage.clear();
    
    // Set up successful API responses by default
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/support/faq')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            entries: [
              {
                id: 'faq-001',
                question: 'Why haven\'t I received my verification call?',
                answer: 'Verification calls are typically placed within 2-4 hours. During peak times, it may take up to 24 hours.',
                category: 'verification',
                tags: ['call', 'timing', 'verification'],
                helpful_count: 42,
                related_links: [
                  { title: 'Call Status Tracker', url: '/verification/status' }
                ]
              },
              {
                id: 'faq-002',
                question: 'How do I know if my verification was successful?',
                answer: 'You\'ll receive an SMS confirmation and can check your status on the verification status page.',
                category: 'verification',
                tags: ['confirmation', 'status', 'sms'],
                helpful_count: 38,
                related_links: []
              },
              {
                id: 'faq-003',
                question: 'What should I do if the call quality is poor?',
                answer: 'Please try moving to an area with better signal. You can also request a callback through the support form.',
                category: 'call_quality',
                tags: ['audio', 'quality', 'callback'],
                helpful_count: 25,
                related_links: [
                  { title: 'Request Callback', url: '/support/callback' }
                ]
              }
            ],
            total_count: 3,
            context: 'verification'
          })
        });
      }
      
      if (url.includes('/api/support/contact-info')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            channels: {
              email: {
                address: 'support@vocilia.se',
                response_time: '24 hours',
                available: true
              },
              phone: {
                number: '020-123 45 67',
                country_code: '+46',
                available: true,
                hours: 'Mon-Fri 09:00-17:00 CET'
              },
              chat: {
                available: false,
                estimated_wait: 'N/A',
                queue_position: 0
              }
            },
            business_hours: {
              timezone: 'Europe/Stockholm',
              weekdays: '09:00-17:00',
              weekends: 'Closed'
            },
            emergency_contact: {
              available: true,
              criteria: ['Payment issues', 'Data privacy concerns', 'Account security']
            }
          })
        });
      }
      
      if (url.includes('/api/support/request')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            request_id: '770e8400-e29b-41d4-a716-446655440002',
            created_at: new Date().toISOString(),
            ticket_number: 'SUP-20241222-001',
            estimated_response_time: '24 hours',
            support_channels: {
              email: 'support@vocilia.se',
              phone: '020-123 45 67',
              chat_available: false
            }
          })
        });
      }
      
      if (url.includes('/api/support/diagnostics')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            diagnostic_id: '880e8400-e29b-41d4-a716-446655440003',
            issues_detected: [
              {
                category: 'network',
                severity: 'medium',
                description: 'Slower than optimal connection detected',
                suggested_fix: 'Try connecting to Wi-Fi for better performance'
              }
            ],
            recommendations: [
              'Enable notifications for call status updates',
              'Install the PWA for better offline functionality'
            ],
            support_needed: false,
            auto_support_request: {
              created: false,
              request_id: null
            }
          })
        });
      }
      
      return Promise.reject(new Error(`Unhandled URL in mock: ${url}`));
    });
  });

  describe('1. Contextual FAQ Display', () => {
    it('should display context-appropriate FAQ entries', async () => {
      render(<ContextualFAQ context="verification" searchQuery="" />);

      await waitFor(() => {
        expect(screen.getByText('Why haven\'t I received my verification call?')).toBeInTheDocument();
        expect(screen.getByText('How do I know if my verification was successful?')).toBeInTheDocument();
      });

      // Verify FAQ content structure
      expect(screen.getByText(/Verification calls are typically placed within 2-4 hours/)).toBeInTheDocument();
      expect(screen.getByText(/You'll receive an SMS confirmation/)).toBeInTheDocument();
    });

    it('should filter FAQ entries by search query', async () => {
      const user = userEvent.setup();
      render(<ContextualFAQ context="verification" searchQuery="" />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('Why haven\'t I received my verification call?')).toBeInTheDocument();
      });

      // Search for specific topic
      const searchInput = screen.getByPlaceholderText(/search help topics/i);
      await user.type(searchInput, 'call quality');

      // Verify filtered results
      await waitFor(() => {
        expect(screen.getByText('What should I do if the call quality is poor?')).toBeInTheDocument();
        expect(screen.queryByText('Why haven\'t I received my verification call?')).not.toBeInTheDocument();
      });
    });

    it('should display helpful count and related links', async () => {
      render(<ContextualFAQ context="verification" searchQuery="" />);

      await waitFor(() => {
        expect(screen.getByText('42 people found this helpful')).toBeInTheDocument();
        expect(screen.getByText('Call Status Tracker')).toBeInTheDocument();
      });

      // Test related link navigation
      const relatedLink = screen.getByText('Call Status Tracker');
      expect(relatedLink.closest('a')).toHaveAttribute('href', '/verification/status');
    });

    it('should handle FAQ loading errors gracefully', async () => {
      (global.fetch as jest.Mock).mockImplementationOnce(() =>
        Promise.reject(new Error('Network error'))
      );

      render(<ContextualFAQ context="verification" searchQuery="" />);

      await waitFor(() => {
        expect(screen.getByText(/unable to load help content/i)).toBeInTheDocument();
        expect(screen.getByText(/try again/i)).toBeInTheDocument();
      });
    });

    it('should support keyboard navigation through FAQ entries', async () => {
      render(<ContextualFAQ context="verification" searchQuery="" />);

      await waitFor(() => {
        expect(screen.getByText('Why haven\'t I received my verification call?')).toBeInTheDocument();
      });

      // Test keyboard navigation
      const firstFAQItem = screen.getByText('Why haven\'t I received my verification call?').closest('[role="button"]');
      firstFAQItem?.focus();
      expect(firstFAQItem).toHaveFocus();

      // Test expanding/collapsing with keyboard
      fireEvent.keyDown(firstFAQItem!, { key: 'Enter' });
      await waitFor(() => {
        expect(screen.getByText(/Verification calls are typically placed/)).toBeVisible();
      });
    });
  });

  describe('2. Support Request Form Submission', () => {
    it('should submit complete support request with all required fields', async () => {
      const user = userEvent.setup();
      render(
        <SupportRequestForm 
          customerData={mockSupportData}
          onSuccess={jest.fn()}
          onError={jest.fn()}
        />
      );

      // Fill out support request form
      await user.selectOptions(screen.getByLabelText(/request type/i), 'verification_issue');
      await user.type(screen.getByLabelText(/subject/i), 'Cannot complete phone verification');
      await user.type(
        screen.getByLabelText(/description/i), 
        'I have tried multiple times but the verification call never comes through. My phone number is correct and I can receive other calls.'
      );
      await user.selectOptions(screen.getByLabelText(/priority/i), 'high');

      // Submit form
      await user.click(screen.getByRole('button', { name: /submit request/i }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/support/request', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            customer_phone_hash: mockSupportData.customer_phone_hash,
            store_id: mockSupportData.store_id,
            call_session_id: mockSupportData.call_session_id,
            request_type: 'verification_issue',
            subject: 'Cannot complete phone verification',
            description: 'I have tried multiple times but the verification call never comes through. My phone number is correct and I can receive other calls.',
            priority: 'high',
            customer_context: expect.objectContaining({
              user_agent: expect.stringContaining('iPhone'),
              device_type: 'mobile',
              accessibility_enabled: expect.any(Boolean),
              pwa_installed: expect.any(Boolean),
              current_page: expect.any(String)
            })
          })
        });
      });
    });

    it('should display success confirmation with ticket information', async () => {
      const user = userEvent.setup();
      const onSuccess = jest.fn();
      
      render(
        <SupportRequestForm 
          customerData={mockSupportData}
          onSuccess={onSuccess}
          onError={jest.fn()}
        />
      );

      // Submit minimal valid form
      await user.selectOptions(screen.getByLabelText(/request type/i), 'general_inquiry');
      await user.type(screen.getByLabelText(/subject/i), 'Test inquiry');
      await user.type(screen.getByLabelText(/description/i), 'This is a test inquiry.');
      await user.click(screen.getByRole('button', { name: /submit request/i }));

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith({
          request_id: '770e8400-e29b-41d4-a716-446655440002',
          created_at: expect.any(String),
          ticket_number: 'SUP-20241222-001',
          estimated_response_time: '24 hours',
          support_channels: {
            email: 'support@vocilia.se',
            phone: '020-123 45 67',
            chat_available: false
          }
        });
      });
    });

    it('should validate required fields and show error messages', async () => {
      const user = userEvent.setup();
      render(
        <SupportRequestForm 
          customerData={mockSupportData}
          onSuccess={jest.fn()}
          onError={jest.fn()}
        />
      );

      // Try to submit without filling required fields
      await user.click(screen.getByRole('button', { name: /submit request/i }));

      await waitFor(() => {
        expect(screen.getByText(/request type is required/i)).toBeInTheDocument();
        expect(screen.getByText(/subject is required/i)).toBeInTheDocument();
        expect(screen.getByText(/description is required/i)).toBeInTheDocument();
      });

      // Verify form is not submitted
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should enforce character limits for text fields', async () => {
      const user = userEvent.setup();
      render(
        <SupportRequestForm 
          customerData={mockSupportData}
          onSuccess={jest.fn()}
          onError={jest.fn()}
        />
      );

      // Test subject character limit (200 chars)
      const longSubject = 'A'.repeat(201);
      const subjectField = screen.getByLabelText(/subject/i);
      await user.type(subjectField, longSubject);

      await waitFor(() => {
        expect(screen.getByText(/subject must be 200 characters or less/i)).toBeInTheDocument();
      });

      // Test description character limit (2000 chars)
      const longDescription = 'B'.repeat(2001);
      const descriptionField = screen.getByLabelText(/description/i);
      await user.clear(descriptionField);
      await user.type(descriptionField, longDescription);

      await waitFor(() => {
        expect(screen.getByText(/description must be 2000 characters or less/i)).toBeInTheDocument();
      });
    });

    it('should handle different request types appropriately', async () => {
      const user = userEvent.setup();
      render(
        <SupportRequestForm 
          customerData={mockSupportData}
          onSuccess={jest.fn()}
          onError={jest.fn()}
        />
      );

      // Test each request type
      const requestTypes = [
        'verification_issue',
        'call_quality', 
        'reward_question',
        'technical_problem',
        'accessibility_issue',
        'general_inquiry'
      ];

      for (const requestType of requestTypes) {
        await user.selectOptions(screen.getByLabelText(/request type/i), requestType);
        
        // Verify appropriate help text or fields appear
        if (requestType === 'accessibility_issue') {
          expect(screen.getByText(/accessibility features/i)).toBeInTheDocument();
        } else if (requestType === 'technical_problem') {
          expect(screen.getByText(/technical details/i)).toBeInTheDocument();
        }
      }
    });
  });

  describe('3. Diagnostic Information Collection', () => {
    it('should automatically collect comprehensive diagnostic data', async () => {
      render(<DiagnosticReporter customerData={mockSupportData} />);

      // Trigger diagnostic collection
      const collectButton = screen.getByRole('button', { name: /collect diagnostics/i });
      await userEvent.click(collectButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/support/diagnostics', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            customer_phone_hash: mockSupportData.customer_phone_hash,
            diagnostic_type: 'comprehensive',
            system_info: expect.objectContaining({
              user_agent: expect.stringContaining('iPhone'),
              screen_resolution: expect.any(String),
              viewport_size: expect.any(String),
              timezone: expect.any(String),
              language: expect.any(String)
            }),
            browser_info: expect.objectContaining({
              cookies_enabled: expect.any(Boolean),
              local_storage_available: expect.any(Boolean),
              service_worker_supported: expect.any(Boolean)
            }),
            network_info: expect.objectContaining({
              effective_type: '4g',
              downlink: 10,
              rtt: 100
            }),
            accessibility_info: expect.objectContaining({
              screen_reader_detected: expect.any(Boolean),
              high_contrast_enabled: expect.any(Boolean),
              reduced_motion_enabled: expect.any(Boolean)
            })
          })
        });
      });
    });

    it('should detect and report accessibility settings', async () => {
      // Mock high contrast mode
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-contrast: high)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });

      render(<DiagnosticReporter customerData={mockSupportData} />);

      const collectButton = screen.getByRole('button', { name: /collect diagnostics/i });
      await userEvent.click(collectButton);

      await waitFor(() => {
        const diagnosticCall = (global.fetch as jest.Mock).mock.calls.find(
          call => call[0].includes('/api/support/diagnostics')
        );
        const requestBody = JSON.parse(diagnosticCall[1].body);
        
        expect(requestBody.accessibility_info.high_contrast_enabled).toBe(true);
      });
    });

    it('should collect and include error logs', async () => {
      // Simulate some error logs in localStorage
      const errorLogs = [
        {
          timestamp: new Date().toISOString(),
          level: 'error',
          message: 'Network request failed',
          stack: 'Error: Network request failed\n    at fetch...'
        },
        {
          timestamp: new Date().toISOString(),
          level: 'warn',
          message: 'Deprecated API usage detected',
          stack: ''
        }
      ];
      
      localStorage.setItem('vocilia_error_logs', JSON.stringify(errorLogs));

      render(<DiagnosticReporter customerData={mockSupportData} />);

      const collectButton = screen.getByRole('button', { name: /collect diagnostics/i });
      await userEvent.click(collectButton);

      await waitFor(() => {
        const diagnosticCall = (global.fetch as jest.Mock).mock.calls.find(
          call => call[0].includes('/api/support/diagnostics')
        );
        const requestBody = JSON.parse(diagnosticCall[1].body);
        
        expect(requestBody.error_logs).toHaveLength(2);
        expect(requestBody.error_logs[0].message).toBe('Network request failed');
      });
    });

    it('should display diagnostic results and recommendations', async () => {
      render(<DiagnosticReporter customerData={mockSupportData} />);

      const collectButton = screen.getByRole('button', { name: /collect diagnostics/i });
      await userEvent.click(collectButton);

      await waitFor(() => {
        expect(screen.getByText(/diagnostic complete/i)).toBeInTheDocument();
        expect(screen.getByText(/1 issue detected/i)).toBeInTheDocument();
        expect(screen.getByText(/Slower than optimal connection detected/i)).toBeInTheDocument();
        expect(screen.getByText(/Try connecting to Wi-Fi/i)).toBeInTheDocument();
      });

      // Verify recommendations are displayed
      expect(screen.getByText(/Enable notifications for call status updates/i)).toBeInTheDocument();
      expect(screen.getByText(/Install the PWA for better offline functionality/i)).toBeInTheDocument();
    });

    it('should handle diagnostic collection errors', async () => {
      (global.fetch as jest.Mock).mockImplementationOnce(() =>
        Promise.reject(new Error('Diagnostic service unavailable'))
      );

      render(<DiagnosticReporter customerData={mockSupportData} />);

      const collectButton = screen.getByRole('button', { name: /collect diagnostics/i });
      await userEvent.click(collectButton);

      await waitFor(() => {
        expect(screen.getByText(/unable to collect diagnostics/i)).toBeInTheDocument();
        expect(screen.getByText(/try again later/i)).toBeInTheDocument();
      });
    });
  });

  describe('4. Support Ticket Tracking', () => {
    it('should display ticket creation confirmation', async () => {
      const user = userEvent.setup();
      render(
        <SupportRequestForm 
          customerData={mockSupportData}
          onSuccess={jest.fn()}
          onError={jest.fn()}
        />
      );

      // Submit form
      await user.selectOptions(screen.getByLabelText(/request type/i), 'general_inquiry');
      await user.type(screen.getByLabelText(/subject/i), 'Test inquiry');
      await user.type(screen.getByLabelText(/description/i), 'Test description');
      await user.click(screen.getByRole('button', { name: /submit request/i }));

      await waitFor(() => {
        expect(screen.getByText(/support request submitted successfully/i)).toBeInTheDocument();
        expect(screen.getByText(/SUP-20241222-001/)).toBeInTheDocument();
        expect(screen.getByText(/24 hours/)).toBeInTheDocument();
      });
    });

    it('should provide follow-up contact information', async () => {
      const user = userEvent.setup();
      render(
        <SupportRequestForm 
          customerData={mockSupportData}
          onSuccess={jest.fn()}
          onError={jest.fn()}
        />
      );

      // Submit form and verify contact info is shown
      await user.selectOptions(screen.getByLabelText(/request type/i), 'general_inquiry');
      await user.type(screen.getByLabelText(/subject/i), 'Test inquiry');
      await user.type(screen.getByLabelText(/description/i), 'Test description');
      await user.click(screen.getByRole('button', { name: /submit request/i }));

      await waitFor(() => {
        expect(screen.getByText(/support@vocilia.se/)).toBeInTheDocument();
        expect(screen.getByText(/020-123 45 67/)).toBeInTheDocument();
      });
    });

    it('should handle high priority requests appropriately', async () => {
      const user = userEvent.setup();
      
      // Mock urgent priority response
      (global.fetch as jest.Mock).mockImplementationOnce((url: string) => {
        if (url.includes('/api/support/request')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              request_id: '770e8400-e29b-41d4-a716-446655440002',
              created_at: new Date().toISOString(),
              ticket_number: 'URG-20241222-001',
              estimated_response_time: '2 hours',
              support_channels: {
                email: 'urgent@vocilia.se',
                phone: '020-123 45 67',
                chat_available: true
              }
            })
          });
        }
        return Promise.reject(new Error('Unhandled URL'));
      });

      render(
        <SupportRequestForm 
          customerData={mockSupportData}
          onSuccess={jest.fn()}
          onError={jest.fn()}
        />
      );

      // Submit urgent request
      await user.selectOptions(screen.getByLabelText(/request type/i), 'technical_problem');
      await user.type(screen.getByLabelText(/subject/i), 'Critical verification failure');
      await user.type(screen.getByLabelText(/description/i), 'System is completely broken');
      await user.selectOptions(screen.getByLabelText(/priority/i), 'urgent');
      await user.click(screen.getByRole('button', { name: /submit request/i }));

      await waitFor(() => {
        expect(screen.getByText(/URG-20241222-001/)).toBeInTheDocument();
        expect(screen.getByText(/2 hours/)).toBeInTheDocument();
        expect(screen.getByText(/urgent@vocilia.se/)).toBeInTheDocument();
      });
    });
  });

  describe('5. Multi-Channel Support Integration', () => {
    it('should display all available support channels', async () => {
      render(<CustomerSupportPage customerData={mockSupportData} />);

      await waitFor(() => {
        // Email support
        expect(screen.getByText(/support@vocilia.se/)).toBeInTheDocument();
        expect(screen.getByText(/24 hours/)).toBeInTheDocument();
        
        // Phone support
        expect(screen.getByText(/020-123 45 67/)).toBeInTheDocument();
        expect(screen.getByText(/Mon-Fri 09:00-17:00 CET/)).toBeInTheDocument();
        
        // Chat support status
        expect(screen.getByText(/chat.*currently.*unavailable/i)).toBeInTheDocument();
      });
    });

    it('should show business hours and timezone information', async () => {
      render(<CustomerSupportPage customerData={mockSupportData} />);

      await waitFor(() => {
        expect(screen.getByText(/Europe\/Stockholm/)).toBeInTheDocument();
        expect(screen.getByText(/09:00-17:00/)).toBeInTheDocument();
        expect(screen.getByText(/weekends.*closed/i)).toBeInTheDocument();
      });
    });

    it('should indicate emergency contact availability', async () => {
      render(<CustomerSupportPage customerData={mockSupportData} />);

      await waitFor(() => {
        expect(screen.getByText(/emergency contact.*available/i)).toBeInTheDocument();
        expect(screen.getByText(/payment issues/i)).toBeInTheDocument();
        expect(screen.getByText(/data privacy concerns/i)).toBeInTheDocument();
        expect(screen.getByText(/account security/i)).toBeInTheDocument();
      });
    });

    it('should handle support channel API errors gracefully', async () => {
      (global.fetch as jest.Mock).mockImplementationOnce((url: string) => {
        if (url.includes('/api/support/contact-info')) {
          return Promise.reject(new Error('Service unavailable'));
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      });

      render(<CustomerSupportPage customerData={mockSupportData} />);

      await waitFor(() => {
        expect(screen.getByText(/unable to load contact information/i)).toBeInTheDocument();
        // Should still show fallback contact methods
        expect(screen.getByText(/support@vocilia.se/)).toBeInTheDocument();
      });
    });

    it('should provide direct actions for each support channel', async () => {
      const user = userEvent.setup();
      render(<CustomerSupportPage customerData={mockSupportData} />);

      await waitFor(() => {
        // Email link should open email client
        const emailLink = screen.getByText(/send email/i).closest('a');
        expect(emailLink).toHaveAttribute('href', 'mailto:support@vocilia.se');
        
        // Phone link should trigger phone call
        const phoneLink = screen.getByText(/call now/i).closest('a');
        expect(phoneLink).toHaveAttribute('href', 'tel:+46201234567');
      });
    });
  });

  describe('6. Accessibility and Usability', () => {
    it('should support keyboard navigation throughout support interface', async () => {
      render(<CustomerSupportPage customerData={mockSupportData} />);

      await waitFor(() => {
        expect(screen.getByText(/support@vocilia.se/)).toBeInTheDocument();
      });

      // Test tab navigation through support options
      const supportElements = screen.getAllByRole('button').concat(screen.getAllByRole('link'));
      
      for (let i = 0; i < Math.min(supportElements.length, 5); i++) {
        fireEvent.focus(supportElements[i]);
        expect(supportElements[i]).toHaveFocus();
      }
    });

    it('should have proper ARIA labels and descriptions', async () => {
      render(<CustomerSupportPage customerData={mockSupportData} />);

      await waitFor(() => {
        // Check for proper labeling
        expect(screen.getByLabelText(/email support/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/phone support/i)).toBeInTheDocument();
        
        // Check for descriptive text
        expect(screen.getByText(/response time/i)).toBeInTheDocument();
        expect(screen.getByText(/business hours/i)).toBeInTheDocument();
      });
    });

    it('should work with screen readers', async () => {
      render(<CustomerSupportPage customerData={mockSupportData} />);

      await waitFor(() => {
        // Check for screen reader friendly structure
        const headings = screen.getAllByRole('heading');
        expect(headings.length).toBeGreaterThan(0);
        
        // Check for proper heading hierarchy
        const mainHeading = screen.getByRole('heading', { level: 1 });
        expect(mainHeading).toBeInTheDocument();
      });
    });

    it('should handle high contrast mode appropriately', async () => {
      // Mock high contrast media query
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-contrast: high)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });

      render(<CustomerSupportPage customerData={mockSupportData} />);

      await waitFor(() => {
        // Verify that high contrast styles are applied
        const supportPage = screen.getByTestId('customer-support-page');
        expect(supportPage).toHaveClass('high-contrast');
      });
    });
  });

  describe('7. Performance and Error Handling', () => {
    it('should load support content quickly', async () => {
      const startTime = performance.now();
      
      render(<CustomerSupportPage customerData={mockSupportData} />);

      await waitFor(() => {
        expect(screen.getByText(/support@vocilia.se/)).toBeInTheDocument();
      });

      const loadTime = performance.now() - startTime;
      expect(loadTime).toBeLessThan(1000); // Should load within 1 second
    });

    it('should handle network timeouts gracefully', async () => {
      (global.fetch as jest.Mock).mockImplementationOnce(() =>
        new Promise(resolve => setTimeout(resolve, 30000)) // 30 second timeout
      );

      render(<CustomerSupportPage customerData={mockSupportData} />);

      await waitFor(() => {
        expect(screen.getByText(/loading support information/i)).toBeInTheDocument();
      }, { timeout: 2000 });

      // Should show timeout message
      await waitFor(() => {
        expect(screen.getByText(/request timed out/i)).toBeInTheDocument();
      }, { timeout: 10000 });
    });

    it('should retry failed requests with exponential backoff', async () => {
      let callCount = 0;
      (global.fetch as jest.Mock).mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ entries: [], total_count: 0 })
        });
      });

      render(<ContextualFAQ context="verification" searchQuery="" />);

      // Should eventually succeed after retries
      await waitFor(() => {
        expect(callCount).toBe(3);
      }, { timeout: 10000 });
    });

    it('should cache support data to improve performance', async () => {
      // First render
      render(<CustomerSupportPage customerData={mockSupportData} />);
      
      await waitFor(() => {
        expect(screen.getByText(/support@vocilia.se/)).toBeInTheDocument();
      });

      const firstCallCount = (global.fetch as jest.Mock).mock.calls.length;

      // Second render should use cached data
      render(<CustomerSupportPage customerData={mockSupportData} />);
      
      await waitFor(() => {
        expect(screen.getByText(/support@vocilia.se/)).toBeInTheDocument();
      });

      // Should not make additional API calls for cached data
      expect((global.fetch as jest.Mock).mock.calls.length).toBe(firstCallCount);
    });
  });

  describe('8. Integration with Customer Journey', () => {
    it('should link support requests to active call sessions', async () => {
      const user = userEvent.setup();
      render(
        <SupportRequestForm 
          customerData={{
            ...mockSupportData,
            call_session_id: '660e8400-e29b-41d4-a716-446655440001'
          }}
          onSuccess={jest.fn()}
          onError={jest.fn()}
        />
      );

      // Submit support request
      await user.selectOptions(screen.getByLabelText(/request type/i), 'call_quality');
      await user.type(screen.getByLabelText(/subject/i), 'Poor call audio quality');
      await user.type(screen.getByLabelText(/description/i), 'Could barely hear the questions');
      await user.click(screen.getByRole('button', { name: /submit request/i }));

      await waitFor(() => {
        const requestCall = (global.fetch as jest.Mock).mock.calls.find(
          call => call[0].includes('/api/support/request')
        );
        const requestBody = JSON.parse(requestCall[1].body);
        
        expect(requestBody.call_session_id).toBe('660e8400-e29b-41d4-a716-446655440001');
        expect(requestBody.request_type).toBe('call_quality');
      });
    });

    it('should pre-populate context from current verification session', async () => {
      // Mock verification session in localStorage
      localStorage.setItem('vocilia_verification_session', JSON.stringify({
        store_id: mockSupportData.store_id,
        transaction_amount: 125.50,
        verification_status: 'call_in_progress'
      }));

      render(
        <SupportRequestForm 
          customerData={mockSupportData}
          onSuccess={jest.fn()}
          onError={jest.fn()}
        />
      );

      const user = userEvent.setup();
      await user.selectOptions(screen.getByLabelText(/request type/i), 'verification_issue');
      await user.type(screen.getByLabelText(/subject/i), 'Test subject');
      await user.type(screen.getByLabelText(/description/i), 'Test description');
      await user.click(screen.getByRole('button', { name: /submit request/i }));

      await waitFor(() => {
        const requestCall = (global.fetch as jest.Mock).mock.calls.find(
          call => call[0].includes('/api/support/request')
        );
        const requestBody = JSON.parse(requestCall[1].body);
        
        expect(requestBody.customer_context.current_page).toContain('verification');
        expect(requestBody.customer_context.verification_status).toBe('call_in_progress');
      });
    });

    it('should provide relevant help based on current user state', async () => {
      // Mock user currently in call
      sessionStorage.setItem('vocilia_call_status', 'in_progress');
      
      render(<ContextualFAQ context="call_in_progress" searchQuery="" />);

      await waitFor(() => {
        expect(screen.getByText(/call quality/i)).toBeInTheDocument();
      });

      // Should show call-specific help topics
      expect(screen.getByText(/What should I do if the call quality is poor/)).toBeInTheDocument();
    });
  });
});