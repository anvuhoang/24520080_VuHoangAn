/**
 * HW2 Step 3: Decoupled Keyboard Input Controller
 *
 * Requirements:
 * - Listens for keydown events.
 * - Throttles / ignores repeated events via event.repeat.
 * - Dynamically resolves key mappings from HTML [data-key] contract (zero hardcoded JS maps).
 * - Resolves sound identifiers from [data-sound].
 * - Calls existing playSound(soundId).
 * - Ignores unmapped keys and keystrokes inside form input fields.
 * - Completely decoupled from AudioEngine implementation and recorder modules.
 */

export class KeyboardController {
  /**
   * @param {Object} [options={}]
   * @param {ParentNode} [options.root=document] - Root container containing data-key drum pads.
   * @param {(soundId: string, element?: HTMLElement) => void} [options.onPlaySound] - Callback invoked with soundId.
   * @param {Window} [options.targetWindow=window] - Window or event target for key listeners.
   */
  constructor(options = {}) {
    this.root = options.root || (typeof document !== 'undefined' ? document : null);
    this.onPlaySound = options.onPlaySound || null;
    this.targetWindow = options.targetWindow || (typeof window !== 'undefined' ? window : null);

    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.isListening = false;
  }

  /**
   * Dynamically resolves the pad element matching the keyboard event.
   * Inspects the DOM [data-key] attributes at runtime — zero hardcoded JS keymaps.
   *
   * @param {KeyboardEvent} event
   * @returns {HTMLElement|null}
   */
  resolvePadElement(event) {
    if (!this.root || !event) return null;

    const eventCode = event.code ? event.code.toLowerCase() : '';
    const eventKey = event.key ? event.key.toLowerCase() : '';

    const pads = this.root.querySelectorAll('[data-key]');
    for (const pad of pads) {
      const attrKey = (pad.dataset.key || '').trim().toLowerCase();
      if (!attrKey) continue;

      // Match against event.code (e.g. "keyw"), event.key (e.g. "w"), or "key" + event.key
      if (
        attrKey === eventCode ||
        attrKey === eventKey ||
        attrKey === `key${eventKey}`
      ) {
        return pad;
      }
    }

    return null;
  }

  /**
   * Checks whether the event originated from a form field or editable element.
   * Keystrokes in form controls must be ignored.
   *
   * @param {KeyboardEvent} event
   * @returns {boolean}
   */
  isFormInputElement(event) {
    const target = event.target;
    if (!target) return false;

    if (target.isContentEditable) return true;

    const tagName = target.tagName ? target.tagName.toUpperCase() : '';
    if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
      return true;
    }

    if (typeof target.matches === 'function' && target.matches('input, textarea, select, [contenteditable="true"]')) {
      return true;
    }

    return false;
  }

  /**
   * Keydown handler enforcing throttling, form suppression, and dynamic dispatch.
   * @param {KeyboardEvent} event
   */
  handleKeyDown(event) {
    // 1. Ignore repeated keydown events from holding down a key
    if (event.repeat) {
      return;
    }

    // 2. Ignore keystrokes when typing in form fields
    if (this.isFormInputElement(event)) {
      return;
    }

    // 3. Dynamically resolve matching drum pad from HTML data-key contract
    const pad = this.resolvePadElement(event);
    if (!pad) {
      // Unmapped key: silently ignore
      return;
    }

    // 4. Resolve soundId from data-sound attribute
    const soundId = pad.dataset.sound;
    if (!soundId) {
      return;
    }

    // 5. Visual active feedback: apply pressed class
    pad.classList.add('pressed');

    // 6. Invoke playSound callback with resolved soundId
    if (typeof this.onPlaySound === 'function') {
      this.onPlaySound(soundId, pad);
    }
  }

  /**
   * Keyup handler to reset visual active feedback.
   * @param {KeyboardEvent} event
   */
  handleKeyUp(event) {
    const pad = this.resolvePadElement(event);
    if (pad) {
      pad.classList.remove('pressed');
    }
  }

  /**
   * Attaches keydown and keyup listeners to the target window.
   */
  start() {
    if (this.isListening || !this.targetWindow) return;
    this.targetWindow.addEventListener('keydown', this.handleKeyDown);
    this.targetWindow.addEventListener('keyup', this.handleKeyUp);
    this.isListening = true;
  }

  /**
   * Detaches listeners cleanly.
   */
  stop() {
    if (!this.isListening || !this.targetWindow) return;
    this.targetWindow.removeEventListener('keydown', this.handleKeyDown);
    this.targetWindow.removeEventListener('keyup', this.handleKeyUp);
    this.isListening = false;
  }
}
