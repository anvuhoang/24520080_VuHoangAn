// tests/Piano.test.jsx
import { useState } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PianoKey from '../src/components/PianoKey.jsx';
import Piano from '../src/components/Piano.jsx';

// Count how often each key's own render function runs: wrap it before the first render
const renders = {};
const innerRender = PianoKey.type;

beforeEach(() => {
  for (const midi of Object.keys(renders)) delete renders[midi];
  PianoKey.type = function PianoKey(props) {
    renders[props.midi] = (renders[props.midi] ?? 0) + 1;
    return innerRender(props);
  };
});

afterEach(() => {
  PianoKey.type = innerRender;
});

const keyButtons = () => within(screen.getByRole('region', { name: /Piano keyboard/ })).getAllByRole('button');
const total = () => Object.values(renders).reduce((sum, count) => sum + count, 0);
const rendered = () => Object.keys(renders).map(Number).sort((a, b) => a - b);

describe('Piano keys', () => {
  it('renders the 88 keys, A0 to C8, from the generated data', () => {
    render(<Piano />);

    const names = keyButtons().map((button) => button.textContent);
    expect(names).toHaveLength(88);
    expect(names[0]).toBe('A0');
    expect(names.at(-1)).toBe('C8');
    expect(new Set(names).size).toBe(88);
  });

  it('has 52 white keys and 36 black keys', () => {
    render(<Piano />);

    const names = keyButtons().map((button) => button.textContent);
    expect(names.filter((name) => name.includes('#'))).toHaveLength(36);
    expect(names.filter((name) => !name.includes('#'))).toHaveLength(52);
  });

  it('puts every black key in the cell of the white key before it, in 52 cells', () => {
    render(<Piano />);

    const cells = screen.getAllByRole('listitem');
    expect(cells).toHaveLength(52);
    for (const cell of cells) {
      const buttons = within(cell).getAllByRole('button');
      expect([1, 2]).toContain(buttons.length);
      expect(buttons[0].textContent).not.toContain('#'); // the first key of a cell is white
      if (buttons.length === 2) expect(buttons[1].textContent).toContain('#');
    }
    expect(within(cells[0]).getAllByRole('button').map((b) => b.textContent)).toEqual(['A0', 'A#0']);
    expect(within(cells[1]).getAllByRole('button').map((b) => b.textContent)).toEqual(['B0']);
  });

  it('uses no inline styles to place the keys', () => {
    const { container } = render(<Piano />);
    expect(container.querySelectorAll('[style]')).toHaveLength(0);
  });

  it('shows the pressed notes it is given, and only those', () => {
    render(<Piano pressedNotes={new Set([60, 61])} />);

    const pressed = keyButtons().filter((button) => button.getAttribute('aria-pressed') === 'true');
    expect(pressed.map((button) => button.textContent)).toEqual(['C4', 'C#4']);
  });

  it('works without pressed notes or callbacks', () => {
    expect(() => render(<Piano />)).not.toThrow();
    expect(keyButtons().every((button) => button.getAttribute('aria-pressed') === 'false')).toBe(true);
  });

  it('passes the callbacks to the keys', () => {
    const onNoteOn = vi.fn();
    const onNoteOff = vi.fn();
    render(<Piano onNoteOn={onNoteOn} onNoteOff={onNoteOff} />);

    const c4 = screen.getByRole('button', { name: 'C4' });
    fireEvent.pointerDown(c4, { button: 0, pointerId: 1 });
    fireEvent.pointerUp(c4, { button: 0, pointerId: 1 });

    expect(onNoteOn).toHaveBeenCalledExactlyOnceWith(60);
    expect(onNoteOff).toHaveBeenCalledExactlyOnceWith(60);
  });
});

describe('Piano scroll region', () => {
  it('is a labelled region that can be reached with the keyboard', () => {
    render(<Piano />);

    const region = screen.getByRole('region', { name: 'Piano keyboard, 88 keys' });
    expect(region).toHaveAttribute('tabindex', '0');
    expect(region.tagName).toBe('SECTION');
  });

  // Audit #03: all 88 keys are tab stops (plus the region), so a keyboard user must press Tab 88
  // times to get past the keyboard. A roving tabindex would leave one tab stop for the whole keyboard.
  // Change `it.fails` to `it` once the keyboard has a single tab stop.
  it.fails('has a single tab stop for the whole keyboard (known defect)', () => {
    render(<Piano />);

    const region = screen.getByRole('region', { name: /Piano keyboard/ });
    const tabStops = within(region).getAllByRole('button').filter((button) => button.tabIndex >= 0);
    expect(tabStops.length).toBeLessThanOrEqual(1);
  });
});

describe('Piano render isolation (only the key that changes renders again)', () => {
  function Harness({ initial = [] }) {
    const [pressed, setPressed] = useState(() => new Set(initial));
    const [, setTick] = useState(0);
    Harness.setPressed = (midis) => setPressed(new Set(midis));
    Harness.rerender = () => setTick((tick) => tick + 1);
    return <Piano pressedNotes={pressed} onNoteOn={Harness.on} onNoteOff={Harness.off} />;
  }
  Harness.on = () => {};
  Harness.off = () => {};

  it('does not render any key again when the parent renders for another reason', () => {
    render(<Harness />);
    for (const midi of Object.keys(renders)) delete renders[midi];

    act(() => {
      for (let i = 0; i < 5; i += 1) Harness.rerender();
    });

    expect(total()).toBe(0);
  });

  it('renders only key C4 when C4 is pressed, then only E4 when E4 is added', () => {
    render(<Harness />);
    for (const midi of Object.keys(renders)) delete renders[midi];

    act(() => Harness.setPressed([60]));
    expect(rendered()).toEqual([60]);
    expect(total()).toBe(1);

    for (const midi of Object.keys(renders)) delete renders[midi];
    act(() => Harness.setPressed([60, 64]));
    expect(rendered()).toEqual([64]);
  });

  it('renders a black key on its own, and the key that is released', () => {
    render(<Harness initial={[60]} />);
    for (const midi of Object.keys(renders)) delete renders[midi];

    act(() => Harness.setPressed([60, 61]));
    expect(rendered()).toEqual([61]);

    for (const midi of Object.keys(renders)) delete renders[midi];
    act(() => Harness.setPressed([61]));
    expect(rendered()).toEqual([60]);
  });

  it('renders no key for a new Set that holds the same notes', () => {
    render(<Harness initial={[61, 64]} />);
    for (const midi of Object.keys(renders)) delete renders[midi];

    act(() => Harness.setPressed([61, 64]));

    expect(total()).toBe(0);
  });

  it('renders exactly the keys of a chord, and no others, when 8 notes are pressed at once', () => {
    render(<Harness />);
    for (const midi of Object.keys(renders)) delete renders[midi];
    const chord = [48, 52, 55, 60, 64, 67, 72, 76];

    act(() => Harness.setPressed(chord));

    expect(rendered()).toEqual(chord);
    expect(total()).toBe(8);
  });
});
