/**
 * Focused Unit & Integration Tests for HW2 Step 4: FIFO Beat Recorder
 */

import { BeatRecorder } from '../js/beat-recorder.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTests() {
  console.log('--- RUNNING STEP 4 BEAT RECORDER VERIFICATION TESTS ---\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  // Virtual clock for deterministic timestamp testing
  let currentTime = 1000;
  const mockNow = () => currentTime;

  const playedSounds = [];
  const stateTransitions = [];

  const recorder = new BeatRecorder({
    now: mockNow,
    onPlaySound: (soundId) => {
      playedSounds.push({ soundId, time: mockNow() });
    },
    onStateChange: (state) => {
      stateTransitions.push(state);
    },
  });

  // Test 1: Initial state
  assert(
    recorder.getState() === 'idle' &&
    recorder.getEventCount() === 0 &&
    recorder.getQueue().length === 0,
    'Test 1: Initial state is idle with empty queue'
  );

  // Test 2: Start recording and record timestamped events
  recorder.startRecording();
  assert(recorder.getState() === 'recording', 'Test 2a: startRecording transitions state to recording');

  currentTime = 1000;
  recorder.record('kick'); // relative = 0
  currentTime = 1150;
  recorder.record('snare'); // relative = 150
  currentTime = 1400;
  recorder.record('hihat'); // relative = 400

  const queue = recorder.getQueue();
  assert(
    queue.length === 3 &&
    queue[0].soundId === 'kick' && queue[0].timestamp === 0 &&
    queue[1].soundId === 'snare' && queue[1].timestamp === 150 &&
    queue[2].soundId === 'hihat' && queue[2].timestamp === 400,
    'Test 2b: Records { soundId, timestamp } events using relative time'
  );

  // Test 3: Stop recording
  recorder.stopRecording();
  assert(
    recorder.getState() === 'idle' && recorder.getEventCount() === 3,
    'Test 3: stopRecording sets state to idle and preserves queue'
  );

  // Test 4: Preserves FIFO order and supports FIFO bounded trimming
  const boundedRecorder = new BeatRecorder({
    now: mockNow,
    maxEvents: 3,
  });
  boundedRecorder.startRecording();
  currentTime = 2000;
  boundedRecorder.record('hit1');
  currentTime = 2100;
  boundedRecorder.record('hit2');
  currentTime = 2200;
  boundedRecorder.record('hit3');
  currentTime = 2300;
  boundedRecorder.record('hit4'); // Should drop hit1 (FIFO)

  const boundedQueue = boundedRecorder.getQueue();
  assert(
    boundedQueue.length === 3 &&
    boundedQueue[0].soundId === 'hit2' &&
    boundedQueue[1].soundId === 'hit3' &&
    boundedQueue[2].soundId === 'hit4',
    'Test 4: Preserves chronological FIFO order with bounded capacity pruning'
  );

  // Test 5: Avoid duplicate recording during playback
  const testRecorder = new BeatRecorder({ now: mockNow });
  testRecorder.startRecording();
  currentTime = 3000;
  testRecorder.record('crash');
  testRecorder.stopRecording();

  testRecorder.play();
  assert(testRecorder.isPlaying(), 'Test 5a: Transitions to playing state on play()');

  // Attempt to record while playback is active
  const recordedDuringPlay = testRecorder.record('snare');
  assert(
    recordedDuringPlay === false && testRecorder.getEventCount() === 1,
    'Test 5b: Strictly refuses recording during playback (prevents duplicate recording)'
  );
  testRecorder.stopPlayback();

  // Test 6: Replay events with original timing
  const replaySounds = [];
  const timedRecorder = new BeatRecorder({
    onPlaySound: (id) => replaySounds.push(id),
  });
  timedRecorder.startRecording();
  // Using native timers for rapid 50ms replay test
  timedRecorder.queue = [
    { soundId: 'kick', timestamp: 10 },
    { soundId: 'snare', timestamp: 40 },
  ];
  timedRecorder.duration = 60;
  timedRecorder.stopRecording();

  timedRecorder.play();

  await new Promise((resolve) => setTimeout(resolve, 180));
  assert(
    replaySounds.length === 2 &&
    replaySounds[0] === 'kick' &&
    replaySounds[1] === 'snare' &&
    timedRecorder.getState() === 'idle',
    'Test 6: Replays events with timing and automatically returns to idle'
  );

  // Test 7: Stop playback prematurely
  const abortSounds = [];
  const abortRecorder = new BeatRecorder({
    onPlaySound: (id) => abortSounds.push(id),
  });
  abortRecorder.queue = [
    { soundId: 'kick', timestamp: 10 },
    { soundId: 'snare', timestamp: 200 },
  ];
  abortRecorder.play();
  // Cancel before 200ms
  setTimeout(() => abortRecorder.stopPlayback(), 50);

  await new Promise((resolve) => setTimeout(resolve, 250));
  assert(
    abortSounds.length === 1 &&
    abortSounds[0] === 'kick' &&
    abortRecorder.getState() === 'idle',
    'Test 7: stopPlayback() clears pending timers cleanly'
  );

  // Test 8: Clear resets recorder
  timedRecorder.clear();
  assert(
    timedRecorder.getEventCount() === 0 &&
    timedRecorder.getState() === 'idle',
    'Test 8: clear() empties event queue and resets state'
  );

  // Test 9: Verification that Steps 1–3 modules are intact
  const indexHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const audioEngineCode = fs.readFileSync(path.join(__dirname, '../js/audio-engine.js'), 'utf8');
  const keyboardCode = fs.readFileSync(path.join(__dirname, '../js/keyboard-controller.js'), 'utf8');

  assert(
    indexHtml.includes('data-sound') &&
    indexHtml.includes('data-key') &&
    audioEngineCode.includes('class AudioEngine') &&
    audioEngineCode.includes('playSound') &&
    keyboardCode.includes('event.repeat') &&
    keyboardCode.includes('class KeyboardController'),
    'Test 9: Steps 1–3 (HTML contract, AudioEngine, KeyboardController) fully preserved'
  );

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
