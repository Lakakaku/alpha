// QR Code Management System Types
// Based on data-model.md from specs/004-step-2-2/

export interface QRCodeStore {
  id: string;
  business_id: string;
  name: string;
  qr_code_data: string;
  qr_status: QRStatus;
  qr_generated_at: string;
  qr_version: number;
  qr_transition_until: string | null;
  created_at: string;
  updated_at: string;
  verification_status: string;
}

export type QRStatus = 'active' | 'inactive' | 'pending_regeneration';

export interface QRScanEvent {
  id: string;
  store_id: string;
  scanned_at: string;
  user_agent: string;
  referrer: string | null;
  ip_address: string;
  qr_version: number;
  session_id: string;
}

export interface QRAnalytics5Min {
  id: string;
  store_id: string;
  time_bucket: string;
  scan_count: number;
  unique_sessions: number;
  peak_minute: number;
  computed_at: string;
}

export interface QRAnalyticsHourly {
  id: string;
  store_id: string;
  hour_bucket: string;
  scan_count: number;
  unique_sessions: number;
  peak_5min: number;
  avg_scans_per_5min: number;
  computed_at: string;
}

export interface QRAnalyticsDaily {
  id: string;
  store_id: string;
  date_bucket: string;
  scan_count: number;
  unique_sessions: number;
  peak_hour: number;
  busiest_5min: string;
  avg_scans_per_hour: number;
  computed_at: string;
}

export interface QRCodeHistory {
  id: string;
  store_id: string;
  action_type: QRActionType;
  old_qr_data: string | null;
  new_qr_data: string;
  old_version: number | null;
  new_version: number;
  reason: string;
  changed_by: string;
  changed_at: string;
  batch_operation_id: string | null;
}

export type QRActionType = 'generated' | 'regenerated' | 'activated' | 'deactivated' | 'bulk_operation';

export interface QRPrintTemplate {
  id: string;
  business_id: string;
  template_name: string;
  page_size: PageSize;
  qr_size: number;
  include_logo: boolean;
  logo_url: string | null;
  custom_text: string;
  text_color: string;
  background_color: string;
  border_style: BorderStyle;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export type PageSize = 'A4' | 'letter' | 'business_card' | 'label_sheet';
export type BorderStyle = 'none' | 'thin' | 'thick' | 'dashed';

// API Request/Response Types

export interface QRRegenerateRequest {
  reason: string;
  transition_hours?: number;
}

export interface QRRegenerateResponse {
  success: boolean;
  store_id: string;
  new_qr_version: number;
  new_qr_data: string;
  transition_until: string;
  message: string;
}

export interface QRBulkRequest {
  store_ids: string[];
  operation: 'regenerate' | 'activate' | 'deactivate';
  reason: string;
  transition_hours?: number;
}

export interface QRBulkResponse {
  success: boolean;
  total_stores: number;
  successful_operations: number;
  failed_operations: number;
  batch_operation_id: string;
  results: QRBulkOperationResult[];
  message: string;
}

export interface QRBulkOperationResult {
  store_id: string;
  success: boolean;
  error_message?: string;
  new_qr_version?: number;
}

export interface QRScanRequest {
  store_id: string;
  qr_version: number;
  user_agent: string;
  referrer?: string;
  session_id: string;
}

export interface QRScanResponse {
  success: boolean;
  scan_recorded: boolean;
  message: string;
}

export interface QRAnalyticsRequest {
  period: 'hour' | 'day' | 'week' | 'month';
  start_date?: string;
  end_date?: string;
}

export interface QRAnalyticsResponse {
  success: boolean;
  store_id: string;
  period: string;
  total_scans: number;
  unique_sessions: number;
  peak_activity: {
    time: string;
    scan_count: number;
  };
  data_points: QRAnalyticsDataPoint[];
}

export interface QRAnalyticsDataPoint {
  time: string;
  scan_count: number;
  unique_sessions: number;
}

export interface QRDownloadRequest {
  template_id?: string;
  page_size?: PageSize;
  custom_options?: Partial<QRPrintTemplate>;
}

export interface QRDownloadResponse {
  success: boolean;
  download_url: string;
  file_name: string;
  file_size: number;
  expires_at: string;
}

// Frontend Component Props

export interface QRCodeDisplayProps {
  store: QRCodeStore;
  showInfo?: boolean;
  size?: number;
  onRegenerate?: () => void;
  onDownload?: () => void;
}

export interface QRManagementDashboardProps {
  stores: QRCodeStore[];
  selectedStore: string | null;
  onStoreSelect: (storeId: string) => void;
  onBulkOperation: (operation: QRBulkRequest) => void;
}

export interface QRAnalyticsChartsProps {
  storeId: string;
  period: QRAnalyticsRequest['period'];
  data: QRAnalyticsResponse;
  loading?: boolean;
  error?: string;
}

export interface BulkQROperationsProps {
  stores: QRCodeStore[];
  selectedStores: string[];
  onSelectionChange: (storeIds: string[]) => void;
  onExecute: (operation: QRBulkRequest) => void;
  loading?: boolean;
}

export interface TemplateManagerProps {
  businessId: string;
  templates: QRPrintTemplate[];
  onTemplateCreate: (template: Partial<QRPrintTemplate>) => void;
  onTemplateUpdate: (id: string, template: Partial<QRPrintTemplate>) => void;
  onTemplateDelete: (id: string) => void;
}

// Service Types

export interface QRGeneratorService {
  generateQRCode(storeId: string, version?: number): Promise<string>;
  regenerateQRCode(storeId: string, reason: string): Promise<QRRegenerateResponse>;
  validateQRCode(qrData: string): boolean;
}

export interface PDFTemplateService {
  generatePDF(store: QRCodeStore, template: QRPrintTemplate): Promise<Buffer>;
  getDefaultTemplate(businessId: string): Promise<QRPrintTemplate>;
  createTemplate(template: Omit<QRPrintTemplate, 'id' | 'created_at' | 'updated_at'>): Promise<QRPrintTemplate>;
}

export interface QRAnalyticsService {
  recordScan(event: Omit<QRScanEvent, 'id' | 'scanned_at'>): Promise<void>;
  getAnalytics(storeId: string, request: QRAnalyticsRequest): Promise<QRAnalyticsResponse>;
  aggregateData(timeRange: string): Promise<void>;
}

export interface QRManagementService {
  getStoreQR(storeId: string): Promise<QRCodeStore>;
  regenerateStoreQR(storeId: string, request: QRRegenerateRequest): Promise<QRRegenerateResponse>;
  bulkOperation(request: QRBulkRequest): Promise<QRBulkResponse>;
  downloadQR(storeId: string, request: QRDownloadRequest): Promise<QRDownloadResponse>;
}

// Error Types

export interface QRError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export class QRValidationError extends Error {
  code: string;
  details: Record<string, any>;

  constructor(message: string, code: string, details: Record<string, any> = {}) {
    super(message);
    this.name = 'QRValidationError';
    this.code = code;
    this.details = details;
  }
}

export class QRPermissionError extends Error {
  code: string;
  storeId: string;

  constructor(message: string, storeId: string) {
    super(message);
    this.name = 'QRPermissionError';
    this.code = 'PERMISSION_DENIED';
    this.storeId = storeId;
  }
}

// Utility Types

export type QRDashboardFilters = {
  status?: QRStatus[];
  search?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  sortBy?: 'name' | 'qr_generated_at' | 'scan_count';
  sortOrder?: 'asc' | 'desc';
};

export type QROperationStatus = 'idle' | 'pending' | 'success' | 'error';

export interface QROperationState {
  status: QROperationStatus;
  message?: string;
  progress?: number;
  startedAt?: string;
  completedAt?: string;
}