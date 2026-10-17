/**
 * Test Suite for Exercise 2 - Phase 1 & Phase 2
 *
 * Verifies:
 * - Centralized stateStore initialization
 * - resetCursor() behavior
 * - useState(initialValue) with closure-bound slot index
 * - Direct and functional state updates: setState(val) and setState(prev => next)
 * - State preservation across multiple simulated re-renders
 * - Re-render trigger execution upon state mutation
 * - Stable hook ordering & multi-slot state preservation
 * - Predictable state transitions without unintended resets
 */

import {
  stateStore,
  resetCursor,
  getCursor,
  useState,
  setRenderer,
  triggerReRender,
  mountApp,
  allocateSlot,
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
console.log(" Exercise 2 - Phase 1 & 2 Test Runner");
console.log("=========================================\n");

// --- Phase 1 Baseline Tests ---

test("Phase 1: Centralized stateStore is an array and initially accessible", () => {
  assert(Array.isArray(stateStore), "stateStore must be an array");
  assertEqual(stateStore.length, 0, "stateStore starts empty");
  assertEqual(getCursor(), 0, "cursor starts at 0");
});

test("Phase 1: resetCursor resets cursor to 0 without clearing stateStore", () => {
  allocateSlot("initial");
  allocateSlot("filter: all");
  assertEqual(getCursor(), 2);
  assertEqual(stateStore.length, 2);

  resetCursor();
  assertEqual(getCursor(), 0, "Cursor must be reset to 0");
  assertEqual(stateStore.length, 2, "stateStore items must NOT be cleared by resetCursor()");
  assertEqual(stateStore[0], "initial");
  assertEqual(stateStore[1], "filter: all");
});

// --- Phase 2 useState Hook & Re-render Loop Tests ---

test("Phase 2: useState returns [state, setState] and initializes slot correctly", () => {
  const [count, setCount] = useState(10);
  assertEqual(count, 10);
  assert(typeof setCount === "function", "setState must be a function");
  assertEqual(stateStore[0], 10);
  assertEqual(getCursor(), 1);
});

test("Phase 2: useState supports functional initial value (lazy initialization)", () => {
  let initCallCount = 0;
  const initFn = () => {
    initCallCount++;
    return "computed initial";
  };

  const [val1] = useState(initFn);
  assertEqual(val1, "computed initial");
  assertEqual(initCallCount, 1);

  // Simulated render 2
  resetCursor();
  const [val2] = useState(initFn);
  assertEqual(val2, "computed initial");
  assertEqual(initCallCount, 1, "Lazy initializer should only execute on first allocation");
});

test("Phase 2: setState supports direct value updates and updates stateStore", () => {
  const [, setCount] = useState(0);
  setCount(5);
  assertEqual(stateStore[0], 5);
});

test("Phase 2: setState supports functional updates (prev => next)", () => {
  const [, setCount] = useState(10);

  setCount((prev) => prev + 5);
  assertEqual(stateStore[0], 15);

  setCount((prev) => prev * 2);
  assertEqual(stateStore[0], 30);
});

test("Phase 2: Trigger re-render after state changes", () => {
  let renderPassCount = 0;
  let latestRenderedState = null;

  function Component() {
    renderPassCount++;
    const [name, setName] = useState("Alpha");
    latestRenderedState = { name, setName };
    return name;
  }

  // Register component as active renderer and execute initial pass
  setRenderer(Component);
  triggerReRender();

  assertEqual(renderPassCount, 1, "Initial render pass count should be 1");
  assertEqual(latestRenderedState.name, "Alpha");

  // Mutating state via setState must automatically trigger re-render
  latestRenderedState.setName("Beta");

  assertEqual(renderPassCount, 2, "setState should have triggered re-render pass 2");
  assertEqual(latestRenderedState.name, "Beta");
  assertEqual(stateStore[0], "Beta");
});

test("Phase 2: Reset hook cursor before each re-render pass", () => {
  let cursorAtStartOfRender = null;

  function Component() {
    cursorAtStartOfRender = getCursor();
    const [a] = useState("first");
    const [b] = useState("second");
    return `${a}-${b}`;
  }

  setRenderer(Component);
  triggerReRender();
  assertEqual(cursorAtStartOfRender, 0, "Cursor must be 0 at start of render 1");
  assertEqual(getCursor(), 2, "Cursor is 2 after two hooks called");

  // Trigger pass 2
  triggerReRender();
  assertEqual(cursorAtStartOfRender, 0, "Cursor must be reset to 0 at start of render 2");
  assertEqual(getCursor(), 2);
});

test("Phase 2: Multiple useState hooks maintain independent state across re-renders", () => {
  let latestApi = null;

  function TaskManager() {
    const [tasks, setTasks] = useState(["Task 1"]);
    const [filter, setFilter] = useState("all");
    const [search, setSearch] = useState("");

    latestApi = { tasks, setTasks, filter, setFilter, search, setSearch };
    return { tasks, filter, search };
  }

  setRenderer(TaskManager);
  triggerReRender();

  assertEqual(latestApi.tasks.length, 1);
  assertEqual(latestApi.filter, "all");
  assertEqual(latestApi.search, "");

  // Update second hook (filter)
  latestApi.setFilter("completed");
  assertEqual(latestApi.filter, "completed");
  assertEqual(latestApi.tasks.length, 1, "tasks state should remain unchanged");

  // Update first hook (tasks) using functional updater
  latestApi.setTasks((prev) => [...prev, "Task 2"]);
  assertEqual(latestApi.tasks.length, 2);
  assertEqual(latestApi.tasks[1], "Task 2");
  assertEqual(latestApi.filter, "completed", "filter state should be preserved");

  // Update third hook (search)
  latestApi.setSearch("buy milk");
  assertEqual(latestApi.search, "buy milk");
  assertEqual(latestApi.tasks.length, 2);
  assertEqual(latestApi.filter, "completed");
});

test("Phase 2: Correctly preserves undefined, null, and false states without reset", () => {
  let latestValues = null;

  function EdgeCaseComponent() {
    const [valUndefined, setValUndefined] = useState(undefined);
    const [valNull, setValNull] = useState(null);
    const [valBool, setValBool] = useState(false);

    latestValues = { valUndefined, setValUndefined, valNull, setValNull, valBool, setValBool };
  }

  setRenderer(EdgeCaseComponent);
  triggerReRender();

  assertEqual(latestValues.valUndefined, undefined);
  assertEqual(latestValues.valNull, null);
  assertEqual(latestValues.valBool, false);

  // Update undefined to a new value
  latestValues.setValUndefined("defined now");
  assertEqual(latestValues.valUndefined, "defined now");

  // Update null to false
  latestValues.setValNull(false);
  assertEqual(latestValues.valNull, false);
});

console.log("\n-----------------------------------------");
console.log(`Summary: ${passed}/${passed + failed} passed (${failed} failed)`);
console.log("-----------------------------------------\n");

if (typeof process !== "undefined" && process.exitCode !== undefined) {
  process.exitCode = failed > 0 ? 1 : 0;
}
