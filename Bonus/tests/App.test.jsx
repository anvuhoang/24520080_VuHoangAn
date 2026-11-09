// tests/App.test.jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../src/App.jsx';

describe('App root component', () => {
  it('renders exactly one <main> and one <h1> landmark', () => {
    const { container } = render(<App />);
    const mains = container.querySelectorAll('main');
    const h1s = container.querySelectorAll('h1');

    expect(mains).toHaveLength(1);
    expect(h1s).toHaveLength(1);
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Lab 3 · Bonus — Situationship Analyzer'
    );
  });

  it('renders with zero <div> and zero <span> wrappers in entire tree', () => {
    const { container } = render(<App />);
    expect(container.querySelectorAll('div')).toHaveLength(0);
    expect(container.querySelectorAll('span')).toHaveLength(0);
  });

  it('displays the domain simulation disclaimer note', () => {
    render(<App />);
    expect(
      screen.getByText(/Mô phỏng ca khúc/i)
    ).toBeInTheDocument();
  });
});
