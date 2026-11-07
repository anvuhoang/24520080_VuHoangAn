// tests/Transport.test.jsx
import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Transport from '../src/components/Transport.jsx';

const setup = (props = {}) => {
  const handlers = { onRecord: vi.fn(), onPlay: vi.fn(), onStop: vi.fn(), onSpeedChange: vi.fn() };
  render(<Transport {...handlers} {...props} />);
  return handlers;
};

const button = (name) => screen.getByRole('button', { name });
const status = () => screen.getByRole('status');

describe('Transport controls', () => {
  it('shows Record, Play, Stop and a labelled speed choice', () => {
    setup();

    expect(screen.getByRole('group', { name: 'Recorder' })).toBeInTheDocument();
    expect(button('Record')).toHaveAttribute('type', 'button');
    expect(button('Play')).toHaveAttribute('type', 'button');
    expect(button('Stop')).toHaveAttribute('type', 'button');
    const speed = screen.getByRole('combobox', { name: 'Speed' });
    expect([...speed.options].map((option) => option.textContent)).toEqual(['0.5x', '1x', '2x']);
    expect(speed).toHaveValue('1');
  });

  it('disables a control when it makes no sense', () => {
    const { rerender } = render(<Transport />);
    // nothing recorded: only Record works
    expect(button('Record')).toBeEnabled();
    expect(button('Play')).toBeDisabled();
    expect(button('Stop')).toBeDisabled();

    rerender(<Transport eventCount={3} />);
    expect(button('Play')).toBeEnabled();
    expect(button('Stop')).toBeDisabled();

    rerender(<Transport mode="recording" eventCount={3} />);
    expect(button('Record')).toBeDisabled();
    expect(button('Play')).toBeDisabled();
    expect(button('Stop')).toBeEnabled();
    expect(screen.getByRole('combobox')).toBeEnabled();

    rerender(<Transport mode="playing" eventCount={3} />);
    expect(button('Record')).toBeDisabled();
    expect(button('Play')).toBeDisabled();
    expect(button('Stop')).toBeEnabled();
    expect(screen.getByRole('combobox')).toBeDisabled(); // the speed is fixed when a replay starts
  });

  it('calls the matching callback for each button', async () => {
    const { onRecord, onPlay, onStop } = setup({ eventCount: 2 });
    await userEvent.click(button('Record'));
    expect(onRecord).toHaveBeenCalledTimes(1);
    await userEvent.click(button('Play'));
    expect(onPlay).toHaveBeenCalledTimes(1);
  });

  it('calls onStop from Stop while recording or playing', async () => {
    const onStop = vi.fn();
    render(<Transport mode="playing" eventCount={2} onStop={onStop} />);
    await userEvent.click(button('Stop'));
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('does nothing when a disabled button is clicked', async () => {
    const { onPlay, onStop } = setup();
    await userEvent.click(button('Play'));
    await userEvent.click(button('Stop'));
    expect(onPlay).not.toHaveBeenCalled();
    expect(onStop).not.toHaveBeenCalled();
  });

  it('sends the chosen speed as a number', async () => {
    const { onSpeedChange } = setup();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Speed' }), '2');
    expect(onSpeedChange).toHaveBeenCalledExactlyOnceWith(2);
  });

  it('shows the speed it is given, and 1x for a speed it does not offer', () => {
    const { rerender } = render(<Transport speed={0.5} />);
    expect(screen.getByRole('combobox')).toHaveValue('0.5');
    for (const speed of [3, '2', null, Number.NaN]) {
      rerender(<Transport speed={speed} />);
      expect(screen.getByRole('combobox')).toHaveValue('1');
    }
  });

  it('copes with an unknown mode and an unusual note count', () => {
    const { rerender } = render(<Transport mode="bogus" eventCount={2} />);
    expect(button('Play')).toBeEnabled(); // treated as idle
    for (const count of [-4, 2.5, Number.NaN, '3', null]) {
      rerender(<Transport eventCount={count} />);
      expect(button('Play')).toBeDisabled();
    }
  });

  it('does not throw without callbacks', async () => {
    render(<Transport eventCount={1} />);
    await expect(userEvent.click(button('Record'))).resolves.not.toThrow();
    await expect(userEvent.click(button('Play'))).resolves.not.toThrow();
  });
});

describe('Transport status message', () => {
  it('is a polite live region with a message for each situation', () => {
    const { rerender } = render(<Transport />);
    expect(status()).toHaveAttribute('aria-live', 'polite');
    expect(status()).toHaveTextContent('Ready. Press Record, then play some keys.');

    rerender(<Transport eventCount={1} />);
    expect(status()).toHaveTextContent('1 note recorded.');

    rerender(<Transport eventCount={3} />);
    expect(status()).toHaveTextContent('3 notes recorded.');

    rerender(<Transport mode="recording" eventCount={3} />);
    expect(status()).toHaveTextContent('Recording.');

    rerender(<Transport mode="playing" eventCount={3} speed={2} />);
    expect(status()).toHaveTextContent('Playing 3 notes at 2x.');
  });

  it('is not changed for every note played while recording, so it is not read out each time', () => {
    const { rerender } = render(<Transport mode="recording" eventCount={0} />);
    const text = status().textContent;
    const node = status().firstChild;

    for (let count = 1; count <= 20; count += 1) rerender(<Transport mode="recording" eventCount={count} />);

    expect(status().textContent).toBe(text);
    expect(status().firstChild).toBe(node); // the very same text node: nothing was announced
  });

  it('is the only live region of the component', () => {
    const { container } = render(<Transport eventCount={2} />);
    expect(container.querySelectorAll('[aria-live], output')).toHaveLength(1);
  });
});

describe('Transport structure', () => {
  it('labels every control and uses no <div> or <span>', () => {
    const { container } = render(<Transport eventCount={2} />);

    const controls = [...container.querySelectorAll('button, select')];
    expect(controls).toHaveLength(4);
    for (const control of controls) {
      const name = control.textContent.trim() || control.labels?.[0]?.textContent;
      expect(name).toBeTruthy();
    }
    expect(screen.getByText('Speed').control).toBe(screen.getByRole('combobox'));
    expect(container.querySelectorAll('div, span')).toHaveLength(0);
  });

  // Audit #02: when the focused Record button becomes disabled (recording starts), Chrome drops the
  // focus to <body> (measured in the browser); jsdom leaves it on the disabled button instead. Either
  // way the focus is no longer on a control the user can use. This test checks that.
  // Change `it.fails` to `it` once the focus moves to Stop (or stays on a usable control).
  it.fails('keeps the focus on a usable control when the focused button becomes disabled (known defect)', () => {
    function Probe() {
      const [mode, setMode] = useState('idle');
      return <Transport mode={mode} eventCount={0} onRecord={() => setMode('recording')} />;
    }
    render(<Probe />);
    button('Record').focus();
    expect(button('Record')).toHaveFocus();

    act(() => {
      fireEvent.click(button('Record'));
    });

    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).not.toBeDisabled();
  });
});
