// client/src/appeal/appealApi.js
import { ApiError, readJson } from '../api.js';

// null when no appeal has been filed (the API answers 404 for that); every other failure is an ApiError
export async function fetchAppeal(playerId, { signal } = {}) {
  try {
    return await fetch(`/api/appeals/${encodeURIComponent(playerId)}`, { signal }).then(readJson);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export const postAppeal = (playerId, values, { signal } = {}) =>
  fetch(`/api/appeals/${encodeURIComponent(playerId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(values),
    signal,
  }).then(readJson);
