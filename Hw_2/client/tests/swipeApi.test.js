// client/tests/swipeApi.test.js — the calls to the API and how failures become ApiError.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, deleteAllSwipes, deleteSwipe, fetchProfiles, fetchSwipes, postSwipe } from '../src/swipeApi.js';
import { jsonResponse } from './fetchMock.js';

afterEach(() => vi.unstubAllGlobals());

const stub = (response) => {
  const fetchMock = vi.fn().mockImplementation(async () => response.clone()); // a Response body can be read once
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

describe('requests', () => {
  it('GET profiles and swipes, passing the signal on', async () => {
    const fetchMock = stub(jsonResponse([]));
    const controller = new AbortController();
    await fetchProfiles({ signal: controller.signal });
    await fetchSwipes({ signal: controller.signal });
    expect(fetchMock.mock.calls[0]).toEqual(['/api/profiles', { signal: controller.signal }]);
    expect(fetchMock.mock.calls[1]).toEqual(['/api/swipes', { signal: controller.signal }]);
  });

  it('POST sends only profileId and action, as JSON', async () => {
    const fetchMock = stub(jsonResponse({ id: 's1' }, 201));
    await postSwipe({ profileId: 'p1', action: 'LIKE', isAdmin: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/swipes');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ profileId: 'p1', action: 'LIKE' });
  });

  it('DELETE one swipe encodes the id in the path', async () => {
    const fetchMock = stub(jsonResponse({ id: 'a/b' }));
    await deleteSwipe('a/b ?x');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/swipes/a%2Fb%20%3Fx');
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
  });

  it('DELETE all answers 204 without a body and gives null', async () => {
    stub(new Response(null, { status: 204 }));
    await expect(deleteAllSwipes()).resolves.toBeNull();
  });
});

describe('failures', () => {
  it('turns an error status into ApiError with the status and the server message', async () => {
    stub(jsonResponse({ error: 'Invalid swipe.', details: { action: 'bad' } }, 400));
    const error = await postSwipe({ profileId: 'p1', action: 'X' }).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(400);
    expect(error.message).toBe('Invalid swipe.');
    expect(error.details).toEqual({ action: 'bad' });
  });

  it('uses a generic message when the error answer has no JSON body (a proxy page, for example)', async () => {
    stub(new Response('<html>Bad gateway</html>', { status: 502 }));
    const error = await fetchProfiles().catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(502);
    expect(error.message).toBe('Request failed (502)');
  });

  it('does not read the body of a failed answer as data', async () => {
    stub(jsonResponse([{ id: 'p1' }], 500));
    await expect(fetchProfiles()).rejects.toBeInstanceOf(ApiError);
  });

  it('lets a network failure through as it is (the caller says "could not be reached")', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(fetchSwipes()).rejects.toBeInstanceOf(TypeError);
  });
});
