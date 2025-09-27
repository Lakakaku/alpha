// Store context profile types for business context window feature

export interface StoreProfile {
  id: string;
  store_id: string;
  name: string;
  category: StoreCategory;
  size_category: StoreSizeCategory;
  target_demographic: string[];
  brand_voice: BrandVoice;
  unique_selling_points: string[];
  location_context: LocationContext;
  service_style: ServiceStyle;
  price_range: PriceRange;
  created_at: string;
  updated_at: string;
  version: number;
}

export interface CreateStoreProfileRequest {
  name: string;
  category: StoreCategory;
  size_category: StoreSizeCategory;
  target_demographic: string[];
  brand_voice: BrandVoice;
  unique_selling_points: string[];
  location_context: LocationContext;
  service_style: ServiceStyle;
  price_range: PriceRange;
}

export interface UpdateStoreProfileRequest extends Partial<CreateStoreProfileRequest> {
  version: number;
}

export enum StoreCategory {
  RESTAURANT = 'restaurant',
  RETAIL = 'retail',
  SERVICE = 'service',
  ENTERTAINMENT = 'entertainment',
  HEALTH_BEAUTY = 'health_beauty',
  AUTOMOTIVE = 'automotive',
  PROFESSIONAL = 'professional',
  OTHER = 'other'
}

export enum StoreSizeCategory {
  MICRO = 'micro',        // 1-5 employees
  SMALL = 'small',        // 6-25 employees
  MEDIUM = 'medium',      // 26-100 employees
  LARGE = 'large'         // 100+ employees
}

export interface BrandVoice {
  tone: BrandTone;
  personality_traits: string[];
  communication_style: CommunicationStyle;
  values: string[];
}

export enum BrandTone {
  PROFESSIONAL = 'professional',
  FRIENDLY = 'friendly',
  CASUAL = 'casual',
  LUXURY = 'luxury',
  PLAYFUL = 'playful',
  AUTHORITATIVE = 'authoritative',
  WARM = 'warm',
  MODERN = 'modern'
}

export enum CommunicationStyle {
  FORMAL = 'formal',
  CONVERSATIONAL = 'conversational',
  TECHNICAL = 'technical',
  SIMPLE = 'simple',
  DETAILED = 'detailed',
  CONCISE = 'concise'
}

export interface LocationContext {
  neighborhood_type: NeighborhoodType;
  foot_traffic_level: FootTrafficLevel;
  nearby_businesses: string[];
  accessibility_features: string[];
  parking_situation: ParkingSituation;
}

export enum NeighborhoodType {
  DOWNTOWN = 'downtown',
  SUBURBAN = 'suburban',
  RESIDENTIAL = 'residential',
  COMMERCIAL = 'commercial',
  TOURIST = 'tourist',
  INDUSTRIAL = 'industrial',
  MIXED_USE = 'mixed_use'
}

export enum FootTrafficLevel {
  LOW = 'low',
  MODERATE = 'moderate',
  HIGH = 'high',
  VARIABLE = 'variable'
}

export enum ParkingSituation {
  STREET_PARKING = 'street_parking',
  DEDICATED_LOT = 'dedicated_lot',
  GARAGE = 'garage',
  VALET = 'valet',
  LIMITED = 'limited',
  NO_PARKING = 'no_parking'
}

export enum ServiceStyle {
  SELF_SERVICE = 'self_service',
  COUNTER_SERVICE = 'counter_service',
  TABLE_SERVICE = 'table_service',
  FULL_SERVICE = 'full_service',
  APPOINTMENT_BASED = 'appointment_based',
  WALK_IN = 'walk_in',
  HYBRID = 'hybrid'
}

export interface PriceRange {
  category: PriceCategory;
  average_transaction: number;
  currency: string;
  typical_range_min: number;
  typical_range_max: number;
}

export enum PriceCategory {
  BUDGET = 'budget',
  MID_RANGE = 'mid_range',
  PREMIUM = 'premium',
  LUXURY = 'luxury',
  VARIABLE = 'variable'
}

export interface OperatingHours {
  id: string;
  store_id: string;
  day_of_week: DayOfWeek;
  open_time: string;  // HH:MM format
  close_time: string; // HH:MM format
  is_closed: boolean;
  break_start?: string; // HH:MM format
  break_end?: string;   // HH:MM format
  created_at: string;
  updated_at: string;
}

export enum DayOfWeek {
  MONDAY = 'monday',
  TUESDAY = 'tuesday',
  WEDNESDAY = 'wednesday',
  THURSDAY = 'thursday',
  FRIDAY = 'friday',
  SATURDAY = 'saturday',
  SUNDAY = 'sunday'
}

export interface CreateOperatingHoursRequest {
  day_of_week: DayOfWeek;
  open_time: string;
  close_time: string;
  is_closed: boolean;
  break_start?: string;
  break_end?: string;
}

export interface UpdateOperatingHoursRequest extends Partial<CreateOperatingHoursRequest> {}

// Validation schemas
export interface StoreProfileValidation {
  name: {
    required: true;
    minLength: 2;
    maxLength: 100;
  };
  category: {
    required: true;
    enum: StoreCategory;
  };
  target_demographic: {
    required: true;
    minItems: 1;
    maxItems: 5;
  };
  unique_selling_points: {
    required: true;
    minItems: 1;
    maxItems: 10;
  };
}