// src/form/ShowData.jsx
import { Fragment } from 'react';
import styles from './ShowData.module.css';

// An inspector never shows a secret
const SECRET_KEYS = new Set(['password', 'confirmPassword']);

export default function ShowData({ data = {}, title = 'Submitted data' }) {
  const entries = Object.entries(data ?? {});

  return (
    <section className={styles.inspector} aria-label={title}>
      <h3 className={styles.title}>{title}</h3>
      <dl className={styles.list}>
        {entries.map(([key, value]) => (
          <Fragment key={key}>
            <dt>{key}</dt>
            <dd>{SECRET_KEYS.has(key) ? '••••••••' : String(value)}</dd>
          </Fragment>
        ))}
      </dl>
    </section>
  );
}
