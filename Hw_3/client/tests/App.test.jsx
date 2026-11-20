// client/tests/App.test.jsx — the routes, the layout and the dossier pages against a fake API.
import { StrictMode } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App.jsx';
import { fakeApi } from './fakeApi.js';
import { jsonResponse } from './fetchMock.js';

let api;

function Where() {
  const { pathname } = useLocation();
  return <code data-testid="where">{pathname}</code>;
}

function setup(path = '/dossier', options, { strict = false } = {}) {
  api = fakeApi(options);
  vi.stubGlobal('fetch', api.fetchMock);
  const tree = (
    <MemoryRouter initialEntries={[path]}>
      <App />
      <Where />
    </MemoryRouter>
  );
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
}

afterEach(() => vi.unstubAllGlobals());

describe('routes', () => {
  it('redirects / to /dossier', async () => {
    setup('/');
    expect(screen.getByTestId('where')).toHaveTextContent('/dossier');
    expect(await screen.findByRole('heading', { level: 2, name: 'Choose a player' })).toBeInTheDocument();
  });

  it('/dossier shows the players and the matrix of all of them', async () => {
    setup('/dossier');
    await screen.findByRole('heading', { level: 2, name: 'Choose a player' });
    const nav = screen.getByRole('navigation', { name: 'Players' });
    expect(within(nav).getAllByRole('link').map((a) => a.textContent)).toEqual(['Himass', 'TanVuu']);
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(3); // header and two players
  });

  it('/dossier/:playerID shows that player, read from the URL', async () => {
    setup('/dossier/tanvuu');
    expect(await screen.findByRole('heading', { level: 2, name: 'TanVuu' })).toBeInTheDocument();
    expect(screen.getByText('Late to match')).toBeInTheDocument();
    expect(screen.queryByText('Chat: repeated spam')).toBeNull();
  });

  it('a link to a player changes the route and the page', async () => {
    const user = userEvent.setup();
    setup('/dossier/himass');
    await screen.findByRole('heading', { level: 2, name: 'Himass' });
    await user.click(screen.getByRole('link', { name: 'TanVuu' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/dossier/tanvuu');
    expect(await screen.findByRole('heading', { level: 2, name: 'TanVuu' })).toBeInTheDocument();
  });

  it('styles the link of the open player as the open one (the class, not only the attribute)', async () => {
    setup('/dossier/himass');
    await screen.findByRole('heading', { level: 2, name: 'Himass' });
    expect(screen.getByRole('link', { name: 'Himass' }).className).toMatch(/active/);
    expect(screen.getByRole('link', { name: 'TanVuu' }).className).not.toMatch(/active/);
  });

  it('marks the open player in the navigation with aria-current', async () => {
    setup('/dossier/himass');
    await screen.findByRole('heading', { level: 2, name: 'Himass' });
    expect(screen.getByRole('link', { name: 'Himass' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'TanVuu' })).not.toHaveAttribute('aria-current');
  });

  it.each(['nobody', 'HIMASS', 'himass%20', '__proto__', 'constructor'])('an unknown player "%s" is an alert with a way back, not a crash', async (id) => {
    setup(`/dossier/${id}`);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Player not found');
    expect(within(alert).getByRole('link', { name: 'Back to the dossiers' })).toHaveAttribute('href', '/dossier');
    expect(screen.getByRole('navigation', { name: 'Players' })).toBeInTheDocument(); // the layout is still there
  });

  it('an unknown address shows the alert with one h1', () => {
    setup('/no/such/page');
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(api.fetchMock).not.toHaveBeenCalled();
  });
});

describe('the dossier page', () => {
  it('shows the facts as a description list and the infractions as a table', async () => {
    setup('/dossier/himass');
    await screen.findByRole('heading', { level: 2, name: 'Himass' });
    const facts = screen.getByText('Matches played').closest('dl');
    expect(within(facts).getByText('120')).toBeInTheDocument();
    expect(within(facts).getByText('9')).toBeInTheDocument();
    const rows = within(screen.getAllByRole('table')[0]).getAllByRole('row');
    expect(rows).toHaveLength(3);
    expect(within(rows[1]).getByRole('rowheader')).toHaveTextContent('Suspected macro input');
    expect(within(rows[1]).getByText('4,320')).toBeInTheDocument();
  });

  it('shows the matrix with the open player marked, and the verdicts of the case study', async () => {
    setup('/dossier/himass');
    await screen.findByRole('heading', { level: 2, name: 'Himass' });
    const matrix = screen.getAllByRole('table')[1];
    const himass = within(matrix).getByRole('row', { name: /Himass/ });
    const tanvuu = within(matrix).getByRole('row', { name: /TanVuu/ });
    expect(himass).toHaveAttribute('aria-current', 'true');
    expect(tanvuu).not.toHaveAttribute('aria-current');
    expect(himass).toHaveTextContent('Harsher than the others');
    expect(tanvuu).toHaveTextContent('Lighter than the others');
    expect(within(himass).getByText('1.56')).toBeInTheDocument();
  });

  it('the scrollable matrix can be reached with the keyboard', async () => {
    setup('/dossier/himass');
    await screen.findByRole('heading', { level: 2, name: 'Himass' });
    expect(screen.getByRole('region', { name: /Disproportionality matrix/ })).toHaveAttribute('tabindex', '0');
  });

  it('has one main, one h1, and the countdown with a deadline', async () => {
    setup('/dossier/himass');
    await screen.findByRole('heading', { level: 2, name: 'Himass' });
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('timer')).toBeInTheDocument();
    expect(screen.getByText(/Closes/)).toBeInTheDocument();
  });
});

describe('loading and failure', () => {
  it('shows a busy status first', () => {
    setup('/dossier/himass');
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
  });

  it('shows the error of the server and loads again when asked', async () => {
    const user = userEvent.setup();
    api = fakeApi();
    let failing = true;
    api.state.override = (method, url) => (failing && url === '/api/dossiers' ? jsonResponse({ error: 'Database is down.' }, 500) : null);
    vi.stubGlobal('fetch', api.fetchMock);
    render(
      <MemoryRouter initialEntries={['/dossier/himass']}>
        <App />
      </MemoryRouter>
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Database is down.');
    failing = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Himass' })).toBeInTheDocument();
  });

  it('reports a network failure in words', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    render(
      <MemoryRouter initialEntries={['/dossier']}>
        <App />
      </MemoryRouter>
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('The server could not be reached.');
  });

  it('works under Strict Mode (the effects run twice)', async () => {
    setup('/dossier/himass', undefined, { strict: true });
    expect(await screen.findByRole('heading', { level: 2, name: 'Himass' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Synchronized with the tribunal clock.')).toBeInTheDocument());
  });
});

describe('the countdown on the page', () => {
  it('shows the time left for each player by that player\'s own deadline', async () => {
    const user = userEvent.setup();
    setup('/dossier/himass');
    await screen.findByText('Synchronized with the tribunal clock.');
    expect(screen.getByRole('timer')).toHaveTextContent(/^(2d 23:59:|3d 00:00:00)/); // 72 h, a moment ago
    await user.click(screen.getByRole('link', { name: 'TanVuu' }));
    await screen.findByRole('heading', { level: 2, name: 'TanVuu' });
    await waitFor(() => expect(screen.getByRole('timer')).toHaveTextContent(/^(1d 23:59:|2d 00:00:00)/)); // 48 h
  });

  it('says in words that the window is closed, and keeps the seconds out of the live region', async () => {
    setup('/dossier/himass', { hours: { himass: -1, tanvuu: 48 } });
    await screen.findByRole('heading', { level: 2, name: 'Himass' });
    await waitFor(() => expect(screen.getByRole('timer')).toHaveTextContent('00:00:00'));
    const status = screen.getAllByRole('status').find((s) => s.textContent === 'The appeal window is closed.');
    expect(status).toBeTruthy();
    expect(screen.getByRole('timer')).not.toHaveAttribute('aria-live', 'polite'); // role=timer is silent
  });

  it('the countdown does not re-render the matrix or the form every second', async () => {
    const rules = await import('../src/appeal/appealRules.js');
    const spy = vi.spyOn(rules, 'validateAppeal');
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      setup('/dossier/himass');
      for (let i = 0; i < 50 && !screen.queryByLabelText('Your name'); i++) await vi.advanceTimersByTimeAsync(10); // wait for the form
      expect(screen.getByLabelText('Your name')).toBeInTheDocument();
      await vi.advanceTimersByTimeAsync(100);
      const before = spy.mock.calls.length;
      expect(before).toBeGreaterThan(0);
      await vi.advanceTimersByTimeAsync(5000); // five ticks of the countdown
      expect(spy.mock.calls.length).toBe(before);
    } finally {
      vi.useRealTimers();
    }
  });
});
