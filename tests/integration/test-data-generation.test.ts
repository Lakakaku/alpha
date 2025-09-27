import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { TestDataService } from '../../apps/backend/src/services/testing/test-data-service';
import { supabase } from '../setup';

describe('Test Data Generation Integration', () => {
  let testDataService: TestDataService;

  beforeAll(async () => {
    testDataService = new TestDataService();
  });

  beforeEach(async () => {
    await supabase.from('test_data_records').delete().neq('id', '');
    await supabase.from('test_datasets').delete().neq('id', '');
  });

  afterAll(async () => {
    await supabase.from('test_data_records').delete().neq('id', '');
    await supabase.from('test_datasets').delete().neq('id', '');
  });

  it('should generate Swedish customer test data', async () => {
    const dataset = await testDataService.createDataset({
      name: 'Swedish Customers',
      category: 'users',
      schema: {
        name: 'string',
        phone: 'string',
        email: 'string',
        address: 'object'
      },
      generatorConfig: {
        locale: 'sv-SE',
        seed: 12345,
        rules: {
          phonePattern: '+46\\d{9}',
          emailDomain: 'example.se'
        }
      },
      sampleSize: 100,
      refreshStrategy: 'static',
      enabled: true
    });

    expect(dataset.generatorConfig.locale).toBe('sv-SE');
    expect(dataset.sampleSize).toBe(100);

    // Generate data records
    await testDataService.generateDataRecords(dataset.id);
    
    const records = await testDataService.getDataRecords(dataset.id, { limit: 10 });
    expect(records.length).toBeGreaterThan(0);
    expect(records.length).toBeLessThanOrEqual(10);
  });
});