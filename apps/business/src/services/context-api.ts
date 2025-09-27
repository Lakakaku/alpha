'use client';

import { 
  StoreContextProfile, 
  StoreContextPersonnel,
  StoreContextLayout,
  StoreContextInventory,
  ContextCompleteness,
  AIContextExport,
  ContextVersion
} from '@vocilia/types/src/context';

export interface ContextAPIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ContextListResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
}

export interface ContextQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  includeInactive?: boolean;
}

export interface AIExportOptions {
  format: 'prompt' | 'structured' | 'json';
  includePersonnel?: boolean;
  includeLayout?: boolean;
  includeInventory?: boolean;
  templateId?: string;
}

export class ContextAPIService {
  private static baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  /**
   * Get authentication headers for API requests
   */
  private static async getAuthHeaders(): Promise<Headers> {
    const headers = new Headers({
      'Content-Type': 'application/json',
    });

    // Get session from Supabase auth
    if (typeof window !== 'undefined') {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        headers.set('Authorization', `Bearer ${session.access_token}`);
      }
    }

    return headers;
  }

  /**
   * Make authenticated API request
   */
  private static async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<ContextAPIResponse<T>> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          ...headers,
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.message || `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error occurred',
      };
    }
  }

  // Store Context Profile API
  static async getStoreProfile(storeId: string): Promise<ContextAPIResponse<StoreContextProfile>> {
    return this.request<StoreContextProfile>(`/business/stores/${storeId}/context/profile`);
  }

  static async updateStoreProfile(
    storeId: string, 
    profile: Partial<StoreContextProfile>
  ): Promise<ContextAPIResponse<StoreContextProfile>> {
    return this.request<StoreContextProfile>(`/business/stores/${storeId}/context/profile`, {
      method: 'PUT',
      body: JSON.stringify(profile),
    });
  }

  static async createStoreProfile(
    storeId: string, 
    profile: Omit<StoreContextProfile, 'id' | 'storeId' | 'createdAt' | 'updatedAt'>
  ): Promise<ContextAPIResponse<StoreContextProfile>> {
    return this.request<StoreContextProfile>(`/business/stores/${storeId}/context/profile`, {
      method: 'POST',
      body: JSON.stringify(profile),
    });
  }

  // Personnel Management API
  static async getPersonnel(
    storeId: string, 
    params?: ContextQueryParams
  ): Promise<ContextAPIResponse<ContextListResponse<StoreContextPersonnel>>> {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) query.append(key, String(value));
      });
    }
    
    return this.request<ContextListResponse<StoreContextPersonnel>>(
      `/business/stores/${storeId}/context/personnel?${query}`
    );
  }

  static async createPersonnel(
    storeId: string, 
    personnel: Omit<StoreContextPersonnel, 'id' | 'storeId' | 'createdAt' | 'updatedAt'>
  ): Promise<ContextAPIResponse<StoreContextPersonnel>> {
    return this.request<StoreContextPersonnel>(`/business/stores/${storeId}/context/personnel`, {
      method: 'POST',
      body: JSON.stringify(personnel),
    });
  }

  static async updatePersonnel(
    storeId: string, 
    personnelId: string, 
    personnel: Partial<StoreContextPersonnel>
  ): Promise<ContextAPIResponse<StoreContextPersonnel>> {
    return this.request<StoreContextPersonnel>(
      `/business/stores/${storeId}/context/personnel/${personnelId}`, 
      {
        method: 'PUT',
        body: JSON.stringify(personnel),
      }
    );
  }

  static async deletePersonnel(
    storeId: string, 
    personnelId: string
  ): Promise<ContextAPIResponse<void>> {
    return this.request<void>(`/business/stores/${storeId}/context/personnel/${personnelId}`, {
      method: 'DELETE',
    });
  }

  // Layout Management API
  static async getLayouts(
    storeId: string, 
    params?: ContextQueryParams
  ): Promise<ContextAPIResponse<ContextListResponse<StoreContextLayout>>> {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) query.append(key, String(value));
      });
    }
    
    return this.request<ContextListResponse<StoreContextLayout>>(
      `/business/stores/${storeId}/context/layouts?${query}`
    );
  }

  static async getActiveLayout(storeId: string): Promise<ContextAPIResponse<StoreContextLayout>> {
    return this.request<StoreContextLayout>(`/business/stores/${storeId}/context/layouts/active`);
  }

  static async createLayout(
    storeId: string, 
    layout: Omit<StoreContextLayout, 'id' | 'storeId' | 'createdAt' | 'updatedAt'>
  ): Promise<ContextAPIResponse<StoreContextLayout>> {
    return this.request<StoreContextLayout>(`/business/stores/${storeId}/context/layouts`, {
      method: 'POST',
      body: JSON.stringify(layout),
    });
  }

  static async updateLayout(
    storeId: string, 
    layoutId: string, 
    layout: Partial<StoreContextLayout>
  ): Promise<ContextAPIResponse<StoreContextLayout>> {
    return this.request<StoreContextLayout>(
      `/business/stores/${storeId}/context/layouts/${layoutId}`, 
      {
        method: 'PUT',
        body: JSON.stringify(layout),
      }
    );
  }

  static async activateLayout(
    storeId: string, 
    layoutId: string
  ): Promise<ContextAPIResponse<StoreContextLayout>> {
    return this.request<StoreContextLayout>(
      `/business/stores/${storeId}/context/layouts/${layoutId}/activate`, 
      {
        method: 'POST',
      }
    );
  }

  static async deleteLayout(
    storeId: string, 
    layoutId: string
  ): Promise<ContextAPIResponse<void>> {
    return this.request<void>(`/business/stores/${storeId}/context/layouts/${layoutId}`, {
      method: 'DELETE',
    });
  }

  // Inventory Management API
  static async getInventory(
    storeId: string, 
    params?: ContextQueryParams
  ): Promise<ContextAPIResponse<ContextListResponse<StoreContextInventory>>> {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) query.append(key, String(value));
      });
    }
    
    return this.request<ContextListResponse<StoreContextInventory>>(
      `/business/stores/${storeId}/context/inventory?${query}`
    );
  }

  static async createInventoryCategory(
    storeId: string, 
    inventory: Omit<StoreContextInventory, 'id' | 'storeId' | 'createdAt' | 'updatedAt'>
  ): Promise<ContextAPIResponse<StoreContextInventory>> {
    return this.request<StoreContextInventory>(`/business/stores/${storeId}/context/inventory`, {
      method: 'POST',
      body: JSON.stringify(inventory),
    });
  }

  static async updateInventoryCategory(
    storeId: string, 
    inventoryId: string, 
    inventory: Partial<StoreContextInventory>
  ): Promise<ContextAPIResponse<StoreContextInventory>> {
    return this.request<StoreContextInventory>(
      `/business/stores/${storeId}/context/inventory/${inventoryId}`, 
      {
        method: 'PUT',
        body: JSON.stringify(inventory),
      }
    );
  }

  static async deleteInventoryCategory(
    storeId: string, 
    inventoryId: string
  ): Promise<ContextAPIResponse<void>> {
    return this.request<void>(`/business/stores/${storeId}/context/inventory/${inventoryId}`, {
      method: 'DELETE',
    });
  }

  // Context Analytics & Completeness API
  static async getContextCompleteness(storeId: string): Promise<ContextAPIResponse<ContextCompleteness>> {
    return this.request<ContextCompleteness>(`/business/stores/${storeId}/context/completeness`);
  }

  static async refreshCompletenessScore(storeId: string): Promise<ContextAPIResponse<ContextCompleteness>> {
    return this.request<ContextCompleteness>(`/business/stores/${storeId}/context/completeness/refresh`, {
      method: 'POST',
    });
  }

  // AI Export API
  static async exportContextForAI(
    storeId: string, 
    options: AIExportOptions
  ): Promise<ContextAPIResponse<AIContextExport>> {
    return this.request<AIContextExport>(`/business/stores/${storeId}/context/export`, {
      method: 'POST',
      body: JSON.stringify(options),
    });
  }

  static async generateAIPrompt(
    storeId: string, 
    options: AIExportOptions
  ): Promise<ContextAPIResponse<{ prompt: string; metadata: Record<string, unknown> }>> {
    return this.request<{ prompt: string; metadata: Record<string, unknown> }>(
      `/business/stores/${storeId}/context/export/prompt`, 
      {
        method: 'POST',
        body: JSON.stringify(options),
      }
    );
  }

  // Context Versioning API
  static async getContextVersions(
    storeId: string, 
    params?: ContextQueryParams & { section?: string }
  ): Promise<ContextAPIResponse<ContextListResponse<ContextVersion>>> {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) query.append(key, String(value));
      });
    }
    
    return this.request<ContextListResponse<ContextVersion>>(
      `/business/stores/${storeId}/context/versions?${query}`
    );
  }

  static async getContextVersion(
    storeId: string, 
    versionId: string
  ): Promise<ContextAPIResponse<ContextVersion>> {
    return this.request<ContextVersion>(`/business/stores/${storeId}/context/versions/${versionId}`);
  }

  static async createContextSnapshot(
    storeId: string, 
    description?: string
  ): Promise<ContextAPIResponse<ContextVersion>> {
    return this.request<ContextVersion>(`/business/stores/${storeId}/context/versions`, {
      method: 'POST',
      body: JSON.stringify({ description }),
    });
  }

  static async restoreContextVersion(
    storeId: string, 
    versionId: string
  ): Promise<ContextAPIResponse<ContextVersion>> {
    return this.request<ContextVersion>(
      `/business/stores/${storeId}/context/versions/${versionId}/restore`, 
      {
        method: 'POST',
      }
    );
  }

  // File Upload API
  static async uploadLayoutImage(
    storeId: string, 
    file: File, 
    layoutId?: string
  ): Promise<ContextAPIResponse<{ url: string; fileId: string }>> {
    try {
      const headers = await this.getAuthHeaders();
      headers.delete('Content-Type'); // Let browser set multipart boundary

      const formData = new FormData();
      formData.append('file', file);
      if (layoutId) formData.append('layoutId', layoutId);

      const response = await fetch(`${this.baseUrl}/business/stores/${storeId}/context/upload`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.message || `Upload failed: ${response.statusText}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload error occurred',
      };
    }
  }

  // Batch Operations API
  static async batchUpdateContext(
    storeId: string, 
    updates: {
      profile?: Partial<StoreContextProfile>;
      personnel?: Array<{ id?: string; data: Partial<StoreContextPersonnel>; action: 'create' | 'update' | 'delete' }>;
      layout?: Partial<StoreContextLayout>;
      inventory?: Array<{ id?: string; data: Partial<StoreContextInventory>; action: 'create' | 'update' | 'delete' }>;
    }
  ): Promise<ContextAPIResponse<{ 
    profile?: StoreContextProfile;
    personnel?: StoreContextPersonnel[];
    layout?: StoreContextLayout;
    inventory?: StoreContextInventory[];
    errors?: string[];
  }>> {
    return this.request(`/business/stores/${storeId}/context/batch`, {
      method: 'POST',
      body: JSON.stringify(updates),
    });
  }

  // Context Search API
  static async searchContext(
    storeId: string, 
    query: string, 
    sections?: Array<'profile' | 'personnel' | 'layout' | 'inventory'>
  ): Promise<ContextAPIResponse<{
    results: Array<{
      section: string;
      type: string;
      id: string;
      title: string;
      snippet: string;
      score: number;
    }>;
    total: number;
  }>> {
    return this.request(`/business/stores/${storeId}/context/search`, {
      method: 'POST',
      body: JSON.stringify({ query, sections }),
    });
  }

  // Context Validation API
  static async validateContext(
    storeId: string, 
    section?: 'profile' | 'personnel' | 'layout' | 'inventory'
  ): Promise<ContextAPIResponse<{
    isValid: boolean;
    errors: Array<{
      section: string;
      field: string;
      message: string;
      severity: 'error' | 'warning' | 'info';
    }>;
    warnings: Array<{
      section: string;
      field: string;
      message: string;
      recommendation?: string;
    }>;
  }>> {
    const endpoint = section 
      ? `/business/stores/${storeId}/context/validate/${section}`
      : `/business/stores/${storeId}/context/validate`;
    
    return this.request(endpoint, {
      method: 'POST',
    });
  }
}

export default ContextAPIService;