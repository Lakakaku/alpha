import { TriggerEvaluationService } from '../../src/services/questions/TriggerEvaluationService';
import { TriggerCondition, TriggerContext } from '@vocilia/types';
import { mockTriggerConditions, mockTriggerContext } from '../fixtures/questionFixtures';

describe('TriggerEvaluationService', () => {
  let triggerService: TriggerEvaluationService;

  beforeEach(() => {
    triggerService = new TriggerEvaluationService();
  });

  describe('evaluateCondition', () => {
    describe('time_based triggers', () => {
      it('should evaluate current_time between condition', () => {
        const condition: TriggerCondition = {
          type: 'time_based',
          field: 'current_time',
          operator: 'between',
          value: ['09:00', '17:00'],
        };
        const context = { ...mockTriggerContext, current_time: '14:30' };

        const result = triggerService.evaluateCondition(condition, context);
        expect(result).toBe(true);
      });

      it('should evaluate current_time outside range', () => {
        const condition: TriggerCondition = {
          type: 'time_based',
          field: 'current_time',
          operator: 'between',
          value: ['09:00', '17:00'],
        };
        const context = { ...mockTriggerContext, current_time: '20:30' };

        const result = triggerService.evaluateCondition(condition, context);
        expect(result).toBe(false);
      });

      it('should evaluate current_day equals condition', () => {
        const condition: TriggerCondition = {
          type: 'time_based',
          field: 'current_day',
          operator: 'eq',
          value: 'tuesday',
        };
        const context = { ...mockTriggerContext, current_day: 'tuesday' };

        const result = triggerService.evaluateCondition(condition, context);
        expect(result).toBe(true);
      });

      it('should evaluate current_day in array condition', () => {
        const condition: TriggerCondition = {
          type: 'time_based',
          field: 'current_day',
          operator: 'in',
          value: ['monday', 'tuesday', 'wednesday'],
        };
        const context = { ...mockTriggerContext, current_day: 'tuesday' };

        const result = triggerService.evaluateCondition(condition, context);
        expect(result).toBe(true);
      });

      it('should handle invalid time format', () => {
        const condition: TriggerCondition = {
          type: 'time_based',
          field: 'current_time',
          operator: 'gte',
          value: 'invalid-time',
        };
        const context = { ...mockTriggerContext, current_time: '14:30' };

        expect(() => triggerService.evaluateCondition(condition, context))
          .toThrow('Invalid time format');
      });
    });

    describe('frequency_based triggers', () => {
      it('should evaluate visit_count greater than or equal', () => {
        const condition: TriggerCondition = {
          type: 'frequency_based',
          field: 'visit_count',
          operator: 'gte',
          value: 3,
        };
        const context = { ...mockTriggerContext, visit_count: 5 };

        const result = triggerService.evaluateCondition(condition, context);
        expect(result).toBe(true);
      });

      it('should evaluate visit_count less than', () => {
        const condition: TriggerCondition = {
          type: 'frequency_based',
          field: 'visit_count',
          operator: 'lt',
          value: 10,
        };
        const context = { ...mockTriggerContext, visit_count: 5 };

        const result = triggerService.evaluateCondition(condition, context);
        expect(result).toBe(true);
      });

      it('should evaluate days_since_last_visit', () => {
        const condition: TriggerCondition = {
          type: 'frequency_based',
          field: 'days_since_last_visit',
          operator: 'gte',
          value: 7,
        };
        const lastVisit = new Date();
        lastVisit.setDate(lastVisit.getDate() - 10); // 10 days ago
        const context = { ...mockTriggerContext, last_visit: lastVisit };

        const result = triggerService.evaluateCondition(condition, context);
        expect(result).toBe(true);
      });

      it('should handle missing frequency data', () => {
        const condition: TriggerCondition = {
          type: 'frequency_based',
          field: 'visit_count',
          operator: 'gte',
          value: 1,
        };
        const context = { ...mockTriggerContext, visit_count: undefined };

        const result = triggerService.evaluateCondition(condition, context);
        expect(result).toBe(false);
      });
    });

    describe('customer_behavior triggers', () => {
      it('should evaluate avg_session_duration', () => {
        const condition: TriggerCondition = {
          type: 'customer_behavior',
          field: 'avg_session_duration',
          operator: 'gte',
          value: 300,
        };
        const context = { ...mockTriggerContext, avg_session_duration: 420 };

        const result = triggerService.evaluateCondition(condition, context);
        expect(result).toBe(true);
      });

      it('should evaluate total_spent range', () => {
        const condition: TriggerCondition = {
          type: 'customer_behavior',
          field: 'total_spent',
          operator: 'between',
          value: [100, 200],
        };
        const context = { ...mockTriggerContext, total_spent: 150.50 };

        const result = triggerService.evaluateCondition(condition, context);
        expect(result).toBe(true);
      });

      it('should evaluate customer_segment', () => {
        const condition: TriggerCondition = {
          type: 'customer_behavior',
          field: 'customer_segment',
          operator: 'eq',
          value: 'premium',
        };
        const context = { ...mockTriggerContext, customer_segment: 'premium' };

        const result = triggerService.evaluateCondition(condition, context);
        expect(result).toBe(true);
      });

      it('should handle missing customer data', () => {
        const condition: TriggerCondition = {
          type: 'customer_behavior',
          field: 'total_spent',
          operator: 'gte',
          value: 100,
        };
        const context = { ...mockTriggerContext, total_spent: undefined };

        const result = triggerService.evaluateCondition(condition, context);
        expect(result).toBe(false);
      });
    });

    describe('store_context triggers', () => {
      it('should evaluate store_rating', () => {
        const condition: TriggerCondition = {
          type: 'store_context',
          field: 'store_rating',
          operator: 'gte',
          value: 4.0,
        };
        const context = { ...mockTriggerContext, store_rating: 4.2 };

        const result = triggerService.evaluateCondition(condition, context);
        expect(result).toBe(true);
      });

      it('should evaluate peak_hours boolean', () => {
        const condition: TriggerCondition = {
          type: 'store_context',
          field: 'peak_hours',
          operator: 'eq',
          value: true,
        };
        const context = { ...mockTriggerContext, peak_hours: true };

        const result = triggerService.evaluateCondition(condition, context);
        expect(result).toBe(true);
      });

      it('should evaluate special_event false', () => {
        const condition: TriggerCondition = {
          type: 'store_context',
          field: 'special_event',
          operator: 'eq',
          value: false,
        };
        const context = { ...mockTriggerContext, special_event: false };

        const result = triggerService.evaluateCondition(condition, context);
        expect(result).toBe(true);
      });

      it('should handle missing store context', () => {
        const condition: TriggerCondition = {
          type: 'store_context',
          field: 'store_rating',
          operator: 'gte',
          value: 4.0,
        };
        const context = { ...mockTriggerContext, store_rating: undefined };

        const result = triggerService.evaluateCondition(condition, context);
        expect(result).toBe(false);
      });
    });
  });

  describe('evaluateConditions', () => {
    it('should evaluate AND logic (all conditions must be true)', () => {
      const conditions: TriggerCondition[] = [
        {
          type: 'time_based',
          field: 'current_time',
          operator: 'between',
          value: ['09:00', '17:00'],
        },
        {
          type: 'frequency_based',
          field: 'visit_count',
          operator: 'gte',
          value: 3,
        },
      ];
      const context = {
        ...mockTriggerContext,
        current_time: '14:30',
        visit_count: 5,
      };

      const result = triggerService.evaluateConditions(conditions, context, 'AND');
      expect(result).toBe(true);
    });

    it('should fail AND logic when one condition is false', () => {
      const conditions: TriggerCondition[] = [
        {
          type: 'time_based',
          field: 'current_time',
          operator: 'between',
          value: ['09:00', '17:00'],
        },
        {
          type: 'frequency_based',
          field: 'visit_count',
          operator: 'gte',
          value: 10, // This will fail
        },
      ];
      const context = {
        ...mockTriggerContext,
        current_time: '14:30',
        visit_count: 5,
      };

      const result = triggerService.evaluateConditions(conditions, context, 'AND');
      expect(result).toBe(false);
    });

    it('should evaluate OR logic (any condition can be true)', () => {
      const conditions: TriggerCondition[] = [
        {
          type: 'time_based',
          field: 'current_time',
          operator: 'between',
          value: ['20:00', '23:00'], // This will fail (context is 14:30)
        },
        {
          type: 'frequency_based',
          field: 'visit_count',
          operator: 'gte',
          value: 3, // This will pass
        },
      ];
      const context = {
        ...mockTriggerContext,
        current_time: '14:30',
        visit_count: 5,
      };

      const result = triggerService.evaluateConditions(conditions, context, 'OR');
      expect(result).toBe(true);
    });

    it('should fail OR logic when all conditions are false', () => {
      const conditions: TriggerCondition[] = [
        {
          type: 'time_based',
          field: 'current_time',
          operator: 'between',
          value: ['20:00', '23:00'],
        },
        {
          type: 'frequency_based',
          field: 'visit_count',
          operator: 'gte',
          value: 10,
        },
      ];
      const context = {
        ...mockTriggerContext,
        current_time: '14:30',
        visit_count: 5,
      };

      const result = triggerService.evaluateConditions(conditions, context, 'OR');
      expect(result).toBe(false);
    });

    it('should handle empty conditions array', () => {
      const result = triggerService.evaluateConditions([], mockTriggerContext, 'AND');
      expect(result).toBe(true); // Empty conditions should always pass
    });
  });

  describe('operators', () => {
    const context = mockTriggerContext;

    it('should handle eq operator', () => {
      const condition: TriggerCondition = {
        type: 'frequency_based',
        field: 'visit_count',
        operator: 'eq',
        value: 5,
      };

      const result = triggerService.evaluateCondition(condition, context);
      expect(result).toBe(true);
    });

    it('should handle neq operator', () => {
      const condition: TriggerCondition = {
        type: 'frequency_based',
        field: 'visit_count',
        operator: 'neq',
        value: 3,
      };

      const result = triggerService.evaluateCondition(condition, context);
      expect(result).toBe(true);
    });

    it('should handle gt operator', () => {
      const condition: TriggerCondition = {
        type: 'customer_behavior',
        field: 'total_spent',
        operator: 'gt',
        value: 100,
      };

      const result = triggerService.evaluateCondition(condition, context);
      expect(result).toBe(true);
    });

    it('should handle lte operator', () => {
      const condition: TriggerCondition = {
        type: 'customer_behavior',
        field: 'total_spent',
        operator: 'lte',
        value: 200,
      };

      const result = triggerService.evaluateCondition(condition, context);
      expect(result).toBe(true);
    });

    it('should handle in operator with arrays', () => {
      const condition: TriggerCondition = {
        type: 'time_based',
        field: 'current_day',
        operator: 'in',
        value: ['monday', 'tuesday', 'wednesday'],
      };

      const result = triggerService.evaluateCondition(condition, context);
      expect(result).toBe(true);
    });

    it('should handle nin (not in) operator', () => {
      const condition: TriggerCondition = {
        type: 'time_based',
        field: 'current_day',
        operator: 'nin',
        value: ['saturday', 'sunday'],
      };

      const result = triggerService.evaluateCondition(condition, context);
      expect(result).toBe(true);
    });

    it('should handle contains operator for strings', () => {
      const condition: TriggerCondition = {
        type: 'customer_behavior',
        field: 'customer_segment',
        operator: 'contains',
        value: 'rem',
      };
      const contextWithSegment = { ...context, customer_segment: 'premium' };

      const result = triggerService.evaluateCondition(condition, contextWithSegment);
      expect(result).toBe(true);
    });

    it('should handle invalid operator', () => {
      const condition: TriggerCondition = {
        type: 'frequency_based',
        field: 'visit_count',
        operator: 'invalid' as any,
        value: 5,
      };

      expect(() => triggerService.evaluateCondition(condition, context))
        .toThrow('Invalid operator: invalid');
    });
  });

  describe('timeComparison', () => {
    it('should compare times correctly', () => {
      expect(triggerService.compareTime('14:30', '12:00')).toBe(1);
      expect(triggerService.compareTime('09:15', '09:15')).toBe(0);
      expect(triggerService.compareTime('08:45', '10:30')).toBe(-1);
    });

    it('should handle edge cases in time comparison', () => {
      expect(triggerService.compareTime('00:00', '23:59')).toBe(-1);
      expect(triggerService.compareTime('23:59', '00:00')).toBe(1);
      expect(triggerService.compareTime('12:00', '12:00')).toBe(0);
    });

    it('should validate time format', () => {
      expect(() => triggerService.compareTime('25:00', '12:00'))
        .toThrow('Invalid time format');
      expect(() => triggerService.compareTime('12:60', '12:00'))
        .toThrow('Invalid time format');
      expect(() => triggerService.compareTime('abc', '12:00'))
        .toThrow('Invalid time format');
    });
  });

  describe('dateDifference', () => {
    it('should calculate days between dates', () => {
      const date1 = new Date('2024-01-01');
      const date2 = new Date('2024-01-11');

      expect(triggerService.daysBetween(date1, date2)).toBe(10);
      expect(triggerService.daysBetween(date2, date1)).toBe(10); // Should be absolute
    });

    it('should handle same date', () => {
      const date = new Date('2024-01-01');
      expect(triggerService.daysBetween(date, date)).toBe(0);
    });

    it('should handle dates with time components', () => {
      const date1 = new Date('2024-01-01T14:30:00');
      const date2 = new Date('2024-01-03T08:15:00');

      expect(triggerService.daysBetween(date1, date2)).toBe(2);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle undefined context values gracefully', () => {
      const condition: TriggerCondition = {
        type: 'frequency_based',
        field: 'visit_count',
        operator: 'gte',
        value: 1,
      };
      const contextWithUndefined = { ...mockTriggerContext, visit_count: undefined };

      const result = triggerService.evaluateCondition(condition, contextWithUndefined);
      expect(result).toBe(false);
    });

    it('should handle null context values', () => {
      const condition: TriggerCondition = {
        type: 'customer_behavior',
        field: 'total_spent',
        operator: 'gt',
        value: 0,
      };
      const contextWithNull = { ...mockTriggerContext, total_spent: null };

      const result = triggerService.evaluateCondition(condition, contextWithNull);
      expect(result).toBe(false);
    });

    it('should handle invalid trigger type', () => {
      const condition: TriggerCondition = {
        type: 'invalid_type' as any,
        field: 'some_field',
        operator: 'eq',
        value: 'test',
      };

      expect(() => triggerService.evaluateCondition(condition, mockTriggerContext))
        .toThrow('Invalid trigger type: invalid_type');
    });

    it('should handle invalid field for trigger type', () => {
      const condition: TriggerCondition = {
        type: 'time_based',
        field: 'invalid_field' as any,
        operator: 'eq',
        value: 'test',
      };

      expect(() => triggerService.evaluateCondition(condition, mockTriggerContext))
        .toThrow('Invalid field for time_based trigger: invalid_field');
    });

    it('should handle type mismatches', () => {
      const condition: TriggerCondition = {
        type: 'frequency_based',
        field: 'visit_count',
        operator: 'eq',
        value: 'not_a_number' as any,
      };

      const result = triggerService.evaluateCondition(condition, mockTriggerContext);
      expect(result).toBe(false);
    });
  });

  describe('complex scenarios', () => {
    it('should handle business hours with multiple time ranges', () => {
      const morningCondition: TriggerCondition = {
        type: 'time_based',
        field: 'current_time',
        operator: 'between',
        value: ['09:00', '12:00'],
      };
      const afternoonCondition: TriggerCondition = {
        type: 'time_based',
        field: 'current_time',
        operator: 'between',
        value: ['13:00', '17:00'],
      };

      const morningContext = { ...mockTriggerContext, current_time: '10:30' };
      const lunchContext = { ...mockTriggerContext, current_time: '12:30' };
      const afternoonContext = { ...mockTriggerContext, current_time: '15:00' };

      expect(triggerService.evaluateCondition(morningCondition, morningContext)).toBe(true);
      expect(triggerService.evaluateCondition(morningCondition, lunchContext)).toBe(false);
      expect(triggerService.evaluateCondition(afternoonCondition, afternoonContext)).toBe(true);

      // Test OR logic for business hours
      const businessHours = triggerService.evaluateConditions(
        [morningCondition, afternoonCondition],
        lunchContext,
        'OR'
      );
      expect(businessHours).toBe(false); // Lunch time should fail both

      const businessHoursAfternoon = triggerService.evaluateConditions(
        [morningCondition, afternoonCondition],
        afternoonContext,
        'OR'
      );
      expect(businessHoursAfternoon).toBe(true);
    });

    it('should handle premium customer experience flow', () => {
      const conditions: TriggerCondition[] = [
        {
          type: 'customer_behavior',
          field: 'total_spent',
          operator: 'gte',
          value: 500,
        },
        {
          type: 'frequency_based',
          field: 'visit_count',
          operator: 'gte',
          value: 10,
        },
        {
          type: 'store_context',
          field: 'store_rating',
          operator: 'gte',
          value: 4.5,
        },
      ];

      const premiumContext = {
        ...mockTriggerContext,
        total_spent: 750,
        visit_count: 15,
        store_rating: 4.8,
      };

      const result = triggerService.evaluateConditions(conditions, premiumContext, 'AND');
      expect(result).toBe(true);
    });

    it('should handle new customer onboarding flow', () => {
      const conditions: TriggerCondition[] = [
        {
          type: 'frequency_based',
          field: 'visit_count',
          operator: 'lte',
          value: 2,
        },
        {
          type: 'frequency_based',
          field: 'days_since_last_visit',
          operator: 'lte',
          value: 7,
        },
      ];

      const newCustomerContext = {
        ...mockTriggerContext,
        visit_count: 1,
        last_visit: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      };

      const result = triggerService.evaluateConditions(conditions, newCustomerContext, 'AND');
      expect(result).toBe(true);
    });
  });
});