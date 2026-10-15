const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_TARGET_UTC,
  isValidUtcIsoString,
  calculateRemainingTime,
  formatTimeUnit,
  createCountdown
} = require('../js/app.js');

describe('Drift-Free UTC Countdown Engine (HW3 Slice 1)', () => {
  const sampleTarget = '2026-11-01T00:00:00Z';
  const targetEpoch = Date.parse(sampleTarget);

  describe('1. UTC ISO 8601 Target Validation', () => {
    it('validates correct UTC timestamp ending in Z', () => {
      assert.strictEqual(isValidUtcIsoString('2026-11-01T00:00:00Z'), true);
      assert.strictEqual(isValidUtcIsoString('2026-12-31T23:59:59.999Z'), true);
    });

    it('rejects timestamps without terminal Z or with local offsets', () => {
      assert.strictEqual(isValidUtcIsoString('2026-11-01T00:00:00'), false);
      assert.strictEqual(isValidUtcIsoString('2026-11-01T00:00:00+07:00'), false);
      assert.strictEqual(isValidUtcIsoString('2026-11-01'), false);
      assert.strictEqual(isValidUtcIsoString('invalid-dateZ'), false);
    });

    it('throws when calculateRemainingTime receives a string not ending in Z', () => {
      assert.throws(
        () => calculateRemainingTime('2026-11-01T00:00:00+07:00', targetEpoch),
        /must be a UTC ISO 8601 string ending in 'Z'/
      );
    });
  });

  describe('2. Deterministic Drift-Free Calculation (target - Date.now())', () => {
    it('calculates remaining days, hours, minutes, and seconds accurately', () => {
      // 2 days, 3 hours, 4 minutes, 5 seconds prior to target
      const deltaMs =
        (2 * 86400 + 3 * 3600 + 4 * 60 + 5) * 1000 + 450; // includes 450 fractional ms
      const simulatedNow = targetEpoch - deltaMs;

      const result = calculateRemainingTime(sampleTarget, simulatedNow);

      assert.strictEqual(result.days, 2);
      assert.strictEqual(result.hours, 3);
      assert.strictEqual(result.minutes, 4);
      assert.strictEqual(result.seconds, 5);
      assert.strictEqual(result.totalMs, deltaMs);
      assert.strictEqual(result.isComplete, false);
    });

    it('is immune to tick drift when simulated clock jumps forward', () => {
      // Step 1: 100 seconds remaining
      let currentClock = targetEpoch - 100000;
      const step1 = calculateRemainingTime(sampleTarget, currentClock);
      assert.strictEqual(step1.seconds, 40);
      assert.strictEqual(step1.minutes, 1);

      // Step 2: Sudden 30-second tab throttling jump
      currentClock += 30000;
      const step2 = calculateRemainingTime(sampleTarget, currentClock);
      assert.strictEqual(step2.seconds, 10);
      assert.strictEqual(step2.minutes, 1);
      assert.strictEqual(step2.totalMs, 70000);
    });
  });

  describe('3. Clamping at Zero & Completion', () => {
    it('clamps remaining units to zero when now is past target', () => {
      const pastNow = targetEpoch + 60000; // 1 minute after target
      const result = calculateRemainingTime(sampleTarget, pastNow);

      assert.strictEqual(result.days, 0);
      assert.strictEqual(result.hours, 0);
      assert.strictEqual(result.minutes, 0);
      assert.strictEqual(result.seconds, 0);
      assert.strictEqual(result.totalMs, 0);
      assert.strictEqual(result.isComplete, true);
    });

    it('clamps to zero when now is exactly equal to target', () => {
      const result = calculateRemainingTime(sampleTarget, targetEpoch);

      assert.strictEqual(result.days, 0);
      assert.strictEqual(result.hours, 0);
      assert.strictEqual(result.minutes, 0);
      assert.strictEqual(result.seconds, 0);
      assert.strictEqual(result.totalMs, 0);
      assert.strictEqual(result.isComplete, true);
    });
  });

  describe('4. Formatting Utility', () => {
    it('formats numbers with two-digit zero padding', () => {
      assert.strictEqual(formatTimeUnit(0), '00');
      assert.strictEqual(formatTimeUnit(7), '07');
      assert.strictEqual(formatTimeUnit(14), '14');
      assert.strictEqual(formatTimeUnit(120), '120');
    });
  });

  describe('5. Timer Controller & Memory Leak Prevention', () => {
    it('updates mocked DOM elements on tick', () => {
      const mockElements = {
        daysEl: { textContent: '' },
        hoursEl: { textContent: '' },
        minutesEl: { textContent: '' },
        secondsEl: { textContent: '' }
      };

      // 1 day, 2 hours, 3 minutes, 4 seconds remaining
      const delta = (1 * 86400 + 2 * 3600 + 3 * 60 + 4) * 1000;
      const fakeNow = () => targetEpoch - delta;

      const timer = createCountdown({
        target: sampleTarget,
        elements: mockElements,
        nowFn: fakeNow
      });

      timer.tick();

      assert.strictEqual(mockElements.daysEl.textContent, '01');
      assert.strictEqual(mockElements.hoursEl.textContent, '02');
      assert.strictEqual(mockElements.minutesEl.textContent, '03');
      assert.strictEqual(mockElements.secondsEl.textContent, '04');
    });

    it('stops timer and invokes onComplete when target is reached', () => {
      let completedCalled = false;
      const fakeNow = () => targetEpoch + 1000; // Past target

      const timer = createCountdown({
        target: sampleTarget,
        nowFn: fakeNow,
        onComplete: (time) => {
          completedCalled = true;
          assert.strictEqual(time.isComplete, true);
        }
      });

      timer.start();

      assert.strictEqual(completedCalled, true);
      assert.strictEqual(timer.isRunning(), false);
    });

    it('cleans up interval resources on manual stop()', () => {
      let clock = targetEpoch - 10000;
      const fakeNow = () => clock;

      const timer = createCountdown({
        target: sampleTarget,
        nowFn: fakeNow
      });

      timer.start();
      assert.strictEqual(timer.isRunning(), true);

      timer.stop();
      assert.strictEqual(timer.isRunning(), false);
    });
  });
});
