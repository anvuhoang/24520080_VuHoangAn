// client/src/appeal/useAppeal.js — has an appeal been filed for this player? The state is keyed by the player, so a slow
// answer for the previous player can never be shown for the next one.
import { useCallback, useEffect, useState } from 'react';
import { describeError } from '../api.js';
import { fetchAppeal } from './appealApi.js';

export function useAppeal(playerId) {
  const [result, setResult] = useState({ playerId: null, status: 'loading', appeal: null, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetchAppeal(playerId, { signal: controller.signal }).then(
      (appeal) => {
        if (controller.signal.aborted) return;
        setResult({ playerId, status: appeal ? 'filed' : 'none', appeal, error: null });
      },
      (error) => {
        if (controller.signal.aborted) return;
        setResult({ playerId, status: 'error', appeal: null, error: describeError(error) });
      }
    );
    return () => controller.abort();
  }, [playerId, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const markFiled = useCallback((appeal) => setResult({ playerId, status: 'filed', appeal, error: null }), [playerId]);

  // An answer that belongs to another player is "loading" for this one
  const current = result.playerId === playerId ? result : { status: 'loading', appeal: null, error: null };
  return { ...current, reload, markFiled };
}
