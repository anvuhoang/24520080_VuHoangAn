// client/src/sla/SlaCountdown.jsx — shows what useAppealSlaTimer computed. It owns no state.
// The seconds are NOT announced: role="timer" is silent by default. A screen reader hears only the changes of level.
import { LEVEL_MESSAGES } from './formatRemaining.js';
import styles from './SlaCountdown.module.css';

const closesAt = (deadline) =>
  new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(deadline)) + ' UTC';

export default function SlaCountdown({ deadline, timer }) {
  return (
    <section className={styles.box} data-level={timer.level} aria-label="Appeal deadline">
      <h3 className={styles.title}>Time left to file an appeal</h3>
      <p className={styles.time} role="timer" aria-label="Time left to file an appeal">
        <time dateTime={timer.iso}>{timer.expired ? '00:00:00' : timer.text}</time>
      </p>
      <p className={styles.closes}>
        Closes <time dateTime={deadline}>{closesAt(deadline)}</time>
      </p>
      <p className={styles.sync}>
        {timer.sync === 'syncing' ? 'Checking the tribunal clock…' : null}
        {timer.sync === 'synced' ? 'Synchronized with the tribunal clock.' : null}
        {timer.sync === 'failed' ? 'The tribunal clock could not be reached. This countdown uses your device clock; the tribunal still decides.' : null}
      </p>
      <p className={styles.message} role="status">
        {LEVEL_MESSAGES[timer.level]}
      </p>
    </section>
  );
}
