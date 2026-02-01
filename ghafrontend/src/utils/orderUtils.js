/**
 * Pure utility functions for order management
 */

export function calculateNextOrder(greenhouses) {
  if (greenhouses.length === 0) {
    return 0;
  }
  return Math.max(...greenhouses.map((g) => g.order)) + 1;
}

export function getAvailableOrders(greenhouseCount) {
  return Array.from({ length: greenhouseCount }, (_, i) => i);
}

export function validateOrderSwap(currentOrder, newOrder, availableOrders) {
  return availableOrders.includes(newOrder) && newOrder !== currentOrder;
}

export function findConflictingGreenhouse(greenhouses, id, newOrder) {
  return greenhouses.find((g) => g.id !== id && g.order === newOrder);
}
