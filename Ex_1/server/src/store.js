// server/src/store.js
// An in-memory store behind a small async interface. A MongoDB/Mongoose 8 store can replace it later
// without touching the routes (the homework); here the data lives only as long as the process.
import { randomUUID } from 'node:crypto';

export const FORUMS = Object.freeze(['nasa', 'esports-tribunal', 'notNasa']);

// Invented sample messages
const SEED = Object.freeze({
  nasa: [
    { author: 'Ada', text: 'Launch window opens at dawn.' },
    { author: 'Grace', text: 'Telemetry looks nominal.' },
  ],
  'esports-tribunal': [
    { author: 'Referee', text: 'The appeal is registered and under review.' },
  ],
  notNasa: [],
});

export function createMemoryStore(seed = SEED) {
  const forums = new Map(
    Object.entries(seed).map(([forum, messages]) => [
      forum,
      messages.map((message, index) => ({
        id: randomUUID(),
        author: message.author,
        text: message.text,
        timestamp: new Date(Date.UTC(2026, 0, 1, 9, index)).toISOString(),
      })),
    ])
  );

  return {
    async hasForum(forum) {
      return forums.has(forum);
    },
    async getMessages(forum) {
      const messages = forums.get(forum);
      return messages ? [...messages] : undefined;
    },
    async addMessage(forum, message) {
      forums.get(forum).push(message);
      return message;
    },
  };
}
