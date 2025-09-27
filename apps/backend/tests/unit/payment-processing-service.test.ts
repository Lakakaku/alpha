import { 
  PaymentProcessingService, 
  SwishPaymentRequest, 
  SwishPaymentResponse, 
  PaymentSummary 
} from '../../src/services/verification/paymentProcessingService';
import { 
  PaymentInvoiceModel, 
  VerificationDatabaseModel, 
  VerificationRecordModel,
  WeeklyVerificationCycleModel 
} from '@vocilia/database';
import { 
  PaymentInvoice, 
  PaymentStatus, 
  SwishStatus, 
  VerificationRecord,
  WeeklyVerificationCycle
} from '@vocilia/types/verification';

// Mock dependencies
jest.mock('@vocilia/database');

describe('PaymentProcessingService', () => {
  let service: PaymentProcessingService;
  let mockPaymentInvoiceModel: jest.Mocked<typeof PaymentInvoiceModel>;
  let mockVerificationDatabaseModel: jest.Mocked<typeof VerificationDatabaseModel>;
  let mockVerificationRecordModel: jest.Mocked<typeof VerificationRecordModel>;
  let mockWeeklyVerificationCycleModel: jest.Mocked<typeof WeeklyVerificationCycleModel>;

  const mockCycle: WeeklyVerificationCycle = {
    id: 'cycle-123',
    cycle_week: '2025-09-29',
    status: 'verification_complete',
    total_stores: 2,
    prepared_stores: 2,
    created_by: 'admin-123',
    created_at: '2025-09-29T00:00:00Z',
    updated_at: '2025-09-29T10:00:00Z'
  };

  const mockDatabases = [
    {
      id: 'db-1',
      weekly_verification_cycle_id: 'cycle-123',
      business_id: 'business-1',
      store_id: 'store-1',
      status: 'processed',
      transaction_count: 50,
      verified_count: 30,
      deadline_date: '2025-10-06',
      created_at: '2025-09-29T00:00:00Z',
      updated_at: '2025-09-29T08:00:00Z'
    },
    {
      id: 'db-2',
      weekly_verification_cycle_id: 'cycle-123',
      business_id: 'business-2',
      store_id: 'store-2',
      status: 'processed',
      transaction_count: 25,
      verified_count: 20,
      deadline_date: '2025-10-06',
      created_at: '2025-09-29T00:00:00Z',
      updated_at: '2025-09-29T08:00:00Z'
    }
  ];

  const mockVerifiedRecords: VerificationRecord[] = [
    {
      id: 'record-1',
      verification_database_id: 'db-1',
      phone_number: '+46701234567',
      amount: 100.50,
      transaction_date: '2025-09-28',
      status: 'verified',
      store_context: {
        store_name: 'Test Store 1',
        location: 'Stockholm',
        category: 'restaurant'
      },
      verification_details: null,
      created_at: '2025-09-29T00:00:00Z',
      updated_at: '2025-09-29T08:00:00Z',
      verified_at: '2025-09-29T08:00:00Z'
    },
    {
      id: 'record-2',
      verification_database_id: 'db-1',
      phone_number: '+46701234568',
      amount: 250.75,
      transaction_date: '2025-09-28',
      status: 'verified',
      store_context: {
        store_name: 'Test Store 1',
        location: 'Stockholm',
        category: 'restaurant'
      },
      verification_details: null,
      created_at: '2025-09-29T00:00:00Z',
      updated_at: '2025-09-29T08:00:00Z',
      verified_at: '2025-09-29T08:00:00Z'
    },
    {
      id: 'record-3',
      verification_database_id: 'db-2',
      phone_number: '+46701234567', // Same phone as record-1, different business
      amount: 150.25,
      transaction_date: '2025-09-28',
      status: 'verified',
      store_context: {
        store_name: 'Test Store 2',
        location: 'Gothenburg',
        category: 'retail'
      },
      verification_details: null,
      created_at: '2025-09-29T00:00:00Z',
      updated_at: '2025-09-29T08:00:00Z',
      verified_at: '2025-09-29T08:00:00Z'
    }
  ];

  const mockInvoice: PaymentInvoice = {
    id: 'invoice-123',
    weekly_verification_cycle_id: 'cycle-123',
    business_id: 'business-1',
    phone_number: '+46701234567',
    total_amount: 100.50,
    transaction_count: 1,
    payment_status: 'pending',
    swish_status: 'not_initiated',
    swish_reference: null,
    due_date: '2025-10-06',
    payment_details: {
      verification_records: [
        {
          record_id: 'record-1',
          amount: 100.50,
          transaction_date: '2025-09-28'
        }
      ],
      reward_percentage: 2.0,
      processing_fee: 5.00,
      net_amount: 95.50
    },
    created_at: '2025-09-29T10:00:00Z',
    updated_at: '2025-09-29T10:00:00Z'
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Set up environment variables for testing
    process.env.NODE_ENV = 'test';
    process.env.SWISH_API_URL = 'https://test.swish.api';
    process.env.SWISH_MERCHANT_ID = 'test-merchant';
    process.env.API_BASE_URL = 'https://test.api.com';

    // Mock implementations
    mockPaymentInvoiceModel = PaymentInvoiceModel as jest.Mocked<typeof PaymentInvoiceModel>;
    mockVerificationDatabaseModel = VerificationDatabaseModel as jest.Mocked<typeof VerificationDatabaseModel>;
    mockVerificationRecordModel = VerificationRecordModel as jest.Mocked<typeof VerificationRecordModel>;
    mockWeeklyVerificationCycleModel = WeeklyVerificationCycleModel as jest.Mocked<typeof WeeklyVerificationCycleModel>;

    // Create service instance
    service = new PaymentProcessingService();
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.NODE_ENV;
    delete process.env.SWISH_API_URL;
    delete process.env.SWISH_MERCHANT_ID;
    delete process.env.API_BASE_URL;
  });

  describe('generateInvoices', () => {
    beforeEach(() => {
      mockWeeklyVerificationCycleModel.getById = jest.fn().mockResolvedValue(mockCycle);
      mockVerificationDatabaseModel.getByCycleId = jest.fn().mockResolvedValue(mockDatabases);
      mockVerificationRecordModel.getByDatabaseId = jest.fn()
        .mockResolvedValueOnce([mockVerifiedRecords[0], mockVerifiedRecords[1]]) // For db-1
        .mockResolvedValueOnce([mockVerifiedRecords[2]]); // For db-2
      mockPaymentInvoiceModel.create = jest.fn().mockResolvedValue(mockInvoice);
      mockWeeklyVerificationCycleModel.updateStatus = jest.fn().mockResolvedValue();
    });

    it('should generate invoices successfully', async () => {
      const result = await service.generateInvoices('cycle-123');

      expect(result.success).toBe(true);
      expect(result.invoices).toHaveLength(3); // 2 for business-1 (different phones) + 1 for business-2
      expect(result.errors).toHaveLength(0);
      expect(mockPaymentInvoiceModel.create).toHaveBeenCalledTimes(3);
      expect(mockWeeklyVerificationCycleModel.updateStatus).toHaveBeenCalledWith('cycle-123', 'invoices_generated');
    });

    it('should group payments by business and phone number', async () => {
      await service.generateInvoices('cycle-123');

      const createCalls = (mockPaymentInvoiceModel.create as jest.Mock).mock.calls;
      
      // Should have 3 separate invoices:
      // 1. business-1 + phone +46701234567 (record-1: 100.50)
      // 2. business-1 + phone +46701234568 (record-2: 250.75)
      // 3. business-2 + phone +46701234567 (record-3: 150.25)
      
      expect(createCalls).toHaveLength(3);
      
      const business1Phone1 = createCalls.find(call => 
        call[0].business_id === 'business-1' && call[0].phone_number === '+46701234567'
      );
      const business1Phone2 = createCalls.find(call => 
        call[0].business_id === 'business-1' && call[0].phone_number === '+46701234568'
      );
      const business2Phone1 = createCalls.find(call => 
        call[0].business_id === 'business-2' && call[0].phone_number === '+46701234567'
      );

      expect(business1Phone1).toBeDefined();
      expect(business1Phone2).toBeDefined();
      expect(business2Phone1).toBeDefined();
    });

    it('should calculate processing fees correctly', async () => {
      await service.generateInvoices('cycle-123');

      const createCalls = (mockPaymentInvoiceModel.create as jest.Mock).mock.calls;
      
      // Find the call for the largest amount (250.75)
      const largeAmountCall = createCalls.find(call => {
        const details = call[0].payment_details;
        return details.verification_records.some((r: any) => r.amount === 250.75);
      });

      expect(largeAmountCall).toBeDefined();
      
      const paymentDetails = largeAmountCall[0].payment_details;
      expect(paymentDetails.processing_fee).toBe(5.00); // Minimum 5 SEK
      expect(paymentDetails.net_amount).toBe(245.75); // 250.75 - 5.00
    });

    it('should handle minimum processing fee correctly', async () => {
      // Mock small amount that would result in < 5 SEK fee
      const smallRecord = {
        ...mockVerifiedRecords[0],
        amount: 10.00 // 1% would be 0.10, but minimum is 5 SEK
      };
      
      mockVerificationRecordModel.getByDatabaseId = jest.fn()
        .mockResolvedValueOnce([smallRecord])
        .mockResolvedValueOnce([]);

      await service.generateInvoices('cycle-123');

      const createCall = (mockPaymentInvoiceModel.create as jest.Mock).mock.calls[0];
      const paymentDetails = createCall[0].payment_details;
      
      expect(paymentDetails.processing_fee).toBe(5.00); // Minimum fee
      expect(paymentDetails.net_amount).toBe(5.00); // 10.00 - 5.00
    });

    it('should return error if cycle not found', async () => {
      mockWeeklyVerificationCycleModel.getById = jest.fn().mockResolvedValue(null);

      const result = await service.generateInvoices('nonexistent');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Verification cycle not found');
      expect(result.invoices).toHaveLength(0);
    });

    it('should return error if cycle status is incorrect', async () => {
      const incompleteCycle = { ...mockCycle, status: 'preparing' };
      mockWeeklyVerificationCycleModel.getById = jest.fn().mockResolvedValue(incompleteCycle);

      const result = await service.generateInvoices('cycle-123');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Cycle must have completed verification to generate invoices');
    });

    it('should handle partial failures gracefully', async () => {
      mockPaymentInvoiceModel.create = jest.fn()
        .mockResolvedValueOnce(mockInvoice)
        .mockRejectedValueOnce(new Error('Database error'))
        .mockResolvedValueOnce(mockInvoice);

      const result = await service.generateInvoices('cycle-123');

      expect(result.success).toBe(false);
      expect(result.invoices).toHaveLength(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Database error');
    });
  });

  describe('initiateSwishPayment', () => {
    beforeEach(() => {
      mockPaymentInvoiceModel.getById = jest.fn().mockResolvedValue(mockInvoice);
      mockPaymentInvoiceModel.updateSwishStatus = jest.fn().mockResolvedValue();
    });

    it('should initiate Swish payment successfully', async () => {
      const result = await service.initiateSwishPayment('invoice-123');

      expect(result.success).toBe(true);
      expect(result.swishReference).toMatch(/^SWISH-\d+-/);
      expect(mockPaymentInvoiceModel.updateSwishStatus).toHaveBeenCalledWith(
        'invoice-123',
        'initiated',
        expect.stringMatching(/^SWISH-\d+-/)
      );
    });

    it('should return error if invoice not found', async () => {
      mockPaymentInvoiceModel.getById = jest.fn().mockResolvedValue(null);

      const result = await service.initiateSwishPayment('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invoice not found');
    });

    it('should return error if invoice is not pending', async () => {
      const paidInvoice = { ...mockInvoice, payment_status: 'paid' as PaymentStatus };
      mockPaymentInvoiceModel.getById = jest.fn().mockResolvedValue(paidInvoice);

      const result = await service.initiateSwishPayment('invoice-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invoice is not in pending status');
    });

    it('should handle Swish API errors', async () => {
      // Set to production mode to trigger API error
      process.env.NODE_ENV = 'production';
      
      const result = await service.initiateSwishPayment('invoice-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Swish API integration not implemented');
    });
  });

  describe('handleSwishCallback', () => {
    beforeEach(() => {
      mockPaymentInvoiceModel.getById = jest.fn().mockResolvedValue(mockInvoice);
      mockPaymentInvoiceModel.updateSwishStatus = jest.fn().mockResolvedValue();
    });

    it('should handle successful payment callback', async () => {
      const result = await service.handleSwishCallback(
        'invoice-123',
        'completed',
        'SWISH-REF-123'
      );

      expect(result.success).toBe(true);
      expect(mockPaymentInvoiceModel.updateSwishStatus).toHaveBeenCalledWith(
        'invoice-123',
        'completed',
        'SWISH-REF-123'
      );
    });

    it('should handle failed payment callback', async () => {
      const result = await service.handleSwishCallback(
        'invoice-123',
        'failed',
        'SWISH-REF-123'
      );

      expect(result.success).toBe(true);
      expect(mockPaymentInvoiceModel.updateSwishStatus).toHaveBeenCalledWith(
        'invoice-123',
        'failed',
        'SWISH-REF-123'
      );
    });

    it('should return error if invoice not found', async () => {
      mockPaymentInvoiceModel.getById = jest.fn().mockResolvedValue(null);

      const result = await service.handleSwishCallback(
        'nonexistent',
        'completed',
        'SWISH-REF-123'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invoice not found');
    });
  });

  describe('getPaymentStatistics', () => {
    const mockStatistics = {
      total_invoices: 10,
      total_amount: 1000.00,
      paid_invoices: 6,
      paid_amount: 600.00,
      pending_invoices: 3,
      pending_amount: 300.00
    };

    const mockInvoices = [
      { ...mockInvoice, swish_status: 'initiated' },
      { ...mockInvoice, swish_status: 'completed' },
      { ...mockInvoice, swish_status: 'completed' },
      { ...mockInvoice, swish_status: 'failed' }
    ];

    beforeEach(() => {
      mockPaymentInvoiceModel.getPaymentStatistics = jest.fn().mockResolvedValue(mockStatistics);
      mockPaymentInvoiceModel.getByCycleId = jest.fn().mockResolvedValue(mockInvoices);
    });

    it('should return comprehensive payment statistics', async () => {
      const stats = await service.getPaymentStatistics('cycle-123');

      expect(stats.total_invoices).toBe(10);
      expect(stats.total_amount).toBe(1000.00);
      expect(stats.paid_invoices).toBe(6);
      expect(stats.pending_invoices).toBe(3);
      expect(stats.failed_invoices).toBe(1); // total - paid - pending
      expect(stats.failed_amount).toBe(100.00); // total - paid - pending
      expect(stats.swish_initiated).toBe(1);
      expect(stats.swish_completed).toBe(2);
    });
  });

  describe('retryPayment', () => {
    beforeEach(() => {
      const failedInvoice = { ...mockInvoice, swish_status: 'failed' as SwishStatus };
      mockPaymentInvoiceModel.getById = jest.fn().mockResolvedValue(failedInvoice);
      mockPaymentInvoiceModel.updateSwishStatus = jest.fn().mockResolvedValue();
    });

    it('should retry failed payment successfully', async () => {
      const result = await service.retryPayment('invoice-123');

      expect(result.success).toBe(true);
      expect(result.swishReference).toMatch(/^SWISH-\d+-/);
      expect(mockPaymentInvoiceModel.updateSwishStatus).toHaveBeenCalledWith(
        'invoice-123',
        'not_initiated'
      );
    });

    it('should return error if invoice not found', async () => {
      mockPaymentInvoiceModel.getById = jest.fn().mockResolvedValue(null);

      const result = await service.retryPayment('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invoice not found');
    });

    it('should return error if payment is not failed', async () => {
      const successfulInvoice = { ...mockInvoice, swish_status: 'completed' as SwishStatus };
      mockPaymentInvoiceModel.getById = jest.fn().mockResolvedValue(successfulInvoice);

      const result = await service.retryPayment('invoice-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Can only retry failed payments');
    });
  });

  describe('processBulkPayments', () => {
    beforeEach(() => {
      mockPaymentInvoiceModel.getById = jest.fn().mockResolvedValue(mockInvoice);
      mockPaymentInvoiceModel.updateSwishStatus = jest.fn().mockResolvedValue();
    });

    it('should process multiple payments successfully', async () => {
      const invoiceIds = ['invoice-1', 'invoice-2', 'invoice-3'];
      
      const result = await service.processBulkPayments(invoiceIds);

      expect(result.successful).toHaveLength(3);
      expect(result.failed).toHaveLength(0);
      expect(result.successful).toEqual(invoiceIds);
    });

    it('should handle mixed success and failures', async () => {
      const invoiceIds = ['invoice-1', 'invoice-2', 'invoice-3'];
      
      mockPaymentInvoiceModel.getById = jest.fn()
        .mockResolvedValueOnce(mockInvoice)
        .mockResolvedValueOnce(null) // Not found
        .mockResolvedValueOnce(mockInvoice);

      const result = await service.processBulkPayments(invoiceIds);

      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(1);
      expect(result.successful).toEqual(['invoice-1', 'invoice-3']);
      expect(result.failed[0].invoiceId).toBe('invoice-2');
      expect(result.failed[0].error).toBe('Invoice not found');
    });
  });

  describe('cancelPayment', () => {
    beforeEach(() => {
      mockPaymentInvoiceModel.getById = jest.fn().mockResolvedValue(mockInvoice);
      mockPaymentInvoiceModel.updatePaymentStatus = jest.fn().mockResolvedValue();
      mockPaymentInvoiceModel.updateSwishStatus = jest.fn().mockResolvedValue();
    });

    it('should cancel pending payment successfully', async () => {
      const result = await service.cancelPayment('invoice-123');

      expect(result.success).toBe(true);
      expect(mockPaymentInvoiceModel.updatePaymentStatus).toHaveBeenCalledWith(
        'invoice-123',
        'cancelled'
      );
      expect(mockPaymentInvoiceModel.updateSwishStatus).toHaveBeenCalledWith(
        'invoice-123',
        'cancelled'
      );
    });

    it('should return error if invoice not found', async () => {
      mockPaymentInvoiceModel.getById = jest.fn().mockResolvedValue(null);

      const result = await service.cancelPayment('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invoice not found');
    });

    it('should return error if trying to cancel paid invoice', async () => {
      const paidInvoice = { ...mockInvoice, payment_status: 'paid' as PaymentStatus };
      mockPaymentInvoiceModel.getById = jest.fn().mockResolvedValue(paidInvoice);

      const result = await service.cancelPayment('invoice-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot cancel paid invoice');
    });
  });

  describe('fee calculations', () => {
    it('should calculate processing fee with minimum', () => {
      // This tests the private method through the public interface
      const service = new PaymentProcessingService();
      
      // Test small amount (10 SEK -> 1% = 0.10, but minimum is 5 SEK)
      expect((service as any).calculateProcessingFee(10)).toBe(5.00);
      
      // Test large amount (1000 SEK -> 1% = 10 SEK)
      expect((service as any).calculateProcessingFee(1000)).toBe(10.00);
    });

    it('should calculate net amount correctly', () => {
      const service = new PaymentProcessingService();
      
      // Test with small amount
      expect((service as any).calculateNetAmount(10)).toBe(5.00); // 10 - 5 (min fee)
      
      // Test with large amount
      expect((service as any).calculateNetAmount(1000)).toBe(990.00); // 1000 - 10 (1%)
    });
  });
});