// client/src/useDeck.js — the deck: loads profiles and the saved history, and turns swipe, undo and restart into API calls.
// The server is the source of truth: the screen changes only after the server has answered, and one action runs at a time.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ACTION_LABELS, statsOf } from './deck.js';
import { EMPTY_STACK, peek, pop, push } from './swipeStack.js';
import { ApiError, deleteAllSwipes, deleteSwipe, fetchProfiles, fetchSwipes, postSwipe } from './swipeApi.js';

const LOADING = { status: 'loading', profiles: [], history: EMPTY_STACK, error: null };

const describe = (error) => (error instanceof ApiError ? error.message : 'The server could not be reached.');

export function useDeck() {
  const [state, setState] = useState(LOADING);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const busyRef = useRef(false); // a ref, not state: it must be true at once, before React re-renders

  // Load: one AbortController per attempt; the cleanup aborts it, and only that abort is ignored.
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([fetchProfiles({ signal: controller.signal }), fetchSwipes({ signal: controller.signal })]).then(
      ([profiles, swipes]) => {
        if (controller.signal.aborted) return;
        setState({ status: 'success', profiles, history: Object.freeze(swipes), error: null });
      },
      (error) => {
        if (controller.signal.aborted) return;
        setState({ status: 'error', profiles: [], history: EMPTY_STACK, error: describe(error) });
      }
    );
    return () => controller.abort();
  }, [attempt]);

  const { profiles, history } = state;
  const current = profiles[history.length] ?? null; // the card on top: the history is always a prefix of the deck

  // Runs one action at a time. A second one that arrives meanwhile (a held key, a double click) is dropped.
  const run = useCallback(async (task) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await task();
    } catch (error) {
      setNotice(`Not saved: ${describe(error)}`);
      if (error instanceof ApiError && (error.status === 404 || error.status === 409)) {
        // The server's history is not the one on screen (another tab, a restart): take the server's
        try {
          const swipes = await fetchSwipes();
          setState((previous) => ({ ...previous, history: Object.freeze(swipes) }));
        } catch {
          // Still unreachable: the notice above already says so
        }
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  const swipe = useCallback(
    (action) => {
      if (!current) return Promise.resolve();
      return run(async () => {
        const record = await postSwipe({ profileId: current.id, action });
        setState((previous) => ({ ...previous, history: push(previous.history, record) }));
        const total = statsOf(push(history, record)).score;
        setNotice(`${ACTION_LABELS[action]} ${current.name}. Score ${total}.`);
      });
    },
    [current, history, run]
  );

  const undo = useCallback(() => {
    const last = peek(history);
    if (!last) return Promise.resolve();
    return run(async () => {
      await deleteSwipe(last.id);
      const { stack } = pop(history);
      setState((previous) => ({ ...previous, history: stack }));
      const card = profiles.find((p) => p.id === last.profileId);
      setNotice(`Undid ${ACTION_LABELS[last.action].toLowerCase()} ${card?.name ?? 'the last card'}. Score ${statsOf(stack).score}.`);
    });
  }, [history, profiles, run]);

  const restart = useCallback(
    () =>
      run(async () => {
        await deleteAllSwipes();
        setState((previous) => ({ ...previous, history: EMPTY_STACK }));
        setNotice('Deck restarted. Score 0.');
      }),
    [run]
  );

  const retry = useCallback(() => {
    setState(LOADING);
    setAttempt((n) => n + 1);
  }, []);

  return { ...state, current, stats: statsOf(history), busy, notice, swipe, undo, restart, retry };
}
