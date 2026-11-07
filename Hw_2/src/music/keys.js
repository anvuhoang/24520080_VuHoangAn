// src/music/keys.js
const LOWEST_MIDI = 21; // A0
const HIGHEST_MIDI = 108; // C8

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const BLACK_PITCH_CLASSES = new Set([1, 3, 6, 8, 10]); // C#, D#, F#, G#, A#

// Equal temperament, A4 (MIDI 69) = 440 Hz
export const midiToFrequency = (midi) => 440 * 2 ** ((midi - 69) / 12);

const createKey = (midi) => {
  const pitchClass = midi % 12;
  const octave = Math.floor(midi / 12) - 1; // MIDI 60 is C4

  return Object.freeze({
    midi,
    noteName: `${NOTE_NAMES[pitchClass]}${octave}`,
    isBlack: BLACK_PITCH_CLASSES.has(pitchClass),
    freqHz: midiToFrequency(midi),
  });
};

// The 88 keys in pitch order, generated from the MIDI range instead of being typed out
export const KEYS = Object.freeze(
  Array.from({ length: HIGHEST_MIDI - LOWEST_MIDI + 1 }, (_, index) => createKey(LOWEST_MIDI + index))
);
