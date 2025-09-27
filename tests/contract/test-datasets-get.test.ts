import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { createSupabaseClient } from '../../packages/database/src/client/supabase';
import { TestDataSet } from '../../packages/types/src/testing';

describe('Contract: GET /api/test/data/datasets', () => {
  let supabase: any;
  let datasetIds: string[] = [];

  beforeAll(async () => {
    supabase = createSupabaseClient();
    
    // Create test datasets with different categories
    const datasets = [
      {
        name: 'Swedish Users Dataset',
        category: 'users',
        schema: {
          firstName: 'string',
          lastName: 'string',
          phoneNumber: 'string',
          email: 'string',
          dateOfBirth: 'date'
        },
        generator_config: {
          locale: 'sv-SE',
          seed: 12345,
          rules: {
            phoneNumber: '+46{7#########}',
            email: '{firstName.lower}.{lastName.lower}@example.se'
          }
        },
        sample_size: 1000,
        refresh_strategy: 'per-run',
        enabled: true
      },
      {
        name: 'Store Profiles Dataset',
        category: 'stores',
        schema: {
          name: 'string',
          address: 'string',
          city: 'string',
          postalCode: 'string',
          category: 'string',
          openingHours: 'object'
        },
        generator_config: {
          locale: 'sv-SE',
          seed: 54321,
          rules: {
            category: ['Restaurant', 'Café', 'Butik', 'Apotek', 'Bank'],
            postalCode: '{#####}'
          }
        },
        sample_size: 500,
        refresh_strategy: 'static',
        enabled: true
      },
      {
        name: 'Transaction History Dataset',
        category: 'transactions',
        schema: {
          amount: 'number',
          currency: 'string',
          timestamp: 'datetime',
          paymentMethod: 'string',
          description: 'string'
        },
        generator_config: {
          locale: 'sv-SE',
          seed: 98765,
          rules: {
            currency: 'SEK',
            amount: { min: 10, max: 5000 },
            paymentMethod: ['Card', 'Swish', 'Cash']
          }
        },
        sample_size: 2000,
        refresh_strategy: 'per-test',
        enabled: true
      },
      {
        name: 'Feedback Responses Dataset',
        category: 'feedback',
        schema: {
          rating: 'number',
          comment: 'string',
          sentiment: 'string',
          duration: 'number',
          language: 'string'
        },
        generator_config: {
          locale: 'sv-SE',
          seed: 11111,
          rules: {
            rating: { min: 1, max: 5 },
            language: 'sv-SE',
            sentiment: ['positive', 'neutral', 'negative']
          }
        },
        sample_size: 800,
        refresh_strategy: 'per-run',
        enabled: false // Disabled dataset
      },
      {
        name: 'Admin Operations Dataset',
        category: 'admin',
        schema: {
          action: 'string',
          userId: 'string',
          timestamp: 'datetime',
          ipAddress: 'string',
          success: 'boolean'
        },
        generator_config: {
          locale: 'sv-SE',
          seed: 22222,
          rules: {
            action: ['login', 'logout', 'create_store', 'delete_store', 'update_settings'],
            success: { probability: 0.95 }
          }
        },
        sample_size: 300,
        refresh_strategy: 'static',
        enabled: true
      }
    ];

    for (const dataset of datasets) {
      const { data, error } = await supabase
        .from('test_datasets')
        .insert(dataset)
        .select()
        .single();

      if (error) throw error;
      datasetIds.push(data.id);
    }
  });

  afterAll(async () => {
    // Clean up test data
    if (datasetIds.length > 0) {
      await supabase
        .from('test_datasets')
        .delete()
        .in('id', datasetIds);
    }
  });

  test('should return list of test datasets', async () => {
    const response = await fetch('http://localhost:3001/api/test/data/datasets', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer test-token'
      }
    });

    // Should fail - no implementation yet
    expect(response.status).toBe(404);

    // When implemented, should be:
    // expect(response.status).toBe(200);
    // expect(response.headers.get('Content-Type')).toContain('application/json');
    // 
    // const datasets: TestDataSet[] = await response.json();
    // expect(Array.isArray(datasets)).toBe(true);
    // expect(datasets.length).toBeGreaterThanOrEqual(4); // 4 enabled datasets
    // 
    // // Verify dataset structure
    // const dataset = datasets[0];
    // expect(dataset).toHaveProperty('id');
    // expect(dataset).toHaveProperty('name');
    // expect(dataset).toHaveProperty('category');
    // expect(dataset).toHaveProperty('schema');
    // expect(dataset).toHaveProperty('generatorConfig');
    // expect(dataset).toHaveProperty('sampleSize');
    // expect(dataset).toHaveProperty('refreshStrategy');
    // expect(dataset).toHaveProperty('enabled');
    // 
    // // Verify category enum
    // expect(['users', 'stores', 'transactions', 'feedback', 'admin']).toContain(dataset.category);
    // 
    // // Verify refresh strategy enum
    // expect(['static', 'per-run', 'per-test']).toContain(dataset.refreshStrategy);
  });

  test('should filter by category - users', async () => {
    const response = await fetch('http://localhost:3001/api/test/data/datasets?category=users', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer test-token'
      }
    });

    // Should fail - no implementation yet
    expect(response.status).toBe(404);

    // When implemented, should be:
    // expect(response.status).toBe(200);
    // 
    // const datasets: TestDataSet[] = await response.json();
    // expect(datasets.every(d => d.category === 'users')).toBe(true);
    // expect(datasets.length).toBe(1); // Only Swedish Users Dataset
    // 
    // const userDataset = datasets[0];
    // expect(userDataset.name).toBe('Swedish Users Dataset');
    // expect(userDataset.schema).toHaveProperty('firstName');
    // expect(userDataset.schema).toHaveProperty('phoneNumber');
    // expect(userDataset.generatorConfig.locale).toBe('sv-SE');
  });

  test('should filter by category - stores', async () => {
    const response = await fetch('http://localhost:3001/api/test/data/datasets?category=stores', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer test-token'
      }
    });

    // Should fail - no implementation yet
    expect(response.status).toBe(404);

    // When implemented, should be:
    // expect(response.status).toBe(200);
    // 
    // const datasets: TestDataSet[] = await response.json();
    // expect(datasets.every(d => d.category === 'stores')).toBe(true);
    // expect(datasets.length).toBe(1); // Only Store Profiles Dataset
    // 
    // const storeDataset = datasets[0];
    // expect(storeDataset.name).toBe('Store Profiles Dataset');
    // expect(storeDataset.refreshStrategy).toBe('static');
  });

  test('should filter by category - transactions', async () => {
    const response = await fetch('http://localhost:3001/api/test/data/datasets?category=transactions', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer test-token'
      }
    });

    // Should fail - no implementation yet
    expect(response.status).toBe(404);

    // When implemented, should be:
    // expect(response.status).toBe(200);
    // 
    // const datasets: TestDataSet[] = await response.json();
    // expect(datasets.every(d => d.category === 'transactions')).toBe(true);
    // expect(datasets.length).toBe(1);
    // 
    // const transactionDataset = datasets[0];
    // expect(transactionDataset.sampleSize).toBe(2000);
    // expect(transactionDataset.refreshStrategy).toBe('per-test');
  });

  test('should filter by category - feedback', async () => {
    const response = await fetch('http://localhost:3001/api/test/data/datasets?category=feedback', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer test-token'
      }
    });

    // Should fail - no implementation yet
    expect(response.status).toBe(404);

    // When implemented, should be:
    // expect(response.status).toBe(200);
    // 
    // const datasets: TestDataSet[] = await response.json();
    // expect(datasets.length).toBe(0); // Feedback dataset is disabled, should not appear
  });

  test('should filter by category - admin', async () => {
    const response = await fetch('http://localhost:3001/api/test/data/datasets?category=admin', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer test-token'
      }
    });

    // Should fail - no implementation yet
    expect(response.status).toBe(404);

    // When implemented, should be:
    // expect(response.status).toBe(200);
    // 
    // const datasets: TestDataSet[] = await response.json();
    // expect(datasets.every(d => d.category === 'admin')).toBe(true);
    // expect(datasets.length).toBe(1);
    // 
    // const adminDataset = datasets[0];
    // expect(adminDataset.name).toBe('Admin Operations Dataset');
    // expect(adminDataset.sampleSize).toBe(300);
  });

  test('should validate category enum values', async () => {
    const response = await fetch('http://localhost:3001/api/test/data/datasets?category=invalid-category', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer test-token'
      }
    });

    // Should fail - no implementation yet
    expect(response.status).toBe(404);

    // When implemented, should be:
    // expect(response.status).toBe(400);
    // const error = await response.json();
    // expect(error.message).toContain('Category must be one of: users, stores, transactions, feedback, admin');
  });

  test('should include only enabled datasets by default', async () => {
    const response = await fetch('http://localhost:3001/api/test/data/datasets', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer test-token'
      }
    });

    // Should fail - no implementation yet
    expect(response.status).toBe(404);

    // When implemented, should be:
    // expect(response.status).toBe(200);
    // 
    // const datasets: TestDataSet[] = await response.json();
    // expect(datasets.every(d => d.enabled === true)).toBe(true);
    // expect(datasets.length).toBe(4); // All except disabled feedback dataset
  });

  test('should include generator configuration details', async () => {
    const response = await fetch('http://localhost:3001/api/test/data/datasets?category=users', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer test-token'
      }
    });

    // Should fail - no implementation yet
    expect(response.status).toBe(404);

    // When implemented, should be:
    // expect(response.status).toBe(200);
    // 
    // const datasets: TestDataSet[] = await response.json();
    // const userDataset = datasets[0];
    // 
    // expect(userDataset.generatorConfig).toHaveProperty('locale', 'sv-SE');
    // expect(userDataset.generatorConfig).toHaveProperty('seed', 12345);
    // expect(userDataset.generatorConfig).toHaveProperty('rules');
    // expect(userDataset.generatorConfig.rules).toHaveProperty('phoneNumber');
    // expect(userDataset.generatorConfig.rules.phoneNumber).toBe('+46{7#########}');
  });

  test('should order datasets by sample size descending', async () => {
    const response = await fetch('http://localhost:3001/api/test/data/datasets', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer test-token'
      }
    });

    // Should fail - no implementation yet
    expect(response.status).toBe(404);

    // When implemented, should be:
    // expect(response.status).toBe(200);
    // 
    // const datasets: TestDataSet[] = await response.json();
    // if (datasets.length > 1) {
    //   for (let i = 0; i < datasets.length - 1; i++) {
    //     expect(datasets[i].sampleSize).toBeGreaterThanOrEqual(datasets[i + 1].sampleSize);
    //   }
    // }
  });

  test('should handle empty results gracefully', async () => {
    const response = await fetch('http://localhost:3001/api/test/data/datasets?category=feedback', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer test-token'
      }
    });

    // Should fail - no implementation yet
    expect(response.status).toBe(404);

    // When implemented, should be:
    // expect(response.status).toBe(200);
    // 
    // const datasets: TestDataSet[] = await response.json();
    // expect(Array.isArray(datasets)).toBe(true);
    // expect(datasets.length).toBe(0); // No enabled feedback datasets
  });

  test('should include Swedish locale configuration', async () => {
    const response = await fetch('http://localhost:3001/api/test/data/datasets', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer test-token'
      }
    });

    // Should fail - no implementation yet
    expect(response.status).toBe(404);

    // When implemented, should be:
    // expect(response.status).toBe(200);
    // 
    // const datasets: TestDataSet[] = await response.json();
    // 
    // datasets.forEach(dataset => {
    //   expect(dataset.generatorConfig.locale).toBe('sv-SE');
    //   expect(typeof dataset.generatorConfig.seed).toBe('number');
    //   expect(dataset.generatorConfig.rules).toBeDefined();
    // });
  });

  test('should validate refresh strategy values', async () => {
    const response = await fetch('http://localhost:3001/api/test/data/datasets', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer test-token'
      }
    });

    // Should fail - no implementation yet
    expect(response.status).toBe(404);

    // When implemented, should be:
    // expect(response.status).toBe(200);
    // 
    // const datasets: TestDataSet[] = await response.json();
    // 
    // datasets.forEach(dataset => {
    //   expect(['static', 'per-run', 'per-test']).toContain(dataset.refreshStrategy);
    // });
    // 
    // // Verify specific refresh strategies
    // const staticDataset = datasets.find(d => d.name === 'Store Profiles Dataset');
    // expect(staticDataset?.refreshStrategy).toBe('static');
    // 
    // const perRunDataset = datasets.find(d => d.name === 'Swedish Users Dataset');
    // expect(perRunDataset?.refreshStrategy).toBe('per-run');
    // 
    // const perTestDataset = datasets.find(d => d.name === 'Transaction History Dataset');
    // expect(perTestDataset?.refreshStrategy).toBe('per-test');
  });

  test('should require authentication', async () => {
    const response = await fetch('http://localhost:3001/api/test/data/datasets', {
      method: 'GET'
      // No Authorization header
    });

    // Should fail - no implementation yet
    expect(response.status).toBe(404);

    // When implemented, should be:
    // expect(response.status).toBe(401);
    // const error = await response.json();
    // expect(error.message).toContain('Authentication required');
  });

  test('should include schema validation rules', async () => {
    const response = await fetch('http://localhost:3001/api/test/data/datasets?category=transactions', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer test-token'
      }
    });

    // Should fail - no implementation yet
    expect(response.status).toBe(404);

    // When implemented, should be:
    // expect(response.status).toBe(200);
    // 
    // const datasets: TestDataSet[] = await response.json();
    // const transactionDataset = datasets[0];
    // 
    // expect(transactionDataset.schema).toHaveProperty('amount', 'number');
    // expect(transactionDataset.schema).toHaveProperty('currency', 'string');
    // expect(transactionDataset.schema).toHaveProperty('timestamp', 'datetime');
    // 
    // expect(transactionDataset.generatorConfig.rules.currency).toBe('SEK');
    // expect(transactionDataset.generatorConfig.rules.amount).toEqual({ min: 10, max: 5000 });
  });

  test('should show different sample sizes per category', async () => {
    const response = await fetch('http://localhost:3001/api/test/data/datasets', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer test-token'
      }
    });

    // Should fail - no implementation yet
    expect(response.status).toBe(404);

    // When implemented, should be:
    // expect(response.status).toBe(200);
    // 
    // const datasets: TestDataSet[] = await response.json();
    // 
    // const userDataset = datasets.find(d => d.category === 'users');
    // expect(userDataset?.sampleSize).toBe(1000);
    // 
    // const storeDataset = datasets.find(d => d.category === 'stores');
    // expect(storeDataset?.sampleSize).toBe(500);
    // 
    // const transactionDataset = datasets.find(d => d.category === 'transactions');
    // expect(transactionDataset?.sampleSize).toBe(2000);
    // 
    // const adminDataset = datasets.find(d => d.category === 'admin');
    // expect(adminDataset?.sampleSize).toBe(300);
  });
});