// src/components/SkillBadge.jsx
import styles from './SkillBadge.module.css';

export default function SkillBadge({ name = 'Unnamed Skill', tier = 'Core' }) {
  // Defaults only cover undefined, so coerce null before string methods
  const safeTier = String(tier ?? 'Core');
  const tierClass = styles[safeTier.toLowerCase()] ?? styles.core;

  return (
    <li className={`${styles.badge} ${tierClass}`}>
      {name ?? 'Unnamed Skill'} ({safeTier})
    </li>
  );
}
