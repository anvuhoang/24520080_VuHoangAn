// src/components/PubgMatchTelemetry.jsx
import { useEffect, useState } from 'react';
import { fetchKraftonPubgTelemetry } from '../api/fetchKraftonPubgTelemetry.js';
import TelemetryCard from './TelemetryCard.jsx';
import styles from './PubgMatchTelemetry.module.css';

export default function PubgMatchTelemetry({ squadId = 'te' }) {
  const [view, setView] = useState({ status: 'IDLE', data: null, error: null });
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setView({ status: 'LOADING', data: null, error: null });

    fetchKraftonPubgTelemetry(squadId, { signal: controller.signal })
      .then((squad) => setView({ status: 'SUCCESS', data: squad, error: null }))
      .catch((err) => {
        // An intentional abort (squad switched or unmounted) must not flash an error
        if (err.name === 'AbortError') return;
        setView({ status: 'ERROR', data: null, error: err.message });
      });

    return () => controller.abort();
  }, [squadId, retryTick]);

  return (
    <section className={styles.region} aria-live="polite">
      {view.status === 'LOADING' && <p>Syncing KRAFTON radar…</p>}

      {view.status === 'ERROR' && (
        <>
          <p role="alert">{view.error}</p>
          <button type="button" onClick={() => setRetryTick((t) => t + 1)}>
            Reconnect Satellite (Retry)
          </button>
        </>
      )}

      {view.status === 'SUCCESS' && <TelemetryCard squad={view.data} />}
    </section>
  );
}
