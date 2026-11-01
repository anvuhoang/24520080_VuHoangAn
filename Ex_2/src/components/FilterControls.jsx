// src/components/FilterControls.jsx
import { useId } from 'react';
import { SORT_OPTIONS } from '../data/sortOptions.js';
import styles from './FilterControls.module.css';

export default function FilterControls({
  query = '',
  minIq = 0,
  sortBy = SORT_OPTIONS[0].id,
  resultCount = 0,
  onQueryChange,
  onMinIqChange,
  onSortChange,
  onReset,
}) {
  const queryId = useId();
  const minIqId = useId();
  const sortId = useId();

  // valueAsNumber keeps minIq a number so >= comparisons never coerce strings
  const handleMinIq = (event) => {
    const value = event.target.valueAsNumber;
    onMinIqChange?.(Number.isNaN(value) ? 0 : value);
  };

  return (
    <form
      className={styles.form}
      role="search"
      aria-label="Filter pioneers"
      onSubmit={(event) => event.preventDefault()}
    >
      <p className={styles.field}>
        <label className={styles.label} htmlFor={queryId}>
          Name
        </label>
        <input
          id={queryId}
          className={styles.input}
          type="search"
          value={query}
          onChange={(event) => onQueryChange?.(event.target.value)}
        />
      </p>

      <p className={styles.field}>
        <label className={styles.label} htmlFor={minIqId}>
          Minimum IQ
        </label>
        <input
          id={minIqId}
          className={styles.input}
          type="number"
          inputMode="numeric"
          min="0"
          value={minIq}
          onChange={handleMinIq}
        />
      </p>

      <p className={styles.field}>
        <label className={styles.label} htmlFor={sortId}>
          Sort by
        </label>
        <select
          id={sortId}
          className={styles.input}
          value={sortBy}
          onChange={(event) => onSortChange?.(event.target.value)}
        >
          {SORT_OPTIONS.map(({ id, label }) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </p>

      <footer className={styles.footer}>
        <output
          className={styles.status}
          role="status"
          aria-live="polite"
          htmlFor={`${queryId} ${minIqId} ${sortId}`}
        >
          Found {resultCount} {resultCount === 1 ? 'pioneer' : 'pioneers'}
        </output>
        <button className={styles.reset} type="button" onClick={onReset}>
          Reset
        </button>
      </footer>
    </form>
  );
}
