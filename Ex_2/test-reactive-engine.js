/**
 * Comprehensive Test Suite for Exercise 2 (Phases 1, 2 & 3)
 *
 * Verifies:
 * - Phase 1: stateStore & resetCursor()
 * - Phase 2: useState hook & reactive re-rendering loop
 * - Phase 3: Centralized root event delegation, bubbling, and orphan prevention
 */

// Headless Node.js DOM Mock supporting event bubbling
if (typeof document === "undefined") {
  class MockNode {
    constructor(nodeType, nodeName) {
      this.nodeType = nodeType;
      this.nodeName = nodeName;
      this.childNodes = [];
      this.parentNode = null;
      this.parentElement = null;
    }
    appendChild(child) {
      if (!child || !(child instanceof MockNode)) {
        throw new TypeError("Parameter is not of type 'Node'.");
      }
      child.parentNode = this;
      child.parentElement = this;
      this.childNodes.push(child);
      return child;
    }
    replaceChildren(...newChildren) {
      this.childNodes = [];
      for (const child of newChildren) {
        this.appendChild(child);
      }
    }
    querySelector(selector) {
      const match = (node) => {
        if (node.nodeType === 1) {
          if (selector === "button" && node.tagName.toLowerCase() === "button") return node;
          if (selector === "span" && node.tagName.toLowerCase() === "span") return node;
          if (selector.startsWith("#") && node.id === selector.slice(1)) return node;
          if (selector.startsWith(".") && node.className.split(" ").includes(selector.slice(1))) return node;
        }
        for (const child of node.childNodes || []) {
          const res = match(child);
          if (res) return res;
        }
        return null;
      };
      return match(this);
    }
    get children() {
      return this.childNodes.filter((n) => n.nodeType === 1);
    }
    get textContent() {
      if (this.nodeType === 3) return this.nodeValue;
      return this.childNodes.map((c) => c.textContent).join("");
    }
  }

  class MockElement extends MockNode {
    constructor(tagName) {
      super(1, tagName.toUpperCase());
      this.tagName = tagName.toUpperCase();
      this.attributes = new Map();
      this.listeners = new Map();
      this.id = "";
      this.className = "";
      this.role = "";
    }
    setAttribute(name, value) {
      this.attributes.set(name, String(value));
      if (name === "id") this.id = String(value);
      if (name === "class") this.className = String(value);
      if (name === "role") this.role = String(value);
    }
    getAttribute(name) {
      return this.attributes.get(name) || null;
    }
    removeAttribute(name) {
      this.attributes.delete(name);
    }
    addEventListener(event, fn) {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, []);
      }
      this.listeners.get(event).push(fn);
    }
    dispatchEvent(event) {
      const evt = typeof event === "string" ? { type: event } : event;
      if (!evt.target) evt.target = this;
      evt.cancelBubble = false;
      evt.stopPropagation = () => {
        evt.cancelBubble = true;
      };

      // Native DOM event bubbling upwards through parentElement
      let curr = this;
      while (curr) {
        evt.currentTarget = curr;
        const list = curr.listeners.get(evt.type) || [];
        for (const fn of list) {
          fn(evt);
        }
        if (evt.cancelBubble) break;
        curr = curr.parentElement || curr.parentNode;
      }
      return !evt.defaultPrevented;
    }
    click() {
      this.dispatchEvent({ type: "click" });
    }
  }

  class MockTextNode extends MockNode {
    constructor(text) {
      super(3, "#text");
      this.nodeValue = String(text);
    }
  }

  globalThis.document = {
    createElement(tag) {
      return new MockElement(tag);
    },
    createTextNode(text) {
      return new MockTextNode(text);
    }
  };
}

import {
  stateStore,
  resetCursor,
  getCursor,
  useState,
  setRenderer,
  triggerReRender,
  mountApp,
  renderToDOM,
  createElement,
  setupEventDelegation,
  getEventHandlers,
  clearStateStore
} from "./reactive-engine.js";

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || "Assertion failed");
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(
      message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

function test(name, fn) {
  try {
    clearStateStore();
    fn();
    passed++;
    console.log(`  ✓ PASS: ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
  }
}

console.log("\n=========================================");
console.log(" Exercise 2 - Full Test Runner (Phases 1-3)");
console.log("=========================================\n");

// --- Phase 1 Baseline Tests ---

test("Phase 1: Centralized stateStore is an array and initially accessible", () => {
  assert(Array.isArray(stateStore), "stateStore must be an array");
  assertEqual(stateStore.length, 0, "stateStore starts empty");
  assertEqual(getCursor(), 0, "cursor starts at 0");
});

test("Phase 1: resetCursor resets cursor to 0 without clearing stateStore", () => {
  const [, setA] = useState("a");
  const [, setB] = useState("b");
  assertEqual(getCursor(), 2);
  assertEqual(stateStore.length, 2);

  resetCursor();
  assertEqual(getCursor(), 0, "Cursor must be reset to 0");
  assertEqual(stateStore.length, 2, "stateStore items must NOT be cleared by resetCursor()");
});

// --- Phase 2 useState Tests ---

test("Phase 2: useState returns [state, setState] and supports functional updates", () => {
  const [count, setCount] = useState(10);
  assertEqual(count, 10);

  setCount((prev) => prev + 5);
  assertEqual(stateStore[0], 15);
});

test("Phase 2: Re-render trigger updates state and resets cursor", () => {
  let renders = 0;
  let currentVal = null;

  function App() {
    renders++;
    const [val, setVal] = useState("A");
    currentVal = { val, setVal };
    return createElement("div", null, val);
  }

  setRenderer(App);
  triggerReRender();
  assertEqual(renders, 1);
  assertEqual(currentVal.val, "A");

  currentVal.setVal("B");
  assertEqual(renders, 2);
  assertEqual(currentVal.val, "B");
});

// --- Phase 3 Root Event Delegation Tests ---

test("Phase 3: Root event delegation attaches listeners strictly to root container", () => {
  const container = document.createElement("div");
  let clicked = false;

  const vnode = createElement("div", null,
    createElement("button", { id: "btn", onClick: () => { clicked = true; } }, "Click me")
  );

  renderToDOM(vnode, container);

  // Root container should have delegated listeners registered
  assert(container.listeners.has("click"), "Root container must have click listener");

  // Child button must NOT have individual addEventListener listeners attached
  const button = container.querySelector("#btn");
  assert(button !== null, "Button must exist in DOM");
  assertEqual(button.listeners.size, 0, "Child button must NOT have direct addEventListener listeners");

  // Handler must be registered in the centralized event registry
  const handlers = getEventHandlers(button);
  assert(handlers && typeof handlers.click === "function", "Handler must be registered in event registry");

  // Clicking button bubbles to container and triggers handler
  button.click();
  assert(clicked, "Clicking button must invoke VNode handler via root delegation");
});

test("Phase 3: Avoid attaching listeners to button children and resolve clicks on inner elements", () => {
  const container = document.createElement("div");
  let clicked = false;

  const vnode = createElement("div", null,
    createElement("button", { id: "action-btn", onClick: () => { clicked = true; } },
      createElement("span", { className: "icon" }, "★"),
      createElement("span", { className: "label" }, "Star")
    )
  );

  renderToDOM(vnode, container);

  const icon = container.querySelector(".icon");
  assert(icon !== null, "Inner icon span must exist");
  assertEqual(icon.listeners.size, 0, "Inner span must NOT have listeners attached");

  // Dispatch click on the inner span: event bubbles up to button and root container
  icon.click();
  assert(clicked, "Click on inner span must bubble up and trigger button's onClick handler");
});

test("Phase 3: Support dynamically rendered buttons after re-render without orphan listeners", () => {
  const container = document.createElement("div");
  let activeClick = null;

  function DynamicApp() {
    const [tab, setTab] = useState("first");

    if (tab === "first") {
      return createElement("div", null,
        createElement("button", { id: "btn-first", onClick: () => {
          activeClick = "first";
          setTab("second");
        } }, "Go to Second")
      );
    } else {
      return createElement("div", null,
        createElement("button", { id: "btn-second", onClick: () => {
          activeClick = "second";
          setTab("first");
        } }, "Back to First")
      );
    }
  }

  mountApp(DynamicApp, container);

  // Initial render: click button 1
  const btn1 = container.querySelector("#btn-first");
  assert(btn1 !== null);
  btn1.click();

  assertEqual(activeClick, "first");

  // Re-rendered DOM now has dynamic button 2
  const btn2 = container.querySelector("#btn-second");
  assert(btn2 !== null, "New dynamic button must exist after re-render");
  assertEqual(btn2.listeners.size, 0, "Dynamic button must not have direct DOM listeners");

  // Clicking newly rendered button works immediately through root delegation
  btn2.click();
  assertEqual(activeClick, "second");
});

test("Phase 3: Prevent duplicate listeners on the root container across multiple re-renders", () => {
  const container = document.createElement("div");

  function App() {
    const [count, setCount] = useState(0);
    return createElement("button", { onClick: () => setCount((c) => c + 1) }, `Count: ${count}`);
  }

  mountApp(App, container);
  const clickListenersCount = container.listeners.get("click")?.length || 0;
  assertEqual(clickListenersCount, 1, "Initial render must attach exactly 1 delegated click listener");

  // Trigger 3 consecutive re-renders
  const button = container.querySelector("button");
  button.click(); // render 2
  const button2 = container.querySelector("button");
  button2.click(); // render 3
  const button3 = container.querySelector("button");
  button3.click(); // render 4

  const finalClickListenersCount = container.listeners.get("click")?.length || 0;
  assertEqual(
    finalClickListenersCount,
    1,
    "Multiple re-renders must NOT attach duplicate listeners to the root container"
  );
  assertEqual(stateStore[0], 3, "State should accurately reflect 3 click increments");
});

console.log("\n-----------------------------------------");
console.log(`Summary: ${passed}/${passed + failed} passed (${failed} failed)`);
console.log("-----------------------------------------\n");

if (typeof process !== "undefined" && process.exitCode !== undefined) {
  process.exitCode = failed > 0 ? 1 : 0;
}
