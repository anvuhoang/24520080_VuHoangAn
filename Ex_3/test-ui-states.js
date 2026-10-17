/**
 * Automated Test Suite for Exercise 3 - Phase 2
 *
 * Verifies:
 * 1. IDLE state: Renders "Load Data" button, clicking triggers load.
 * 2. LOADING state: Displays animated pulsing skeleton placeholders, role="status", aria-busy="true".
 * 3. LOADING state: Prevents duplicate requests when fetch is in flight.
 * 4. SUCCESS state: Renders fetched data safely into semantic cards (zero innerHTML / XSS safe).
 * 5. ERROR state: Displays human-readable error message and "Retry Connection" button (role="alert").
 * 6. RETRY flow: Clicking "Retry Connection" triggers a new request and transitions properly.
 * 7. Error handling: Thrown exceptions do not crash the app.
 * 8. Race-condition protection: Stale slow responses do not overwrite newer UI states.
 * 9. Prefers-reduced-motion: CSS file contains accessible motion reduction rules.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Setup Mock DOM for headless Node environment
if (typeof document === 'undefined') {
  class MockNode {
    constructor(nodeType, nodeName) {
      this.nodeType = nodeType;
      this.nodeName = nodeName;
      this.childNodes = [];
      this.parentNode = null;
      this.parentElement = null;
    }

    get firstChild() {
      return this.childNodes.length > 0 ? this.childNodes[0] : null;
    }

    appendChild(child) {
      if (!child) return child;
      if (child.parentNode) {
        child.parentNode.removeChild(child);
      }
      child.parentNode = this;
      child.parentElement = this;
      this.childNodes.push(child);
      return child;
    }

    removeChild(child) {
      const idx = this.childNodes.indexOf(child);
      if (idx !== -1) {
        this.childNodes.splice(idx, 1);
        child.parentNode = null;
        child.parentElement = null;
      }
      return child;
    }

    replaceChildren(...newChildren) {
      while (this.childNodes.length > 0) {
        this.removeChild(this.childNodes[0]);
      }
      for (const child of newChildren) {
        if (child) this.appendChild(child);
      }
    }

    get textContent() {
      if (this.nodeType === 3) return this.nodeValue || '';
      return this.childNodes.map((c) => c.textContent).join('');
    }

    set textContent(val) {
      this.childNodes = [];
      if (val !== undefined && val !== null) {
        const textNode = new MockNode(3, '#text');
        textNode.nodeValue = String(val);
        this.appendChild(textNode);
      }
    }

    querySelector(selector) {
      const matches = this.querySelectorAll(selector);
      return matches.length > 0 ? matches[0] : null;
    }

    querySelectorAll(selector) {
      const results = [];
      const isMatch = (el) => {
        if (!el || el.nodeType !== 1) return false;

        // ID selector: #id
        if (selector.startsWith('#')) {
          return el.id === selector.slice(1);
        }
        // Class selector: .class
        if (selector.startsWith('.')) {
          const targetClass = selector.slice(1);
          const classes = (el.className || '').split(/\s+/).filter(Boolean);
          return classes.includes(targetClass);
        }
        // Attribute selector: [attr="value"] or [attr]
        if (selector.startsWith('[') && selector.endsWith(']')) {
          const inner = selector.slice(1, -1);
          if (inner.includes('=')) {
            const [attr, rawVal] = inner.split('=');
            const val = rawVal.replace(/^["']|["']$/g, '');
            return el.getAttribute(attr) === val;
          }
          return el.hasAttribute(inner);
        }
        // Tag name selector: button, article, etc.
        return el.tagName.toLowerCase() === selector.toLowerCase();
      };

      const traverse = (node) => {
        if (node.nodeType === 1 && isMatch(node)) {
          results.push(node);
        }
        for (const child of node.childNodes || []) {
          traverse(child);
        }
      };

      for (const child of this.childNodes || []) {
        traverse(child);
      }
      return results;
    }
  }

  class MockElement extends MockNode {
    constructor(tagName) {
      super(1, tagName.toUpperCase());
      this.tagName = tagName.toUpperCase();
      this.attributes = new Map();
      this.listeners = new Map();
      this.id = '';
      this.className = '';
      this.disabled = false;
      this.checked = false;
    }

    setAttribute(name, value) {
      const strVal = String(value);
      this.attributes.set(name, strVal);
      if (name === 'id') this.id = strVal;
      if (name === 'class' || name === 'className') this.className = strVal;
      if (name === 'disabled') this.disabled = true;
    }

    getAttribute(name) {
      return this.attributes.get(name) ?? null;
    }

    hasAttribute(name) {
      return this.attributes.has(name);
    }

    removeAttribute(name) {
      this.attributes.delete(name);
      if (name === 'id') this.id = '';
      if (name === 'class' || name === 'className') this.className = '';
      if (name === 'disabled') this.disabled = false;
    }

    addEventListener(event, fn) {
      const ev = event.toLowerCase();
      if (!this.listeners.has(ev)) {
        this.listeners.set(ev, []);
      }
      this.listeners.get(ev).push(fn);
    }

    removeEventListener(event, fn) {
      const ev = event.toLowerCase();
      const list = this.listeners.get(ev) || [];
      const idx = list.indexOf(fn);
      if (idx !== -1) list.splice(idx, 1);
    }

    click() {
      const handlers = this.listeners.get('click') || [];
      const eventObj = {
        target: this,
        currentTarget: this,
        type: 'click',
        preventDefault: () => {},
        stopPropagation: () => {}
      };
      for (const handler of handlers) {
        handler(eventObj);
      }
    }
  }

  globalThis.document = {
    createElement(tag) {
      return new MockElement(tag);
    },
    createTextNode(text) {
      const node = new MockNode(3, '#text');
      node.nodeValue = String(text);
      return node;
    },
    getElementById(id) {
      return null;
    }
  };
  globalThis.Node = MockNode;
  globalThis.HTMLElement = MockElement;
}

// Import code under test
import {
  StateStatus,
  createIdleState,
  createLoadingState,
  createSuccessState,
  createErrorState,
  ResilientStateMachine
} from './state-machine.js';

import {
  createDOM,
  renderIdleView,
  renderLoadingView,
  renderSuccessView,
  renderErrorView,
  renderView,
  initApp,
  SAMPLE_PROJECTS
} from './app.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(
      message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ PASS: ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
  }
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

console.log('\n=============================================');
console.log(' Exercise 3 - Phase 2 Semantic UI State Tests');
console.log('=============================================\n');

async function runTestSuite() {
  await test('IDLE State: Renders Load Data button with accessible labels', () => {
    let loadClicked = false;
    const view = renderView(createIdleState(), {
      onLoad: () => {
        loadClicked = true;
      }
    });

    assertEqual(view.id, 'idle-view');
    const button = view.querySelector('#load-data-btn');
    assert(button !== null, 'Must contain #load-data-btn');
    assertEqual(button.textContent.trim(), 'Load Data');
    assertEqual(button.getAttribute('type'), 'button');
    assert(button.getAttribute('aria-label').length > 0, 'Must have aria-label');

    // Simulate click
    button.click();
    assert(loadClicked, 'Clicking Load Data must invoke onLoad callback');
  });

  await test('LOADING State: Displays animated skeleton placeholders with aria-busy="true" and role="status"', () => {
    const view = renderView(createLoadingState());

    assertEqual(view.id, 'loading-view');
    assertEqual(view.getAttribute('role'), 'status');
    assertEqual(view.getAttribute('aria-busy'), 'true');
    assertEqual(view.getAttribute('aria-live'), 'polite');

    const skeletonCards = view.querySelectorAll('.skeleton-card');
    assert(skeletonCards.length >= 3, `Expected at least 3 skeleton cards, found ${skeletonCards.length}`);

    const skeletonPlaceholders = view.querySelectorAll('.skeleton');
    assert(skeletonPlaceholders.length > 0, 'Must render multiple skeleton element placeholders');
  });

  await test('LOADING State: Prevents duplicate requests when request is in flight', async () => {
    let fetchCount = 0;
    const mockFetcher = async () => {
      fetchCount++;
      await delay(50);
      return [{ id: 1, title: 'Item 1' }];
    };

    const container = document.createElement('main');
    const app = initApp(container, { fetcher: mockFetcher, preventDuplicate: true });

    // Initial state is IDLE
    assertEqual(app.stateMachine.getState().status, StateStatus.IDLE);

    // Trigger load
    const p1 = app.loadData();
    assertEqual(app.stateMachine.getState().status, StateStatus.LOADING);
    assertEqual(fetchCount, 1, 'First loadData call must trigger fetch');

    // Duplicate call while still LOADING
    const p2 = app.loadData();
    assertEqual(fetchCount, 1, 'Duplicate loadData call while LOADING must be prevented');

    await Promise.all([p1, p2]);
    assertEqual(app.stateMachine.getState().status, StateStatus.SUCCESS);
    assertEqual(fetchCount, 1, 'Total fetch count must remain 1 after completion');

    app.destroy();
  });

  await test('SUCCESS State: Renders fetched data safely into semantic cards (zero innerHTML / XSS safe)', () => {
    const maliciousPayload = [
      {
        id: 99,
        title: '<script>alert("xss")</script>Secure Title',
        category: '<img src=x onerror=alert(1)>Frontend',
        description: '<b onmouseover=evil()>Safe Description</b>',
        status: 'Active'
      }
    ];

    const view = renderView(createSuccessState(maliciousPayload));

    assertEqual(view.id, 'success-view');
    const cards = view.querySelectorAll('.project-card');
    assertEqual(cards.length, 1);

    // Verify semantic tags
    const title = view.querySelector('.card-title');
    assert(title !== null);
    assertEqual(title.textContent, '<script>alert("xss")</script>Secure Title');

    // Verify no script or img elements were created (XSS safe)
    const scriptEl = view.querySelector('script');
    const imgEl = view.querySelector('img');
    assertEqual(scriptEl, null, 'Must NOT inject executable script element');
    assertEqual(imgEl, null, 'Must NOT inject malicious img element');

    // Verify feed role
    const feed = view.querySelector('[role="feed"]');
    assert(feed !== null, 'Must contain element with role="feed"');
  });

  await test('ERROR State: Displays human-readable error message and Retry Connection button', () => {
    let retryClicked = false;
    const errorMessage = 'Network error: 503 Service Unavailable';

    const view = renderView(createErrorState(errorMessage), {
      onRetry: () => {
        retryClicked = true;
      }
    });

    assertEqual(view.id, 'error-view');
    assertEqual(view.getAttribute('role'), 'alert');
    assertEqual(view.getAttribute('aria-live'), 'assertive');

    const errorMsgEl = view.querySelector('#error-message');
    assert(errorMsgEl !== null, 'Must contain #error-message');
    assertEqual(errorMsgEl.textContent, errorMessage);

    const retryBtn = view.querySelector('#retry-btn');
    assert(retryBtn !== null, 'Must contain #retry-btn');
    assertEqual(retryBtn.textContent.trim(), 'Retry Connection');
    assertEqual(retryBtn.getAttribute('type'), 'button');

    retryBtn.click();
    assert(retryClicked, 'Clicking Retry Connection must invoke onRetry callback');
  });

  await test('RETRY Flow: Clicking Retry Connection triggers a new request and updates state', async () => {
    let attempts = 0;
    const container = document.createElement('main');

    const failingThenSucceedingFetcher = async () => {
      attempts++;
      await delay(20);
      if (attempts === 1) {
        throw new Error('Connection refused by host');
      }
      return [{ id: 10, title: 'Recovered Project' }];
    };

    const app = initApp(container, { fetcher: failingThenSucceedingFetcher });

    // Initial load fails -> ERROR state
    await app.loadData();
    assertEqual(app.stateMachine.getState().status, StateStatus.ERROR);
    assertEqual(attempts, 1);

    const retryBtn = container.querySelector('#retry-btn');
    assert(retryBtn !== null, 'Must render #retry-btn on error');

    // Trigger retry
    const retryPromise = app.retry();
    assertEqual(app.stateMachine.getState().status, StateStatus.LOADING, 'Retry must transition to LOADING');

    await retryPromise;
    assertEqual(app.stateMachine.getState().status, StateStatus.SUCCESS, 'Successful retry must transition to SUCCESS');
    assertEqual(attempts, 2, 'Retry must have executed second request');

    // UI reflects success
    const cardTitle = container.querySelector('.card-title');
    assert(cardTitle !== null);
    assertEqual(cardTitle.textContent, 'Recovered Project');

    app.destroy();
  });

  await test('Handles request failures gracefully without crashing', async () => {
    const container = document.createElement('main');

    const crashingFetcher = async () => {
      await delay(10);
      throw new TypeError('Unexpected response structure from upstream API');
    };

    const app = initApp(container, { fetcher: crashingFetcher });

    // Should not throw or crash
    let didCrash = false;
    try {
      await app.loadData();
    } catch {
      didCrash = true;
    }

    assert(!didCrash, 'Application must catch errors without crashing');
    assertEqual(app.stateMachine.getState().status, StateStatus.ERROR);
    const errorMsgEl = container.querySelector('#error-message');
    assertEqual(errorMsgEl.textContent, 'Unexpected response structure from upstream API');

    app.destroy();
  });

  await test('Race-Condition Protection in UI: Stale slow response does not overwrite newer retry result', async () => {
    const container = document.createElement('main');
    const sm = new ResilientStateMachine();
    const app = initApp(container, { stateMachine: sm });

    // Request 1: Slow request (100ms) -> "STALE_RESULT"
    const req1 = sm.loadData(async () => {
      await delay(100);
      return [{ id: 1, title: 'STALE_RESULT' }];
    });

    // Request 2: Fast retry/request (25ms) -> "FRESH_RESULT"
    const req2 = sm.loadData(async () => {
      await delay(25);
      return [{ id: 2, title: 'FRESH_RESULT' }];
    });

    await req2;
    assertEqual(sm.getState().status, StateStatus.SUCCESS);
    assertEqual(container.querySelector('.card-title').textContent, 'FRESH_RESULT');

    await req1;
    // Verify slow request did NOT overwrite container UI
    assertEqual(sm.getState().status, StateStatus.SUCCESS);
    assertEqual(container.querySelector('.card-title').textContent, 'FRESH_RESULT');

    app.destroy();
  });

  await test('CSS Stylesheet respects prefers-reduced-motion', () => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const cssPath = path.join(__dirname, 'styles.css');

    assert(fs.existsSync(cssPath), 'styles.css must exist');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    assert(
      cssContent.includes('@media (prefers-reduced-motion: reduce)'),
      'styles.css must include prefers-reduced-motion media query'
    );
    assert(
      cssContent.includes('.skeleton'),
      'styles.css must configure skeleton styles'
    );
    assert(
      cssContent.includes('animation: none'),
      'styles.css must disable animation for reduced motion'
    );
  });

  console.log('\n---------------------------------------------');
  console.log(`Summary: ${passed}/${passed + failed} passed (${failed} failed)`);
  console.log('---------------------------------------------\n');

  if (typeof process !== 'undefined' && process.exitCode !== undefined) {
    process.exitCode = failed > 0 ? 1 : 0;
  }
}

runTestSuite();
