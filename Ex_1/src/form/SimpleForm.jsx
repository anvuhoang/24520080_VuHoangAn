// src/form/SimpleForm.jsx
import { useCallback, useId, useState } from 'react';
import { FormContext } from './FormContext.js';
import InputField from './InputField.jsx';
import ShowData from './ShowData.jsx';
import { FIELD_NAMES, INITIAL_VALUES, isFormValid, validateForm } from './validateForm.js';
import styles from './SimpleForm.module.css';

const ALL_TOUCHED = Object.fromEntries(FIELD_NAMES.map((name) => [name, true]));

export default function SimpleForm() {
  const headingId = useId();
  const [values, setValues] = useState(INITIAL_VALUES);
  const [touched, setTouched] = useState({});
  const [attempted, setAttempted] = useState(false);
  const [submitted, setSubmitted] = useState(null);

  // Derived during the render pass: no useEffect, no copy of the errors in state
  const errors = validateForm(values);
  const isValid = isFormValid(errors);
  const errorCount = Object.keys(errors).length;

  const setValue = useCallback((name, value) => {
    setValues((previous) => ({ ...previous, [name]: value }));
  }, []);

  const touch = useCallback((name) => {
    setTouched((previous) => (previous[name] ? previous : { ...previous, [name]: true }));
  }, []);

  const handleSubmit = (event) => {
    event.preventDefault();
    setAttempted(true);
    setTouched(ALL_TOUCHED);
    setSubmitted(isValid ? { ...values } : null);
  };

  const handleReset = () => {
    setValues(INITIAL_VALUES);
    setTouched({});
    setAttempted(false);
    setSubmitted(null);
  };

  let status = '';
  if (attempted) {
    status = isValid ? 'The form is valid and was submitted.' : `${errorCount} ${errorCount === 1 ? 'field needs' : 'fields need'} attention.`;
  }

  return (
    <section className={styles.page} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.title}>
        Sign-up form
      </h2>

      <FormContext.Provider value={{ values, errors, touched, setValue, touch }}>
        <form className={styles.form} noValidate onSubmit={handleSubmit}>
          <InputField name="name" label="Full name" autoComplete="name" />
          <InputField name="email" label="Email" type="email" autoComplete="email" />
          <InputField name="password" label="Password" type="password" autoComplete="new-password" />
          <InputField name="confirmPassword" label="Confirm password" type="password" autoComplete="new-password" />

          <menu className={styles.actions}>
            <li>
              <button type="submit" className={styles.submit}>
                Submit
              </button>
            </li>
            <li>
              <button type="button" className={styles.reset} onClick={handleReset}>
                Reset
              </button>
            </li>
          </menu>
        </form>
      </FormContext.Provider>

      <output className={styles.status} aria-live="polite">
        {status}
      </output>

      {submitted && <ShowData data={submitted} />}
    </section>
  );
}
