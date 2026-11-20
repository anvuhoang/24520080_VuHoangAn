// client/src/appeal/AppealForm.jsx — the appeal form engine.
// State: the values, which fields the user has touched, whether a submit was tried, and the errors the server returned.
// The errors of the RULES are never state: they are computed from the values on every render (validateAppeal), so there is
// no effect, no second copy to keep in step, and no render that shows an old error.
import { memo, useRef, useState } from 'react';
import { ApiError, describeError } from '../api.js';
import { postAppeal } from './appealApi.js';
import { CATEGORIES, EMPTY_APPEAL, FIELDS, LIMITS, normalizeAppeal, validateAppeal } from './appealRules.js';
import { FormContext } from './FormContext.js';
import FormField from './FormField.jsx';
import styles from './AppealForm.module.css';

function AppealForm({ playerId, expired, onFiled, onRefresh }) {
  const [values, setValues] = useState(EMPTY_APPEAL);
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [closedByServer, setClosedByServer] = useState(false);
  const busyRef = useRef(false); // a ref: it must be true at once, before React renders again
  const formRef = useRef(null);

  const errors = validateAppeal(values); // derived while rendering

  // Rebuilt on every render on purpose: this component re-renders only when a value, a touch or a server error changes,
  // which is exactly when the fields have to read it again.
  const context = {
    values,
    errors,
    // Real-time: a field shows its error once it has been touched (typing counts), and from then on it follows every key.
    errorFor: (name) => (touched[name] || submitted ? errors[name] ?? serverErrors[name] : serverErrors[name]),
    setValue: (name, value) => {
      setValues((previous) => ({ ...previous, [name]: value }));
      setTouched((previous) => (previous[name] ? previous : { ...previous, [name]: true }));
      setServerErrors((previous) => (name in previous ? Object.fromEntries(Object.entries(previous).filter(([key]) => key !== name)) : previous));
    },
    touch: (name) => setTouched((previous) => (previous[name] ? previous : { ...previous, [name]: true })),
  };

  const focusField = (name) => formRef.current?.elements.namedItem(name)?.focus();

  const closed = expired || closedByServer;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (busyRef.current || closed) return;
    setSubmitted(true);
    const firstInvalid = FIELDS.find((name) => errors[name]);
    if (firstInvalid) {
      setMessage(`${Object.keys(errors).length} ${Object.keys(errors).length === 1 ? 'field needs' : 'fields need'} attention.`);
      focusField(firstInvalid);
      return;
    }

    busyRef.current = true;
    setBusy(true);
    setMessage('Sending your appeal…');
    try {
      const receipt = await postAppeal(playerId, normalizeAppeal(values));
      onFiled(receipt);
    } catch (error) {
      if (error instanceof ApiError && error.status === 400 && Object.keys(error.details ?? {}).length > 0) {
        setServerErrors(error.details);
        setMessage('The tribunal did not accept the appeal. Check the marked fields.');
        focusField(FIELDS.find((name) => error.details[name]));
      } else if (error instanceof ApiError && error.status === 403) {
        setClosedByServer(true);
        setMessage(error.message);
      } else if (error instanceof ApiError && error.status === 409) {
        setMessage(error.message);
        onRefresh();
      } else {
        setMessage(`Not sent: ${describeError(error)} Your answers are kept; you can try again.`);
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const length = values.statement.trim().length;
  const minimum = values.category === 'other' ? LIMITS.statement.minOther : LIMITS.statement.min;

  return (
    <FormContext.Provider value={context}>
      <form ref={formRef} className={styles.form} onSubmit={handleSubmit} noValidate aria-labelledby="appeal-form-title">
        <h3 id="appeal-form-title" className={styles.title}>
          File an appeal
        </h3>
        <FormField name="appellantName" label="Your name" autoComplete="name" maxLength={LIMITS.name.max + 20} />
        <FormField name="email" label="Email" type="email" autoComplete="email" />
        <FormField name="category" label="Reason of the appeal" control="select" options={CATEGORIES} />
        <FormField
          name="statement"
          label="Your statement"
          control="textarea"
          hint={`${length} of ${LIMITS.statement.max} characters. At least ${minimum}.`}
        />
        <FormField name="evidenceUrl" label="Link to evidence (optional)" type="url" autoComplete="off" hint="A link that starts with https://" />
        <FormField name="confirm" label="I confirm that my statement is true." control="checkbox" />

        <section className={styles.actions} aria-label="Send">
          <button type="submit" className={styles.submit} aria-disabled={busy || closed}>
            {busy ? 'Sending…' : 'Send appeal'}
          </button>
        </section>
        <p className={styles.status} role="status">
          {closed ? 'The appeal window is closed. The form can no longer be sent.' : message}
        </p>
      </form>
    </FormContext.Provider>
  );
}

// memo: the countdown above re-renders every second; the form must not
export default memo(AppealForm);

