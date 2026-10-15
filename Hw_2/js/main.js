/**
 * HW2: Main Entry Point — Full Decoupled Integration (Step 1–4)
 *
 * Integrated modules:
 * - HTML Data Contract (Step 1)
 * - Polyphonic Audio Engine (Step 2)
 * - Keyboard Controller with event.repeat throttling (Step 3)
 * - FIFO Beat Recorder with timestamped events & playback (Step 4)
 */

import { AudioEngine, getAudioEngine, playSound } from './audio-engine.js';
import { KeyboardController } from './keyboard-controller.js';
import { BeatRecorder } from './beat-recorder.js';

// Initialize audio engine, keyboard controller, and beat recorder on DOM ready
document.addEventListener('DOMContentLoaded', async () => {
  const engine = getAudioEngine({ contractRoot: document });
  await engine.init();

  const sounds = engine.getRegisteredSounds();
  console.log(`[Main] AudioEngine initialized with contract sounds:`, sounds);

  // Handle first user gesture to unlock AudioContext across strict browser autoplay policies
  const unlockAudio = async () => {
    await engine.unlock();
    window.removeEventListener('pointerdown', unlockAudio);
    window.removeEventListener('touchstart', unlockAudio);
  };
  window.addEventListener('pointerdown', unlockAudio, { once: true });
  window.addEventListener('touchstart', unlockAudio, { once: true });

  // DOM Elements for Recorder UI
  const btnRecord = document.getElementById('btn-record');
  const btnStop = document.getElementById('btn-stop');
  const btnPlay = document.getElementById('btn-play');
  const btnClear = document.getElementById('btn-clear');
  const statusEl = document.getElementById('recording-status');
  const indicatorEl = document.getElementById('recording-indicator');
  const countEl = document.getElementById('beat-count');

  const updateUI = (state, count) => {
    if (countEl) countEl.textContent = count;
    if (indicatorEl) indicatorEl.className = 'status-dot';
    btnRecord?.classList.remove('active');
    btnPlay?.classList.remove('active');

    switch (state) {
      case 'recording':
        if (statusEl) statusEl.textContent = 'Recording beats...';
        indicatorEl?.classList.add('recording');
        btnRecord?.classList.add('active');
        if (btnRecord) btnRecord.disabled = true;
        if (btnStop) btnStop.disabled = false;
        if (btnPlay) btnPlay.disabled = true;
        if (btnClear) btnClear.disabled = true;
        break;

      case 'playing':
        if (statusEl) statusEl.textContent = 'Playing recorded sequence...';
        indicatorEl?.classList.add('playing');
        btnPlay?.classList.add('active');
        if (btnRecord) btnRecord.disabled = true;
        if (btnStop) btnStop.disabled = false;
        if (btnPlay) btnPlay.disabled = true;
        if (btnClear) btnClear.disabled = true;
        break;

      case 'idle':
      default:
        if (statusEl) {
          statusEl.textContent = count > 0 ? `Ready (${count} beats stored)` : `Drum Kit Ready (${sounds.length} sounds)`;
        }
        if (btnRecord) btnRecord.disabled = false;
        if (btnStop) btnStop.disabled = true;
        if (btnPlay) btnPlay.disabled = count === 0;
        if (btnClear) btnClear.disabled = count === 0;
        break;
    }
  };

  // Initialize decoupled FIFO Beat Recorder
  const recorder = new BeatRecorder({
    onPlaySound: (soundId) => {
      // Replay sound via existing playSound engine
      playSound(soundId);

      // Visual flash on corresponding drum pad during replay
      const pad = document.querySelector(`.drum-pad[data-sound="${soundId}"]`);
      if (pad) {
        pad.classList.add('pressed');
        setTimeout(() => pad.classList.remove('pressed'), 120);
      }
    },
    onStateChange: (state) => {
      updateUI(state, recorder.getEventCount());
    },
    onQueueChange: (count) => {
      updateUI(recorder.getState(), count);
    },
  });

  // Central trigger function combining playback & live recording
  const triggerSound = (soundId) => {
    playSound(soundId);
    if (recorder.isRecording()) {
      recorder.record(soundId);
    }
  };

  // Initialize and start decoupled keyboard input controller
  const keyboardController = new KeyboardController({
    root: document,
    onPlaySound: (soundId) => {
      triggerSound(soundId);
    },
    targetWindow: window,
  });
  keyboardController.start();

  // Attach pointer / click delegation for drum pads
  const drumKit = document.getElementById('drum-kit');
  if (drumKit) {
    drumKit.addEventListener('click', (event) => {
      const pad = event.target.closest('.drum-pad');
      if (!pad) return;

      const soundId = pad.dataset.sound;
      if (soundId) {
        pad.classList.add('pressed');
        setTimeout(() => pad.classList.remove('pressed'), 120);
        triggerSound(soundId);
      }
    });
  }

  // Wire recorder toolbar buttons
  btnRecord?.addEventListener('click', () => recorder.startRecording());
  btnStop?.addEventListener('click', () => recorder.stop());
  btnPlay?.addEventListener('click', () => recorder.play());
  btnClear?.addEventListener('click', () => recorder.clear());

  // Initial UI sync
  updateUI(recorder.getState(), recorder.getEventCount());
});

// Re-export core modules globally
export { playSound, AudioEngine, getAudioEngine, KeyboardController, BeatRecorder };


