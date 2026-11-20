// client/src/appeal/appealApi.js
import { readJson } from '../api.js';

// The receipt, or null when no appeal has been filed (the API answers 200 with null). Every failure is an ApiError.
export const fetchAppeal = (playerId, { signal } = {}) => fetch(`/api/appeals/${encodeURIComponent(playerId)}`, { signal }).then(readJson);

export const postAppeal = (playerId, values, { signal } = {}) =>
  fetch(`/api/appeals/${encodeURIComponent(playerId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(values),
    signal,
  }).then(readJson);
