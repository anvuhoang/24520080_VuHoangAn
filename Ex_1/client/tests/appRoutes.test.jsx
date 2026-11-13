// client/tests/appRoutes.test.jsx — the routes of Sprints 2 and 3 and the main navigation
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App.jsx';
import { routedFetch } from './fetchMock.js';

afterEach(() => vi.unstubAllGlobals());

const stubApi = () =>
  vi.stubGlobal(
    'fetch',
    routedFetch(async () => [{ id: '1', author: 'Ada', text: 'Hello', timestamp: '2026-01-01T09:00:00.000Z' }])
  );
const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  );
const mainNav = () => within(screen.getByRole('navigation', { name: 'Main' }));
const currentMain = () =>
  mainNav()
    .getAllByRole('link')
    .filter((l) => l.getAttribute('aria-current') === 'page')
    .map((l) => l.textContent);

describe('main navigation', () => {
  it('links to the three sections', () => {
    renderAt('/people');
    expect(mainNav().getAllByRole('link').map((l) => [l.textContent, l.getAttribute('href')])).toEqual([
      ['People', '/people'],
      ['Form', '/form'],
      ['Forum', '/forum'],
    ]);
  });

  it('marks the section that is open, also for a nested address', async () => {
    stubApi();
    for (const [path, expected] of [['/people/ada', ['People']], ['/form', ['Form']], ['/forum/nasa', ['Forum']]]) {
      const { unmount } = renderAt(path);
      expect(currentMain()).toEqual(expected);
      unmount();
    }
  });

  it('styles the open section differently from the others', () => {
    renderAt('/form');
    const links = mainNav().getAllByRole('link');
    const open = links.find((l) => l.textContent === 'Form');
    expect(open.className).toMatch(/active/);
    for (const link of links.filter((l) => l !== open)) expect(link.className).not.toMatch(/active/);
  });

  it('stays on the page that matches nothing, with no section marked', () => {
    renderAt('/nowhere');
    expect(currentMain()).toEqual([]);
    expect(screen.getByRole('alert')).toHaveTextContent('Page not found');
  });

  it('moves between sections with the links', async () => {
    stubApi();
    const user = userEvent.setup();
    renderAt('/people');
    await user.click(mainNav().getByRole('link', { name: 'Form' }));
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Sign-up form');
    await user.click(mainNav().getByRole('link', { name: 'Forum' }));
    expect(await screen.findByText('Hello')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Forum channels');
  });
});

describe('sections', () => {
  it('opens the sign-up form on /form', () => {
    renderAt('/form');
    expect(screen.getByRole('region', { name: 'Sign-up form' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('redirects /forum to the first channel and loads it', async () => {
    stubApi();
    renderAt('/forum');
    expect(await screen.findByText('Hello')).toBeInTheDocument();
    const channels = within(screen.getByRole('navigation', { name: 'Forum channels' }));
    expect(channels.getAllByRole('link').filter((l) => l.getAttribute('aria-current') === 'page').map((l) => l.textContent)).toEqual(['NASA']);
  });

  it('keeps one main, one h1 and the headings in order on the forum page', async () => {
    stubApi();
    const { container } = renderAt('/forum/nasa');
    await screen.findByText('Hello');
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getAllByRole('heading').map((h) => Number(h.tagName[1]))).toEqual([1, 2, 3]);
    expect(container.querySelectorAll('div, span')).toHaveLength(0);
  });
});
