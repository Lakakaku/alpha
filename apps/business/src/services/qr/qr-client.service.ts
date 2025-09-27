'use client';

import { useState, useEffect, useCallback } from 'react';
import { QRCodeStore, QRAnalytics, QRScanEvent, QRTemplate, BulkOperationResult } from '@vocilia/types';
import { toast } from '@/hooks/use-toast';

/**
 * Frontend QR Service Layer
 * 
 * Provides a comprehensive client-side service for QR code management.
 * Handles API communication, state management, and error handling.
 * 
 * Features:
 * - QR code CRUD operations
 * - Analytics data fetching
 * - Bulk operations support
 * - Template management
 * - Real-time updates
 * - Error handling and retries
 * - Caching and optimization
 */

interface QRServiceState {
  stores: QRCodeStore[];
  analytics: QRAnalytics[];
  scanEvents: QRScanEvent[];
  templates: QRTemplate[];
  loading: boolean;
  error: string | null;
}

interface QRServiceOptions {
  baseUrl?: string;
  timeout?: number;
  retryAttempts?: number;
  cacheTimeout?: number;
}

class QRClientService {
  private baseUrl: string;
  private timeout: number;
  private retryAttempts: number;
  private cache: Map<string, { data: any; timestamp: number; ttl: number }>;

  constructor(options: QRServiceOptions = {}) {
    this.baseUrl = options.baseUrl || process.env.NEXT_PUBLIC_API_URL || '/api';
    this.timeout = options.timeout || 10000;
    this.retryAttempts = options.retryAttempts || 3;
    this.cache = new Map();
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    useCache = false,
    cacheTtl = 300000 // 5 minutes default
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const cacheKey = `${options.method || 'GET'}:${url}:${JSON.stringify(options.body)}`;

    // Check cache first
    if (useCache && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      if (Date.now() - cached.timestamp < cached.ttl) {
        return cached.data;
      }
      this.cache.delete(cacheKey);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    const defaultOptions: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      signal: controller.signal,
      ...options,
    };

    let lastError: Error;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await fetch(url, defaultOptions);
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // Cache successful responses
        if (useCache && (options.method || 'GET') === 'GET') {
          this.cache.set(cacheKey, {
            data,
            timestamp: Date.now(),
            ttl: cacheTtl
          });
        }

        return data;
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on client errors (4xx)
        if (error instanceof Error && error.message.includes('HTTP 4')) {
          break;
        }

        // Wait before retry (exponential backoff)
        if (attempt < this.retryAttempts) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    clearTimeout(timeoutId);
    throw lastError!;
  }

  // Store Management
  async getStores(): Promise<QRCodeStore[]> {
    return this.request<QRCodeStore[]>('/qr/stores', {}, true);
  }

  async getStore(storeId: string): Promise<QRCodeStore> {
    return this.request<QRCodeStore>(`/qr/stores/${storeId}`, {}, true);
  }

  async regenerateQR(storeId: string, options?: { preserveTransition?: boolean }): Promise<QRCodeStore> {
    return this.request<QRCodeStore>(`/qr/stores/${storeId}/regenerate`, {
      method: 'POST',
      body: JSON.stringify(options || {}),
    });
  }

  async downloadQR(storeId: string, format: 'pdf' | 'png' | 'svg'): Promise<Blob> {
    const response = await fetch(`${this.baseUrl}/qr/stores/${storeId}/download?format=${format}`);
    if (!response.ok) {
      throw new Error(`Download failed: ${response.statusText}`);
    }
    return response.blob();
  }

  // Analytics
  async getAnalytics(
    storeId: string, 
    dateRange: 'today' | 'week' | 'month' | 'quarter' | 'year' = 'week'
  ): Promise<QRAnalytics[]> {
    return this.request<QRAnalytics[]>(
      `/qr/analytics/${storeId}?range=${dateRange}`,
      {},
      true,
      60000 // 1 minute cache for analytics
    );
  }

  async getScanEvents(
    storeId: string,
    dateRange: 'today' | 'week' | 'month' | 'quarter' | 'year' = 'week',
    limit = 100
  ): Promise<QRScanEvent[]> {
    return this.request<QRScanEvent[]>(
      `/qr/analytics/${storeId}/events?range=${dateRange}&limit=${limit}`,
      {},
      true,
      30000 // 30 seconds cache for events
    );
  }

  // Bulk Operations
  async bulkRegenerate(
    storeIds: string[],
    options?: { batchSize?: number; preserveTransition?: boolean }
  ): Promise<BulkOperationResult> {
    return this.request<BulkOperationResult>('/qr/bulk/regenerate', {
      method: 'POST',
      body: JSON.stringify({ storeIds, ...options }),
    });
  }

  async bulkDownload(storeIds: string[], format: 'pdf' | 'png' | 'svg'): Promise<BulkOperationResult> {
    return this.request<BulkOperationResult>('/qr/bulk/download', {
      method: 'POST',
      body: JSON.stringify({ storeIds, format }),
    });
  }

  // Template Management
  async getTemplates(): Promise<QRTemplate[]> {
    return this.request<QRTemplate[]>('/qr/templates', {}, true);
  }

  async getTemplate(templateId: string): Promise<QRTemplate> {
    return this.request<QRTemplate>(`/qr/templates/${templateId}`, {}, true);
  }

  async createTemplate(template: Partial<QRTemplate>): Promise<QRTemplate> {
    return this.request<QRTemplate>('/qr/templates', {
      method: 'POST',
      body: JSON.stringify(template),
    });
  }

  async updateTemplate(templateId: string, updates: Partial<QRTemplate>): Promise<QRTemplate> {
    return this.request<QRTemplate>(`/qr/templates/${templateId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteTemplate(templateId: string): Promise<void> {
    await this.request<void>(`/qr/templates/${templateId}`, {
      method: 'DELETE',
    });
  }

  // Utility Methods
  clearCache(): void {
    this.cache.clear();
  }

  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Global service instance
const qrService = new QRClientService();

/**
 * React Hook for QR Service
 * 
 * Provides reactive state management for QR operations.
 * Handles loading states, error handling, and automatic retries.
 */
export function useQRService() {
  const [state, setState] = useState<QRServiceState>({
    stores: [],
    analytics: [],
    scanEvents: [],
    templates: [],
    loading: false,
    error: null,
  });

  const setLoading = useCallback((loading: boolean) => {
    setState(prev => ({ ...prev, loading }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error }));
    if (error) {
      toast({
        title: "Error",
        description: error,
        variant: "destructive",
      });
    }
  }, []);

  // Store Operations
  const refreshStores = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const stores = await qrService.getStores();
      setState(prev => ({ ...prev, stores }));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load stores');
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError]);

  const regenerateQR = useCallback(async (storeId: string) => {
    setLoading(true);
    setError(null);
    try {
      const updatedStore = await qrService.regenerateQR(storeId);
      setState(prev => ({
        ...prev,
        stores: prev.stores.map(store => 
          store.id === storeId ? updatedStore : store
        )
      }));
      toast({
        title: "QR Code Regenerated",
        description: "QR code has been successfully regenerated.",
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to regenerate QR code');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError]);

  const downloadQR = useCallback(async (storeId: string, format: 'pdf' | 'png' | 'svg') => {
    setLoading(true);
    setError(null);
    try {
      const blob = await qrService.downloadQR(storeId, format);
      
      // Trigger download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `qr-code-${storeId}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Download Started",
        description: `QR code download as ${format.toUpperCase()} has started.`,
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to download QR code');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError]);

  // Analytics Operations
  const getAnalytics = useCallback(async (
    storeId: string, 
    dateRange: 'today' | 'week' | 'month' | 'quarter' | 'year' = 'week'
  ) => {
    setLoading(true);
    setError(null);
    try {
      const analytics = await qrService.getAnalytics(storeId, dateRange);
      setState(prev => ({ ...prev, analytics }));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError]);

  const getScanEvents = useCallback(async (
    storeId: string,
    dateRange: 'today' | 'week' | 'month' | 'quarter' | 'year' = 'week'
  ) => {
    try {
      const scanEvents = await qrService.getScanEvents(storeId, dateRange);
      setState(prev => ({ ...prev, scanEvents }));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load scan events');
    }
  }, [setError]);

  // Bulk Operations
  const bulkRegenerate = useCallback(async (storeIds: string[]) => {
    setLoading(true);
    setError(null);
    try {
      const result = await qrService.bulkRegenerate(storeIds);
      return result;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Bulk regeneration failed');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError]);

  const bulkDownload = useCallback(async (storeIds: string[], format: 'pdf' | 'png' | 'svg') => {
    setLoading(true);
    setError(null);
    try {
      const result = await qrService.bulkDownload(storeIds, format);
      return result;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Bulk download failed');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError]);

  // Template Operations
  const refreshTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const templates = await qrService.getTemplates();
      setState(prev => ({ ...prev, templates }));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError]);

  const createTemplate = useCallback(async (template: Partial<QRTemplate>) => {
    setLoading(true);
    setError(null);
    try {
      const newTemplate = await qrService.createTemplate(template);
      setState(prev => ({
        ...prev,
        templates: [...prev.templates, newTemplate]
      }));
      toast({
        title: "Template Created",
        description: "Template has been created successfully.",
      });
      return newTemplate;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create template');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError]);

  const updateTemplate = useCallback(async (templateId: string, updates: Partial<QRTemplate>) => {
    setLoading(true);
    setError(null);
    try {
      const updatedTemplate = await qrService.updateTemplate(templateId, updates);
      setState(prev => ({
        ...prev,
        templates: prev.templates.map(template => 
          template.id === templateId ? updatedTemplate : template
        )
      }));
      toast({
        title: "Template Updated",
        description: "Template has been updated successfully.",
      });
      return updatedTemplate;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update template');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError]);

  const deleteTemplate = useCallback(async (templateId: string) => {
    setLoading(true);
    setError(null);
    try {
      await qrService.deleteTemplate(templateId);
      setState(prev => ({
        ...prev,
        templates: prev.templates.filter(template => template.id !== templateId)
      }));
      toast({
        title: "Template Deleted",
        description: "Template has been deleted successfully.",
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to delete template');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError]);

  // Load initial data
  useEffect(() => {
    refreshStores();
    refreshTemplates();
  }, [refreshStores, refreshTemplates]);

  return {
    // State
    ...state,

    // Store Operations
    refreshStores,
    regenerateQR,
    downloadQR,

    // Analytics
    getAnalytics,
    getScanEvents,

    // Bulk Operations
    bulkRegenerate,
    bulkDownload,

    // Templates
    refreshTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,

    // Utilities
    clearCache: qrService.clearCache.bind(qrService),
    getCacheStats: qrService.getCacheStats.bind(qrService),
  };
}

export { qrService };
export default qrService;