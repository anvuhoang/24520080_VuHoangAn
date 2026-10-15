/**
 * HW2: Main Entry Point — Step 2 Polyphonic Audio Engine Initialization
 *
 * Constraints strictly observed:
 * - Reads sound identifiers from the HTML data-sound contract.
 * - Exposes playSound(soundId).
 * - No keyboard listeners (reserved for Step 3).
 * - No beat recording logic (reserved for Step 4).
 */

import { AudioEngine, getAudioEngine, playSound } from './audio-engine.js';

// Initialize audio engine on DOM ready
document.addEventListener('DOMContentLoaded', async () => {
  const engine = getAudioEngine({ contractRoot: document });
  await engine.init();

  const sounds = engine.getRegisteredSounds();
  console.log(`[Main] AudioEngine initialized with contract sounds:`, sounds);

  // Update status bar display
  const statusEl = document.getElementById('recording-status');
  if (statusEl) {
    statusEl.textContent = `Audio Engine Ready (${sounds.length} sounds)`;
  }

  // Handle first user gesture to unlock AudioContext across strict browser autoplay policies
  const unlockAudio = async () => {
    await engine.unlock();
    window.removeEventListener('pointerdown', unlockAudio);
    window.removeEventListener('touchstart', unlockAudio);
  };
  window.addEventListener('pointerdown', unlockAudio, { once: true });
  window.addEventListener('touchstart', unlockAudio, { once: true });
});

// Re-export playSound globally
export { playSound, AudioEngine, getAudioEngine };
