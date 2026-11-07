// tests/GrandPiano.test.jsx
import { StrictMode } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PianoKey from '../src/components/PianoKey.jsx';
import GrandPiano from '../src/components/GrandPiano.jsx';
import { installFakeAudio } from './fakeAudio.js';

// The real synth, recorder and replay run here; only the browser audio and the clock are fake.
let audio;
const renders = {};
const innerRender = PianoKey.type;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] });
  audio = installFakeAudio();
  for (const midi of Object.keys(renders)) delete renders[midi];
  PianoKey.type = function PianoKey(props) {
    renders[props.midi] = (renders[props.midi] ?? 0) + 1;
    return innerRender(props);
  };
});

afterEach(() => {
  PianoKey.type = innerRender;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const key = (name) => screen.getByRole('button', { name });
const down = (name) => fireEvent.pointerDown(key(name), { button: 0, pointerId: 1 });
const up = (name) => fireEvent.pointerUp(key(name), { button: 0, pointerId: 1 });
const click = (name) => fireEvent.click(screen.getByRole('button', { name }));
const status = () => screen.getByRole('status');
const pressed = () =>
  within(screen.getByRole('region', { name: /Piano keyboard/ }))
    .getAllByRole('button')
    .filter((button) => button.getAttribute('aria-pressed') === 'true')
    .map((button) => button.textContent);
const advance = (ms) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
const hzOf = (oscillator) => Math.round(oscillator.playedHz * 10) / 10;

// Plays and records C4 (0-250 ms), E4 (100-400 ms) and G4 (300-500 ms), then stops the recording
async function recordTake() {
  click('Record');
  down('C4');
  await advance(100);
  down('E4');
  await advance(150);
  up('C4');
  await advance(50);
  down('G4');
  await advance(100);
  up('E4');
  await advance(100);
  up('G4');
  await advance(50);
  click('Stop');
}

describe('GrandPiano playing by hand', () => {
  it('starts with 88 keys, nothing pressed and no audio context', () => {
    render(<GrandPiano />);

    expect(screen.getByRole('region', { name: 'Play and record' })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: /Piano keyboard/ })).getAllByRole('button')).toHaveLength(88);
    expect(pressed()).toEqual([]);
    expect(audio.contexts).toHaveLength(0);
    expect(status()).toHaveTextContent('Ready.');
  });

  it('plays a note on key down and stops it on key up', () => {
    render(<GrandPiano />);

    down('A4');
    expect(pressed()).toEqual(['A4']);
    expect(audio.contexts).toHaveLength(1);
    const [oscillator] = audio.oscillators();
    expect(oscillator.playedHz).toBeCloseTo(440, 9);

    up('A4');
    expect(pressed()).toEqual([]);
    expect(oscillator.stop).toHaveBeenCalledTimes(1);
  });

  it('keeps the synth to 8 voices: the 9th note takes over the oldest', () => {
    render(<GrandPiano />);
    ['C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D4'].forEach(down);

    const oscillators = audio.oscillators();
    expect(oscillators).toHaveLength(9);
    expect(oscillators[0].stop).toHaveBeenCalledTimes(1); // C3, the first note played
    oscillators.slice(1).forEach((oscillator) => expect(oscillator.stop).not.toHaveBeenCalled());
  });

  // Audit #01: the key of the note whose voice was taken over keeps looking pressed, although its
  // sound has stopped, so the screen and the sound disagree. Change `it.fails` to `it` once the
  // component learns that a voice was taken over.
  it.fails('does not show a key as pressed when its voice was taken over (known defect)', () => {
    render(<GrandPiano />);
    ['C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D4'].forEach(down);

    expect(audio.oscillators()[0].stop).toHaveBeenCalledTimes(1); // C3's voice has stopped...
    expect(pressed()).not.toContain('C3'); // ...so C3 must not look pressed
  });
});

describe('GrandPiano recording and replay', () => {
  it('shows that it is recording when Record is pressed, and Stop ends it', () => {
    render(<GrandPiano />);

    click('Record');
    expect(status()).toHaveTextContent('Recording.');
    expect(screen.getByRole('button', { name: 'Record' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Stop' })).toBeEnabled();

    click('Stop');
    expect(status()).toHaveTextContent('Ready.'); // nothing was played, so nothing was recorded
    expect(screen.getByRole('button', { name: 'Play' })).toBeDisabled();
  });

  it('stores the notes with how long each was held and when it started, in start order', async () => {
    render(<GrandPiano />);
    await recordTake();

    expect(status()).toHaveTextContent('3 notes recorded.');
    expect(screen.getByRole('button', { name: 'Play' })).toBeEnabled();

    audio.oscillators().length = 0; // look only at the replay
    audio.contexts.forEach((context) => (context.oscillators.length = 0));
    click('Play');
    await advance(1000);

    expect(audio.oscillators().map(hzOf)).toEqual([261.6, 329.6, 392]); // C4, E4, G4 in the order they started
  });

  it('shows the keys pressed and released in time with the take (1x)', async () => {
    render(<GrandPiano />);
    await recordTake();

    click('Play');
    expect(status()).toHaveTextContent('Playing 3 notes at 1x.');
    await advance(0); // the first note starts as soon as the queue has run its first task
    expect(pressed()).toEqual(['C4']);

    await advance(100);
    expect(pressed()).toEqual(['C4', 'E4']);
    await advance(160); // 260 ms: C4 (held 250 ms) is over, E4 still sounding
    expect(pressed()).toEqual(['E4']);
    await advance(50); // 310 ms: G4 has started at 300
    expect(pressed()).toEqual(['E4', 'G4']);
    await advance(100); // 410 ms: E4 (100..400) is over
    expect(pressed()).toEqual(['G4']);
    await advance(200);

    expect(pressed()).toEqual([]);
    expect(screen.getByRole('button', { name: 'Record' })).toBeEnabled();
    expect(status()).toHaveTextContent('3 notes recorded.');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('replays twice as fast at 2x', async () => {
    render(<GrandPiano />);
    await recordTake();
    fireEvent.change(screen.getByRole('combobox', { name: 'Speed' }), { target: { value: '2' } });

    click('Play');
    await advance(160); // C4 is held 250 / 2 = 125 ms (over), E4 sounds 50..200, G4 sounds 150..250
    expect(pressed()).toEqual(['E4', 'G4']);
    await advance(400);
    expect(pressed()).toEqual([]);
  });

  it('stops a replay at once and leaves no key stuck', async () => {
    render(<GrandPiano />);
    await recordTake();
    audio.contexts.forEach((context) => (context.oscillators.length = 0));

    click('Play');
    await advance(180);
    expect(pressed()).toEqual(['C4', 'E4']);

    click('Stop');
    expect(pressed()).toEqual([]);
    expect(audio.oscillators().every((oscillator) => oscillator.stop.mock.calls.length > 0)).toBe(true);
    expect(screen.getByRole('button', { name: 'Record' })).toBeEnabled();

    await advance(2000);
    expect(pressed()).toEqual([]);
    expect(audio.oscillators()).toHaveLength(2); // G4 was never played
    expect(vi.getTimerCount()).toBe(0);
  });

  it('replaces the previous take with a new one, also when a key is still held at Stop', async () => {
    render(<GrandPiano />);
    await recordTake();

    click('Record');
    down('A4');
    await advance(200);
    click('Stop');
    expect(status()).toHaveTextContent('1 note recorded.');
    up('A4');
    expect(pressed()).toEqual([]);

    audio.contexts.forEach((context) => (context.oscillators.length = 0));
    click('Play');
    await advance(1000);
    expect(audio.oscillators().map(hzOf)).toEqual([440]);
  });

  it('does not record the notes of a replay', async () => {
    render(<GrandPiano />);
    await recordTake();
    click('Play');
    await advance(1000);

    expect(status()).toHaveTextContent('3 notes recorded.'); // still 3, not 6
  });

  it('cannot play when nothing is recorded', () => {
    render(<GrandPiano />);
    expect(screen.getByRole('button', { name: 'Play' })).toBeDisabled();
  });

  // Audit #04: Stop and the end of a replay clear every pressed key and call stopAll(), so a key the
  // user is holding by hand at that moment is silenced and looks released while the finger is still
  // down. Change `it.fails` to `it` once only the keys of the replay are released.
  it.fails('keeps a key that the user holds by hand when Stop is pressed (known defect)', async () => {
    render(<GrandPiano />);
    await recordTake();

    click('Play');
    await advance(10);
    down('A4'); // the user holds A4 while the replay runs
    click('Stop');

    expect(pressed()).toContain('A4');
  });
});

describe('GrandPiano cleanup', () => {
  it('closes the audio context and cancels a replay when it goes away', async () => {
    const { unmount } = render(<GrandPiano />);
    await recordTake();
    click('Play');
    await advance(120);

    unmount();

    expect(audio.contexts[0].close).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    await advance(2000); // nothing runs afterwards and nothing throws
  });

  it('survives React StrictMode', async () => {
    render(
      <StrictMode>
        <GrandPiano />
      </StrictMode>
    );

    down('A4');
    expect(pressed()).toEqual(['A4']);
    expect(audio.contexts).toHaveLength(1);
    up('A4');
  });

  it('does not throw when keys are released after it unmounted', () => {
    const { unmount } = render(<GrandPiano />);
    down('A4');
    const a4 = key('A4');
    unmount();

    expect(() => fireEvent.pointerUp(a4, { button: 0, pointerId: 1 })).not.toThrow();
  });
});

describe('GrandPiano render isolation', () => {
  it('re-renders only the key that is pressed, and only that key when it is released', () => {
    render(<GrandPiano />);
    for (const midi of Object.keys(renders)) delete renders[midi];

    down('C4');
    expect(Object.keys(renders)).toEqual(['60']);
    expect(renders[60]).toBe(1);

    up('C4');
    expect(Object.keys(renders)).toEqual(['60']);
    expect(renders[60]).toBe(2);
  });

  it('re-renders only the keys of the notes that a replay plays', async () => {
    render(<GrandPiano />);
    await recordTake();
    for (const midi of Object.keys(renders)) delete renders[midi];

    click('Play');
    // React batches everything that happens inside one act(), so advance the clock in small steps:
    // each key press and release then gets its own render, as it does in a browser
    await advance(0);
    for (let elapsed = 0; elapsed < 700; elapsed += 25) await advance(25);

    expect(Object.keys(renders).map(Number).sort((a, b) => a - b)).toEqual([60, 64, 67]);
    expect(Object.values(renders)).toEqual([2, 2, 2]); // pressed and released
  });
});
