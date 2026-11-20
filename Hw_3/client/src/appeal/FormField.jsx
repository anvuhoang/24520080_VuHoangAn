// client/src/appeal/FormField.jsx — one field: label, control, hint and error, wired for assistive technology.
// It reads the form from context and has no state of its own.
import { useId } from 'react';
import { useFormContext } from './FormContext.js';
import styles from './FormField.module.css';

export default function FormField({ name, label, control = 'input', type = 'text', options = [], hint, autoComplete, rows = 6, maxLength }) {
  const { values, errorFor, setValue, touch } = useFormContext();
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const error = errorFor(name);
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  const common = { id, name, 'aria-invalid': error ? 'true' : 'false', 'aria-describedby': describedBy, onBlur: () => touch(name) };

  let field;
  if (control === 'textarea') {
    field = <textarea {...common} className={styles.control} rows={rows} maxLength={maxLength} value={values[name]} onChange={(e) => setValue(name, e.target.value)} />;
  } else if (control === 'select') {
    field = (
      <select {...common} className={styles.control} value={values[name]} onChange={(e) => setValue(name, e.target.value)}>
        <option value="">Choose…</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    );
  } else if (control === 'checkbox') {
    return (
      <section className={styles.field}>
        <label className={styles.checkLabel} htmlFor={id}>
          <input {...common} type="checkbox" className={styles.check} checked={values[name]} onChange={(e) => setValue(name, e.target.checked)} />
          {label}
        </label>
        <p className={styles.error} id={errorId}>
          {error ?? ''}
        </p>
      </section>
    );
  } else {
    field = <input {...common} className={styles.control} type={type} autoComplete={autoComplete} maxLength={maxLength} value={values[name]} onChange={(e) => setValue(name, e.target.value)} />;
  }

  return (
    <section className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      {field}
      {/* the row is always there, so a message that appears does not push the next field down */}
      <p className={styles.error} id={errorId}>
        {error ?? ''}
      </p>
      {hint ? (
        <p className={styles.hint} id={hintId}>
          {hint}
        </p>
      ) : null}
    </section>
  );
}
