// client/src/swipeApi.js — the calls to the Express API. Every failure becomes one ApiError with its status.
export class ApiError extends Error {
  constructor(status, message, details = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

// The body is read only after response.ok is known; a 204 has no body at all.
async function readJson(response) {
  if (!response.ok) {
    let body = {};
    try {
      body = await response.json();
    } catch {
      // The error answer had no JSON body: the generic message below is used
    }
    throw new ApiError(response.status, body.error ?? `Request failed (${response.status})`, body.details);
  }
  return response.status === 204 ? null : response.json();
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export const fetchProfiles = ({ signal } = {}) => fetch('/api/profiles', { signal }).then(readJson);

export const fetchSwipes = ({ signal } = {}) => fetch('/api/swipes', { signal }).then(readJson);

export const postSwipe = ({ profileId, action }, { signal } = {}) =>
  fetch('/api/swipes', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ profileId, action }), signal }).then(readJson);

export const deleteSwipe = (id, { signal } = {}) =>
  fetch(`/api/swipes/${encodeURIComponent(id)}`, { method: 'DELETE', signal }).then(readJson);

export const deleteAllSwipes = ({ signal } = {}) => fetch('/api/swipes', { method: 'DELETE', signal }).then(readJson);
