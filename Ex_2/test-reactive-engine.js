/**
 * Minimal Test Suite for Exercise 2 - Phase 1
 *
 * Verifies:
 * - Centralized stateStore initialization
 * - resetCursor() behavior
 * - Stable hook call order
 * - Support for multiple independent state slots
 * - State preservation across simulated render passes
 * - Prevention of unintended state resets
 */

import {
  stateStore,
  resetCursor,
  getCursor,
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
console.log(" Exercise 2 - Phase 1 Test Runner");
console.log("=========================================\n");

test("Centralized stateStore is an array and initially accessible", () => {
  assert(Array.isArray(stateStore), "stateStore must be an array");
  assertEqual(stateStore.length, 0, "stateStore starts empty");
  assertEqual(getCursor(), 0, "cursor starts at 0");
});

test("allocateSlot advances cursor and initializes multiple slots independently", () => {
  const [val1] = allocateSlot("task 1");
  assertEqual(getCursor(), 1);
  assertEqual(val1, "task 1");

  const [val2] = allocateSlot(100);
  assertEqual(getCursor(), 2);
  assertEqual(val2, 100);

  const [val3] = allocateSlot(true);
  assertEqual(getCursor(), 3);
  assertEqual(val3, true);

  assertEqual(stateStore.length, 3);
  assertEqual(stateStore[0], "task 1");
  assertEqual(stateStore[1], 100);
  assertEqual(stateStore[2], true);
});

test("resetCursor resets cursor to 0 without clearing stateStore", () => {
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

test("Preserves state between simulated render passes", () => {
  // --- Render Pass 1 ---
  resetCursor();
  const [tasks, setTasks] = allocateSlot(["Task A"]);
  const [filter, setFilter] = allocateSlot("all");

  assertEqual(tasks[0], "Task A");
  assertEqual(filter, "all");

  // State update triggered by user interaction
  setTasks(["Task A", "Task B"]);
  setFilter("completed");

  // --- Render Pass 2 ---
  resetCursor();
  const [tasksRender2] = allocateSlot(["Task A"]); // Initial value passed again
  const [filterRender2] = allocateSlot("all");

  assertEqual(tasksRender2.length, 2, "Tasks state must be preserved across renders");
  assertEqual(tasksRender2[1], "Task B");
  assertEqual(filterRender2, "completed", "Filter state must be preserved across renders");
});

test("Prevents unintended state resets: initialValue ignored on subsequent renders", () => {
  // Render 1
  resetCursor();
  const [, setCount] = allocateSlot(0);
  setCount(42);

  // Render 2 with different initialValue
  resetCursor();
  const [countRender2] = allocateSlot(999);
  assertEqual(countRender2, 42, "Existing slot state must NOT be overwritten by new initialValue");
});

test("Maintains stable hook call order across render passes", () => {
  // Render 1
  resetCursor();
  allocateSlot("slot 0");
  allocateSlot("slot 1");
  allocateSlot("slot 2");

  // Render 2
  resetCursor();
  const [slot0] = allocateSlot("new 0");
  const [slot1] = allocateSlot("new 1");
  const [slot2] = allocateSlot("new 2");

  assertEqual(slot0, "slot 0");
  assertEqual(slot1, "slot 1");
  assertEqual(slot2, "slot 2");
  assertEqual(getCursor(), 3);
});

console.log("\n-----------------------------------------");
console.log(`Summary: ${passed}/${passed + failed} passed (${failed} failed)`);
console.log("-----------------------------------------\n");

if (typeof process !== "undefined" && process.exitCode !== undefined) {
  process.exitCode = failed > 0 ? 1 : 0;
}
