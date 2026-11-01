// src/components/ScientistDirectory.jsx
import { useId, useState } from 'react';
import { SMART_PEOPLE } from '../data/smartPeople.js';
import { DEFAULT_SORT, SORT_OPTIONS } from '../data/sortOptions.js';
import FilterControls from './FilterControls.jsx';
import PioneerItem from './PioneerItem.jsx';
import styles from './ScientistDirectory.module.css';

const DEFAULT_MIN_IQ = 160;

export default function ScientistDirectory({ initialData = SMART_PEOPLE }) {
  const headingId = useId();

  // Only raw, independent inputs live in state
  const [people, setPeople] = useState(initialData);
  const [query, setQuery] = useState('');
  const [minIq, setMinIq] = useState(DEFAULT_MIN_IQ);
  const [sortBy, setSortBy] = useState(DEFAULT_SORT);

  // Derived data: computed during render in one pass, with no effect and no extra state
  const needle = query.trim().toLowerCase();
  const { compare } = SORT_OPTIONS.find((option) => option.id === sortBy) ?? SORT_OPTIONS[0];
  const visible = people
    .filter((person) => person.name.toLowerCase().includes(needle) && person.iq >= minIq)
    .toSorted(compare);

  const handleDelete = (id) => setPeople((prev) => prev.filter((person) => person.id !== id));

  const handleReset = () => {
    setPeople(initialData);
    setQuery('');
    setMinIq(DEFAULT_MIN_IQ);
    setSortBy(DEFAULT_SORT);
  };

  return (
    <section className={styles.directory} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.heading}>
        Pioneer Directory
      </h2>

      <FilterControls
        query={query}
        minIq={minIq}
        sortBy={sortBy}
        resultCount={visible.length}
        onQueryChange={setQuery}
        onMinIqChange={setMinIq}
        onSortChange={setSortBy}
        onReset={handleReset}
      />

      {visible.length === 0 ? (
        <p className={styles.empty}>No pioneers match the current filters.</p>
      ) : (
        <ul className={styles.list} aria-label="Pioneers">
          {visible.map((person) => (
            <PioneerItem key={person.id} {...person} onDelete={handleDelete} />
          ))}
        </ul>
      )}
    </section>
  );
}
