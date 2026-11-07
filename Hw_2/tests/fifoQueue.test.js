// tests/fifoQueue.test.js
import { describe, expect, it } from 'vitest';
import { createFifoQueue } from '../src/sequencer/fifoQueue.js';

describe('createFifoQueue', () => {
  it('gives items back in the order they went in', () => {
    const queue = createFifoQueue();
    ['a', 'b', 'c'].forEach((item) => queue.enqueue(item));

    expect(queue.size).toBe(3);
    expect([queue.dequeue(), queue.dequeue(), queue.dequeue()]).toEqual(['a', 'b', 'c']);
    expect(queue.size).toBe(0);
  });

  it('is harmless when it is empty', () => {
    const queue = createFifoQueue();

    expect(queue.dequeue()).toBeUndefined();
    expect(queue.dequeue()).toBeUndefined();
    expect(queue.toArray()).toEqual([]);
    expect(queue.size).toBe(0);
    expect(() => queue.clear()).not.toThrow();

    queue.enqueue('x'); // and it works again afterwards
    expect(queue.dequeue()).toBe('x');
  });

  it('returns a copy from toArray(), so changing it does not change the queue', () => {
    const queue = createFifoQueue();
    [1, 2, 3, 4].forEach((item) => queue.enqueue(item));

    const view = queue.toArray();
    view.push(99);
    view.shift();
    view.reverse();
    view.length = 0;

    expect(queue.toArray()).toEqual([1, 2, 3, 4]);
    expect(queue.size).toBe(4);
    expect(queue.toArray()).not.toBe(queue.toArray());
  });

  it('shows only what is left after a dequeue', () => {
    const queue = createFifoQueue();
    [1, 2, 3].forEach((item) => queue.enqueue(item));
    queue.dequeue();

    expect(queue.toArray()).toEqual([2, 3]);
  });

  it('can be cleared and reused', () => {
    const queue = createFifoQueue();
    [1, 2, 3].forEach((item) => queue.enqueue(item));
    queue.clear();

    expect(queue.size).toBe(0);
    expect(queue.toArray()).toEqual([]);
    expect(queue.dequeue()).toBeUndefined();

    queue.enqueue('again');
    expect(queue.toArray()).toEqual(['again']);
  });

  it('stores items by reference (the recorded events are read-only by contract)', () => {
    const queue = createFifoQueue();
    const event = { midi: 60 };
    queue.enqueue(event);

    expect(queue.toArray()[0]).toBe(event);
  });

  it('keeps the order through its internal compaction when used in bursts', () => {
    const queue = createFifoQueue();
    const out = [];
    let next = 0;

    for (let round = 0; round < 200; round += 1) {
      for (let k = 0; k < 7; k += 1) queue.enqueue(next++);
      for (let k = 0; k < 5; k += 1) out.push(queue.dequeue());
    }
    while (queue.size > 0) out.push(queue.dequeue());

    expect(out).toHaveLength(1400);
    out.forEach((value, index) => expect(value).toBe(index));
  });

  it('dequeues a long queue without getting slower (no Array#shift)', () => {
    const queue = createFifoQueue();
    const count = 100000;
    for (let i = 0; i < count; i += 1) queue.enqueue(i);

    const started = performance.now();
    for (let i = 0; i < count; i += 1) queue.dequeue();

    expect(queue.size).toBe(0);
    expect(performance.now() - started).toBeLessThan(500);
  });
});
