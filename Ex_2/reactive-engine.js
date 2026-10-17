/**
 * Reactive Engine — Exercise 2 (Phase 2)
 *
 * Implements closure-based useState hook and unidirectional re-render loop:
 * - Centralized stateStore array
 * - resetCursor() to reset hook invocation index before render passes
 * - useState(initialValue) with closure-bound slot index
 * - Functional state updates support: setState(prev => next)
 * - Automatic re-render triggering upon state mutation
 * - Stable hook ordering & multi-slot state preservation
 */

import { renderToDOM } from "../Ex_1/mini-react.js";

/**
 * Centralized state array storing hook states across render passes.
 */
export const stateStore = [];

/**
 * Current hook allocation cursor index.
 */
let cursor = 0;

/**
 * Registered root render callback and container.
 */
let currentRenderer = null;
let currentContainer = null;

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
 * Registers an active render callback and optional DOM container.
 *
 * @param {Function} renderer - Function that executes component render pass
 * @param {HTMLElement|null} [container=null] - Target DOM container
 */
export function setRenderer(renderer, container = null) {
  currentRenderer = renderer;
  if (container !== null) {
    currentContainer = container;
  }
}

/**
 * Triggers a top-down re-render cycle:
 * 1. Resets cursor to 0 before rendering
 * 2. Invokes active renderer
 * 3. Mounts resulting VNode to container if provided
 *
 * @returns {any} Result of renderer execution
 */
export function triggerReRender() {
  if (!currentRenderer) {
    return null;
  }

  // 1. Reset hook cursor before rendering pass
  resetCursor();

  // 2. Execute root component
  const vdom = currentRenderer();

  // 3. Mount to container if container exists
  if (currentContainer && typeof currentContainer.replaceChildren === "function") {
    if (vdom && typeof vdom === "object") {
      const dom = renderToDOM(vdom);
      currentContainer.replaceChildren(dom);
    }
  }

  return vdom;
}

/**
 * Mounts a component to a DOM container and executes the initial render.
 *
 * @param {Function} Component - Root component function
 * @param {HTMLElement} container - DOM container element
 * @returns {any} Rendered output
 */
export function mountApp(Component, container) {
  setRenderer(Component, container);
  return triggerReRender();
}

/**
 * Custom useState hook with closure-bound slot binding.
 *
 * @param {any} initialValue - Default value or factory function for new slots
 * @returns {[any, Function]} [currentState, setState]
 */
export function useState(initialValue) {
  // Capture the current hook slot index in a closure
  const slotIndex = cursor;

  // Initialize slot only if this slot has not yet been allocated in stateStore
  if (!(slotIndex in stateStore)) {
    stateStore[slotIndex] =
      typeof initialValue === "function" ? initialValue() : initialValue;
  }

  const currentState = stateStore[slotIndex];

  // Closure-bound state setter
  const setState = (newValue) => {
    const nextValue =
      typeof newValue === "function"
        ? newValue(stateStore[slotIndex])
        : newValue;

    // Update state store at the captured slot index
    stateStore[slotIndex] = nextValue;

    // Trigger reactive re-render cycle
    triggerReRender();

    return nextValue;
  };

  cursor++;
  return [currentState, setState];
}

/**
 * Backward compatibility helper for direct slot allocation without re-rendering.
 *
 * @param {any} initialValue
 * @returns {[any, Function]} [currentState, setState]
 */
export function allocateSlot(initialValue) {
  const slotIndex = cursor;

  if (!(slotIndex in stateStore)) {
    stateStore[slotIndex] =
      typeof initialValue === "function" ? initialValue() : initialValue;
  }

  const setState = (newValue) => {
    const nextValue =
      typeof newValue === "function"
        ? newValue(stateStore[slotIndex])
        : newValue;
    stateStore[slotIndex] = nextValue;
    return nextValue;
  };

  cursor++;
  return [stateStore[slotIndex], setState];
}

/**
 * Resets engine state, cursor, and registered renderers (for test isolation).
 */
export function clearStateStore() {
  stateStore.length = 0;
  cursor = 0;
  currentRenderer = null;
  currentContainer = null;
}

export default {
  stateStore,
  resetCursor,
  getCursor,
  setRenderer,
  triggerReRender,
  mountApp,
  useState,
  allocateSlot,
  clearStateStore
};
