// client/src/sprint2-form/validateForm.js
export const INITIAL_VALUES = Object.freeze({
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
});

export const FIELD_NAMES = Object.freeze(Object.keys(INITIAL_VALUES));

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Pure: the same values always give the same errors. It is called during render, never from an effect.
export function validateForm(values = INITIAL_VALUES) {
  const current = { ...INITIAL_VALUES, ...values };
  const errors = {};

  if (String(current.name).trim().length < 2) {
    errors.name = 'Name must have at least 2 characters.';
  }

  if (!EMAIL_PATTERN.test(String(current.email).trim())) {
    errors.email = 'Enter a valid email address.';
  }

  if (String(current.password).length < 8) {
    errors.password = 'Password must have at least 8 characters.';
  }

  // Cross-field rule: it depends on two fields at once
  if (current.confirmPassword === '') {
    errors.confirmPassword = 'Confirm the password.';
  } else if (current.confirmPassword !== current.password) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  return errors;
}

export const isFormValid = (errors) => Object.keys(errors ?? {}).length === 0;
