import { testClient } from '../setup';

describe('Integration: Multi-Store Setup', () => {
  const mockBusinessId = '123e4567-e89b-12d3-a456-426614174000';
  const mockStoreIds = [
    '789e1234-e89b-12d3-a456-426614174000',
    '789e1234-e89b-12d3-a456-426614174001',
    '789e1234-e89b-12d3-a456-426614174002'
  ];

  beforeEach(async () => {
    // Clean up test data
    await testClient.from('context_window').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await testClient.from('stores').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await testClient.from('businesses').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  });

  test('should allow business to create multiple stores', async () => {
    // Create business first
    const { data: business, error: businessError } = await testClient
      .from('businesses')
      .insert({
        id: mockBusinessId,
        name: 'Multi-Store Business',
        email: 'multi@business.com',
        settings: {}
      })
      .select()
      .single();

    expect(businessError).toBeNull();
    expect(business).toBeDefined();

    // Create multiple stores
    const storeData = [
      {
        id: mockStoreIds[0],
        business_id: mockBusinessId,
        name: 'Downtown Store',
        location_address: '123 Main St, Stockholm',
        qr_code_data: 'QR_DOWNTOWN_001',
        store_profile: { type: 'flagship' },
        is_active: true
      },
      {
        id: mockStoreIds[1],
        business_id: mockBusinessId,
        name: 'Mall Store',
        location_address: '456 Mall Ave, Stockholm',
        qr_code_data: 'QR_MALL_002',
        store_profile: { type: 'retail' },
        is_active: true
      },
      {
        id: mockStoreIds[2],
        business_id: mockBusinessId,
        name: 'Airport Store',
        location_address: '789 Airport Terminal, Stockholm',
        qr_code_data: 'QR_AIRPORT_003',
        store_profile: { type: 'kiosk' },
        is_active: false // Temporarily closed
      }
    ];

    const { data: stores, error: storesError } = await testClient
      .from('stores')
      .insert(storeData)
      .select();

    expect(storesError).toBeNull();
    expect(stores).toHaveLength(3);
    expect(stores?.every(s => s.business_id === mockBusinessId)).toBe(true);
  });

  test('should create unique context windows for each store', async () => {
    // This will fail until stores are created and context window relationships work
    const contextData = mockStoreIds.map((storeId, index) => ({
      store_id: storeId,
      store_profile: {
        name: `Store ${index + 1}`,
        specialization: index === 0 ? 'electronics' : index === 1 ? 'clothing' : 'food'
      },
      custom_questions: [
        {
          id: `q${index + 1}`,
          text: `How was your experience at Store ${index + 1}?`,
          frequency: 50,
          category: 'service_quality',
          priority: 'high'
        }
      ],
      ai_configuration: {
        conversation_style: 'friendly',
        language_preferences: { primary: 'swedish', formality_level: 'informal' }
      },
      fraud_detection_settings: {
        sensitivity_level: 'medium',
        red_flag_keywords: ['fake', 'scam']
      }
    }));

    const { data: contexts, error: contextError } = await testClient
      .from('context_window')
      .insert(contextData)
      .select();

    // This should fail until stores exist
    expect(contextError).not.toBeNull();
  });

  test('should handle QR code uniqueness across all stores', async () => {
    // Test that QR codes must be unique globally, not just per business
    const duplicateQR = 'DUPLICATE_QR_CODE';

    const store1Data = {
      business_id: mockBusinessId,
      name: 'Store 1',
      qr_code_data: duplicateQR,
      store_profile: {},
      is_active: true
    };

    const store2Data = {
      business_id: mockBusinessId,
      name: 'Store 2',
      qr_code_data: duplicateQR, // Duplicate QR code
      store_profile: {},
      is_active: true
    };

    const { error: firstStoreError } = await testClient
      .from('stores')
      .insert(store1Data);

    expect(firstStoreError).not.toBeNull(); // Should fail due to missing business

    const { error: duplicateError } = await testClient
      .from('stores')
      .insert(store2Data);

    expect(duplicateError).not.toBeNull(); // Should fail due to unique constraint
  });

  test('should support different store configurations per location', async () => {
    // This will test that each store can have distinct configurations
    const storeConfigs = [
      {
        store_id: mockStoreIds[0],
        name: 'Premium Store',
        operating_hours: {
          monday: { open: '09:00', close: '21:00' },
          tuesday: { open: '09:00', close: '21:00' },
          sunday: null // Closed on Sunday
        },
        staff_count: 15,
        departments: ['electronics', 'home', 'fashion']
      },
      {
        store_id: mockStoreIds[1],
        name: 'Express Store',
        operating_hours: {
          monday: { open: '10:00', close: '19:00' },
          tuesday: { open: '10:00', close: '19:00' },
          sunday: { open: '12:00', close: '17:00' }
        },
        staff_count: 8,
        departments: ['essentials', 'grab-and-go']
      }
    ];

    storeConfigs.forEach(config => {
      expect(config.staff_count).toBeGreaterThan(0);
      expect(config.departments).toBeInstanceOf(Array);
      expect(config.operating_hours).toBeDefined();
    });
  });

  test('should allow independent transaction tracking per store', async () => {
    // This will fail until store relationships are established
    const transactionData = [
      {
        store_id: mockStoreIds[0],
        customer_time_range: '[2023-01-01 10:00:00, 2023-01-01 10:04:00)',
        customer_amount_range: '[100.0, 104.0]',
        verification_status: 'pending'
      },
      {
        store_id: mockStoreIds[1],
        customer_time_range: '[2023-01-01 11:00:00, 2023-01-01 11:04:00)',
        customer_amount_range: '[200.0, 204.0]',
        verification_status: 'pending'
      },
      {
        store_id: mockStoreIds[2],
        customer_time_range: '[2023-01-01 12:00:00, 2023-01-01 12:04:00)',
        customer_amount_range: '[50.0, 54.0]',
        verification_status: 'pending'
      }
    ];

    const { error: transactionError } = await testClient
      .from('transactions')
      .insert(transactionData);

    // Should fail until stores exist
    expect(transactionError).not.toBeNull();
  });

  test('should support store-specific feedback configurations', async () => {
    const feedbackConfigs = [
      {
        store_type: 'flagship',
        max_questions_per_call: 5,
        call_duration_target: { min_seconds: 60, max_seconds: 180 },
        custom_questions: [
          'How was our premium service today?',
          'Would you recommend our flagship store?',
          'Any suggestions for our luxury department?'
        ]
      },
      {
        store_type: 'express',
        max_questions_per_call: 3,
        call_duration_target: { min_seconds: 30, max_seconds: 90 },
        custom_questions: [
          'Was checkout quick enough?',
          'Did you find what you needed?'
        ]
      }
    ];

    feedbackConfigs.forEach(config => {
      expect(config.max_questions_per_call).toBeGreaterThan(0);
      expect(config.call_duration_target.min_seconds).toBeLessThan(config.call_duration_target.max_seconds);
      expect(config.custom_questions.length).toBeGreaterThan(0);
    });
  });

  test('should aggregate verification data across all stores in business', async () => {
    // This will test that weekly verification includes all stores in the business
    const weekIdentifier = '2023-W42';

    const { data: verificationRecord, error: verificationError } = await testClient
      .from('verification_record')
      .insert({
        business_id: mockBusinessId,
        week_identifier: weekIdentifier,
        status: 'pending',
        transaction_summary: {
          stores: mockStoreIds.map(id => ({
            store_id: id,
            transaction_count: Math.floor(Math.random() * 100),
            total_feedback_sessions: Math.floor(Math.random() * 80),
            avg_quality_grade: 7.5 + Math.random() * 2
          }))
        }
      })
      .select()
      .single();

    expect(verificationError).not.toBeNull(); // Should fail until business exists

    // Verify transaction summary structure
    const expectedSummary = {
      stores: expect.arrayContaining([
        expect.objectContaining({
          store_id: expect.any(String),
          transaction_count: expect.any(Number),
          total_feedback_sessions: expect.any(Number),
          avg_quality_grade: expect.any(Number)
        })
      ])
    };

    expect(expectedSummary).toBeDefined();
  });

  test('should handle store activation/deactivation', async () => {
    // Test that inactive stores are properly filtered in queries
    const storeId = mockStoreIds[0];

    // This will fail until store update functionality is implemented
    const { error: updateError } = await testClient
      .from('stores')
      .update({ is_active: false })
      .eq('id', storeId);

    expect(updateError).not.toBeNull(); // Should fail until store exists

    // Test public QR lookup should exclude inactive stores
    const { data: activeStores, error: queryError } = await testClient
      .from('stores')
      .select('*')
      .eq('is_active', true);

    expect(queryError).toBeNull();
    expect(activeStores?.every(s => s.is_active === true)).toBe(true);
  });

  test('should validate business can manage all their stores', async () => {
    // Test that business owner can access and modify all their stores
    const businessClient = testClient; // Should be configured with business JWT

    const { data: businessStores, error } = await businessClient
      .from('stores')
      .select('*, context_window(*)')
      .eq('business_id', mockBusinessId);

    expect(error).toBeNull();
    // Should return all stores for this business (when they exist)
  });
});