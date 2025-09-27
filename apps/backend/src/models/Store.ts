import type { Store } from '@vocilia/types';

/**
 * Store model for database operations
 * Extended with QR verification functionality
 */
export class StoreModel {
  public readonly id: string;
  public readonly business_id: string;
  public name: string;
  public readonly address: any | null; // JSONB address information
  public readonly store_code: string | null;
  public readonly qr_code_data: string | null;
  public active: boolean;
  // QR verification extensions
  public current_qr_version: number | null;
  public qr_generation_date: Date | null;
  public verification_enabled: boolean;
  public fraud_detection_threshold: number | null;
  public readonly created_at: Date;
  public updated_at: Date;

  constructor(data: Store) {
    this.id = data.id;
    this.business_id = data.business_id;
    this.name = data.name;
    this.address = data.address;
    this.store_code = data.store_code;
    this.qr_code_data = data.qr_code_data;
    this.active = data.active;
    this.current_qr_version = data.current_qr_version;
    this.qr_generation_date = data.qr_generation_date ? new Date(data.qr_generation_date) : null;
    this.verification_enabled = data.verification_enabled;
    this.fraud_detection_threshold = data.fraud_detection_threshold;
    this.created_at = new Date(data.created_at);
    this.updated_at = new Date(data.updated_at);
  }

  /**
   * Check if store is active and can accept verifications
   */
  public canAcceptVerifications(): boolean {
    return this.active && this.verification_enabled;
  }

  /**
   * Check if store has QR code functionality enabled
   */
  public hasQRCode(): boolean {
    return this.qr_code_data !== null && this.qr_code_data.length > 0;
  }

  /**
   * Get current QR version (defaults to 1 if not set)
   */
  public getCurrentQRVersion(): number {
    return this.current_qr_version || 1;
  }

  /**
   * Check if QR code is recent (generated within last 30 days)
   */
  public isQRCodeRecent(): boolean {
    if (!this.qr_generation_date) return false;
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    return this.qr_generation_date > thirtyDaysAgo;
  }

  /**
   * Get fraud detection threshold (defaults to 10)
   */
  public getFraudDetectionThreshold(): number {
    return this.fraud_detection_threshold || 10;
  }

  /**
   * Check if store is in a valid state for QR verification
   */
  public isValidForVerification(): boolean {
    return (
      this.active &&
      this.verification_enabled &&
      this.hasQRCode() &&
      this.getCurrentQRVersion() > 0
    );
  }

  /**
   * Enable QR verification for this store
   */
  public enableVerification(): void {
    this.verification_enabled = true;
    this.updated_at = new Date();
  }

  /**
   * Disable QR verification for this store
   */
  public disableVerification(): void {
    this.verification_enabled = false;
    this.updated_at = new Date();
  }

  /**
   * Update fraud detection threshold
   */
  public updateFraudThreshold(threshold: number): void {
    if (threshold < 1 || threshold > 100) {
      throw new Error('Fraud detection threshold must be between 1 and 100');
    }
    this.fraud_detection_threshold = threshold;
    this.updated_at = new Date();
  }

  /**
   * Increment QR version (for QR regeneration)
   */
  public incrementQRVersion(): number {
    const newVersion = this.getCurrentQRVersion() + 1;
    this.current_qr_version = newVersion;
    this.qr_generation_date = new Date();
    this.updated_at = new Date();
    return newVersion;
  }

  /**
   * Reset QR version to 1
   */
  public resetQRVersion(): void {
    this.current_qr_version = 1;
    this.qr_generation_date = new Date();
    this.updated_at = new Date();
  }

  /**
   * Get store display name with business context
   */
  public getDisplayName(): string {
    return this.store_code ? `${this.name} (${this.store_code})` : this.name;
  }

  /**
   * Get QR code URL for verification
   */
  public getVerificationURL(): string | null {
    if (!this.hasQRCode()) return null;
    return `${this.qr_code_data}?v=${this.getCurrentQRVersion()}`;
  }

  /**
   * Get days since QR generation
   */
  public getDaysSinceQRGeneration(): number | null {
    if (!this.qr_generation_date) return null;
    
    const diffTime = Date.now() - this.qr_generation_date.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Convert to plain object for database operations
   */
  public toObject(): Store {
    return {
      id: this.id,
      business_id: this.business_id,
      name: this.name,
      address: this.address,
      store_code: this.store_code,
      qr_code_data: this.qr_code_data,
      active: this.active,
      current_qr_version: this.current_qr_version,
      qr_generation_date: this.qr_generation_date?.toISOString() || null,
      verification_enabled: this.verification_enabled,
      fraud_detection_threshold: this.fraud_detection_threshold,
      created_at: this.created_at.toISOString(),
      updated_at: this.updated_at.toISOString()
    };
  }

  /**
   * Create from database row
   */
  public static fromDatabaseRow(row: any): StoreModel {
    return new StoreModel({
      id: row.id,
      business_id: row.business_id,
      name: row.name,
      address: row.address,
      store_code: row.store_code,
      qr_code_data: row.qr_code_data,
      active: row.active,
      current_qr_version: row.current_qr_version,
      qr_generation_date: row.qr_generation_date,
      verification_enabled: row.verification_enabled ?? true,
      fraud_detection_threshold: row.fraud_detection_threshold,
      created_at: row.created_at,
      updated_at: row.updated_at
    });
  }

  /**
   * Create new store with QR verification enabled
   */
  public static createNew(
    businessId: string,
    name: string,
    address: any = null,
    storeCode: string | null = null
  ): StoreModel {
    const now = new Date();
    const storeId = crypto.randomUUID();
    const qrCodeData = `https://customer.vocilia.se/qr/${storeId}`;

    return new StoreModel({
      id: storeId,
      business_id: businessId,
      name: name,
      address: address,
      store_code: storeCode,
      qr_code_data: qrCodeData,
      active: true,
      current_qr_version: 1,
      qr_generation_date: now.toISOString(),
      verification_enabled: true,
      fraud_detection_threshold: 10,
      created_at: now.toISOString(),
      updated_at: now.toISOString()
    });
  }

  /**
   * Create store for database insertion (without ID)
   */
  public toInsertObject(): Omit<Store, 'id'> {
    return {
      business_id: this.business_id,
      name: this.name,
      address: this.address,
      store_code: this.store_code,
      qr_code_data: this.qr_code_data,
      active: this.active,
      current_qr_version: this.current_qr_version,
      qr_generation_date: this.qr_generation_date?.toISOString() || null,
      verification_enabled: this.verification_enabled,
      fraud_detection_threshold: this.fraud_detection_threshold,
      created_at: this.created_at.toISOString(),
      updated_at: this.updated_at.toISOString()
    };
  }

  /**
   * Get update object for database operations
   */
  public toUpdateObject(): Partial<Store> {
    return {
      name: this.name,
      active: this.active,
      current_qr_version: this.current_qr_version,
      qr_generation_date: this.qr_generation_date?.toISOString() || null,
      verification_enabled: this.verification_enabled,
      fraud_detection_threshold: this.fraud_detection_threshold,
      updated_at: this.updated_at.toISOString()
    };
  }

  /**
   * Filter stores that can accept verifications
   */
  public static filterVerificationEnabled(stores: StoreModel[]): StoreModel[] {
    return stores.filter(store => store.canAcceptVerifications());
  }

  /**
   * Filter stores with recent QR codes
   */
  public static filterRecentQR(stores: StoreModel[]): StoreModel[] {
    return stores.filter(store => store.isQRCodeRecent());
  }

  /**
   * Sort stores by QR generation date (newest first)
   */
  public static sortByQRGenerationDate(stores: StoreModel[]): StoreModel[] {
    return stores.sort((a, b) => {
      if (!a.qr_generation_date && !b.qr_generation_date) return 0;
      if (!a.qr_generation_date) return 1;
      if (!b.qr_generation_date) return -1;
      return b.qr_generation_date.getTime() - a.qr_generation_date.getTime();
    });
  }
}