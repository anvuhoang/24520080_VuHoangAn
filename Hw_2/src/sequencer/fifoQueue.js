// src/sequencer/fifoQueue.js
const COMPACT_THRESHOLD = 32;

export function createFifoQueue() {
  let items = [];
  let head = 0; // index of the oldest item; moving it forward is O(1), unlike Array#shift

  function enqueue(item) {
    items.push(item);
  }

  function dequeue() {
    if (head >= items.length) return undefined;

    const item = items[head];
    items[head] = undefined; // let the removed item be garbage collected
    head += 1;

    if (head === items.length) {
      items = [];
      head = 0;
    } else if (head >= COMPACT_THRESHOLD && head * 2 >= items.length) {
      // Drop the consumed prefix once it is at least half of the storage
      items = items.slice(head);
      head = 0;
    }

    return item;
  }

  function clear() {
    items = [];
    head = 0;
  }

  // A copy, so changing the result never changes the queue
  function toArray() {
    return items.slice(head);
  }

  return {
    enqueue,
    dequeue,
    clear,
    toArray,
    get size() {
      return items.length - head;
    },
  };
}
