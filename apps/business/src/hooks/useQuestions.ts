import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CustomQuestion, QuestionCategory, QuestionTrigger } from '@vocilia/types';
import { 
  getQuestionsApi, 
  QuestionsListParams, 
  QuestionPreviewParams,
  CategoryStats,
  QuestionStats,
  QuestionsApiError
} from '../services/questionsApi';

// Query Keys
export const questionKeys = {
  all: ['questions'] as const,
  lists: () => [...questionKeys.all, 'list'] as const,
  list: (params: QuestionsListParams) => [...questionKeys.lists(), params] as const,
  details: () => [...questionKeys.all, 'detail'] as const,
  detail: (id: string) => [...questionKeys.details(), id] as const,
  stats: () => [...questionKeys.all, 'stats'] as const,
  stat: (id: string) => [...questionKeys.stats(), id] as const,
  preview: () => [...questionKeys.all, 'preview'] as const,
  previewDetail: (id: string, params: QuestionPreviewParams) => [...questionKeys.preview(), id, params] as const,
  analytics: () => [...questionKeys.all, 'analytics'] as const,
} as const;

export const categoryKeys = {
  all: ['categories'] as const,
  lists: () => [...categoryKeys.all, 'list'] as const,
  details: () => [...categoryKeys.all, 'detail'] as const,
  detail: (id: string) => [...categoryKeys.details(), id] as const,
  stats: () => [...categoryKeys.all, 'stats'] as const,
  stat: (id: string) => [...categoryKeys.stats(), id] as const,
} as const;

// Custom hooks for Questions
export function useQuestions(params: QuestionsListParams = {}) {
  return useQuery({
    queryKey: questionKeys.list(params),
    queryFn: () => getQuestionsApi().getQuestions(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useQuestion(questionId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: questionKeys.detail(questionId),
    queryFn: () => getQuestionsApi().getQuestion(questionId),
    enabled: enabled && !!questionId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useQuestionStats(questionId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: questionKeys.stat(questionId),
    queryFn: () => getQuestionsApi().getQuestionStats(questionId),
    enabled: enabled && !!questionId,
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

export function useQuestionPreview(
  questionId: string, 
  params: QuestionPreviewParams = {},
  enabled: boolean = true
) {
  return useQuery({
    queryKey: questionKeys.previewDetail(questionId, params),
    queryFn: () => getQuestionsApi().previewQuestion(questionId, params),
    enabled: enabled && !!questionId,
    staleTime: 0, // Always fresh for preview
    cacheTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useAnalyticsSummary(params: {
  startDate?: Date;
  endDate?: Date;
  categoryId?: string;
  questionIds?: string[];
} = {}) {
  return useQuery({
    queryKey: [...questionKeys.analytics(), params],
    queryFn: () => getQuestionsApi().getAnalyticsSummary(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Custom hooks for Categories
export function useCategories() {
  return useQuery({
    queryKey: categoryKeys.lists(),
    queryFn: () => getQuestionsApi().getCategories(),
    staleTime: 10 * 60 * 1000, // 10 minutes
    cacheTime: 15 * 60 * 1000, // 15 minutes
  });
}

export function useCategoryStats(categoryId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: categoryKeys.stat(categoryId),
    queryFn: () => getQuestionsApi().getCategoryStats(categoryId),
    enabled: enabled && !!categoryId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Mutation hooks for Questions
export function useCreateQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (question: Omit<CustomQuestion, 'id' | 'businessId' | 'createdAt' | 'updatedAt'>) =>
      getQuestionsApi().createQuestion(question),
    onSuccess: (newQuestion) => {
      // Invalidate questions list
      queryClient.invalidateQueries({ queryKey: questionKeys.lists() });
      
      // Update categories cache to reflect new question count
      queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
      
      // Add the new question to cache
      queryClient.setQueryData(questionKeys.detail(newQuestion.id), newQuestion);
    },
    onError: (error: QuestionsApiError) => {
      console.error('Failed to create question:', error);
    },
  });
}

export function useUpdateQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ questionId, updates }: { questionId: string; updates: Partial<CustomQuestion> }) =>
      getQuestionsApi().updateQuestion(questionId, updates),
    onSuccess: (updatedQuestion, { questionId }) => {
      // Update the specific question in cache
      queryClient.setQueryData(questionKeys.detail(questionId), updatedQuestion);
      
      // Invalidate questions list to refresh
      queryClient.invalidateQueries({ queryKey: questionKeys.lists() });
      
      // Invalidate stats if they exist
      queryClient.invalidateQueries({ queryKey: questionKeys.stat(questionId) });
    },
    onError: (error: QuestionsApiError) => {
      console.error('Failed to update question:', error);
    },
  });
}

export function useDeleteQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ questionId, force = false }: { questionId: string; force?: boolean }) =>
      getQuestionsApi().deleteQuestion(questionId, force),
    onSuccess: (_, { questionId }) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: questionKeys.detail(questionId) });
      
      // Invalidate questions list
      queryClient.invalidateQueries({ queryKey: questionKeys.lists() });
      
      // Update categories cache
      queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
    },
    onError: (error: QuestionsApiError) => {
      console.error('Failed to delete question:', error);
    },
  });
}

export function useActivateQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (questionId: string) => getQuestionsApi().activateQuestion(questionId),
    onSuccess: (updatedQuestion, questionId) => {
      // Update the specific question in cache
      queryClient.setQueryData(questionKeys.detail(questionId), updatedQuestion);
      
      // Invalidate questions list to refresh status
      queryClient.invalidateQueries({ queryKey: questionKeys.lists() });
    },
    onError: (error: QuestionsApiError) => {
      console.error('Failed to activate question:', error);
    },
  });
}

export function useDeactivateQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (questionId: string) => getQuestionsApi().deactivateQuestion(questionId),
    onSuccess: (updatedQuestion, questionId) => {
      // Update the specific question in cache
      queryClient.setQueryData(questionKeys.detail(questionId), updatedQuestion);
      
      // Invalidate questions list to refresh status
      queryClient.invalidateQueries({ queryKey: questionKeys.lists() });
    },
    onError: (error: QuestionsApiError) => {
      console.error('Failed to deactivate question:', error);
    },
  });
}

// Bulk operations
export function useBulkActivateQuestions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (questionIds: string[]) => getQuestionsApi().bulkActivateQuestions(questionIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: questionKeys.lists() });
      queryClient.invalidateQueries({ queryKey: questionKeys.analytics() });
    },
    onError: (error: QuestionsApiError) => {
      console.error('Failed to bulk activate questions:', error);
    },
  });
}

export function useBulkDeactivateQuestions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (questionIds: string[]) => getQuestionsApi().bulkDeactivateQuestions(questionIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: questionKeys.lists() });
      queryClient.invalidateQueries({ queryKey: questionKeys.analytics() });
    },
    onError: (error: QuestionsApiError) => {
      console.error('Failed to bulk deactivate questions:', error);
    },
  });
}

export function useBulkDeleteQuestions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ questionIds, force = false }: { questionIds: string[]; force?: boolean }) =>
      getQuestionsApi().bulkDeleteQuestions(questionIds, force),
    onSuccess: (_, { questionIds }) => {
      // Remove all deleted questions from cache
      questionIds.forEach(id => {
        queryClient.removeQueries({ queryKey: questionKeys.detail(id) });
      });
      
      queryClient.invalidateQueries({ queryKey: questionKeys.lists() });
      queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
    },
    onError: (error: QuestionsApiError) => {
      console.error('Failed to bulk delete questions:', error);
    },
  });
}

// Mutation hooks for Categories
export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (category: Omit<QuestionCategory, 'id' | 'businessId' | 'createdAt' | 'updatedAt'>) =>
      getQuestionsApi().createCategory(category),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
    },
    onError: (error: QuestionsApiError) => {
      console.error('Failed to create category:', error);
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ categoryId, updates }: { categoryId: string; updates: Partial<QuestionCategory> }) =>
      getQuestionsApi().updateCategory(categoryId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: questionKeys.lists() });
    },
    onError: (error: QuestionsApiError) => {
      console.error('Failed to update category:', error);
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (categoryId: string) => getQuestionsApi().deleteCategory(categoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: questionKeys.lists() });
    },
    onError: (error: QuestionsApiError) => {
      console.error('Failed to delete category:', error);
    },
  });
}

export function useSetDefaultCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (categoryId: string) => getQuestionsApi().setDefaultCategory(categoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
    },
    onError: (error: QuestionsApiError) => {
      console.error('Failed to set default category:', error);
    },
  });
}

// Trigger hooks
export function useCreateTrigger() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ 
      questionId, 
      trigger 
    }: { 
      questionId: string; 
      trigger: Omit<QuestionTrigger, 'id' | 'questionId' | 'createdAt' | 'updatedAt'>;
    }) => getQuestionsApi().createTrigger(questionId, trigger),
    onSuccess: (_, { questionId }) => {
      queryClient.invalidateQueries({ queryKey: questionKeys.detail(questionId) });
    },
    onError: (error: QuestionsApiError) => {
      console.error('Failed to create trigger:', error);
    },
  });
}

export function useUpdateTrigger() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ 
      questionId, 
      triggerId, 
      updates 
    }: { 
      questionId: string; 
      triggerId: string; 
      updates: Partial<QuestionTrigger>;
    }) => getQuestionsApi().updateTrigger(questionId, triggerId, updates),
    onSuccess: (_, { questionId }) => {
      queryClient.invalidateQueries({ queryKey: questionKeys.detail(questionId) });
    },
    onError: (error: QuestionsApiError) => {
      console.error('Failed to update trigger:', error);
    },
  });
}

export function useDeleteTrigger() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ questionId, triggerId }: { questionId: string; triggerId: string }) =>
      getQuestionsApi().deleteTrigger(questionId, triggerId),
    onSuccess: (_, { questionId }) => {
      queryClient.invalidateQueries({ queryKey: questionKeys.detail(questionId) });
    },
    onError: (error: QuestionsApiError) => {
      console.error('Failed to delete trigger:', error);
    },
  });
}

// Export & Import hooks
export function useExportQuestions() {
  return useMutation({
    mutationFn: (params: {
      format: 'csv' | 'json' | 'xlsx';
      questionIds?: string[];
      categoryId?: string;
      includeResponses?: boolean;
    }) => getQuestionsApi().exportQuestions(params),
    onSuccess: (blob, params) => {
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `questions-export.${params.format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    },
    onError: (error: QuestionsApiError) => {
      console.error('Failed to export questions:', error);
    },
  });
}

export function useImportQuestions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ file, options }: {
      file: File;
      options?: {
        categoryId?: string;
        overwriteExisting?: boolean;
        validateOnly?: boolean;
      };
    }) => getQuestionsApi().importQuestions(file, options),
    onSuccess: (result) => {
      if (!result.preview && result.imported > 0) {
        // Refresh questions list if import was successful
        queryClient.invalidateQueries({ queryKey: questionKeys.lists() });
        queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
      }
      return result;
    },
    onError: (error: QuestionsApiError) => {
      console.error('Failed to import questions:', error);
    },
  });
}

// Utility hooks
export function useInvalidateQuestions() {
  const queryClient = useQueryClient();

  return {
    invalidateAll: () => {
      queryClient.invalidateQueries({ queryKey: questionKeys.all });
      queryClient.invalidateQueries({ queryKey: categoryKeys.all });
    },
    invalidateList: () => {
      queryClient.invalidateQueries({ queryKey: questionKeys.lists() });
    },
    invalidateQuestion: (questionId: string) => {
      queryClient.invalidateQueries({ queryKey: questionKeys.detail(questionId) });
    },
    invalidateCategories: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
    },
    invalidateAnalytics: () => {
      queryClient.invalidateQueries({ queryKey: questionKeys.analytics() });
    },
  };
}

// Optimistic updates helper
export function useOptimisticQuestion() {
  const queryClient = useQueryClient();

  return {
    updateQuestion: (questionId: string, updates: Partial<CustomQuestion>) => {
      queryClient.setQueryData(questionKeys.detail(questionId), (old: CustomQuestion | undefined) => {
        if (!old) return old;
        return { ...old, ...updates, updatedAt: new Date() };
      });
    },
    revertQuestion: (questionId: string) => {
      queryClient.invalidateQueries({ queryKey: questionKeys.detail(questionId) });
    },
  };
}