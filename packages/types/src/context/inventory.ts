// Inventory context types for business context window feature

export interface StoreInventory {
  id: string;
  store_id: string;
  category_structure: InventoryCategory[];
  pricing_strategy: PricingStrategy;
  seasonal_patterns: SeasonalInventoryPattern[];
  supplier_relationships: SupplierRelationship[];
  inventory_management_style: InventoryManagementStyle;
  quality_standards: QualityStandard[];
  customer_preferences: CustomerPreference[];
  competitive_positioning: CompetitivePositioning;
  created_at: string;
  updated_at: string;
  version: number;
}

export interface CreateStoreInventoryRequest {
  category_structure: CreateInventoryCategoryRequest[];
  pricing_strategy: PricingStrategy;
  seasonal_patterns: CreateSeasonalInventoryPatternRequest[];
  supplier_relationships: CreateSupplierRelationshipRequest[];
  inventory_management_style: InventoryManagementStyle;
  quality_standards: CreateQualityStandardRequest[];
  customer_preferences: CreateCustomerPreferenceRequest[];
  competitive_positioning: CompetitivePositioning;
}

export interface UpdateStoreInventoryRequest extends Partial<CreateStoreInventoryRequest> {
  version: number;
}

export interface InventoryCategory {
  id: string;
  inventory_id: string;
  name: string;
  category_type: CategoryType;
  parent_category_id?: string;
  description: string;
  percentage_of_inventory: number;
  average_price_point: number;
  margin_percentage: number;
  turnover_rate: TurnoverRate;
  seasonality: SeasonalityType;
  customer_demand_level: DemandLevel;
  quality_tier: QualityTier;
  brand_positioning: BrandPositioning[];
  stock_levels: StockLevel;
  reorder_frequency: ReorderFrequency;
  shelf_life_considerations: ShelfLifeType;
  display_prominence: DisplayProminence;
  cross_sell_opportunities: string[];
  upsell_opportunities: string[];
  created_at: string;
  updated_at: string;
}

export interface CreateInventoryCategoryRequest {
  name: string;
  category_type: CategoryType;
  parent_category_id?: string;
  description: string;
  percentage_of_inventory: number;
  average_price_point: number;
  margin_percentage: number;
  turnover_rate: TurnoverRate;
  seasonality: SeasonalityType;
  customer_demand_level: DemandLevel;
  quality_tier: QualityTier;
  brand_positioning: BrandPositioning[];
  stock_levels: StockLevel;
  reorder_frequency: ReorderFrequency;
  shelf_life_considerations: ShelfLifeType;
  display_prominence: DisplayProminence;
  cross_sell_opportunities: string[];
  upsell_opportunities: string[];
}

export enum CategoryType {
  PRIMARY = 'primary',           // Main product categories
  SECONDARY = 'secondary',       // Sub-categories
  SEASONAL = 'seasonal',         // Seasonal items
  PROMOTIONAL = 'promotional',   // Special promotions
  CLEARANCE = 'clearance',      // Clearance items
  NEW_ARRIVAL = 'new_arrival',  // New products
  BESTSELLER = 'bestseller',    // Top selling items
  PREMIUM = 'premium',          // High-end products
  BUDGET = 'budget',            // Value-oriented products
  SPECIALTY = 'specialty'       // Unique/niche items
}

export enum TurnoverRate {
  VERY_SLOW = 'very_slow',      // 6+ months
  SLOW = 'slow',                // 3-6 months
  MODERATE = 'moderate',        // 1-3 months
  FAST = 'fast',                // 2-4 weeks
  VERY_FAST = 'very_fast'       // <2 weeks
}

export enum SeasonalityType {
  NON_SEASONAL = 'non_seasonal',
  SPRING = 'spring',
  SUMMER = 'summer',
  FALL = 'fall',
  WINTER = 'winter',
  HOLIDAY = 'holiday',
  BACK_TO_SCHOOL = 'back_to_school',
  VARIABLE = 'variable'
}

export enum DemandLevel {
  LOW = 'low',
  MODERATE = 'moderate',
  HIGH = 'high',
  PEAK = 'peak',
  VARIABLE = 'variable'
}

export enum QualityTier {
  BASIC = 'basic',
  GOOD = 'good',
  BETTER = 'better',
  BEST = 'best',
  LUXURY = 'luxury',
  PREMIUM = 'premium'
}

export enum BrandPositioning {
  VALUE_LEADER = 'value_leader',
  QUALITY_LEADER = 'quality_leader',
  INNOVATION_LEADER = 'innovation_leader',
  SERVICE_LEADER = 'service_leader',
  NICHE_SPECIALIST = 'niche_specialist',
  TRENDSETTER = 'trendsetter',
  RELIABLE_STANDARD = 'reliable_standard',
  LUXURY_PREMIUM = 'luxury_premium'
}

export enum StockLevel {
  OUT_OF_STOCK = 'out_of_stock',
  LOW_STOCK = 'low_stock',
  ADEQUATE_STOCK = 'adequate_stock',
  WELL_STOCKED = 'well_stocked',
  OVERSTOCKED = 'overstocked'
}

export enum ReorderFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  BIWEEKLY = 'biweekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  SEASONALLY = 'seasonally',
  AS_NEEDED = 'as_needed'
}

export enum ShelfLifeType {
  PERISHABLE_DAILY = 'perishable_daily',        // 1-2 days
  PERISHABLE_WEEKLY = 'perishable_weekly',      // 1 week
  PERISHABLE_MONTHLY = 'perishable_monthly',    // 1 month
  SEMI_PERISHABLE = 'semi_perishable',          // 3-6 months
  DURABLE = 'durable',                          // 1+ years
  NON_PERISHABLE = 'non_perishable'            // No expiration
}

export enum DisplayProminence {
  FEATURED = 'featured',           // Prime display locations
  PROMINENT = 'prominent',         // High visibility areas
  STANDARD = 'standard',           // Regular shelf space
  BACK_STOCK = 'back_stock',      // Lower visibility
  STORAGE_ONLY = 'storage_only'    // Not displayed
}

export interface PricingStrategy {
  primary_strategy: PrimaryPricingStrategy;
  competitive_analysis_frequency: AnalysisFrequency;
  price_adjustment_flexibility: PriceFlexibility;
  discount_policies: DiscountPolicy[];
  value_proposition: ValueProposition[];
  price_communication_style: PriceCommunicationStyle;
  psychological_pricing_tactics: PsychologicalPricingTactic[];
}

export enum PrimaryPricingStrategy {
  COST_PLUS = 'cost_plus',
  COMPETITIVE = 'competitive',
  VALUE_BASED = 'value_based',
  PREMIUM = 'premium',
  PENETRATION = 'penetration',
  SKIMMING = 'skimming',
  PSYCHOLOGICAL = 'psychological',
  DYNAMIC = 'dynamic'
}

export enum AnalysisFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  SEASONALLY = 'seasonally',
  ANNUALLY = 'annually'
}

export enum PriceFlexibility {
  FIXED = 'fixed',
  LIMITED = 'limited',
  MODERATE = 'moderate',
  HIGH = 'high',
  DYNAMIC = 'dynamic'
}

export interface DiscountPolicy {
  discount_type: DiscountType;
  frequency: DiscountFrequency;
  typical_percentage: number;
  target_customer_segment: string;
  conditions: string[];
}

export enum DiscountType {
  BULK_DISCOUNT = 'bulk_discount',
  LOYALTY_DISCOUNT = 'loyalty_discount',
  SEASONAL_SALE = 'seasonal_sale',
  CLEARANCE = 'clearance',
  NEW_CUSTOMER = 'new_customer',
  PROMOTIONAL = 'promotional',
  EMPLOYEE_DISCOUNT = 'employee_discount',
  SENIOR_DISCOUNT = 'senior_discount'
}

export enum DiscountFrequency {
  NEVER = 'never',
  RARELY = 'rarely',
  OCCASIONALLY = 'occasionally',
  REGULARLY = 'regularly',
  FREQUENTLY = 'frequently',
  CONSTANTLY = 'constantly'
}

export enum ValueProposition {
  LOWEST_PRICE = 'lowest_price',
  BEST_VALUE = 'best_value',
  HIGHEST_QUALITY = 'highest_quality',
  BEST_SERVICE = 'best_service',
  MOST_CONVENIENT = 'most_convenient',
  MOST_UNIQUE = 'most_unique',
  MOST_RELIABLE = 'most_reliable',
  MOST_INNOVATIVE = 'most_innovative'
}

export enum PriceCommunicationStyle {
  TRANSPARENT = 'transparent',
  PROMOTIONAL = 'promotional',
  VALUE_FOCUSED = 'value_focused',
  QUALITY_JUSTIFIED = 'quality_justified',
  COMPETITIVE = 'competitive',
  PREMIUM_POSITIONING = 'premium_positioning'
}

export enum PsychologicalPricingTactic {
  CHARM_PRICING = 'charm_pricing',        // $9.99
  BUNDLE_PRICING = 'bundle_pricing',
  ANCHOR_PRICING = 'anchor_pricing',
  DECOY_PRICING = 'decoy_pricing',
  PRESTIGE_PRICING = 'prestige_pricing',
  LOSS_LEADER = 'loss_leader',
  TIERED_PRICING = 'tiered_pricing'
}

export interface SeasonalInventoryPattern {
  id: string;
  inventory_id: string;
  season_name: string;
  start_date: string; // MM-DD format
  end_date: string;   // MM-DD format
  inventory_changes: SeasonalInventoryChange[];
  demand_patterns: SeasonalDemandPattern[];
  pricing_adjustments: SeasonalPricingAdjustment[];
  created_at: string;
  updated_at: string;
}

export interface CreateSeasonalInventoryPatternRequest {
  season_name: string;
  start_date: string;
  end_date: string;
  inventory_changes: SeasonalInventoryChange[];
  demand_patterns: SeasonalDemandPattern[];
  pricing_adjustments: SeasonalPricingAdjustment[];
}

export interface SeasonalInventoryChange {
  category_name: string;
  change_type: SeasonalChangeType;
  percentage_change: number;
  new_items_introduced: string[];
  items_discontinued: string[];
}

export enum SeasonalChangeType {
  INCREASE = 'increase',
  DECREASE = 'decrease',
  REPLACE = 'replace',
  ADD_NEW = 'add_new',
  TEMPORARY_ADDITION = 'temporary_addition'
}

export interface SeasonalDemandPattern {
  category_name: string;
  demand_multiplier: number; // 1.0 = normal, >1.0 = higher, <1.0 = lower
  peak_period: string;
  demand_variability: DemandVariability;
}

export enum DemandVariability {
  VERY_STABLE = 'very_stable',
  STABLE = 'stable',
  MODERATE = 'moderate',
  VARIABLE = 'variable',
  HIGHLY_VARIABLE = 'highly_variable'
}

export interface SeasonalPricingAdjustment {
  category_name: string;
  adjustment_type: PriceAdjustmentType;
  percentage_change: number;
  timing: PriceAdjustmentTiming;
}

export enum PriceAdjustmentType {
  MARKUP = 'markup',
  MARKDOWN = 'markdown',
  PROMOTIONAL = 'promotional',
  CLEARANCE = 'clearance'
}

export enum PriceAdjustmentTiming {
  BEGINNING = 'beginning',
  MIDDLE = 'middle',
  END = 'end',
  THROUGHOUT = 'throughout'
}

export interface SupplierRelationship {
  id: string;
  inventory_id: string;
  supplier_name: string;
  relationship_type: SupplierRelationshipType;
  categories_supplied: string[];
  reliability_rating: ReliabilityRating;
  quality_rating: QualityRating;
  price_competitiveness: PriceCompetitiveness;
  payment_terms: PaymentTerms;
  delivery_frequency: DeliveryFrequency;
  minimum_order_requirements: MinimumOrderRequirement;
  exclusive_arrangements: boolean;
  sustainability_practices: SustainabilityPractice[];
  innovation_collaboration: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateSupplierRelationshipRequest {
  supplier_name: string;
  relationship_type: SupplierRelationshipType;
  categories_supplied: string[];
  reliability_rating: ReliabilityRating;
  quality_rating: QualityRating;
  price_competitiveness: PriceCompetitiveness;
  payment_terms: PaymentTerms;
  delivery_frequency: DeliveryFrequency;
  minimum_order_requirements: MinimumOrderRequirement;
  exclusive_arrangements: boolean;
  sustainability_practices: SustainabilityPractice[];
  innovation_collaboration: boolean;
}

export enum SupplierRelationshipType {
  PRIMARY = 'primary',
  SECONDARY = 'secondary',
  BACKUP = 'backup',
  EXCLUSIVE = 'exclusive',
  PREFERRED = 'preferred',
  TRANSACTIONAL = 'transactional',
  STRATEGIC_PARTNER = 'strategic_partner'
}

export enum ReliabilityRating {
  POOR = 'poor',
  FAIR = 'fair',
  GOOD = 'good',
  VERY_GOOD = 'very_good',
  EXCELLENT = 'excellent'
}

export enum QualityRating {
  POOR = 'poor',
  FAIR = 'fair',
  GOOD = 'good',
  VERY_GOOD = 'very_good',
  EXCELLENT = 'excellent'
}

export enum PriceCompetitiveness {
  EXPENSIVE = 'expensive',
  ABOVE_MARKET = 'above_market',
  MARKET_RATE = 'market_rate',
  BELOW_MARKET = 'below_market',
  VERY_COMPETITIVE = 'very_competitive'
}

export interface PaymentTerms {
  days: number;
  discount_percentage?: number;
  early_payment_discount_days?: number;
  payment_method: PaymentMethod;
}

export enum PaymentMethod {
  NET = 'net',
  COD = 'cod',
  CREDIT_CARD = 'credit_card',
  BANK_TRANSFER = 'bank_transfer',
  CHECK = 'check'
}

export enum DeliveryFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  BIWEEKLY = 'biweekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  AS_NEEDED = 'as_needed'
}

export interface MinimumOrderRequirement {
  has_minimum: boolean;
  minimum_amount?: number;
  minimum_quantity?: number;
  minimum_type?: MinimumOrderType;
}

export enum MinimumOrderType {
  DOLLAR_AMOUNT = 'dollar_amount',
  QUANTITY = 'quantity',
  WEIGHT = 'weight',
  VOLUME = 'volume'
}

export enum SustainabilityPractice {
  ORGANIC = 'organic',
  FAIR_TRADE = 'fair_trade',
  LOCAL_SOURCING = 'local_sourcing',
  CARBON_NEUTRAL = 'carbon_neutral',
  RECYCLABLE_PACKAGING = 'recyclable_packaging',
  ETHICAL_LABOR = 'ethical_labor',
  RENEWABLE_ENERGY = 'renewable_energy'
}

export interface InventoryManagementStyle {
  ordering_approach: OrderingApproach;
  stock_level_strategy: StockLevelStrategy;
  demand_forecasting_method: DemandForecastingMethod;
  inventory_tracking_precision: TrackingPrecision;
  waste_management_approach: WasteManagementApproach;
  technology_usage: InventoryTechnology[];
}

export enum OrderingApproach {
  JUST_IN_TIME = 'just_in_time',
  BULK_ORDERING = 'bulk_ordering',
  REGULAR_SCHEDULE = 'regular_schedule',
  DEMAND_DRIVEN = 'demand_driven',
  SEASONAL_PREPARATION = 'seasonal_preparation',
  OPPORTUNISTIC = 'opportunistic'
}

export enum StockLevelStrategy {
  MINIMAL_INVENTORY = 'minimal_inventory',
  ADEQUATE_BUFFER = 'adequate_buffer',
  GENEROUS_SAFETY_STOCK = 'generous_safety_stock',
  CATEGORY_SPECIFIC = 'category_specific',
  DYNAMIC_ADJUSTMENT = 'dynamic_adjustment'
}

export enum DemandForecastingMethod {
  HISTORICAL_DATA = 'historical_data',
  TREND_ANALYSIS = 'trend_analysis',
  SEASONAL_PATTERNS = 'seasonal_patterns',
  MARKET_RESEARCH = 'market_research',
  SUPPLIER_INSIGHTS = 'supplier_insights',
  INTUITION_EXPERIENCE = 'intuition_experience',
  AUTOMATED_ANALYTICS = 'automated_analytics'
}

export enum TrackingPrecision {
  MANUAL_ESTIMATES = 'manual_estimates',
  PERIODIC_COUNTS = 'periodic_counts',
  REGULAR_AUDITS = 'regular_audits',
  REAL_TIME_TRACKING = 'real_time_tracking',
  AUTOMATED_SYSTEMS = 'automated_systems'
}

export enum WasteManagementApproach {
  MINIMIZE_ORDERING = 'minimize_ordering',
  DISCOUNT_MOVING = 'discount_moving',
  DONATE_EXPIRED = 'donate_expired',
  RETURN_TO_SUPPLIER = 'return_to_supplier',
  REPURPOSE_ITEMS = 'repurpose_items',
  COMPOST_RECYCLE = 'compost_recycle'
}

export enum InventoryTechnology {
  BARCODE_SCANNING = 'barcode_scanning',
  RFID_TAGS = 'rfid_tags',
  INVENTORY_SOFTWARE = 'inventory_software',
  POS_INTEGRATION = 'pos_integration',
  AUTOMATED_REORDERING = 'automated_reordering',
  DEMAND_ANALYTICS = 'demand_analytics',
  MOBILE_APPS = 'mobile_apps'
}

export interface QualityStandard {
  id: string;
  inventory_id: string;
  category_name: string;
  quality_criteria: QualityCriterion[];
  inspection_frequency: InspectionFrequency;
  quality_assurance_process: QualityAssuranceProcess;
  supplier_quality_requirements: SupplierQualityRequirement[];
  customer_quality_expectations: CustomerQualityExpectation[];
  created_at: string;
  updated_at: string;
}

export interface CreateQualityStandardRequest {
  category_name: string;
  quality_criteria: QualityCriterion[];
  inspection_frequency: InspectionFrequency;
  quality_assurance_process: QualityAssuranceProcess;
  supplier_quality_requirements: SupplierQualityRequirement[];
  customer_quality_expectations: CustomerQualityExpectation[];
}

export interface QualityCriterion {
  criterion_name: string;
  importance_level: ImportanceLevel;
  measurement_method: MeasurementMethod;
  acceptable_range: string;
  rejection_criteria: string;
}

export enum ImportanceLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum MeasurementMethod {
  VISUAL_INSPECTION = 'visual_inspection',
  QUANTITATIVE_TEST = 'quantitative_test',
  CUSTOMER_FEEDBACK = 'customer_feedback',
  SUPPLIER_CERTIFICATION = 'supplier_certification',
  THIRD_PARTY_TESTING = 'third_party_testing'
}

export enum InspectionFrequency {
  EVERY_DELIVERY = 'every_delivery',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  RANDOM_SAMPLING = 'random_sampling',
  CUSTOMER_COMPLAINT_TRIGGERED = 'customer_complaint_triggered'
}

export interface QualityAssuranceProcess {
  documentation_requirements: DocumentationRequirement[];
  corrective_action_procedures: CorrectiveActionProcedure[];
  quality_training_requirements: QualityTrainingRequirement[];
}

export enum DocumentationRequirement {
  CERTIFICATES_OF_ANALYSIS = 'certificates_of_analysis',
  SUPPLIER_AUDITS = 'supplier_audits',
  INSPECTION_RECORDS = 'inspection_records',
  CUSTOMER_FEEDBACK_LOGS = 'customer_feedback_logs',
  CORRECTIVE_ACTION_REPORTS = 'corrective_action_reports'
}

export enum CorrectiveActionProcedure {
  SUPPLIER_NOTIFICATION = 'supplier_notification',
  PRODUCT_QUARANTINE = 'product_quarantine',
  CUSTOMER_NOTIFICATION = 'customer_notification',
  PROCESS_IMPROVEMENT = 'process_improvement',
  TRAINING_UPDATE = 'training_update'
}

export enum QualityTrainingRequirement {
  INITIAL_TRAINING = 'initial_training',
  ANNUAL_REFRESHER = 'annual_refresher',
  ROLE_SPECIFIC_TRAINING = 'role_specific_training',
  VENDOR_TRAINING = 'vendor_training'
}

export interface SupplierQualityRequirement {
  requirement_type: SupplierQualityRequirementType;
  description: string;
  compliance_level: ComplianceLevel;
  verification_method: VerificationMethod;
}

export enum SupplierQualityRequirementType {
  CERTIFICATION = 'certification',
  PROCESS_STANDARD = 'process_standard',
  PRODUCT_SPECIFICATION = 'product_specification',
  TESTING_PROTOCOL = 'testing_protocol',
  DOCUMENTATION = 'documentation'
}

export enum ComplianceLevel {
  REQUIRED = 'required',
  PREFERRED = 'preferred',
  OPTIONAL = 'optional'
}

export enum VerificationMethod {
  SELF_CERTIFICATION = 'self_certification',
  THIRD_PARTY_AUDIT = 'third_party_audit',
  ON_SITE_INSPECTION = 'on_site_inspection',
  SAMPLE_TESTING = 'sample_testing',
  DOCUMENTATION_REVIEW = 'documentation_review'
}

export interface CustomerQualityExpectation {
  expectation_category: CustomerQualityExpectationCategory;
  description: string;
  priority_level: PriorityLevel;
  measurement_approach: CustomerMeasurementApproach;
}

export enum CustomerQualityExpectationCategory {
  PRODUCT_PERFORMANCE = 'product_performance',
  DURABILITY = 'durability',
  APPEARANCE = 'appearance',
  SAFETY = 'safety',
  CONSISTENCY = 'consistency',
  VALUE_FOR_MONEY = 'value_for_money'
}

export enum PriorityLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum CustomerMeasurementApproach {
  CUSTOMER_SURVEYS = 'customer_surveys',
  RETURN_RATES = 'return_rates',
  COMPLAINT_ANALYSIS = 'complaint_analysis',
  REPEAT_PURCHASE_RATES = 'repeat_purchase_rates',
  ONLINE_REVIEWS = 'online_reviews'
}

export interface CustomerPreference {
  id: string;
  inventory_id: string;
  preference_category: CustomerPreferenceCategory;
  demographic_segment: DemographicSegment;
  preference_details: PreferenceDetail[];
  preference_strength: PreferenceStrength;
  seasonal_variation: boolean;
  price_sensitivity: PriceSensitivity;
  brand_loyalty_level: BrandLoyaltyLevel;
  purchase_decision_factors: PurchaseDecisionFactor[];
  created_at: string;
  updated_at: string;
}

export interface CreateCustomerPreferenceRequest {
  preference_category: CustomerPreferenceCategory;
  demographic_segment: DemographicSegment;
  preference_details: PreferenceDetail[];
  preference_strength: PreferenceStrength;
  seasonal_variation: boolean;
  price_sensitivity: PriceSensitivity;
  brand_loyalty_level: BrandLoyaltyLevel;
  purchase_decision_factors: PurchaseDecisionFactor[];
}

export enum CustomerPreferenceCategory {
  PRODUCT_FEATURES = 'product_features',
  BRAND_PREFERENCES = 'brand_preferences',
  PRICE_PREFERENCES = 'price_preferences',
  SHOPPING_STYLE = 'shopping_style',
  SERVICE_PREFERENCES = 'service_preferences',
  COMMUNICATION_PREFERENCES = 'communication_preferences'
}

export interface DemographicSegment {
  age_range: AgeRange;
  income_level: IncomeLevel;
  lifestyle: LifestyleType;
  family_status: FamilyStatus;
  occupation_type: OccupationType;
}

export enum AgeRange {
  UNDER_18 = 'under_18',
  AGE_18_25 = 'age_18_25',
  AGE_26_35 = 'age_26_35',
  AGE_36_45 = 'age_36_45',
  AGE_46_55 = 'age_46_55',
  AGE_56_65 = 'age_56_65',
  OVER_65 = 'over_65'
}

export enum IncomeLevel {
  LOW = 'low',
  LOWER_MIDDLE = 'lower_middle',
  MIDDLE = 'middle',
  UPPER_MIDDLE = 'upper_middle',
  HIGH = 'high',
  VERY_HIGH = 'very_high'
}

export enum LifestyleType {
  TRADITIONAL = 'traditional',
  MODERN = 'modern',
  HEALTH_CONSCIOUS = 'health_conscious',
  ENVIRONMENTALLY_CONSCIOUS = 'environmentally_conscious',
  TECHNOLOGY_ORIENTED = 'technology_oriented',
  CONVENIENCE_FOCUSED = 'convenience_focused',
  QUALITY_FOCUSED = 'quality_focused',
  VALUE_FOCUSED = 'value_focused'
}

export enum FamilyStatus {
  SINGLE = 'single',
  MARRIED_NO_CHILDREN = 'married_no_children',
  MARRIED_WITH_CHILDREN = 'married_with_children',
  SINGLE_PARENT = 'single_parent',
  EMPTY_NESTER = 'empty_nester',
  RETIRED = 'retired'
}

export enum OccupationType {
  PROFESSIONAL = 'professional',
  MANAGEMENT = 'management',
  TECHNICAL = 'technical',
  SERVICE = 'service',
  RETAIL = 'retail',
  EDUCATION = 'education',
  HEALTHCARE = 'healthcare',
  RETIRED = 'retired',
  STUDENT = 'student',
  UNEMPLOYED = 'unemployed'
}

export interface PreferenceDetail {
  aspect: string;
  preference_type: PreferenceType;
  importance_score: number; // 1-10 scale
  specific_requirements: string[];
}

export enum PreferenceType {
  STRONGLY_PREFER = 'strongly_prefer',
  PREFER = 'prefer',
  NEUTRAL = 'neutral',
  AVOID = 'avoid',
  STRONGLY_AVOID = 'strongly_avoid'
}

export enum PreferenceStrength {
  WEAK = 'weak',
  MODERATE = 'moderate',
  STRONG = 'strong',
  VERY_STRONG = 'very_strong'
}

export enum PriceSensitivity {
  VERY_HIGH = 'very_high',
  HIGH = 'high',
  MODERATE = 'moderate',
  LOW = 'low',
  VERY_LOW = 'very_low'
}

export enum BrandLoyaltyLevel {
  BRAND_SWITCHER = 'brand_switcher',
  VARIETY_SEEKER = 'variety_seeker',
  OCCASIONAL_LOYAL = 'occasional_loyal',
  LOYAL = 'loyal',
  STRONGLY_LOYAL = 'strongly_loyal'
}

export enum PurchaseDecisionFactor {
  PRICE = 'price',
  QUALITY = 'quality',
  BRAND_REPUTATION = 'brand_reputation',
  CONVENIENCE = 'convenience',
  CUSTOMER_SERVICE = 'customer_service',
  PRODUCT_FEATURES = 'product_features',
  RECOMMENDATIONS = 'recommendations',
  ONLINE_REVIEWS = 'online_reviews',
  AVAILABILITY = 'availability',
  WARRANTY_SUPPORT = 'warranty_support'
}

export interface CompetitivePositioning {
  primary_competitors: PrimaryCompetitor[];
  competitive_advantages: CompetitiveAdvantage[];
  competitive_disadvantages: CompetitiveDisadvantage[];
  market_position: MarketPosition;
  differentiation_strategy: DifferentiationStrategy[];
  competitive_response_strategy: CompetitiveResponseStrategy;
}

export interface PrimaryCompetitor {
  name: string;
  competitor_type: CompetitorType;
  similarity_level: SimilarityLevel;
  strengths: string[];
  weaknesses: string[];
  market_share_estimate: number;
  price_positioning: CompetitivePricePositioning;
}

export enum CompetitorType {
  DIRECT = 'direct',
  INDIRECT = 'indirect',
  SUBSTITUTE = 'substitute',
  POTENTIAL = 'potential'
}

export enum SimilarityLevel {
  VERY_SIMILAR = 'very_similar',
  SIMILAR = 'similar',
  SOMEWHAT_SIMILAR = 'somewhat_similar',
  DIFFERENT = 'different'
}

export enum CompetitivePricePositioning {
  MUCH_LOWER = 'much_lower',
  LOWER = 'lower',
  SIMILAR = 'similar',
  HIGHER = 'higher',
  MUCH_HIGHER = 'much_higher'
}

export interface CompetitiveAdvantage {
  advantage_type: CompetitiveAdvantageType;
  description: string;
  sustainability: AdvantageSustainability;
  impact_level: ImpactLevel;
}

export enum CompetitiveAdvantageType {
  PRICE = 'price',
  QUALITY = 'quality',
  SERVICE = 'service',
  CONVENIENCE = 'convenience',
  SELECTION = 'selection',
  EXPERTISE = 'expertise',
  TECHNOLOGY = 'technology',
  LOCATION = 'location',
  BRAND = 'brand',
  RELATIONSHIPS = 'relationships'
}

export enum AdvantageSustainability {
  TEMPORARY = 'temporary',
  SHORT_TERM = 'short_term',
  MEDIUM_TERM = 'medium_term',
  LONG_TERM = 'long_term',
  SUSTAINABLE = 'sustainable'
}

export enum ImpactLevel {
  LOW = 'low',
  MODERATE = 'moderate',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface CompetitiveDisadvantage {
  disadvantage_type: CompetitiveDisadvantageType;
  description: string;
  severity: DisadvantageSeverity;
  mitigation_strategy: string;
}

export enum CompetitiveDisadvantageType {
  PRICE = 'price',
  QUALITY = 'quality',
  SERVICE = 'service',
  CONVENIENCE = 'convenience',
  SELECTION = 'selection',
  EXPERTISE = 'expertise',
  TECHNOLOGY = 'technology',
  LOCATION = 'location',
  BRAND = 'brand',
  RESOURCES = 'resources'
}

export enum DisadvantageSeverity {
  MINOR = 'minor',
  MODERATE = 'moderate',
  SIGNIFICANT = 'significant',
  SEVERE = 'severe'
}

export enum MarketPosition {
  MARKET_LEADER = 'market_leader',
  MARKET_CHALLENGER = 'market_challenger',
  MARKET_FOLLOWER = 'market_follower',
  NICHE_PLAYER = 'niche_player',
  NEW_ENTRANT = 'new_entrant'
}

export enum DifferentiationStrategy {
  COST_LEADERSHIP = 'cost_leadership',
  DIFFERENTIATION = 'differentiation',
  FOCUS_COST = 'focus_cost',
  FOCUS_DIFFERENTIATION = 'focus_differentiation',
  HYBRID = 'hybrid'
}

export interface CompetitiveResponseStrategy {
  monitoring_frequency: MonitoringFrequency;
  response_speed: ResponseSpeed;
  response_types: ResponseType[];
  decision_making_authority: DecisionMakingAuthority;
}

export enum MonitoringFrequency {
  CONTINUOUS = 'continuous',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  AS_NEEDED = 'as_needed'
}

export enum ResponseSpeed {
  IMMEDIATE = 'immediate',        // Within hours
  FAST = 'fast',                 // Within 1-2 days
  MODERATE = 'moderate',         // Within 1 week
  SLOW = 'slow',                 // Within 1 month
  STRATEGIC = 'strategic'        // Planned response
}

export enum ResponseType {
  PRICE_ADJUSTMENT = 'price_adjustment',
  PROMOTION_COUNTER = 'promotion_counter',
  SERVICE_ENHANCEMENT = 'service_enhancement',
  PRODUCT_IMPROVEMENT = 'product_improvement',
  MARKETING_RESPONSE = 'marketing_response',
  STRATEGIC_REPOSITIONING = 'strategic_repositioning'
}

export enum DecisionMakingAuthority {
  STORE_MANAGER = 'store_manager',
  REGIONAL_MANAGER = 'regional_manager',
  CORPORATE = 'corporate',
  OWNER = 'owner',
  COMMITTEE = 'committee'
}

// Validation schemas
export interface StoreInventoryValidation {
  category_structure: {
    required: true;
    minItems: 1;
    maxItems: 100;
  };
  pricing_strategy: {
    required: true;
  };
  supplier_relationships: {
    required: true;
    minItems: 1;
    maxItems: 50;
  };
}