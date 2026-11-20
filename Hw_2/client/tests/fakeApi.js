// client/tests/fakeApi.js — an in-memory stand-in for the Express API that follows the same rules as the real one
// (next card only, latest swipe only, 409/404), so the component tests exercise the real client logic against them.
import { vi } from 'vitest';
import { jsonResponse } from './fetchMock.js';

export const PROFILES = Object.freeze([
  { id: 'p1', name: 'Minh Anh', age: 26, bio: 'Bio one' },
  { id: 'p2', name: 'Quang Huy', age: 29, bio: 'Bio two' },
  { id: 'p3', name: 'Thu Trang', age: 27, bio: 'Bio three' },
  { id: 'p4', name: 'Duc Long', age: 31, bio: 'Bio four' },
]);

export function fakeApi({ swipes = [] } = {}) {
  const state = { swipes: swipes.map((s) => ({ ...s })), calls: [], override: null, nextId: 1 };

  const fetchMock = vi.fn(async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    state.calls.push({ method, url, body });
    const forced = state.override?.(method, url, body);
    if (forced) return forced;

    if (method === 'GET' && url === '/api/profiles') return jsonResponse(PROFILES);
    if (method === 'GET' && url === '/api/swipes') return jsonResponse(state.swipes);
    if (method === 'POST' && url === '/api/swipes') {
      if (body.profileId !== PROFILES[state.swipes.length]?.id) return jsonResponse({ error: 'That is not the next card in the deck.' }, 409);
      const record = { id: `s${state.nextId++}`, profileId: body.profileId, action: body.action, createdAt: '2026-01-01T00:00:00.000Z' };
      state.swipes.push(record);
      return jsonResponse(record, 201);
    }
    if (method === 'DELETE' && url.startsWith('/api/swipes/')) {
      const id = decodeURIComponent(url.slice('/api/swipes/'.length));
      const last = state.swipes.at(-1);
      if (!state.swipes.some((s) => s.id === id)) return jsonResponse({ error: 'Unknown swipe.' }, 404);
      if (last.id !== id) return jsonResponse({ error: 'Only the latest swipe can be undone.' }, 409);
      state.swipes.pop();
      return jsonResponse({ id });
    }
    if (method === 'DELETE' && url === '/api/swipes') {
      state.swipes = [];
      return new Response(null, { status: 204 });
    }
    return jsonResponse({ error: 'Not found.' }, 404);
  });

  const posts = () => state.calls.filter((c) => c.method === 'POST');
  const deletes = () => state.calls.filter((c) => c.method === 'DELETE');
  return { fetchMock, state, posts, deletes };
}
