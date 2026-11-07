// tests/LevelMeter.test.jsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import LevelMeter from '../src/components/LevelMeter.jsx';

const meter = () => screen.getByRole('meter', { name: 'Output level' });

describe('LevelMeter', () => {
  it('ties its label to the meter', () => {
    render(<LevelMeter level={0.5} />);

    const label = screen.getByText('Output level');
    expect(label.tagName).toBe('LABEL');
    expect(label.control).toBe(meter());
    expect(meter()).toHaveAttribute('min', '0');
    expect(meter()).toHaveAttribute('max', '100');
  });

  it.each([
    [0, 0],
    [0.5, 50],
    [0.123, 12],
    [0.126, 13],
    [1, 100],
  ])('treats %s as 0..1 and shows a whole-number percent (%s%%)', (level, percent) => {
    render(<LevelMeter level={level} />);

    expect(meter()).toHaveAttribute('value', String(percent));
    expect(screen.getByText(`${percent}%`, { selector: 'output' })).toBeInTheDocument();
  });

  it.each([
    [1.7, 100],
    [-0.4, 0],
  ])('clamps %s into the range (%s%%)', (level, percent) => {
    render(<LevelMeter level={level} />);
    expect(meter()).toHaveAttribute('value', String(percent));
  });

  it.each([[Number.NaN], [null], [undefined], ['0.5'], [Number.POSITIVE_INFINITY], [{}]])(
    'shows silence for an invalid level (%s) instead of breaking',
    (level) => {
      expect(() => render(<LevelMeter level={level} />)).not.toThrow();
      expect(meter()).toHaveAttribute('value', '0');
      expect(screen.getByText('0%', { selector: 'output' })).toBeInTheDocument();
    }
  );

  it('shows the same value as text next to the meter', () => {
    render(<LevelMeter level={0.9} />);
    expect(screen.getByText('90%', { selector: 'output' })).toHaveAttribute('for', meter().id);
  });

  // Audit #02: an <output> is a live region (role "status", polite). The meter changes about every
  // 90 ms after each hit, so a screen reader would read the percentage over and over.
  // Change `it.fails` to `it` once the percentage is no longer announced.
  it.fails('does not announce every level change to screen readers (known defect)', () => {
    render(<LevelMeter level={0.5} />);
    expect(screen.queryByRole('status')).toBeNull();
  });
});
