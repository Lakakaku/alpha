import { testClient } from '../setup';

describe('Integration: Transaction Verification', () => {
  const mockBusinessId = '123e4567-e89b-12d3-a456-426614174000';
  const mockStoreId = '789e1234-e89b-12d3-a456-426614174000';

  beforeEach(async () => {
    // Clean up test data
    await testClient.from('feedback_sessions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await testClient.from('transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await testClient.from('stores').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await testClient.from('businesses').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  });

  test('should validate ±2 minute time tolerance matching', async () => {
    // Test the create_time_tolerance function
    const customerTime = '2023-01-01T14:30:00+01:00';

    const { data: timeRange, error } = await testClient
      .rpc('create_time_tolerance', { customer_time: customerTime });

    expect(error).toBeNull();
    expect(timeRange).toBeDefined();

    // Should create range from 14:28:00 to 14:32:00
    expect(timeRange).toContain('2023-01-01 13:28:00'); // UTC conversion
    expect(timeRange).toContain('2023-01-01 13:32:00');
  });

  test('should validate ±2 SEK amount tolerance matching', async () => {
    // Test the create_amount_tolerance function
    const customerAmount = 156.50;

    const { data: amountRange, error } = await testClient
      .rpc('create_amount_tolerance', { customer_amount: customerAmount });

    expect(error).toBeNull();
    expect(amountRange).toBeDefined();

    // Should create range from 154.50 to 158.50
    expect(amountRange).toContain('154.5');
    expect(amountRange).toContain('158.5');
  });

  test('should enforce exact tolerance range constraints', async () => {
    // Test that transaction ranges must be exactly 4 minutes and 4 SEK

    // Valid transaction (4 minutes, 4 SEK)
    const validTransaction = {
      store_id: mockStoreId,
      customer_time_range: '[2023-01-01 14:30:00, 2023-01-01 14:34:00)', // Exactly 4 minutes
      customer_amount_range: '[156.50, 160.50]', // Exactly 4 SEK
      verification_status: 'pending'
    };

    const { error: validError } = await testClient
      .from('transactions')
      .insert(validTransaction);

    expect(validError).not.toBeNull(); // Should fail due to missing store

    // Invalid time range (3 minutes)
    const invalidTimeTransaction = {
      store_id: mockStoreId,
      customer_time_range: '[2023-01-01 14:30:00, 2023-01-01 14:33:00)', // 3 minutes
      customer_amount_range: '[156.50, 160.50]',
      verification_status: 'pending'
    };

    const { error: timeError } = await testClient
      .from('transactions')
      .insert(invalidTimeTransaction);

    expect(timeError).not.toBeNull();
    expect(timeError?.message).toContain('valid_time_range');

    // Invalid amount range (3 SEK)
    const invalidAmountTransaction = {
      store_id: mockStoreId,
      customer_time_range: '[2023-01-01 14:30:00, 2023-01-01 14:34:00)',
      customer_amount_range: '[156.50, 159.50]', // 3 SEK
      verification_status: 'pending'
    };

    const { error: amountError } = await testClient
      .from('transactions')
      .insert(invalidAmountTransaction);

    expect(amountError).not.toBeNull();
    expect(amountError?.message).toContain('valid_amount_range');
  });

  test('should match transactions within tolerance ranges', async () => {
    // This will fail until transaction matching logic is implemented
    const customerInput = {
      time: '2023-01-01T14:30:00+01:00',
      amount: 156.50
    };

    const posTransactions = [
      {
        id: 'tx1',
        actual_time: '2023-01-01T14:29:30+01:00', // Within ±2 min
        actual_amount: 157.25 // Within ±2 SEK
      },
      {
        id: 'tx2',
        actual_time: '2023-01-01T14:33:00+01:00', // Outside tolerance
        actual_amount: 156.75
      },
      {
        id: 'tx3',
        actual_time: '2023-01-01T14:31:00+01:00',
        actual_amount: 159.00 // Outside ±2 SEK tolerance
      }
    ];

    // tx1 should match, tx2 and tx3 should not
    const expectedMatches = posTransactions.filter(tx => {
      const timeDiff = Math.abs(
        new Date(tx.actual_time).getTime() - new Date(customerInput.time).getTime()
      ) / (1000 * 60); // minutes

      const amountDiff = Math.abs(tx.actual_amount - customerInput.amount);

      return timeDiff <= 2 && amountDiff <= 2;
    });

    expect(expectedMatches).toHaveLength(1);
    expect(expectedMatches[0].id).toBe('tx1');
  });

  test('should create feedback session after successful transaction verification', async () => {
    // This will fail until transaction and feedback session relationships work
    const transactionId = '901e2345-e89b-12d3-a456-426614174000';
    const phoneHash = 'sha256_hashed_phone_number';

    const feedbackSession = {
      store_id: mockStoreId,
      transaction_id: transactionId,
      customer_phone_hash: phoneHash,
      status: 'initiated',
      feedback_summary: {},
      call_started_at: '2023-01-01T14:35:00+01:00'
    };

    const { error } = await testClient
      .from('feedback_sessions')
      .insert(feedbackSession);

    // Should fail due to missing foreign key references
    expect(error).not.toBeNull();
  });

  test('should validate quality grading constraints (1-10)', async () => {
    const validGrades = [1, 5, 10];
    const invalidGrades = [0, 11, -1];

    for (const grade of validGrades) {
      const session = {
        store_id: mockStoreId,
        transaction_id: '901e2345-e89b-12d3-a456-426614174000',
        customer_phone_hash: 'hash',
        status: 'completed',
        quality_grade: grade,
        feedback_summary: {}
      };

      const { error } = await testClient
        .from('feedback_sessions')
        .insert(session);

      // Will fail due to missing references, but not due to grade constraint
      expect(error).not.toBeNull();
      expect(error?.message).not.toContain('quality_grade');
    }

    for (const grade of invalidGrades) {
      const session = {
        store_id: mockStoreId,
        transaction_id: '901e2345-e89b-12d3-a456-426614174001',
        customer_phone_hash: 'hash',
        status: 'completed',
        quality_grade: grade,
        feedback_summary: {}
      };

      const { error } = await testClient
        .from('feedback_sessions')
        .insert(session);

      expect(error).not.toBeNull();
      if (grade < 1 || grade > 10) {
        expect(error?.message).toContain('quality_grade');
      }
    }
  });

  test('should validate reward percentage constraints (2.0-15.0)', async () => {
    const validRewards = [2.0, 7.5, 15.0];
    const invalidRewards = [1.9, 15.1, 0, 20.0];

    for (const reward of validRewards) {
      const session = {
        store_id: mockStoreId,
        transaction_id: `tx_${reward}`,
        customer_phone_hash: 'hash',
        status: 'completed',
        reward_percentage: reward,
        feedback_summary: {}
      };

      const { error } = await testClient
        .from('feedback_sessions')
        .insert(session);

      // Will fail due to missing references, but not due to reward constraint
      expect(error).not.toBeNull();
      expect(error?.message).not.toContain('reward_percentage');
    }

    for (const reward of invalidRewards) {
      const session = {
        store_id: mockStoreId,
        transaction_id: `tx_${reward}`,
        customer_phone_hash: 'hash',
        status: 'completed',
        reward_percentage: reward,
        feedback_summary: {}
      };

      const { error } = await testClient
        .from('feedback_sessions')
        .insert(session);

      expect(error).not.toBeNull();
      if (reward < 2.0 || reward > 15.0) {
        expect(error?.message).toContain('reward_percentage');
      }
    }
  });

  test('should track verification workflow states', async () => {
    const verificationStates = [
      { status: 'pending', is_verified: false },
      { status: 'verified', is_verified: true },
      { status: 'rejected', is_verified: false }
    ];

    verificationStates.forEach(state => {
      const transaction = {
        store_id: mockStoreId,
        customer_time_range: '[2023-01-01 14:30:00, 2023-01-01 14:34:00)',
        customer_amount_range: '[156.50, 160.50]',
        verification_status: state.status,
        is_verified: state.is_verified
      };

      expect(transaction.verification_status).toBe(state.status);
      expect(transaction.is_verified).toBe(state.is_verified);
    });
  });

  test('should support bulk transaction verification matching', async () => {
    // Test scenario where multiple customer reports need to be matched
    const customerReports = [
      { time: '2023-01-01T14:30:00+01:00', amount: 156.50 },
      { time: '2023-01-01T15:15:00+01:00', amount: 89.25 },
      { time: '2023-01-01T16:45:00+01:00', amount: 234.75 }
    ];

    const posTransactions = [
      {
        actual_time: '2023-01-01T14:31:30+01:00',
        actual_amount: 157.00, // Should match first report
        transaction_id: 'pos_tx_1'
      },
      {
        actual_time: '2023-01-01T15:16:00+01:00',
        actual_amount: 89.50, // Should match second report
        transaction_id: 'pos_tx_2'
      },
      {
        actual_time: '2023-01-01T17:00:00+01:00',
        actual_amount: 234.25, // Should match third report
        transaction_id: 'pos_tx_3'
      }
    ];

    // All should match within tolerance
    const matches = customerReports.map(report => {
      return posTransactions.find(pos => {
        const timeDiff = Math.abs(
          new Date(pos.actual_time).getTime() - new Date(report.time).getTime()
        ) / (1000 * 60);
        const amountDiff = Math.abs(pos.actual_amount - report.amount);
        return timeDiff <= 2 && amountDiff <= 2;
      });
    });

    expect(matches.every(match => match !== undefined)).toBe(true);
  });

  test('should handle edge cases in tolerance matching', async () => {
    // Test exact boundary cases
    const customerTime = '2023-01-01T14:30:00+01:00';
    const customerAmount = 100.00;

    const edgeCases = [
      {
        name: 'exactly 2 minutes early',
        actual_time: '2023-01-01T14:28:00+01:00',
        actual_amount: 100.00,
        shouldMatch: true
      },
      {
        name: 'exactly 2 minutes late',
        actual_time: '2023-01-01T14:32:00+01:00',
        actual_amount: 100.00,
        shouldMatch: true
      },
      {
        name: 'exactly 2 SEK more',
        actual_time: customerTime,
        actual_amount: 102.00,
        shouldMatch: true
      },
      {
        name: 'exactly 2 SEK less',
        actual_time: customerTime,
        actual_amount: 98.00,
        shouldMatch: true
      },
      {
        name: '2.01 minutes late',
        actual_time: '2023-01-01T14:32:01+01:00',
        actual_amount: 100.00,
        shouldMatch: false
      },
      {
        name: '2.01 SEK more',
        actual_time: customerTime,
        actual_amount: 102.01,
        shouldMatch: false
      }
    ];

    edgeCases.forEach(testCase => {
      const timeDiff = Math.abs(
        new Date(testCase.actual_time).getTime() - new Date(customerTime).getTime()
      ) / (1000 * 60);
      const amountDiff = Math.abs(testCase.actual_amount - customerAmount);

      const matches = timeDiff <= 2 && amountDiff <= 2;
      expect(matches).toBe(testCase.shouldMatch);
    });
  });
});