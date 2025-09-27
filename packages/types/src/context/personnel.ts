// Personnel context types for business context window feature

export interface StorePersonnel {
  id: string;
  store_id: string;
  name: string;
  role: PersonnelRole;
  department?: string;
  seniority_level: SeniorityLevel;
  skills: string[];
  certifications: string[];
  languages_spoken: string[];
  typical_shifts: PersonnelShift[];
  personality_traits: PersonalityTrait[];
  customer_interaction_style: InteractionStyle;
  availability_notes?: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface CreatePersonnelRequest {
  name: string;
  role: PersonnelRole;
  department?: string;
  seniority_level: SeniorityLevel;
  skills: string[];
  certifications: string[];
  languages_spoken: string[];
  typical_shifts: CreatePersonnelShiftRequest[];
  personality_traits: PersonalityTrait[];
  customer_interaction_style: InteractionStyle;
  availability_notes?: string;
}

export interface UpdatePersonnelRequest extends Partial<CreatePersonnelRequest> {}

export enum PersonnelRole {
  OWNER = 'owner',
  MANAGER = 'manager',
  ASSISTANT_MANAGER = 'assistant_manager',
  SUPERVISOR = 'supervisor',
  TEAM_LEAD = 'team_lead',
  SENIOR_STAFF = 'senior_staff',
  STAFF = 'staff',
  PART_TIME = 'part_time',
  INTERN = 'intern',
  CONTRACTOR = 'contractor',
  SPECIALIST = 'specialist',
  CONSULTANT = 'consultant'
}

export enum SeniorityLevel {
  ENTRY = 'entry',           // 0-1 years
  JUNIOR = 'junior',         // 1-3 years
  MID_LEVEL = 'mid_level',   // 3-7 years
  SENIOR = 'senior',         // 7-15 years
  EXPERT = 'expert',         // 15+ years
  EXECUTIVE = 'executive'    // Leadership level
}

export interface PersonnelShift {
  id: string;
  personnel_id: string;
  day_of_week: DayOfWeek;
  start_time: string;  // HH:MM format
  end_time: string;    // HH:MM format
  break_duration?: number; // minutes
  is_regular: boolean; // true for regular shifts, false for occasional
  shift_type: ShiftType;
  responsibilities: string[];
  created_at: string;
  updated_at: string;
}

export interface CreatePersonnelShiftRequest {
  day_of_week: DayOfWeek;
  start_time: string;
  end_time: string;
  break_duration?: number;
  is_regular: boolean;
  shift_type: ShiftType;
  responsibilities: string[];
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

export enum ShiftType {
  OPENING = 'opening',
  MORNING = 'morning',
  AFTERNOON = 'afternoon',
  EVENING = 'evening',
  CLOSING = 'closing',
  OVERNIGHT = 'overnight',
  SPLIT = 'split',
  ON_CALL = 'on_call'
}

export enum PersonalityTrait {
  OUTGOING = 'outgoing',
  RESERVED = 'reserved',
  PATIENT = 'patient',
  ENERGETIC = 'energetic',
  DETAIL_ORIENTED = 'detail_oriented',
  CREATIVE = 'creative',
  ANALYTICAL = 'analytical',
  EMPATHETIC = 'empathetic',
  ASSERTIVE = 'assertive',
  COLLABORATIVE = 'collaborative',
  INDEPENDENT = 'independent',
  MENTORING = 'mentoring',
  PROBLEM_SOLVER = 'problem_solver',
  ADAPTABLE = 'adaptable',
  RELIABLE = 'reliable'
}

export enum InteractionStyle {
  WARM_PERSONAL = 'warm_personal',
  PROFESSIONAL_FORMAL = 'professional_formal',
  CASUAL_FRIENDLY = 'casual_friendly',
  HELPFUL_INFORMATIVE = 'helpful_informative',
  EFFICIENT_DIRECT = 'efficient_direct',
  CONSULTATIVE = 'consultative',
  ENTERTAINING = 'entertaining',
  EDUCATIONAL = 'educational'
}

export interface TeamDynamics {
  id: string;
  store_id: string;
  team_structure: TeamStructure;
  communication_style: TeamCommunicationStyle;
  decision_making_process: DecisionMakingStyle;
  conflict_resolution_approach: ConflictResolutionStyle;
  training_approach: TrainingApproach;
  performance_culture: PerformanceCulture;
  collaboration_tools: string[];
  meeting_frequency: MeetingFrequency;
  feedback_culture: FeedbackCulture;
  created_at: string;
  updated_at: string;
}

export enum TeamStructure {
  HIERARCHICAL = 'hierarchical',
  FLAT = 'flat',
  MATRIX = 'matrix',
  CROSS_FUNCTIONAL = 'cross_functional',
  SELF_ORGANIZING = 'self_organizing'
}

export enum TeamCommunicationStyle {
  FORMAL = 'formal',
  INFORMAL = 'informal',
  OPEN_TRANSPARENT = 'open_transparent',
  STRUCTURED = 'structured',
  COLLABORATIVE = 'collaborative',
  DIRECTIVE = 'directive'
}

export enum DecisionMakingStyle {
  TOP_DOWN = 'top_down',
  CONSENSUS = 'consensus',
  DELEGATED = 'delegated',
  CONSULTATIVE = 'consultative',
  COLLABORATIVE = 'collaborative'
}

export enum ConflictResolutionStyle {
  DIRECT_CONFRONTATION = 'direct_confrontation',
  MEDIATION = 'mediation',
  COLLABORATIVE_PROBLEM_SOLVING = 'collaborative_problem_solving',
  AVOIDANCE = 'avoidance',
  COMPROMISE = 'compromise'
}

export enum TrainingApproach {
  ON_THE_JOB = 'on_the_job',
  FORMAL_CLASSROOM = 'formal_classroom',
  MENTORSHIP = 'mentorship',
  SELF_DIRECTED = 'self_directed',
  BLENDED = 'blended',
  CONTINUOUS_LEARNING = 'continuous_learning'
}

export enum PerformanceCulture {
  RESULTS_DRIVEN = 'results_driven',
  PROCESS_ORIENTED = 'process_oriented',
  INNOVATION_FOCUSED = 'innovation_focused',
  RELATIONSHIP_BASED = 'relationship_based',
  QUALITY_FOCUSED = 'quality_focused',
  CUSTOMER_CENTRIC = 'customer_centric'
}

export enum MeetingFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  BIWEEKLY = 'biweekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  AS_NEEDED = 'as_needed'
}

export enum FeedbackCulture {
  CONTINUOUS = 'continuous',
  PERIODIC = 'periodic',
  FORMAL_ONLY = 'formal_only',
  PEER_TO_PEER = 'peer_to_peer',
  TOP_DOWN = 'top_down',
  OPEN_FEEDBACK = 'open_feedback'
}

// Validation schemas
export interface PersonnelValidation {
  name: {
    required: true;
    minLength: 2;
    maxLength: 50;
  };
  role: {
    required: true;
    enum: PersonnelRole;
  };
  skills: {
    required: false;
    maxItems: 15;
  };
  languages_spoken: {
    required: true;
    minItems: 1;
    maxItems: 10;
  };
  typical_shifts: {
    required: true;
    minItems: 1;
    maxItems: 7;
  };
}