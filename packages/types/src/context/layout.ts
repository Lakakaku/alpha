// Layout context types for business context window feature

export interface StoreLayout {
  id: string;
  store_id: string;
  name: string;
  total_square_footage: number;
  layout_type: LayoutType;
  entrance_configuration: EntranceConfiguration;
  departments: Department[];
  customer_flow_pattern: FlowPattern;
  accessibility_features: AccessibilityFeature[];
  ambiance_settings: AmbianceSettings;
  technology_integration: TechnologyIntegration[];
  seasonal_variations: SeasonalVariation[];
  floor_plan_image_url?: string;
  created_at: string;
  updated_at: string;
  version: number;
}

export interface CreateStoreLayoutRequest {
  name: string;
  total_square_footage: number;
  layout_type: LayoutType;
  entrance_configuration: EntranceConfiguration;
  departments: CreateDepartmentRequest[];
  customer_flow_pattern: FlowPattern;
  accessibility_features: AccessibilityFeature[];
  ambiance_settings: AmbianceSettings;
  technology_integration: TechnologyIntegration[];
  seasonal_variations: CreateSeasonalVariationRequest[];
  floor_plan_image_url?: string;
}

export interface UpdateStoreLayoutRequest extends Partial<CreateStoreLayoutRequest> {
  version: number;
}

export enum LayoutType {
  OPEN_FLOOR = 'open_floor',
  GRID = 'grid',
  LOOP = 'loop',
  STRAIGHT = 'straight',
  ANGULAR = 'angular',
  GEOMETRIC = 'geometric',
  MIXED = 'mixed',
  FREE_FLOW = 'free_flow',
  BOUTIQUE = 'boutique'
}

export interface EntranceConfiguration {
  entrance_count: number;
  main_entrance_type: EntranceType;
  entrance_positioning: EntrancePosition[];
  entry_experience: EntryExperience;
  visibility_from_street: VisibilityLevel;
  entrance_width: EntranceWidth;
}

export enum EntranceType {
  AUTOMATIC_DOOR = 'automatic_door',
  MANUAL_DOOR = 'manual_door',
  REVOLVING_DOOR = 'revolving_door',
  SLIDING_DOOR = 'sliding_door',
  OPEN_ENTRANCE = 'open_entrance',
  VESTIBULE = 'vestibule'
}

export enum EntrancePosition {
  FRONT_CENTER = 'front_center',
  FRONT_LEFT = 'front_left',
  FRONT_RIGHT = 'front_right',
  SIDE_LEFT = 'side_left',
  SIDE_RIGHT = 'side_right',
  CORNER = 'corner',
  REAR = 'rear',
  MULTIPLE = 'multiple'
}

export enum EntryExperience {
  WELCOMING = 'welcoming',
  IMPRESSIVE = 'impressive',
  EFFICIENT = 'efficient',
  DISCRETE = 'discrete',
  GRAND = 'grand',
  INTIMATE = 'intimate'
}

export enum VisibilityLevel {
  HIGH = 'high',
  MODERATE = 'moderate',
  LOW = 'low',
  HIDDEN = 'hidden'
}

export enum EntranceWidth {
  NARROW = 'narrow',     // Single person
  STANDARD = 'standard', // 2 people side by side
  WIDE = 'wide',         // 3+ people side by side
  EXTRA_WIDE = 'extra_wide' // Wheelchair + companion
}

export interface Department {
  id: string;
  layout_id: string;
  name: string;
  category: DepartmentCategory;
  square_footage: number;
  position: DepartmentPosition;
  traffic_level: TrafficLevel;
  noise_level: NoiseLevel;
  lighting_type: LightingType;
  temperature_preference: TemperaturePreference;
  merchandise_density: MerchandiseDensity;
  interaction_style: DepartmentInteractionStyle;
  adjacency_preferences: string[]; // Names of departments that should be nearby
  adjacency_restrictions: string[]; // Names of departments that should be separated
  created_at: string;
  updated_at: string;
}

export interface CreateDepartmentRequest {
  name: string;
  category: DepartmentCategory;
  square_footage: number;
  position: DepartmentPosition;
  traffic_level: TrafficLevel;
  noise_level: NoiseLevel;
  lighting_type: LightingType;
  temperature_preference: TemperaturePreference;
  merchandise_density: MerchandiseDensity;
  interaction_style: DepartmentInteractionStyle;
  adjacency_preferences: string[];
  adjacency_restrictions: string[];
}

export enum DepartmentCategory {
  SALES_FLOOR = 'sales_floor',
  CHECKOUT = 'checkout',
  CUSTOMER_SERVICE = 'customer_service',
  FITTING_ROOMS = 'fitting_rooms',
  STORAGE = 'storage',
  OFFICE = 'office',
  RESTROOMS = 'restrooms',
  FOOD_SERVICE = 'food_service',
  SEATING_AREA = 'seating_area',
  ENTRANCE_LOBBY = 'entrance_lobby',
  SPECIALTY_SECTION = 'specialty_section',
  SEASONAL_DISPLAY = 'seasonal_display',
  CLEARANCE = 'clearance',
  NEW_ARRIVALS = 'new_arrivals'
}

export interface DepartmentPosition {
  x_coordinate: number; // Percentage of total width (0-100)
  y_coordinate: number; // Percentage of total depth (0-100)
  width_percentage: number; // Percentage of total width
  height_percentage: number; // Percentage of total depth
}

export enum TrafficLevel {
  LOW = 'low',
  MODERATE = 'moderate',
  HIGH = 'high',
  VARIABLE = 'variable'
}

export enum NoiseLevel {
  QUIET = 'quiet',
  MODERATE = 'moderate',
  LOUD = 'loud',
  VARIABLE = 'variable'
}

export enum LightingType {
  NATURAL = 'natural',
  BRIGHT_LED = 'bright_led',
  WARM_LED = 'warm_led',
  ACCENT = 'accent',
  SPOTLIGHTING = 'spotlighting',
  AMBIENT = 'ambient',
  TASK = 'task',
  DECORATIVE = 'decorative'
}

export enum TemperaturePreference {
  COOL = 'cool',
  MODERATE = 'moderate',
  WARM = 'warm',
  VARIABLE = 'variable'
}

export enum MerchandiseDensity {
  SPARSE = 'sparse',
  MODERATE = 'moderate',
  DENSE = 'dense',
  PACKED = 'packed'
}

export enum DepartmentInteractionStyle {
  SELF_BROWSE = 'self_browse',
  ASSISTED = 'assisted',
  CONSULTATION = 'consultation',
  DEMONSTRATION = 'demonstration',
  TRANSACTION_FOCUSED = 'transaction_focused'
}

export enum FlowPattern {
  LINEAR = 'linear',           // Straight path through store
  CIRCULAR = 'circular',       // Loop around store
  GRID_BASED = 'grid_based',   // Aisle-based navigation
  FREE_FLOW = 'free_flow',     // Open, non-directed movement
  GUIDED = 'guided',           // Specific path encouraged
  ZONED = 'zoned',            // Distinct areas with multiple flows
  SPIRAL = 'spiral',           // Inward or outward spiral
  MIXED = 'mixed'              // Combination of patterns
}

export enum AccessibilityFeature {
  WHEELCHAIR_ACCESSIBLE = 'wheelchair_accessible',
  WIDE_AISLES = 'wide_aisles',
  ACCESSIBLE_PARKING = 'accessible_parking',
  ACCESSIBLE_RESTROOMS = 'accessible_restrooms',
  HEARING_LOOP = 'hearing_loop',
  BRAILLE_SIGNAGE = 'braille_signage',
  AUDIO_DESCRIPTIONS = 'audio_descriptions',
  VISUAL_ALERTS = 'visual_alerts',
  SERVICE_ANIMAL_FRIENDLY = 'service_animal_friendly',
  ACCESSIBLE_CHECKOUT = 'accessible_checkout'
}

export interface AmbianceSettings {
  overall_aesthetic: OverallAesthetic;
  music_style: MusicStyle;
  music_volume: VolumeLevel;
  scent_profile: ScentProfile;
  color_scheme: ColorScheme;
  texture_elements: TextureElement[];
  visual_merchandising_style: VisualMerchandisingStyle;
  seasonal_decorations: boolean;
}

export enum OverallAesthetic {
  MODERN = 'modern',
  TRADITIONAL = 'traditional',
  RUSTIC = 'rustic',
  MINIMALIST = 'minimalist',
  LUXURIOUS = 'luxurious',
  INDUSTRIAL = 'industrial',
  VINTAGE = 'vintage',
  ECLECTIC = 'eclectic',
  NATURAL = 'natural',
  HIGH_TECH = 'high_tech'
}

export enum MusicStyle {
  NONE = 'none',
  BACKGROUND_INSTRUMENTAL = 'background_instrumental',
  CONTEMPORARY_POPULAR = 'contemporary_popular',
  CLASSICAL = 'classical',
  JAZZ = 'jazz',
  AMBIENT = 'ambient',
  GENRE_SPECIFIC = 'genre_specific',
  SEASONAL = 'seasonal',
  LOCAL_ARTISTS = 'local_artists'
}

export enum VolumeLevel {
  SILENT = 'silent',
  VERY_LOW = 'very_low',
  LOW = 'low',
  MODERATE = 'moderate',
  LOUD = 'loud'
}

export enum ScentProfile {
  NONE = 'none',
  FRESH_CLEAN = 'fresh_clean',
  WARM_INVITING = 'warm_inviting',
  LUXURY = 'luxury',
  NATURAL = 'natural',
  SEASONAL = 'seasonal',
  PRODUCT_SPECIFIC = 'product_specific',
  SIGNATURE_SCENT = 'signature_scent'
}

export interface ColorScheme {
  primary_colors: string[];
  accent_colors: string[];
  neutral_colors: string[];
  seasonal_variations: boolean;
}

export enum TextureElement {
  SMOOTH = 'smooth',
  ROUGH = 'rough',
  SOFT = 'soft',
  HARD = 'hard',
  NATURAL_WOOD = 'natural_wood',
  METAL = 'metal',
  FABRIC = 'fabric',
  GLASS = 'glass',
  STONE = 'stone',
  PLASTIC = 'plastic'
}

export enum VisualMerchandisingStyle {
  MINIMALIST = 'minimalist',
  ABUNDANT = 'abundant',
  THEMED = 'themed',
  COLOR_COORDINATED = 'color_coordinated',
  SEASONAL = 'seasonal',
  LIFESTYLE = 'lifestyle',
  FEATURE_FOCUSED = 'feature_focused'
}

export enum TechnologyIntegration {
  DIGITAL_SIGNAGE = 'digital_signage',
  INTERACTIVE_DISPLAYS = 'interactive_displays',
  MOBILE_PAYMENT = 'mobile_payment',
  SELF_CHECKOUT = 'self_checkout',
  INVENTORY_SCANNERS = 'inventory_scanners',
  CUSTOMER_TRACKING = 'customer_tracking',
  SMART_LIGHTING = 'smart_lighting',
  CLIMATE_CONTROL = 'climate_control',
  SECURITY_CAMERAS = 'security_cameras',
  WIFI_HOTSPOTS = 'wifi_hotspots'
}

export interface SeasonalVariation {
  id: string;
  layout_id: string;
  season_name: string;
  start_date: string; // MM-DD format
  end_date: string;   // MM-DD format
  layout_changes: SeasonalLayoutChange[];
  decoration_themes: string[];
  merchandise_adjustments: MerchandiseAdjustment[];
  created_at: string;
  updated_at: string;
}

export interface CreateSeasonalVariationRequest {
  season_name: string;
  start_date: string;
  end_date: string;
  layout_changes: SeasonalLayoutChange[];
  decoration_themes: string[];
  merchandise_adjustments: MerchandiseAdjustment[];
}

export interface SeasonalLayoutChange {
  department_name: string;
  change_type: SeasonalChangeType;
  change_description: string;
  impact_level: ImpactLevel;
}

export enum SeasonalChangeType {
  DEPARTMENT_EXPANSION = 'department_expansion',
  DEPARTMENT_REDUCTION = 'department_reduction',
  DEPARTMENT_RELOCATION = 'department_relocation',
  TEMPORARY_ADDITION = 'temporary_addition',
  DECOR_CHANGE = 'decor_change',
  FLOW_MODIFICATION = 'flow_modification'
}

export enum ImpactLevel {
  MINOR = 'minor',
  MODERATE = 'moderate',
  MAJOR = 'major',
  COMPLETE_REORGANIZATION = 'complete_reorganization'
}

export interface MerchandiseAdjustment {
  category: string;
  adjustment_type: AdjustmentType;
  percentage_change: number;
  special_displays: boolean;
}

export enum AdjustmentType {
  INCREASE = 'increase',
  DECREASE = 'decrease',
  REPLACE = 'replace',
  SEASONAL_ADD = 'seasonal_add'
}

// Validation schemas
export interface StoreLayoutValidation {
  name: {
    required: true;
    minLength: 2;
    maxLength: 100;
  };
  total_square_footage: {
    required: true;
    min: 50;
    max: 1000000;
  };
  departments: {
    required: true;
    minItems: 1;
    maxItems: 50;
  };
}