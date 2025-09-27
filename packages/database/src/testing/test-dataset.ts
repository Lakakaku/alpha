import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types';

export interface TestDataSet {
  id: string;
  name: string;
  category: 'users' | 'stores' | 'transactions' | 'feedback' | 'admin';
  schema: Record<string, any>;
  generatorConfig: {
    locale: string;
    seed: number;
    rules: Record<string, any>;
  };
  sampleSize: number;
  refreshStrategy: 'static' | 'per-run' | 'per-test';
  constraints: Record<string, any>;
  tags: string[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTestDataSetRequest {
  name: string;
  category: 'users' | 'stores' | 'transactions' | 'feedback' | 'admin';
  schema: Record<string, any>;
  generatorConfig: {
    locale: string;
    seed: number;
    rules?: Record<string, any>;
  };
  sampleSize: number;
  refreshStrategy: 'static' | 'per-run' | 'per-test';
  constraints?: Record<string, any>;
  tags?: string[];
  enabled?: boolean;
}

export interface UpdateTestDataSetRequest {
  name?: string;
  category?: 'users' | 'stores' | 'transactions' | 'feedback' | 'admin';
  schema?: Record<string, any>;
  generatorConfig?: {
    locale?: string;
    seed?: number;
    rules?: Record<string, any>;
  };
  sampleSize?: number;
  refreshStrategy?: 'static' | 'per-run' | 'per-test';
  constraints?: Record<string, any>;
  tags?: string[];
  enabled?: boolean;
}

export interface TestDataRecord {
  id: string;
  dataSetId: string;
  data: Record<string, any>;
  checksum: string;
  generatedAt: string;
  lastUsed: string | null;
}

export interface CreateTestDataRecordRequest {
  dataSetId: string;
  data: Record<string, any>;
  checksum: string;
}

export class TestDataSetModel {
  constructor(private supabase: SupabaseClient<Database>) {}

  async create(data: CreateTestDataSetRequest): Promise<TestDataSet> {
    // Validate sample size
    if (data.sampleSize <= 0) {
      throw new Error('Sample size must be positive');
    }

    // Validate locale format
    if (!data.generatorConfig.locale.match(/^[a-z]{2}-[A-Z]{2}$/)) {
      throw new Error('Locale must be in format xx-XX (e.g., sv-SE)');
    }

    const { data: dataset, error } = await this.supabase
      .from('test_datasets')
      .insert({
        name: data.name,
        category: data.category,
        schema: data.schema,
        generator_config: data.generatorConfig,
        sample_size: data.sampleSize,
        refresh_strategy: data.refreshStrategy,
        constraints: data.constraints || {},
        tags: data.tags || [],
        enabled: data.enabled ?? true,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create test dataset: ${error.message}`);
    }

    return this.mapToTestDataSet(dataset);
  }

  async findById(id: string): Promise<TestDataSet | null> {
    const { data: dataset, error } = await this.supabase
      .from('test_datasets')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to find test dataset: ${error.message}`);
    }

    return this.mapToTestDataSet(dataset);
  }

  async findAll(params?: {
    category?: string;
    refreshStrategy?: string;
    enabled?: boolean;
    tags?: string[];
    limit?: number;
    offset?: number;
  }): Promise<TestDataSet[]> {
    let query = this.supabase.from('test_datasets').select('*');

    if (params?.category) {
      query = query.eq('category', params.category);
    }
    if (params?.refreshStrategy) {
      query = query.eq('refresh_strategy', params.refreshStrategy);
    }
    if (params?.enabled !== undefined) {
      query = query.eq('enabled', params.enabled);
    }
    if (params?.tags && params.tags.length > 0) {
      query = query.overlaps('tags', params.tags);
    }
    if (params?.limit) {
      query = query.limit(params.limit);
    }
    if (params?.offset) {
      query = query.range(params.offset, (params.offset + (params.limit || 10)) - 1);
    }

    const { data: datasets, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch test datasets: ${error.message}`);
    }

    return datasets?.map(dataset => this.mapToTestDataSet(dataset)) || [];
  }

  async update(id: string, data: UpdateTestDataSetRequest): Promise<TestDataSet> {
    // Validate sample size if provided
    if (data.sampleSize !== undefined && data.sampleSize <= 0) {
      throw new Error('Sample size must be positive');
    }

    // Validate locale format if provided
    if (data.generatorConfig?.locale && !data.generatorConfig.locale.match(/^[a-z]{2}-[A-Z]{2}$/)) {
      throw new Error('Locale must be in format xx-XX (e.g., sv-SE)');
    }

    const updateData: any = {};
    
    if (data.name !== undefined) updateData.name = data.name;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.schema !== undefined) updateData.schema = data.schema;
    if (data.sampleSize !== undefined) updateData.sample_size = data.sampleSize;
    if (data.refreshStrategy !== undefined) updateData.refresh_strategy = data.refreshStrategy;
    if (data.constraints !== undefined) updateData.constraints = data.constraints;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.enabled !== undefined) updateData.enabled = data.enabled;

    // Handle nested generator config updates
    if (data.generatorConfig) {
      const currentDataset = await this.findById(id);
      if (!currentDataset) {
        throw new Error('Dataset not found');
      }
      
      updateData.generator_config = {
        ...currentDataset.generatorConfig,
        ...data.generatorConfig,
        rules: data.generatorConfig.rules !== undefined 
          ? data.generatorConfig.rules 
          : currentDataset.generatorConfig.rules,
      };
    }

    const { data: dataset, error } = await this.supabase
      .from('test_datasets')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update test dataset: ${error.message}`);
    }

    return this.mapToTestDataSet(dataset);
  }

  async delete(id: string): Promise<void> {
    // First delete all associated records
    await this.deleteAllRecords(id);

    const { error } = await this.supabase
      .from('test_datasets')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete test dataset: ${error.message}`);
    }
  }

  async findByCategory(category: 'users' | 'stores' | 'transactions' | 'feedback' | 'admin'): Promise<TestDataSet[]> {
    return this.findAll({ category, enabled: true });
  }

  async findByTags(tags: string[]): Promise<TestDataSet[]> {
    return this.findAll({ tags, enabled: true });
  }

  async findEnabled(): Promise<TestDataSet[]> {
    return this.findAll({ enabled: true });
  }

  // Data record management methods
  async createRecord(data: CreateTestDataRecordRequest): Promise<TestDataRecord> {
    const { data: record, error } = await this.supabase
      .from('test_data_records')
      .insert({
        dataset_id: data.dataSetId,
        data: data.data,
        checksum: data.checksum,
        generated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create test data record: ${error.message}`);
    }

    return this.mapToTestDataRecord(record);
  }

  async findRecords(dataSetId: string, limit?: number): Promise<TestDataRecord[]> {
    let query = this.supabase
      .from('test_data_records')
      .select('*')
      .eq('dataset_id', dataSetId);

    if (limit) {
      query = query.limit(limit);
    }

    const { data: records, error } = await query.order('generated_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch test data records: ${error.message}`);
    }

    return records?.map(record => this.mapToTestDataRecord(record)) || [];
  }

  async getRandomRecords(dataSetId: string, count: number = 1): Promise<TestDataRecord[]> {
    const { data: records, error } = await this.supabase
      .rpc('get_random_test_data_records', {
        dataset_id: dataSetId,
        record_count: count,
      });

    if (error) {
      throw new Error(`Failed to get random test data records: ${error.message}`);
    }

    return records?.map((record: any) => this.mapToTestDataRecord(record)) || [];
  }

  async markRecordUsed(recordId: string): Promise<void> {
    const { error } = await this.supabase
      .from('test_data_records')
      .update({ last_used: new Date().toISOString() })
      .eq('id', recordId);

    if (error) {
      throw new Error(`Failed to mark record as used: ${error.message}`);
    }
  }

  async deleteAllRecords(dataSetId: string): Promise<void> {
    const { error } = await this.supabase
      .from('test_data_records')
      .delete()
      .eq('dataset_id', dataSetId);

    if (error) {
      throw new Error(`Failed to delete test data records: ${error.message}`);
    }
  }

  async getDatasetStatistics(dataSetId: string): Promise<{
    totalRecords: number;
    lastGenerated: string | null;
    lastUsed: string | null;
    usageCount: number;
  }> {
    const records = await this.findRecords(dataSetId);
    
    const stats = {
      totalRecords: records.length,
      lastGenerated: records.length > 0 ? records[0].generatedAt : null,
      lastUsed: records
        .filter(r => r.lastUsed)
        .sort((a, b) => new Date(b.lastUsed!).getTime() - new Date(a.lastUsed!).getTime())[0]?.lastUsed || null,
      usageCount: records.filter(r => r.lastUsed).length,
    };

    return stats;
  }

  async validateDataIntegrity(dataSetId: string): Promise<{
    valid: boolean;
    invalidRecords: string[];
    errors: string[];
  }> {
    const dataset = await this.findById(dataSetId);
    if (!dataset) {
      return { valid: false, invalidRecords: [], errors: ['Dataset not found'] };
    }

    const records = await this.findRecords(dataSetId);
    const invalidRecords: string[] = [];
    const errors: string[] = [];

    for (const record of records) {
      // Validate checksum
      const expectedChecksum = this.calculateChecksum(record.data);
      if (record.checksum !== expectedChecksum) {
        invalidRecords.push(record.id);
        errors.push(`Record ${record.id}: checksum mismatch`);
      }

      // Validate against schema (basic validation)
      const schemaKeys = Object.keys(dataset.schema);
      const dataKeys = Object.keys(record.data);
      
      for (const key of schemaKeys) {
        if (!dataKeys.includes(key)) {
          invalidRecords.push(record.id);
          errors.push(`Record ${record.id}: missing required field '${key}'`);
        }
      }
    }

    return {
      valid: invalidRecords.length === 0,
      invalidRecords: [...new Set(invalidRecords)],
      errors,
    };
  }

  private calculateChecksum(data: Record<string, any>): string {
    // Simple checksum calculation - in production, use a proper hash function
    const jsonString = JSON.stringify(data, Object.keys(data).sort());
    let hash = 0;
    for (let i = 0; i < jsonString.length; i++) {
      const char = jsonString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

  private mapToTestDataSet(row: any): TestDataSet {
    return {
      id: row.id,
      name: row.name,
      category: row.category,
      schema: row.schema,
      generatorConfig: row.generator_config,
      sampleSize: row.sample_size,
      refreshStrategy: row.refresh_strategy,
      constraints: row.constraints || {},
      tags: row.tags || [],
      enabled: row.enabled,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapToTestDataRecord(row: any): TestDataRecord {
    return {
      id: row.id,
      dataSetId: row.dataset_id,
      data: row.data,
      checksum: row.checksum,
      generatedAt: row.generated_at,
      lastUsed: row.last_used,
    };
  }
}