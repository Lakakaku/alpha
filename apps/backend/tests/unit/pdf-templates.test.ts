import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { jsPDF } from 'jspdf';
import { PDFTemplateService } from '../../src/services/qr/pdf-template.service';
import { QRDatabaseUtils } from '../../src/config/qr-database';

// Mock dependencies
jest.mock('jspdf');
jest.mock('../../src/config/qr-database');

const mockJsPDF = jsPDF as jest.MockedClass<typeof jsPDF>;
const mockQRDatabaseUtils = QRDatabaseUtils as jest.Mocked<typeof QRDatabaseUtils>;

describe('PDFTemplateService', () => {
  let pdfTemplateService: PDFTemplateService;
  const mockBusinessId = 'business-123';
  const mockTemplateId = 'template-456';

  beforeEach(() => {
    pdfTemplateService = new PDFTemplateService();
    jest.clearAllMocks();

    // Mock jsPDF instance
    const mockPDFInstance = {
      setFontSize: jest.fn(),
      setFont: jest.fn(),
      setTextColor: jest.fn(),
      setFillColor: jest.fn(),
      rect: jest.fn(),
      text: jest.fn(),
      addImage: jest.fn(),
      save: jest.fn(),
      output: jest.fn().mockReturnValue('mock-pdf-blob'),
      internal: {
        pageSize: { width: 210, height: 297 }
      }
    };

    mockJsPDF.mockReturnValue(mockPDFInstance as any);

    // Mock database operations
    mockQRDatabaseUtils.getQRTemplate = jest.fn();
    mockQRDatabaseUtils.saveQRTemplate = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('generatePDF', () => {
    test('should generate PDF with default template successfully', async () => {
      // Arrange
      const qrCodeData = 'data:image/png;base64,mockqrcodedata';
      const storeInfo = {
        id: 'store-123',
        name: 'Test Store',
        business_name: 'Test Business'
      };

      // Act
      const result = await pdfTemplateService.generatePDF(
        qrCodeData,
        storeInfo,
        mockBusinessId
      );

      // Assert
      expect(mockJsPDF).toHaveBeenCalledWith({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      expect(result).toEqual({
        pdfData: 'mock-pdf-blob',
        format: 'pdf',
        size_mb: expect.any(Number),
        template_used: 'default',
        generated_at: expect.any(String)
      });
    });

    test('should generate PDF with custom template', async () => {
      // Arrange
      const qrCodeData = 'data:image/png;base64,mockqrcodedata';
      const storeInfo = {
        id: 'store-123',
        name: 'Test Store',
        business_name: 'Test Business'
      };

      const customTemplate = {
        id: mockTemplateId,
        business_id: mockBusinessId,
        name: 'Custom Template',
        template_config: {
          layout: 'landscape',
          page_size: 'letter',
          colors: {
            primary: '#FF0000',
            secondary: '#00FF00',
            text: '#000000'
          },
          fonts: {
            title: { family: 'helvetica', size: 24 },
            subtitle: { family: 'helvetica', size: 14 },
            body: { family: 'helvetica', size: 12 }
          },
          elements: {
            show_logo: true,
            show_instructions: true,
            qr_size: 80,
            qr_position: { x: 50, y: 50 }
          }
        },
        is_default: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      mockQRDatabaseUtils.getQRTemplate.mockResolvedValue(customTemplate);

      // Act
      const result = await pdfTemplateService.generatePDF(
        qrCodeData,
        storeInfo,
        mockBusinessId,
        { templateId: mockTemplateId }
      );

      // Assert
      expect(mockQRDatabaseUtils.getQRTemplate).toHaveBeenCalledWith(mockTemplateId, mockBusinessId);
      expect(mockJsPDF).toHaveBeenCalledWith({
        orientation: 'landscape',
        unit: 'mm',
        format: 'letter'
      });
      expect(result.template_used).toBe('Custom Template');
    });

    test('should generate PDF with multiple QR codes', async () => {
      // Arrange
      const qrCodes = [
        {
          data: 'data:image/png;base64,qr1',
          store: { id: 'store-1', name: 'Store 1', business_name: 'Business' }
        },
        {
          data: 'data:image/png;base64,qr2',
          store: { id: 'store-2', name: 'Store 2', business_name: 'Business' }
        },
        {
          data: 'data:image/png;base64,qr3',
          store: { id: 'store-3', name: 'Store 3', business_name: 'Business' }
        }
      ];

      const mockPDFInstance = mockJsPDF.mock.results[0].value;

      // Act
      const result = await pdfTemplateService.generateMultiQRPDF(
        qrCodes,
        mockBusinessId
      );

      // Assert
      expect(mockPDFInstance.addImage).toHaveBeenCalledTimes(3);
      expect(result.qr_count).toBe(3);
      expect(result.pages).toBe(1); // Should fit on one page with default grid
    });

    test('should optimize PDF size to stay under 2MB limit', async () => {
      // Arrange
      const qrCodeData = 'data:image/png;base64,verylongqrcodedata'.repeat(1000);
      const storeInfo = {
        id: 'store-123',
        name: 'Test Store',
        business_name: 'Test Business'
      };

      // Mock large PDF output
      const mockPDFInstance = mockJsPDF.mock.results[0].value;
      const largePDFData = 'large-pdf-data'.repeat(100000); // Simulate large PDF
      mockPDFInstance.output.mockReturnValue(largePDFData);

      // Act
      const result = await pdfTemplateService.generatePDF(
        qrCodeData,
        storeInfo,
        mockBusinessId,
        { optimize: true }
      );

      // Assert
      expect(result.size_mb).toBeLessThan(2);
      expect(result.optimized).toBe(true);
    });

    test('should handle PDF generation within performance threshold', async () => {
      // Arrange
      const qrCodeData = 'data:image/png;base64,mockqrcodedata';
      const storeInfo = {
        id: 'store-123',
        name: 'Test Store',
        business_name: 'Test Business'
      };

      // Act
      const startTime = Date.now();
      await pdfTemplateService.generatePDF(qrCodeData, storeInfo, mockBusinessId);
      const duration = Date.now() - startTime;

      // Assert
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('createTemplate', () => {
    test('should create new template successfully', async () => {
      // Arrange
      const templateConfig = {
        name: 'New Template',
        layout: 'portrait' as const,
        page_size: 'a4' as const,
        colors: {
          primary: '#0066CC',
          secondary: '#FFFFFF',
          text: '#333333'
        },
        fonts: {
          title: { family: 'helvetica', size: 20 },
          subtitle: { family: 'helvetica', size: 14 },
          body: { family: 'helvetica', size: 12 }
        },
        elements: {
          show_logo: true,
          show_instructions: true,
          qr_size: 60,
          qr_position: { x: 105, y: 100 }
        }
      };

      const expectedTemplate = {
        id: 'new-template-id',
        business_id: mockBusinessId,
        name: templateConfig.name,
        template_config: {
          layout: templateConfig.layout,
          page_size: templateConfig.page_size,
          colors: templateConfig.colors,
          fonts: templateConfig.fonts,
          elements: templateConfig.elements
        },
        is_default: false,
        created_at: expect.any(String),
        updated_at: expect.any(String)
      };

      mockQRDatabaseUtils.saveQRTemplate.mockResolvedValue(expectedTemplate);

      // Act
      const result = await pdfTemplateService.createTemplate(templateConfig, mockBusinessId);

      // Assert
      expect(mockQRDatabaseUtils.saveQRTemplate).toHaveBeenCalledWith({
        business_id: mockBusinessId,
        name: templateConfig.name,
        template_config: expect.objectContaining({
          layout: templateConfig.layout,
          page_size: templateConfig.page_size,
          colors: templateConfig.colors
        }),
        is_default: false
      });
      expect(result).toEqual(expectedTemplate);
    });

    test('should validate template configuration', async () => {
      // Arrange
      const invalidConfig = {
        name: '', // Invalid: empty name
        layout: 'invalid' as any,
        page_size: 'invalid' as any,
        colors: {
          primary: 'not-a-color' // Invalid color format
        }
      };

      // Act & Assert
      await expect(
        pdfTemplateService.createTemplate(invalidConfig, mockBusinessId)
      ).rejects.toThrow('Invalid template configuration');
    });
  });

  describe('updateTemplate', () => {
    test('should update existing template successfully', async () => {
      // Arrange
      const existingTemplate = {
        id: mockTemplateId,
        business_id: mockBusinessId,
        name: 'Old Template',
        template_config: {
          layout: 'portrait',
          colors: { primary: '#000000' }
        },
        is_default: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      const updates = {
        name: 'Updated Template',
        template_config: {
          layout: 'landscape' as const,
          colors: { primary: '#FF0000' }
        }
      };

      const updatedTemplate = {
        ...existingTemplate,
        ...updates,
        updated_at: '2024-01-02T00:00:00Z'
      };

      mockQRDatabaseUtils.getQRTemplate.mockResolvedValue(existingTemplate);
      mockQRDatabaseUtils.saveQRTemplate.mockResolvedValue(updatedTemplate);

      // Act
      const result = await pdfTemplateService.updateTemplate(
        mockTemplateId,
        updates,
        mockBusinessId
      );

      // Assert
      expect(mockQRDatabaseUtils.getQRTemplate).toHaveBeenCalledWith(mockTemplateId, mockBusinessId);
      expect(mockQRDatabaseUtils.saveQRTemplate).toHaveBeenCalledWith({
        id: mockTemplateId,
        business_id: mockBusinessId,
        name: updates.name,
        template_config: updates.template_config,
        is_default: false
      });
      expect(result).toEqual(updatedTemplate);
    });

    test('should prevent updating non-existent template', async () => {
      // Arrange
      mockQRDatabaseUtils.getQRTemplate.mockRejectedValue(new Error('Template not found'));

      // Act & Assert
      await expect(
        pdfTemplateService.updateTemplate(
          'non-existent-id',
          { name: 'Updated' },
          mockBusinessId
        )
      ).rejects.toThrow('Template not found');
    });
  });

  describe('generateMultiQRPDF', () => {
    test('should generate PDF with grid layout for multiple QR codes', async () => {
      // Arrange
      const qrCodes = Array.from({ length: 6 }, (_, i) => ({
        data: `data:image/png;base64,qr${i}`,
        store: {
          id: `store-${i}`,
          name: `Store ${i + 1}`,
          business_name: 'Test Business'
        }
      }));

      const mockPDFInstance = mockJsPDF.mock.results[0].value;

      // Act
      const result = await pdfTemplateService.generateMultiQRPDF(
        qrCodes,
        mockBusinessId,
        { codesPerPage: 4 }
      );

      // Assert
      expect(mockPDFInstance.addImage).toHaveBeenCalledTimes(6);
      expect(result.qr_count).toBe(6);
      expect(result.pages).toBe(2); // 4 per page, so 6 codes = 2 pages
    });

    test('should handle empty QR code array', async () => {
      // Arrange
      const qrCodes: any[] = [];

      // Act & Assert
      await expect(
        pdfTemplateService.generateMultiQRPDF(qrCodes, mockBusinessId)
      ).rejects.toThrow('At least one QR code is required');
    });

    test('should optimize layout for different QR code counts', async () => {
      // Test different QR code counts to ensure optimal layout
      const testCases = [
        { count: 1, expectedPages: 1 },
        { count: 4, expectedPages: 1 },
        { count: 9, expectedPages: 1 },
        { count: 10, expectedPages: 2 }
      ];

      for (const testCase of testCases) {
        // Arrange
        const qrCodes = Array.from({ length: testCase.count }, (_, i) => ({
          data: `data:image/png;base64,qr${i}`,
          store: {
            id: `store-${i}`,
            name: `Store ${i + 1}`,
            business_name: 'Test Business'
          }
        }));

        // Act
        const result = await pdfTemplateService.generateMultiQRPDF(
          qrCodes,
          mockBusinessId
        );

        // Assert
        expect(result.pages).toBe(testCase.expectedPages);
        expect(result.qr_count).toBe(testCase.count);
      }
    });
  });

  describe('performance and optimization', () => {
    test('should compress images to reduce PDF size', async () => {
      // Arrange
      const largeQRCode = 'data:image/png;base64,' + 'A'.repeat(100000); // Large base64
      const storeInfo = {
        id: 'store-123',
        name: 'Test Store',
        business_name: 'Test Business'
      };

      const mockPDFInstance = mockJsPDF.mock.results[0].value;

      // Act
      await pdfTemplateService.generatePDF(
        largeQRCode,
        storeInfo,
        mockBusinessId,
        { compress: true }
      );

      // Assert
      expect(mockPDFInstance.addImage).toHaveBeenCalledWith(
        expect.any(String),
        'PNG',
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
        undefined,
        'FAST' // Compression setting
      );
    });

    test('should handle memory efficiently for large batch operations', async () => {
      // Arrange
      const largeQRBatch = Array.from({ length: 100 }, (_, i) => ({
        data: `data:image/png;base64,qr${i}`,
        store: {
          id: `store-${i}`,
          name: `Store ${i + 1}`,
          business_name: 'Test Business'
        }
      }));

      // Act
      const startMemory = process.memoryUsage().heapUsed;
      await pdfTemplateService.generateMultiQRPDF(largeQRBatch, mockBusinessId);
      const endMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (endMemory - startMemory) / 1024 / 1024; // MB

      // Assert
      expect(memoryIncrease).toBeLessThan(50); // Should not increase memory by more than 50MB
    });

    test('should generate PDF within size limit (2MB)', async () => {
      // Arrange
      const qrCodeData = 'data:image/png;base64,mockqrcodedata';
      const storeInfo = {
        id: 'store-123',
        name: 'Test Store',
        business_name: 'Test Business'
      };

      // Mock PDF output size calculation
      const mockPDFInstance = mockJsPDF.mock.results[0].value;
      const pdfBlob = 'pdf-data'.repeat(1000); // ~8KB
      mockPDFInstance.output.mockReturnValue(pdfBlob);

      // Act
      const result = await pdfTemplateService.generatePDF(
        qrCodeData,
        storeInfo,
        mockBusinessId
      );

      // Assert
      expect(result.size_mb).toBeLessThan(2);
    });
  });

  describe('template validation', () => {
    test('should validate color format in template', () => {
      // Arrange
      const invalidColors = [
        'not-a-hex-color',
        '#ZZZ',
        'rgb(300, 300, 300)',
        ''
      ];

      // Act & Assert
      for (const color of invalidColors) {
        expect(() => {
          pdfTemplateService.validateTemplateConfig({
            colors: { primary: color }
          } as any);
        }).toThrow('Invalid color format');
      }
    });

    test('should validate font configuration', () => {
      // Arrange
      const invalidFonts = [
        { family: '', size: 12 },
        { family: 'helvetica', size: -1 },
        { family: 'helvetica', size: 100 }, // Too large
        { family: 'invalid-font', size: 12 }
      ];

      // Act & Assert
      for (const font of invalidFonts) {
        expect(() => {
          pdfTemplateService.validateTemplateConfig({
            fonts: { title: font }
          } as any);
        }).toThrow();
      }
    });

    test('should validate element positioning', () => {
      // Arrange
      const invalidPositions = [
        { x: -10, y: 50 }, // Negative x
        { x: 50, y: -10 }, // Negative y
        { x: 300, y: 50 }, // X beyond page width
        { x: 50, y: 400 }  // Y beyond page height
      ];

      // Act & Assert
      for (const position of invalidPositions) {
        expect(() => {
          pdfTemplateService.validateTemplateConfig({
            elements: { qr_position: position }
          } as any);
        }).toThrow('Invalid position');
      }
    });
  });

  describe('error handling', () => {
    test('should handle jsPDF initialization errors', async () => {
      // Arrange
      mockJsPDF.mockImplementation(() => {
        throw new Error('PDF initialization failed');
      });

      const qrCodeData = 'data:image/png;base64,mockqrcodedata';
      const storeInfo = {
        id: 'store-123',
        name: 'Test Store',
        business_name: 'Test Business'
      };

      // Act & Assert
      await expect(
        pdfTemplateService.generatePDF(qrCodeData, storeInfo, mockBusinessId)
      ).rejects.toThrow('Failed to generate PDF: PDF initialization failed');
    });

    test('should handle invalid QR code data', async () => {
      // Arrange
      const invalidQRData = 'invalid-qr-data';
      const storeInfo = {
        id: 'store-123',
        name: 'Test Store',
        business_name: 'Test Business'
      };

      // Act & Assert
      await expect(
        pdfTemplateService.generatePDF(invalidQRData, storeInfo, mockBusinessId)
      ).rejects.toThrow('Invalid QR code data format');
    });

    test('should handle database errors gracefully', async () => {
      // Arrange
      mockQRDatabaseUtils.getQRTemplate.mockRejectedValue(new Error('Database error'));

      const qrCodeData = 'data:image/png;base64,mockqrcodedata';
      const storeInfo = {
        id: 'store-123',
        name: 'Test Store',
        business_name: 'Test Business'
      };

      // Act & Assert
      await expect(
        pdfTemplateService.generatePDF(
          qrCodeData,
          storeInfo,
          mockBusinessId,
          { templateId: 'template-123' }
        )
      ).rejects.toThrow('Database error');
    });
  });

  describe('template management', () => {
    test('should list templates for a business', async () => {
      // Arrange
      const mockTemplates = [
        {
          id: 'template-1',
          business_id: mockBusinessId,
          name: 'Template 1',
          template_config: {},
          is_default: true
        },
        {
          id: 'template-2',
          business_id: mockBusinessId,
          name: 'Template 2',
          template_config: {},
          is_default: false
        }
      ];

      mockQRDatabaseUtils.getQRTemplate = jest.fn()
        .mockResolvedValueOnce(mockTemplates[0])
        .mockResolvedValueOnce(mockTemplates[1]);

      // Act
      const result = await pdfTemplateService.listTemplates(mockBusinessId);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].is_default).toBe(true);
    });

    test('should delete template', async () => {
      // Arrange
      const templateToDelete = {
        id: mockTemplateId,
        business_id: mockBusinessId,
        name: 'Template to Delete',
        template_config: {},
        is_default: false
      };

      mockQRDatabaseUtils.getQRTemplate.mockResolvedValue(templateToDelete);

      // Act
      const result = await pdfTemplateService.deleteTemplate(mockTemplateId, mockBusinessId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toContain('deleted successfully');
    });

    test('should prevent deleting default template', async () => {
      // Arrange
      const defaultTemplate = {
        id: mockTemplateId,
        business_id: mockBusinessId,
        name: 'Default Template',
        template_config: {},
        is_default: true
      };

      mockQRDatabaseUtils.getQRTemplate.mockResolvedValue(defaultTemplate);

      // Act & Assert
      await expect(
        pdfTemplateService.deleteTemplate(mockTemplateId, mockBusinessId)
      ).rejects.toThrow('Cannot delete default template');
    });
  });
});