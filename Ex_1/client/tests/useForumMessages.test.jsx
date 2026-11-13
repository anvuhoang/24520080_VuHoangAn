// client/tests/useForumMessages.test.jsx
import { StrictMode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useForumMessages } from '../src/sprint3-forum/useForumMessages.js';
import { abortError, controlledFetch } from './fetchMock.js';

const flush = () => act(async () => {});
const hook = (initial = { forum: 'nasa', key: 0 }, options = {}) => {
  const renders = [];
  const view = renderHook(
    ({ forum, key }) => {
      const value = useForumMessages(forum, key);
      renders.push({ forum, ...value });
      return value;
    },
    { initialProps: initial, ...options }
  );
  return { ...view, renders };
};
const msg = (id, text = id) => ({ id, author: 'A', text, timestamp: '2026-01-01T09:00:00.000Z' });

afterEach(() => vi.unstubAllGlobals());

describe('useForumMessages loading', () => {
  it('starts as loading with no messages, asks for the forum with a signal, then shows the messages', async () => {
    const { fetchMock, calls } = controlledFetch();
    vi.stubGlobal('fetch', fetchMock);
    const { result } = hook();
    expect(result.current).toEqual({ status: 'loading', messages: [], error: null });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(calls[0].url).toBe('/api/messages/nasa');
    expect(calls[0].signal).toBeInstanceOf(AbortSignal);
    await act(async () => calls[0].resolve([msg('1'), msg('2')]));
    expect(result.current.status).toBe('success');
    expect(result.current.messages.map((m) => m.id)).toEqual(['1', '2']);
    expect(result.current.error).toBeNull();
  });

  it('encodes the forum name in the address', () => {
    const { fetchMock, calls } = controlledFetch();
    vi.stubGlobal('fetch', fetchMock);
    hook({ forum: 'a b/c', key: 0 });
    expect(calls[0].url).toBe('/api/messages/a%20b%2Fc');
  });

  it('turns an error answer into the error state with the server message', async () => {
    const { fetchMock, calls } = controlledFetch();
    vi.stubGlobal('fetch', fetchMock);
    const { result } = hook({ forum: 'zzz', key: 0 });
    await act(async () => calls[0].resolve({ error: 'Unknown forum: zzz' }, 404));
    expect(result.current).toEqual({ status: 'error', messages: [], error: 'Unknown forum: zzz' });
  });

  it('uses a generic message when the error answer has no JSON body', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>oops</html>', { status: 502 })));
    const { result } = hook();
    await flush();
    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('Request failed (502)');
  });

  it('turns a network failure into the error state', async () => {
    const { fetchMock, calls } = controlledFetch();
    vi.stubGlobal('fetch', fetchMock);
    const { result } = hook();
    await act(async () => calls[0].reject(new TypeError('Failed to fetch')));
    expect(result.current).toEqual({ status: 'error', messages: [], error: 'Failed to fetch' });
  });

  it('treats an AbortError that this hook did not cause as a failure, not as "loading" for ever', async () => {
    const { fetchMock, calls } = controlledFetch();
    vi.stubGlobal('fetch', fetchMock);
    const { result } = hook();
    await act(async () => calls[0].reject(abortError()));
    expect(result.current.status).toBe('error');
  });
});

describe('useForumMessages switching and cleanup', () => {
  it('aborts the request of the forum that was left, and ignores its late answer', async () => {
    const { fetchMock, calls } = controlledFetch();
    vi.stubGlobal('fetch', fetchMock);
    const { result, rerender } = hook({ forum: 'nasa', key: 0 });
    rerender({ forum: 'esports-tribunal', key: 0 });
    expect(calls).toHaveLength(2);
    expect(calls[0].signal.aborted).toBe(true);
    expect(calls[1].signal.aborted).toBe(false);
    await act(async () => calls[1].resolve([msg('new', 'from esports')]));
    await act(async () => calls[0].resolve([msg('old', 'from nasa')])); // arrives late
    expect(result.current.messages.map((m) => m.text)).toEqual(['from esports']);
    expect(result.current.status).toBe('success');
  });

  it('is not fooled when the old answer arrives first (out of order)', async () => {
    const { fetchMock, calls } = controlledFetch();
    vi.stubGlobal('fetch', fetchMock);
    const { result, rerender } = hook({ forum: 'nasa', key: 0 });
    rerender({ forum: 'notNasa', key: 0 });
    await act(async () => calls[0].resolve([msg('old')]));
    expect(result.current.messages).toEqual([]); // still waiting for the forum that is open
    expect(result.current.status).toBe('loading');
    await act(async () => calls[1].resolve([msg('new')]));
    expect(result.current.messages.map((m) => m.id)).toEqual(['new']);
  });

  it('never shows the messages of another forum, not even in the first render after a switch', async () => {
    const { fetchMock, calls } = controlledFetch();
    vi.stubGlobal('fetch', fetchMock);
    const { rerender, renders } = hook({ forum: 'nasa', key: 0 });
    await act(async () => calls[0].resolve([msg('nasa-1')]));
    renders.length = 0;
    rerender({ forum: 'notNasa', key: 0 });
    expect(renders.length).toBeGreaterThan(0);
    for (const render of renders.filter((r) => r.forum === 'notNasa')) {
      expect(render.messages).toEqual([]);
      expect(render.status).toBe('loading');
    }
  });

  it('survives rapid switching: only the last forum is shown, all the others were aborted', async () => {
    const { fetchMock, calls } = controlledFetch();
    vi.stubGlobal('fetch', fetchMock);
    const { result, rerender } = hook({ forum: 'nasa', key: 0 });
    rerender({ forum: 'esports-tribunal', key: 0 });
    rerender({ forum: 'notNasa', key: 0 });
    rerender({ forum: 'nasa', key: 0 });
    expect(calls).toHaveLength(4);
    expect(calls.map((c) => c.signal.aborted)).toEqual([true, true, true, false]);
    await act(async () => {
      calls[3].resolve([msg('last')]);
      calls[0].resolve([msg('first')]);
      calls[1].resolve([msg('second')]);
      calls[2].resolve([msg('third')]);
    });
    expect(result.current.messages.map((m) => m.id)).toEqual(['last']);
  });

  it('aborts the request when the component goes away and changes nothing afterwards', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { fetchMock, calls } = controlledFetch();
    vi.stubGlobal('fetch', fetchMock);
    const { unmount } = hook();
    unmount();
    expect(calls[0].signal.aborted).toBe(true);
    await act(async () => calls[0].resolve([msg('late')]));
    expect(error).not.toHaveBeenCalled();
  });

  it('refetches when the refresh key changes and keeps the messages already shown meanwhile', async () => {
    const { fetchMock, calls } = controlledFetch();
    vi.stubGlobal('fetch', fetchMock);
    const { result, rerender } = hook({ forum: 'nasa', key: 0 });
    await act(async () => calls[0].resolve([msg('1')]));
    rerender({ forum: 'nasa', key: 1 });
    expect(calls).toHaveLength(2);
    expect(calls[0].signal.aborted).toBe(true);
    expect(result.current.status).toBe('loading');
    expect(result.current.messages.map((m) => m.id)).toEqual(['1']); // no flash of an empty list
    await act(async () => calls[1].resolve([msg('1'), msg('2')]));
    expect(result.current.messages.map((m) => m.id)).toEqual(['1', '2']);
    expect(result.current.status).toBe('success');
  });

  it('does not refetch for a re-render with the same forum and key', async () => {
    const { fetchMock } = controlledFetch();
    vi.stubGlobal('fetch', fetchMock);
    const { rerender } = hook({ forum: 'nasa', key: 0 });
    rerender({ forum: 'nasa', key: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('under StrictMode ends with one live request and the right messages', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { fetchMock, calls } = controlledFetch();
    vi.stubGlobal('fetch', fetchMock);
    const { result } = hook({ forum: 'nasa', key: 0 }, { wrapper: StrictMode });
    expect(calls.length).toBe(2); // StrictMode runs the effect twice
    expect(calls[0].signal.aborted).toBe(true);
    expect(calls[1].signal.aborted).toBe(false);
    await act(async () => calls[1].resolve([msg('1')]));
    expect(result.current.messages.map((m) => m.id)).toEqual(['1']);
    expect(error).not.toHaveBeenCalled();
  });
});
