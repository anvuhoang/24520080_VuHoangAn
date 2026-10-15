/**
 * Unit & Integration Tests for HW2 Step 3: Keyboard Input Controller
 */

import { KeyboardController } from '../js/keyboard-controller.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock DOM element for tests
class MockElement {
  constructor(tagName, attrs = {}) {
    this.tagName = tagName.toUpperCase();
    this.dataset = {};
    this.classList = new Set();
    this.isContentEditable = attrs.isContentEditable || false;

    if (attrs.dataKey) this.dataset.key = attrs.dataKey;
    if (attrs.dataSound) this.dataset.sound = attrs.dataSound;
    this.classList.add = (cls) => this.classList.add ? Set.prototype.add.call(this.classList, cls) : null;
    this.classList.remove = (cls) => this.classList.delete ? Set.prototype.delete.call(this.classList, cls) : null;
    this.classList.contains = (cls) => Set.prototype.has.call(this.classList, cls);
  }

  matches(selector) {
    if (selector.includes('input') && this.tagName === 'INPUT') return true;
    if (selector.includes('textarea') && this.tagName === 'TEXTAREA') return true;
    if (selector.includes('select') && this.tagName === 'SELECT') return true;
    if (selector.includes('contenteditable') && this.isContentEditable) return true;
    return false;
  }
}

// Mock Event Target / Window
class MockWindow {
  constructor() {
    this.listeners = new Map();
  }
  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(handler);
  }
  removeEventListener(type, handler) {
    if (!this.listeners.has(type)) return;
    const filtered = this.listeners.get(type).filter(h => h !== handler);
    this.listeners.set(type, filtered);
  }
  dispatch(type, event) {
    const list = this.listeners.get(type) || [];
    for (const handler of list) {
      handler(event);
    }
  }
}

// Mock Root document containing pads parsed from actual index.html
function parsePadsFromHtml(htmlContent) {
  const padRegex = /<button[^>]*class="[^"]*drum-pad[^"]*"[^>]*data-key="([^"]+)"[^>]*data-sound="([^"]+)"/g;
  const pads = [];
  let match;
  while ((match = padRegex.exec(htmlContent)) !== null) {
    pads.push(new MockElement('button', { dataKey: match[1], dataSound: match[2] }));
  }
  return {
    querySelectorAll(selector) {
      if (selector === '[data-key]') return pads;
      return [];
    }
  };
}

async function runTests() {
  console.log('--- RUNNING STEP 3 KEYBOARD INPUT VERIFICATION TESTS ---\n');
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
  const mockDOM = parsePadsFromHtml(htmlContent);

  const mockWin = new MockWindow();
  const playedSounds = [];

  const controller = new KeyboardController({
    root: mockDOM,
    targetWindow: mockWin,
    onPlaySound: (soundId) => {
      playedSounds.push(soundId);
    }
  });
  controller.start();

  // Test 1: Keydown trigger for valid mapped key ('KeyW' -> 'crash')
  playedSounds.length = 0;
  mockWin.dispatch('keydown', { code: 'KeyW', key: 'w', repeat: false, target: {} });
  assert(
    playedSounds.length === 1 && playedSounds[0] === 'crash',
    'Test 1: Keydown listener resolves data-sound and triggers playSound'
  );

  // Test 2: Throttling repeated keydown events via event.repeat
  playedSounds.length = 0;
  // First press
  mockWin.dispatch('keydown', { code: 'KeyA', key: 'a', repeat: false, target: {} });
  // Repeated presses while holding key down
  mockWin.dispatch('keydown', { code: 'KeyA', key: 'a', repeat: true, target: {} });
  mockWin.dispatch('keydown', { code: 'KeyA', key: 'a', repeat: true, target: {} });
  mockWin.dispatch('keydown', { code: 'KeyA', key: 'a', repeat: true, target: {} });

  assert(
    playedSounds.length === 1 && playedSounds[0] === 'kick',
    'Test 2: Ignores repeated keydown events using event.repeat'
  );

  // Test 3: Ignores unmapped keys (e.g. 'KeyZ', 'Escape', 'Enter')
  playedSounds.length = 0;
  mockWin.dispatch('keydown', { code: 'KeyZ', key: 'z', repeat: false, target: {} });
  mockWin.dispatch('keydown', { code: 'Escape', key: 'Escape', repeat: false, target: {} });
  mockWin.dispatch('keydown', { code: 'Enter', key: 'Enter', repeat: false, target: {} });
  assert(
    playedSounds.length === 0,
    'Test 3: Ignores unmapped keys silently without errors'
  );

  // Test 4: Ignores typing in form input fields
  playedSounds.length = 0;
  const inputEl = new MockElement('input');
  const textareaEl = new MockElement('textarea');
  const selectEl = new MockElement('select');
  const editableEl = new MockElement('div', { isContentEditable: true });

  mockWin.dispatch('keydown', { code: 'KeyW', key: 'w', repeat: false, target: inputEl });
  mockWin.dispatch('keydown', { code: 'KeyA', key: 'a', repeat: false, target: textareaEl });
  mockWin.dispatch('keydown', { code: 'KeyS', key: 's', repeat: false, target: selectEl });
  mockWin.dispatch('keydown', { code: 'KeyD', key: 'd', repeat: false, target: editableEl });

  assert(
    playedSounds.length === 0,
    'Test 4: Ignores keystrokes inside form input fields (<input>, <textarea>, <select>, contenteditable)'
  );

  // Test 5: Dynamic mapping without hardcoded JS dictionary
  // Verify dynamically adding a new pad to DOM is recognized without changing JS code
  const customPads = [
    new MockElement('button', { dataKey: 'KeyX', dataSound: 'custom-cowbell' })
  ];
  const customDOM = { querySelectorAll: () => customPads };
  const customController = new KeyboardController({
    root: customDOM,
    targetWindow: mockWin,
    onPlaySound: (soundId) => playedSounds.push(soundId)
  });
  customController.start();

  playedSounds.length = 0;
  mockWin.dispatch('keydown', { code: 'KeyX', key: 'x', repeat: false, target: {} });
  assert(
    playedSounds.length === 1 && playedSounds[0] === 'custom-cowbell',
    'Test 5: Dynamically resolves new keys directly from DOM without hardcoded JS mappings'
  );

  // Test 6: Visual feedback state applied on keydown and removed on keyup
  const testPad = customPads[0];
  mockWin.dispatch('keydown', { code: 'KeyX', key: 'x', repeat: false, target: {} });
  const hasPressedAfterDown = testPad.classList.contains('pressed');
  mockWin.dispatch('keyup', { code: 'KeyX', key: 'x', target: {} });
  const hasPressedAfterUp = testPad.classList.contains('pressed');

  assert(
    hasPressedAfterDown === true && hasPressedAfterUp === false,
    'Test 6: Visual active state (.pressed) toggled on keydown and cleared on keyup'
  );

  // Test 7: Confirm NO recorder implemented
  const controllerCode = fs.readFileSync(path.join(__dirname, '../js/keyboard-controller.js'), 'utf8');
  const mainCode = fs.readFileSync(path.join(__dirname, '../js/main.js'), 'utf8');
  const hasRecorder = controllerCode.includes('BeatRecorder') || mainCode.includes('BeatRecorder');
  assert(
    !hasRecorder,
    'Test 7: Strictly does NOT implement recorder logic in Step 3'
  );

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
