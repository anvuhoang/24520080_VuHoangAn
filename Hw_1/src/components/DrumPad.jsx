// src/components/DrumPad.jsx
import styles from './DrumPad.module.css';

export default function DrumPad({ label = 'Pad', keyLabel = '', isActive = false, onTrigger }) {
  return (
    <li className={styles.item}>
      <button
        type="button"
        className={styles.pad}
        aria-pressed={isActive}
        onClick={() => onTrigger?.()}
      >
        <kbd className={styles.key}>{keyLabel}</kbd>
        <strong className={styles.label}>{label}</strong>
      </button>
    </li>
  );
}
