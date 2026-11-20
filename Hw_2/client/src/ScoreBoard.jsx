// client/src/ScoreBoard.jsx — the numbers, as a description list. Everything comes from `stats`, which is derived from the history.
import { Fragment } from 'react';
import styles from './ScoreBoard.module.css';

export default function ScoreBoard({ stats, remaining }) {
  const rows = [
    ['Score', stats.score],
    ['Likes', stats.likes],
    ['Passes', stats.passes],
    ['Super likes', stats.supers],
    ['Cards left', remaining],
  ];
  return (
    <section aria-label="Score">
      <dl className={styles.list}>
        {rows.map(([label, value]) => (
          <Fragment key={label}>
            <dt className={styles.label}>{label}</dt>
            <dd className={styles.value}>{value}</dd>
          </Fragment>
        ))}
      </dl>
    </section>
  );
}
