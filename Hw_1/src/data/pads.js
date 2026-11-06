// src/data/pads.js
const definePad = (id, label, keyLabel, code) => Object.freeze({ id, label, keyLabel, code });

export const PADS = Object.freeze([
  definePad('tomHigh', 'Tom high', 'W', 'KeyW'),
  definePad('snare', 'Snare', 'A', 'KeyA'),
  definePad('kick', 'Kick', 'S', 'KeyS'),
  definePad('hatClosed', 'Hi-hat closed', 'D', 'KeyD'),
  definePad('tomLow', 'Tom low', 'J', 'KeyJ'),
  definePad('hatOpen', 'Hi-hat open', 'K', 'KeyK'),
  definePad('crash', 'Crash', 'L', 'KeyL'),
]);

// Lookup by KeyboardEvent.code for the keyboard hook.
// Object.freeze does not stop Map#set, so the mutating methods are replaced with ones that throw.
export const PAD_BY_CODE = new Map(PADS.map((pad) => [pad.code, pad]));

for (const method of ['set', 'delete', 'clear']) {
  PAD_BY_CODE[method] = () => {
    throw new TypeError(`PAD_BY_CODE is read-only (${method} is not allowed)`);
  };
}

Object.freeze(PAD_BY_CODE);
