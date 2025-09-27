import { VerificationCycleService } from '../../src/services/verification/verificationCycleService';
import { WeeklyVerificationCycleModel } from '@vocilia/database/verification/weekly-verification-cycles';
import { VerificationDatabaseModel } from '@vocilia/database/verification/verification-databases';
import { WeeklyVerificationCycle, VerificationCycleStatus } from '@vocilia/types/verification';
import { AuditLogger } from '../../src/services/audit/auditLogger';

// Mock dependencies
jest.mock('@vocilia/database/verification/weekly-verification-cycles');
jest.mock('@vocilia/database/verification/verification-databases');
jest.mock('../../src/services/audit/auditLogger');

describe('VerificationCycleService', () => {
  let service: VerificationCycleService;
  let mockSupabaseClient: any;
  let mockCycleModel: jest.Mocked<WeeklyVerificationCycleModel>;
  let mockDatabaseModel: jest.Mocked<VerificationDatabaseModel>;
  let mockAuditLogger: jest.Mocked<AuditLogger>;

  beforeEach(() => {
    // Mock Supabase client
    mockSupabaseClient = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      single: jest.fn(),
      insert: jest.fn().mockReturnThis(),
    };

    // Create service instance
    service = new VerificationCycleService(mockSupabaseClient);

    // Get mocked instances
    mockCycleModel = (WeeklyVerificationCycleModel as jest.MockedClass<typeof WeeklyVerificationCycleModel>).mock.instances[0] as jest.Mocked<WeeklyVerificationCycleModel>;
    mockDatabaseModel = (VerificationDatabaseModel as jest.MockedClass<typeof VerificationDatabaseModel>).mock.instances[0] as jest.Mocked<VerificationDatabaseModel>;
    mockAuditLogger = (AuditLogger as jest.MockedClass<typeof AuditLogger>).mock.instances[0] as jest.Mocked<AuditLogger>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createCycle', () => {
    it('should create a new verification cycle successfully', async () => {
      const cycleData = {
        cycle_week: '2025-09-29', // Monday
        created_by: 'admin-123'
      };

      const expectedCycle: WeeklyVerificationCycle = {
        id: 'cycle-123',
        cycle_week: '2025-09-29',
        status: 'preparing' as VerificationCycleStatus,
        total_stores: 0,
        prepared_stores: 0,
        created_by: 'admin-123',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      mockCycleModel.findByWeek.mockResolvedValue(null);
      mockCycleModel.create.mockResolvedValue(expectedCycle);
      mockAuditLogger.log.mockResolvedValue();

      const result = await service.createCycle(cycleData);

      expect(mockCycleModel.findByWeek).toHaveBeenCalledWith('2025-09-29');
      expect(mockCycleModel.create).toHaveBeenCalledWith(cycleData);
      expect(mockAuditLogger.log).toHaveBeenCalledWith({
        action: 'verification_cycle_created',
        entity_type: 'weekly_verification_cycle',
        entity_id: 'cycle-123',
        admin_id: 'admin-123',
        details: {
          cycle_week: '2025-09-29',
          status: 'preparing'
        }
      });
      expect(result).toEqual(expectedCycle);
    });

    it('should throw error if cycle already exists', async () => {
      const cycleData = {
        cycle_week: '2025-09-29',
        created_by: 'admin-123'
      };

      const existingCycle: WeeklyVerificationCycle = {
        id: 'existing-123',
        cycle_week: '2025-09-29',
        status: 'preparing' as VerificationCycleStatus,
        total_stores: 0,
        prepared_stores: 0,
        created_by: 'admin-456',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      mockCycleModel.findByWeek.mockResolvedValue(existingCycle);

      await expect(service.createCycle(cycleData)).rejects.toThrow('Verification cycle for this week already exists');
      expect(mockCycleModel.create).not.toHaveBeenCalled();
    });

    it('should throw error for invalid cycle week format', async () => {
      const cycleData = {
        cycle_week: 'invalid-date',
        created_by: 'admin-123'
      };

      await expect(service.createCycle(cycleData)).rejects.toThrow('Invalid date format for cycle_week');
    });

    it('should throw error if cycle week is not Monday', async () => {
      const cycleData = {
        cycle_week: '2025-09-30', // Tuesday
        created_by: 'admin-123'
      };

      await expect(service.createCycle(cycleData)).rejects.toThrow('Cycle week must start on a Monday');
    });

    it('should throw error for past dates', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 7);
      
      // Get the Monday of that week
      const dayOfWeek = pastDate.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      pastDate.setDate(pastDate.getDate() + mondayOffset);
      
      const cycleData = {
        cycle_week: pastDate.toISOString().split('T')[0],
        created_by: 'admin-123'
      };

      await expect(service.createCycle(cycleData)).rejects.toThrow('Cannot create cycle for past dates');
    });
  });

  describe('getCycles', () => {
    it('should return paginated cycles successfully', async () => {
      const mockResponse = {
        cycles: [
          {
            id: 'cycle-1',
            cycle_week: '2025-09-29',
            status: 'preparing' as VerificationCycleStatus,
            total_stores: 5,
            prepared_stores: 3,
            created_by: 'admin-123',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          total_pages: 1
        }
      };

      mockCycleModel.list.mockResolvedValue(mockResponse);

      const result = await service.getCycles({ page: 1, limit: 10 });

      expect(mockCycleModel.list).toHaveBeenCalledWith({ page: 1, limit: 10 });
      expect(result).toEqual(mockResponse);
    });

    it('should throw error for invalid page number', async () => {
      await expect(service.getCycles({ page: 0 })).rejects.toThrow('Page number must be 1 or greater');
    });

    it('should throw error for invalid limit', async () => {
      await expect(service.getCycles({ limit: 0 })).rejects.toThrow('Limit must be between 1 and 100');
      await expect(service.getCycles({ limit: 101 })).rejects.toThrow('Limit must be between 1 and 100');
    });

    it('should throw error for invalid status filter', async () => {
      await expect(service.getCycles({ status: 'invalid' as VerificationCycleStatus })).rejects.toThrow('Invalid cycle status: invalid');
    });
  });

  describe('getCycle', () => {
    it('should return cycle by ID successfully', async () => {
      const expectedCycle: WeeklyVerificationCycle = {
        id: 'cycle-123',
        cycle_week: '2025-09-29',
        status: 'preparing' as VerificationCycleStatus,
        total_stores: 5,
        prepared_stores: 3,
        created_by: 'admin-123',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      mockCycleModel.findById.mockResolvedValue(expectedCycle);

      const result = await service.getCycle('cycle-123');

      expect(mockCycleModel.findById).toHaveBeenCalledWith('cycle-123');
      expect(result).toEqual(expectedCycle);
    });

    it('should throw error if cycle not found', async () => {
      mockCycleModel.findById.mockResolvedValue(null);

      await expect(service.getCycle('nonexistent')).rejects.toThrow('Verification cycle not found');
    });
  });

  describe('prepareDatabases', () => {
    it('should start database preparation successfully', async () => {
      const cycle: WeeklyVerificationCycle = {
        id: 'cycle-123',
        cycle_week: '2025-09-29',
        status: 'ready' as VerificationCycleStatus,
        total_stores: 0,
        prepared_stores: 0,
        created_by: 'admin-123',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const stores = [
        { id: 'store-1', business_id: 'business-1' },
        { id: 'store-2', business_id: 'business-2' }
      ];

      mockCycleModel.findById.mockResolvedValue(cycle);
      mockCycleModel.updateStatus.mockResolvedValue();
      mockCycleModel.updateStoreCount.mockResolvedValue();
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: stores,
            error: null
          })
        })
      });
      mockAuditLogger.log.mockResolvedValue();

      const result = await service.prepareDatabases('cycle-123', 'admin-123');

      expect(mockCycleModel.updateStatus).toHaveBeenCalledWith('cycle-123', 'preparing');
      expect(mockCycleModel.updateStoreCount).toHaveBeenCalledWith('cycle-123', 2, 0);
      expect(result.message).toBe('Database preparation started');
      expect(result.job_id).toMatch(/^prep_cycle-123_\d+$/);
    });

    it('should throw error if cycle is already being prepared', async () => {
      const cycle: WeeklyVerificationCycle = {
        id: 'cycle-123',
        cycle_week: '2025-09-29',
        status: 'preparing' as VerificationCycleStatus,
        total_stores: 0,
        prepared_stores: 0,
        created_by: 'admin-123',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      mockCycleModel.findById.mockResolvedValue(cycle);

      await expect(service.prepareDatabases('cycle-123', 'admin-123')).rejects.toThrow('Cycle is currently being prepared');
    });

    it('should throw error if cycle has already been prepared', async () => {
      const cycle: WeeklyVerificationCycle = {
        id: 'cycle-123',
        cycle_week: '2025-09-29',
        status: 'distributed' as VerificationCycleStatus,
        total_stores: 5,
        prepared_stores: 5,
        created_by: 'admin-123',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      mockCycleModel.findById.mockResolvedValue(cycle);

      await expect(service.prepareDatabases('cycle-123', 'admin-123')).rejects.toThrow('Cycle has already been prepared');
    });

    it('should throw error if no active stores found', async () => {
      const cycle: WeeklyVerificationCycle = {
        id: 'cycle-123',
        cycle_week: '2025-09-29',
        status: 'ready' as VerificationCycleStatus,
        total_stores: 0,
        prepared_stores: 0,
        created_by: 'admin-123',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      mockCycleModel.findById.mockResolvedValue(cycle);
      mockCycleModel.updateStatus.mockResolvedValue();
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })
      });

      await expect(service.prepareDatabases('cycle-123', 'admin-123')).rejects.toThrow('No active stores found for verification cycle');
    });
  });

  describe('getCycleDatabases', () => {
    it('should return enhanced database list successfully', async () => {
      const cycle: WeeklyVerificationCycle = {
        id: 'cycle-123',
        cycle_week: '2025-09-29',
        status: 'ready' as VerificationCycleStatus,
        total_stores: 1,
        prepared_stores: 1,
        created_by: 'admin-123',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const databases = [
        {
          id: 'db-123',
          cycle_id: 'cycle-123',
          store_id: 'store-123',
          business_id: 'business-123',
          status: 'ready',
          transaction_count: 100,
          verified_count: 0,
          deadline_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];

      mockCycleModel.findById.mockResolvedValue(cycle);
      mockDatabaseModel.findByCycle.mockResolvedValue(databases);

      // Mock store and business queries
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'stores') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { name: 'Test Store', address: '123 Test St', city: 'Test City' }
                })
              })
            })
          };
        } else if (table === 'businesses') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { name: 'Test Business', email: 'test@business.com' }
                })
              })
            })
          };
        }
      });

      const result = await service.getCycleDatabases('cycle-123');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        ...databases[0],
        store_name: 'Test Store',
        store_address: '123 Test St',
        store_city: 'Test City',
        business_name: 'Test Business',
        business_email: 'test@business.com'
      });
    });
  });

  describe('generateInvoices', () => {
    it('should generate invoices successfully', async () => {
      const cycle: WeeklyVerificationCycle = {
        id: 'cycle-123',
        cycle_week: '2025-09-29',
        status: 'processing' as VerificationCycleStatus,
        total_stores: 1,
        prepared_stores: 1,
        created_by: 'admin-123',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const databases = [
        {
          id: 'db-123',
          cycle_id: 'cycle-123',
          store_id: 'store-123',
          business_id: 'business-123',
          status: 'processed',
          transaction_count: 100,
          verified_count: 50,
          deadline_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];

      mockCycleModel.findById.mockResolvedValue(cycle);
      mockDatabaseModel.findByCycle.mockResolvedValue(databases);
      mockCycleModel.updateStatus.mockResolvedValue();
      mockAuditLogger.log.mockResolvedValue();

      // Mock invoice creation
      mockSupabaseClient.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'invoice-123',
                cycle_id: 'cycle-123',
                business_id: 'business-123',
                total_rewards: 500,
                admin_fee: 100,
                total_amount: 600
              },
              error: null
            })
          })
        })
      });

      const result = await service.generateInvoices('cycle-123', 'admin-123');

      expect(result.invoices_created).toBe(1);
      expect(result.total_amount).toBe(600);
      expect(mockCycleModel.updateStatus).toHaveBeenCalledWith('cycle-123', 'invoicing');
    });

    it('should throw error if cycle is not ready for invoicing', async () => {
      const cycle: WeeklyVerificationCycle = {
        id: 'cycle-123',
        cycle_week: '2025-09-29',
        status: 'preparing' as VerificationCycleStatus,
        total_stores: 0,
        prepared_stores: 0,
        created_by: 'admin-123',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      mockCycleModel.findById.mockResolvedValue(cycle);

      await expect(service.generateInvoices('cycle-123', 'admin-123')).rejects.toThrow('Cycle is not ready for invoicing');
    });

    it('should throw error if no processed databases found', async () => {
      const cycle: WeeklyVerificationCycle = {
        id: 'cycle-123',
        cycle_week: '2025-09-29',
        status: 'processing' as VerificationCycleStatus,
        total_stores: 1,
        prepared_stores: 1,
        created_by: 'admin-123',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      mockCycleModel.findById.mockResolvedValue(cycle);
      mockDatabaseModel.findByCycle.mockResolvedValue([]);

      await expect(service.generateInvoices('cycle-123', 'admin-123')).rejects.toThrow('No processed verification databases found');
    });
  });
});