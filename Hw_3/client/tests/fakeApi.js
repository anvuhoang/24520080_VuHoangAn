// client/tests/fakeApi.js — an in-memory stand-in for the Express API that follows the same rules as the real one
// (the same validateAppeal, the deadline judged by ITS clock, one appeal per player, 400/403/404/409).
import { vi } from 'vitest';
import { validateAppeal } from '../src/appeal/appealRules.js';
import { jsonResponse } from './fetchMock.js';

const HOUR = 3600 * 1000;

const infractions = (rows) => rows.map(([rule, severity, penaltyMinutes], i) => ({ id: `i${i}-${rule}`, rule, severity, penaltyMinutes }));

export function makeDossiers(now = Date.now(), hours = { himass: 72, tanvuu: 48 }) {
  return [
    {
      playerId: 'himass',
      name: 'Himass',
      team: 'Night Owls',
      matchesPlayed: 120,
      reportsReceived: 9,
      infractions: infractions([['Suspected macro input', 4, 4320], ['Chat: repeated spam', 1, 60]]),
      appealDeadline: new Date(now + hours.himass * HOUR).toISOString(),
    },
    {
      playerId: 'tanvuu',
      name: 'TanVuu',
      team: 'Night Owls',
      matchesPlayed: 118,
      reportsReceived: 11,
      infractions: infractions([['Suspected macro input', 4, 1440], ['Chat: toxic language', 2, 240], ['Late to match', 1, 30]]),
      appealDeadline: new Date(now + hours.tanvuu * HOUR).toISOString(),
    },
  ];
}

export function fakeApi({ hours, appeals = {}, now = () => Date.now() } = {}) {
  const state = { dossiers: makeDossiers(now(), hours), appeals: { ...appeals }, calls: [], override: null, nextId: 1 };

  const fetchMock = vi.fn(async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    state.calls.push({ method, url, body });
    const forced = state.override?.(method, url, body);
    if (forced) return forced;

    if (method === 'GET' && url === '/api/clock') return jsonResponse({ now: new Date(now()).toISOString() });
    if (method === 'GET' && url === '/api/dossiers') return jsonResponse(state.dossiers);

    const appealMatch = url.match(/^\/api\/appeals\/([^/]+)$/);
    if (appealMatch) {
      const playerId = decodeURIComponent(appealMatch[1]);
      const dossier = state.dossiers.find((d) => d.playerId === playerId);
      if (method === 'GET') {
        if (!dossier) return jsonResponse({ error: 'Unknown player.' }, 404);
        return jsonResponse(state.appeals[playerId] ?? null);
      }
      if (method === 'POST') {
        if (!dossier) return jsonResponse({ error: 'Unknown player.' }, 404);
        if (now() >= Date.parse(dossier.appealDeadline)) return jsonResponse({ error: 'The appeal window is closed.' }, 403);
        const details = validateAppeal(body);
        if (Object.keys(details).length > 0) return jsonResponse({ error: 'Invalid appeal.', details }, 400);
        if (state.appeals[playerId]) return jsonResponse({ error: 'An appeal has already been filed for this player.' }, 409);
        const receipt = { id: `a${state.nextId++}`, playerId, category: body.category, status: 'received', createdAt: new Date(now()).toISOString() };
        state.appeals[playerId] = receipt;
        return jsonResponse(receipt, 201);
      }
    }
    return jsonResponse({ error: 'Not found.' }, 404);
  });

  const posts = () => state.calls.filter((c) => c.method === 'POST');
  return { fetchMock, state, posts };
}
