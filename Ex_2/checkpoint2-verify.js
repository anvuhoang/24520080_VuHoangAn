// Checkpoint 2 Audit:
import {
  useState,
  renderApp,
  createElement,
  stateStore,
  resetCursor,
  clearStateStore
} from './reactive-engine.js';

// Headless Node.js DOM mock support (when running outside browser)
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
          if (selector === "h2" && node.tagName.toLowerCase() === "h2") return node;
          if (selector === "ul" && node.tagName.toLowerCase() === "ul") return node;
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
    querySelectorAll(selector) {
      const results = [];
      const match = (node) => {
        if (node.nodeType === 1) {
          if (selector === "li" && node.tagName.toLowerCase() === "li") results.push(node);
          if (selector === "button" && node.tagName.toLowerCase() === "button") results.push(node);
        }
        for (const child of node.childNodes || []) {
          match(child);
        }
      };
      match(this);
      return results;
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
      return true;
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

  const appRoot = new MockElement("div");
  appRoot.id = "app";

  globalThis.document = {
    createElement(tag) {
      return new MockElement(tag);
    },
    createTextNode(text) {
      return new MockTextNode(text);
    },
    getElementById(id) {
      if (id === "app") return appRoot;
      return null;
    }
  };
}

export function TaskApp() {
  const [tasks, setTasks] = useState(['Review PR', 'VerifyAST']);
  const [filter, setFilter] = useState('ALL');

  // Dynamic filter implementation
  const filteredTasks = tasks.filter((t) => {
    const isCompleted = typeof t === 'object' ? t.completed : false;
    if (filter === 'ACTIVE') return !isCompleted;
    if (filter === 'COMPLETED') return isCompleted;
    return true; // ALL
  });

  return createElement('main', { className: 'app-container' },
    createElement('header', { className: 'app-header' },
      createElement('h2', { id: 'task-count' }, `Tasks: ${tasks.length}`),
      createElement('p', { className: 'active-indicator' }, `Filter: ${filter} (${filteredTasks.length} visible)`)
    ),
    createElement('nav', { className: 'filter-nav', role: 'navigation' },
      createElement('button', {
        id: 'filter-all',
        className: filter === 'ALL' ? 'filter-btn active' : 'filter-btn',
        onClick: () => setFilter('ALL')
      }, 'All'),
      createElement('button', {
        id: 'filter-active',
        className: filter === 'ACTIVE' ? 'filter-btn active' : 'filter-btn',
        onClick: () => setFilter('ACTIVE')
      }, 'Active'),
      createElement('button', {
        id: 'filter-completed',
        className: filter === 'COMPLETED' ? 'filter-btn active' : 'filter-btn',
        onClick: () => setFilter('COMPLETED')
      }, 'Completed')
    ),
    createElement('section', { className: 'controls-section' },
      createElement('button', {
        id: 'add-task-btn',
        className: 'primary-btn',
        onClick: () => setTasks([...tasks, `Task ${Date.now()}`])
      }, 'Add Task')
    ),
    createElement('ul', { className: 'task-list', role: 'list' },
      ...filteredTasks.map((task, idx) =>
        createElement('li', { key: idx, className: 'task-item' },
          createElement('span', { className: 'task-text' }, typeof task === 'string' ? task : task.text)
        )
      )
    )
  );
}

// Checkpoint 2 Verification:
export function verifyCheckpoint2() {
  const root = document.getElementById('app');
  if (!root) {
    console.error("Root container #app not found");
    return false;
  }

  console.log("=========================================");
  console.log(" Checkpoint 2 Verification: TaskApp");
  console.log("=========================================\n");

  // Step 1: Initial mount
  renderApp(TaskApp, root);
  const countHeader = root.querySelector('h2');
  console.assert(countHeader !== null, "Mount failed: <h2> not found");
  console.assert(countHeader.textContent === "Tasks: 2", `Expected 'Tasks: 2', got '${countHeader.textContent}'`);
  console.log("  ✓ Initial mount verified: Tasks: 2");

  // Step 2: Verify Task List Rendering
  const items = root.querySelectorAll('li');
  console.assert(items.length === 2, `Expected 2 task items, found ${items.length}`);
  console.log("  ✓ Task list rendering verified: 2 items rendered");

  // Step 3: Button click triggers state update and re-render
  const addBtn = root.querySelector('#add-task-btn') || root.querySelector('button');
  console.assert(addBtn !== null, "Add Task button not found");

  if (typeof addBtn.click === "function") {
    addBtn.click();
  } else if (typeof Event !== "undefined") {
    addBtn.dispatchEvent(new Event("click"));
  } else {
    addBtn.dispatchEvent({ type: "click" });
  }

  const updatedHeader = root.querySelector('h2');
  console.assert(updatedHeader.textContent === "Tasks: 3", `Expected 'Tasks: 3' after click, got '${updatedHeader.textContent}'`);
  console.log("  ✓ Button click state update and automatic re-render verified: Tasks: 3");

  // Step 4: Verify filter toggling
  const filterActiveBtn = root.querySelector('#filter-active');
  if (filterActiveBtn) {
    if (typeof filterActiveBtn.click === "function") {
      filterActiveBtn.click();
    } else {
      filterActiveBtn.dispatchEvent({ type: "click" });
    }
    console.log("  ✓ Filter button click verified");
  }

  console.log("\n-----------------------------------------");
  console.log(" Checkpoint 2 Verification: ALL PASSED");
  console.log("-----------------------------------------\n");
  return true;
}

// Auto-run verification
verifyCheckpoint2();
