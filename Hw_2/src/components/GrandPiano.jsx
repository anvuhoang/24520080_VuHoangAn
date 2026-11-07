// src/components/GrandPiano.jsx
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPolyphonicSynth } from '../audio/polyphonicSynth.js';
import { KEYS } from '../music/keys.js';
import { createFifoQueue } from '../sequencer/fifoQueue.js';
import { replaySequence } from '../sequencer/replay.js';
import Piano from './Piano.jsx';
import Transport from './Transport.jsx';
import styles from './GrandPiano.module.css';

const KEY_BY_MIDI = new Map(KEYS.map((key) => [key.midi, key]));
const NO_NOTES = new Set();

const withNote = (notes, midi) => (notes.has(midi) ? notes : new Set(notes).add(midi));
const withoutNote = (notes, midi) => {
  if (!notes.has(midi)) return notes;
  const next = new Set(notes);
  next.delete(midi);
  return next;
};

export default function GrandPiano() {
  const headingId = useId();

  // Raw inputs only; what the screen shows is derived from these
  const [pressedNotes, setPressedNotes] = useState(NO_NOTES);
  const [mode, setMode] = useState('idle'); // 'idle' | 'recording' | 'playing'
  const [speed, setSpeed] = useState(1);
  const [eventCount, setEventCount] = useState(0);

  // Things that must not cause a render when they change
  const synthRef = useRef(null);
  const modeRef = useRef('idle'); // lets the stable key callbacks know whether a recording is on
  const recordedRef = useRef(null);
  if (recordedRef.current === null) recordedRef.current = createFifoQueue();
  const takeRef = useRef(null); // the take being recorded: { startedAt, notes, open }
  const replayRef = useRef(null); // the AbortController of the replay in progress

  const changeMode = (next) => {
    modeRef.current = next;
    setMode(next);
  };

  // One synth for the lifetime of the component; a replay in progress is cancelled with it
  useEffect(() => {
    const synth = createPolyphonicSynth();
    synthRef.current = synth;
    return () => {
      replayRef.current?.abort();
      replayRef.current = null;
      synth.dispose();
      synthRef.current = null;
    };
  }, []);

  const startNote = useCallback((midi, freqHz) => {
    synthRef.current?.noteOn(midi, freqHz);
    setPressedNotes((notes) => withNote(notes, midi));
  }, []);

  const endNote = useCallback((midi) => {
    synthRef.current?.noteOff(midi);
    setPressedNotes((notes) => withoutNote(notes, midi));
  }, []);

  // Callbacks for the keys. They never change, so a key press does not re-render the other keys.
  const handleNoteOn = useCallback(
    (midi) => {
      const key = KEY_BY_MIDI.get(midi);
      if (!key) return;
      startNote(midi, key.freqHz);

      const take = takeRef.current;
      if (modeRef.current === 'recording' && take) {
        const note = { midi, freqHz: key.freqHz, startMs: performance.now() - take.startedAt, endMs: null };
        take.notes.push(note);
        take.open.set(midi, note);
      }
    },
    [startNote]
  );

  const handleNoteOff = useCallback(
    (midi) => {
      endNote(midi);

      const take = takeRef.current;
      const note = take?.open.get(midi);
      if (modeRef.current === 'recording' && note) {
        note.endMs = performance.now() - take.startedAt;
        take.open.delete(midi);
      }
    },
    [endNote]
  );

  const handleRecord = () => {
    recordedRef.current.clear();
    takeRef.current = { startedAt: performance.now(), notes: [], open: new Map() };
    setEventCount(0);
    changeMode('recording');
  };

  // Turns the take into events in the order the notes started: how long each note was held
  // and how long after the previous note it started (0 for the first one)
  const finishRecording = () => {
    const take = takeRef.current;
    takeRef.current = null;
    const queue = recordedRef.current;
    queue.clear();

    if (take) {
      const now = performance.now() - take.startedAt;
      take.notes.forEach((note, index) => {
        const endMs = note.endMs ?? now; // a key still held when recording stops ends now
        queue.enqueue({
          midi: note.midi,
          freqHz: note.freqHz,
          durationMs: Math.max(0, Math.round(endMs - note.startMs)),
          deltaMs: index === 0 ? 0 : Math.max(0, Math.round(note.startMs - take.notes[index - 1].startMs)),
        });
      });
    }

    setEventCount(queue.size);
  };

  const silenceEverything = () => {
    synthRef.current?.stopAll();
    setPressedNotes(NO_NOTES);
  };

  const handlePlay = () => {
    if (modeRef.current !== 'idle' || recordedRef.current.size === 0) return;

    const controller = new AbortController();
    replayRef.current = controller;
    changeMode('playing');

    const finish = () => {
      // Only the replay that is still current may end the playing mode
      if (replayRef.current !== controller) return;
      replayRef.current = null;
      silenceEverything();
      changeMode('idle');
    };

    replaySequence(recordedRef.current.toArray(), {
      speed,
      signal: controller.signal,
      onNoteOn: (event) => startNote(event.midi, event.freqHz),
      onNoteOff: (event) => endNote(event.midi),
    }).then(finish, finish);
  };

  const handleStop = () => {
    if (modeRef.current === 'recording') {
      finishRecording();
    } else if (modeRef.current === 'playing') {
      const controller = replayRef.current;
      replayRef.current = null;
      controller?.abort(); // releases the notes that are sounding and cancels the ones still waiting
      silenceEverything();
    }
    changeMode('idle');
  };

  return (
    <section className={styles.grandPiano} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.heading}>
        Play and record
      </h2>

      <Transport
        mode={mode}
        eventCount={eventCount}
        speed={speed}
        onRecord={handleRecord}
        onPlay={handlePlay}
        onStop={handleStop}
        onSpeedChange={setSpeed}
      />

      <Piano pressedNotes={pressedNotes} onNoteOn={handleNoteOn} onNoteOff={handleNoteOff} />
    </section>
  );
}
