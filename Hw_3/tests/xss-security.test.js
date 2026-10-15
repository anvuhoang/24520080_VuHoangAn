const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeEmail,
  validateEmail,
  renderFormUi,
  createSignupStateMachine,
  FORM_STATES
} = require('../js/app.js');

describe('Safe Input Handling & XSS Defense (HW3 Slice 3B)', () => {
  describe('1. Normalization & Control Character Scrubbing', () => {
    it('trims leading and trailing whitespace and lowercases email', () => {
      const normalized = normalizeEmail('   SENIOR.ENGINEER@AETHERIA.IO   ');
      assert.strictEqual(normalized, 'senior.engineer@aetheria.io');
    });

    it('strips ASCII control characters and null bytes from input', () => {
      const maliciousWithNull = 'engineer\x00\x08\x1B@aetheria.io';
      const normalized = normalizeEmail(maliciousWithNull);
      assert.strictEqual(normalized, 'engineer@aetheria.io');
    });

    it('returns empty string for non-string types safely', () => {
      assert.strictEqual(normalizeEmail(null), '');
      assert.strictEqual(normalizeEmail(undefined), '');
      assert.strictEqual(normalizeEmail(12345), '');
      assert.strictEqual(normalizeEmail({}), '');
    });
  });

  describe('2. Strict Injection & XSS Payload Rejection', () => {
    const maliciousPayloads = [
      "<script>alert('xss')</script>",
      '<script src="http://attacker.com/malware.js"></script>',
      '"><script>alert(document.cookie)</script>',
      '<img src="x" onerror="alert(1)">',
      '<svg/onload=alert(1)>',
      '<iframe src="javascript:alert(1)"></iframe>',
      'user@domain.com<script>alert(1)</script>',
      '"><img src=x onerror=alert(1)>@domain.com',
      'javascript:alert(1)@domain.com',
      'admin@domain.com; DROP TABLE users;--',
      'admin"onclick="alert(1)"@domain.com',
      'test`id`@domain.com',
      'test\\0@domain.com',
      "' OR '1'='1"
    ];

    for (const payload of maliciousPayloads) {
      it(`rejects malicious input payload: ${payload.slice(0, 35)}...`, () => {
        const result = validateEmail(payload);
        assert.strictEqual(result.isValid, false);
        assert.match(result.error, /valid email/i);
      });
    }

    it('rejects email exceeding RFC-5321 length of 254 characters', () => {
      const longLocalPart = 'a'.repeat(250);
      const oversizedEmail = `${longLocalPart}@domain.com`; // 261 characters
      const result = validateEmail(oversizedEmail);

      assert.strictEqual(result.isValid, false);
      assert.match(result.error, /maximum allowed length/i);
    });

    it('accepts legitimate, boundary-length email <= 254 characters', () => {
      const validBoundaryEmail = `${'a'.repeat(50)}@${'b'.repeat(50)}.com`;
      const result = validateEmail(validBoundaryEmail);

      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.sanitized, validBoundaryEmail.toLowerCase());
    });
  });

  describe('3. Safe DOM API & textContent Integrity', () => {
    it('sets textContent and NEVER uses innerHTML during error rendering', () => {
      let innerHtmlAccessed = false;

      const mockErrorMsg = {
        _text: '',
        set textContent(v) { this._text = v; },
        get textContent() { return this._text; },
        get innerHTML() { innerHtmlAccessed = true; return ''; },
        set innerHTML(v) { innerHtmlAccessed = true; }
      };

      const mockErrorBox = {
        classList: { add() {}, remove() {} }
      };

      const maliciousError = "<b onmouseover=alert('XSS')>Cluster Fault</b>";

      renderFormUi(FORM_STATES.ERROR, { error: maliciousError }, {
        errorBox: mockErrorBox,
        errorMsg: mockErrorMsg
      });

      // Assert textContent safely escapes raw HTML tags as plain literal text
      assert.strictEqual(mockErrorMsg.textContent, maliciousError);
      assert.strictEqual(innerHtmlAccessed, false, 'innerHTML must never be invoked');
    });

    it('sets textContent and NEVER uses innerHTML during success rendering', () => {
      let innerHtmlAccessed = false;

      const mockSuccessMsg = {
        _text: '',
        set textContent(v) { this._text = v; },
        get textContent() { return this._text; },
        get innerHTML() { innerHtmlAccessed = true; return ''; },
        set innerHTML(v) { innerHtmlAccessed = true; }
      };

      const mockSuccessBox = {
        classList: { add() {}, remove() {} }
      };

      const maliciousMessage = "<script>stealData()</script>Confirmation Token: 123";

      renderFormUi(FORM_STATES.SUCCESS, { message: maliciousMessage }, {
        successBox: mockSuccessBox,
        successMsg: mockSuccessMsg
      });

      assert.strictEqual(mockSuccessMsg.textContent, maliciousMessage);
      assert.strictEqual(innerHtmlAccessed, false, 'innerHTML must never be invoked');
    });

    it('state machine rejects malicious input in submit() and safely updates error UI', async () => {
      let dispatchedNetwork = false;
      const elements = {
        input: { disabled: false },
        submitBtn: { disabled: false },
        btnText: { textContent: '' },
        errorBox: { classList: { add() {}, remove() {} } },
        errorMsg: { textContent: '' }
      };

      const machine = createSignupStateMachine({
        elements,
        asyncSubmit: async () => {
          dispatchedNetwork = true;
          return { success: true };
        }
      });

      const outcome = await machine.submit("<script>alert('pwned')</script>");

      assert.strictEqual(outcome, false);
      assert.strictEqual(dispatchedNetwork, false);
      assert.strictEqual(machine.getState(), FORM_STATES.ERROR);
      assert.match(elements.errorMsg.textContent, /special characters/i);
    });
  });
});
