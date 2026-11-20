// client/tests/useAppeal.test.jsx — "has an appeal been filed?" for one player at a time, on its own.
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAppeal } from '../src/appeal/useAppeal.js';
import { controlledFetch } from './fetchMock.js';

afterEach(() => vi.unstubAllGlobals());

const receipt = (playerId) => ({ id: `r-${playerId}`, playerId, category: 'other', status: 'received', createdAt: '2026-11-20T10:00:00.000Z' });
const flush = () => act(async () => {});

describe('useAppeal', () => {
  it('is "loading", then "none" for an answer of null, then "filed" for a receipt', async () => {
    const { fetchMock, calls } = controlledFetch();
    vi.stubGlobal('fetch', fetchMock);
    const { result, rerender } = renderHook(({ id }) => useAppeal(id), { initialProps: { id: 'himass' } });
    expect(result.current.status).toBe('loading');
    await act(async () => calls[0].resolve(null));
    expect(result.current.status).toBe('none');
    rerender({ id: 'tanvuu' });
    await act(async () => calls[1].resolve(receipt('tanvuu')));
    expect(result.current.status).toBe('filed');
    expect(result.current.appeal.id).toBe('r-tanvuu');
  });

  it('never shows the answer of the PREVIOUS player for the new one: it is "loading" until its own answer comes', async () => {
    const { fetchMock, calls } = controlledFetch();
    vi.stubGlobal('fetch', fetchMock);
    const { result, rerender } = renderHook(({ id }) => useAppeal(id), { initialProps: { id: 'himass' } });
    await act(async () => calls[0].resolve(receipt('himass')));
    expect(result.current.status).toBe('filed');
    rerender({ id: 'tanvuu' });
    expect(result.current.status).toBe('loading'); // not "filed" with Himass's receipt
    expect(result.current.appeal).toBeNull();
  });

  it('aborts the request of the previous player when the player changes, and when it unmounts', async () => {
    const { fetchMock, calls } = controlledFetch();
    vi.stubGlobal('fetch', fetchMock);
    const { rerender, unmount } = renderHook(({ id }) => useAppeal(id), { initialProps: { id: 'himass' } });
    rerender({ id: 'tanvuu' });
    expect(calls[0].signal.aborted).toBe(true);
    expect(calls[1].signal.aborted).toBe(false);
    unmount();
    expect(calls[1].signal.aborted).toBe(true);
  });

  it('ignores a late answer for the old player even from a fetch that does not honour the abort signal', async () => {
    const answers = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((url) => new Promise((resolve) => answers.push({ url, resolve })))
    );
    const { result, rerender } = renderHook(({ id }) => useAppeal(id), { initialProps: { id: 'himass' } });
    rerender({ id: 'tanvuu' });
    await act(async () => answers[0].resolve(new Response(JSON.stringify(receipt('himass')), { status: 200 }))); // the old one answers late
    expect(result.current.status).toBe('loading');
    await act(async () => answers[1].resolve(new Response('null', { status: 200 })));
    expect(result.current.status).toBe('none');
    expect(result.current.appeal).toBeNull();
  });

  it('is an "error" with the message of the server, and reload asks again', async () => {
    const { fetchMock, calls } = controlledFetch();
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useAppeal('himass'));
    await act(async () => calls[0].resolve({ error: 'Database is down.' }, 500));
    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('Database is down.');
    await act(async () => result.current.reload());
    expect(calls).toHaveLength(2);
    await act(async () => calls[1].resolve(null));
    expect(result.current.status).toBe('none');
  });

  it('markFiled shows the receipt at once', async () => {
    const { fetchMock, calls } = controlledFetch();
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useAppeal('himass'));
    await act(async () => calls[0].resolve(null));
    act(() => result.current.markFiled(receipt('himass')));
    expect(result.current.status).toBe('filed');
    await flush();
  });
});
