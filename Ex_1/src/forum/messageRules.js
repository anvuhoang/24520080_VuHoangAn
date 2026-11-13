// src/forum/messageRules.js
// One set of rules for a forum message, imported by the form in the browser AND by the Express server,
// so the client and the server can never disagree about what is valid.
export const MAX_AUTHOR_LENGTH = 40;
export const MAX_TEXT_LENGTH = 280;

// Returns an object of messages for the fields that are wrong; an empty object means valid.
export function validateMessage(input) {
  const body = input !== null && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const errors = {};

  const author = typeof body.author === 'string' ? body.author.trim() : '';
  const text = typeof body.text === 'string' ? body.text.trim() : '';

  if (author.length === 0) {
    errors.author = 'Author is required.';
  } else if (author.length > MAX_AUTHOR_LENGTH) {
    errors.author = `Author must have at most ${MAX_AUTHOR_LENGTH} characters.`;
  }

  if (text.length === 0) {
    errors.text = 'Message text is required.';
  } else if (text.length > MAX_TEXT_LENGTH) {
    errors.text = `Message must have at most ${MAX_TEXT_LENGTH} characters.`;
  }

  return errors;
}

// The trimmed values of the two fields; never anything else the caller may have sent
export function pickMessageFields(input) {
  return { author: String(input.author).trim(), text: String(input.text).trim() };
}
