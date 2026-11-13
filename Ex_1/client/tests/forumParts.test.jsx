// client/tests/forumParts.test.jsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ChannelSwitcher from '../src/sprint3-forum/ChannelSwitcher.jsx';
import MessageForm from '../src/sprint3-forum/MessageForm.jsx';
import MessageList from '../src/sprint3-forum/MessageList.jsx';
import { abortError, controlledFetch } from './fetchMock.js';

afterEach(() => vi.unstubAllGlobals());

describe('ChannelSwitcher', () => {
  const renderAt = (path, props = {}) =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <ChannelSwitcher {...props} />
      </MemoryRouter>
    );

  it('links to the three channels and marks the open one as the current page', () => {
    renderAt('/forum/esports-tribunal');
    const nav = screen.getByRole('navigation', { name: 'Forum channels' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(['NASA', 'Esports Tribunal', 'Not NASA']);
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['/forum/nasa', '/forum/esports-tribunal', '/forum/notNasa']);
    expect(links.filter((l) => l.getAttribute('aria-current') === 'page').map((l) => l.textContent)).toEqual(['Esports Tribunal']);
  });

  it('styles the open channel differently from the others', () => {
    renderAt('/forum/notNasa');
    const links = screen.getAllByRole('link');
    const open = links.find((l) => l.textContent === 'Not NASA');
    expect(open.className).toMatch(/active/);
    for (const link of links.filter((l) => l !== open)) expect(link.className).not.toMatch(/active/);
  });

  it('marks nothing as current for an address outside the forum, and takes other channels', () => {
    const { unmount } = renderAt('/people');
    expect(screen.getAllByRole('link').some((l) => l.hasAttribute('aria-current'))).toBe(false);
    unmount();
    renderAt('/forum/x', { channels: [{ id: 'x', label: 'Only one' }] });
    expect(screen.getAllByRole('link').map((l) => l.textContent)).toEqual(['Only one']);
  });

  it('has no <div> or <span>, and a key for every item', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = renderAt('/forum/nasa');
    expect(container.querySelectorAll('div, span')).toHaveLength(0);
    expect(error).not.toHaveBeenCalled();
  });
});

describe('MessageList', () => {
  const messages = [
    { id: 'a', author: 'Ada', text: 'First', timestamp: '2026-01-01T09:00:00.000Z' },
    { id: 'b', author: 'Grace', text: 'Second', timestamp: '2026-01-01T09:05:00.000Z' },
  ];

  it('shows a busy, polite loading message while it waits and nothing is known yet', () => {
    render(<MessageList status="loading" />);
    const region = screen.getByRole('region', { name: 'Loading messages' });
    expect(region).toHaveAttribute('aria-busy', 'true');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveTextContent('Loading messages…');
  });

  it('shows an alert with the error and a "Try again" button that calls onRetry', async () => {
    const onRetry = vi.fn();
    render(<MessageList status="error" error="Unknown forum: x" onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Unknown forum: x');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Try again' })).toHaveAttribute('type', 'button');
  });

  it('has a default error message', () => {
    render(<MessageList status="error" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong.');
  });

  it('says so when a channel has no message', () => {
    render(<MessageList status="success" messages={[]} />);
    expect(screen.getByText('No messages in this channel yet.')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Messages' })).toHaveAttribute('aria-busy', 'false');
  });

  it('lists author, text and time of each message in a description list', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = render(<MessageList status="success" messages={messages} />);
    expect([...container.querySelectorAll('dt')].map((n) => n.textContent)).toEqual(['Ada', 'Grace']);
    const times = [...container.querySelectorAll('time')];
    expect(times.map((t) => t.getAttribute('datetime'))).toEqual(['2026-01-01T09:00:00.000Z', '2026-01-01T09:05:00.000Z']);
    expect(times.map((t) => t.textContent)).toEqual(['1 Jan 2026, 09:00', '1 Jan 2026, 09:05']);
    expect(container.querySelectorAll('dd')).toHaveLength(4);
    expect(container.querySelectorAll('div, span')).toHaveLength(0);
    expect(error).not.toHaveBeenCalled(); // Fragment keys
  });

  it('keeps the list on screen while it refreshes (busy, but not replaced by the loading message)', () => {
    render(<MessageList status="loading" messages={messages} />);
    expect(screen.getByRole('region', { name: 'Messages' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.queryByText('Loading messages…')).toBeNull();
  });

  it('prints message text as text, never as markup, and copes with a bad timestamp', () => {
    const bad = [{ id: 'x', author: '<b>Eve</b>', text: '<img src=x onerror=alert(1)>', timestamp: 'not a date' }];
    const { container } = render(<MessageList status="success" messages={bad} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
    expect(container).toHaveTextContent('<img src=x onerror=alert(1)>');
    expect(container.querySelector('time').textContent).toBe('');
  });
});

describe('MessageForm', () => {
  const fill = async (user, author = 'Ada', text = 'Hello') => {
    if (author) await user.type(screen.getByLabelText('Author'), author);
    if (text) await user.type(screen.getByLabelText('Message'), text);
  };

  it('has two labelled fields and a submit button under a heading', () => {
    const { container } = render(<MessageForm forum="nasa" />);
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Post a message');
    expect(screen.getByLabelText('Author').id).not.toBe(screen.getByLabelText('Message').id);
    expect(screen.getByRole('button', { name: 'Send' })).toHaveAttribute('type', 'submit');
    expect(container.querySelectorAll('div, span')).toHaveLength(0);
  });

  it('shows no error while typing, and both errors after an empty submit, without calling the server', async () => {
    const { fetchMock } = controlledFetch();
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<MessageForm forum="nasa" />);
    expect(screen.queryByRole('alert')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Send' }));
    const alerts = screen.getAllByRole('alert').map((a) => a.textContent);
    expect(alerts).toEqual(['Author is required.', 'Message text is required.']);
    expect(screen.getByLabelText('Author')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Author')).toHaveAttribute('aria-describedby', screen.getAllByRole('alert')[0].id);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('applies the same limits as the server (author 40, message 280)', async () => {
    const { fetchMock } = controlledFetch();
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<MessageForm forum="nasa" />);
    await user.type(screen.getByLabelText('Author'), 'a'.repeat(41));
    await user.click(screen.getByLabelText('Message'));
    await user.paste('b'.repeat(281));
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(screen.getAllByRole('alert').map((a) => a.textContent)).toEqual([
      'Author must have at most 40 characters.',
      'Message must have at most 280 characters.',
    ]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts JSON to the forum with a signal, then clears the message, keeps the author and tells the parent', async () => {
    const { fetchMock, calls } = controlledFetch();
    vi.stubGlobal('fetch', fetchMock);
    const onPosted = vi.fn();
    const user = userEvent.setup();
    render(<MessageForm forum="esports-tribunal" onPosted={onPosted} />);
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(calls[0].url).toBe('/api/messages/esports-tribunal');
    expect(calls[0].init.method).toBe('POST');
    expect(calls[0].init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(calls[0].init.body)).toEqual({ author: 'Ada', text: 'Hello' });
    expect(calls[0].signal).toBeInstanceOf(AbortSignal);
    calls[0].resolve({ id: '1' }, 201);
    expect(await screen.findByText('Message sent.')).toBeInTheDocument();
    expect(screen.getByLabelText('Message')).toHaveValue('');
    expect(screen.getByLabelText('Author')).toHaveValue('Ada');
    expect(onPosted).toHaveBeenCalledTimes(1);
  });

  it('while sending: says so, ignores a second submit and keeps the keyboard focus on the button', async () => {
    const { fetchMock, calls } = controlledFetch();
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<MessageForm forum="nasa" />);
    await fill(user);
    const button = screen.getByRole('button', { name: 'Send' });
    button.focus();
    await user.keyboard('{Enter}');
    expect(button).toHaveTextContent('Sending…');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent('Sending…');
    await user.keyboard('{Enter}');
    await user.click(button);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    calls[0].resolve({ id: '1' }, 201);
    await screen.findByText('Message sent.');
    expect(button).toHaveAttribute('aria-disabled', 'false');
    expect(button).toHaveFocus();
  });

  it('shows the server message for a refused post and lets the user try again; the parent is not told', async () => {
    const { fetchMock, calls } = controlledFetch();
    vi.stubGlobal('fetch', fetchMock);
    const onPosted = vi.fn();
    const user = userEvent.setup();
    render(<MessageForm forum="nasa" onPosted={onPosted} />);
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Send' }));
    calls[0].resolve({ error: 'Invalid message' }, 400);
    expect(await screen.findByText('Invalid message')).toBeInTheDocument();
    expect(onPosted).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Message')).toHaveValue('Hello'); // the text is kept
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('shows a network failure, and an AbortError that did not come from this form is a failure too', async () => {
    const { fetchMock, calls } = controlledFetch();
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<MessageForm forum="nasa" />);
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Send' }));
    calls[0].reject(new TypeError('Failed to fetch'));
    expect(await screen.findByText('Failed to fetch')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Send' }));
    calls[1].reject(abortError());
    expect(await screen.findByText('The operation was aborted.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toHaveAttribute('aria-disabled', 'false'); // not stuck on "Sending…"
  });

  it('aborts the request when the form goes away and changes nothing afterwards', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { fetchMock, calls } = controlledFetch();
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    const { unmount } = render(<MessageForm forum="nasa" />);
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Send' }));
    unmount();
    expect(calls[0].signal.aborted).toBe(true);
    expect(error).not.toHaveBeenCalled();
  });
});
