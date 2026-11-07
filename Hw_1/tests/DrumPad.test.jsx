// tests/DrumPad.test.jsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import DrumPad from '../src/components/DrumPad.jsx';

const renderPad = (props) =>
  render(
    <ul>
      <DrumPad label="Snare" keyLabel="A" {...props} />
    </ul>
  );

describe('DrumPad', () => {
  it('renders a list item with a button that shows the key and the name', () => {
    renderPad();

    const item = screen.getByRole('listitem');
    const button = screen.getByRole('button');
    expect(item).toContainElement(button);
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveTextContent('A');
    expect(button).toHaveTextContent('Snare');
    expect(button.querySelector('kbd')).toHaveTextContent('A');
  });

  it('exposes the pressed state to assistive technology', () => {
    const { rerender } = renderPad({ isActive: false });
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');

    rerender(
      <ul>
        <DrumPad label="Snare" keyLabel="A" isActive />
      </ul>
    );
    expect(screen.getByRole('button', { pressed: true })).toBeInTheDocument();
  });

  it('triggers once on a mouse click', async () => {
    const onTrigger = vi.fn();
    renderPad({ onTrigger });

    await userEvent.click(screen.getByRole('button'));

    expect(onTrigger).toHaveBeenCalledTimes(1);
  });

  it('triggers once on Enter and once on Space when focused', async () => {
    const onTrigger = vi.fn();
    const user = userEvent.setup();
    renderPad({ onTrigger });

    await user.tab();
    expect(screen.getByRole('button')).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(onTrigger).toHaveBeenCalledTimes(1);

    await user.keyboard(' ');
    expect(onTrigger).toHaveBeenCalledTimes(2);
  });

  it('uses its defaults when no props are given', () => {
    render(
      <ul>
        <DrumPad />
      </ul>
    );

    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('Pad');
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button.querySelector('kbd')).toBeEmptyDOMElement();
  });

  it('does not throw when it is clicked without a handler', async () => {
    renderPad();
    await expect(userEvent.click(screen.getByRole('button'))).resolves.not.toThrow();
  });

  it('has no explicit aria-label: the visible text is the accessible name', () => {
    renderPad();
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-label');
  });

  // Audit #03: <kbd> and <strong> sit next to each other with no text between them, so the
  // accessible name is "ASnare". Change `it.fails` to `it` once the key and the name are separated.
  it.fails('has an accessible name that separates the key from the name (known defect)', () => {
    renderPad();
    expect(screen.getByRole('button', { name: 'A Snare' })).toBeInTheDocument();
  });
});
