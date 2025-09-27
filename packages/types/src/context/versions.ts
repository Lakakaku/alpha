// Context versioning types for business context window feature

export interface ContextVersion {
  id: string;
  store_id: string;
  version_number: number;
  version_type: VersionType;
  description: string;
  created_by: string;
  created_at: string;
  is_current: boolean;
  changes_summary: ChangesSummary;
  metadata: VersionMetadata;
  ai_export_status: AIExportStatus;
  validation_status: ValidationStatus;
}

export interface CreateContextVersionRequest {
  version_type: VersionType;
  description: string;
  changes_summary: ChangesSummary;
  metadata: VersionMetadata;
}

export interface UpdateContextVersionRequest {
  description?: string;
  is_current?: boolean;
  ai_export_status?: AIExportStatus;
  validation_status?: ValidationStatus;
}

export enum VersionType {
  MANUAL = 'manual',           // User-initiated version creation
  AUTOMATIC = 'automatic',     // System-generated version
  SCHEDULED = 'scheduled',     // Scheduled version creation
  MILESTONE = 'milestone',     // Important milestone version
  BACKUP = 'backup',          // Backup before major changes
  ROLLBACK = 'rollback'       // Rollback to previous version
}

export interface ChangesSummary {
  total_changes: number;
  section_changes: SectionChange[];
  change_impact: ChangeImpact;
  breaking_changes: boolean;
  validation_required: boolean;
}

export interface SectionChange {
  section: ContextSection;
  change_type: SectionChangeType;
  field_changes: FieldChange[];
  impact_level: ImpactLevel;
}

export enum ContextSection {
  PROFILE = 'profile',
  PERSONNEL = 'personnel',
  LAYOUT = 'layout',
  INVENTORY = 'inventory',
  OPERATING_HOURS = 'operating_hours'
}

export enum SectionChangeType {
  CREATED = 'created',
  UPDATED = 'updated',
  DELETED = 'deleted',
  RESTRUCTURED = 'restructured',
  MERGED = 'merged',
  SPLIT = 'split'
}

export interface FieldChange {
  field_name: string;
  field_path: string;
  change_type: FieldChangeType;
  old_value?: any;
  new_value?: any;
  validation_impact: ValidationImpact;
}

export enum FieldChangeType {
  ADDED = 'added',
  MODIFIED = 'modified',
  REMOVED = 'removed',
  RENAMED = 'renamed',
  TYPE_CHANGED = 'type_changed'
}

export enum ValidationImpact {
  NONE = 'none',
  MINOR = 'minor',
  MODERATE = 'moderate',
  MAJOR = 'major',
  CRITICAL = 'critical'
}

export enum ImpactLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ChangeImpact {
  MINIMAL = 'minimal',           // <5% of context changed
  MINOR = 'minor',               // 5-15% of context changed
  MODERATE = 'moderate',         // 15-30% of context changed
  MAJOR = 'major',               // 30-60% of context changed
  SUBSTANTIAL = 'substantial',   // 60-80% of context changed
  COMPLETE_OVERHAUL = 'complete_overhaul' // >80% of context changed
}

export interface VersionMetadata {
  trigger: VersionTrigger;
  auto_generated: boolean;
  parent_version_id?: string;
  merge_source_versions?: string[];
  tags: string[];
  notes: string;
  approval_required: boolean;
  approved_by?: string;
  approved_at?: string;
  rollback_eligible: boolean;
  backup_location?: string;
}

export enum VersionTrigger {
  USER_SAVE = 'user_save',
  SCHEDULED_BACKUP = 'scheduled_backup',
  MAJOR_UPDATE = 'major_update',
  SYSTEM_MAINTENANCE = 'system_maintenance',
  AI_OPTIMIZATION = 'ai_optimization',
  DATA_MIGRATION = 'data_migration',
  ROLLBACK_OPERATION = 'rollback_operation',
  MERGE_OPERATION = 'merge_operation'
}

export enum AIExportStatus {
  PENDING = 'pending',           // Not yet exported to AI
  IN_PROGRESS = 'in_progress',   // Currently being exported
  COMPLETED = 'completed',       // Successfully exported
  FAILED = 'failed',             // Export failed
  PARTIAL = 'partial',           // Partially exported
  OUTDATED = 'outdated',         // Newer version available
  DISABLED = 'disabled'          // Export disabled for this version
}

export enum ValidationStatus {
  PENDING = 'pending',           // Validation not yet performed
  IN_PROGRESS = 'in_progress',   // Currently being validated
  VALID = 'valid',               // All validations passed
  INVALID = 'invalid',           // Validation errors found
  WARNING = 'warning',           // Validation warnings present
  INCOMPLETE = 'incomplete',     // Required fields missing
  CONFLICTED = 'conflicted'      // Data conflicts detected
}

export interface ContextComparison {
  version_a_id: string;
  version_b_id: string;
  comparison_type: ComparisonType;
  differences: ContextDifference[];
  similarity_score: number; // 0-100 percentage
  change_summary: ComparisonSummary;
  generated_at: string;
}

export interface CreateContextComparisonRequest {
  version_a_id: string;
  version_b_id: string;
  comparison_type: ComparisonType;
  include_metadata: boolean;
}

export enum ComparisonType {
  FULL = 'full',                 // Compare all sections
  SELECTIVE = 'selective',       // Compare specific sections
  SUMMARY_ONLY = 'summary_only', // High-level comparison
  DETAILED = 'detailed',         // Detailed field-by-field
  IMPACT_FOCUSED = 'impact_focused' // Focus on impactful changes
}

export interface ContextDifference {
  section: ContextSection;
  path: string;
  difference_type: DifferenceType;
  version_a_value?: any;
  version_b_value?: any;
  impact_assessment: ImpactAssessment;
  recommendation?: string;
}

export enum DifferenceType {
  ADDED_IN_B = 'added_in_b',
  REMOVED_IN_B = 'removed_in_b',
  MODIFIED = 'modified',
  TYPE_CHANGED = 'type_changed',
  STRUCTURE_CHANGED = 'structure_changed',
  ORDER_CHANGED = 'order_changed'
}

export interface ImpactAssessment {
  ai_training_impact: AITrainingImpact;
  customer_experience_impact: CustomerExperienceImpact;
  operational_impact: OperationalImpact;
  data_quality_impact: DataQualityImpact;
}

export enum AITrainingImpact {
  NONE = 'none',
  MINOR_IMPROVEMENT = 'minor_improvement',
  MODERATE_IMPROVEMENT = 'moderate_improvement',
  SIGNIFICANT_IMPROVEMENT = 'significant_improvement',
  POTENTIAL_DEGRADATION = 'potential_degradation',
  REQUIRES_RETRAINING = 'requires_retraining'
}

export enum CustomerExperienceImpact {
  NONE = 'none',
  MINOR_IMPROVEMENT = 'minor_improvement',
  MODERATE_IMPROVEMENT = 'moderate_improvement',
  SIGNIFICANT_IMPROVEMENT = 'significant_improvement',
  POTENTIAL_NEGATIVE = 'potential_negative',
  MAJOR_NEGATIVE = 'major_negative'
}

export enum OperationalImpact {
  NONE = 'none',
  EFFICIENCY_GAIN = 'efficiency_gain',
  PROCESS_IMPROVEMENT = 'process_improvement',
  TRAINING_REQUIRED = 'training_required',
  WORKFLOW_DISRUPTION = 'workflow_disruption',
  SYSTEM_CHANGES_NEEDED = 'system_changes_needed'
}

export enum DataQualityImpact {
  NONE = 'none',
  IMPROVED_ACCURACY = 'improved_accuracy',
  IMPROVED_COMPLETENESS = 'improved_completeness',
  IMPROVED_CONSISTENCY = 'improved_consistency',
  POTENTIAL_INCONSISTENCY = 'potential_inconsistency',
  DATA_LOSS_RISK = 'data_loss_risk'
}

export interface ComparisonSummary {
  total_differences: number;
  critical_differences: number;
  sections_affected: ContextSection[];
  recommendation: ComparisonRecommendation;
  rollback_recommended: boolean;
  approval_required: boolean;
}

export enum ComparisonRecommendation {
  APPROVE_CHANGES = 'approve_changes',
  REVIEW_REQUIRED = 'review_required',
  MODIFICATIONS_NEEDED = 'modifications_needed',
  REJECT_CHANGES = 'reject_changes',
  GRADUAL_ROLLOUT = 'gradual_rollout',
  ROLLBACK_RECOMMENDED = 'rollback_recommended'
}

export interface VersionHistory {
  store_id: string;
  versions: ContextVersionSummary[];
  total_versions: number;
  current_version_id: string;
  last_major_update: string;
  version_retention_policy: VersionRetentionPolicy;
  backup_schedule: BackupSchedule;
}

export interface ContextVersionSummary {
  id: string;
  version_number: number;
  version_type: VersionType;
  created_at: string;
  created_by: string;
  is_current: boolean;
  change_impact: ChangeImpact;
  ai_export_status: AIExportStatus;
  validation_status: ValidationStatus;
  tags: string[];
  description: string;
}

export interface VersionRetentionPolicy {
  max_versions: number;
  retention_period_days: number;
  milestone_retention: MilestoneRetention;
  automatic_cleanup: boolean;
  backup_before_cleanup: boolean;
}

export enum MilestoneRetention {
  INDEFINITE = 'indefinite',
  EXTENDED = 'extended',        // 2x normal retention
  NORMAL = 'normal',
  MINIMAL = 'minimal'           // 0.5x normal retention
}

export interface BackupSchedule {
  enabled: boolean;
  frequency: BackupFrequency;
  retention_count: number;
  include_ai_exports: boolean;
  compress_backups: boolean;
  notify_on_backup: boolean;
}

export enum BackupFrequency {
  DISABLED = 'disabled',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  ON_CHANGE = 'on_change',
  CUSTOM = 'custom'
}

export interface ContextExport {
  id: string;
  version_id: string;
  export_type: ExportType;
  export_format: ExportFormat;
  export_status: ExportStatus;
  export_data: ContextExportData;
  ai_optimization: AIOptimization;
  generated_at: string;
  expires_at?: string;
  download_count: number;
  file_size_bytes: number;
}

export interface CreateContextExportRequest {
  version_id: string;
  export_type: ExportType;
  export_format: ExportFormat;
  include_sections: ContextSection[];
  ai_optimization: AIOptimization;
  export_settings: ExportSettings;
}

export enum ExportType {
  AI_TRAINING = 'ai_training',   // Optimized for AI training
  HUMAN_READABLE = 'human_readable', // Formatted for human review
  DATA_BACKUP = 'data_backup',   // Complete data backup
  ANALYTICS = 'analytics',       // For analytics and reporting
  INTEGRATION = 'integration',   // For system integration
  AUDIT = 'audit'               // For audit and compliance
}

export enum ExportFormat {
  JSON = 'json',
  XML = 'xml',
  CSV = 'csv',
  PDF = 'pdf',
  MARKDOWN = 'markdown',
  YAML = 'yaml',
  EXCEL = 'excel'
}

export enum ExportStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled'
}

export interface ContextExportData {
  sections_included: ContextSection[];
  total_fields: number;
  completeness_score: number;
  data_quality_score: number;
  ai_readiness_score: number;
  export_metadata: ExportMetadata;
}

export interface ExportMetadata {
  store_context_summary: string;
  key_characteristics: string[];
  ai_training_notes: string[];
  data_quality_notes: string[];
  export_optimizations: string[];
  version_info: VersionInfo;
}

export interface VersionInfo {
  version_number: number;
  version_date: string;
  changes_since_last_export: number;
  data_freshness_score: number;
}

export interface AIOptimization {
  enabled: boolean;
  optimization_level: OptimizationLevel;
  target_ai_model: TargetAIModel;
  context_compression: boolean;
  remove_redundancy: boolean;
  enhance_relationships: boolean;
  add_inference_hints: boolean;
}

export enum OptimizationLevel {
  NONE = 'none',
  BASIC = 'basic',
  STANDARD = 'standard',
  ADVANCED = 'advanced',
  MAXIMUM = 'maximum'
}

export enum TargetAIModel {
  GENERAL_PURPOSE = 'general_purpose',
  CONVERSATION_AI = 'conversation_ai',
  RECOMMENDATION_ENGINE = 'recommendation_engine',
  SENTIMENT_ANALYSIS = 'sentiment_analysis',
  CUSTOM_MODEL = 'custom_model'
}

export interface ExportSettings {
  include_metadata: boolean;
  include_version_history: boolean;
  include_validation_results: boolean;
  compress_output: boolean;
  secure_export: boolean;
  password_protect: boolean;
  expiration_hours: number;
}

export interface ContextMerge {
  id: string;
  source_version_ids: string[];
  target_version_id: string;
  merge_strategy: MergeStrategy;
  merge_rules: MergeRule[];
  conflict_resolution: ConflictResolution[];
  merge_status: MergeStatus;
  result_version_id?: string;
  created_at: string;
  completed_at?: string;
  created_by: string;
}

export interface CreateContextMergeRequest {
  source_version_ids: string[];
  target_version_id: string;
  merge_strategy: MergeStrategy;
  merge_rules: MergeRule[];
  conflict_resolution_strategy: ConflictResolutionStrategy;
}

export enum MergeStrategy {
  UNION = 'union',               // Combine all data
  INTERSECTION = 'intersection', // Keep only common data
  PRIORITIZED = 'prioritized',   // Priority-based merge
  MANUAL = 'manual',             // Manual conflict resolution
  INTELLIGENT = 'intelligent'    // AI-assisted merge
}

export interface MergeRule {
  section: ContextSection;
  field_path?: string;
  rule_type: MergeRuleType;
  priority_source?: string;
  merge_function?: MergeFunction;
}

export enum MergeRuleType {
  TAKE_LATEST = 'take_latest',
  TAKE_PRIORITY = 'take_priority',
  MERGE_VALUES = 'merge_values',
  MANUAL_RESOLVE = 'manual_resolve',
  SKIP_FIELD = 'skip_field'
}

export enum MergeFunction {
  CONCATENATE = 'concatenate',
  AVERAGE = 'average',
  MAXIMUM = 'maximum',
  MINIMUM = 'minimum',
  UNION_ARRAYS = 'union_arrays',
  INTERSECT_ARRAYS = 'intersect_arrays'
}

export interface ConflictResolution {
  field_path: string;
  conflict_type: ConflictType;
  resolution_strategy: ConflictResolutionStrategy;
  chosen_value?: any;
  resolution_notes: string;
}

export enum ConflictType {
  VALUE_MISMATCH = 'value_mismatch',
  TYPE_MISMATCH = 'type_mismatch',
  STRUCTURE_MISMATCH = 'structure_mismatch',
  MISSING_IN_SOURCE = 'missing_in_source',
  MISSING_IN_TARGET = 'missing_in_target'
}

export enum ConflictResolutionStrategy {
  AUTO_LATEST = 'auto_latest',
  AUTO_PRIORITY = 'auto_priority',
  AUTO_INTELLIGENT = 'auto_intelligent',
  MANUAL_REVIEW = 'manual_review',
  SKIP_CONFLICT = 'skip_conflict',
  MERGE_VALUES = 'merge_values'
}

export enum MergeStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  CONFLICTS_DETECTED = 'conflicts_detected',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

// Validation schemas
export interface ContextVersionValidation {
  version_type: {
    required: true;
    enum: VersionType;
  };
  description: {
    required: true;
    minLength: 10;
    maxLength: 500;
  };
  changes_summary: {
    required: true;
  };
}

export interface ContextExportValidation {
  version_id: {
    required: true;
  };
  export_type: {
    required: true;
    enum: ExportType;
  };
  export_format: {
    required: true;
    enum: ExportFormat;
  };
  include_sections: {
    required: true;
    minItems: 1;
  };
}