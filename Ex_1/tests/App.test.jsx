// tests/App.test.jsx
import { StrictMode } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import App from '../src/App.jsx';

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  );

describe('App routing', () => {
  it('redirects the root address to the directory and asks to choose a person', () => {
    renderAt('/');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Multi-route SPA');
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('No person selected');
    expect(screen.queryByRole('article')).toBeNull();
  });

  it('opens a person straight from a deep link, loading the detail view lazily', async () => {
    const { container } = renderAt('/people/ada');
    expect(await screen.findByRole('article', { name: 'Ada Lovelace' })).toBeInTheDocument();
    expect(container.querySelector('[aria-busy="true"]')).toBeNull(); // the skeleton is gone
    expect(screen.getByRole('link', { name: 'Ada Lovelace' })).toHaveAttribute('aria-current', 'page');
  });

  it('changes the dossier when another person is chosen, and keeps the list in place', async () => {
    const user = userEvent.setup();
    renderAt('/people/ada');
    await screen.findByRole('article', { name: 'Ada Lovelace' });
    await user.click(screen.getByRole('link', { name: 'Grace Hopper' }));
    expect(await screen.findByRole('article', { name: 'Grace Hopper' })).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'Ada Lovelace' })).toBeNull();
    const people = within(screen.getByRole('navigation', { name: 'People' }));
    const current = people.getAllByRole('link').filter((l) => l.getAttribute('aria-current') === 'page');
    expect(current.map((l) => l.textContent)).toEqual(['Grace Hopper']);
    expect(people.getAllByRole('link')).toHaveLength(5);
    expect(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'People' })).toHaveAttribute('aria-current', 'page');
  });

  it('shows the not-found alert inside the layout for an unknown person', async () => {
    renderAt('/people/nobody');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Person not found');
    expect(screen.getByRole('navigation', { name: 'People' })).toBeInTheDocument(); // the list is still there
  });

  it('shows a page-level not-found alert for an address that matches nothing', () => {
    renderAt('/nowhere/at/all');
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Page not found');
    expect(within(alert).getByRole('link', { name: 'Back to the directory' })).toHaveAttribute('href', '/people');
    expect(screen.queryByRole('navigation', { name: 'People' })).toBeNull(); // no people list on a page that matches nothing
  });

  it('goes back to the directory from the not-found alert', async () => {
    const user = userEvent.setup();
    renderAt('/nowhere');
    await user.click(screen.getByRole('link', { name: 'Back to the directory' }));
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('No person selected');
  });
});

describe('App markup', () => {
  it('has one main and one h1, headings in order, and no <div>, <span> or inline style', async () => {
    const { container } = renderAt('/people/grace');
    await screen.findByRole('article', { name: 'Grace Hopper' });
    expect(screen.getAllByRole('main')).toHaveLength(1);
    const levels = screen.getAllByRole('heading').map((h) => Number(h.tagName[1]));
    expect(levels).toEqual([1, 2]);
    expect(container.querySelectorAll('div, span')).toHaveLength(0);
    expect(container.querySelectorAll('[style]')).toHaveLength(0);
  });

  it('survives StrictMode with no console error', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <StrictMode>
        <MemoryRouter initialEntries={['/people/alan']}>
          <App />
        </MemoryRouter>
      </StrictMode>
    );
    await screen.findByRole('article', { name: 'Alan Turing' });
    expect(error).not.toHaveBeenCalled();
  });
});
