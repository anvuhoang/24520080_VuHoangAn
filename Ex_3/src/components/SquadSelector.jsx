// src/components/SquadSelector.jsx
import styles from './SquadSelector.module.css';

export default function SquadSelector({ squads = [], selectedId = 'te', onSelect }) {
  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>Choose squad</legend>
      {squads.map((squad) => (
        <button
          key={squad.id}
          className={styles.button}
          type="button"
          aria-pressed={squad.id === selectedId}
          onClick={() => onSelect?.(squad.id)}
        >
          {squad.name}
        </button>
      ))}
    </fieldset>
  );
}
