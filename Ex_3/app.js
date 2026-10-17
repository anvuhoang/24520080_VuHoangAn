/**
 * Exercise 3 — Resilient State Machine & Skeleton Loader
 * Phase 2: Semantic Data Feed UI with 4 States
 *
 * Implements:
 * - IDLE: "Load Data" button
 * - LOADING: Animated pulsing CSS skeleton placeholders, prevents duplicate requests
 * - SUCCESS: Render fetched data safely (no innerHTML, zero XSS vulnerability)
 * - ERROR: Human-readable error message with role="alert", "Retry Connection" button
 * - Retry triggers a new request
 * - Preserves race-condition protection via ResilientStateMachine
 * - Accessible semantic HTML and prefers-reduced-motion support
 */

import {
  StateStatus,
  createIdleState,
  createLoadingState,
  createSuccessState,
  createErrorState,
  isValidState,
  ResilientStateMachine
} from './state-machine.js';

/**
 * Default sample data items for the engineering feed.
 */
export const SAMPLE_PROJECTS = Object.freeze([
  {
    id: 1,
    title: 'Reactive Virtual DOM Engine',
    category: 'Frontend Core',
    description: 'Lightweight reconciliation engine with synthetic root event delegation and predictable unidirectional flow.',
    status: 'Completed'
  },
  {
    id: 2,
    title: 'Resilient Async State Machine',
    category: 'State Architecture',
    description: 'Discriminated union lifecycle guarding race conditions with sequence monotonic tokens.',
    status: 'In Progress'
  },
  {
    id: 3,
    title: 'Zero-CLS Shimmer Skeleton Loader',
    category: 'UX / Performance',
    description: 'Hardware-accelerated CSS shimmer gradient placeholders mirroring final card dimensions.',
    status: 'Active'
  }
]);

/**
 * Creates a mock asynchronous data fetcher.
 *
 * @param {number} [delayMs=1000] - Simulated network latency
 * @param {() => boolean|boolean} [shouldFail=false] - Whether to simulate network failure
 * @returns {() => Promise<Array<object>>}
 */
export function createMockFetcher(delayMs = 1000, shouldFail = false) {
  return async () => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    const isFailing = typeof shouldFail === 'function' ? shouldFail() : Boolean(shouldFail);
    if (isFailing) {
      throw new Error('NetworkError: Failed to fetch data from remote server (503 Service Unavailable).');
    }

    // Return structured clone to prevent accidental mutations
    return JSON.parse(JSON.stringify(SAMPLE_PROJECTS));
  };
}

/**
 * Helper to safely construct DOM elements without using innerHTML.
 *
 * @param {string} tag
 * @param {Record<string, any>} [attrs={}]
 * @param {...(Node|string|number|null|undefined)} children
 * @returns {HTMLElement}
 */
export function createDOM(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);

  for (const [key, val] of Object.entries(attrs)) {
    if (val === undefined || val === null) continue;

    if (key.startsWith('on') && typeof val === 'function') {
      const eventName = key.slice(2).toLowerCase();
      el.addEventListener(eventName, val);
    } else if (key === 'className' || key === 'class') {
      el.className = String(val);
    } else if (key === 'disabled') {
      if (val) {
        el.setAttribute('disabled', '');
        el.disabled = true;
      } else {
        el.removeAttribute('disabled');
        el.disabled = false;
      }
    } else if (key === 'checked') {
      el.checked = Boolean(val);
    } else {
      el.setAttribute(key, String(val));
    }
  }

  for (const child of children) {
    if (child == null) continue;
    if (typeof child === 'string' || typeof child === 'number') {
      el.appendChild(document.createTextNode(String(child)));
    } else if ((typeof Node !== 'undefined' && child instanceof Node) || (child && typeof child === 'object' && child.nodeType)) {
      el.appendChild(child);
    }
  }

  return el;
}

/**
 * Renders the IDLE state view.
 * Shows a "Load Data" button.
 *
 * @param {{ onLoad: Function }} actions
 * @returns {HTMLElement}
 */
export function renderIdleView(actions) {
  const container = createDOM('div', { class: 'state-container state-idle', id: 'idle-view' });

  const card = createDOM('div', { class: 'idle-card' });
  const icon = createDOM('div', { class: 'idle-icon', 'aria-hidden': 'true' }, '📡');
  const title = createDOM('h3', { class: 'idle-title' }, 'Data Feed Ready');
  const desc = createDOM(
    'p',
    { class: 'idle-desc' },
    'Click the button below to retrieve the latest real-time project metrics.'
  );

  const loadBtn = createDOM(
    'button',
    {
      id: 'load-data-btn',
      class: 'btn btn-primary',
      type: 'button',
      'aria-label': 'Load project feed data',
      onClick: () => {
        if (typeof actions?.onLoad === 'function') {
          actions.onLoad();
        }
      }
    },
    'Load Data'
  );

  card.appendChild(icon);
  card.appendChild(title);
  card.appendChild(desc);
  card.appendChild(loadBtn);
  container.appendChild(card);

  return container;
}

/**
 * Creates a single animated skeleton card placeholder.
 *
 * @returns {HTMLElement}
 */
export function createSkeletonCard() {
  const card = createDOM('article', { class: 'skeleton-card' });

  const header = createDOM(
    'div',
    { class: 'skeleton-header' },
    createDOM('div', { class: 'skeleton skeleton-badge' }),
    createDOM('div', { class: 'skeleton skeleton-title' })
  );

  const body = createDOM(
    'div',
    { class: 'skeleton-body' },
    createDOM('div', { class: 'skeleton skeleton-line' }),
    createDOM('div', { class: 'skeleton skeleton-line line-short' })
  );

  const footer = createDOM(
    'div',
    { class: 'skeleton-footer' },
    createDOM('div', { class: 'skeleton skeleton-pill' })
  );

  card.appendChild(header);
  card.appendChild(body);
  card.appendChild(footer);
  return card;
}

/**
 * Renders the LOADING state view.
 * Displays animated pulsing CSS skeleton placeholders.
 *
 * @param {{ count?: number }} [options]
 * @returns {HTMLElement}
 */
export function renderLoadingView(options = {}) {
  const count = options.count || 3;
  const container = createDOM('div', {
    class: 'state-container state-loading',
    id: 'loading-view',
    role: 'status',
    'aria-busy': 'true',
    'aria-live': 'polite'
  });

  const srText = createDOM(
    'span',
    { class: 'sr-only' },
    'Loading project feed data, please wait...'
  );
  container.appendChild(srText);

  const grid = createDOM('div', { class: 'skeleton-grid', 'aria-hidden': 'true' });
  for (let i = 0; i < count; i++) {
    grid.appendChild(createSkeletonCard());
  }
  container.appendChild(grid);

  return container;
}

/**
 * Safely renders a single project card from data item.
 * Strictly uses text nodes; never sets innerHTML.
 *
 * @param {any} item
 * @returns {HTMLElement}
 */
export function renderProjectCard(item) {
  const card = createDOM('article', { class: 'project-card', tabindex: '0' });

  // Handle object or primitive item safely
  if (typeof item === 'object' && item !== null) {
    const category = item.category || 'Engineering';
    const titleText = item.title || item.name || 'Untitled Project';
    const descText = item.description || item.summary || 'No description provided.';
    const statusText = item.status || 'Active';

    const header = createDOM(
      'header',
      { class: 'card-header' },
      createDOM('span', { class: 'badge badge-accent' }, category),
      createDOM('h3', { class: 'card-title' }, titleText)
    );

    const desc = createDOM('p', { class: 'card-desc' }, descText);

    const footer = createDOM(
      'footer',
      { class: 'card-footer' },
      createDOM('span', { class: 'status-indicator' }, statusText)
    );

    card.appendChild(header);
    card.appendChild(desc);
    card.appendChild(footer);
  } else {
    // Primitive data
    const title = createDOM('h3', { class: 'card-title' }, String(item));
    card.appendChild(title);
  }

  return card;
}

/**
 * Renders the SUCCESS state view.
 * Renders fetched data safely using semantic HTML.
 *
 * @param {any} data
 * @param {{ onReload?: Function }} actions
 * @returns {HTMLElement}
 */
export function renderSuccessView(data, actions = {}) {
  const container = createDOM('div', { class: 'state-container state-success', id: 'success-view' });

  const items = Array.isArray(data) ? data : data !== null && data !== undefined ? [data] : [];

  // Toolbar
  const toolbar = createDOM('div', { class: 'feed-toolbar' });
  const countLabel = createDOM(
    'span',
    { class: 'feed-count' },
    `Showing ${items.length} ${items.length === 1 ? 'item' : 'items'}`
  );

  const reloadBtn = createDOM(
    'button',
    {
      id: 'reload-btn',
      class: 'btn btn-secondary btn-sm',
      type: 'button',
      'aria-label': 'Refresh feed data',
      onClick: () => {
        if (typeof actions?.onReload === 'function') {
          actions.onReload();
        }
      }
    },
    'Refresh Feed'
  );

  toolbar.appendChild(countLabel);
  toolbar.appendChild(reloadBtn);
  container.appendChild(toolbar);

  if (items.length === 0) {
    const emptyState = createDOM(
      'div',
      { class: 'empty-state' },
      createDOM('p', {}, 'No feed items available.')
    );
    container.appendChild(emptyState);
    return container;
  }

  // Live semantic feed grid
  const grid = createDOM('div', {
    class: 'project-grid',
    role: 'feed',
    'aria-label': 'Project Feed List'
  });

  for (const item of items) {
    grid.appendChild(renderProjectCard(item));
  }

  container.appendChild(grid);
  return container;
}

/**
 * Renders the ERROR state view.
 * Displays a human-readable error message and a "Retry Connection" button.
 *
 * @param {string} errorMessage
 * @param {{ onRetry: Function }} actions
 * @returns {HTMLElement}
 */
export function renderErrorView(errorMessage, actions) {
  const container = createDOM('div', {
    class: 'state-container state-error',
    id: 'error-view',
    role: 'alert',
    'aria-live': 'assertive'
  });

  const card = createDOM('div', { class: 'error-card' });

  const header = createDOM(
    'div',
    { class: 'error-header' },
    createDOM('span', { class: 'error-icon', 'aria-hidden': 'true' }, '⚠️'),
    createDOM('h3', { class: 'error-heading' }, 'Connection Failed')
  );

  const msg = createDOM(
    'p',
    { class: 'error-message', id: 'error-message' },
    errorMessage || 'An unknown network error occurred.'
  );

  const actionsRow = createDOM('div', { class: 'error-actions' });
  const retryBtn = createDOM(
    'button',
    {
      id: 'retry-btn',
      class: 'btn btn-retry',
      type: 'button',
      'aria-label': 'Retry connection to load data',
      onClick: () => {
        if (typeof actions?.onRetry === 'function') {
          actions.onRetry();
        }
      }
    },
    'Retry Connection'
  );

  actionsRow.appendChild(retryBtn);
  card.appendChild(header);
  card.appendChild(msg);
  card.appendChild(actionsRow);
  container.appendChild(card);

  return container;
}

/**
 * Master View Renderer that dispatches based on the current ViewState.
 *
 * @param {import('./state-machine.js').ViewState<any>} state
 * @param {{ onLoad?: Function, onRetry?: Function, onReload?: Function }} actions
 * @returns {HTMLElement}
 */
export function renderView(state, actions = {}) {
  if (!isValidState(state)) {
    throw new TypeError(`Cannot render view for invalid state: ${JSON.stringify(state)}`);
  }

  switch (state.status) {
    case StateStatus.IDLE:
      return renderIdleView(actions);

    case StateStatus.LOADING:
      return renderLoadingView();

    case StateStatus.SUCCESS:
      return renderSuccessView(state.data, actions);

    case StateStatus.ERROR:
      return renderErrorView(state.error, actions);

    default:
      throw new Error(`Unhandled state status: ${state.status}`);
  }
}

/**
 * Initializes and mounts the semantic data-feed application.
 *
 * @param {HTMLElement} container
 * @param {object} [options={}]
 * @param {() => Promise<any>} [options.fetcher]
 * @param {boolean} [options.preventDuplicate=true]
 * @param {ResilientStateMachine} [options.stateMachine]
 * @returns {{ stateMachine: ResilientStateMachine, loadData: Function, retry: Function, destroy: Function }}
 */
export function initApp(container, options = {}) {
  if (!container) {
    throw new TypeError('Container element is required to initialize application');
  }

  const stateMachine = options.stateMachine || new ResilientStateMachine();
  const fetcher = options.fetcher || createMockFetcher(1200);
  const preventDuplicate = options.preventDuplicate !== false;

  const actions = {
    onLoad: () => handleLoad(),
    onRetry: () => handleRetry(),
    onReload: () => handleLoad()
  };

  /**
   * Safely updates the mounted DOM to reflect the new state.
   */
  function updateDOM(state) {
    const newView = renderView(state, actions);
    if (typeof container.replaceChildren === 'function') {
      container.replaceChildren(newView);
    } else {
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
      container.appendChild(newView);
    }
  }

  /**
   * Triggers data loading while preventing duplicate calls when already LOADING.
   */
  function handleLoad() {
    if (preventDuplicate && stateMachine.getState().status === StateStatus.LOADING) {
      return Promise.resolve({ duplicate: true });
    }
    return stateMachine.loadData(fetcher, { preventDuplicate });
  }

  /**
   * Triggers a new retry request while preventing duplicate calls when already LOADING.
   */
  function handleRetry() {
    if (preventDuplicate && stateMachine.getState().status === StateStatus.LOADING) {
      return Promise.resolve({ duplicate: true });
    }
    return stateMachine.loadData(fetcher, { preventDuplicate });
  }

  // Subscribe to state machine changes
  const unsubscribe = stateMachine.subscribe(updateDOM);

  // Initial render with current state
  updateDOM(stateMachine.getState());

  return {
    stateMachine,
    loadData: handleLoad,
    retry: handleRetry,
    destroy: () => {
      unsubscribe();
    }
  };
}

// Auto-initialize when running in browser environment with #app element
if (typeof document !== 'undefined') {
  const mountPoint = document.getElementById('app');
  if (mountPoint) {
    // Interactive error simulation toggle support
    let simulateFailure = false;

    const dynamicFetcher = async () => {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      if (simulateFailure) {
        throw new Error('NetworkError: Connection timed out while contacting upstream API gateway (504 Gateway Timeout).');
      }
      return JSON.parse(JSON.stringify(SAMPLE_PROJECTS));
    };

    const appInstance = initApp(mountPoint, { fetcher: dynamicFetcher });

    // Inject demo controls toolbar below main app if not already present
    const demoControls = document.getElementById('demo-controls');
    if (demoControls) {
      const checkbox = demoControls.querySelector('#simulate-error-checkbox');
      if (checkbox) {
        checkbox.addEventListener('change', (e) => {
          simulateFailure = e.target.checked;
        });
      }
    }
  }
}

export default {
  SAMPLE_PROJECTS,
  createMockFetcher,
  createDOM,
  renderIdleView,
  createSkeletonCard,
  renderLoadingView,
  renderProjectCard,
  renderSuccessView,
  renderErrorView,
  renderView,
  initApp
};
