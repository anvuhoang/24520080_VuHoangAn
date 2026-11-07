// tests/App.test.jsx
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../src/App.jsx';

describe('App', () => {
  it('renders the main landmark, then the page title, then the piano', () => {
    render(<App />);

    const main = screen.getByRole('main');
    const title = screen.getByRole('heading', { level: 1 });
    const piano = screen.getByRole('region', { name: 'Play and record' });

    expect(main).toContainElement(title);
    expect(main).toContainElement(piano);
    expect(title.compareDocumentPosition(piano) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(main.firstElementChild).toBe(title);
  });

  it('has exactly one main landmark and one h1', () => {
    render(<App />);

    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('gives the h1 a text that no heading inside the piano has', () => {
    render(<App />);

    const title = screen.getByRole('heading', { level: 1 });
    const piano = screen.getByRole('region', { name: 'Play and record' });
    const inner = within(piano).getAllByRole('heading').map((heading) => heading.textContent);

    expect(title).toHaveTextContent('Grand Piano 88');
    expect(inner.length).toBeGreaterThan(0);
    expect(inner).not.toContain(title.textContent);
  });

  it('keeps the heading levels in order (no level is skipped)', () => {
    render(<App />);

    const levels = screen.getAllByRole('heading').map((heading) => Number(heading.tagName[1]));
    expect(levels[0]).toBe(1);
    for (let i = 1; i < levels.length; i += 1) expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1);
  });

  it('shows the 88 keys and the recorder controls', () => {
    render(<App />);

    const keyboard = screen.getByRole('region', { name: /Piano keyboard/ });
    expect(within(keyboard).getAllByRole('button')).toHaveLength(88);
    expect(screen.getByRole('group', { name: 'Recorder' })).toBeInTheDocument();
  });

  it('has no <div> or <span> in the rendered page', () => {
    const { container } = render(<App />);
    expect(container.querySelectorAll('div, span')).toHaveLength(0);
  });

  it('has no inline styles and no <img>', () => {
    const { container } = render(<App />);
    expect(container.querySelectorAll('[style]')).toHaveLength(0);
    expect(container.querySelectorAll('img')).toHaveLength(0);
  });
});
