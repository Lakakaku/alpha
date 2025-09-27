/**
 * Unit Tests for Offline Queue Service
 * 
 * Comprehensive test suite for the offline submission queue functionality.
 * Tests all aspects of offline data management, synchronization, and error handling.
 */

import { OfflineQueue } from '../../src/services/offline/OfflineQueue';

// Mock IndexedDB
const mockIndexedDB = {
  open: jest.fn(),
  deleteDatabase: jest.fn(),
};

const mockDatabase = {
  transaction: jest.fn(),
  objectStoreNames: ['offline_submissions'],
  close: jest.fn(),
};

const mockObjectStore = {
  add: jest.fn(),
  get: jest.fn(),
  getAll: jest.fn(),
  delete: jest.fn(),
  put: jest.fn(),
  index: jest.fn(),
  createIndex: jest.fn(),
};

const mockTransaction = {
  objectStore: jest.fn(() => mockObjectStore),
  oncomplete: null,
  onerror: null,
  onabort: null,
};

const mockRequest = {
  result: mockDatabase,
  error: null,
  onsuccess: null,
  onerror: null,
};

// Mock fetch for network requests
global.fetch = jest.fn();

// Setup IndexedDB mocks
beforeAll(() => {
  (global as any).indexedDB = mockIndexedDB;
  mockIndexedDB.open.mockReturnValue(mockRequest);
  mockDatabase.transaction.mockReturnValue(mockTransaction);
});

describe('OfflineQueue', () => {
  let offlineQueue: OfflineQueue;

  beforeEach(() => {
    jest.clearAllMocks();
    offlineQueue = new OfflineQueue();
    
    // Reset mock implementations
    mockObjectStore.add.mockImplementation(() => ({ 
      onsuccess: null, 
      onerror: null 
    }));
    mockObjectStore.getAll.mockImplementation(() => ({ 
      result: [], 
      onsuccess: null, 
      onerror: null 
    }));
    mockObjectStore.delete.mockImplementation(() => ({ 
      onsuccess: null, 
      onerror: null 
    }));
    
    (global.fetch as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Database Initialization', () => {
    it('should initialize IndexedDB database', async () => {
      const initPromise = (offlineQueue as any).initDB();
      
      // Simulate successful database opening
      setTimeout(() => {
        if (mockRequest.onsuccess) {
          mockRequest.onsuccess({ target: { result: mockDatabase } } as any);
        }
      }, 0);

      await initPromise;

      expect(mockIndexedDB.open).toHaveBeenCalledWith('VociliaOfflineQueue', 1);
    });

    it('should handle database initialization errors', async () => {
      const initPromise = (offlineQueue as any).initDB();
      
      // Simulate database error
      setTimeout(() => {
        if (mockRequest.onerror) {
          mockRequest.onerror({ target: { error: new Error('DB Error') } } as any);
        }
      }, 0);

      await expect(initPromise).rejects.toThrow('DB Error');
    });

    it('should create object store during upgrade', async () => {
      const mockUpgradeDB = {
        createObjectStore: jest.fn(),
        transaction: { objectStore: jest.fn(() => mockObjectStore) }
      };

      const initPromise = (offlineQueue as any).initDB();
      
      // Simulate database upgrade
      setTimeout(() => {
        if (mockRequest.onupgradeneeded) {
          mockRequest.onupgradeneeded({ 
            target: { result: mockUpgradeDB },
            oldVersion: 0,
            newVersion: 1
          } as any);
        }
        if (mockRequest.onsuccess) {
          mockRequest.onsuccess({ target: { result: mockDatabase } } as any);
        }
      }, 0);

      await initPromise;

      expect(mockUpgradeDB.createObjectStore).toHaveBeenCalledWith('offline_submissions', {
        keyPath: 'id'
      });
    });
  });

  describe('Enqueue Operations', () => {
    beforeEach(async () => {
      // Mock successful DB initialization
      (offlineQueue as any).db = mockDatabase;
      (offlineQueue as any).dbReady = Promise.resolve();
    });

    it('should enqueue verification submission successfully', async () => {
      const submissionData = {
        store_id: 'store123',
        customer_phone: '+46701234567',
        verification_code: 'ABC123'
      };

      const mockAddRequest = { onsuccess: null, onerror: null };
      mockObjectStore.add.mockReturnValue(mockAddRequest);

      const enqueuePromise = offlineQueue.enqueue(
        'verification_submission',
        submissionData,
        '/api/v1/offline/submit',
        'POST',
        'high'
      );

      // Simulate successful add
      setTimeout(() => {
        if (mockAddRequest.onsuccess) {
          mockAddRequest.onsuccess({ target: { result: 'submission-id-123' } } as any);
        }
      }, 0);

      const submissionId = await enqueuePromise;

      expect(submissionId).toBeDefined();
      expect(mockDatabase.transaction).toHaveBeenCalledWith(['offline_submissions'], 'readwrite');
      expect(mockObjectStore.add).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'verification_submission',
          data: submissionData,
          url: '/api/v1/offline/submit',
          method: 'POST',
          priority: 'high'
        })
      );
    });

    it('should enqueue call completion with correct priority', async () => {
      const callData = {
        call_session_id: 'session123',
        rating: 5,
        feedback: 'Great service!'
      };

      const mockAddRequest = { onsuccess: null, onerror: null };
      mockObjectStore.add.mockReturnValue(mockAddRequest);

      const enqueuePromise = offlineQueue.enqueue(
        'call_completion',
        callData,
        '/api/v1/calls/session123/confirm-completion',
        'POST',
        'medium'
      );

      setTimeout(() => {
        if (mockAddRequest.onsuccess) {
          mockAddRequest.onsuccess({ target: { result: 'call-completion-456' } } as any);
        }
      }, 0);

      const submissionId = await enqueuePromise;

      expect(submissionId).toBeDefined();
      expect(mockObjectStore.add).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'call_completion',
          priority: 'medium'
        })
      );
    });

    it('should handle enqueue errors gracefully', async () => {
      const mockAddRequest = { onsuccess: null, onerror: null };
      mockObjectStore.add.mockReturnValue(mockAddRequest);

      const enqueuePromise = offlineQueue.enqueue(
        'verification_submission',
        {},
        '/api/test',
        'POST'
      );

      // Simulate add error
      setTimeout(() => {
        if (mockAddRequest.onerror) {
          mockAddRequest.onerror({ target: { error: new Error('Add failed') } } as any);
        }
      }, 0);

      await expect(enqueuePromise).rejects.toThrow('Add failed');
    });

    it('should generate valid submission IDs', async () => {
      const mockAddRequest = { onsuccess: null, onerror: null };
      mockObjectStore.add.mockReturnValue(mockAddRequest);

      const enqueuePromise = offlineQueue.enqueue(
        'verification_submission',
        {},
        '/api/test',
        'POST'
      );

      setTimeout(() => {
        if (mockAddRequest.onsuccess) {
          mockAddRequest.onsuccess({ target: { result: 'generated-id' } } as any);
        }
      }, 0);

      const submissionId = await enqueuePromise;
      expect(submissionId).toBe('generated-id');
    });
  });

  describe('Queue Processing', () => {
    beforeEach(async () => {
      (offlineQueue as any).db = mockDatabase;
      (offlineQueue as any).dbReady = Promise.resolve();
    });

    it('should process high priority items first', async () => {
      const mockSubmissions = [
        {
          id: 'low-priority',
          priority: 'low',
          url: '/api/low',
          method: 'POST',
          data: {},
          created_at: Date.now() - 1000,
          retry_count: 0
        },
        {
          id: 'high-priority',
          priority: 'high',
          url: '/api/high',
          method: 'POST',
          data: {},
          created_at: Date.now(),
          retry_count: 0
        }
      ];

      const mockGetAllRequest = { 
        result: mockSubmissions,
        onsuccess: null,
        onerror: null 
      };
      mockObjectStore.getAll.mockReturnValue(mockGetAllRequest);

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) });

      const processPromise = offlineQueue.processQueue();

      // Simulate successful getAll
      setTimeout(() => {
        if (mockGetAllRequest.onsuccess) {
          mockGetAllRequest.onsuccess({ target: { result: mockSubmissions } } as any);
        }
      }, 0);

      await processPromise;

      expect(global.fetch).toHaveBeenCalledTimes(2);
      // High priority should be called first
      expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe('/api/high');
      expect((global.fetch as jest.Mock).mock.calls[1][0]).toBe('/api/low');
    });

    it('should handle network failures with retry logic', async () => {
      const mockSubmission = {
        id: 'retry-test',
        priority: 'medium',
        url: '/api/retry',
        method: 'POST',
        data: {},
        created_at: Date.now(),
        retry_count: 0
      };

      const mockGetAllRequest = { 
        result: [mockSubmission],
        onsuccess: null,
        onerror: null 
      };
      mockObjectStore.getAll.mockReturnValue(mockGetAllRequest);
      
      const mockPutRequest = { onsuccess: null, onerror: null };
      mockObjectStore.put.mockReturnValue(mockPutRequest);

      // Mock network failure
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const processPromise = offlineQueue.processQueue();

      setTimeout(() => {
        if (mockGetAllRequest.onsuccess) {
          mockGetAllRequest.onsuccess({ target: { result: [mockSubmission] } } as any);
        }
        // Simulate successful put for retry update
        if (mockPutRequest.onsuccess) {
          mockPutRequest.onsuccess({} as any);
        }
      }, 0);

      await processPromise;

      expect(mockObjectStore.put).toHaveBeenCalledWith(
        expect.objectContaining({
          retry_count: 1
        })
      );
    });

    it('should remove items after max retry attempts', async () => {
      const mockSubmission = {
        id: 'max-retry-test',
        priority: 'medium',
        url: '/api/maxretry',
        method: 'POST',
        data: {},
        created_at: Date.now(),
        retry_count: 5 // Max retries reached
      };

      const mockGetAllRequest = { 
        result: [mockSubmission],
        onsuccess: null,
        onerror: null 
      };
      mockObjectStore.getAll.mockReturnValue(mockGetAllRequest);
      
      const mockDeleteRequest = { onsuccess: null, onerror: null };
      mockObjectStore.delete.mockReturnValue(mockDeleteRequest);

      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const processPromise = offlineQueue.processQueue();

      setTimeout(() => {
        if (mockGetAllRequest.onsuccess) {
          mockGetAllRequest.onsuccess({ target: { result: [mockSubmission] } } as any);
        }
        if (mockDeleteRequest.onsuccess) {
          mockDeleteRequest.onsuccess({} as any);
        }
      }, 0);

      await processPromise;

      expect(mockObjectStore.delete).toHaveBeenCalledWith('max-retry-test');
    });

    it('should remove successfully processed items', async () => {
      const mockSubmission = {
        id: 'success-test',
        priority: 'medium',
        url: '/api/success',
        method: 'POST',
        data: {},
        created_at: Date.now(),
        retry_count: 0
      };

      const mockGetAllRequest = { 
        result: [mockSubmission],
        onsuccess: null,
        onerror: null 
      };
      mockObjectStore.getAll.mockReturnValue(mockGetAllRequest);
      
      const mockDeleteRequest = { onsuccess: null, onerror: null };
      mockObjectStore.delete.mockReturnValue(mockDeleteRequest);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      const processPromise = offlineQueue.processQueue();

      setTimeout(() => {
        if (mockGetAllRequest.onsuccess) {
          mockGetAllRequest.onsuccess({ target: { result: [mockSubmission] } } as any);
        }
        if (mockDeleteRequest.onsuccess) {
          mockDeleteRequest.onsuccess({} as any);
        }
      }, 0);

      await processPromise;

      expect(mockObjectStore.delete).toHaveBeenCalledWith('success-test');
    });
  });

  describe('Queue Management', () => {
    beforeEach(async () => {
      (offlineQueue as any).db = mockDatabase;
      (offlineQueue as any).dbReady = Promise.resolve();
    });

    it('should get queue size correctly', async () => {
      const mockSubmissions = [
        { id: '1', priority: 'high' },
        { id: '2', priority: 'medium' },
        { id: '3', priority: 'low' }
      ];

      const mockGetAllRequest = { 
        result: mockSubmissions,
        onsuccess: null,
        onerror: null 
      };
      mockObjectStore.getAll.mockReturnValue(mockGetAllRequest);

      const sizePromise = offlineQueue.getQueueSize();

      setTimeout(() => {
        if (mockGetAllRequest.onsuccess) {
          mockGetAllRequest.onsuccess({ target: { result: mockSubmissions } } as any);
        }
      }, 0);

      const size = await sizePromise;
      expect(size).toBe(3);
    });

    it('should clear queue successfully', async () => {
      const mockSubmissions = [
        { id: '1' }, { id: '2' }, { id: '3' }
      ];

      const mockGetAllRequest = { 
        result: mockSubmissions,
        onsuccess: null,
        onerror: null 
      };
      mockObjectStore.getAll.mockReturnValue(mockGetAllRequest);

      const mockDeleteRequest = { onsuccess: null, onerror: null };
      mockObjectStore.delete.mockReturnValue(mockDeleteRequest);

      const clearPromise = offlineQueue.clearQueue();

      setTimeout(() => {
        if (mockGetAllRequest.onsuccess) {
          mockGetAllRequest.onsuccess({ target: { result: mockSubmissions } } as any);
        }
        // Simulate successful deletion for each item
        if (mockDeleteRequest.onsuccess) {
          mockDeleteRequest.onsuccess({} as any);
        }
      }, 0);

      await clearPromise;

      expect(mockObjectStore.delete).toHaveBeenCalledTimes(3);
    });

    it('should get pending submissions', async () => {
      const mockSubmissions = [
        {
          id: '1',
          type: 'verification_submission',
          priority: 'high',
          created_at: Date.now()
        },
        {
          id: '2',
          type: 'call_completion',
          priority: 'medium',
          created_at: Date.now() - 1000
        }
      ];

      const mockGetAllRequest = { 
        result: mockSubmissions,
        onsuccess: null,
        onerror: null 
      };
      mockObjectStore.getAll.mockReturnValue(mockGetAllRequest);

      const pendingPromise = offlineQueue.getPendingSubmissions();

      setTimeout(() => {
        if (mockGetAllRequest.onsuccess) {
          mockGetAllRequest.onsuccess({ target: { result: mockSubmissions } } as any);
        }
      }, 0);

      const pending = await pendingPromise;
      expect(pending).toHaveLength(2);
      expect(pending[0].id).toBe('1');
      expect(pending[1].id).toBe('2');
    });
  });

  describe('Network Status Integration', () => {
    it('should listen to online events', () => {
      const addEventListener = jest.spyOn(window, 'addEventListener');
      
      // Create new instance to trigger event listener setup
      new OfflineQueue();

      expect(addEventListener).toHaveBeenCalledWith('online', expect.any(Function));
    });

    it('should process queue when coming online', async () => {
      const processQueueSpy = jest.spyOn(offlineQueue, 'processQueue').mockResolvedValue();
      
      // Simulate online event
      const onlineEvent = new Event('online');
      window.dispatchEvent(onlineEvent);

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(processQueueSpy).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully in enqueue', async () => {
      (offlineQueue as any).db = null;
      (offlineQueue as any).dbReady = Promise.reject(new Error('DB not available'));

      await expect(offlineQueue.enqueue(
        'verification_submission',
        {},
        '/api/test',
        'POST'
      )).rejects.toThrow('DB not available');
    });

    it('should handle transaction errors in processQueue', async () => {
      (offlineQueue as any).db = mockDatabase;
      (offlineQueue as any).dbReady = Promise.resolve();

      mockDatabase.transaction.mockImplementation(() => {
        throw new Error('Transaction failed');
      });

      await expect(offlineQueue.processQueue()).rejects.toThrow('Transaction failed');
    });

    it('should handle JSON parsing errors in API responses', async () => {
      const mockSubmission = {
        id: 'json-error-test',
        url: '/api/json-error',
        method: 'POST',
        data: {},
        retry_count: 0
      };

      const mockGetAllRequest = { 
        result: [mockSubmission],
        onsuccess: null,
        onerror: null 
      };
      mockObjectStore.getAll.mockReturnValue(mockGetAllRequest);

      const mockPutRequest = { onsuccess: null, onerror: null };
      mockObjectStore.put.mockReturnValue(mockPutRequest);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => { throw new Error('Invalid JSON'); }
      });

      const processPromise = offlineQueue.processQueue();

      setTimeout(() => {
        if (mockGetAllRequest.onsuccess) {
          mockGetAllRequest.onsuccess({ target: { result: [mockSubmission] } } as any);
        }
        if (mockPutRequest.onsuccess) {
          mockPutRequest.onsuccess({} as any);
        }
      }, 0);

      await processPromise;

      // Should retry on JSON parsing error
      expect(mockObjectStore.put).toHaveBeenCalledWith(
        expect.objectContaining({
          retry_count: 1
        })
      );
    });
  });

  describe('Performance', () => {
    it('should handle large queue efficiently', async () => {
      jest.useFakeTimers();
      
      (offlineQueue as any).db = mockDatabase;
      (offlineQueue as any).dbReady = Promise.resolve();

      const largeQueue = Array.from({ length: 100 }, (_, i) => ({
        id: `item-${i}`,
        priority: i % 2 === 0 ? 'high' : 'low',
        url: `/api/item-${i}`,
        method: 'POST',
        data: {},
        created_at: Date.now() - i,
        retry_count: 0
      }));

      const mockGetAllRequest = { 
        result: largeQueue,
        onsuccess: null,
        onerror: null 
      };
      mockObjectStore.getAll.mockReturnValue(mockGetAllRequest);

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

      const startTime = Date.now();
      const processPromise = offlineQueue.processQueue();

      setTimeout(() => {
        if (mockGetAllRequest.onsuccess) {
          mockGetAllRequest.onsuccess({ target: { result: largeQueue } } as any);
        }
      }, 0);

      jest.runAllTimers();
      await processPromise;

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Should process reasonably quickly (less than 1 second in test)
      expect(processingTime).toBeLessThan(1000);
      
      jest.useRealTimers();
    });
  });
});