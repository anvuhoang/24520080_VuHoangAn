/**
 * HW2: Main Entry Point — Step 3 Keyboard Input & Polyphonic Audio Engine
 *
 * Constraints strictly observed:
 * - Reads sound identifiers from HTML data-sound contract.
 * - Keydown listener with event.repeat throttling via KeyboardController.
 * - Dynamic key mapping from HTML data-key (zero hardcoded maps).
 * - Keystrokes in form inputs and unmapped keys ignored.
 * - Calls existing playSound(soundId).
 * - No beat recording logic (reserved for Step 4).
 */

import { AudioEngine, getAudioEngine, playSound } from './audio-engine.js';
import { KeyboardController } from './keyboard-controller.js';

// Initialize audio engine and keyboard controller on DOM ready
document.addEventListener('DOMContentLoaded', async () => {
  const engine = getAudioEngine({ contractRoot: document });
  await engine.init();

  const sounds = engine.getRegisteredSounds();
  console.log(`[Main] AudioEngine initialized with contract sounds:`, sounds);

  // Update status bar display
  const statusEl = document.getElementById('recording-status');
  if (statusEl) {
    statusEl.textContent = `Drum Kit Ready (${sounds.length} sounds)`;
  }

  // Handle first user gesture to unlock AudioContext across strict browser autoplay policies
  const unlockAudio = async () => {
    await engine.unlock();
    window.removeEventListener('pointerdown', unlockAudio);
    window.removeEventListener('touchstart', unlockAudio);
  };
  window.addEventListener('pointerdown', unlockAudio, { once: true });
  window.addEventListener('touchstart', unlockAudio, { once: true });

  // Initialize and start decoupled keyboard input controller
  const keyboardController = new KeyboardController({
    root: document,
    onPlaySound: (soundId) => {
      playSound(soundId);
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
        playSound(soundId);
      }
    });
  }
});

// Re-export core modules globally
export { playSound, AudioEngine, getAudioEngine, KeyboardController };

