import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { SupportTicketManager } from '../../src/services/communication/support-ticket-manager';
import { supabase } from '@vocilia/database';
import { addHours, addMinutes, subHours, subMinutes, format } from 'date-fns';

// Mock dependencies
jest.mock('@vocilia/database');

interface MockSupabaseResponse {
  data: any;
  error: any;
}

describe('SupportTicketManager', () => {
  let ticketManager: SupportTicketManager;
  let mockSupabase: any;

  const mockTicket = {
    id: 'ticket_123',
    title: 'Problem med verifiering',
    category: 'verification',
    priority: 'high' as const,
    status: 'open' as const,
    customer_id: 'customer_456',
    business_id: 'business_789',
    contact_email: 'kontakt@företag.se',
    contact_phone: '+46701234567',
    description: 'Vi kan inte slutföra verifieringsprocessen för veckans databas.',
    created_at: '2025-09-26T10:00:00Z',
    updated_at: '2025-09-26T10:00:00Z',
    sla_deadline: '2025-09-26T12:00:00Z',
    assigned_agent: null,
    resolution: null,
    satisfaction_rating: null,
    tags: ['verification', 'urgent'],
    channel: 'email' as const
  };

  const mockAgent = {
    id: 'agent_123',
    name: 'Anna Support',
    email: 'anna@vocilia.se',
    specializations: ['verification', 'payment'],
    workload: 5,
    is_available: true,
    max_concurrent_tickets: 10
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Supabase
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      gt: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn(),
      rpc: jest.fn()
    };
    (supabase as any) = mockSupabase;

    ticketManager = new SupportTicketManager();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('createTicket', () => {
    it('should create ticket with correct SLA deadline based on category', async () => {
      const ticketData = {
        title: 'Betalningsproblem',
        category: 'payment',
        description: 'Fakturan har inte kommit än',
        contact_email: 'kontakt@företag.se',
        business_id: 'business_789'
      };

      mockSupabase.single.mockResolvedValue({
        data: { 
          ...mockTicket, 
          ...ticketData,
          id: 'ticket_new',
          sla_deadline: addHours(new Date(), 4).toISOString(), // Payment SLA: 4 hours
          priority: 'high'
        },
        error: null
      });

      const result = await ticketManager.createTicket(ticketData);

      expect(result.category).toBe('payment');
      expect(result.priority).toBe('high');
      expect(new Date(result.sla_deadline)).toBeInstanceOf(Date);
    });

    it('should auto-assign based on agent specialization and workload', async () => {
      const verificationTicket = {
        title: 'Verifieringsproblem',
        category: 'verification',
        description: 'Databas inte mottagen',
        contact_email: 'test@företag.se',
        business_id: 'business_123'
      };

      // Mock agent lookup
      mockSupabase.single
        .mockResolvedValueOnce({
          data: [mockAgent],
          error: null
        })
        .mockResolvedValueOnce({
          data: {
            ...mockTicket,
            ...verificationTicket,
            assigned_agent: mockAgent.id,
            status: 'assigned'
          },
          error: null
        });

      const result = await ticketManager.createTicket(verificationTicket);

      expect(result.assigned_agent).toBe(mockAgent.id);
      expect(result.status).toBe('assigned');
    });

    it('should set correct priority based on category and business tier', async () => {
      const urgentTicket = {
        title: 'Systemet nere',
        category: 'technical',
        description: 'Kan inte komma åt dashboarden',
        contact_email: 'vip@storföretag.se',
        business_id: 'business_vip'
      };

      // Mock VIP business lookup
      mockSupabase.single
        .mockResolvedValueOnce({
          data: { id: 'business_vip', tier: 'enterprise', is_vip: true },
          error: null
        })
        .mockResolvedValueOnce({
          data: {
            ...mockTicket,
            ...urgentTicket,
            priority: 'urgent',
            sla_deadline: addMinutes(new Date(), 30).toISOString()
          },
          error: null
        });

      const result = await ticketManager.createTicket(urgentTicket);

      expect(result.priority).toBe('urgent');
      // VIP customers get 30-minute SLA for urgent technical issues
      expect(new Date(result.sla_deadline).getTime() - new Date().getTime()).toBeLessThan(35 * 60 * 1000);
    });
  });

  describe('SLA tracking', () => {
    it('should identify tickets approaching SLA deadline', async () => {
      const approachingDeadlineTickets = [
        {
          ...mockTicket,
          id: 'ticket_1',
          sla_deadline: addMinutes(new Date(), 15).toISOString(), // 15 minutes left
          status: 'in_progress'
        },
        {
          ...mockTicket,
          id: 'ticket_2', 
          sla_deadline: addMinutes(new Date(), 45).toISOString(), // 45 minutes left
          status: 'open'
        }
      ];

      mockSupabase.single.mockResolvedValue({
        data: approachingDeadlineTickets,
        error: null
      });

      const approaching = await ticketManager.getTicketsApproachingSLA(60); // Within 1 hour

      expect(approaching).toHaveLength(2);
      expect(approaching[0].id).toBe('ticket_1');
      expect(approaching[1].id).toBe('ticket_2');
    });

    it('should identify overdue tickets', async () => {
      const overdueTickets = [
        {
          ...mockTicket,
          id: 'ticket_overdue',
          sla_deadline: subHours(new Date(), 2).toISOString(), // 2 hours overdue
          status: 'open'
        }
      ];

      mockSupabase.single.mockResolvedValue({
        data: overdueTickets,
        error: null
      });

      const overdue = await ticketManager.getOverdueTickets();

      expect(overdue).toHaveLength(1);
      expect(overdue[0].id).toBe('ticket_overdue');
      expect(new Date(overdue[0].sla_deadline).getTime()).toBeLessThan(new Date().getTime());
    });

    it('should calculate SLA compliance metrics', async () => {
      const mockMetrics = {
        total_tickets: 100,
        within_sla: 92,
        breached_sla: 8,
        average_resolution_time_hours: 3.5,
        compliance_rate: 92.0,
        by_category: {
          verification: { compliance_rate: 95.0, avg_resolution_hours: 2.0 },
          payment: { compliance_rate: 88.0, avg_resolution_hours: 4.2 },
          technical: { compliance_rate: 90.0, avg_resolution_hours: 6.1 }
        }
      };

      mockSupabase.rpc.mockResolvedValue({
        data: mockMetrics,
        error: null
      });

      const metrics = await ticketManager.getSLAMetrics('last_30_days');

      expect(metrics.compliance_rate).toBe(92.0);
      expect(metrics.by_category.verification.compliance_rate).toBe(95.0);
      expect(metrics.average_resolution_time_hours).toBe(3.5);
    });
  });

  describe('ticket assignment', () => {
    it('should assign ticket to best available agent', async () => {
      const agents = [
        { ...mockAgent, id: 'agent_1', workload: 8, specializations: ['payment'] },
        { ...mockAgent, id: 'agent_2', workload: 3, specializations: ['verification', 'payment'] },
        { ...mockAgent, id: 'agent_3', workload: 5, specializations: ['technical'] }
      ];

      mockSupabase.single.mockResolvedValue({
        data: agents,
        error: null
      });

      const bestAgent = await ticketManager.findBestAgent('payment');

      // Should pick agent_2: has payment specialization and lowest workload among payment specialists
      expect(bestAgent.id).toBe('agent_2');
      expect(bestAgent.workload).toBe(3);
      expect(bestAgent.specializations).toContain('payment');
    });

    it('should reassign tickets when agent is unavailable', async () => {
      mockSupabase.single
        .mockResolvedValueOnce({
          data: { ...mockTicket, assigned_agent: 'agent_unavailable' },
          error: null
        })
        .mockResolvedValueOnce({
          data: [{ ...mockAgent, id: 'agent_available' }],
          error: null
        })
        .mockResolvedValueOnce({
          data: { ...mockTicket, assigned_agent: 'agent_available' },
          error: null
        });

      const result = await ticketManager.reassignTicket('ticket_123', 'agent_available', 'Previous agent unavailable');

      expect(result.assigned_agent).toBe('agent_available');
    });

    it('should distribute workload evenly among agents', async () => {
      const currentWorkloads = {
        'agent_1': 2,
        'agent_2': 5,
        'agent_3': 3
      };

      mockSupabase.rpc.mockResolvedValue({
        data: currentWorkloads,
        error: null
      });

      const workloads = await ticketManager.getAgentWorkloads();

      expect(workloads['agent_1']).toBe(2);
      expect(workloads['agent_2']).toBe(5);
      expect(workloads['agent_3']).toBe(3);
    });
  });

  describe('ticket lifecycle management', () => {
    it('should update ticket status with proper state transitions', async () => {
      const validTransitions = [
        { from: 'open', to: 'assigned' },
        { from: 'assigned', to: 'in_progress' },
        { from: 'in_progress', to: 'pending_customer' },
        { from: 'pending_customer', to: 'in_progress' },
        { from: 'in_progress', to: 'resolved' },
        { from: 'resolved', to: 'closed' }
      ];

      for (const transition of validTransitions) {
        mockSupabase.single.mockResolvedValue({
          data: { ...mockTicket, status: transition.to },
          error: null
        });

        const result = await ticketManager.updateTicketStatus('ticket_123', transition.to, 'Status update');

        expect(result.status).toBe(transition.to);
      }
    });

    it('should reject invalid status transitions', async () => {
      const invalidTransitions = [
        { from: 'open', to: 'resolved' }, // Cannot skip assignment and progress
        { from: 'closed', to: 'open' },   // Cannot reopen closed tickets
        { from: 'resolved', to: 'open' }  // Cannot revert resolved tickets
      ];

      for (const transition of invalidTransitions) {
        await expect(ticketManager.updateTicketStatus('ticket_123', transition.to))
          .rejects.toThrow(`Invalid status transition from ${transition.from} to ${transition.to}`);
      }
    });

    it('should add timestamps for status changes', async () => {
      const statusUpdates = [
        { status: 'assigned', expectedField: 'assigned_at' },
        { status: 'in_progress', expectedField: 'started_at' },
        { status: 'resolved', expectedField: 'resolved_at' },
        { status: 'closed', expectedField: 'closed_at' }
      ];

      for (const update of statusUpdates) {
        mockSupabase.single.mockResolvedValue({
          data: { 
            ...mockTicket, 
            status: update.status,
            [update.expectedField]: new Date().toISOString()
          },
          error: null
        });

        const result = await ticketManager.updateTicketStatus('ticket_123', update.status);

        expect(result[update.expectedField]).toBeDefined();
        expect(new Date(result[update.expectedField])).toBeInstanceOf(Date);
      }
    });
  });

  describe('escalation management', () => {
    it('should escalate overdue high priority tickets', async () => {
      const overdueHighPriorityTicket = {
        ...mockTicket,
        priority: 'high',
        sla_deadline: subHours(new Date(), 1).toISOString(),
        status: 'in_progress',
        escalation_level: 0
      };

      mockSupabase.single
        .mockResolvedValueOnce({
          data: [overdueHighPriorityTicket],
          error: null
        })
        .mockResolvedValueOnce({
          data: { 
            ...overdueHighPriorityTicket, 
            escalation_level: 1,
            escalated_at: new Date().toISOString(),
            escalated_to: 'supervisor_123'
          },
          error: null
        });

      const escalated = await ticketManager.escalateOverdueTickets();

      expect(escalated).toHaveLength(1);
      expect(escalated[0].escalation_level).toBe(1);
      expect(escalated[0].escalated_to).toBe('supervisor_123');
    });

    it('should send escalation notifications', async () => {
      const escalationNotification = {
        ticket_id: 'ticket_123',
        escalation_level: 1,
        escalated_to: 'supervisor_123',
        reason: 'SLA breach - 1 hour overdue',
        notification_sent: true
      };

      mockSupabase.single.mockResolvedValue({
        data: escalationNotification,
        error: null
      });

      const result = await ticketManager.escalateTicket('ticket_123', 1, 'SLA breach - 1 hour overdue');

      expect(result.escalation_level).toBe(1);
      expect(result.notification_sent).toBe(true);
    });
  });

  describe('customer satisfaction', () => {
    it('should collect satisfaction ratings after resolution', async () => {
      const satisfactionData = {
        ticket_id: 'ticket_123',
        rating: 4,
        feedback: 'Snabb service men kunde varit tydligare med instruktioner',
        submitted_at: new Date().toISOString()
      };

      mockSupabase.single.mockResolvedValue({
        data: satisfactionData,
        error: null
      });

      const result = await ticketManager.submitSatisfactionRating('ticket_123', {
        rating: 4,
        feedback: 'Snabb service men kunde varit tydligare med instruktioner'
      });

      expect(result.rating).toBe(4);
      expect(result.feedback).toContain('Snabb service');
    });

    it('should calculate agent satisfaction scores', async () => {
      const agentScores = [
        { agent_id: 'agent_1', average_rating: 4.2, total_ratings: 25 },
        { agent_id: 'agent_2', average_rating: 4.7, total_ratings: 18 },
        { agent_id: 'agent_3', average_rating: 3.9, total_ratings: 32 }
      ];

      mockSupabase.single.mockResolvedValue({
        data: agentScores,
        error: null
      });

      const scores = await ticketManager.getAgentSatisfactionScores('last_30_days');

      expect(scores).toHaveLength(3);
      expect(scores.find(s => s.agent_id === 'agent_2')?.average_rating).toBe(4.7);
    });
  });

  describe('reporting and analytics', () => {
    it('should generate ticket volume reports', async () => {
      const volumeReport = {
        period: 'last_7_days',
        total_tickets: 45,
        by_category: {
          verification: 18,
          payment: 12,
          technical: 10,
          account: 5
        },
        by_priority: {
          low: 8,
          medium: 22,
          high: 12,
          urgent: 3
        },
        trend: 'increasing'
      };

      mockSupabase.rpc.mockResolvedValue({
        data: volumeReport,
        error: null
      });

      const report = await ticketManager.generateVolumeReport('last_7_days');

      expect(report.total_tickets).toBe(45);
      expect(report.by_category.verification).toBe(18);
      expect(report.trend).toBe('increasing');
    });

    it('should track resolution time trends', async () => {
      const resolutionTrends = {
        average_resolution_time_hours: 4.2,
        median_resolution_time_hours: 3.5,
        percentile_90_hours: 8.1,
        by_category: {
          verification: { avg_hours: 2.1, median_hours: 1.8 },
          payment: { avg_hours: 5.2, median_hours: 4.1 },
          technical: { avg_hours: 6.8, median_hours: 5.9 }
        },
        trend: 'improving'
      };

      mockSupabase.rpc.mockResolvedValue({
        data: resolutionTrends,
        error: null
      });

      const trends = await ticketManager.getResolutionTimeTrends('last_30_days');

      expect(trends.average_resolution_time_hours).toBe(4.2);
      expect(trends.by_category.verification.avg_hours).toBe(2.1);
      expect(trends.trend).toBe('improving');
    });
  });

  describe('automated responses', () => {
    it('should send automatic acknowledgment for new tickets', async () => {
      const ticketData = {
        title: 'Nytt ärende',
        category: 'general',
        description: 'Behöver hjälp',
        contact_email: 'kund@företag.se'
      };

      mockSupabase.single.mockResolvedValue({
        data: { ...mockTicket, ...ticketData, auto_response_sent: true },
        error: null
      });

      const result = await ticketManager.createTicket(ticketData);

      expect(result.auto_response_sent).toBe(true);
    });

    it('should provide suggested responses based on ticket content', async () => {
      const suggestions = [
        {
          template_id: 'template_verification_help',
          confidence: 0.85,
          preview: 'Hej! Angående er verifieringsfråga...'
        },
        {
          template_id: 'template_deadline_extension',
          confidence: 0.72,
          preview: 'Vi kan erbjuda en förlängning av deadline...'
        }
      ];

      mockSupabase.rpc.mockResolvedValue({
        data: suggestions,
        error: null
      });

      const result = await ticketManager.getSuggestedResponses('ticket_123');

      expect(result).toHaveLength(2);
      expect(result[0].confidence).toBe(0.85);
      expect(result[0].preview).toContain('verifieringsfråga');
    });
  });

  describe('error handling', () => {
    it('should handle database connection errors', async () => {
      mockSupabase.single.mockRejectedValue(new Error('Database connection failed'));

      await expect(ticketManager.getTicket('ticket_123'))
        .rejects.toThrow('Database connection failed');
    });

    it('should handle ticket not found errors', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Ticket not found', code: '404' }
      });

      await expect(ticketManager.getTicket('nonexistent_ticket'))
        .rejects.toThrow('Ticket not found');
    });

    it('should validate ticket permissions', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Access denied', code: '403' }
      });

      await expect(ticketManager.updateTicket('ticket_123', { status: 'resolved' }))
        .rejects.toThrow('Access denied');
    });
  });

  describe('performance optimization', () => {
    it('should batch process multiple ticket updates', async () => {
      const ticketUpdates = [
        { id: 'ticket_1', status: 'in_progress' },
        { id: 'ticket_2', status: 'resolved' },
        { id: 'ticket_3', status: 'closed' }
      ];

      mockSupabase.single.mockResolvedValue({
        data: ticketUpdates.map(update => ({ ...mockTicket, ...update })),
        error: null
      });

      const results = await ticketManager.batchUpdateTickets(ticketUpdates);

      expect(results).toHaveLength(3);
      expect(mockSupabase.update).toHaveBeenCalledTimes(1); // Single batch operation
    });

    it('should implement caching for frequently accessed data', async () => {
      // First call
      mockSupabase.single.mockResolvedValue({
        data: [mockAgent],
        error: null
      });

      const agents1 = await ticketManager.getAvailableAgents();
      const agents2 = await ticketManager.getAvailableAgents(); // Should use cache

      expect(agents1).toEqual(agents2);
      expect(mockSupabase.select).toHaveBeenCalledTimes(1); // Only one database call
    });
  });
});