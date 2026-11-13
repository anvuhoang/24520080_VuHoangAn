// client/tests/ForumPage.test.jsx
import { StrictMode } from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ForumPage from '../src/sprint3-forum/ForumPage.jsx';
import { controlledFetch, jsonResponse, routedFetch } from './fetchMock.js';

afterEach(() => vi.unstubAllGlobals());

const stamp = '2026-01-01T09:00:00.000Z';
const seed = () => ({
  nasa: [{ id: 'n1', author: 'Ada', text: 'Launch at dawn', timestamp: stamp }],
  'esports-tribunal': [{ id: 'e1', author: 'Referee', text: 'Appeal registered', timestamp: stamp }],
  notNasa: [],
});

// A tiny fake of the API: GET lists, POST appends, unknown forums answer 404
function backend(initial = seed()) {
  const data = initial;
  let counter = 0;
  const fetchMock = routedFetch(async (url, init) => {
    const forum = decodeURIComponent(url.split('/').pop());
    if (!(forum in data)) return jsonResponse({ error: `Unknown forum: ${forum}` }, 404);
    if (init.method === 'POST') {
      const message = { id: `new-${(counter += 1)}`, ...JSON.parse(init.body), timestamp: stamp };
      data[forum].push(message);
      return jsonResponse(message, 201);
    }
    return jsonResponse([...data[forum]]);
  });
  return { fetchMock, data };
}

const renderAt = (path, wrapper = (node) => node) =>
  render(
    wrapper(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/forum/:channelId" element={<ForumPage />} />
        </Routes>
      </MemoryRouter>
    )
  );

describe('ForumPage', () => {
  it('loads the channel of the address and shows its messages with the channel marked as current', async () => {
    vi.stubGlobal('fetch', backend().fetchMock);
    renderAt('/forum/nasa');
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Forum channels');
    expect(await screen.findByText('Launch at dawn')).toBeInTheDocument();
    const current = screen.getAllByRole('link').filter((l) => l.getAttribute('aria-current') === 'page');
    expect(current.map((l) => l.textContent)).toEqual(['NASA']);
  });

  it('shows the loading message first', () => {
    const { fetchMock } = controlledFetch();
    vi.stubGlobal('fetch', fetchMock);
    renderAt('/forum/nasa');
    expect(screen.getByRole('region', { name: 'Loading messages' })).toHaveAttribute('aria-busy', 'true');
  });

  it('switches channel when a link is chosen, and the old channel is gone', async () => {
    vi.stubGlobal('fetch', backend().fetchMock);
    const user = userEvent.setup();
    renderAt('/forum/nasa');
    await screen.findByText('Launch at dawn');
    await user.click(screen.getByRole('link', { name: 'Esports Tribunal' }));
    expect(await screen.findByText('Appeal registered')).toBeInTheDocument();
    expect(screen.queryByText('Launch at dawn')).toBeNull();
    await user.click(screen.getByRole('link', { name: 'Not NASA' }));
    expect(await screen.findByText('No messages in this channel yet.')).toBeInTheDocument();
  });

  it('cancels the request of a channel that was left and never shows its late answer (rapid switching)', async () => {
    const { fetchMock, calls } = controlledFetch();
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderAt('/forum/nasa');
    await user.click(screen.getByRole('link', { name: 'Esports Tribunal' }));
    await user.click(screen.getByRole('link', { name: 'Not NASA' }));
    expect(calls.map((c) => c.url)).toEqual(['/api/messages/nasa', '/api/messages/esports-tribunal', '/api/messages/notNasa']);
    expect(calls.map((c) => c.signal.aborted)).toEqual([true, true, false]);
    await act(async () => {
      calls[2].resolve([{ id: 'x', author: 'Z', text: 'only this one', timestamp: stamp }]);
      calls[0].resolve([{ id: 'old', author: 'A', text: 'stale nasa', timestamp: stamp }]);
      calls[1].resolve([{ id: 'old2', author: 'B', text: 'stale esports', timestamp: stamp }]);
    });
    expect(screen.getByText('only this one')).toBeInTheDocument();
    expect(screen.queryByText('stale nasa')).toBeNull();
    expect(screen.queryByText('stale esports')).toBeNull();
  });

  it('shows the API error for an unknown channel and loads again on "Try again"', async () => {
    const { fetchMock, calls } = controlledFetch();
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderAt('/forum/nowhere');
    await act(async () => calls[0].resolve({ error: 'Unknown forum: nowhere' }, 404));
    expect(screen.getByRole('alert')).toHaveTextContent('Unknown forum: nowhere');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(calls).toHaveLength(2);
    expect(screen.queryByRole('alert')).toBeNull(); // loading again
    await act(async () => calls[1].resolve([{ id: '1', author: 'A', text: 'now it works', timestamp: stamp }]));
    expect(screen.getByText('now it works')).toBeInTheDocument();
  });

  it('posts a message, then reloads the channel so the new message appears', async () => {
    const { fetchMock, data } = backend();
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderAt('/forum/notNasa');
    await screen.findByText('No messages in this channel yet.');
    await user.type(screen.getByLabelText('Author'), 'Ada');
    await user.type(screen.getByLabelText('Message'), 'Hello everyone');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('Hello everyone')).toBeInTheDocument();
    expect(data.notNasa).toHaveLength(1);
    expect(screen.getByText('Message sent.')).toBeInTheDocument();
    const methods = fetchMock.mock.calls.map(([, init]) => init?.method ?? 'GET');
    expect(methods).toEqual(['GET', 'POST', 'GET']);
  });

  it('aborts its request when the page goes away, and survives StrictMode', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { fetchMock, calls } = controlledFetch();
    vi.stubGlobal('fetch', fetchMock);
    const { unmount } = renderAt('/forum/nasa', (node) => <StrictMode>{node}</StrictMode>);
    expect(calls[calls.length - 1].signal.aborted).toBe(false);
    unmount();
    expect(calls.every((c) => c.signal.aborted)).toBe(true);
    expect(error).not.toHaveBeenCalled();
  });

  it('has the headings 2 and 3 only and no <div> or <span>', async () => {
    vi.stubGlobal('fetch', backend().fetchMock);
    const { container } = renderAt('/forum/nasa');
    await screen.findByText('Launch at dawn');
    expect(screen.getAllByRole('heading').map((h) => h.tagName)).toEqual(['H2', 'H3']);
    expect(container.querySelectorAll('div, span')).toHaveLength(0);
  });
});

describe('ForumPage known defects (audit; each passes while the defect exists)', () => {
  // Audit #09: for an address that is not a channel the page still offers the form, so a user can write a
  // message that the server can only refuse. Change `it.fails` to `it` once the form is hidden for an unknown channel.
  it.fails('does not offer the message form for a channel that does not exist (known defect)', async () => {
    vi.stubGlobal('fetch', backend().fetchMock);
    renderAt('/forum/nowhere');
    await screen.findByRole('alert');
    expect(screen.queryByRole('heading', { name: 'Post a message' })).toBeNull();
  });
});
