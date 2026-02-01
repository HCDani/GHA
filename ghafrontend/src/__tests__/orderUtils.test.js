import {
  calculateNextOrder,
  getAvailableOrders,
  validateOrderSwap,
  findConflictingGreenhouse,
} from '../utils/orderUtils';

describe('Order Management Utilities', () => {
  describe('calculateNextOrder', () => {
    test('returns 0 for empty greenhouses list', () => {
      expect(calculateNextOrder([])).toBe(0);
    });

    test('returns 1 when one greenhouse with order 0 exists', () => {
      const greenhouses = [{ id: 'gh1', order: 0, title: 'GH1' }];
      expect(calculateNextOrder(greenhouses)).toBe(1);
    });

    test('returns max order + 1', () => {
      const greenhouses = [
        { id: 'gh1', order: 0, title: 'GH1' },
        { id: 'gh2', order: 1, title: 'GH2' },
        { id: 'gh3', order: 2, title: 'GH3' },
      ];
      expect(calculateNextOrder(greenhouses)).toBe(3);
    });

    test('handles unordered greenhouses list', () => {
      const greenhouses = [
        { id: 'gh1', order: 5, title: 'GH1' },
        { id: 'gh2', order: 1, title: 'GH2' },
        { id: 'gh3', order: 3, title: 'GH3' },
      ];
      expect(calculateNextOrder(greenhouses)).toBe(6);
    });

    test('handles gaps in orders', () => {
      const greenhouses = [
        { id: 'gh1', order: 0, title: 'GH1' },
        { id: 'gh2', order: 5, title: 'GH2' },
      ];
      expect(calculateNextOrder(greenhouses)).toBe(6);
    });
  });

  describe('getAvailableOrders', () => {
    test('returns empty array for 0 greenhouses', () => {
      expect(getAvailableOrders(0)).toEqual([]);
    });

    test('returns [0] for 1 greenhouse', () => {
      expect(getAvailableOrders(1)).toEqual([0]);
    });

    test('returns [0, 1, 2] for 3 greenhouses', () => {
      expect(getAvailableOrders(3)).toEqual([0, 1, 2]);
    });

    test('returns sequential array for n greenhouses', () => {
      expect(getAvailableOrders(5)).toEqual([0, 1, 2, 3, 4]);
    });
  });

  describe('validateOrderSwap', () => {
    test('returns true for valid swap', () => {
      const availableOrders = [0, 1, 2];
      expect(validateOrderSwap(0, 1, availableOrders)).toBe(true);
    });

    test('returns false for swapping with same order', () => {
      const availableOrders = [0, 1, 2];
      expect(validateOrderSwap(0, 0, availableOrders)).toBe(false);
    });

    test('returns false for order outside available range', () => {
      const availableOrders = [0, 1, 2];
      expect(validateOrderSwap(0, 5, availableOrders)).toBe(false);
    });

    test('returns false for negative order', () => {
      const availableOrders = [0, 1, 2];
      expect(validateOrderSwap(0, -1, availableOrders)).toBe(false);
    });
  });

  describe('findConflictingGreenhouse', () => {
    test('returns greenhouse with same order', () => {
      const greenhouses = [
        { id: 'gh1', order: 0, title: 'GH1' },
        { id: 'gh2', order: 1, title: 'GH2' },
      ];
      const conflict = findConflictingGreenhouse(greenhouses, 'gh1', 1);
      expect(conflict).toEqual({ id: 'gh2', order: 1, title: 'GH2' });
    });

    test('returns undefined when no conflict', () => {
      const greenhouses = [
        { id: 'gh1', order: 0, title: 'GH1' },
        { id: 'gh2', order: 1, title: 'GH2' },
      ];
      const conflict = findConflictingGreenhouse(greenhouses, 'gh1', 5);
      expect(conflict).toBeUndefined();
    });

    test('ignores the current greenhouse id', () => {
      const greenhouses = [
        { id: 'gh1', order: 0, title: 'GH1' },
        { id: 'gh2', order: 1, title: 'GH2' },
      ];
      // Trying to find conflict for gh1 with order 0 should not return gh1 itself
      const conflict = findConflictingGreenhouse(greenhouses, 'gh1', 0);
      expect(conflict).toBeUndefined();
    });

    test('handles multiple greenhouses with search', () => {
      const greenhouses = [
        { id: 'gh1', order: 0, title: 'GH1' },
        { id: 'gh2', order: 1, title: 'GH2' },
        { id: 'gh3', order: 2, title: 'GH3' },
      ];
      const conflict = findConflictingGreenhouse(greenhouses, 'gh1', 2);
      expect(conflict).toEqual({ id: 'gh3', order: 2, title: 'GH3' });
    });
  });

  describe('Order Management Edge Cases', () => {
    test('order calculations with large numbers', () => {
      const greenhouses = [
        { id: 'gh1', order: 1000, title: 'GH1' },
        { id: 'gh2', order: 2000, title: 'GH2' },
      ];
      expect(calculateNextOrder(greenhouses)).toBe(2001);
    });

    test('available orders with many greenhouses', () => {
      const result = getAvailableOrders(100);
      expect(result.length).toBe(100);
      expect(result[0]).toBe(0);
      expect(result[99]).toBe(99);
    });
  });
});
