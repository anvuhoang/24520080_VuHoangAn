/**
 * Test Runner for Exercise 1 - Phase 1 & Phase 2
 *
 * Runs seamlessly in both Node.js environment and browser.
 * Zero external dependencies.
 */

// Minimal mock DOM for Node.js test execution (when running outside browser)
if (typeof document === "undefined") {
  class MockNode {
    constructor(nodeType, nodeName) {
      this.nodeType = nodeType;
      this.nodeName = nodeName;
      this.childNodes = [];
      this.parentNode = null;
    }
    appendChild(child) {
      if (!child || !(child instanceof MockNode)) {
        throw new TypeError("Failed to execute 'appendChild': parameter is not of type 'Node'.");
      }
      child.parentNode = this;
      this.childNodes.push(child);
      return child;
    }
    get children() {
      return this.childNodes.filter(n => n.nodeType === 1);
    }
    get textContent() {
      if (this.nodeType === 3) return this.nodeValue;
      return this.childNodes.map(c => c.textContent).join("");
    }
  }

  class MockTextNode extends MockNode {
    constructor(text) {
      super(3, "#text");
      this.nodeValue = String(text);
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
      const type = typeof event === "string" ? event : event.type;
      const list = this.listeners.get(type) || [];
      for (const fn of list) {
        fn(event);
      }
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

import { createElement, createTextElement, isValidVNode, TEXT_ELEMENT, renderToDOM } from "./mini-react.js";

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

// ==========================================
// Phase 1 Test Suites: VNode Factory
// ==========================================

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
    const vnode = createElement("button", inputProps, "Click me");

    assertEqual(vnode.props.className, "btn");
    assertEqual(vnode.props.title, "Submit");
    assertEqual(vnode.props.children.length, 1);
    assert(!("children" in inputProps), "Caller's props object must not have 'children' added");

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
    assert(!isValidVNode({ type: "div" }));
    assert(!isValidVNode({ type: "div", props: {} }));
    assert(!isValidVNode({ type: TEXT_ELEMENT, props: { children: [] } }));
  });
});

// ==========================================
// Phase 2 Test Suites: DOM Mounting Engine
// ==========================================

describe("Phase 2: renderToDOM() - Input Validation & Guards", () => {
  it("should throw TypeError when called with null or undefined VNode", () => {
    assertThrows(() => renderToDOM(null), TypeError);
    assertThrows(() => renderToDOM(undefined), TypeError);
  });

  it("should throw TypeError when called with a primitive or non-object", () => {
    assertThrows(() => renderToDOM("hello"), TypeError);
    assertThrows(() => renderToDOM(123), TypeError);
    assertThrows(() => renderToDOM(true), TypeError);
  });

  it("should throw TypeError on malformed VNode objects missing required schema", () => {
    assertThrows(() => renderToDOM({ type: "div" }), TypeError);
    assertThrows(() => renderToDOM({ type: "", props: { children: [] } }), TypeError);
    assertThrows(() => renderToDOM({ type: "div", props: { children: "not-array" } }), TypeError);
  });

  it("should throw TypeError when container argument is not a valid DOM node", () => {
    const vnode = createElement("div", null);
    assertThrows(() => renderToDOM(vnode, "not-a-node"), TypeError);
    assertThrows(() => renderToDOM(vnode, {}), TypeError);
  });
});

describe("Phase 2: renderToDOM() - Text Node Rendering & XSS Security", () => {
  it("should create a native Text node with document.createTextNode", () => {
    const textVNode = createTextElement("Safe text content");
    const domNode = renderToDOM(textVNode);

    assertEqual(domNode.nodeType, 3); // 3 = Node.TEXT_NODE
    assertEqual(domNode.nodeValue, "Safe text content");
  });

  it("should render '<script>alert(1)</script>' as inert text without executing or parsing HTML", () => {
    const scriptPayload = "<script>alert(1)</script>";
    const vnode = createElement("div", null, scriptPayload);
    const dom = renderToDOM(vnode);

    // Verify it contains a text node with literal script payload, not a script element
    assertEqual(dom.childNodes.length, 1);
    assertEqual(dom.childNodes[0].nodeType, 3);
    assertEqual(dom.childNodes[0].nodeValue, scriptPayload);
    assertEqual(dom.children.length, 0); // No HTML elements created inside
  });

  it("should render '<img onerror=alert(1)>' as inert text without creating an img element", () => {
    const imgPayload = "<img src=x onerror=alert(1)>";
    const vnode = createElement("p", null, imgPayload);
    const dom = renderToDOM(vnode);

    assertEqual(dom.childNodes.length, 1);
    assertEqual(dom.childNodes[0].nodeType, 3);
    assertEqual(dom.childNodes[0].nodeValue, imgPayload);
    assertEqual(dom.children.length, 0); // No img element created
  });

  it("should correctly render numeric values (including 0) as text nodes", () => {
    const vnode = createElement("span", null, 0);
    const dom = renderToDOM(vnode);

    assertEqual(dom.childNodes.length, 1);
    assertEqual(dom.childNodes[0].nodeValue, "0");
  });
});

describe("Phase 2: renderToDOM() - Element Creation & Supported Props", () => {
  it("should create native element matching vnode type", () => {
    const vnode = createElement("section", null);
    const dom = renderToDOM(vnode);

    assertEqual(dom.nodeType, 1); // 1 = Node.ELEMENT_NODE
    assertEqual(dom.tagName.toLowerCase(), "section");
  });

  it("should set id property and attribute correctly", () => {
    const vnode = createElement("div", { id: "user-profile" });
    const dom = renderToDOM(vnode);

    assertEqual(dom.id, "user-profile");
    assertEqual(dom.getAttribute("id"), "user-profile");
  });

  it("should set className property and class attribute correctly", () => {
    const vnode = createElement("div", { className: "card active highlighted" });
    const dom = renderToDOM(vnode);

    assertEqual(dom.className, "card active highlighted");
    assertEqual(dom.getAttribute("class"), "card active highlighted");
  });

  it("should set role attribute for accessible semantic HTML", () => {
    const vnode = createElement("div", { role: "alert", id: "notify" });
    const dom = renderToDOM(vnode);

    assertEqual(dom.getAttribute("role"), "alert");
    assertEqual(dom.id, "notify");
  });

  it("should register onClick handler with addEventListener and trigger on click", () => {
    let clicked = false;
    let eventParam = null;

    const handler = (evt) => {
      clicked = true;
      eventParam = evt;
    };

    const vnode = createElement("button", { onClick: handler }, "Submit");
    const dom = renderToDOM(vnode);

    // Trigger click event
    dom.dispatchEvent({ type: "click" });

    assert(clicked, "onClick listener should have been invoked");
    assertEqual(eventParam.type, "click");
  });

  it("should handle multiple props simultaneously (id, className, role, onClick)", () => {
    let clicked = false;
    const vnode = createElement("button", {
      id: "submit-btn",
      className: "btn primary",
      role: "button",
      onClick: () => { clicked = true; }
    }, "Save");

    const dom = renderToDOM(vnode);
    assertEqual(dom.id, "submit-btn");
    assertEqual(dom.className, "btn primary");
    assertEqual(dom.getAttribute("role"), "button");

    dom.dispatchEvent("click");
    assert(clicked);
  });
});

describe("Phase 2: renderToDOM() - Security & Unsafe Attribute Rejection", () => {
  it("should reject inline string event handlers with TypeError", () => {
    const vnodeWithInline = {
      type: "button",
      props: { onClick: "alert(1)", children: [] },
      children: []
    };
    assertThrows(() => renderToDOM(vnodeWithInline), TypeError);
  });

  it("should reject dangerous javascript: protocol URIs with Error", () => {
    const vnodeWithJsUri = {
      type: "a",
      props: { href: "javascript:alert(1)", children: [] },
      children: []
    };
    assertThrows(() => renderToDOM(vnodeWithJsUri), Error);
  });

  it("should reject innerHTML / dangerouslySetInnerHTML properties with TypeError", () => {
    const vnodeWithInnerHTML = {
      type: "div",
      props: { innerHTML: "<span>pwned</span>", children: [] },
      children: []
    };
    assertThrows(() => renderToDOM(vnodeWithInnerHTML), TypeError);

    const vnodeWithDangerous = {
      type: "div",
      props: { dangerouslySetInnerHTML: { __html: "alert" }, children: [] },
      children: []
    };
    assertThrows(() => renderToDOM(vnodeWithDangerous), TypeError);
  });
});

describe("Phase 2: renderToDOM() - Semantic DOM Fidelity & Recursive Mounting", () => {
  it("should recursively mount nested elements in order without extra wrappers", () => {
    const vnode = createElement(
      "article",
      { id: "post-1" },
      createElement("header", null, createElement("h2", null, "Article Title")),
      createElement("section", { className: "content" }, createElement("p", null, "Article body paragraph")),
      createElement("footer", null, createElement("small", null, "Published 2026"))
    );

    const dom = renderToDOM(vnode);

    assertEqual(dom.tagName.toLowerCase(), "article");
    assertEqual(dom.childNodes.length, 3);
    assertEqual(dom.childNodes[0].tagName.toLowerCase(), "header");
    assertEqual(dom.childNodes[1].tagName.toLowerCase(), "section");
    assertEqual(dom.childNodes[2].tagName.toLowerCase(), "footer");

    // Check header children
    const header = dom.childNodes[0];
    assertEqual(header.childNodes.length, 1);
    assertEqual(header.childNodes[0].tagName.toLowerCase(), "h2");
    assertEqual(header.childNodes[0].childNodes[0].nodeValue, "Article Title");

    // Check section children
    const section = dom.childNodes[1];
    assertEqual(section.className, "content");
    assertEqual(section.childNodes[0].tagName.toLowerCase(), "p");
    assertEqual(section.childNodes[0].childNodes[0].nodeValue, "Article body paragraph");
  });

  it("should mount directly to container when provided", () => {
    const container = document.createElement("div");
    const vnode = createElement("span", { id: "child-span" }, "Mounted in container");

    const returnedDom = renderToDOM(vnode, container);

    assertEqual(container.childNodes.length, 1);
    assertEqual(container.childNodes[0], returnedDom);
    assertEqual(container.childNodes[0].id, "child-span");
  });

  it("should preserve semantic HTML elements without introducing div wrappers", () => {
    const semanticVNode = createElement(
      "nav",
      { role: "navigation" },
      createElement("ul", null,
        createElement("li", null, createElement("a", { href: "/home" }, "Home")),
        createElement("li", null, createElement("a", { href: "/about" }, "About"))
      )
    );

    const dom = renderToDOM(semanticVNode);
    assertEqual(dom.tagName.toLowerCase(), "nav");
    assertEqual(dom.childNodes.length, 1);
    assertEqual(dom.childNodes[0].tagName.toLowerCase(), "ul");
    assertEqual(dom.childNodes[0].childNodes.length, 2);
  });
});

// ==========================================
// Execution & Reporting
// ==========================================

export async function runTests() {
  let passedCount = 0;
  let failedCount = 0;
  const results = [];

  const isBrowser = typeof window !== "undefined" && typeof document !== "undefined" && document.getElementById;

  console.log("\n=========================================");
  console.log(" Mini-React Phase 1 & Phase 2 Test Suite");
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

          const row = document.createElement("div");
          row.className = "test-row";

          const badge = document.createElement("span");
          badge.className = `badge ${t.passed ? "pass" : "fail"}`;
          badge.textContent = t.passed ? "PASS" : "FAIL";

          const nameSpan = document.createElement("span");
          nameSpan.textContent = t.name;

          row.appendChild(badge);
          row.appendChild(nameSpan);
          item.appendChild(row);

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
