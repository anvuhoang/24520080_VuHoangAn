// client/tests/deckReference.test.jsx — the slide 33 code, copied as written, to show where it fails.
// Only the scaffolding around the lines (a harness component, a stand-in DossierView) is mine.
import { useMemo, useState } from 'react';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { computeMatrix } from '../src/dossier/computeMatrix.js';

afterEach(() => {
  vi.restoreAllMocks();
});

// --- slide 33, "Multi-Route Dossier routing for team members Himass & TanVuu", as written ---
function SlideRoutes() {
  const DossierView = ({ user }) => <h2>Dossier of {user}</h2>; // stand-in for the component the slide does not show
  return (
    <Routes>
      <Route path="/dossier/himass" element={<DossierView user="Himass" />} />
      <Route path="/dossier/tanvuu" element={<DossierView user="TanVuu" />} />
    </Routes>
  );
}
// ---------------------------------------------------------------------------------------------------

describe('slide 33 routes', () => {
  const at = (path) =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <SlideRoutes />
      </MemoryRouter>
    );

  it('serves the two players it lists', () => {
    at('/dossier/himass');
    expect(screen.getByRole('heading', { name: 'Dossier of Himass' })).toBeInTheDocument();
  });

  it('is not the route the homework asks for (/dossier/:playerID): a third player renders NOTHING, with only a console warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container } = at('/dossier/someone-else');
    expect(container).toBeEmptyDOMElement(); // no 404 page, no message: a blank screen
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('No routes matched location "/dossier/someone-else"'));
  });

  it('has no route for /dossier itself and none for an unknown address: blank as well', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(at('/dossier').container).toBeEmptyDOMElement();
  });
});

// --- slide 33, useAppealSlaTimer.js, as written ---
function addSlideListener() {
  document.addEventListener('visibilitychange', () => {
    // eslint-disable-next-line no-undef
    if (document.visibilityState === 'visible') resyncTimerWithServer();
  }); // Recalculates remaining time against absolute system clock timestamps
}
// -------------------------------------------------

describe('slide 33 useAppealSlaTimer', () => {
  it('calls resyncTimerWithServer, which does not exist: the first time the tab becomes visible it is a ReferenceError', () => {
    const spy = vi.spyOn(document, 'addEventListener');
    addSlideListener();
    const handler = spy.mock.calls.find(([type]) => type === 'visibilitychange')[1];
    expect(document.visibilityState).toBe('visible'); // jsdom reports the page as visible
    expect(() => handler()).toThrow(ReferenceError);
    document.removeEventListener('visibilitychange', handler);
  });

  it('adds a listener on EVERY call and never removes one: a component that renders 5 times has 5 listeners, and they outlive it', () => {
    const resync = vi.fn();
    globalThis.resyncTimerWithServer = resync; // given a function to call, so that the count of calls is the point
    const live = [];
    const add = vi.spyOn(document, 'addEventListener').mockImplementation((type, fn) => {
      if (type === 'visibilitychange') live.push(fn);
    });

    // "the hook" as the slide shows it: the listener is added in the body, not in an effect
    function Harness() {
      const [, force] = useState(0);
      addSlideListener();
      return (
        <button type="button" onClick={() => force((n) => n + 1)}>
          render
        </button>
      );
    }
    const { rerender, unmount } = render(<Harness />);
    for (let i = 0; i < 4; i++) rerender(<Harness />);
    unmount();

    expect(add.mock.calls.filter(([type]) => type === 'visibilitychange')).toHaveLength(5);
    // the tab becomes visible: all five run, although the component is gone
    live.forEach((fn) => fn());
    expect(resync).toHaveBeenCalledTimes(5);
    delete globalThis.resyncTimerWithServer;
  });

  it('only reacts to "visible" and holds no deadline, no offset and no state: the comment about absolute timestamps has no code behind it', () => {
    const resync = vi.fn();
    globalThis.resyncTimerWithServer = resync;
    const spy = vi.spyOn(document, 'addEventListener');
    addSlideListener();
    const handler = spy.mock.calls.find(([type]) => type === 'visibilitychange')[1];
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    handler();
    expect(resync).not.toHaveBeenCalled();
    delete document.visibilityState;
    document.removeEventListener('visibilitychange', handler);
    delete globalThis.resyncTimerWithServer;
    expect(handler.length).toBe(0); // it takes nothing, returns nothing: it can only call out
  });
});

// --- slide 33, FairPlayAppealPortal.jsx, as written ---
function useSlideMatrix(dossierData, compute) {
  return useMemo(() => compute(dossierData), [dossierData]);
}
// ------------------------------------------------------

describe('slide 33 useMemo(() => computeMatrix(dossierData), [dossierData])', () => {
  const rows = [{ playerId: 'a', name: 'A', infractions: [{ severity: 1, penaltyMinutes: 1 }] }];

  function Harness({ stable, compute }) {
    const [tick, setTick] = useState(0);
    const dossierData = useMemoSource(stable);
    useSlideMatrix(dossierData, compute);
    return (
      <button type="button" onClick={() => setTick(tick + 1)}>
        tick {tick}
      </button>
    );
  }
  const stableData = rows;
  const useMemoSource = (stable) => (stable ? stableData : rows.map((r) => ({ ...r }))); // a new array on every render

  it('is computed once while dependency keeps its identity', async () => {
    const compute = vi.fn(computeMatrix);
    render(<Harness stable compute={compute} />);
    for (let i = 0; i < 5; i++) await act(async () => screen.getByRole('button').click());
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it('is computed on EVERY render when the data is rebuilt each time (the usual .map/.filter/?? []), and a countdown renders every second', async () => {
    const compute = vi.fn(computeMatrix);
    render(<Harness stable={false} compute={compute} />);
    for (let i = 0; i < 5; i++) await act(async () => screen.getByRole('button').click());
    expect(compute).toHaveBeenCalledTimes(6); // the memo saved nothing
  });
});
