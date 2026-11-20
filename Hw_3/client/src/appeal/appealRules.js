// client/src/appeal/appealRules.js — the rules of an appeal, as pure functions.
// ONE file for the browser form and for the Express server (the server imports it), so the two cannot drift apart.

export const CATEGORIES = Object.freeze([
  Object.freeze({ id: 'false-positive', label: 'The detection was a false positive' }),
  Object.freeze({ id: 'mistaken-identity', label: 'Mistaken identity' }),
  Object.freeze({ id: 'technical-issue', label: 'A technical problem (lag, crash, disconnect)' }),
  Object.freeze({ id: 'other', label: 'Other reason' }),
]);

export const LIMITS = Object.freeze({
  name: Object.freeze({ min: 2, max: 60 }),
  email: 254,
  statement: Object.freeze({ min: 50, minOther: 100, max: 1000 }),
  url: 300,
});

export const FIELDS = Object.freeze(['appellantName', 'email', 'category', 'statement', 'evidenceUrl', 'confirm']);

export const EMPTY_APPEAL = Object.freeze({
  appellantName: '',
  email: '',
  category: '',
  statement: '',
  evidenceUrl: '',
  confirm: false,
});

// local part, then a domain of at least two labels with no empty label ("a@b..", "a@.b.co" and "a@b..co" are not addresses)
const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
const isText = (value) => typeof value === 'string';

// Evidence must be an https link without credentials: it is shown as a link, so "javascript:" and "http:" are out.
function isHttpsUrl(text) {
  try {
    const url = new URL(text);
    return url.protocol === 'https:' && url.hostname !== '' && url.username === '' && url.password === '';
  } catch {
    return false;
  }
}

// values -> { [field]: message }. An empty object means valid. Nothing here reads the DOM, the clock or the network.
export function validateAppeal(values) {
  const errors = {};
  const v = values ?? {};

  if (!isText(v.appellantName)) errors.appellantName = 'Enter your name.';
  else {
    const name = v.appellantName.trim();
    if (name.length < LIMITS.name.min) errors.appellantName = `Name must have at least ${LIMITS.name.min} characters.`;
    else if (name.length > LIMITS.name.max) errors.appellantName = `Name must have at most ${LIMITS.name.max} characters.`;
  }

  if (!isText(v.email)) errors.email = 'Enter a valid email address.';
  else {
    const email = v.email.trim();
    if (!EMAIL.test(email) || email.length > LIMITS.email) errors.email = 'Enter a valid email address.';
  }

  const category = CATEGORIES.find((c) => c.id === v.category);
  if (!category) errors.category = 'Choose the reason of your appeal.';

  // Cross-field rule: "Other" has to be explained at more length than a named reason.
  const minStatement = v.category === 'other' ? LIMITS.statement.minOther : LIMITS.statement.min;
  if (!isText(v.statement)) errors.statement = 'Write your statement.';
  else {
    const length = v.statement.trim().length;
    if (length < minStatement) {
      errors.statement =
        v.category === 'other'
          ? `For "Other", the statement must have at least ${minStatement} characters.`
          : `Statement must have at least ${minStatement} characters.`;
    } else if (length > LIMITS.statement.max) errors.statement = `Statement must have at most ${LIMITS.statement.max} characters.`;
  }

  // Optional, but if it is there it must be a safe link.
  if (v.evidenceUrl !== undefined && v.evidenceUrl !== null && v.evidenceUrl !== '') {
    if (!isText(v.evidenceUrl)) errors.evidenceUrl = 'Evidence must be a link.';
    else {
      const url = v.evidenceUrl.trim();
      if (url !== '' && (url.length > LIMITS.url || !isHttpsUrl(url))) errors.evidenceUrl = 'Evidence must be a link that starts with https://.';
    }
  }

  if (v.confirm !== true) errors.confirm = 'Confirm that your statement is true.';

  return errors;
}

// Exactly the known fields, trimmed, with the email in lower case. Used before sending and before storing.
export function normalizeAppeal(values) {
  const text = (value) => (isText(value) ? value.trim() : '');
  return {
    appellantName: text(values?.appellantName),
    email: text(values?.email).toLowerCase(),
    category: text(values?.category),
    statement: text(values?.statement),
    evidenceUrl: text(values?.evidenceUrl),
    confirm: values?.confirm === true,
  };
}
