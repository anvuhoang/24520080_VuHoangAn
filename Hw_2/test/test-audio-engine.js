/**
 * Unit & Integration Tests for HW2 Step 2: Polyphonic Audio Engine
 */

import { AudioEngine, playSound, getAudioEngine } from '../js/audio-engine.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock Web Audio API for Node environment
class MockAudioBuffer {
  constructor(channels, length, sampleRate) {
    this.numberOfChannels = channels;
    this.length = length;
    this.sampleRate = sampleRate;
    this._data = new Float32Array(length);
  }
  getChannelData() {
    return this._data;
  }
}

class MockAudioBufferSourceNode {
  constructor(ctx) {
    this.ctx = ctx;
    this.buffer = null;
    this.started = false;
    this.connectedTo = null;
  }
  connect(target) {
    this.connectedTo = target;
  }
  start(when = 0) {
    this.started = true;
    this.ctx._activeSources.push(this);
  }
}

class MockGainNode {
  constructor(ctx) {
    this.ctx = ctx;
    this.gain = {
      setValueAtTime: (val) => { this.value = val; }
    };
  }
  connect(target) {}
}

class MockAudioContext {
  constructor() {
    this.state = 'running';
    this.sampleRate = 44100;
    this.currentTime = 0;
    this.destination = {};
    this._activeSources = [];
  }
  createBuffer(channels, length, sampleRate) {
    return new MockAudioBuffer(channels, length, sampleRate);
  }
  createBufferSource() {
    return new MockAudioBufferSourceNode(this);
  }
  createGain() {
    return new MockGainNode(this);
  }
  async resume() {
    this.state = 'running';
  }
  async decodeAudioData(arrayBuffer) {
    return new MockAudioBuffer(1, 44100, 44100);
  }
}

// Minimal DOM Mock to verify HTML contract extraction
function createMockDOM(htmlContent) {
  const matches = [...htmlContent.matchAll(/data-sound="([^"]+)"/g)];
  const soundIds = matches.map(m => m[1]);

  return {
    querySelectorAll(selector) {
      if (selector === '[data-sound]') {
        return soundIds.map(id => ({ dataset: { sound: id } }));
      }
      return [];
    }
  };
}

async function runTests() {
  console.log('--- RUNNING STEP 2 AUDIO ENGINE VERIFICATION TESTS ---\n');
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

  const htmlPath = path.join(__dirname, '../index.html');
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');
  const mockDOM = createMockDOM(htmlContent);

  // Test 1: Extract sound identifiers from HTML contract
  const extractedSounds = AudioEngine.extractSoundIds(mockDOM);
  assert(
    extractedSounds.length === 7 &&
    ['crash', 'kick', 'snare', 'tom1', 'tom2', 'tom3', 'hihat'].every(s => extractedSounds.includes(s)),
    'Test 1: Reads sound identifiers from HTML data-sound contract'
  );

  // Test 2: Audio Engine instantiation & initialization
  const mockCtx = new MockAudioContext();
  const engine = new AudioEngine({
    audioContext: mockCtx,
    contractRoot: mockDOM,
    enableSynthesisFallback: true
  });
  await engine.init();

  assert(
    engine.isInitialized && engine.getRegisteredSounds().length === 7,
    'Test 2: Independent reusable AudioEngine initializes with contract sounds'
  );

  // Test 3: Safe handling of missing audio files with synthetic fallback
  const missingSoundLoaded = await engine.loadSound('missing_sound_test', 'http://invalid-path/missing.wav');
  assert(
    missingSoundLoaded !== null && engine.hasSound('missing_sound_test'),
    'Test 3: Handles missing audio files safely without throwing, synthesizes fallback'
  );

  // Test 4: Polyphony & Overlapping hits (repeated hits of the same sound)
  mockCtx._activeSources = [];
  const hit1 = engine.playSound('kick');
  const hit2 = engine.playSound('kick');
  const hit3 = engine.playSound('kick');

  assert(
    hit1 && hit2 && hit3 && mockCtx._activeSources.length === 3,
    'Test 4: Supports overlapping repeated hits of the same sound (polyphony)'
  );

  // Test 5: Polyphony across multiple distinct sounds simultaneously
  const beforeCount = mockCtx._activeSources.length;
  engine.playSound('snare');
  engine.playSound('crash');
  engine.playSound('hihat');

  assert(
    mockCtx._activeSources.length === beforeCount + 3,
    'Test 5: Supports overlapping different sounds simultaneously'
  );

  // Test 6: Standalone playSound(soundId) export
  const standaloneEngine = getAudioEngine({
    audioContext: mockCtx,
    contractRoot: mockDOM,
    enableSynthesisFallback: true
  });
  await standaloneEngine.init();
  const standaloneRes = playSound('kick');
  assert(
    standaloneRes === true,
    'Test 6: Exposes functional playSound(soundId) export'
  );

  // Test 7: Confirm NO keyboard listeners or recorder implemented in Step 2 code
  const mainJsPath = path.join(__dirname, '../js/main.js');
  const audioEnginePath = path.join(__dirname, '../js/audio-engine.js');
  const mainContent = fs.readFileSync(mainJsPath, 'utf8');
  const engineContent = fs.readFileSync(audioEnginePath, 'utf8');

  const hasKeydown = mainContent.includes('keydown') || engineContent.includes('keydown');
  const hasRecorder = mainContent.includes('BeatRecorder') || engineContent.includes('BeatRecorder');
  assert(
    !hasKeydown && !hasRecorder,
    'Test 7: Strictly does NOT implement keyboard listeners or recording in Step 2'
  );

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Test run failed with error:', err);
  process.exit(1);
});
