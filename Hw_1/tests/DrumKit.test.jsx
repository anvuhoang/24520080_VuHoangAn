// tests/DrumKit.test.jsx
import { StrictMode } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDrumKit } from '../src/audio/drumKit.js';
import DrumKit from '../src/components/DrumKit.jsx';

vi.mock('../src/audio/drumKit.js', () => ({ createDrumKit: vi.fn() }));

let kits;

beforeEach(() => {
  kits = [];
  createDrumKit.mockImplementation(() => {
    const kit = { play: vi.fn(() => 0.75), dispose: vi.fn() };
    kits.push(kit);
    return kit;
  });
});

afterEach(() => {
  vi.useRealTimers();
});

const keyDown = (code, target = window) => fireEvent.keyDown(target, { code });
const keyUp = (code, target = window) => fireEvent.keyUp(target, { code });
const pad = (name) => screen.getByRole('button', { name: new RegExp(name) });
const meterValue = () => Number(screen.getByRole('meter').getAttribute('value'));
const lastKit = () => kits.at(-1);
const advance = (ms) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe('DrumKit structure', () => {
  it('renders the settings, the 7 pads, the meter and the log', () => {
    render(<DrumKit />);

    expect(screen.getByRole('heading', { level: 2, name: 'Studio Drum Kit' })).toBeInTheDocument();
    const settings = screen.getByRole('group', { name: 'Settings' });
    expect(within(settings).getByRole('checkbox', { name: /Enable keyboard shortcuts/ })).toBeChecked();
    expect(within(settings).getByRole('textbox', { name: 'Session name' })).toHaveValue('');

    const pads = screen.getByRole('list', { name: 'Drum pads' });
    expect(within(pads).getAllByRole('button')).toHaveLength(7);
    expect(screen.getByRole('meter', { name: 'Output level' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hit log' })).toBeInTheDocument();
  });

  it('labels both controls so a click on the label reaches the control', async () => {
    render(<DrumKit />);

    await userEvent.click(screen.getByText('Session name'));
    expect(screen.getByRole('textbox', { name: 'Session name' })).toHaveFocus();

    const checkbox = screen.getByRole('checkbox');
    await userEvent.click(screen.getByText(/Enable keyboard shortcuts/));
    expect(checkbox).not.toBeChecked();
  });
});

describe('DrumKit keyboard', () => {
  it('plays a pad on key down and shows it pressed only while the key is held', () => {
    render(<DrumKit />);
    expect(pad('Snare')).toHaveAttribute('aria-pressed', 'false');

    keyDown('KeyA');
    expect(lastKit().play).toHaveBeenCalledExactlyOnceWith('snare');
    expect(pad('Snare')).toHaveAttribute('aria-pressed', 'true');

    keyUp('KeyA');
    expect(pad('Snare')).toHaveAttribute('aria-pressed', 'false');
  });

  it('maps every key to its own pad', () => {
    render(<DrumKit />);
    const expected = {
      KeyW: 'tomHigh', KeyA: 'snare', KeyS: 'kick', KeyD: 'hatClosed',
      KeyJ: 'tomLow', KeyK: 'hatOpen', KeyL: 'crash',
    };

    for (const [code, id] of Object.entries(expected)) {
      keyDown(code);
      expect(lastKit().play).toHaveBeenLastCalledWith(id);
      keyUp(code);
    }
    expect(lastKit().play).toHaveBeenCalledTimes(7);
  });

  it('plays once for a held key (auto-repeat is ignored)', () => {
    render(<DrumKit />);

    keyDown('KeyA');
    fireEvent.keyDown(window, { code: 'KeyA', repeat: true });
    fireEvent.keyDown(window, { code: 'KeyA', repeat: true });

    expect(lastKit().play).toHaveBeenCalledTimes(1);
  });

  it('plays nothing while typing in the session-name field', async () => {
    const user = userEvent.setup();
    render(<DrumKit />);

    await user.click(screen.getByRole('textbox', { name: 'Session name' }));
    await user.keyboard('wasd jkl');

    expect(screen.getByRole('textbox', { name: 'Session name' })).toHaveValue('wasd jkl');
    expect(lastKit().play).not.toHaveBeenCalled();
    expect(screen.getByText('No hits yet. Press W A S D J K L.')).toBeInTheDocument();
  });
});

describe('DrumKit mouse and keyboard activation', () => {
  it('plays and shows the pad pressed briefly on a click', () => {
    vi.useFakeTimers();
    render(<DrumKit />);

    fireEvent.click(pad('Kick'));
    expect(lastKit().play).toHaveBeenCalledExactlyOnceWith('kick');
    expect(pad('Kick')).toHaveAttribute('aria-pressed', 'true');

    advance(149);
    expect(pad('Kick')).toHaveAttribute('aria-pressed', 'true');
    advance(2);
    expect(pad('Kick')).toHaveAttribute('aria-pressed', 'false');
  });

  it('plays once on Enter and once on Space', async () => {
    const user = userEvent.setup();
    render(<DrumKit />);

    pad('Snare').focus();
    await user.keyboard('{Enter}');
    expect(lastKit().play).toHaveBeenCalledTimes(1);
    await user.keyboard(' ');
    expect(lastKit().play).toHaveBeenCalledTimes(2);
    expect(lastKit().play).toHaveBeenLastCalledWith('snare');
  });

  it('restarts the pressed flash when the same pad is hit again', () => {
    vi.useFakeTimers();
    render(<DrumKit />);

    fireEvent.click(pad('Kick'));
    advance(100);
    fireEvent.click(pad('Kick'));
    advance(100); // 200 ms after the first click, but only 100 ms after the second
    expect(pad('Kick')).toHaveAttribute('aria-pressed', 'true');
    advance(60);
    expect(pad('Kick')).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('DrumKit meter and log', () => {
  it('raises the meter on a hit and lets it fall back to silence by itself', () => {
    vi.useFakeTimers();
    render(<DrumKit />);
    expect(meterValue()).toBe(0);

    keyDown('KeyA');
    expect(meterValue()).toBe(75);

    advance(90);
    expect(meterValue()).toBeLessThan(75);

    // The decay schedules its next step from an effect, which React only runs after each `act`,
    // so the clock has to be advanced one step per act (a single 2000 ms jump would do one step).
    for (let step = 0; step < 30; step += 1) advance(90);
    expect(meterValue()).toBe(0);
    expect(vi.getTimerCount()).toBe(0); // nothing keeps running once it is silent
  });

  it('adds every hit to the log, newest first, and keeps showing only the latest 8', () => {
    render(<DrumKit />);

    keyDown('KeyA');
    expect(screen.getByText('Last hit: Snare')).toBeInTheDocument();

    for (let i = 0; i < 59; i += 1) keyDown('KeyD');
    expect(screen.getByText('Last hit: Hi-hat closed')).toBeInTheDocument();
    const history = screen.getByRole('list', { name: /Recent hits/ });
    expect(within(history).getAllByRole('listitem')).toHaveLength(8);
  });
});

describe('DrumKit shortcut toggle (WCAG 2.1.4)', () => {
  it('turns off only the keyboard: the mouse and Enter still play', async () => {
    const user = userEvent.setup();
    render(<DrumKit />);
    await user.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('checkbox')).not.toBeChecked();

    keyDown('KeyW');
    expect(lastKit().play).not.toHaveBeenCalled();

    await user.click(pad('Tom high'));
    expect(lastKit().play).toHaveBeenCalledExactlyOnceWith('tomHigh');
  });

  it('works again after the checkbox is ticked and focus has moved away', async () => {
    const user = userEvent.setup();
    render(<DrumKit />);
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('checkbox'));
    screen.getByRole('checkbox').blur();

    keyDown('KeyW');

    expect(lastKit().play).toHaveBeenCalledExactlyOnceWith('tomHigh');
  });

  it('releases a pad that is held when the shortcuts are switched off (no stuck pad)', () => {
    render(<DrumKit />);

    keyDown('KeyS');
    expect(pad('Kick')).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('checkbox'));
    expect(pad('Kick')).toHaveAttribute('aria-pressed', 'false');
  });

  // Audit #01 at the level of the whole kit: after the user toggles the checkbox, focus stays on it
  // and the pad keys stop working. Change `it.fails` to `it` once the hook ignores only text fields.
  it.fails('plays a pad while the checkbox has focus (known defect)', async () => {
    const user = userEvent.setup();
    render(<DrumKit />);
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('checkbox')); // shortcuts on again, focus still on the checkbox

    keyDown('KeyW', screen.getByRole('checkbox'));

    expect(lastKit().play).toHaveBeenCalledWith('tomHigh');
  });
});

describe('DrumKit lifecycle', () => {
  it('releases the audio kit and every timer when it goes away', () => {
    vi.useFakeTimers();
    const { unmount } = render(<DrumKit />);
    fireEvent.click(pad('Kick')); // starts a flash timer and the meter decay timer
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    unmount();

    expect(lastKit().dispose).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stops listening to the keyboard after it unmounts', () => {
    const { unmount } = render(<DrumKit />);
    const kit = lastKit();

    unmount();
    keyDown('KeyA');

    expect(kit.play).not.toHaveBeenCalled();
  });

  it('survives React StrictMode: the first kit is released and the second one plays', () => {
    render(
      <StrictMode>
        <DrumKit />
      </StrictMode>
    );

    expect(kits).toHaveLength(2);
    expect(kits[0].dispose).toHaveBeenCalledTimes(1);
    expect(kits[1].dispose).not.toHaveBeenCalled();

    keyDown('KeyA');
    expect(kits[1].play).toHaveBeenCalledExactlyOnceWith('snare');
    expect(kits[0].play).not.toHaveBeenCalled();
  });
});
