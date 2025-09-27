import { Router, Request, Response, NextFunction } from 'express';
import { database } from '@vocilia/database';
import { asyncHandler, ValidationError, NotFoundError, AuthorizationError } from '../../middleware/errorHandler';
import { contextCompletenessService } from '../../services/context/completeness';
import { aiContextExportService } from '../../services/context/ai-export';

const router = Router();

interface ContextQueryParams {
  include_completeness?: string;
  include_ai_export?: string;
  ai_verbosity?: 'concise' | 'standard' | 'detailed';
  sections?: string;
}

interface StoreContextResponse {
  store_id: string;
  profile: any;
  operating_hours: any[];
  personnel: any[];
  layout: any;
  inventory: any;
  completeness_score?: any;
  ai_export?: any;
  metadata: {
    last_updated: string;
    sections_available: string[];
    data_version: string;
  };
}

// GET /business/stores/:storeId/context
router.get('/:storeId/context', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const userRole = req.user?.role;
  const userBusinessId = req.user?.business_id;
  const { storeId } = req.params;
  
  const {
    include_completeness,
    include_ai_export,
    ai_verbosity = 'standard',
    sections
  } = req.query as ContextQueryParams;

  // Authentication check
  if (!userId) {
    throw new ValidationError('User authentication required');
  }

  const supabase = database.createClient();

  // Verify store exists and get business_id
  const { data: store, error: storeError } = await supabase
    .from('stores')
    .select('id, business_id, name')
    .eq('id', storeId)
    .single();

  if (storeError || !store) {
    throw new NotFoundError(`Store ${storeId} not found`);
  }

  // Check business access permissions
  if (userRole === 'business_account' && userBusinessId !== store.business_id) {
    throw new AuthorizationError('Access denied to this store');
  }

  // Parse requested sections
  const requestedSections = sections ? sections.split(',').map(s => s.trim()) : ['profile', 'personnel', 'layout', 'inventory'];
  const validSections = ['profile', 'personnel', 'layout', 'inventory', 'operating_hours'];
  const sectionsToFetch = requestedSections.filter(section => validSections.includes(section));

  // Always include operating_hours with profile
  if (sectionsToFetch.includes('profile') && !sectionsToFetch.includes('operating_hours')) {
    sectionsToFetch.push('operating_hours');
  }

  // Fetch context data based on requested sections
  const contextData: any = {
    store_id: storeId
  };

  const promises: Promise<any>[] = [];
  const promiseKeys: string[] = [];

  // Profile data
  if (sectionsToFetch.includes('profile')) {
    promises.push(
      supabase
        .from('store_context_profiles')
        .select('*')
        .eq('store_id', storeId)
        .maybeSingle()
    );
    promiseKeys.push('profile');
  }

  // Operating hours data
  if (sectionsToFetch.includes('operating_hours') || sectionsToFetch.includes('profile')) {
    promises.push(
      supabase
        .from('store_operating_hours')
        .select('*')
        .eq('store_id', storeId)
        .order('day_of_week')
    );
    promiseKeys.push('operating_hours');
  }

  // Personnel data
  if (sectionsToFetch.includes('personnel')) {
    promises.push(
      supabase
        .from('store_context_personnel')
        .select('*')
        .eq('store_id', storeId)
        .eq('is_active', true)
        .order('role')
    );
    promiseKeys.push('personnel');
  }

  // Layout data
  if (sectionsToFetch.includes('layout')) {
    promises.push(
      supabase
        .from('store_context_layouts')
        .select('*')
        .eq('store_id', storeId)
        .maybeSingle()
    );
    promiseKeys.push('layout');
  }

  // Inventory data
  if (sectionsToFetch.includes('inventory')) {
    promises.push(
      supabase
        .from('store_context_inventory')
        .select('*')
        .eq('store_id', storeId)
        .maybeSingle()
    );
    promiseKeys.push('inventory');
  }

  // Execute all queries in parallel
  const results = await Promise.all(promises);

  // Process results
  results.forEach((result, index) => {
    const key = promiseKeys[index];
    
    if (result.error) {
      throw new Error(`Failed to fetch ${key} data: ${result.error.message}`);
    }

    if (key === 'operating_hours' || key === 'personnel') {
      contextData[key] = result.data || [];
    } else {
      contextData[key] = result.data;
    }
  });

  // Determine which sections are available (have data)
  const sectionsAvailable: string[] = [];
  if (contextData.profile) sectionsAvailable.push('profile');
  if (contextData.operating_hours && contextData.operating_hours.length > 0) sectionsAvailable.push('operating_hours');
  if (contextData.personnel && contextData.personnel.length > 0) sectionsAvailable.push('personnel');
  if (contextData.layout) sectionsAvailable.push('layout');
  if (contextData.inventory) sectionsAvailable.push('inventory');

  // Calculate last updated timestamp
  const lastUpdatedDates: Date[] = [];
  if (contextData.profile?.updated_at) lastUpdatedDates.push(new Date(contextData.profile.updated_at));
  if (contextData.layout?.updated_at) lastUpdatedDates.push(new Date(contextData.layout.updated_at));
  if (contextData.inventory?.updated_at) lastUpdatedDates.push(new Date(contextData.inventory.updated_at));
  
  contextData.personnel?.forEach((p: any) => {
    if (p.updated_at) lastUpdatedDates.push(new Date(p.updated_at));
  });

  contextData.operating_hours?.forEach((h: any) => {
    if (h.updated_at) lastUpdatedDates.push(new Date(h.updated_at));
  });

  const lastUpdated = lastUpdatedDates.length > 0 
    ? new Date(Math.max(...lastUpdatedDates.map(d => d.getTime()))).toISOString()
    : new Date().toISOString();

  // Build response
  const response: StoreContextResponse = {
    store_id: storeId,
    profile: contextData.profile,
    operating_hours: contextData.operating_hours || [],
    personnel: contextData.personnel || [],
    layout: contextData.layout,
    inventory: contextData.inventory,
    metadata: {
      last_updated: lastUpdated,
      sections_available: sectionsAvailable,
      data_version: '1.0'
    }
  };

  // Add completeness score if requested
  if (include_completeness === 'true') {
    try {
      response.completeness_score = await contextCompletenessService.calculateCompletenessScore(storeId);
    } catch (error) {
      // Log error but don't fail the request
      console.error(`Failed to calculate completeness score for store ${storeId}:`, error);
      response.completeness_score = {
        error: 'Failed to calculate completeness score',
        overall_score: 0
      };
    }
  }

  // Add AI export if requested
  if (include_ai_export === 'true') {
    try {
      // Validate AI verbosity parameter
      const validVerbosity = ['concise', 'standard', 'detailed'];
      const verbosity = validVerbosity.includes(ai_verbosity) ? ai_verbosity : 'standard';

      response.ai_export = await aiContextExportService.generateAIContextExport(storeId, {
        verbosity,
        includeRecommendations: true,
        focusAreas: sectionsToFetch
      });
    } catch (error) {
      // Log error but don't fail the request
      console.error(`Failed to generate AI export for store ${storeId}:`, error);
      response.ai_export = {
        error: 'Failed to generate AI context export'
      };
    }
  }

  res.status(200).json(response);
}));

// GET /business/stores/:storeId/context/completeness
router.get('/:storeId/context/completeness', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const userRole = req.user?.role;
  const userBusinessId = req.user?.business_id;
  const { storeId } = req.params;

  // Authentication check
  if (!userId) {
    throw new ValidationError('User authentication required');
  }

  const supabase = database.createClient();

  // Verify store exists and check permissions
  const { data: store, error: storeError } = await supabase
    .from('stores')
    .select('id, business_id')
    .eq('id', storeId)
    .single();

  if (storeError || !store) {
    throw new NotFoundError(`Store ${storeId} not found`);
  }

  if (userRole === 'business_account' && userBusinessId !== store.business_id) {
    throw new AuthorizationError('Access denied to this store');
  }

  // Calculate completeness score
  const completenessScore = await contextCompletenessService.calculateCompletenessScore(storeId);

  res.status(200).json(completenessScore);
}));

// GET /business/stores/:storeId/context/export
router.get('/:storeId/context/export', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const userRole = req.user?.role;
  const userBusinessId = req.user?.business_id;
  const { storeId } = req.params;
  
  const {
    verbosity = 'standard',
    include_recommendations = 'true',
    focus_areas
  } = req.query;

  // Authentication check
  if (!userId) {
    throw new ValidationError('User authentication required');
  }

  const supabase = database.createClient();

  // Verify store exists and check permissions
  const { data: store, error: storeError } = await supabase
    .from('stores')
    .select('id, business_id')
    .eq('id', storeId)
    .single();

  if (storeError || !store) {
    throw new NotFoundError(`Store ${storeId} not found`);
  }

  if (userRole === 'business_account' && userBusinessId !== store.business_id) {
    throw new AuthorizationError('Access denied to this store');
  }

  // Validate verbosity parameter
  const validVerbosity = ['concise', 'standard', 'detailed'];
  const exportVerbosity = validVerbosity.includes(verbosity as string) ? verbosity as any : 'standard';

  // Parse focus areas
  const focusAreas = focus_areas ? (focus_areas as string).split(',').map(f => f.trim()) : undefined;

  // Generate AI context export
  const aiExport = await aiContextExportService.generateAIContextExport(storeId, {
    verbosity: exportVerbosity,
    includeRecommendations: include_recommendations === 'true',
    focusAreas
  });

  res.status(200).json(aiExport);
}));

// GET /business/stores/:storeId/context/summary
router.get('/:storeId/context/summary', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const userRole = req.user?.role;
  const userBusinessId = req.user?.business_id;
  const { storeId } = req.params;

  // Authentication check
  if (!userId) {
    throw new ValidationError('User authentication required');
  }

  const supabase = database.createClient();

  // Verify store exists and check permissions
  const { data: store, error: storeError } = await supabase
    .from('stores')
    .select('id, business_id, name')
    .eq('id', storeId)
    .single();

  if (storeError || !store) {
    throw new NotFoundError(`Store ${storeId} not found`);
  }

  if (userRole === 'business_account' && userBusinessId !== store.business_id) {
    throw new AuthorizationError('Access denied to this store');
  }

  // Get summary from completeness service
  const summary = await contextCompletenessService.getCompletnessSummary(storeId);

  // Add store info to summary
  const response = {
    store_id: storeId,
    store_name: store.name,
    ...summary,
    timestamp: new Date().toISOString()
  };

  res.status(200).json(response);
}));

export { router as getContextRoutes };