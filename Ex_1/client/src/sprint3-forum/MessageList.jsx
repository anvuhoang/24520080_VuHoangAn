// client/src/sprint3-forum/MessageList.jsx
import { Fragment } from 'react';
import styles from './MessageList.module.css';

const timeFormat = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' });

function formatTime(timestamp) {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? '' : timeFormat.format(date);
}

export default function MessageList({ status = 'loading', messages = [], error = null, onRetry = () => {} }) {
  if (status === 'error') {
    return (
      <section className={styles.board} role="alert">
        <p className={styles.message}>{error ?? 'Something went wrong.'}</p>
        <button type="button" className={styles.retry} onClick={onRetry}>
          Try again
        </button>
      </section>
    );
  }

  if (status === 'loading' && messages.length === 0) {
    return (
      <section className={styles.board} aria-busy="true" aria-live="polite" aria-label="Loading messages">
        <p className={styles.message}>Loading messages…</p>
      </section>
    );
  }

  return (
    <section className={styles.board} aria-busy={status === 'loading'} aria-label="Messages">
      {messages.length === 0 ? (
        <p className={styles.message}>No messages in this channel yet.</p>
      ) : (
        <dl className={styles.list}>
          {messages.map((message) => (
            <Fragment key={message.id}>
              <dt>{message.author}</dt>
              <dd>{message.text}</dd>
              <dd className={styles.time}>
                <time dateTime={message.timestamp}>{formatTime(message.timestamp)}</time>
              </dd>
            </Fragment>
          ))}
        </dl>
      )}
    </section>
  );
}
