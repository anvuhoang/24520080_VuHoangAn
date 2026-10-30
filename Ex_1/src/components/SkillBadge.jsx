// src/components/SkillBadge.jsx
import styles from './SkillBadge.module.css';

export default function SkillBadge({ name = 'Unnamed Skill', tier = 'Core' }) {
  const tierClass = styles[tier.toLowerCase()] ?? styles.core;

  return (
    <span className={`${styles.badge} ${tierClass}`}>
      {name} ({tier})
    </span>
  );
}
