import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SupabaseClient } from '@supabase/supabase-js';
import { 
  createDatabaseClient,
  executeQuery,
  executeTransaction,
  withRetry
} from '../../../packages/database/src/client';
import {
  getMainClient,
  getServiceClient,
  testDatabaseConnection,
  executeWithRetry,
  closeDatabase
} from '../../../apps/backend/src/config/database';

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn(),
  rpc: vi.fn(),
  auth: {
    getSession: vi.fn(),
    signInWithPassword: vi.fn()
  },
  channel: vi.fn(),
  removeAllChannels: vi.fn()
} as unknown as SupabaseClient;

const mockQueryBuilder = {
  select: vi.fn(() => mockQueryBuilder),
  insert: vi.fn(() => mockQueryBuilder),
  update: vi.fn(() => mockQueryBuilder),
  delete: vi.fn(() => mockQueryBuilder),
  eq: vi.fn(() => mockQueryBuilder),
  neq: vi.fn(() => mockQueryBuilder),
  gt: vi.fn(() => mockQueryBuilder),
  gte: vi.fn(() => mockQueryBuilder),
  lt: vi.fn(() => mockQueryBuilder),
  lte: vi.fn(() => mockQueryBuilder),
  like: vi.fn(() => mockQueryBuilder),
  ilike: vi.fn(() => mockQueryBuilder),
  in: vi.fn(() => mockQueryBuilder),
  is: vi.fn(() => mockQueryBuilder),
  order: vi.fn(() => mockQueryBuilder),
  limit: vi.fn(() => mockQueryBuilder),
  offset: vi.fn(() => mockQueryBuilder),
  range: vi.fn(() => mockQueryBuilder),
  single: vi.fn(() => mockQueryBuilder),
  maybeSingle: vi.fn(() => mockQueryBuilder),
  then: vi.fn()
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient)
}));

describe('Database Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    
    // Setup default mock behavior
    mockSupabaseClient.from = vi.fn(() => mockQueryBuilder);
  });

  afterEach(() => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.DATABASE_URL;
  });

  describe('createDatabaseClient', () => {
    it('should create a database client with correct configuration', () => {
      const client = createDatabaseClient();
      expect(client).toBeDefined();
    });

    it('should throw error when environment variables are missing', () => {
      delete process.env.SUPABASE_URL;
      expect(() => createDatabaseClient()).toThrow();
    });
  });

  describe('executeQuery', () => {
    it('should execute a simple select query', async () => {
      const mockData = [{ id: 1, name: 'Test' }];
      mockQueryBuilder.then = vi.fn().mockResolvedValue({ data: mockData, error: null });

      const result = await executeQuery('users', 'select', { columns: '*' });
      
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('users');
      expect(mockQueryBuilder.select).toHaveBeenCalledWith('*');
      expect(result.data).toEqual(mockData);
      expect(result.error).toBeNull();
    });

    it('should execute an insert query', async () => {
      const insertData = { name: 'New User', email: 'test@example.com' };
      const mockResult = { data: [{ id: 1, ...insertData }], error: null };
      mockQueryBuilder.then = vi.fn().mockResolvedValue(mockResult);

      const result = await executeQuery('users', 'insert', { data: insertData });
      
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('users');
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(insertData);
      expect(result.data).toEqual(mockResult.data);
    });

    it('should execute an update query', async () => {
      const updateData = { name: 'Updated User' };
      const mockResult = { data: [{ id: 1, ...updateData }], error: null };
      mockQueryBuilder.then = vi.fn().mockResolvedValue(mockResult);

      const result = await executeQuery('users', 'update', { 
        data: updateData, 
        filters: { id: 1 } 
      });
      
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('users');
      expect(mockQueryBuilder.update).toHaveBeenCalledWith(updateData);
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 1);
    });

    it('should execute a delete query', async () => {
      const mockResult = { data: [], error: null };
      mockQueryBuilder.then = vi.fn().mockResolvedValue(mockResult);

      const result = await executeQuery('users', 'delete', { 
        filters: { id: 1 } 
      });
      
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('users');
      expect(mockQueryBuilder.delete).toHaveBeenCalled();
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 1);
    });

    it('should handle query errors', async () => {
      const mockError = { message: 'Database error', code: '23505' };
      mockQueryBuilder.then = vi.fn().mockResolvedValue({ data: null, error: mockError });

      const result = await executeQuery('users', 'select', { columns: '*' });
      
      expect(result.data).toBeNull();
      expect(result.error).toEqual(mockError);
    });

    it('should apply filters correctly', async () => {
      mockQueryBuilder.then = vi.fn().mockResolvedValue({ data: [], error: null });

      await executeQuery('users', 'select', { 
        columns: '*',
        filters: {
          name: 'John',
          age: { gt: 18 },
          email: { like: '%@example.com' },
          status: { in: ['active', 'pending'] }
        }
      });

      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('name', 'John');
      expect(mockQueryBuilder.gt).toHaveBeenCalledWith('age', 18);
      expect(mockQueryBuilder.like).toHaveBeenCalledWith('email', '%@example.com');
      expect(mockQueryBuilder.in).toHaveBeenCalledWith('status', ['active', 'pending']);
    });

    it('should apply ordering and pagination', async () => {
      mockQueryBuilder.then = vi.fn().mockResolvedValue({ data: [], error: null });

      await executeQuery('users', 'select', { 
        columns: '*',
        order: { column: 'created_at', ascending: false },
        limit: 10,
        offset: 20
      });

      expect(mockQueryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(10);
      expect(mockQueryBuilder.offset).toHaveBeenCalledWith(20);
    });
  });

  describe('executeTransaction', () => {
    it('should execute multiple operations in a transaction', async () => {
      const operations = [
        { table: 'users', operation: 'insert', data: { name: 'User 1' } },
        { table: 'profiles', operation: 'insert', data: { user_id: 1, bio: 'Bio' } }
      ];

      mockQueryBuilder.then = vi.fn()
        .mockResolvedValueOnce({ data: [{ id: 1 }], error: null })
        .mockResolvedValueOnce({ data: [{ id: 1 }], error: null });

      const result = await executeTransaction(operations);
      
      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
    });

    it('should rollback on transaction failure', async () => {
      const operations = [
        { table: 'users', operation: 'insert', data: { name: 'User 1' } },
        { table: 'profiles', operation: 'insert', data: { invalid: 'data' } }
      ];

      mockQueryBuilder.then = vi.fn()
        .mockResolvedValueOnce({ data: [{ id: 1 }], error: null })
        .mockResolvedValueOnce({ data: null, error: { message: 'Constraint violation' } });

      const result = await executeTransaction(operations);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('withRetry', () => {
    it('should execute operation successfully on first try', async () => {
      const operation = vi.fn().mockResolvedValue({ data: 'success' });
      
      const result = await withRetry(operation, 3);
      
      expect(operation).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ data: 'success' });
    });

    it('should retry on failure and eventually succeed', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValue({ data: 'success' });
      
      const result = await withRetry(operation, 3);
      
      expect(operation).toHaveBeenCalledTimes(3);
      expect(result).toEqual({ data: 'success' });
    });

    it('should fail after max retries', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Persistent error'));
      
      await expect(withRetry(operation, 2)).rejects.toThrow('Persistent error');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should wait between retries', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue({ data: 'success' });
      
      const start = Date.now();
      await withRetry(operation, 3, 100); // 100ms delay
      const duration = Date.now() - start;
      
      expect(duration).toBeGreaterThanOrEqual(100);
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });
});

describe('Database Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  });

  describe('getMainClient', () => {
    it('should return a main database client', () => {
      const client = getMainClient();
      expect(client).toBeDefined();
      expect(client).toBe(mockSupabaseClient);
    });
  });

  describe('getServiceClient', () => {
    it('should return a service database client', () => {
      const client = getServiceClient();
      expect(client).toBeDefined();
      expect(client).toBe(mockSupabaseClient);
    });
  });

  describe('testDatabaseConnection', () => {
    it('should test database connectivity successfully', async () => {
      mockSupabaseClient.from = vi.fn(() => ({
        select: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve({
            data: [],
            error: null
          }))
        }))
      }));

      await expect(testDatabaseConnection()).resolves.not.toThrow();
    });

    it('should throw error on connection failure', async () => {
      mockSupabaseClient.from = vi.fn(() => ({
        select: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve({
            data: null,
            error: { message: 'Connection failed' }
          }))
        }))
      }));

      await expect(testDatabaseConnection()).rejects.toThrow('Connection failed');
    });
  });

  describe('executeWithRetry', () => {
    it('should execute operation with retry logic', async () => {
      const operation = vi.fn().mockResolvedValue({ data: 'success', error: null });
      
      const result = await executeWithRetry(operation);
      
      expect(operation).toHaveBeenCalledWith(mockSupabaseClient);
      expect(result).toEqual({ data: 'success', error: null });
    });

    it('should retry on failure', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('Connection lost'))
        .mockResolvedValue({ data: 'success', error: null });
      
      const result = await executeWithRetry(operation, 2);
      
      expect(operation).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ data: 'success', error: null });
    });

    it('should use service client when specified', async () => {
      const operation = vi.fn().mockResolvedValue({ data: 'success', error: null });
      
      await executeWithRetry(operation, 1, 'service');
      
      expect(operation).toHaveBeenCalledWith(mockSupabaseClient);
    });
  });

  describe('closeDatabase', () => {
    it('should close database connections', async () => {
      mockSupabaseClient.removeAllChannels = vi.fn();
      
      await closeDatabase();
      
      expect(mockSupabaseClient.removeAllChannels).toHaveBeenCalled();
    });
  });
});

describe('Database Health Checks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should perform health check successfully', async () => {
    mockSupabaseClient.from = vi.fn(() => ({
      select: vi.fn(() => ({
        limit: vi.fn(() => Promise.resolve({
          data: [],
          error: null
        }))
      }))
    }));

    await expect(testDatabaseConnection()).resolves.not.toThrow();
  });

  it('should detect unhealthy database', async () => {
    mockSupabaseClient.from = vi.fn(() => ({
      select: vi.fn(() => ({
        limit: vi.fn(() => Promise.reject(new Error('Connection timeout')))
      }))
    }));

    await expect(testDatabaseConnection()).rejects.toThrow('Connection timeout');
  });
});

describe('Database Performance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should measure query execution time', async () => {
    mockSupabaseClient.from = vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => {
          // Simulate slow query
          return new Promise(resolve => {
            setTimeout(() => {
              resolve({ data: [], error: null });
            }, 100);
          });
        })
      }))
    }));

    const start = Date.now();
    await executeQuery('users', 'select', { 
      columns: '*', 
      filters: { id: 1 } 
    });
    const duration = Date.now() - start;

    expect(duration).toBeGreaterThanOrEqual(100);
  });

  it('should handle connection pool exhaustion', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('Connection pool exhausted'));
    
    await expect(executeWithRetry(operation, 1)).rejects.toThrow('Connection pool exhausted');
  });
});