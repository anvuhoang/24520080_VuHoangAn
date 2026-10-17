/**
 * Reactive Engine — Exercise 2 (Phase 1)
 *
 * Implements centralized state store and cursor management:
 * - Centralized stateStore array
 * - resetCursor() to reset hook invocation index before render passes
 * - Stable hook call order & multiple state slots support
 * - State preservation across renders without unintended resets
 */

/**
 * Centralized state array storing hook states across render passes.
 */
export const stateStore = [];

/**
 * Current hook allocation cursor index.
 */
let cursor = 0;

/**
 * Resets the hook allocation cursor to index 0.
 * Must be called before each render cycle.
 * Does NOT clear or reset stored state values.
 */
export function resetCursor() {
  cursor = 0;
}

/**
 * Returns the current cursor position.
 * @returns {number}
 */
export function getCursor() {
  return cursor;
}

/**
 * Allocates or retrieves the state slot at the current cursor index.
 * - If slot has not been initialized (undefined), initializes it with initialValue.
 * - If slot already contains a value (from a prior render), preserves existing value.
 * - Advances the cursor by 1 to maintain stable hook order.
 *
 * @param {any} initialValue - Default value or factory function for new slots
 * @returns {[any, Function]} [currentState, stateSetter]
 */
export function allocateSlot(initialValue) {
  const currentSlot = cursor;

  // Initialize slot only if it has never been set
  if (stateStore[currentSlot] === undefined) {
    stateStore[currentSlot] =
      typeof initialValue === "function" ? initialValue() : initialValue;
  }

  const setState = (newValue) => {
    const nextValue =
      typeof newValue === "function"
        ? newValue(stateStore[currentSlot])
        : newValue;
    stateStore[currentSlot] = nextValue;
    return nextValue;
  };

  cursor++;
  return [stateStore[currentSlot], setState];
}

/**
 * Resets both the cursor and the stateStore array.
 * Intended for testing harness and clean engine resets.
 */
export function clearStateStore() {
  stateStore.length = 0;
  cursor = 0;
}

export default {
  stateStore,
  resetCursor,
  getCursor,
  allocateSlot,
  clearStateStore
};
