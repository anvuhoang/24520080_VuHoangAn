// src/form/InputField.jsx
import { useId } from 'react';
import { useFormContext } from './FormContext.js';
import styles from './InputField.module.css';

export default function InputField({ name, label, type = 'text', autoComplete = 'off' }) {
  const { values, errors, touched, setValue, touch } = useFormContext();
  const id = useId();
  const errorId = `${id}-error`;

  // An error is only shown once the field was left (or the form was submitted)
  const error = touched[name] ? errors[name] : undefined;

  return (
    <p className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className={styles.input}
        name={name}
        type={type}
        autoComplete={autoComplete}
        value={values[name] ?? ''}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => setValue(name, event.target.value)}
        onBlur={() => touch(name)}
      />
      {error && (
        <small id={errorId} className={styles.error} role="alert">
          {error}
        </small>
      )}
    </p>
  );
}
