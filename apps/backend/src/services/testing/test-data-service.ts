import { TestDataSet, CreateDataSetRequest, TestDataGenerator } from '@vocilia/types/testing';
import { TestDataSetModel } from '@vocilia/database/testing';
import { swedishTestData } from '../../../tests/generators/swedish-data';
import { v4 as uuidv4 } from 'uuid';

export interface GeneratedTestData {
  id: string;
  type: string;
  data: any;
  metadata: {
    generatedAt: string;
    schema: string;
    size: number;
    version: string;
  };
}

export interface DataGenerationOptions {
  count?: number;
  locale?: string;
  seed?: number;
  format?: 'json' | 'csv' | 'xml' | 'yaml';
  includeMetadata?: boolean;
  customFields?: Record<string, any>;
}

export class TestDataService {
  private dataSetModel: TestDataSetModel;
  private generators: Map<string, TestDataGenerator>;

  constructor() {
    this.dataSetModel = new TestDataSetModel();
    this.generators = new Map();
    this.initializeGenerators();
  }

  private initializeGenerators(): void {
    // Register built-in generators
    this.registerGenerator('swedish-person', {
      name: 'Swedish Person',
      description: 'Generates Swedish person data with valid personal numbers',
      schema: {
        firstName: 'string',
        lastName: 'string',
        personnummer: 'string',
        email: 'string',
        phone: 'string',
        address: 'object'
      },
      generator: (options: DataGenerationOptions) => swedishTestData.generatePerson(options)
    });

    this.registerGenerator('swedish-business', {
      name: 'Swedish Business',
      description: 'Generates Swedish business data with valid organization numbers',
      schema: {
        name: 'string',
        organisationsnummer: 'string',
        address: 'object',
        contact: 'object',
        vatNumber: 'string'
      },
      generator: (options: DataGenerationOptions) => swedishTestData.generateBusiness(options)
    });

    this.registerGenerator('vocilia-feedback', {
      name: 'Vocilia Feedback Session',
      description: 'Generates realistic feedback session data for Vocilia testing',
      schema: {
        sessionId: 'string',
        customerId: 'string',
        storeId: 'string',
        transactionId: 'string',
        feedback: 'object',
        rating: 'number',
        timestamp: 'string'
      },
      generator: (options: DataGenerationOptions) => this.generateVociliaFeedback(options)
    });

    this.registerGenerator('vocilia-transaction', {
      name: 'Vocilia Transaction',
      description: 'Generates realistic transaction data for Vocilia testing',
      schema: {
        transactionId: 'string',
        customerId: 'string',
        storeId: 'string',
        amount: 'number',
        currency: 'string',
        items: 'array',
        timestamp: 'string'
      },
      generator: (options: DataGenerationOptions) => this.generateVociliaTransaction(options)
    });

    this.registerGenerator('qr-scan-event', {
      name: 'QR Scan Event',
      description: 'Generates QR code scan events for testing verification flows',
      schema: {
        scanId: 'string',
        qrCode: 'string',
        customerId: 'string',
        storeId: 'string',
        deviceInfo: 'object',
        location: 'object',
        timestamp: 'string'
      },
      generator: (options: DataGenerationOptions) => this.generateQRScanEvent(options)
    });
  }

  async createDataSet(data: CreateDataSetRequest): Promise<TestDataSet> {
    const dataSet: TestDataSet = {
      id: uuidv4(),
      name: data.name,
      description: data.description,
      data_type: data.data_type,
      schema: data.schema,
      generation_rules: data.generation_rules,
      size: data.size || 100,
      format: data.format || 'json',
      tags: data.tags || [],
      environment: data.environment || 'test',
      status: 'active',
      created_by: data.created_by,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    return await this.dataSetModel.create(dataSet);
  }

  async getDataSets(
    data_type?: string,
    environment?: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ dataSets: TestDataSet[]; total: number }> {
    const filters = {};
    if (data_type) filters['data_type'] = data_type;
    if (environment) filters['environment'] = environment;

    const { data, total } = await this.dataSetModel.findMany(filters, limit, offset);
    return { dataSets: data, total };
  }

  async getDataSetById(id: string): Promise<TestDataSet> {
    const dataSet = await this.dataSetModel.findById(id);
    if (!dataSet) {
      throw new Error(`Test data set with ID ${id} not found`);
    }
    return dataSet;
  }

  async generateData(
    dataSetId: string, 
    options: DataGenerationOptions = {}
  ): Promise<GeneratedTestData[]> {
    const dataSet = await this.getDataSetById(dataSetId);
    const generator = this.generators.get(dataSet.data_type);
    
    if (!generator) {
      throw new Error(`No generator found for data type: ${dataSet.data_type}`);
    }

    const count = options.count || dataSet.size;
    const generatedData: GeneratedTestData[] = [];

    for (let i = 0; i < count; i++) {
      const data = await generator.generator({
        ...options,
        seed: options.seed ? options.seed + i : undefined
      });

      generatedData.push({
        id: `${dataSetId}-${i}`,
        type: dataSet.data_type,
        data,
        metadata: {
          generatedAt: new Date().toISOString(),
          schema: JSON.stringify(dataSet.schema),
          size: count,
          version: '1.0.0'
        }
      });
    }

    return generatedData;
  }

  async generateDataByType(
    dataType: string, 
    count: number = 10, 
    options: DataGenerationOptions = {}
  ): Promise<GeneratedTestData[]> {
    const generator = this.generators.get(dataType);
    
    if (!generator) {
      throw new Error(`No generator found for data type: ${dataType}`);
    }

    const generatedData: GeneratedTestData[] = [];

    for (let i = 0; i < count; i++) {
      const data = await generator.generator({
        ...options,
        seed: options.seed ? options.seed + i : undefined
      });

      generatedData.push({
        id: `${dataType}-${Date.now()}-${i}`,
        type: dataType,
        data,
        metadata: {
          generatedAt: new Date().toISOString(),
          schema: JSON.stringify(generator.schema),
          size: count,
          version: '1.0.0'
        }
      });
    }

    return generatedData;
  }

  registerGenerator(type: string, generator: TestDataGenerator): void {
    this.generators.set(type, generator);
  }

  getAvailableGenerators(): Array<{ type: string; name: string; description: string; schema: any }> {
    return Array.from(this.generators.entries()).map(([type, generator]) => ({
      type,
      name: generator.name,
      description: generator.description,
      schema: generator.schema
    }));
  }

  async exportData(
    dataSetId: string, 
    format: 'json' | 'csv' | 'xml' | 'yaml' = 'json',
    options: DataGenerationOptions = {}
  ): Promise<string> {
    const generatedData = await this.generateData(dataSetId, options);
    
    switch (format) {
      case 'json':
        return JSON.stringify(generatedData.map(item => item.data), null, 2);
      case 'csv':
        return this.convertToCSV(generatedData.map(item => item.data));
      case 'xml':
        return this.convertToXML(generatedData.map(item => item.data));
      case 'yaml':
        return this.convertToYAML(generatedData.map(item => item.data));
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  private generateVociliaFeedback(options: DataGenerationOptions): any {
    return {
      sessionId: uuidv4(),
      customerId: uuidv4(),
      storeId: uuidv4(),
      transactionId: uuidv4(),
      feedback: {
        overall_rating: Math.floor(Math.random() * 5) + 1,
        service_rating: Math.floor(Math.random() * 5) + 1,
        product_rating: Math.floor(Math.random() * 5) + 1,
        comments: swedishTestData.generateComment(),
        categories: swedishTestData.generateFeedbackCategories()
      },
      rating: Math.floor(Math.random() * 10) + 1,
      timestamp: new Date().toISOString(),
      duration: Math.floor(Math.random() * 300) + 30, // 30-330 seconds
      language: 'sv-SE'
    };
  }

  private generateVociliaTransaction(options: DataGenerationOptions): any {
    const itemCount = Math.floor(Math.random() * 5) + 1;
    const items = Array.from({ length: itemCount }, () => ({
      name: swedishTestData.generateProductName(),
      price: Math.floor(Math.random() * 10000) + 500, // 5-105 SEK
      quantity: Math.floor(Math.random() * 3) + 1
    }));

    const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    return {
      transactionId: uuidv4(),
      customerId: uuidv4(),
      storeId: uuidv4(),
      amount: total,
      currency: 'SEK',
      items,
      timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(), // Within last 30 days
      paymentMethod: swedishTestData.generatePaymentMethod(),
      receiptNumber: swedishTestData.generateReceiptNumber()
    };
  }

  private generateQRScanEvent(options: DataGenerationOptions): any {
    return {
      scanId: uuidv4(),
      qrCode: swedishTestData.generateQRCode(),
      customerId: uuidv4(),
      storeId: uuidv4(),
      deviceInfo: {
        userAgent: swedishTestData.generateUserAgent(),
        platform: swedishTestData.generatePlatform(),
        screenResolution: swedishTestData.generateScreenResolution()
      },
      location: {
        city: swedishTestData.generateSwedishCity(),
        coordinates: swedishTestData.generateSwedishCoordinates()
      },
      timestamp: new Date().toISOString(),
      verified: Math.random() > 0.1 // 90% verification success rate
    };
  }

  private convertToCSV(data: any[]): string {
    if (!data.length) return '';
    
    const headers = Object.keys(data[0]);
    const rows = data.map(item => 
      headers.map(header => 
        typeof item[header] === 'object' 
          ? JSON.stringify(item[header]) 
          : item[header]
      ).join(',')
    );
    
    return [headers.join(','), ...rows].join('\n');
  }

  private convertToXML(data: any[]): string {
    const xmlItems = data.map(item => {
      const properties = Object.entries(item)
        .map(([key, value]) => `<${key}>${typeof value === 'object' ? JSON.stringify(value) : value}</${key}>`)
        .join('\n    ');
      return `  <item>\n    ${properties}\n  </item>`;
    }).join('\n');
    
    return `<?xml version="1.0" encoding="UTF-8"?>\n<data>\n${xmlItems}\n</data>`;
  }

  private convertToYAML(data: any[]): string {
    // Simple YAML conversion - in production, use a proper YAML library
    return data.map(item => 
      '- ' + Object.entries(item)
        .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`)
        .join('\n  ')
    ).join('\n');
  }

  async deleteDataSet(id: string): Promise<void> {
    const existing = await this.dataSetModel.findById(id);
    if (!existing) {
      throw new Error(`Test data set with ID ${id} not found`);
    }

    await this.dataSetModel.delete(id);
  }

  async updateDataSet(id: string, data: Partial<TestDataSet>): Promise<TestDataSet> {
    const existing = await this.dataSetModel.findById(id);
    if (!existing) {
      throw new Error(`Test data set with ID ${id} not found`);
    }

    const updated = {
      ...data,
      updated_at: new Date().toISOString()
    };

    await this.dataSetModel.update(id, updated);
    return this.getDataSetById(id);
  }
}