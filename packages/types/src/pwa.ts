// PWA (Progressive Web App) and accessibility types

export type PWAInstallStatus = 'not_available' | 'available' | 'installed' | 'dismissed';
export type AccessibilityLevel = 'none' | 'basic' | 'enhanced' | 'full';

export interface PWAInstallation {
  id: string; // UUID primary key
  customer_id: string | null; // UUID, optional customer identifier
  device_id: string;
  install_prompt_shown_at: string | null; // ISO timestamp
  installed_at: string | null; // ISO timestamp
  dismissed_at: string | null; // ISO timestamp
  uninstalled_at: string | null; // ISO timestamp
  install_source: PWAInstallSource;
  device_info: PWADeviceInfo; // JSONB device information
  usage_stats: PWAUsageStats | null; // JSONB usage tracking
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

export type PWAInstallSource = 'banner' | 'manual' | 'share_target' | 'shortcut';

export interface PWADeviceInfo {
  platform: string;
  user_agent: string;
  screen_resolution: string;
  color_depth: number;
  pixel_ratio: number;
  supports_pwa: boolean;
  supports_push_notifications: boolean;
  supports_background_sync: boolean;
  supports_web_share: boolean;
}

export interface PWAUsageStats {
  launches_count: number;
  last_launch_at: string; // ISO timestamp
  total_session_time: number; // minutes
  average_session_time: number; // minutes
  features_used: string[]; // Array of feature identifiers
  offline_usage_time: number; // minutes spent offline
}

export interface CustomerAccessibilityPreferences {
  id: string; // UUID primary key
  customer_id: string | null; // UUID, optional customer identifier
  accessibility_level: AccessibilityLevel;
  high_contrast: boolean;
  large_text: boolean;
  screen_reader_enabled: boolean;
  reduced_motion: boolean;
  keyboard_navigation: boolean;
  audio_descriptions: boolean;
  focus_indicators_enhanced: boolean;
  color_blind_friendly: boolean;
  reading_assistance: boolean;
  voice_commands: boolean;
  custom_settings: AccessibilityCustomSettings | null; // JSONB custom preferences
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

export interface AccessibilityCustomSettings {
  font_size_multiplier: number; // 0.8 to 2.0
  contrast_ratio: number; // 1.0 to 4.5
  animation_speed: number; // 0.1 to 1.0
  audio_cues: boolean;
  haptic_feedback: boolean;
  simplified_ui: boolean;
  focus_timeout: number; // seconds
  reading_speed: number; // words per minute
}

// PWA management types
export interface PWAManager {
  isInstallable: boolean;
  isInstalled: boolean;
  installPrompt: BeforeInstallPromptEvent | null;
  installApp: () => Promise<boolean>;
  uninstallApp: () => Promise<boolean>;
  trackUsage: (feature: string) => void;
  getUsageStats: () => PWAUsageStats;
}

export interface BeforeInstallPromptEvent extends Event {
  platforms: string[];
  userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

// Service Worker types
export interface ServiceWorkerMessage {
  type: 'CACHE_UPDATE' | 'SYNC_COMPLETE' | 'OFFLINE_READY' | 'ERROR';
  data?: any;
  timestamp: string;
}

export interface CacheStrategy {
  strategy: 'cache-first' | 'network-first' | 'cache-only' | 'network-only' | 'stale-while-revalidate';
  cache_name: string;
  expiration_time: number; // hours
  max_entries: number;
}

// Accessibility testing types
export interface AccessibilityTestResult {
  test_id: string;
  component: string;
  rule: string;
  level: 'A' | 'AA' | 'AAA';
  status: 'pass' | 'fail' | 'incomplete' | 'cantTell';
  message: string;
  element: string | null;
  help_url: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical';
}

export interface AccessibilityAudit {
  id: string;
  page_url: string;
  timestamp: string;
  wcag_version: string;
  compliance_level: 'A' | 'AA' | 'AAA';
  overall_score: number; // percentage
  total_tests: number;
  passed_tests: number;
  failed_tests: number;
  test_results: AccessibilityTestResult[];
  recommendations: string[];
}

// Mobile optimization types
export interface MobileOptimization {
  touch_target_size: boolean; // minimum 44x44px
  responsive_design: boolean;
  fast_loading: boolean; // <3s initial load
  offline_capability: boolean;
  push_notifications: boolean;
  geolocation_support: boolean;
  camera_access: boolean;
  accelerometer_support: boolean;
}

export interface TouchGesture {
  type: 'tap' | 'double-tap' | 'long-press' | 'swipe' | 'pinch' | 'rotate';
  element: string;
  coordinates: { x: number; y: number };
  duration: number; // milliseconds
  force: number; // 0-1 scale
  timestamp: string;
}

// Performance monitoring for PWA
export interface PWAPerformanceMetrics {
  app_shell_load_time: number; // milliseconds
  route_change_time: number; // milliseconds
  cache_hit_ratio: number; // percentage
  service_worker_install_time: number; // milliseconds
  background_sync_success_rate: number; // percentage
  push_notification_delivery_rate: number; // percentage
  offline_functionality_coverage: number; // percentage
}

// Web App Manifest types
export interface WebAppManifest {
  name: string;
  short_name: string;
  description: string;
  start_url: string;
  display: 'fullscreen' | 'standalone' | 'minimal-ui' | 'browser';
  orientation: 'portrait' | 'landscape' | 'any';
  theme_color: string;
  background_color: string;
  icons: ManifestIcon[];
  categories: string[];
  screenshots: ManifestScreenshot[];
  shortcuts: ManifestShortcut[];
  share_target?: ShareTarget;
}

export interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose?: 'any' | 'maskable' | 'monochrome';
}

export interface ManifestScreenshot {
  src: string;
  sizes: string;
  type: string;
  form_factor?: 'narrow' | 'wide';
  label?: string;
}

export interface ManifestShortcut {
  name: string;
  short_name?: string;
  description?: string;
  url: string;
  icons?: ManifestIcon[];
}

export interface ShareTarget {
  action: string;
  method: 'GET' | 'POST';
  enctype: 'application/x-www-form-urlencoded' | 'multipart/form-data';
  params: {
    title?: string;
    text?: string;
    url?: string;
    files?: FileFilter[];
  };
}

export interface FileFilter {
  name: string;
  accept: string | string[];
}