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

export default {
  TEXT_ELEMENT,
  isValidVNode,
  createTextElement,
  createElement
};
