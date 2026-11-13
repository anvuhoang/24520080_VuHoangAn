// src/forum/MessageForm.jsx
import { useEffect, useId, useRef, useState } from 'react';
import { postMessage } from './forumApi.js';
import { MAX_AUTHOR_LENGTH, MAX_TEXT_LENGTH, validateMessage } from './messageRules.js';
import styles from './MessageForm.module.css';

export default function MessageForm({ forum, onPosted = () => {} }) {
  const headingId = useId();
  const authorId = useId();
  const textId = useId();

  const [author, setAuthor] = useState('');
  const [text, setText] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [request, setRequest] = useState({ status: 'idle', error: null });
  const controllerRef = useRef(null);

  // A request still in flight when the form goes away is aborted
  useEffect(() => () => controllerRef.current?.abort(), []);

  // The same rules as the server, derived during render
  const errors = validateMessage({ author, text });
  const shown = attempted ? errors : {};
  const isSending = request.status === 'sending';

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSending) return;
    setAttempted(true);
    if (Object.keys(errors).length > 0) return;

    const controller = new AbortController();
    controllerRef.current = controller;
    setRequest({ status: 'sending', error: null });

    try {
      await postMessage(forum, { author, text }, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setText('');
      setAttempted(false);
      setRequest({ status: 'sent', error: null });
      onPosted();
    } catch (error) {
      if (controller.signal.aborted) return; // only our own abort is ignored
      setRequest({ status: 'error', error: error?.message ?? 'The message could not be sent.' });
    }
  };

  let status = '';
  if (isSending) status = 'Sending…';
  else if (request.status === 'sent') status = 'Message sent.';
  else if (request.status === 'error') status = request.error;

  return (
    <section className={styles.panel} aria-labelledby={headingId}>
      <h3 id={headingId} className={styles.title}>
        Post a message
      </h3>
      <form className={styles.form} noValidate onSubmit={handleSubmit}>
        <p className={styles.field}>
          <label htmlFor={authorId}>Author</label>
          <input
            id={authorId}
            className={styles.input}
            type="text"
            autoComplete="nickname"
            maxLength={MAX_AUTHOR_LENGTH + 20}
            value={author}
            aria-invalid={shown.author ? 'true' : 'false'}
            aria-describedby={shown.author ? `${authorId}-error` : undefined}
            onChange={(event) => setAuthor(event.target.value)}
          />
          {shown.author && (
            <small id={`${authorId}-error`} className={styles.error} role="alert">
              {shown.author}
            </small>
          )}
        </p>
        <p className={styles.field}>
          <label htmlFor={textId}>Message</label>
          <textarea
            id={textId}
            className={styles.input}
            rows={3}
            maxLength={MAX_TEXT_LENGTH + 20}
            value={text}
            aria-invalid={shown.text ? 'true' : 'false'}
            aria-describedby={shown.text ? `${textId}-error` : undefined}
            onChange={(event) => setText(event.target.value)}
          />
          {shown.text && (
            <small id={`${textId}-error`} className={styles.error} role="alert">
              {shown.text}
            </small>
          )}
        </p>
        {/* aria-disabled keeps the keyboard focus on the button while the message is sent */}
        <button type="submit" className={styles.submit} aria-disabled={isSending}>
          {isSending ? 'Sending…' : 'Send'}
        </button>
      </form>
      <output className={styles.status} aria-live="polite">
        {status}
      </output>
    </section>
  );
}
