// src/components/LevelMeter.jsx
import { useId } from 'react';
import styles from './LevelMeter.module.css';

// Only finite numbers count as a level; NaN, null, strings and other values count as silence.
// Numbers outside 0..1 are clamped to the range.
const toUnitLevel = (value) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
};

export default function LevelMeter({ level = 0 }) {
  const meterId = useId();
  const percent = Math.round(toUnitLevel(level) * 100);

  return (
    <p className={styles.wrap}>
      <label className={styles.label} htmlFor={meterId}>
        Output level
      </label>
      <meter id={meterId} className={styles.meter} min={0} max={100} value={percent}>
        {percent}%
      </meter>
      <output className={styles.value} htmlFor={meterId}>
        {percent}%
      </output>
    </p>
  );
}
