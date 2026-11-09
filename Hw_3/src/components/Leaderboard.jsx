// src/components/Leaderboard.jsx
import { useId, useState } from 'react';
import { STANDINGS } from '../arena/arenaData.js';
import { selectStandings, totalPts } from '../arena/leaderboard.js';
import styles from './Leaderboard.module.css';

const SORT_OPTIONS = [
  { id: 'total', label: 'Total points' },
  { id: 'wwcd', label: 'Wins (WWCD)' },
  { id: 'placement', label: 'Placement points' },
  { id: 'kills', label: 'Kill points' },
];

// Which table column each sort choice highlights
const SORTED_COLUMN = { wwcd: 'wwcd', placement: 'placement', kills: 'kills', total: 'total' };

export function Leaderboard({ standings = STANDINGS }) {
  const headingId = useId();
  const queryId = useId();
  const minId = useId();
  const sortId = useId();

  // Only the three raw inputs are state; the rows and the count are derived during render
  const [query, setQuery] = useState('');
  const [minTotal, setMinTotal] = useState(null);
  const [sortBy, setSortBy] = useState('total');

  const rows = selectStandings(standings, { query, minTotal, sortBy });

  const handleMinChange = (event) => {
    const value = event.target.valueAsNumber;
    setMinTotal(Number.isNaN(value) ? null : value);
  };

  const sortedFor = (column) => (SORTED_COLUMN[sortBy] === column ? 'descending' : undefined);

  return (
    <section className={styles.leaderboard} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.heading}>
        Squad leaderboard
      </h2>

      <form
        className={styles.filters}
        role="search"
        aria-label="Filter squads"
        onSubmit={(event) => event.preventDefault()}
      >
        <p className={styles.field}>
          <label htmlFor={queryId}>Squad name</label>
          <input
            id={queryId}
            className={styles.control}
            type="search"
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </p>
        <p className={styles.field}>
          <label htmlFor={minId}>Minimum total points</label>
          <input
            id={minId}
            className={styles.control}
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            value={minTotal ?? ''}
            onChange={handleMinChange}
          />
        </p>
        <p className={styles.field}>
          <label htmlFor={sortId}>Sort by</label>
          <select
            id={sortId}
            className={styles.control}
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </p>
      </form>

      <output className={styles.count} aria-live="polite">
        Showing {rows.length} of {standings.length} squads
      </output>

      <figure className={styles.scroll} tabIndex={0} aria-label="Squad standings table">
        <table className={styles.table}>
          <caption className={styles.caption}>PVS squad standings (sample data), highest first</caption>
          <thead>
            <tr>
              <th scope="col">Squad</th>
              <th scope="col" className={styles.num} aria-sort={sortedFor('wwcd')}>
                WWCD
              </th>
              <th scope="col" className={styles.num} aria-sort={sortedFor('placement')}>
                Placement
              </th>
              <th scope="col" className={styles.num} aria-sort={sortedFor('kills')}>
                Kills
              </th>
              <th scope="col" className={styles.num} aria-sort={sortedFor('total')}>
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((squad) => (
              <tr key={squad.squadId}>
                <th scope="row">{squad.squadName}</th>
                <td className={styles.num}>{squad.wwcdCount}</td>
                <td className={styles.num}>{squad.placementPts}</td>
                <td className={styles.num}>{squad.killPts}</td>
                <td className={styles.num}>{totalPts(squad)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className={styles.empty}>
                  No squad matches these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </figure>
    </section>
  );
}
