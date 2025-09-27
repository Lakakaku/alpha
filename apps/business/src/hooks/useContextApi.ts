'use client';

import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { 
  StoreContextProfile, 
  StoreContextPersonnel,
  StoreContextLayout,
  StoreContextInventory,
  ContextCompleteness,
  AIContextExport,
  ContextVersion
} from '@vocilia/types/src/context';
import ContextAPIService, { 
  ContextAPIResponse, 
  ContextListResponse,
  ContextQueryParams,
  AIExportOptions 
} from '../services/context-api';

// Query keys for consistent caching
export const contextQueryKeys = {
  all: ['context'] as const,
  stores: (storeId: string) => [...contextQueryKeys.all, 'store', storeId] as const,
  profile: (storeId: string) => [...contextQueryKeys.stores(storeId), 'profile'] as const,
  personnel: (storeId: string, params?: ContextQueryParams) => 
    [...contextQueryKeys.stores(storeId), 'personnel', params] as const,
  layouts: (storeId: string, params?: ContextQueryParams) => 
    [...contextQueryKeys.stores(storeId), 'layouts', params] as const,
  activeLayout: (storeId: string) => [...contextQueryKeys.stores(storeId), 'layouts', 'active'] as const,
  inventory: (storeId: string, params?: ContextQueryParams) => 
    [...contextQueryKeys.stores(storeId), 'inventory', params] as const,
  completeness: (storeId: string) => [...contextQueryKeys.stores(storeId), 'completeness'] as const,
  versions: (storeId: string, params?: ContextQueryParams) => 
    [...contextQueryKeys.stores(storeId), 'versions', params] as const,
  aiExport: (storeId: string, options: AIExportOptions) => 
    [...contextQueryKeys.stores(storeId), 'export', options] as const,
};

// Default query options for caching
const defaultQueryOptions = {
  staleTime: 5 * 60 * 1000, // 5 minutes
  gcTime: 10 * 60 * 1000, // 10 minutes
  retry: 2,
  refetchOnWindowFocus: false,
};

// Store Profile Hooks
export function useStoreProfile(
  storeId: string, 
  options?: Omit<UseQueryOptions<ContextAPIResponse<StoreContextProfile>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: contextQueryKeys.profile(storeId),
    queryFn: () => ContextAPIService.getStoreProfile(storeId),
    enabled: !!storeId,
    ...defaultQueryOptions,
    ...options,
  });
}

export function useUpdateStoreProfile(storeId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (profile: Partial<StoreContextProfile>) => 
      ContextAPIService.updateStoreProfile(storeId, profile),
    onSuccess: (data) => {
      // Update cache with new data
      queryClient.setQueryData(contextQueryKeys.profile(storeId), data);
      // Invalidate completeness score
      queryClient.invalidateQueries({ queryKey: contextQueryKeys.completeness(storeId) });
    },
    onError: (error) => {
      console.error('Failed to update store profile:', error);
    },
  });
}

export function useCreateStoreProfile(storeId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (profile: Omit<StoreContextProfile, 'id' | 'storeId' | 'createdAt' | 'updatedAt'>) => 
      ContextAPIService.createStoreProfile(storeId, profile),
    onSuccess: (data) => {
      queryClient.setQueryData(contextQueryKeys.profile(storeId), data);
      queryClient.invalidateQueries({ queryKey: contextQueryKeys.completeness(storeId) });
    },
  });
}

// Personnel Hooks
export function usePersonnel(
  storeId: string, 
  params?: ContextQueryParams,
  options?: Omit<UseQueryOptions<ContextAPIResponse<ContextListResponse<StoreContextPersonnel>>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: contextQueryKeys.personnel(storeId, params),
    queryFn: () => ContextAPIService.getPersonnel(storeId, params),
    enabled: !!storeId,
    ...defaultQueryOptions,
    ...options,
  });
}

export function useCreatePersonnel(storeId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (personnel: Omit<StoreContextPersonnel, 'id' | 'storeId' | 'createdAt' | 'updatedAt'>) => 
      ContextAPIService.createPersonnel(storeId, personnel),
    onSuccess: () => {
      // Invalidate all personnel queries for this store
      queryClient.invalidateQueries({ queryKey: contextQueryKeys.personnel(storeId) });
      queryClient.invalidateQueries({ queryKey: contextQueryKeys.completeness(storeId) });
    },
  });
}

export function useUpdatePersonnel(storeId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ personnelId, personnel }: { 
      personnelId: string; 
      personnel: Partial<StoreContextPersonnel> 
    }) => ContextAPIService.updatePersonnel(storeId, personnelId, personnel),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contextQueryKeys.personnel(storeId) });
      queryClient.invalidateQueries({ queryKey: contextQueryKeys.completeness(storeId) });
    },
  });
}

export function useDeletePersonnel(storeId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (personnelId: string) => 
      ContextAPIService.deletePersonnel(storeId, personnelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contextQueryKeys.personnel(storeId) });
      queryClient.invalidateQueries({ queryKey: contextQueryKeys.completeness(storeId) });
    },
  });
}

// Layout Hooks
export function useLayouts(
  storeId: string, 
  params?: ContextQueryParams,
  options?: Omit<UseQueryOptions<ContextAPIResponse<ContextListResponse<StoreContextLayout>>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: contextQueryKeys.layouts(storeId, params),
    queryFn: () => ContextAPIService.getLayouts(storeId, params),
    enabled: !!storeId,
    ...defaultQueryOptions,
    ...options,
  });
}

export function useActiveLayout(
  storeId: string,
  options?: Omit<UseQueryOptions<ContextAPIResponse<StoreContextLayout>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: contextQueryKeys.activeLayout(storeId),
    queryFn: () => ContextAPIService.getActiveLayout(storeId),
    enabled: !!storeId,
    ...defaultQueryOptions,
    ...options,
  });
}

export function useCreateLayout(storeId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (layout: Omit<StoreContextLayout, 'id' | 'storeId' | 'createdAt' | 'updatedAt'>) => 
      ContextAPIService.createLayout(storeId, layout),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contextQueryKeys.layouts(storeId) });
      queryClient.invalidateQueries({ queryKey: contextQueryKeys.completeness(storeId) });
    },
  });
}

export function useUpdateLayout(storeId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ layoutId, layout }: { 
      layoutId: string; 
      layout: Partial<StoreContextLayout> 
    }) => ContextAPIService.updateLayout(storeId, layoutId, layout),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contextQueryKeys.layouts(storeId) });
      queryClient.invalidateQueries({ queryKey: contextQueryKeys.activeLayout(storeId) });
      queryClient.invalidateQueries({ queryKey: contextQueryKeys.completeness(storeId) });
    },
  });
}

export function useActivateLayout(storeId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (layoutId: string) => 
      ContextAPIService.activateLayout(storeId, layoutId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contextQueryKeys.layouts(storeId) });
      queryClient.invalidateQueries({ queryKey: contextQueryKeys.activeLayout(storeId) });
    },
  });
}

export function useDeleteLayout(storeId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (layoutId: string) => 
      ContextAPIService.deleteLayout(storeId, layoutId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contextQueryKeys.layouts(storeId) });
      queryClient.invalidateQueries({ queryKey: contextQueryKeys.activeLayout(storeId) });
      queryClient.invalidateQueries({ queryKey: contextQueryKeys.completeness(storeId) });
    },
  });
}

// Inventory Hooks
export function useInventory(
  storeId: string, 
  params?: ContextQueryParams,
  options?: Omit<UseQueryOptions<ContextAPIResponse<ContextListResponse<StoreContextInventory>>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: contextQueryKeys.inventory(storeId, params),
    queryFn: () => ContextAPIService.getInventory(storeId, params),
    enabled: !!storeId,
    ...defaultQueryOptions,
    ...options,
  });
}

export function useCreateInventoryCategory(storeId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (inventory: Omit<StoreContextInventory, 'id' | 'storeId' | 'createdAt' | 'updatedAt'>) => 
      ContextAPIService.createInventoryCategory(storeId, inventory),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contextQueryKeys.inventory(storeId) });
      queryClient.invalidateQueries({ queryKey: contextQueryKeys.completeness(storeId) });
    },
  });
}

export function useUpdateInventoryCategory(storeId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ inventoryId, inventory }: { 
      inventoryId: string; 
      inventory: Partial<StoreContextInventory> 
    }) => ContextAPIService.updateInventoryCategory(storeId, inventoryId, inventory),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contextQueryKeys.inventory(storeId) });
      queryClient.invalidateQueries({ queryKey: contextQueryKeys.completeness(storeId) });
    },
  });
}

export function useDeleteInventoryCategory(storeId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (inventoryId: string) => 
      ContextAPIService.deleteInventoryCategory(storeId, inventoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contextQueryKeys.inventory(storeId) });
      queryClient.invalidateQueries({ queryKey: contextQueryKeys.completeness(storeId) });
    },
  });
}

// Completeness Hooks
export function useContextCompleteness(
  storeId: string,
  options?: Omit<UseQueryOptions<ContextAPIResponse<ContextCompleteness>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: contextQueryKeys.completeness(storeId),
    queryFn: () => ContextAPIService.getContextCompleteness(storeId),
    enabled: !!storeId,
    staleTime: 2 * 60 * 1000, // More frequent updates for completeness
    ...options,
  });
}

export function useRefreshCompletenessScore(storeId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => ContextAPIService.refreshCompletenessScore(storeId),
    onSuccess: (data) => {
      queryClient.setQueryData(contextQueryKeys.completeness(storeId), data);
    },
  });
}

// AI Export Hooks
export function useExportContextForAI(
  storeId: string,
  options: AIExportOptions,
  queryOptions?: Omit<UseQueryOptions<ContextAPIResponse<AIContextExport>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: contextQueryKeys.aiExport(storeId, options),
    queryFn: () => ContextAPIService.exportContextForAI(storeId, options),
    enabled: !!storeId,
    staleTime: 10 * 60 * 1000, // Cache exports for 10 minutes
    ...queryOptions,
  });
}

export function useGenerateAIPrompt(storeId: string) {
  return useMutation({
    mutationFn: (options: AIExportOptions) => 
      ContextAPIService.generateAIPrompt(storeId, options),
  });
}

// Versioning Hooks
export function useContextVersions(
  storeId: string, 
  params?: ContextQueryParams & { section?: string },
  options?: Omit<UseQueryOptions<ContextAPIResponse<ContextListResponse<ContextVersion>>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: contextQueryKeys.versions(storeId, params),
    queryFn: () => ContextAPIService.getContextVersions(storeId, params),
    enabled: !!storeId,
    ...defaultQueryOptions,
    ...options,
  });
}

export function useCreateContextSnapshot(storeId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (description?: string) => 
      ContextAPIService.createContextSnapshot(storeId, description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contextQueryKeys.versions(storeId) });
    },
  });
}

export function useRestoreContextVersion(storeId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (versionId: string) => 
      ContextAPIService.restoreContextVersion(storeId, versionId),
    onSuccess: () => {
      // Invalidate all context data as it may have changed
      queryClient.invalidateQueries({ queryKey: contextQueryKeys.stores(storeId) });
    },
  });
}

// File Upload Hook
export function useUploadLayoutImage(storeId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ file, layoutId }: { file: File; layoutId?: string }) => 
      ContextAPIService.uploadLayoutImage(storeId, file, layoutId),
    onSuccess: () => {
      // Invalidate layouts if this was associated with a layout
      queryClient.invalidateQueries({ queryKey: contextQueryKeys.layouts(storeId) });
    },
  });
}

// Batch Operations Hook
export function useBatchUpdateContext(storeId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (updates: Parameters<typeof ContextAPIService.batchUpdateContext>[1]) => 
      ContextAPIService.batchUpdateContext(storeId, updates),
    onSuccess: () => {
      // Invalidate all context data as multiple sections may have changed
      queryClient.invalidateQueries({ queryKey: contextQueryKeys.stores(storeId) });
    },
  });
}

// Search Hook
export function useSearchContext(storeId: string) {
  return useMutation({
    mutationFn: ({ query, sections }: { 
      query: string; 
      sections?: Array<'profile' | 'personnel' | 'layout' | 'inventory'> 
    }) => ContextAPIService.searchContext(storeId, query, sections),
  });
}

// Validation Hook
export function useValidateContext(storeId: string) {
  return useMutation({
    mutationFn: (section?: 'profile' | 'personnel' | 'layout' | 'inventory') => 
      ContextAPIService.validateContext(storeId, section),
  });
}

// Cache utilities
export function useContextCacheUtils() {
  const queryClient = useQueryClient();
  
  return {
    // Prefetch store context data
    prefetchStoreContext: async (storeId: string) => {
      await Promise.all([
        queryClient.prefetchQuery({
          queryKey: contextQueryKeys.profile(storeId),
          queryFn: () => ContextAPIService.getStoreProfile(storeId),
          staleTime: defaultQueryOptions.staleTime,
        }),
        queryClient.prefetchQuery({
          queryKey: contextQueryKeys.completeness(storeId),
          queryFn: () => ContextAPIService.getContextCompleteness(storeId),
          staleTime: 2 * 60 * 1000,
        }),
      ]);
    },
    
    // Clear all context cache for a store
    clearStoreCache: (storeId: string) => {
      queryClient.removeQueries({ queryKey: contextQueryKeys.stores(storeId) });
    },
    
    // Invalidate all context data for a store
    invalidateStoreContext: (storeId: string) => {
      queryClient.invalidateQueries({ queryKey: contextQueryKeys.stores(storeId) });
    },
    
    // Get cached data without triggering a request
    getCachedProfile: (storeId: string) => 
      queryClient.getQueryData<ContextAPIResponse<StoreContextProfile>>(
        contextQueryKeys.profile(storeId)
      ),
    
    getCachedCompleteness: (storeId: string) => 
      queryClient.getQueryData<ContextAPIResponse<ContextCompleteness>>(
        contextQueryKeys.completeness(storeId)
      ),
  };
}

export default {
  // Profile
  useStoreProfile,
  useUpdateStoreProfile,
  useCreateStoreProfile,
  
  // Personnel
  usePersonnel,
  useCreatePersonnel,
  useUpdatePersonnel,
  useDeletePersonnel,
  
  // Layouts
  useLayouts,
  useActiveLayout,
  useCreateLayout,
  useUpdateLayout,
  useActivateLayout,
  useDeleteLayout,
  
  // Inventory
  useInventory,
  useCreateInventoryCategory,
  useUpdateInventoryCategory,
  useDeleteInventoryCategory,
  
  // Completeness
  useContextCompleteness,
  useRefreshCompletenessScore,
  
  // AI Export
  useExportContextForAI,
  useGenerateAIPrompt,
  
  // Versioning
  useContextVersions,
  useCreateContextSnapshot,
  useRestoreContextVersion,
  
  // File Upload
  useUploadLayoutImage,
  
  // Batch & Search
  useBatchUpdateContext,
  useSearchContext,
  useValidateContext,
  
  // Cache utilities
  useContextCacheUtils,
};