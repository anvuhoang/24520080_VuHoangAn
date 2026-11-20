// client/src/appeal/AppealSection.jsx — the countdown and the appeal (the form, or the receipt of the one that was filed).
// This is the only component that re-renders every second; the form inside is memoized and gets only a boolean `expired`.
import SlaCountdown from '../sla/SlaCountdown.jsx';
import { useAppealSlaTimer } from '../sla/useAppealSlaTimer.js';
import AppealForm from './AppealForm.jsx';
import { useAppeal } from './useAppeal.js';
import styles from './AppealSection.module.css';

const when = (iso) => new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(iso)) + ' UTC';

export default function AppealSection({ dossier }) {
  const timer = useAppealSlaTimer(dossier.appealDeadline);
  const appeal = useAppeal(dossier.playerId);

  return (
    <section className={styles.section} aria-labelledby="appeal-title">
      <h3 id="appeal-title" className={styles.heading}>
        Appeal
      </h3>
      <SlaCountdown deadline={dossier.appealDeadline} timer={timer} />

      {appeal.status === 'loading' ? (
        <p className={styles.note} role="status" aria-busy="true">
          Checking whether an appeal has been filed…
        </p>
      ) : null}

      {appeal.status === 'error' ? (
        <section className={styles.error} role="alert">
          <p className={styles.errorText}>{appeal.error}</p>
          <button type="button" className={styles.retry} onClick={appeal.reload}>
            Try again
          </button>
        </section>
      ) : null}

      {appeal.status === 'filed' ? (
        <section className={styles.receipt} role="status" aria-label="Appeal receipt">
          <h4 className={styles.receiptTitle}>Appeal received</h4>
          <p className={styles.note}>
            The appeal for {dossier.name} was received on <time dateTime={appeal.appeal.createdAt}>{when(appeal.appeal.createdAt)}</time>. Reference{' '}
            <code>{appeal.appeal.id}</code>. It cannot be changed here.
          </p>
        </section>
      ) : null}

      {appeal.status === 'none' ? (
        <AppealForm playerId={dossier.playerId} expired={timer.expired} onFiled={appeal.markFiled} onRefresh={appeal.reload} />
      ) : null}
    </section>
  );
}
