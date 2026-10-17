/**
 * Test Runner for Exercise 1 - Phase 1 (createElement & VNode Factory)
 *
 * Runs seamlessly in both Node.js environment and browser.
 * Zero external dependencies.
 */

import { createElement, createTextElement, isValidVNode, TEXT_ELEMENT } from "./mini-react.js";

// Test suite state
const suites = [];
let currentSuite = null;

function describe(name, fn) {
  const suite = { name, tests: [] };
  suites.push(suite);
  currentSuite = suite;
  fn();
  currentSuite = null;
}

function it(name, fn) {
  currentSuite.tests.push({ name, fn });
}

// Assertion helpers
function assert(condition, message = "Assertion failed") {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(
      message || `Expected ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`
    );
  }
}

function assertDeepEqual(actual, expected, message) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new Error(
      message || `Deep equality failed:\nActual:   ${actualStr}\nExpected: ${expectedStr}`
    );
  }
}

function assertThrows(fn, expectedErrorType, message) {
  let threw = false;
  try {
    fn();
  } catch (err) {
    threw = true;
    if (expectedErrorType && !(err instanceof expectedErrorType)) {
      throw new Error(
        `Expected error of type ${expectedErrorType.name}, but caught ${err.constructor.name}: ${err.message}`
      );
    }
  }
  if (!threw) {
    throw new Error(message || `Expected function to throw ${expectedErrorType?.name || "an error"}, but it succeeded`);
  }
}

// --- Test Suites ---

describe("Phase 1: createTextElement()", () => {
  it("should create a valid text VNode for a string", () => {
    const textNode = createTextElement("Hello World");
    assertEqual(textNode.type, TEXT_ELEMENT);
    assertEqual(textNode.props.nodeValue, "Hello World");
    assert(Array.isArray(textNode.props.children));
    assertEqual(textNode.props.children.length, 0);
    assert(isValidVNode(textNode), "Created text node must satisfy isValidVNode");
  });

  it("should convert numeric primitive (including 0) to string nodeValue", () => {
    const numNode = createTextElement(42);
    assertEqual(numNode.props.nodeValue, "42");

    const zeroNode = createTextElement(0);
    assertEqual(zeroNode.props.nodeValue, "0");
  });

  it("should preserve HTML-like strings as inert text without executing or parsing", () => {
    const malicious = '<img src=x onerror="alert(1)">';
    const node = createTextElement(malicious);
    assertEqual(node.type, TEXT_ELEMENT);
    assertEqual(node.props.nodeValue, malicious);
  });

  it("should reject null or undefined text values with TypeError", () => {
    assertThrows(() => createTextElement(null), TypeError, "Should reject null text");
    assertThrows(() => createTextElement(undefined), TypeError, "Should reject undefined text");
  });

  it("should reject non-primitive values (objects, functions) with TypeError", () => {
    assertThrows(() => createTextElement({}), TypeError, "Should reject object text");
    assertThrows(() => createTextElement(() => {}), TypeError, "Should reject function text");
  });
});

describe("Phase 1: createElement() - Basic & Null Props", () => {
  it("should create element with tag and empty children when no children passed", () => {
    const vnode = createElement("div", { id: "main" });
    assertEqual(vnode.type, "div");
    assertEqual(vnode.props.id, "main");
    assert(Array.isArray(vnode.props.children));
    assertEqual(vnode.props.children.length, 0);
  });

  it("should handle null props gracefully", () => {
    const vnode = createElement("span", null);
    assertEqual(vnode.type, "span");
    assert(typeof vnode.props === "object" && vnode.props !== null);
    assert(Array.isArray(vnode.props.children));
    assertEqual(vnode.props.children.length, 0);
  });

  it("should handle undefined props gracefully", () => {
    const vnode = createElement("p", undefined);
    assertEqual(vnode.type, "p");
    assert(typeof vnode.props === "object" && vnode.props !== null);
    assert(Array.isArray(vnode.props.children));
    assertEqual(vnode.props.children.length, 0);
  });
});

describe("Phase 1: createElement() - No Input Mutation", () => {
  it("should never mutate the passed props object", () => {
    const inputProps = Object.freeze({ className: "btn", title: "Submit" });
    // In strict mode or with frozen objects, attempting to mutate inputProps
    // (such as adding inputProps.children) would throw. createElement must succeed.
    const vnode = createElement("button", inputProps, "Click me");

    assertEqual(vnode.props.className, "btn");
    assertEqual(vnode.props.title, "Submit");
    assertEqual(vnode.props.children.length, 1);
    assert(!("children" in inputProps), "Caller's props object must not have 'children' added");

    // Also verify with a regular mutable object
    const mutableProps = { a: 1, b: 2 };
    createElement("div", mutableProps, "test");
    assertEqual(Object.keys(mutableProps).length, 2);
    assert(!("children" in mutableProps), "Mutable props object must not be modified");
  });
});

describe("Phase 1: createElement() - Strict Type Guards", () => {
  it("should throw TypeError on non-string or empty element type", () => {
    assertThrows(() => createElement(null, null), TypeError);
    assertThrows(() => createElement(undefined, null), TypeError);
    assertThrows(() => createElement("", null), TypeError);
    assertThrows(() => createElement("   ", null), TypeError);
    assertThrows(() => createElement(123, null), TypeError);
    assertThrows(() => createElement({}, null), TypeError);
  });

  it("should throw TypeError on invalid props type (string, array, boolean)", () => {
    assertThrows(() => createElement("div", "invalid-props"), TypeError);
    assertThrows(() => createElement("div", [1, 2, 3]), TypeError);
    assertThrows(() => createElement("div", true), TypeError);
  });
});

describe("Phase 1: createElement() - Nested Children Normalization", () => {
  it("should normalize string and number children into text VNodes", () => {
    const vnode = createElement("p", null, "Hello ", 2026);
    assertEqual(vnode.props.children.length, 2);
    assertEqual(vnode.props.children[0].type, TEXT_ELEMENT);
    assertEqual(vnode.props.children[0].props.nodeValue, "Hello ");
    assertEqual(vnode.props.children[1].type, TEXT_ELEMENT);
    assertEqual(vnode.props.children[1].props.nodeValue, "2026");
  });

  it("should flatten single-level and deeply nested child arrays", () => {
    const vnode = createElement(
      "ul",
      null,
      [createElement("li", null, "Item 1"), [createElement("li", null, "Item 2"), [createElement("li", null, "Item 3")]]]
    );
    assertEqual(vnode.props.children.length, 3);
    assertEqual(vnode.props.children[0].type, "li");
    assertEqual(vnode.props.children[1].type, "li");
    assertEqual(vnode.props.children[2].type, "li");
  });

  it("should filter out null, undefined, and boolean children (conditional rendering)", () => {
    const showExtra = false;
    const vnode = createElement(
      "div",
      null,
      "Always visible",
      null,
      undefined,
      showExtra && createElement("span", null, "Extra"),
      true,
      "End"
    );
    assertEqual(vnode.props.children.length, 2);
    assertEqual(vnode.props.children[0].props.nodeValue, "Always visible");
    assertEqual(vnode.props.children[1].props.nodeValue, "End");
  });

  it("should preserve child order and tree hierarchy", () => {
    const vnode = createElement(
      "main",
      { id: "app" },
      createElement("header", null, createElement("h1", null, "Title")),
      createElement("section", null, createElement("p", null, "Paragraph 1"), createElement("p", null, "Paragraph 2")),
      createElement("footer", null, "Footer note")
    );

    assertEqual(vnode.type, "main");
    assertEqual(vnode.props.children.length, 3);
    assertEqual(vnode.props.children[0].type, "header");
    assertEqual(vnode.props.children[1].type, "section");
    assertEqual(vnode.props.children[2].type, "footer");

    const section = vnode.props.children[1];
    assertEqual(section.props.children.length, 2);
    assertEqual(section.props.children[0].type, "p");
    assertEqual(section.props.children[1].type, "p");
  });
});

describe("Phase 1: createElement() - Child Validation Guards", () => {
  it("should throw TypeError when child is an arbitrary non-VNode object", () => {
    assertThrows(() => createElement("div", null, { random: "object" }), TypeError);
    assertThrows(() => createElement("div", null, new Date()), TypeError);
  });

  it("should throw TypeError when child is a function or symbol", () => {
    assertThrows(() => createElement("div", null, () => {}), TypeError);
    assertThrows(() => createElement("div", null, Symbol("test")), TypeError);
  });
});

describe("Phase 1: isValidVNode() Contract", () => {
  it("should identify valid element and text VNodes", () => {
    const elem = createElement("div", { id: "test" }, "content");
    const text = createTextElement("test");
    assert(isValidVNode(elem), "Element VNode must be valid");
    assert(isValidVNode(text), "Text VNode must be valid");
  });

  it("should reject non-VNodes, null, primitives, and malformed objects", () => {
    assert(!isValidVNode(null));
    assert(!isValidVNode(undefined));
    assert(!isValidVNode("string"));
    assert(!isValidVNode(123));
    assert(!isValidVNode([]));
    assert(!isValidVNode({}));
    assert(!isValidVNode({ type: "" }));
    assert(!isValidVNode({ type: "div" })); // missing props
    assert(!isValidVNode({ type: "div", props: {} })); // missing props.children
    assert(!isValidVNode({ type: TEXT_ELEMENT, props: { children: [] } })); // missing props.nodeValue
  });
});

// --- Execution & Reporting ---

export async function runTests() {
  let passedCount = 0;
  let failedCount = 0;
  const results = [];

  const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";

  console.log("\n=========================================");
  console.log(" Mini-React Phase 1 Test Runner");
  console.log("=========================================\n");

  for (const suite of suites) {
    console.log(`\n• Suite: ${suite.name}`);
    const suiteResult = { name: suite.name, tests: [] };

    for (const test of suite.tests) {
      try {
        test.fn();
        passedCount++;
        console.log(`  ✓ PASS: ${test.name}`);
        suiteResult.tests.push({ name: test.name, passed: true });
      } catch (err) {
        failedCount++;
        console.error(`  ✗ FAIL: ${test.name}`);
        console.error(`    ${err.message}`);
        suiteResult.tests.push({ name: test.name, passed: false, error: err.message });
      }
    }
    results.push(suiteResult);
  }

  const total = passedCount + failedCount;
  console.log("\n-----------------------------------------");
  console.log(`Summary: ${passedCount}/${total} passed (${failedCount} failed)`);
  console.log("-----------------------------------------\n");

  if (isBrowser) {
    const container = document.getElementById("test-results");
    if (container) {
      container.innerHTML = "";

      const summaryCard = document.createElement("div");
      summaryCard.className = "summary-card";
      summaryCard.innerHTML = `
        <div class="stat">
          <span class="stat-label">Total Tests</span>
          <span class="stat-val">${total}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Passed</span>
          <span class="stat-val passed">${passedCount}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Failed</span>
          <span class="stat-val failed">${failedCount}</span>
        </div>
      `;
      container.appendChild(summaryCard);

      for (const suite of results) {
        const suiteCard = document.createElement("section");
        suiteCard.className = "suite-card";

        const suiteTitle = document.createElement("h2");
        suiteTitle.className = "suite-title";
        suiteTitle.textContent = suite.name;
        suiteCard.appendChild(suiteTitle);

        for (const t of suite.tests) {
          const item = document.createElement("div");
          item.className = "test-item";

          const badge = document.createElement("span");
          badge.className = `badge ${t.passed ? "pass" : "fail"}`;
          badge.textContent = t.passed ? "PASS" : "FAIL";

          const nameSpan = document.createElement("span");
          nameSpan.textContent = t.name;

          item.appendChild(badge);
          item.appendChild(nameSpan);

          if (!t.passed && t.error) {
            const errDiv = document.createElement("div");
            errDiv.className = "error-msg";
            errDiv.textContent = t.error;
            item.appendChild(errDiv);
          }

          suiteCard.appendChild(item);
        }

        container.appendChild(suiteCard);
      }
    }
  }

  if (typeof process !== "undefined" && process.exitCode !== undefined) {
    if (failedCount > 0) {
      process.exitCode = 1;
    } else {
      process.exitCode = 0;
    }
  }

  return { passedCount, failedCount, total };
}

// Auto-run
runTests();
