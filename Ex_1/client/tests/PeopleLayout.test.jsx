// client/tests/PeopleLayout.test.jsx
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import PeopleLayout from '../src/sprint1-router/PeopleLayout.jsx';
import { PEOPLE } from '../src/sprint1-router/people.js';

const renderLayout = (path = '/people', props = {}) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/people" element={<PeopleLayout {...props} />}>
          <Route index element={<p>index content</p>} />
          <Route path=":id" element={<p>detail content</p>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );

describe('PeopleLayout', () => {
  it('lists every person as a link to its own address, in order', () => {
    renderLayout();
    const nav = screen.getByRole('navigation', { name: 'People' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(PEOPLE.map((p) => p.name));
    expect(links.map((link) => link.getAttribute('href'))).toEqual(PEOPLE.map((p) => `/people/${p.id}`));
    expect(within(nav).getAllByRole('listitem')).toHaveLength(PEOPLE.length);
  });

  it('marks only the open person as the current page (NavLink isActive callback)', () => {
    renderLayout('/people/grace');
    const current = screen.getAllByRole('link').filter((link) => link.getAttribute('aria-current') === 'page');
    expect(current.map((link) => link.textContent)).toEqual(['Grace Hopper']);
  });

  it('styles the open person differently from the others (the className callback of NavLink)', () => {
    renderLayout('/people/grace');
    const links = screen.getAllByRole('link');
    const open = links.find((l) => l.textContent === 'Grace Hopper');
    expect(open.className).toMatch(/active/);
    for (const link of links.filter((l) => l !== open)) expect(link.className).not.toMatch(/active/);
  });

  it('marks nobody as current on the index route', () => {
    renderLayout('/people');
    expect(screen.getAllByRole('link').filter((link) => link.hasAttribute('aria-current'))).toHaveLength(0);
  });

  it('renders the child route inside the Outlet', () => {
    renderLayout('/people/ada');
    expect(within(screen.getByRole('region', { name: 'Dossier' })).getByText('detail content')).toBeInTheDocument();
    expect(screen.queryByText('index content')).toBeNull();
  });

  it('uses the people it is given, and copes with an empty list', () => {
    const { unmount } = renderLayout('/people', { people: [{ id: 'x', name: 'Xena' }] });
    expect(screen.getAllByRole('link').map((l) => l.textContent)).toEqual(['Xena']);
    unmount();
    renderLayout('/people', { people: [] });
    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.getByRole('navigation', { name: 'People' })).toBeInTheDocument();
  });

  it('gives every item a stable key (no React warning) and has no <div> or <span>', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = renderLayout();
    expect(error).not.toHaveBeenCalled();
    expect(container.querySelectorAll('div, span')).toHaveLength(0);
    expect(container.querySelectorAll('[style]')).toHaveLength(0);
  });
});
