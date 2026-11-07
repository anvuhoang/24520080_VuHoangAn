// src/components/DrumKit.jsx
import { useEffect, useId, useRef, useState } from 'react';
import { createDrumKit } from '../audio/drumKit.js';
import { useDrumKeyboard } from '../hooks/useDrumKeyboard.js';
import { PADS, PAD_BY_CODE } from '../data/pads.js';
import DrumPad from './DrumPad.jsx';
import LevelMeter from './LevelMeter.jsx';
import HitLog from './HitLog.jsx';
import styles from './DrumKit.module.css';

const HIT_LIMIT = 50;
const FLASH_MS = 150;
const DECAY_MS = 90;
const PADS_BY_ID = new Map(PADS.map((pad) => [pad.id, pad]));

export default function DrumKit() {
  const headingId = useId();
  const shortcutsId = useId();
  const sessionId = useId();

  // Raw inputs only; everything shown is derived from these
  const [held, setHeld] = useState([]); // pads held down on the keyboard
  const [flashed, setFlashed] = useState([]); // pads briefly pressed by mouse, Enter or Space
  const [hits, setHits] = useState([]);
  const [level, setLevel] = useState(0);
  const [shortcutsEnabled, setShortcutsEnabled] = useState(true);
  const [sessionName, setSessionName] = useState('');

  const kitRef = useRef(null);
  const flashTimers = useRef(new Map());

  // One audio kit per mounted component; released on unmount (StrictMode re-creates it)
  useEffect(() => {
    const kit = createDrumKit();
    kitRef.current = kit;
    return () => {
      kit.dispose();
      kitRef.current = null;
    };
  }, []);

  // Clear any pending flash timers on unmount
  useEffect(() => {
    const timers = flashTimers.current;
    return () => {
      for (const timerId of timers.values()) clearTimeout(timerId);
      timers.clear();
    };
  }, []);

  // The meter falls back to silence on its own
  useEffect(() => {
    if (level <= 0) return undefined;
    const timerId = setTimeout(() => setLevel(level < 0.03 ? 0 : level * 0.6), DECAY_MS);
    return () => clearTimeout(timerId);
  }, [level]);

  const playHit = (padId) => {
    const pad = PADS_BY_ID.get(padId);
    const peak = kitRef.current?.play(padId) ?? 0;
    setLevel(peak);
    if (pad) {
      setHits((prev) => [...prev, { id: crypto.randomUUID(), label: pad.label }].slice(-HIT_LIMIT));
    }
  };

  const holdPad = (padId) => setHeld((prev) => (prev.includes(padId) ? prev : [...prev, padId]));
  const releasePad = (padId) => setHeld((prev) => prev.filter((id) => id !== padId));

  const flashPad = (padId) => {
    const timers = flashTimers.current;
    clearTimeout(timers.get(padId));
    setFlashed((prev) => (prev.includes(padId) ? prev : [...prev, padId]));
    timers.set(
      padId,
      setTimeout(() => {
        timers.delete(padId);
        setFlashed((prev) => prev.filter((id) => id !== padId));
      }, FLASH_MS)
    );
  };

  useDrumKeyboard(
    PAD_BY_CODE,
    {
      onPress: (padId) => {
        playHit(padId);
        holdPad(padId);
      },
      onRelease: releasePad,
    },
    shortcutsEnabled
  );

  const triggerPad = (padId) => {
    playHit(padId);
    flashPad(padId);
  };

  return (
    <section className={styles.kit} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.heading}>
        Studio Drum Kit
      </h2>

      <fieldset className={styles.settings}>
        <legend>Settings</legend>

        <p className={styles.field}>
          <input
            id={shortcutsId}
            type="checkbox"
            checked={shortcutsEnabled}
            onChange={(event) => setShortcutsEnabled(event.target.checked)}
          />
          <label htmlFor={shortcutsId}>Enable keyboard shortcuts (W A S D J K L)</label>
        </p>

        <p className={styles.field}>
          <label htmlFor={sessionId}>Session name</label>
          <input
            id={sessionId}
            type="text"
            value={sessionName}
            onChange={(event) => setSessionName(event.target.value)}
          />
        </p>
      </fieldset>

      <ul className={styles.pads} aria-label="Drum pads">
        {PADS.map((pad) => (
          <DrumPad
            key={pad.id}
            label={pad.label}
            keyLabel={pad.keyLabel}
            isActive={held.includes(pad.id) || flashed.includes(pad.id)}
            onTrigger={() => triggerPad(pad.id)}
          />
        ))}
      </ul>

      <LevelMeter level={level} />
      <HitLog hits={hits} />
    </section>
  );
}
