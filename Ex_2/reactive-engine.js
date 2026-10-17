/**
 * Reactive Engine — Exercise 2 (Phase 1, 2 & 3)
 *
 * Implements:
 * - Centralized stateStore & resetCursor()
 * - Closure-based useState hook supporting functional updates
 * - Unidirectional reactive re-render loop
 * - Centralized root event delegation on root container
 * - Handler dispatch with bubbling support for button children
 * - Prevention of duplicate & orphan listeners
 */

import {
  createElement,
  createTextElement,
  isValidVNode,
  TEXT_ELEMENT
} from "../Ex_1/mini-react.js";

// Re-export core VNode factory APIs
export { createElement, createTextElement, isValidVNode, TEXT_ELEMENT };

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
 * Event registry mapping DOM elements to their VNode event handlers.
 * Uses a WeakMap to automatically garbage-collect handlers when elements are detached.
 */
export const eventRegistry = new WeakMap();

/**
 * Supported delegated event types.
 */
export const DELEGATED_EVENTS = ["click", "input", "change", "submit", "keydown", "keyup"];

/**
 * Tracks root containers that already have delegation listeners attached.
 * Prevents duplicate listeners.
 */
const delegatedContainers = new WeakSet();

/**
 * Resets the hook allocation cursor to index 0.
 * Must be called before each render cycle.
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
 * Registers an event handler for a specific DOM element without adding individual DOM listeners.
 *
 * @param {HTMLElement} element
 * @param {string} eventType - e.g. 'click', 'input'
 * @param {Function} handler
 */
export function registerEventHandler(element, eventType, handler) {
  if (!element || typeof element !== "object") return;
  if (typeof handler !== "function") {
    throw new TypeError(`Event handler for '${eventType}' must be a function`);
  }

  const type = eventType.toLowerCase();

  let handlers = eventRegistry.get(element);
  if (!handlers) {
    handlers = {};
    eventRegistry.set(element, handlers);
  }
  handlers[type] = handler;

  // Also bind to property for fast lookup and mock environments
  if (!element.__handlers) {
    element.__handlers = {};
  }
  element.__handlers[type] = handler;
}

/**
 * Retrieves registered handlers for an element.
 *
 * @param {HTMLElement} element
 * @returns {object|null}
 */
export function getEventHandlers(element) {
  if (!element || typeof element !== "object") return null;
  return eventRegistry.get(element) || element.__handlers || null;
}

/**
 * Sets up centralized event delegation on the root container.
 * - Attaches listeners only to the root container.
 * - Prevents duplicate listener registration if called multiple times.
 * - Dispatches events by bubbling up from event.target to container.
 *
 * @param {HTMLElement} container - Root container element
 */
export function setupEventDelegation(container) {
  if (!container || typeof container !== "object") return;
  if (delegatedContainers.has(container) || container._hasRootDelegation) {
    return; // Already attached, prevent duplicate listeners
  }

  delegatedContainers.add(container);
  container._hasRootDelegation = true;

  for (const eventType of DELEGATED_EVENTS) {
    if (typeof container.addEventListener === "function") {
      container.addEventListener(eventType, (event) => {
        let current = event.target;

        // Traverse up the DOM hierarchy from event.target to container
        while (current && current !== container) {
          const handlers = getEventHandlers(current);
          if (handlers && typeof handlers[eventType] === "function") {
            handlers[eventType](event);
            if (event.cancelBubble || event.defaultPrevented) {
              break;
            }
          }
          current = current.parentElement || current.parentNode;
        }
      });
    }
  }
}

// Disallowed dangerous attributes and properties
const FORBIDDEN_PROPS = new Set([
  "innerhtml",
  "outerhtml",
  "insertadjacenthtml",
  "dangerouslysetinnerhtml"
]);

/**
 * Applies properties to a DOM element.
 * Forwards event listeners to the centralized eventRegistry for root delegation
 * rather than attaching per-element DOM listeners.
 *
 * @param {HTMLElement} domElement
 * @param {object} props
 */
function applyProps(domElement, props) {
  if (!props || typeof props !== "object") return;

  for (const [key, value] of Object.entries(props)) {
    if (key === "children" || key === "nodeValue") {
      continue;
    }

    const lowerKey = key.toLowerCase();

    // Security guard: forbid direct HTML injection
    if (FORBIDDEN_PROPS.has(lowerKey)) {
      throw new TypeError(`Forbidden property '${key}': direct HTML injection is strictly disallowed`);
    }

    // Security guard: reject javascript: protocol URIs
    if (typeof value === "string" && /^\s*javascript\s*:/i.test(value)) {
      throw new Error(`Unsafe URI detected in attribute '${key}': javascript: URLs are rejected`);
    }

    // Event handlers (e.g. onClick, onInput) -> Register for root delegation
    if (/^on[A-Z]/.test(key) || /^on[a-z]/.test(key)) {
      if (typeof value !== "function") {
        throw new TypeError(
          `Event handler for '${key}' must be a function, but got ${typeof value}. Inline string handlers are forbidden.`
        );
      }
      const eventName = key.slice(2).toLowerCase();
      // Register with centralized event delegation engine instead of element.addEventListener()
      registerEventHandler(domElement, eventName, value);
      continue;
    }

    // Safe attributes
    if (key === "className" || key === "class") {
      if (typeof value !== "string") {
        throw new TypeError("className must be a string");
      }
      domElement.className = value;
      domElement.setAttribute("class", value);
    } else if (key === "id") {
      if (typeof value !== "string") {
        throw new TypeError("id must be a string");
      }
      domElement.id = value;
      domElement.setAttribute("id", value);
    } else if (key === "role") {
      if (typeof value !== "string") {
        throw new TypeError("role must be a string");
      }
      domElement.setAttribute("role", value);
    } else if (typeof value === "boolean") {
      if (value) {
        domElement.setAttribute(key, "");
      } else {
        domElement.removeAttribute(key);
      }
    } else if (typeof value === "string" || typeof value === "number") {
      domElement.setAttribute(key, String(value));
    }
  }
}

/**
 * Mounts a Virtual DOM tree to native DOM nodes with root event delegation.
 *
 * @param {object} vnode - The Virtual DOM node to render
 * @param {Node|null} [container=null] - Optional DOM container to append to
 * @returns {Node} Created native DOM node
 */
export function renderToDOM(vnode, container = null) {
  if (!isValidVNode(vnode)) {
    throw new TypeError("Invalid VNode: cannot render malformed or non-VNode object");
  }

  let domNode;

  if (vnode.type === TEXT_ELEMENT) {
    domNode = document.createTextNode(vnode.props.nodeValue);
  } else {
    domNode = document.createElement(vnode.type);

    // Apply props and register event handlers for delegation
    applyProps(domNode, vnode.props);

    // Mount children recursively in exact order without extra wrappers
    for (const child of vnode.props.children) {
      const childDom = renderToDOM(child);
      domNode.appendChild(childDom);
    }
  }

  if (container !== null && container !== undefined) {
    if (!container || typeof container.appendChild !== "function") {
      throw new TypeError("Container must be a valid DOM node supporting appendChild");
    }
    setupEventDelegation(container);
    container.appendChild(domNode);
  }

  return domNode;
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
    setupEventDelegation(container);
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
 * Mounts a component to a DOM container, configures event delegation, and executes initial render.
 *
 * @param {Function} Component - Root component function
 * @param {HTMLElement} container - DOM container element
 * @returns {any} Rendered output
 */
export function mountApp(Component, container) {
  setupEventDelegation(container);
  setRenderer(Component, container);
  return triggerReRender();
}

/**
 * Mounts or updates an application component into a container.
 * Compatible with instructor verification suite contract:
 * import { useState, renderApp } from './reactive-engine.js';
 *
 * @param {Function} [Component] - Root component function
 * @param {HTMLElement} [container] - Target DOM container (defaults to #app)
 * @returns {any} Rendered output
 */
export function renderApp(Component, container) {
  if (Component) {
    currentRenderer = Component;
  }
  if (container) {
    currentContainer = container;
    setupEventDelegation(container);
  }
  if (!currentContainer && typeof document !== "undefined") {
    currentContainer = document.getElementById("app");
    if (currentContainer) {
      setupEventDelegation(currentContainer);
    }
  }

  return triggerReRender();
}

/**
 * Custom useState hook with closure-bound slot binding.
 *
 * @param {any} initialValue - Default value or factory function for new slots
 * @returns {[any, Function]} [currentState, setState]
 */
export function useState(initialValue) {
  const slotIndex = cursor;

  if (!(slotIndex in stateStore)) {
    stateStore[slotIndex] =
      typeof initialValue === "function" ? initialValue() : initialValue;
  }

  const currentState = stateStore[slotIndex];

  const setState = (newValue) => {
    const nextValue =
      typeof newValue === "function"
        ? newValue(stateStore[slotIndex])
        : newValue;

    stateStore[slotIndex] = nextValue;
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
  eventRegistry,
  registerEventHandler,
  getEventHandlers,
  setupEventDelegation,
  renderToDOM,
  createElement,
  createTextElement,
  isValidVNode,
  TEXT_ELEMENT,
  setRenderer,
  triggerReRender,
  mountApp,
  renderApp,
  useState,
  allocateSlot,
  clearStateStore
};
