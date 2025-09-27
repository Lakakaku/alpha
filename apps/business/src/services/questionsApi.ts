import { CustomQuestion, QuestionCategory, QuestionTrigger, QuestionResponse } from '@vocilia/types';

export interface QuestionsListParams {
  page?: number;
  limit?: number;
  category?: string;
  status?: 'active' | 'inactive' | 'all';
  priority?: number;
  search?: string;
  sortBy?: 'title' | 'createdAt' | 'priority' | 'category';
  sortOrder?: 'asc' | 'desc';
  tags?: string[];
}

export interface QuestionsListResponse {
  questions: CustomQuestion[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  categories: QuestionCategory[];
}

export interface QuestionPreviewParams {
  format?: 'html' | 'json' | 'text';
  personalization?: {
    customerName?: string;
    visitCount?: number;
    lastVisit?: Date;
    preferences?: Record<string, any>;
  };
}

export interface QuestionPreviewResponse {
  html?: string;
  json?: Record<string, any>;
  text?: string;
  metadata: {
    estimatedDuration: number;
    complexity: 'simple' | 'medium' | 'complex';
    accessibility: {
      screenReaderFriendly: boolean;
      keyboardNavigable: boolean;
      contrastRatio: number;
    };
  };
}

export interface CategoryStats {
  questionCount: number;
  activeQuestions: number;
  responseCount: number;
  averageRating?: number;
}

export interface QuestionStats {
  responseCount: number;
  averageRating?: number;
  responseRate: number;
  lastResponseAt?: Date;
  topResponses?: Array<{
    value: string;
    count: number;
    percentage: number;
  }>;
}

class QuestionsApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'QuestionsApiError';
  }
}

class QuestionsApi {
  private baseUrl: string;
  private getAuthHeaders: () => Promise<HeadersInit>;

  constructor(baseUrl: string = '/api', getAuthHeaders: () => Promise<HeadersInit>) {
    this.baseUrl = baseUrl;
    this.getAuthHeaders = getAuthHeaders;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = await this.getAuthHeaders();

    const config: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        let errorMessage = `Request failed: ${response.status} ${response.statusText}`;
        let errorDetails: any = null;

        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
          errorDetails = errorData;
        } catch {
          // Response body might not be JSON
        }

        throw new QuestionsApiError(
          errorMessage,
          response.status,
          errorDetails?.code,
          errorDetails
        );
      }

      // Handle empty responses
      if (response.status === 204) {
        return {} as T;
      }

      return await response.json();
    } catch (error) {
      if (error instanceof QuestionsApiError) {
        throw error;
      }

      // Network or other errors
      throw new QuestionsApiError(
        error instanceof Error ? error.message : 'An unexpected error occurred',
        undefined,
        'NETWORK_ERROR'
      );
    }
  }

  // Question CRUD Operations
  async getQuestions(params: QuestionsListParams = {}): Promise<QuestionsListResponse> {
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          value.forEach(item => searchParams.append(key, String(item)));
        } else {
          searchParams.append(key, String(value));
        }
      }
    });

    const queryString = searchParams.toString();
    const endpoint = `/questions${queryString ? `?${queryString}` : ''}`;

    return this.request<QuestionsListResponse>(endpoint);
  }

  async getQuestion(questionId: string): Promise<CustomQuestion> {
    return this.request<CustomQuestion>(`/questions/${questionId}`);
  }

  async createQuestion(question: Omit<CustomQuestion, 'id' | 'businessId' | 'createdAt' | 'updatedAt'>): Promise<CustomQuestion> {
    return this.request<CustomQuestion>('/questions', {
      method: 'POST',
      body: JSON.stringify(question),
    });
  }

  async updateQuestion(questionId: string, updates: Partial<CustomQuestion>): Promise<CustomQuestion> {
    return this.request<CustomQuestion>(`/questions/${questionId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteQuestion(questionId: string, force: boolean = false): Promise<void> {
    const params = force ? '?force=true' : '';
    return this.request<void>(`/questions/${questionId}${params}`, {
      method: 'DELETE',
    });
  }

  async activateQuestion(questionId: string): Promise<CustomQuestion> {
    return this.request<CustomQuestion>(`/questions/${questionId}/activate`, {
      method: 'POST',
      body: JSON.stringify({ action: 'activate' }),
    });
  }

  async deactivateQuestion(questionId: string): Promise<CustomQuestion> {
    return this.request<CustomQuestion>(`/questions/${questionId}/activate`, {
      method: 'POST',
      body: JSON.stringify({ action: 'deactivate' }),
    });
  }

  async previewQuestion(
    questionId: string,
    params: QuestionPreviewParams = {}
  ): Promise<QuestionPreviewResponse> {
    return this.request<QuestionPreviewResponse>(`/questions/${questionId}/preview`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  // Question Statistics
  async getQuestionStats(questionId: string): Promise<QuestionStats> {
    return this.request<QuestionStats>(`/questions/${questionId}/stats`);
  }

  // Category Operations
  async getCategories(): Promise<QuestionCategory[]> {
    return this.request<QuestionCategory[]>('/questions/categories');
  }

  async createCategory(category: Omit<QuestionCategory, 'id' | 'businessId' | 'createdAt' | 'updatedAt'>): Promise<QuestionCategory> {
    return this.request<QuestionCategory>('/questions/categories', {
      method: 'POST',
      body: JSON.stringify(category),
    });
  }

  async updateCategory(categoryId: string, updates: Partial<QuestionCategory>): Promise<QuestionCategory> {
    return this.request<QuestionCategory>(`/questions/categories/${categoryId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteCategory(categoryId: string): Promise<void> {
    return this.request<void>(`/questions/categories/${categoryId}`, {
      method: 'DELETE',
    });
  }

  async getCategoryStats(categoryId: string): Promise<CategoryStats> {
    return this.request<CategoryStats>(`/questions/categories/${categoryId}/stats`);
  }

  async setDefaultCategory(categoryId: string): Promise<QuestionCategory> {
    return this.request<QuestionCategory>(`/questions/categories/${categoryId}/default`, {
      method: 'POST',
    });
  }

  // Trigger Operations
  async createTrigger(questionId: string, trigger: Omit<QuestionTrigger, 'id' | 'questionId' | 'createdAt' | 'updatedAt'>): Promise<QuestionTrigger> {
    return this.request<QuestionTrigger>(`/questions/${questionId}/triggers`, {
      method: 'POST',
      body: JSON.stringify(trigger),
    });
  }

  async updateTrigger(questionId: string, triggerId: string, updates: Partial<QuestionTrigger>): Promise<QuestionTrigger> {
    return this.request<QuestionTrigger>(`/questions/${questionId}/triggers/${triggerId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteTrigger(questionId: string, triggerId: string): Promise<void> {
    return this.request<void>(`/questions/${questionId}/triggers/${triggerId}`, {
      method: 'DELETE',
    });
  }

  // Bulk Operations
  async bulkActivateQuestions(questionIds: string[]): Promise<{ updated: number; failed: string[] }> {
    return this.request<{ updated: number; failed: string[] }>('/questions/bulk/activate', {
      method: 'POST',
      body: JSON.stringify({ questionIds }),
    });
  }

  async bulkDeactivateQuestions(questionIds: string[]): Promise<{ updated: number; failed: string[] }> {
    return this.request<{ updated: number; failed: string[] }>('/questions/bulk/deactivate', {
      method: 'POST',
      body: JSON.stringify({ questionIds }),
    });
  }

  async bulkDeleteQuestions(questionIds: string[], force: boolean = false): Promise<{ deleted: number; failed: string[] }> {
    return this.request<{ deleted: number; failed: string[] }>('/questions/bulk/delete', {
      method: 'POST',
      body: JSON.stringify({ questionIds, force }),
    });
  }

  async bulkUpdateQuestions(updates: Array<{ id: string; data: Partial<CustomQuestion> }>): Promise<{ updated: number; failed: Array<{ id: string; error: string }> }> {
    return this.request<{ updated: number; failed: Array<{ id: string; error: string }> }>('/questions/bulk/update', {
      method: 'POST',
      body: JSON.stringify({ updates }),
    });
  }

  // Analytics & Reporting
  async getAnalyticsSummary(params: {
    startDate?: Date;
    endDate?: Date;
    categoryId?: string;
    questionIds?: string[];
  } = {}): Promise<{
    totalQuestions: number;
    activeQuestions: number;
    totalResponses: number;
    averageResponseRate: number;
    topCategories: Array<{ categoryId: string; name: string; responseCount: number }>;
    recentActivity: Array<{ date: string; responseCount: number; newQuestions: number }>;
  }> {
    const searchParams = new URLSearchParams();
    
    if (params.startDate) searchParams.append('startDate', params.startDate.toISOString());
    if (params.endDate) searchParams.append('endDate', params.endDate.toISOString());
    if (params.categoryId) searchParams.append('categoryId', params.categoryId);
    if (params.questionIds) params.questionIds.forEach(id => searchParams.append('questionIds', id));

    const queryString = searchParams.toString();
    const endpoint = `/questions/analytics${queryString ? `?${queryString}` : ''}`;

    return this.request(endpoint);
  }

  // Export & Import
  async exportQuestions(params: {
    format: 'csv' | 'json' | 'xlsx';
    questionIds?: string[];
    categoryId?: string;
    includeResponses?: boolean;
  }): Promise<Blob> {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          value.forEach(item => searchParams.append(key, String(item)));
        } else {
          searchParams.append(key, String(value));
        }
      }
    });

    const response = await fetch(`${this.baseUrl}/questions/export?${searchParams.toString()}`, {
      headers: await this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new QuestionsApiError(`Export failed: ${response.statusText}`, response.status);
    }

    return response.blob();
  }

  async importQuestions(file: File, options: {
    categoryId?: string;
    overwriteExisting?: boolean;
    validateOnly?: boolean;
  } = {}): Promise<{
    imported: number;
    skipped: number;
    errors: Array<{ row: number; message: string }>;
    preview?: CustomQuestion[];
  }> {
    const formData = new FormData();
    formData.append('file', file);
    
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        formData.append(key, String(value));
      }
    });

    const headers = await this.getAuthHeaders();
    delete (headers as any)['Content-Type']; // Let browser set multipart boundary

    const response = await fetch(`${this.baseUrl}/questions/import`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      throw new QuestionsApiError(`Import failed: ${response.statusText}`, response.status);
    }

    return response.json();
  }
}

// Create singleton instance
let questionsApiInstance: QuestionsApi | null = null;

export const createQuestionsApi = (
  baseUrl?: string,
  getAuthHeaders?: () => Promise<HeadersInit>
): QuestionsApi => {
  if (!getAuthHeaders) {
    throw new Error('getAuthHeaders function is required');
  }
  
  questionsApiInstance = new QuestionsApi(baseUrl, getAuthHeaders);
  return questionsApiInstance;
};

export const getQuestionsApi = (): QuestionsApi => {
  if (!questionsApiInstance) {
    throw new Error('QuestionsApi not initialized. Call createQuestionsApi first.');
  }
  return questionsApiInstance;
};

export { QuestionsApiError, QuestionsApi };
export type { QuestionsListParams, QuestionsListResponse, QuestionPreviewParams, QuestionPreviewResponse, CategoryStats, QuestionStats };