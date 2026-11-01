// src/components/DeveloperCard.jsx
import { Fragment, useId, useState } from 'react';
import SkillBadge from './SkillBadge.jsx';
import styles from './DeveloperCard.module.css';

function getInitials(fullName) {
  const words = String(fullName ?? '').trim().split(/\s+/);
  const first = words.at(0)?.[0] ?? '';
  const last = words.length > 1 ? words.at(-1)[0] : '';
  return (first + last).toUpperCase() || '?';
}

// Remote images must be HTTPS; root-relative paths ("/avatars/x.jpg") load from our own public/ folder
function isAllowedImageSrc(src) {
  const value = String(src ?? '');
  return value.startsWith('https://') || (value.startsWith('/') && !value.startsWith('//'));
}

export default function DeveloperCard({
  fullName = 'Anonymous Developer',
  role = 'Developer',
  avatarUrl = '',
  metrics = {},
  skills = [],
}) {
  const headingId = useId();
  const [failedUrl, setFailedUrl] = useState(null);

  const showAvatar = isAllowedImageSrc(avatarUrl) && failedUrl !== avatarUrl;

  return (
    <article className={styles.card} aria-labelledby={headingId}>
      <header className={styles.header}>
        <figure className={styles.avatarFrame}>
          {showAvatar ? (
            <img
              className={styles.avatar}
              src={avatarUrl}
              width="96"
              height="96"
              alt={`Avatar of ${fullName}`}
              onError={() => setFailedUrl(avatarUrl)}
            />
          ) : (
            <abbr className={styles.initials} title={fullName}>
              {getInitials(fullName)}
            </abbr>
          )}
        </figure>
        <hgroup className={styles.identity}>
          <h2 id={headingId} className={styles.name}>
            {fullName}
          </h2>
          <p className={styles.role}>{role}</p>
        </hgroup>
      </header>

      <dl className={styles.metrics}>
        {Object.entries(metrics).map(([label, value]) => (
          <Fragment key={label}>
            <dt className={styles.metricLabel}>{label}</dt>
            <dd className={styles.metricValue}>{value}</dd>
          </Fragment>
        ))}
      </dl>

      <ul className={styles.skills} aria-label="Engineered Skills">
        {skills.map(({ id, name, tier }) => (
          <SkillBadge key={id} name={name} tier={tier} />
        ))}
      </ul>
    </article>
  );
}
