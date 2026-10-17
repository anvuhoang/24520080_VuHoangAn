/**
 * Mini-React - Core VNode Factory (Phase 1)
 *
 * Implements a minimal, standards-compliant, secure Virtual DOM representation:
 * - createElement(type, props, ...children)
 * - createTextElement(text)
 * - isValidVNode(vnode)
 * - Strict type checking & zero input mutation
 */

export const TEXT_ELEMENT = "TEXT_ELEMENT";

/**
 * Validates whether a given object adheres to the strict VNode schema.
 *
 * Schema:
 * - Must be a non-null, non-array object
 * - `type`: non-empty string
 * - `props`: non-null, non-array object containing a `children` array
 * - For TEXT_ELEMENT: `props.nodeValue` must be a string
 *
 * @param {any} node
 * @returns {boolean}
 */
export function isValidVNode(node) {
  if (node === null || typeof node !== "object" || Array.isArray(node)) {
    return false;
  }

  if (typeof node.type !== "string" || node.type.trim() === "") {
    return false;
  }

  if (node.props === null || typeof node.props !== "object" || Array.isArray(node.props)) {
    return false;
  }

  if (!Array.isArray(node.props.children)) {
    return false;
  }

  if (node.type === TEXT_ELEMENT) {
    if (typeof node.props.nodeValue !== "string") {
      return false;
    }
  }

  return true;
}

/**
 * Creates a text virtual DOM node wrapping a primitive value.
 * Text content is treated as inert text by default, never interpreted as markup.
 *
 * @param {string|number} text
 * @returns {object} Text VNode
 * @throws {TypeError} if text is null, undefined, or a non-primitive object/function/symbol
 */
export function createTextElement(text) {
  if (text === null || text === undefined) {
    throw new TypeError("Text content cannot be null or undefined");
  }

  if (typeof text === "object" || typeof text === "function" || typeof text === "symbol") {
    throw new TypeError("Text content must be a primitive value");
  }

  const stringValue = String(text);

  const textVNode = {
    type: TEXT_ELEMENT,
    props: {
      nodeValue: stringValue,
      children: []
    },
    children: []
  };

  return textVNode;
}

/**
 * Normalizes and flattens nested children into a flat array of VNodes.
 * Primitives (string, number) are converted via createTextElement().
 * Null, undefined, and booleans are ignored (React-style conditional rendering).
 * Nested arrays are recursively flattened.
 * Arbitrary non-VNode objects or invalid types throw a TypeError.
 *
 * @param {any[]} children
 * @returns {object[]} Array of normalized VNodes
 */
function normalizeChildren(children) {
  const normalized = [];

  function walk(items) {
    for (const item of items) {
      if (Array.isArray(item)) {
        walk(item);
      } else if (item === null || item === undefined || typeof item === "boolean") {
        // Ignored for conditional rendering
        continue;
      } else if (typeof item === "string" || typeof item === "number") {
        normalized.push(createTextElement(item));
      } else if (typeof item === "object") {
        if (!isValidVNode(item)) {
          throw new TypeError(
            "Invalid child: object does not satisfy the strict VNode contract"
          );
        }
        normalized.push(item);
      } else {
        throw new TypeError(`Invalid child type: ${typeof item}`);
      }
    }
  }

  walk(children);
  return normalized;
}

/**
 * Virtual DOM element factory.
 *
 * @param {string} type - HTML element tag name (e.g. 'div', 'span', 'h1')
 * @param {object|null|undefined} props - Element properties/attributes
 * @param {...any} children - Variadic child elements or nested child arrays
 * @returns {object} Standardized VNode
 * @throws {TypeError} on invalid tag, invalid props, or invalid child elements
 */
export function createElement(type, props, ...children) {
  // 1. Strict element type validation
  if (typeof type !== "string" || type.trim() === "") {
    throw new TypeError("Element type must be a non-empty string");
  }

  // 2. Strict props validation and null/undefined handling
  if (props !== null && props !== undefined) {
    if (typeof props !== "object" || Array.isArray(props)) {
      throw new TypeError("Props must be an object, null, or undefined");
    }
  }

  // 3. No input mutation: clone props to ensure caller's object is never modified
  const safeProps = {};
  if (props !== null && props !== undefined) {
    for (const key of Object.keys(props)) {
      safeProps[key] = props[key];
    }
  }

  // 4. Nested children normalization
  const rawChildren = children.length > 0
    ? children
    : safeProps.children !== undefined
      ? (Array.isArray(safeProps.children) ? safeProps.children : [safeProps.children])
      : [];

  const normalizedChildren = normalizeChildren(rawChildren);

  // Set normalized children on props without mutating caller's original props object
  safeProps.children = normalizedChildren;

  const vnode = {
    type,
    props: safeProps,
    children: normalizedChildren
  };

  return vnode;
}

// Disallowed dangerous attributes and properties
const FORBIDDEN_PROPS = new Set([
  "innerhtml",
  "outerhtml",
  "insertadjacenthtml",
  "dangerouslysetinnerhtml"
]);

/**
 * Applies properties and event listeners to a native DOM element securely.
 *
 * @param {HTMLElement} domElement
 * @param {object} props
 */
function applyProps(domElement, props) {
  if (!props || typeof props !== "object") return;

  for (const [key, value] of Object.entries(props)) {
    // Skip internal/structural props
    if (key === "children" || key === "nodeValue") {
      continue;
    }

    const lowerKey = key.toLowerCase();

    // Security guard: forbid direct HTML injection properties
    if (FORBIDDEN_PROPS.has(lowerKey)) {
      throw new TypeError(`Forbidden property '${key}': direct HTML injection is strictly disallowed`);
    }

    // Security guard: reject javascript: protocol URIs in any attribute
    if (typeof value === "string" && /^\s*javascript\s*:/i.test(value)) {
      throw new Error(`Unsafe URI detected in attribute '${key}': javascript: URLs are rejected`);
    }

    // Event handlers (e.g. onClick, onKeyDown, etc.)
    if (/^on[A-Z]/.test(key) || /^on[a-z]/.test(key)) {
      if (typeof value !== "function") {
        throw new TypeError(
          `Event handler for '${key}' must be a function, but got ${typeof value}. Inline string handlers are forbidden.`
        );
      }
      const eventName = key.slice(2).toLowerCase();
      domElement.addEventListener(eventName, value);
      continue;
    }

    // Explicitly handled standard attributes
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
    } else if (value === null || value === undefined) {
      // Ignore null or undefined attribute values
    } else {
      throw new TypeError(`Unsupported prop value type for '${key}': ${typeof value}`);
    }
  }
}

/**
 * Mounts a Virtual DOM tree to native DOM nodes recursively.
 *
 * @param {object} vnode - The Virtual DOM node to render
 * @param {Node|null} [container=null] - Optional DOM container to append to
 * @returns {Node} Created native DOM node (Element or Text)
 * @throws {TypeError} if vnode or container is invalid
 */
export function renderToDOM(vnode, container = null) {
  // 1. Validate VNode before rendering
  if (!isValidVNode(vnode)) {
    throw new TypeError("Invalid VNode: cannot render malformed or non-VNode object");
  }

  // 2. Validate container if provided
  if (container !== null && container !== undefined) {
    if (!container || typeof container.appendChild !== "function") {
      throw new TypeError("Container must be a valid DOM node supporting appendChild");
    }
  }

  let domNode;

  // 3. Mount text or element node
  if (vnode.type === TEXT_ELEMENT) {
    // Use document.createTextNode to guarantee text is rendered inertly
    domNode = document.createTextNode(vnode.props.nodeValue);
  } else {
    // Use document.createElement for elements
    domNode = document.createElement(vnode.type);

    // Apply attributes, styles, and event listeners safely
    applyProps(domNode, vnode.props);

    // Mount children recursively in exact order without extra wrappers
    for (const child of vnode.props.children) {
      const childDom = renderToDOM(child);
      domNode.appendChild(childDom);
    }
  }

  // 4. Mount to container if specified
  if (container !== null && container !== undefined) {
    container.appendChild(domNode);
  }

  return domNode;
}

export default {
  TEXT_ELEMENT,
  isValidVNode,
  createTextElement,
  createElement,
  renderToDOM
};

