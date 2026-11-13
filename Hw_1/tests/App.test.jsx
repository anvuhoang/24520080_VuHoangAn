// tests/App.test.jsx — the route tree.
import { render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import App from '../src/App.jsx';

function Where() {
  const { pathname, search } = useLocation();
  return <code data-testid="where">{pathname + search}</code>;
}

const renderApp = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
      <Where />
    </MemoryRouter>
  );

describe('routes', () => {
  it('redirects / to /gallery', () => {
    renderApp('/');
    expect(screen.getByTestId('where')).toHaveTextContent('/gallery');
    expect(screen.getByRole('heading', { level: 1, name: 'Evidence Gallery' })).toBeInTheDocument();
  });

  it('keeps the query string on a deep link to /gallery', () => {
    renderApp('/gallery?category=chat&photoId=c2');
    expect(screen.getByTestId('where')).toHaveTextContent('/gallery?category=chat&photoId=c2');
    expect(screen.getByRole('dialog', { name: 'Lobby chat during the match' })).toBeInTheDocument();
  });

  it('shows an alert with one h1 and a way back for an unknown address', () => {
    renderApp('/nope/at/all');
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Back to the gallery' })).toHaveAttribute('href', '/gallery');
  });

  it('has one main landmark and one h1 on the gallery', () => {
    renderApp('/gallery');
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });
});
