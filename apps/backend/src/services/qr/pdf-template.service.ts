// PDF Template Service
// Handles PDF generation for QR code printing with customizable templates

import { jsPDF } from 'jspdf';
import { createCanvas, loadImage } from 'canvas';
import { QRDatabase } from '@vocilia/database/qr';
import { QRGeneratorService } from './qr-generator.service';
import type {
  QRCodeStore,
  QRPrintTemplate,
  QRDownloadRequest,
  QRDownloadResponse,
  PageSize,
  BorderStyle,
  QRValidationError
} from '@vocilia/types/qr';

interface PDFDimensions {
  width: number;
  height: number;
  unit: 'mm' | 'pt' | 'in';
}

interface QRPosition {
  x: number;
  y: number;
  size: number;
}

export class PDFTemplateService {
  private database: QRDatabase;
  private qrGenerator: QRGeneratorService;
  
  // PDF optimization settings for <2MB target
  private readonly PDF_OPTIMIZATION = {
    maxImageWidth: 400,      // Limit image width to reduce size
    maxImageHeight: 400,     // Limit image height
    imageCompression: 0.7,   // JPEG compression level
    qrOptimalSize: 256,      // Optimal QR size for quality vs size
    fontOptimization: true   // Use standard fonts only
  };

  constructor(database: QRDatabase, qrGenerator: QRGeneratorService) {
    this.database = database;
    this.qrGenerator = qrGenerator;
  }

  /**
   * Generate PDF with QR code using specified template
   * PERFORMANCE: Optimized for <2MB file size with quality preservation
   */
  async generatePDF(store: QRCodeStore, template: QRPrintTemplate): Promise<Buffer> {
    const startTime = Date.now();
    
    try {
      // Get page dimensions based on template
      const dimensions = this.getPageDimensions(template.page_size);
      
      // Create PDF document with compression
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: dimensions.unit,
        format: [dimensions.width, dimensions.height],
        compress: true,  // Enable compression for smaller file size
        precision: 2     // Reduce precision for smaller output
      });

      // Optimize QR size for balance between quality and file size
      const optimizedQRSize = Math.min(template.qr_size, this.PDF_OPTIMIZATION.qrOptimalSize);
      
      // Generate QR code with optimal settings for PDF
      const qrDataUrl = await this.qrGenerator.generateQRCode(store.id, store.qr_version);
      
      // Calculate QR position and size with optimized dimensions
      const qrPosition = this.calculateQRPosition(dimensions, {
        ...template,
        qr_size: optimizedQRSize
      });

      // Add background color if specified (minimal impact on size)
      if (template.background_color && template.background_color !== '#FFFFFF') {
        pdf.setFillColor(template.background_color);
        pdf.rect(0, 0, dimensions.width, dimensions.height, 'F');
      }

      // Add border if specified (vector graphics - minimal size impact)
      if (template.border_style !== 'none') {
        this.addBorder(pdf, dimensions, template.border_style);
      }

      // Add business logo with size optimization
      if (template.include_logo && template.logo_url) {
        await this.addOptimizedLogo(pdf, template.logo_url, dimensions, qrPosition);
      }

      // Add optimized QR code to PDF
      await this.addOptimizedQRCodeToPDF(pdf, qrDataUrl, qrPosition);

      // Add custom text (vector - minimal size impact)
      if (template.custom_text) {
        this.addCustomText(pdf, template.custom_text, template.text_color, dimensions, qrPosition);
      }

      // Add store information
      this.addStoreInfo(pdf, store, template.text_color, dimensions, qrPosition);

      // Add footer with generation info
      this.addFooter(pdf, store, dimensions, template.text_color);

      // Generate PDF buffer with final optimizations
      const pdfBuffer = Buffer.from(pdf.output('arraybuffer'));
      
      // Performance and size monitoring
      const duration = Date.now() - startTime;
      const sizeKB = pdfBuffer.length / 1024;
      const sizeMB = sizeKB / 1024;
      
      if (sizeMB > 2) {
        console.warn(`PDF size ${sizeMB.toFixed(2)}MB exceeds 2MB target for store ${store.id}`);
      }
      
      if (duration > 3000) {
        console.warn(`PDF generation took ${duration}ms for store ${store.id} (target: <3000ms)`);
      }

      console.debug(`PDF generated: ${sizeMB.toFixed(2)}MB in ${duration}ms`);

      return pdfBuffer;
    } catch (error: any) {
      throw new QRValidationError(
        'Failed to generate PDF',
        'PDF_GENERATION_FAILED',
        { storeId: store.id, templateId: template.id, originalError: error.message }
      );
    }
  }

  /**
   * Get default template for a business
   */
  async getDefaultTemplate(businessId: string): Promise<QRPrintTemplate> {
    try {
      // Try to get existing default template
      let template = await this.database.getDefaultTemplate(businessId);
      
      if (!template) {
        // Create default template if none exists
        template = await this.createDefaultTemplate(businessId);
      }

      return template;
    } catch (error: any) {
      throw new QRValidationError(
        'Failed to get default template',
        'DEFAULT_TEMPLATE_FAILED',
        { businessId, originalError: error.message }
      );
    }
  }

  /**
   * Create a new template
   */
  async createTemplate(
    template: Omit<QRPrintTemplate, 'id' | 'created_at' | 'updated_at'>
  ): Promise<QRPrintTemplate> {
    try {
      // Validate template data
      this.validateTemplate(template);

      // Create template in database
      return await this.database.createTemplate(template);
    } catch (error: any) {
      if (error instanceof QRValidationError) {
        throw error;
      }
      throw new QRValidationError(
        'Failed to create template',
        'TEMPLATE_CREATION_FAILED',
        { businessId: template.business_id, originalError: error.message }
      );
    }
  }

  /**
   * Update existing template
   */
  async updateTemplate(
    templateId: string,
    updates: Partial<QRPrintTemplate>
  ): Promise<QRPrintTemplate> {
    try {
      // Validate updates
      if (updates.qr_size && (updates.qr_size < 50 || updates.qr_size > 300)) {
        throw new QRValidationError(
          'QR size must be between 50 and 300 pixels',
          'INVALID_QR_SIZE',
          { qrSize: updates.qr_size }
        );
      }

      return await this.database.updateTemplate(templateId, updates);
    } catch (error: any) {
      if (error instanceof QRValidationError) {
        throw error;
      }
      throw new QRValidationError(
        'Failed to update template',
        'TEMPLATE_UPDATE_FAILED',
        { templateId, originalError: error.message }
      );
    }
  }

  /**
   * Delete template
   */
  async deleteTemplate(templateId: string): Promise<void> {
    try {
      await this.database.deleteTemplate(templateId);
    } catch (error: any) {
      throw new QRValidationError(
        'Failed to delete template',
        'TEMPLATE_DELETE_FAILED',
        { templateId, originalError: error.message }
      );
    }
  }

  /**
   * Generate download response with temporary URL
   */
  async generateDownloadResponse(
    store: QRCodeStore,
    request: QRDownloadRequest
  ): Promise<QRDownloadResponse> {
    try {
      // Get template
      let template: QRPrintTemplate;
      
      if (request.template_id) {
        const templates = await this.database.getBusinessTemplates(store.business_id);
        template = templates.find(t => t.id === request.template_id)!;
        if (!template) {
          throw new QRValidationError('Template not found', 'TEMPLATE_NOT_FOUND', { templateId: request.template_id });
        }
      } else {
        template = await this.getDefaultTemplate(store.business_id);
      }

      // Apply custom options if provided
      if (request.custom_options) {
        template = { ...template, ...request.custom_options };
      }

      // Override page size if specified
      if (request.page_size) {
        template.page_size = request.page_size;
      }

      // Generate PDF
      const pdfBuffer = await this.generatePDF(store, template);

      // Generate filename
      const timestamp = new Date().toISOString().slice(0, 10);
      const fileName = `qr-code-${store.name.replace(/[^a-zA-Z0-9]/g, '-')}-${timestamp}.pdf`;

      // In a real implementation, you'd upload to cloud storage and return a signed URL
      // For now, we'll return a mock response
      const downloadUrl = `/api/qr/download/${store.id}/temp/${Date.now()}`;
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

      return {
        success: true,
        download_url: downloadUrl,
        file_name: fileName,
        file_size: pdfBuffer.length,
        expires_at: expiresAt
      };
    } catch (error: any) {
      if (error instanceof QRValidationError) {
        throw error;
      }
      throw new QRValidationError(
        'Failed to generate download response',
        'DOWNLOAD_GENERATION_FAILED',
        { storeId: store.id, originalError: error.message }
      );
    }
  }

  /**
   * Get page dimensions for different page sizes
   */
  private getPageDimensions(pageSize: PageSize): PDFDimensions {
    switch (pageSize) {
      case 'A4':
        return { width: 210, height: 297, unit: 'mm' };
      case 'letter':
        return { width: 216, height: 279, unit: 'mm' };
      case 'business_card':
        return { width: 89, height: 51, unit: 'mm' };
      case 'label_sheet':
        return { width: 210, height: 297, unit: 'mm' }; // A4 size for label sheets
      default:
        return { width: 210, height: 297, unit: 'mm' };
    }
  }

  /**
   * Calculate QR code position based on template and page size
   */
  private calculateQRPosition(dimensions: PDFDimensions, template: QRPrintTemplate): QRPosition {
    const margin = 20; // 20mm margin
    const qrSizeMM = template.qr_size * 0.264583; // Convert pixels to mm (96 DPI)

    // Center the QR code
    const x = (dimensions.width - qrSizeMM) / 2;
    const y = margin + (template.include_logo ? 40 : 20); // Leave space for logo if included

    return {
      x,
      y,
      size: qrSizeMM
    };
  }

  /**
   * Add border to PDF
   */
  private addBorder(pdf: jsPDF, dimensions: PDFDimensions, borderStyle: BorderStyle): void {
    const margin = 5; // 5mm margin for border

    switch (borderStyle) {
      case 'thin':
        pdf.setLineWidth(0.5);
        pdf.setDrawColor(0, 0, 0);
        break;
      case 'thick':
        pdf.setLineWidth(2);
        pdf.setDrawColor(0, 0, 0);
        break;
      case 'dashed':
        pdf.setLineWidth(1);
        pdf.setDrawColor(0, 0, 0);
        pdf.setLineDashPattern([3, 3], 0);
        break;
      default:
        return;
    }

    pdf.rect(margin, margin, dimensions.width - 2 * margin, dimensions.height - 2 * margin);
    
    // Reset line dash pattern
    if (borderStyle === 'dashed') {
      pdf.setLineDashPattern([], 0);
    }
  }

  /**
   * Add optimized logo to PDF with size constraints
   * SIZE OPTIMIZATION: Compress and resize logos for <2MB target
   */
  private async addOptimizedLogo(
    pdf: jsPDF,
    logoUrl: string,
    dimensions: PDFDimensions,
    qrPosition: QRPosition
  ): Promise<void> {
    try {
      // Load and optimize logo image
      const image = await loadImage(logoUrl);
      
      // Create canvas for logo optimization
      const maxWidth = this.PDF_OPTIMIZATION.maxImageWidth;
      const maxHeight = this.PDF_OPTIMIZATION.maxImageHeight;
      
      // Calculate optimized dimensions
      const aspectRatio = image.height / image.width;
      let logoWidth = Math.min(maxWidth, image.width);
      let logoHeight = logoWidth * aspectRatio;
      
      // Ensure height doesn't exceed maximum
      if (logoHeight > maxHeight) {
        logoHeight = maxHeight;
        logoWidth = logoHeight / aspectRatio;
      }
      
      // Create optimized canvas
      const canvas = createCanvas(logoWidth, logoHeight);
      const ctx = canvas.getContext('2d');
      
      // Draw and compress image
      ctx.drawImage(image, 0, 0, logoWidth, logoHeight);
      
      // Convert to optimized data URL with compression
      const optimizedLogoUrl = canvas.toDataURL('image/jpeg', this.PDF_OPTIMIZATION.imageCompression);

      // Calculate logo dimensions in PDF units (max 25mm width for smaller file)
      const maxLogoWidthMM = 25;
      const logoWidthMM = Math.min(maxLogoWidthMM, logoWidth * 0.264583);
      const logoHeightMM = logoWidthMM * aspectRatio;

      // Position logo above QR code, centered
      const logoX = (dimensions.width - logoWidthMM) / 2;
      const logoY = qrPosition.y - logoHeightMM - 8; // 8mm gap (reduced)

      // Add compressed logo to PDF
      pdf.addImage(optimizedLogoUrl, 'JPEG', logoX, logoY, logoWidthMM, logoHeightMM);
      
      console.debug(`Logo optimized: ${logoWidth}x${logoHeight} -> ${logoWidthMM.toFixed(1)}x${logoHeightMM.toFixed(1)}mm`);
    } catch (error) {
      // If logo fails to load, continue without it (prevents PDF failure)
      console.warn('Failed to load/optimize logo:', error);
    }
  }

  /**
   * Add optimized QR code to PDF with size constraints
   * SIZE OPTIMIZATION: Use optimal resolution and compression
   */
  private async addOptimizedQRCodeToPDF(pdf: jsPDF, qrDataUrl: string, position: QRPosition): Promise<void> {
    try {
      // Extract base64 data from QR data URL
      const base64Data = qrDataUrl.replace(/^data:image\/png;base64,/, '');
      const qrBuffer = Buffer.from(base64Data, 'base64');
      
      // Load QR image and optimize
      const qrImage = await loadImage(qrBuffer);
      
      // Create optimized canvas with target size
      const targetSize = this.PDF_OPTIMIZATION.qrOptimalSize;
      const canvas = createCanvas(targetSize, targetSize);
      const ctx = canvas.getContext('2d');
      
      // Set white background (ensures proper contrast)
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, targetSize, targetSize);
      
      // Draw QR code with antialiasing disabled for crisp edges
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(qrImage, 0, 0, targetSize, targetSize);
      
      // Convert to optimized PNG (PNG is better for QR codes than JPEG)
      const optimizedQRUrl = canvas.toDataURL('image/png');
      
      // Add QR code to PDF with optimal size
      pdf.addImage(optimizedQRUrl, 'PNG', position.x, position.y, position.size, position.size);
      
      console.debug(`QR code optimized: ${targetSize}x${targetSize} -> ${position.size.toFixed(1)}mm`);
    } catch (error) {
      throw new QRValidationError(
        'Failed to add optimized QR code to PDF',
        'QR_PDF_OPTIMIZATION_FAILED',
        { originalError: error }
      );
    }
  }

  /**
   * Add custom text to PDF
   */
  private addCustomText(
    pdf: jsPDF,
    text: string,
    color: string,
    dimensions: PDFDimensions,
    qrPosition: QRPosition
  ): void {
    // Set text color
    const rgb = this.hexToRgb(color);
    pdf.setTextColor(rgb.r, rgb.g, rgb.b);

    // Set font
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');

    // Position text below QR code
    const textY = qrPosition.y + qrPosition.size + 15;
    
    // Center text
    const textWidth = pdf.getTextWidth(text);
    const textX = (dimensions.width - textWidth) / 2;

    pdf.text(text, textX, textY);
  }

  /**
   * Add store information to PDF
   */
  private addStoreInfo(
    pdf: jsPDF,
    store: QRCodeStore,
    color: string,
    dimensions: PDFDimensions,
    qrPosition: QRPosition
  ): void {
    const rgb = this.hexToRgb(color);
    pdf.setTextColor(rgb.r, rgb.g, rgb.b);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');

    const infoY = qrPosition.y + qrPosition.size + 30;
    const storeInfo = `Store: ${store.name}`;
    const versionInfo = `QR Version: ${store.qr_version}`;

    // Center store info
    const storeInfoWidth = pdf.getTextWidth(storeInfo);
    const storeInfoX = (dimensions.width - storeInfoWidth) / 2;
    pdf.text(storeInfo, storeInfoX, infoY);

    // Center version info
    const versionInfoWidth = pdf.getTextWidth(versionInfo);
    const versionInfoX = (dimensions.width - versionInfoWidth) / 2;
    pdf.text(versionInfo, versionInfoX, infoY + 5);
  }

  /**
   * Add footer with generation info
   */
  private addFooter(
    pdf: jsPDF,
    store: QRCodeStore,
    dimensions: PDFDimensions,
    color: string
  ): void {
    const rgb = this.hexToRgb(color);
    pdf.setTextColor(rgb.r, rgb.g, rgb.b);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');

    const footerY = dimensions.height - 10;
    const generatedText = `Generated: ${new Date().toLocaleString()}`;
    const poweredByText = 'Powered by Vocilia';

    // Left align generated text
    pdf.text(generatedText, 10, footerY);

    // Right align powered by text
    const poweredByWidth = pdf.getTextWidth(poweredByText);
    pdf.text(poweredByText, dimensions.width - poweredByWidth - 10, footerY);
  }

  /**
   * Create default template for business
   */
  private async createDefaultTemplate(businessId: string): Promise<QRPrintTemplate> {
    const defaultTemplate: Omit<QRPrintTemplate, 'id' | 'created_at' | 'updated_at'> = {
      business_id: businessId,
      template_name: 'Default Template',
      page_size: 'A4',
      qr_size: 200,
      include_logo: false,
      logo_url: null,
      custom_text: 'Scan to leave feedback',
      text_color: '#000000',
      background_color: '#FFFFFF',
      border_style: 'thin',
      is_default: true
    };

    return await this.database.createTemplate(defaultTemplate);
  }

  /**
   * Validate template data
   */
  private validateTemplate(template: Omit<QRPrintTemplate, 'id' | 'created_at' | 'updated_at'>): void {
    if (!template.business_id || !template.template_name) {
      throw new QRValidationError(
        'Business ID and template name are required',
        'TEMPLATE_VALIDATION_FAILED',
        { businessId: template.business_id, templateName: template.template_name }
      );
    }

    if (template.qr_size < 50 || template.qr_size > 300) {
      throw new QRValidationError(
        'QR size must be between 50 and 300 pixels',
        'INVALID_QR_SIZE',
        { qrSize: template.qr_size }
      );
    }

    if (template.custom_text && template.custom_text.length > 200) {
      throw new QRValidationError(
        'Custom text must be 200 characters or less',
        'CUSTOM_TEXT_TOO_LONG',
        { textLength: template.custom_text.length }
      );
    }

    // Validate color formats
    if (!this.isValidHexColor(template.text_color)) {
      throw new QRValidationError(
        'Invalid text color format',
        'INVALID_COLOR_FORMAT',
        { color: template.text_color }
      );
    }

    if (!this.isValidHexColor(template.background_color)) {
      throw new QRValidationError(
        'Invalid background color format',
        'INVALID_COLOR_FORMAT',
        { color: template.background_color }
      );
    }
  }

  /**
   * Convert hex color to RGB
   */
  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  }

  /**
   * Validate hex color format
   */
  private isValidHexColor(hex: string): boolean {
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex);
  }

  /**
   * Health check for PDF service
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    pdf_generation_working: boolean;
    canvas_available: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    try {
      // Test PDF generation
      const testPdf = new jsPDF();
      testPdf.text('Test', 10, 10);
      const pdfWorking = testPdf.output().length > 0;

      if (!pdfWorking) {
        errors.push('PDF generation not working');
        status = 'unhealthy';
      }

      // Test canvas availability
      let canvasAvailable = false;
      try {
        const testCanvas = createCanvas(100, 100);
        canvasAvailable = !!testCanvas;
      } catch (error: any) {
        errors.push(`Canvas not available: ${error.message}`);
        status = status === 'healthy' ? 'degraded' : 'unhealthy';
      }

      return {
        status,
        pdf_generation_working: pdfWorking,
        canvas_available: canvasAvailable,
        errors
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        pdf_generation_working: false,
        canvas_available: false,
        errors: [`Health check failed: ${error.message}`]
      };
    }
  }
}

// Factory function
export function createPDFTemplateService(
  database: QRDatabase,
  qrGenerator: QRGeneratorService
): PDFTemplateService {
  return new PDFTemplateService(database, qrGenerator);
}