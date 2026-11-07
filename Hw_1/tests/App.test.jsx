// tests/App.test.jsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from '../src/App.jsx';

vi.mock('../src/audio/drumKit.js', () => ({
  createDrumKit: () => ({ play: () => 0, dispose: () => {} }),
}));

describe('App', () => {
  it('renders the main landmark, then the page title, then the drum kit', () => {
    render(<App />);

    const main = screen.getByRole('main');
    const title = screen.getByRole('heading', { level: 1, name: 'Studio Drum Kit' });
    const kit = screen.getByRole('region', { name: 'Studio Drum Kit' });

    expect(main).toContainElement(title);
    expect(main).toContainElement(kit);
    expect(title.compareDocumentPosition(kit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('has exactly one main landmark and one h1', () => {
    render(<App />);

    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('keeps the heading levels in order (no level is skipped)', () => {
    render(<App />);

    const levels = screen.getAllByRole('heading').map((h) => Number(h.tagName[1]));
    for (let i = 1; i < levels.length; i += 1) {
      expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1);
    }
  });

  it('has no <div> or <span> in the rendered page', () => {
    const { container } = render(<App />);
    expect(container.querySelectorAll('div, span')).toHaveLength(0);
  });

  // Audit #05: the page <h1> and the kit's <h2> carry the same text, so a screen-reader user
  // hears the same heading twice in a row. Change `it.fails` to `it` once the headings differ.
  it.fails('has no two headings with the same text (known defect)', () => {
    render(<App />);

    const texts = screen.getAllByRole('heading').map((h) => h.textContent);
    expect(new Set(texts).size).toBe(texts.length);
  });
});
