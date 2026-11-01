// src/components/TelemetryAlert.jsx
import styles from './TelemetryAlert.module.css';

export default function TelemetryAlert({ message = 'Satellite link lost.', onRetry }) {
  return (
    <section role="alert" className={styles.alert}>
      <p className={styles.message}>
        Blue-Zone link lost: {String(message ?? 'Satellite link lost.')}
      </p>
      <button className={styles.retry} type="button" onClick={() => onRetry?.()}>
        Reconnect Satellite (Retry)
      </button>
    </section>
  );
}
