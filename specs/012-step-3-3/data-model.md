# Data Model: Customer Interface Polish

## Enhanced Database Schema

### Call Session Status Extensions

**Table**: `call_sessions` (existing, enhanced)

```sql
-- New columns added to existing table
ALTER TABLE call_sessions ADD COLUMN IF NOT EXISTS:
  status_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completion_confirmed_at TIMESTAMP WITH TIME ZONE NULL,
  customer_feedback_on_call TEXT NULL,
  call_quality_rating INTEGER CHECK (call_quality_rating >= 1 AND call_quality_rating <= 5),
  user_agent TEXT NULL,
  device_type TEXT NULL;

-- New status values added to existing enum
ALTER TYPE call_status ADD VALUE IF NOT EXISTS 'completion_confirmed';
ALTER TYPE call_status ADD VALUE IF NOT EXISTS 'reward_displayed';
```

**New Fields**:

- `status_updated_at`: Timestamp for real-time status tracking
- `completion_confirmed_at`: When customer acknowledged call completion
- `customer_feedback_on_call`: Optional feedback about call experience
- `call_quality_rating`: 1-5 rating of call quality
- `user_agent`: Browser/device info for debugging
- `device_type`: Mobile/desktop classification

### Offline Submission Queue

**Table**: `offline_submission_queue` (new)

```sql
CREATE TABLE offline_submission_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_phone_hash TEXT NOT NULL,
  transaction_time TIMESTAMP WITH TIME ZONE NOT NULL,
  transaction_value DECIMAL(10,2) NOT NULL,
  submission_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  synced_at TIMESTAMP WITH TIME ZONE NULL,
  sync_attempts INTEGER DEFAULT 0,
  sync_error TEXT NULL,
  call_session_id UUID NULL REFERENCES call_sessions(id) ON DELETE SET NULL,

  -- Constraints
  CONSTRAINT valid_sync_attempts CHECK (sync_attempts >= 0),
  CONSTRAINT valid_transaction_value CHECK (transaction_value > 0)
);

-- Indexes
CREATE INDEX idx_offline_queue_store ON offline_submission_queue(store_id);
CREATE INDEX idx_offline_queue_sync_status ON offline_submission_queue(synced_at) WHERE synced_at IS NULL;
CREATE INDEX idx_offline_queue_phone ON offline_submission_queue(customer_phone_hash);
```

**Entity Relationships**:

- `store_id` → `stores.id`: Links to specific business location
- `call_session_id` → `call_sessions.id`: Created when sync succeeds
- Offline submissions become regular call sessions upon sync

### Customer Support Requests

**Table**: `customer_support_requests` (new)

```sql
CREATE TABLE customer_support_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_phone_hash TEXT NOT NULL,
  store_id UUID NULL REFERENCES stores(id) ON DELETE SET NULL,
  call_session_id UUID NULL REFERENCES call_sessions(id) ON DELETE SET NULL,
  request_type support_request_type NOT NULL,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  priority support_priority DEFAULT 'medium',
  status support_status DEFAULT 'open',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE NULL,
  assigned_to TEXT NULL,
  customer_context JSONB NULL,

  -- Constraints
  CONSTRAINT non_empty_subject CHECK (length(trim(subject)) > 0),
  CONSTRAINT non_empty_description CHECK (length(trim(description)) > 0)
);

-- Enums
CREATE TYPE support_request_type AS ENUM (
  'verification_issue',
  'call_quality',
  'reward_question',
  'technical_problem',
  'accessibility_issue',
  'general_inquiry'
);

CREATE TYPE support_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE support_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');

-- Indexes
CREATE INDEX idx_support_requests_status ON customer_support_requests(status);
CREATE INDEX idx_support_requests_type ON customer_support_requests(request_type);
CREATE INDEX idx_support_requests_priority ON customer_support_requests(priority);
CREATE INDEX idx_support_requests_phone ON customer_support_requests(customer_phone_hash);
```

### PWA Installation Tracking

**Table**: `pwa_installations` (new)

```sql
CREATE TABLE pwa_installations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_phone_hash TEXT NOT NULL,
  store_id UUID NULL REFERENCES stores(id) ON DELETE SET NULL,
  installed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  prompt_shown_at TIMESTAMP WITH TIME ZONE NULL,
  user_agent TEXT NOT NULL,
  platform TEXT NOT NULL,
  installation_source pwa_install_source NOT NULL,
  uninstalled_at TIMESTAMP WITH TIME ZONE NULL,

  -- Unique constraint
  UNIQUE(customer_phone_hash, store_id, installed_at)
);

-- Enum
CREATE TYPE pwa_install_source AS ENUM (
  'post_verification',
  'post_call_completion',
  'manual_settings',
  'help_section',
  'repeat_visitor'
);

-- Indexes
CREATE INDEX idx_pwa_installations_phone ON pwa_installations(customer_phone_hash);
CREATE INDEX idx_pwa_installations_store ON pwa_installations(store_id);
CREATE INDEX idx_pwa_installations_platform ON pwa_installations(platform);
```

### Accessibility Preferences

**Table**: `customer_accessibility_preferences` (new)

```sql
CREATE TABLE customer_accessibility_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_phone_hash TEXT NOT NULL UNIQUE,
  high_contrast_mode BOOLEAN DEFAULT FALSE,
  large_text_mode BOOLEAN DEFAULT FALSE,
  reduced_motion BOOLEAN DEFAULT FALSE,
  screen_reader_detected BOOLEAN DEFAULT FALSE,
  voice_control_detected BOOLEAN DEFAULT FALSE,
  touch_accommodation BOOLEAN DEFAULT FALSE,
  preferred_input_method accessibility_input_method NULL,
  font_size_multiplier DECIMAL(3,2) DEFAULT 1.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_font_multiplier CHECK (font_size_multiplier >= 0.5 AND font_size_multiplier <= 3.0)
);

-- Enum
CREATE TYPE accessibility_input_method AS ENUM (
  'touch',
  'keyboard',
  'voice',
  'switch_control',
  'eye_tracking'
);

-- Index
CREATE INDEX idx_accessibility_phone ON customer_accessibility_preferences(customer_phone_hash);
```

## Enhanced Type Definitions

### Call Status Updates

```typescript
// Enhanced existing type
interface CallSession {
  // ... existing fields
  status_updated_at: string
  completion_confirmed_at?: string
  customer_feedback_on_call?: string
  call_quality_rating?: number // 1-5
  user_agent?: string
  device_type?: 'mobile' | 'desktop' | 'tablet'
}

type CallStatus =
  | 'verification_pending'
  | 'call_scheduled'
  | 'call_in_progress'
  | 'call_completed'
  | 'completion_confirmed' // New
  | 'reward_calculated'
  | 'reward_displayed' // New
```

### Offline Queue Management

```typescript
interface OfflineSubmission {
  id: string
  store_id: string
  customer_phone_hash: string
  transaction_time: string
  transaction_value: number
  submission_data: {
    verification_details: VerificationData
    device_info: DeviceInfo
    submission_context: SubmissionContext
  }
  created_at: string
  synced_at?: string
  sync_attempts: number
  sync_error?: string
  call_session_id?: string
}

interface SyncManager {
  queue: OfflineSubmission[]
  addToQueue(submission: OfflineSubmission): Promise<void>
  syncAll(): Promise<SyncResult[]>
  retryFailed(): Promise<void>
  clearSynced(): Promise<void>
}
```

### Customer Support

```typescript
type SupportRequestType =
  | 'verification_issue'
  | 'call_quality'
  | 'reward_question'
  | 'technical_problem'
  | 'accessibility_issue'
  | 'general_inquiry'

type SupportPriority = 'low' | 'medium' | 'high' | 'urgent'
type SupportStatus = 'open' | 'in_progress' | 'resolved' | 'closed'

interface CustomerSupportRequest {
  id: string
  customer_phone_hash: string
  store_id?: string
  call_session_id?: string
  request_type: SupportRequestType
  subject: string
  description: string
  priority: SupportPriority
  status: SupportStatus
  created_at: string
  updated_at: string
  resolved_at?: string
  assigned_to?: string
  customer_context?: {
    user_agent: string
    device_type: string
    accessibility_enabled: boolean
    pwa_installed: boolean
    offline_mode: boolean
  }
}
```

### PWA Installation

```typescript
type PWAInstallSource =
  | 'post_verification'
  | 'post_call_completion'
  | 'manual_settings'
  | 'help_section'
  | 'repeat_visitor'

interface PWAInstallation {
  id: string
  customer_phone_hash: string
  store_id?: string
  installed_at: string
  prompt_shown_at?: string
  user_agent: string
  platform: string
  installation_source: PWAInstallSource
  uninstalled_at?: string
}

interface PWAManager {
  canInstall(): boolean
  showInstallPrompt(): Promise<boolean>
  trackInstallation(source: PWAInstallSource): Promise<void>
  isInstalled(): boolean
}
```

### Accessibility Configuration

```typescript
type AccessibilityInputMethod =
  | 'touch'
  | 'keyboard'
  | 'voice'
  | 'switch_control'
  | 'eye_tracking'

interface AccessibilityPreferences {
  id: string
  customer_phone_hash: string
  high_contrast_mode: boolean
  large_text_mode: boolean
  reduced_motion: boolean
  screen_reader_detected: boolean
  voice_control_detected: boolean
  touch_accommodation: boolean
  preferred_input_method?: AccessibilityInputMethod
  font_size_multiplier: number // 0.5 to 3.0
  created_at: string
  updated_at: string
}
```

## State Management

### Call Status State Machine

```typescript
type CallStatusTransition = {
  from: CallStatus
  to: CallStatus
  trigger: string
  condition?: (session: CallSession) => boolean
}

const callStatusTransitions: CallStatusTransition[] = [
  {
    from: 'verification_pending',
    to: 'call_scheduled',
    trigger: 'SCHEDULE_CALL',
  },
  {
    from: 'call_scheduled',
    to: 'call_in_progress',
    trigger: 'CALL_STARTED',
  },
  {
    from: 'call_in_progress',
    to: 'call_completed',
    trigger: 'CALL_ENDED',
  },
  {
    from: 'call_completed',
    to: 'completion_confirmed',
    trigger: 'CUSTOMER_CONFIRMED',
  },
  {
    from: 'completion_confirmed',
    to: 'reward_calculated',
    trigger: 'REWARD_PROCESSED',
  },
  {
    from: 'reward_calculated',
    to: 'reward_displayed',
    trigger: 'REWARD_SHOWN',
  },
]
```

### Offline Sync State

```typescript
type SyncState = 'pending' | 'syncing' | 'synced' | 'error' | 'conflict'

interface OfflineState {
  isOnline: boolean
  queueLength: number
  syncState: SyncState
  lastSyncTime?: string
  syncErrors: string[]
}
```

## Data Validation Rules

### Client-Side Validation

- Transaction time: Must be within 2 minutes of current time
- Transaction value: Must be positive number with 2 decimal places
- Phone number: Must be valid Swedish format (+46...)
- Support request: Subject and description required, non-empty

### Server-Side Validation

- Duplicate submission detection (same phone + store + time window)
- Rate limiting per phone number
- Input sanitization for all text fields
- Schema validation for JSONB fields

### Accessibility Compliance

- All form fields have labels
- Error messages are descriptive and actionable
- Progress indicators have text alternatives
- Status updates announced to screen readers
