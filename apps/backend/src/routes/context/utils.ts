import { Router } from 'express';
import { database } from '@vocilia/database';
import { asyncHandler, ValidationError, NotFoundError, AuthorizationError } from '../../middleware/errorHandler';
import { contextCompletenessService } from '../../services/context/completeness';
import { aiContextExportService } from '../../services/context/ai-export';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

interface CompletenessSection {
  completed: boolean;
  score: number;
  required_fields: string[];
  missing_fields: string[];
  validation_errors: string[];
}

interface CompletenessResponse {
  success: boolean;
  data: {
    store_id: string;
    overall_score: number;
    sections: {
      profile: CompletenessSection;
      personnel: CompletenessSection;
      layout: CompletenessSection;
      inventory: CompletenessSection;
    };
    recommendations: string[];
    critical_missing: string[];
    last_updated: string;
  };
}

interface ExportResponse {
  success: boolean;
  data: {
    store_id: string;
    export_format: string;
    export_timestamp: string;
    completeness_score: number;
    context: any;
    conversation_guidelines?: any;
    talking_points?: string[];
    metadata?: any;
  };
}

// GET /api/business/stores/{storeId}/context/completeness
router.get('/:storeId/context/completeness', authMiddleware(['read_feedback']), asyncHandler(async (req, res) => {
  const { storeId } = req.params;
  const { userRole, userBusinessId } = req.auth!;

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

  try {
    // Calculate completeness using our service
    const completenessData = await contextCompletenessService.calculateCompleteness(storeId);
    
    // Format response to match contract
    const response: CompletenessResponse = {
      success: true,
      data: {
        store_id: storeId,
        overall_score: completenessData.overallScore,
        sections: {
          profile: {
            completed: completenessData.sectionScores.profile >= 80,
            score: completenessData.sectionScores.profile,
            required_fields: ['storeType', 'squareFootage', 'departmentCount', 'layoutType', 'address'],
            missing_fields: completenessData.missingCriticalItems.filter(item => item.startsWith('profile.')),
            validation_errors: []
          },
          personnel: {
            completed: completenessData.sectionScores.personnel >= 80,
            score: completenessData.sectionScores.personnel,
            required_fields: ['totalStaffCount', 'managerName', 'customerServicePoints'],
            missing_fields: completenessData.missingCriticalItems.filter(item => item.startsWith('personnel.')),
            validation_errors: []
          },
          layout: {
            completed: completenessData.sectionScores.layout >= 80,
            score: completenessData.sectionScores.layout,
            required_fields: ['entranceCount', 'exitCount', 'customerFlowPattern', 'checkoutLocations'],
            missing_fields: completenessData.missingCriticalItems.filter(item => item.startsWith('layout.')),
            validation_errors: []
          },
          inventory: {
            completed: completenessData.sectionScores.inventory >= 80,
            score: completenessData.sectionScores.inventory,
            required_fields: ['primaryCategories', 'paymentMethods', 'priceRange', 'brandFocus'],
            missing_fields: completenessData.missingCriticalItems.filter(item => item.startsWith('inventory.')),
            validation_errors: []
          }
        },
        recommendations: completenessData.recommendations,
        critical_missing: completenessData.missingCriticalItems,
        last_updated: new Date().toISOString()
      }
    };

    res.status(200).json(response);
  } catch (error) {
    // Return empty completeness if no context exists yet
    const response: CompletenessResponse = {
      success: true,
      data: {
        store_id: storeId,
        overall_score: 0,
        sections: {
          profile: {
            completed: false,
            score: 0,
            required_fields: ['storeType', 'squareFootage', 'departmentCount', 'layoutType', 'address'],
            missing_fields: ['profile.storeType', 'profile.squareFootage', 'profile.departmentCount', 'profile.layoutType', 'profile.address'],
            validation_errors: []
          },
          personnel: {
            completed: false,
            score: 0,
            required_fields: ['totalStaffCount', 'managerName', 'customerServicePoints'],
            missing_fields: ['personnel.totalStaffCount', 'personnel.managerName', 'personnel.customerServicePoints'],
            validation_errors: []
          },
          layout: {
            completed: false,
            score: 0,
            required_fields: ['entranceCount', 'exitCount', 'customerFlowPattern', 'checkoutLocations'],
            missing_fields: ['layout.entranceCount', 'layout.exitCount', 'layout.customerFlowPattern', 'layout.checkoutLocations'],
            validation_errors: []
          },
          inventory: {
            completed: false,
            score: 0,
            required_fields: ['primaryCategories', 'paymentMethods', 'priceRange', 'brandFocus'],
            missing_fields: ['inventory.primaryCategories', 'inventory.paymentMethods', 'inventory.priceRange', 'inventory.brandFocus'],
            validation_errors: []
          }
        },
        recommendations: [
          'Complete store profile information to improve AI conversation quality',
          'Add personnel details for better customer service context',
          'Configure store layout for optimal navigation guidance',
          'Set up inventory categories for relevant product discussions'
        ],
        critical_missing: ['context_profile', 'context_personnel', 'context_layout', 'context_inventory'],
        last_updated: new Date().toISOString()
      }
    };

    res.status(200).json(response);
  }
}));

// GET /api/business/stores/{storeId}/context/export
router.get('/:storeId/context/export', authMiddleware(['read_feedback']), asyncHandler(async (req, res) => {
  const { storeId } = req.params;
  const { format = 'structured', verbosity = 'standard' } = req.query;
  const { userRole, userBusinessId } = req.auth!;

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

  try {
    // Generate AI export using our service
    const exportData = await aiContextExportService.generateAIContextExport(
      storeId,
      verbosity as 'concise' | 'standard' | 'detailed'
    );

    // Calculate completeness score
    let completenessScore = 0;
    try {
      const completenessData = await contextCompletenessService.calculateCompleteness(storeId);
      completenessScore = completenessData.overallScore;
    } catch (error) {
      // Keep default 0 if calculation fails
    }

    const response: ExportResponse = {
      success: true,
      data: {
        store_id: storeId,
        export_format: format as string,
        export_timestamp: new Date().toISOString(),
        completeness_score: completenessScore,
        context: exportData.structuredData,
        conversation_guidelines: exportData.conversationGuidelines,
        talking_points: exportData.talkingPoints,
        metadata: {
          export_version: '1.0',
          data_sources: ['store_profile', 'personnel', 'layout', 'inventory'],
          ai_optimization: true,
          verbosity_level: verbosity
        }
      }
    };

    // Set appropriate content type based on format
    if (format === 'narrative') {
      res.setHeader('Content-Type', 'text/plain');
      res.status(200).send(exportData.narrativeDescription);
    } else if (format === 'schema') {
      res.setHeader('Content-Type', 'application/json');
      res.status(200).json({
        ...response,
        schema_definition: exportData.openApiSchema
      });
    } else {
      // Default structured format
      res.setHeader('Content-Type', 'application/json');
      res.status(200).json(response);
    }
  } catch (error) {
    // Return minimal export if no context exists
    const response: ExportResponse = {
      success: true,
      data: {
        store_id: storeId,
        export_format: format as string,
        export_timestamp: new Date().toISOString(),
        completeness_score: 0,
        context: {
          profile: null,
          personnel: null,
          layout: null,
          inventory: null
        },
        conversation_guidelines: {
          tone: 'professional_friendly',
          approach: 'gather_basic_info',
          focus_areas: ['store_identification', 'basic_services']
        },
        talking_points: [
          'Welcome to our customer feedback system',
          'Could you tell us about your shopping experience today?',
          'Any specific department or service you\'d like to comment on?'
        ],
        metadata: {
          export_version: '1.0',
          data_sources: [],
          ai_optimization: false,
          verbosity_level: verbosity,
          note: 'Store context not configured yet'
        }
      }
    };

    res.status(200).json(response);
  }
}));

export default router;