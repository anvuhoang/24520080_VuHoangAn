// client/src/dossier/MatrixTable.jsx — shows a matrix that computeMatrix made. It computes nothing.
import styles from './MatrixTable.module.css';

const VERDICTS = Object.freeze({
  harsher: 'Harsher than the others',
  lighter: 'Lighter than the others',
  proportionate: 'In line with the others',
  'no-data': 'No data',
});

const whole = new Intl.NumberFormat('en');
const one = new Intl.NumberFormat('en', { maximumFractionDigits: 1 });
const two = new Intl.NumberFormat('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function MatrixTable({ matrix, highlight }) {
  return (
    // a scrollable region has to be reachable with the keyboard, so it is focusable and named
    <section className={styles.scroll} tabIndex={0} aria-label="Disproportionality matrix (scrollable)">
      <table className={styles.table}>
        <caption className={styles.caption}>
          Penalty minutes per point of severity, compared with the mean of all players
          {matrix.mean === null ? '' : ` (mean ${one.format(matrix.mean)})`}
        </caption>
        <thead>
          <tr>
            <th scope="col">Player</th>
            <th scope="col">Infractions</th>
            <th scope="col">Severity points</th>
            <th scope="col">Penalty minutes</th>
            <th scope="col">Minutes per point</th>
            <th scope="col">Index</th>
            <th scope="col">Verdict</th>
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map((row) => (
            <tr key={row.playerId} className={styles.row} data-verdict={row.verdict} aria-current={row.playerId === highlight ? 'true' : undefined}>
              <th scope="row">{row.name}</th>
              <td>{row.infractions}</td>
              <td>{row.severity}</td>
              <td>{whole.format(row.minutes)}</td>
              <td>{row.rate === null ? '—' : one.format(row.rate)}</td>
              <td>{row.index === null ? '—' : two.format(row.index)}</td>
              <td>{VERDICTS[row.verdict]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
