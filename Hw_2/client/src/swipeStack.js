// client/src/swipeStack.js — the undo stack: last in, first out. Immutable, so React can compare and render it.

export const EMPTY_STACK = Object.freeze([]);

export const push = (stack, item) => Object.freeze([...stack, item]);

export const peek = (stack) => (stack.length === 0 ? undefined : stack[stack.length - 1]);

// pop never mutates and never throws: popping an empty stack gives the same empty stack and no item
export function pop(stack) {
  if (stack.length === 0) return { stack, item: undefined };
  return { stack: Object.freeze(stack.slice(0, -1)), item: stack[stack.length - 1] };
}

export const size = (stack) => stack.length;
