// client/src/dossier/useDossiers.js — loads the dossiers once. One AbortController per attempt; only its own abort is ignored.
import { useCallback, useEffect, useState } from 'react';
import { describeError } from '../api.js';
import { fetchDossiers } from './dossierApi.js';

const LOADING = { status: 'loading', dossiers: [], error: null };

export function useDossiers() {
  const [state, setState] = useState(LOADING);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetchDossiers({ signal: controller.signal }).then(
      (dossiers) => {
        if (controller.signal.aborted) return;
        setState({ status: 'success', dossiers, error: null });
      },
      (error) => {
        if (controller.signal.aborted) return;
        setState({ status: 'error', dossiers: [], error: describeError(error) });
      }
    );
    return () => controller.abort();
  }, [attempt]);

  const retry = useCallback(() => {
    setState(LOADING);
    setAttempt((n) => n + 1);
  }, []);

  return { ...state, retry };
}
