// client/src/api.js — one error type for every failed call, and the shared way to read an answer.
export class ApiError extends Error {
  constructor(status, message, details = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

// The body is read only after response.ok is known; a 204 has no body at all.
export async function readJson(response) {
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

export const describeError = (error) => (error instanceof ApiError ? error.message : 'The server could not be reached.');
