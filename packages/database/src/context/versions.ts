import { supabase } from '../client';
import type {
  ContextVersion,
  CreateContextVersionRequest,
  UpdateContextVersionRequest,
  ContextExport,
  CreateContextExportRequest,
  UpdateContextExportRequest,
  ContextMerge,
  CreateContextMergeRequest,
  UpdateContextMergeRequest,
  ContextValidation,
  CreateContextValidationRequest,
  UpdateContextValidationRequest,
  VersionType,
  AIExportStatus,
  ValidationStatus,
  MergeStatus
} from '@vocilia/types/context/versions';

export class VersionsService {
  // Context Versions Management
  async getContextVersions(storeId: string): Promise<ContextVersion[]> {
    const { data, error } = await supabase
      .from('store_context_versions')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get context versions: ${error.message}`);
    }

    return data;
  }

  async getContextVersion(versionId: string): Promise<ContextVersion | null> {
    const { data, error } = await supabase
      .from('store_context_versions')
      .select('*')
      .eq('id', versionId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get context version: ${error.message}`);
    }

    return data;
  }

  async getCurrentVersion(storeId: string): Promise<ContextVersion | null> {
    const { data, error } = await supabase
      .from('store_context_versions')
      .select('*')
      .eq('store_id', storeId)
      .eq('is_current', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get current version: ${error.message}`);
    }

    return data;
  }

  async createContextVersion(storeId: string, versionData: CreateContextVersionRequest): Promise<ContextVersion> {
    // If this is being set as current, update the previous current version
    if (versionData.is_current) {
      await this.unsetCurrentVersion(storeId);
    }

    const { data, error } = await supabase
      .from('store_context_versions')
      .insert({
        store_id: storeId,
        ...versionData
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create context version: ${error.message}`);
    }

    return data;
  }

  async updateContextVersion(versionId: string, versionData: UpdateContextVersionRequest): Promise<ContextVersion> {
    // If this is being set as current, update the previous current version
    if (versionData.is_current) {
      const version = await this.getContextVersion(versionId);
      if (version) {
        await this.unsetCurrentVersion(version.store_id);
      }
    }

    const { data, error } = await supabase
      .from('store_context_versions')
      .update({
        ...versionData,
        updated_at: new Date().toISOString()
      })
      .eq('id', versionId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update context version: ${error.message}`);
    }

    return data;
  }

  async deleteContextVersion(versionId: string): Promise<void> {
    const { error } = await supabase
      .from('store_context_versions')
      .delete()
      .eq('id', versionId);

    if (error) {
      throw new Error(`Failed to delete context version: ${error.message}`);
    }
  }

  private async unsetCurrentVersion(storeId: string): Promise<void> {
    const { error } = await supabase
      .from('store_context_versions')
      .update({ is_current: false })
      .eq('store_id', storeId)
      .eq('is_current', true);

    if (error) {
      throw new Error(`Failed to unset current version: ${error.message}`);
    }
  }

  // Context Exports Management
  async getContextExports(storeId: string): Promise<ContextExport[]> {
    const { data, error } = await supabase
      .from('store_context_exports')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get context exports: ${error.message}`);
    }

    return data;
  }

  async getContextExport(exportId: string): Promise<ContextExport | null> {
    const { data, error } = await supabase
      .from('store_context_exports')
      .select('*')
      .eq('id', exportId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get context export: ${error.message}`);
    }

    return data;
  }

  async createContextExport(storeId: string, exportData: CreateContextExportRequest): Promise<ContextExport> {
    const { data, error } = await supabase
      .from('store_context_exports')
      .insert({
        store_id: storeId,
        ...exportData
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create context export: ${error.message}`);
    }

    return data;
  }

  async updateContextExport(exportId: string, exportData: UpdateContextExportRequest): Promise<ContextExport> {
    const { data, error } = await supabase
      .from('store_context_exports')
      .update({
        ...exportData,
        updated_at: new Date().toISOString()
      })
      .eq('id', exportId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update context export: ${error.message}`);
    }

    return data;
  }

  async deleteContextExport(exportId: string): Promise<void> {
    const { error } = await supabase
      .from('store_context_exports')
      .delete()
      .eq('id', exportId);

    if (error) {
      throw new Error(`Failed to delete context export: ${error.message}`);
    }
  }

  // Context Merges Management
  async getContextMerges(storeId: string): Promise<ContextMerge[]> {
    const { data, error } = await supabase
      .from('store_context_merges')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get context merges: ${error.message}`);
    }

    return data;
  }

  async getContextMerge(mergeId: string): Promise<ContextMerge | null> {
    const { data, error } = await supabase
      .from('store_context_merges')
      .select('*')
      .eq('id', mergeId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get context merge: ${error.message}`);
    }

    return data;
  }

  async createContextMerge(storeId: string, mergeData: CreateContextMergeRequest): Promise<ContextMerge> {
    const { data, error } = await supabase
      .from('store_context_merges')
      .insert({
        store_id: storeId,
        ...mergeData
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create context merge: ${error.message}`);
    }

    return data;
  }

  async updateContextMerge(mergeId: string, mergeData: UpdateContextMergeRequest): Promise<ContextMerge> {
    const { data, error } = await supabase
      .from('store_context_merges')
      .update({
        ...mergeData,
        updated_at: new Date().toISOString()
      })
      .eq('id', mergeId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update context merge: ${error.message}`);
    }

    return data;
  }

  async deleteContextMerge(mergeId: string): Promise<void> {
    const { error } = await supabase
      .from('store_context_merges')
      .delete()
      .eq('id', mergeId);

    if (error) {
      throw new Error(`Failed to delete context merge: ${error.message}`);
    }
  }

  // Context Validations Management
  async getContextValidations(storeId: string): Promise<ContextValidation[]> {
    const { data, error } = await supabase
      .from('store_context_validations')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get context validations: ${error.message}`);
    }

    return data;
  }

  async getContextValidation(validationId: string): Promise<ContextValidation | null> {
    const { data, error } = await supabase
      .from('store_context_validations')
      .select('*')
      .eq('id', validationId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get context validation: ${error.message}`);
    }

    return data;
  }

  async createContextValidation(storeId: string, validationData: CreateContextValidationRequest): Promise<ContextValidation> {
    const { data, error } = await supabase
      .from('store_context_validations')
      .insert({
        store_id: storeId,
        ...validationData
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create context validation: ${error.message}`);
    }

    return data;
  }

  async updateContextValidation(validationId: string, validationData: UpdateContextValidationRequest): Promise<ContextValidation> {
    const { data, error } = await supabase
      .from('store_context_validations')
      .update({
        ...validationData,
        updated_at: new Date().toISOString()
      })
      .eq('id', validationId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update context validation: ${error.message}`);
    }

    return data;
  }

  async deleteContextValidation(validationId: string): Promise<void> {
    const { error } = await supabase
      .from('store_context_validations')
      .delete()
      .eq('id', validationId);

    if (error) {
      throw new Error(`Failed to delete context validation: ${error.message}`);
    }
  }

  // Version Comparison and Analysis
  async compareVersions(version1Id: string, version2Id: string): Promise<{
    differences: {
      field: string;
      version1Value: any;
      version2Value: any;
      changeType: 'added' | 'removed' | 'modified';
    }[];
    completenessComparison: {
      version1: number;
      version2: number;
      change: number;
    };
  }> {
    const [version1, version2] = await Promise.all([
      this.getContextVersion(version1Id),
      this.getContextVersion(version2Id)
    ]);

    if (!version1 || !version2) {
      throw new Error('One or both versions not found');
    }

    const differences: any[] = [];
    const fields = ['changes_summary', 'completeness_score', 'validation_notes'];

    fields.forEach(field => {
      const val1 = version1[field as keyof ContextVersion];
      const val2 = version2[field as keyof ContextVersion];

      if (val1 !== val2) {
        let changeType: 'added' | 'removed' | 'modified' = 'modified';
        if (val1 === null && val2 !== null) changeType = 'added';
        if (val1 !== null && val2 === null) changeType = 'removed';

        differences.push({
          field,
          version1Value: val1,
          version2Value: val2,
          changeType
        });
      }
    });

    return {
      differences,
      completenessComparison: {
        version1: version1.completeness_score || 0,
        version2: version2.completeness_score || 0,
        change: (version2.completeness_score || 0) - (version1.completeness_score || 0)
      }
    };
  }

  // AI Export Functionality
  async generateAIExport(storeId: string, versionId?: string): Promise<ContextExport> {
    const targetVersion = versionId 
      ? await this.getContextVersion(versionId)
      : await this.getCurrentVersion(storeId);

    if (!targetVersion) {
      throw new Error('No version found for AI export');
    }

    // Call the database function to get context summary
    const { data: contextSummary, error } = await supabase
      .rpc('get_context_summary_for_ai', { 
        target_store_id: storeId 
      });

    if (error) {
      throw new Error(`Failed to generate context summary: ${error.message}`);
    }

    // Create the export record
    const exportData: CreateContextExportRequest = {
      version_id: targetVersion.id,
      ai_export_status: 'processing',
      export_data: contextSummary,
      export_format: 'ai_training',
      export_purpose: 'AI model training and context understanding'
    };

    const contextExport = await this.createContextExport(storeId, exportData);

    // Update status to completed
    await this.updateContextExport(contextExport.id, {
      ai_export_status: 'completed',
      completed_at: new Date().toISOString()
    });

    return contextExport;
  }

  // Version Statistics
  async getVersionStatistics(storeId: string): Promise<{
    totalVersions: number;
    currentVersion: ContextVersion | null;
    completenessProgress: { version: string; score: number; date: string }[];
    exportCount: number;
    mergeCount: number;
    validationCount: number;
    averageCompleteness: number;
  }> {
    const [versions, exports, merges, validations] = await Promise.all([
      this.getContextVersions(storeId),
      this.getContextExports(storeId),
      this.getContextMerges(storeId),
      this.getContextValidations(storeId)
    ]);

    const currentVersion = versions.find(v => v.is_current) || null;

    const completenessProgress = versions
      .filter(v => v.completeness_score !== null)
      .map(v => ({
        version: v.version_number,
        score: v.completeness_score!,
        date: v.created_at
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const validScores = versions
      .filter(v => v.completeness_score !== null)
      .map(v => v.completeness_score!);

    const averageCompleteness = validScores.length > 0
      ? validScores.reduce((sum, score) => sum + score, 0) / validScores.length
      : 0;

    return {
      totalVersions: versions.length,
      currentVersion,
      completenessProgress,
      exportCount: exports.length,
      mergeCount: merges.length,
      validationCount: validations.length,
      averageCompleteness: Math.round(averageCompleteness)
    };
  }

  // Helper Methods
  async createSnapshot(storeId: string, description: string): Promise<ContextVersion> {
    // Get current completeness score
    const { data: completenessData, error } = await supabase
      .rpc('get_context_completeness_score', { 
        target_store_id: storeId 
      });

    if (error) {
      throw new Error(`Failed to get completeness score: ${error.message}`);
    }

    const completenessScore = completenessData || 0;

    // Get the next version number
    const versions = await this.getContextVersions(storeId);
    const nextVersionNumber = `v${versions.length + 1}`;

    return this.createContextVersion(storeId, {
      version_number: nextVersionNumber,
      version_type: 'snapshot',
      changes_summary: description,
      completeness_score: completenessScore,
      is_current: true
    });
  }

  async validateContextIntegrity(storeId: string): Promise<ContextValidation> {
    // Call the database function to validate context
    const { data: validationResult, error } = await supabase
      .rpc('validate_context_integrity', { 
        target_store_id: storeId 
      });

    if (error) {
      throw new Error(`Failed to validate context integrity: ${error.message}`);
    }

    const validationData: CreateContextValidationRequest = {
      validation_type: 'integrity_check',
      validation_status: validationResult.is_valid ? 'passed' : 'failed',
      validation_results: validationResult,
      validation_notes: validationResult.summary || 'Automated integrity validation'
    };

    return this.createContextValidation(storeId, validationData);
  }

  async getExportsByStatus(storeId: string, status: AIExportStatus): Promise<ContextExport[]> {
    const { data, error } = await supabase
      .from('store_context_exports')
      .select('*')
      .eq('store_id', storeId)
      .eq('ai_export_status', status)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get exports by status: ${error.message}`);
    }

    return data;
  }

  async getMergesByStatus(storeId: string, status: MergeStatus): Promise<ContextMerge[]> {
    const { data, error } = await supabase
      .from('store_context_merges')
      .select('*')
      .eq('store_id', storeId)
      .eq('merge_status', status)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get merges by status: ${error.message}`);
    }

    return data;
  }

  async getValidationsByStatus(storeId: string, status: ValidationStatus): Promise<ContextValidation[]> {
    const { data, error } = await supabase
      .from('store_context_validations')
      .select('*')
      .eq('store_id', storeId)
      .eq('validation_status', status)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get validations by status: ${error.message}`);
    }

    return data;
  }
}

export const versionsService = new VersionsService();