// client/tests/deck.test.js — the stack, the score and the key and gesture mapping (pure functions).
import { describe, expect, it } from 'vitest';
import { ACTION_LABELS, LIKE, PASS, POINTS, SUPER, SWIPE_THRESHOLD, actionForGesture, actionForKey, scoreOf, statsOf } from '../src/deck.js';
import { EMPTY_STACK, peek, pop, push, size } from '../src/swipeStack.js';

const h = (...actions) => actions.map((action, i) => ({ id: `s${i}`, profileId: `p${i}`, action }));

describe('swipeStack (LIFO)', () => {
  it('pops in the reverse order of the pushes', () => {
    let stack = EMPTY_STACK;
    for (const item of ['a', 'b', 'c']) stack = push(stack, item);
    const out = [];
    while (size(stack) > 0) {
      const popped = pop(stack);
      out.push(popped.item);
      stack = popped.stack;
    }
    expect(out).toEqual(['c', 'b', 'a']);
  });

  it('peek shows the top without removing it', () => {
    const stack = push(push(EMPTY_STACK, 1), 2);
    expect(peek(stack)).toBe(2);
    expect(size(stack)).toBe(2);
  });

  it('never mutates: push and pop return new frozen stacks', () => {
    const one = push(EMPTY_STACK, 'a');
    const two = push(one, 'b');
    expect(one).toEqual(['a']);
    expect(EMPTY_STACK).toEqual([]);
    expect(Object.isFrozen(two)).toBe(true);
    const { stack } = pop(two);
    expect(two).toEqual(['a', 'b']);
    expect(Object.isFrozen(stack)).toBe(true);
  });

  it('popping an empty stack gives no item and does not throw', () => {
    expect(pop(EMPTY_STACK)).toEqual({ stack: EMPTY_STACK, item: undefined });
    expect(peek(EMPTY_STACK)).toBeUndefined();
  });
});

describe('score (derived, asymmetric)', () => {
  it('is 0 for an empty history', () => {
    expect(scoreOf([])).toBe(0);
  });
  it('likes earn 10, passes cost 5, super likes earn 25', () => {
    expect(POINTS).toEqual({ LIKE: 10, PASS: -5, SUPER: 25 });
    expect(scoreOf(h(LIKE))).toBe(10);
    expect(scoreOf(h(PASS))).toBe(-5);
    expect(scoreOf(h(SUPER))).toBe(25);
  });
  it('is asymmetric: a like and a pass do not cancel out', () => {
    expect(scoreOf(h(LIKE, PASS))).toBe(5);
  });
  it('can go below zero', () => {
    expect(scoreOf(h(PASS, PASS, LIKE))).toBe(0);
    expect(scoreOf(h(PASS, PASS, PASS))).toBe(-15);
  });
  it('an unknown action adds nothing instead of NaN or text', () => {
    expect(scoreOf([{ action: 'WAT' }])).toBe(0);
    expect(scoreOf([{ action: 'constructor' }, { action: LIKE }])).toBe(10);
  });
  it('removing the last swipe gives back exactly the score before it (undo cannot leave a trace)', () => {
    const history = h(LIKE, SUPER, PASS);
    expect(scoreOf(pop(history).stack)).toBe(scoreOf(h(LIKE, SUPER)));
  });
  it('statsOf counts each action and the total', () => {
    expect(statsOf(h(LIKE, PASS, LIKE, SUPER))).toEqual({ score: 40, likes: 2, passes: 1, supers: 1, swiped: 4 });
  });
});

describe('keys', () => {
  it.each([
    ['ArrowLeft', PASS],
    ['ArrowRight', LIKE],
    ['ArrowUp', SUPER],
  ])('%s is %s', (key, action) => {
    expect(actionForKey(key)).toBe(action);
  });
  it.each(['ArrowDown', 'Backspace', 'a', 'Enter', ' ', 'Left', ''])('%j is not a swipe', (key) => {
    expect(actionForKey(key)).toBeNull();
  });
  it('does not read inherited object keys such as "constructor" or "__proto__"', () => {
    expect(actionForKey('constructor')).toBeNull();
    expect(actionForKey('__proto__')).toBeNull();
    expect(actionForKey('toString')).toBeNull();
  });
});

describe('gestures', () => {
  it('uses a 50 px threshold', () => {
    expect(SWIPE_THRESHOLD).toBe(50);
  });
  it('a clear drag to the right likes, to the left passes, upward super likes', () => {
    expect(actionForGesture(80, 0)).toBe(LIKE);
    expect(actionForGesture(-80, 0)).toBe(PASS);
    expect(actionForGesture(0, -80)).toBe(SUPER);
  });
  it('the threshold itself is not a swipe, one pixel more is', () => {
    expect(actionForGesture(50, 0)).toBeNull();
    expect(actionForGesture(51, 0)).toBe(LIKE);
    expect(actionForGesture(-50, 0)).toBeNull();
    expect(actionForGesture(-51, 0)).toBe(PASS);
    expect(actionForGesture(0, -50)).toBeNull();
    expect(actionForGesture(0, -51)).toBe(SUPER);
  });
  it('a tap or a jitter is nothing', () => {
    expect(actionForGesture(0, 0)).toBeNull();
    expect(actionForGesture(10, -10)).toBeNull();
  });
  it('a downward drag is nothing', () => {
    expect(actionForGesture(0, 200)).toBeNull();
  });
  it('the dominant axis wins on a diagonal', () => {
    expect(actionForGesture(60, -80)).toBe(SUPER);
    expect(actionForGesture(90, -60)).toBe(LIKE);
    expect(actionForGesture(-90, -60)).toBe(PASS);
  });
  it('a long sideways drag with a little vertical drift is still sideways', () => {
    expect(actionForGesture(120, 30)).toBe(LIKE);
    expect(actionForGesture(120, -30)).toBe(LIKE);
  });
  it('a drag that is mostly down but also sideways is nothing (it is not a like)', () => {
    expect(actionForGesture(60, 100)).toBeNull();
  });
});

describe('labels', () => {
  it('has a past-tense label for every action', () => {
    expect(ACTION_LABELS).toEqual({ LIKE: 'Liked', PASS: 'Passed', SUPER: 'Super-liked' });
  });
});
