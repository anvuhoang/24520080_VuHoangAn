// tests/PersonDetail.test.jsx
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import PersonDetail from '../src/components/PersonDetail.jsx';
import { PEOPLE } from '../src/data/people.js';

const renderDetail = (path, people) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/people/:id" element={people ? <PersonDetail people={people} /> : <PersonDetail />} />
        <Route path="/people" element={<p>the list</p>} />
      </Routes>
    </MemoryRouter>
  );

describe('PersonDetail', () => {
  it('reads the id from the address (useParams) and shows that person in a description list', () => {
    const { container } = renderDetail('/people/katherine');
    const card = screen.getByRole('article', { name: 'Katherine Johnson' });
    expect(within(card).getByRole('heading', { level: 2 })).toHaveTextContent('Katherine Johnson');
    expect([...container.querySelectorAll('dt')].map((n) => n.textContent)).toEqual(['Role', 'Team', 'Active since']);
    expect([...container.querySelectorAll('dd')].map((n) => n.textContent)).toEqual(['Orbital mechanics', 'NASA', '1953']);
    expect(container.querySelectorAll('div, span')).toHaveLength(0);
  });

  it('works for every person of the sample data', () => {
    for (const person of PEOPLE) {
      const { unmount } = renderDetail(`/people/${person.id}`);
      expect(screen.getByRole('article', { name: person.name })).toBeInTheDocument();
      unmount();
    }
  });

  it('shows an explicit not-found alert for an unknown id, and does not throw', () => {
    renderDetail('/people/nobody');
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Person not found');
    expect(alert).toHaveTextContent('There is no dossier for "nobody".');
    expect(within(alert).getByRole('link', { name: 'Back to the list' })).toHaveAttribute('href', '/people');
    expect(screen.queryByRole('article')).toBeNull();
  });

  it('prints an id taken from the address as text, never as markup', () => {
    const { container } = renderDetail('/people/%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E');
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent('<img src=x onerror=alert(1)>');
  });

  it('uses the list it is given instead of the sample data', () => {
    const custom = [{ id: 'z9', name: 'Zed', role: 'Tester', team: 'QA', since: 2001 }];
    renderDetail('/people/z9', custom);
    expect(screen.getByRole('article', { name: 'Zed' })).toBeInTheDocument();
  });

  it('does not find a person of the sample data when a different list is given', () => {
    renderDetail('/people/ada', [{ id: 'z9', name: 'Zed', role: 'Tester', team: 'QA', since: 2001 }]);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
