// client/src/sprint3-forum/forumApi.js
export class ApiError extends Error {
  constructor(status, message, details = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

// Every failure becomes one ApiError with the status; the body is read only after response.ok is known
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
  return response.json();
}

export async function fetchMessages(forum, { signal } = {}) {
  const response = await fetch(`/api/messages/${encodeURIComponent(forum)}`, { signal });
  return readJson(response);
}

export async function postMessage(forum, payload, { signal } = {}) {
  const response = await fetch(`/api/messages/${encodeURIComponent(forum)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
  return readJson(response);
}
