import { Database } from '@vocilia/types';

export type BusinessContextProfile = Database['public']['Tables']['business_context_profiles']['Row'];
export type BusinessContextProfileInsert = Database['public']['Tables']['business_context_profiles']['Insert'];
export type BusinessContextProfileUpdate = Database['public']['Tables']['business_context_profiles']['Update'];

export interface CreateBusinessContextProfileData {
  store_id: string;
  context_version?: number;
  operating_hours: OperatingHours;
  departments: Department[];
  current_campaigns?: Campaign[];
  question_configuration: QuestionConfiguration;
  baseline_facts: BaselineFacts;
  context_completeness_score?: number;
  updated_by?: string;
}

export interface OperatingHours {
  monday?: TimeSlot[];
  tuesday?: TimeSlot[];
  wednesday?: TimeSlot[];
  thursday?: TimeSlot[];
  friday?: TimeSlot[];
  saturday?: TimeSlot[];
  sunday?: TimeSlot[];
  holidays?: HolidaySchedule[];
}

export interface TimeSlot {
  open: string; // HH:MM format
  close: string; // HH:MM format
  break_start?: string;
  break_end?: string;
}

export interface Department {
  name: string;
  location: string;
  key_products?: string[];
  staff_count?: number;
  special_features?: string[];
}

export interface Campaign {
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  departments_affected?: string[];
  discount_percentage?: number;
}

export interface QuestionConfiguration {
  custom_questions?: CustomQuestion[];
  question_frequency: QuestionFrequency;
  focus_areas: string[];
  skip_generic_questions?: boolean;
}

export interface CustomQuestion {
  question: string;
  category: string;
  priority: number;
  condition?: string;
}

export interface QuestionFrequency {
  product_quality: number; // 0-1 probability
  customer_service: number;
  store_environment: number;
  pricing: number;
  accessibility: number;
}

export interface BaselineFacts {
  store_size_sqm?: number;
  employee_count?: number;
  established_year?: number;
  primary_customer_demographics?: string[];
  unique_selling_points?: string[];
  known_limitations?: string[];
}

export interface HolidaySchedule {
  date: string;
  hours?: TimeSlot[];
  closed?: boolean;
  special_note?: string;
}

export const DEFAULT_CONTEXT_VERSION = 1;
export const MIN_COMPLETENESS_SCORE = 0.0;
export const MAX_COMPLETENESS_SCORE = 1.0;
export const DEFAULT_COMPLETENESS_SCORE = 0.5;