/**
 * Test Suite for Exercise 3 - Phase 1
 *
 * Verifies:
 * - ViewState<T> discriminated union contract & strict state restrictions
 * - Data stored strictly in SUCCESS; error stored strictly in ERROR
 * - State transitions: IDLE -> LOADING -> SUCCESS and IDLE -> LOADING -> ERROR
 * - Retry state transition: ERROR -> LOADING -> SUCCESS
 * - Safe handling of various thrown error types
 * - Race-condition protection: stale responses and errors are safely discarded
 */

import {
  StateStatus,
  createIdleState,
  createLoadingState,
  createSuccessState,
  createErrorState,
  isValidState,
  createAsyncDataLoader,
  ResilientStateMachine
} from './state-machine.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(
      message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ PASS: ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
  }
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

console.log('\n=========================================');
console.log(' Exercise 3 - Phase 1 State Machine Tests');
console.log('=========================================\n');

async function runAllTests() {
  await test('ViewState contract restricts states strictly to IDLE, LOADING, SUCCESS, ERROR', () => {
    assert(isValidState({ status: 'IDLE' }));
    assert(isValidState({ status: 'LOADING' }));
    assert(isValidState({ status: 'SUCCESS', data: [1, 2, 3] }));
    assert(isValidState({ status: 'ERROR', error: 'Failed to load' }));

    // Reject unknown statuses
    assert(!isValidState({ status: 'UNKNOWN' }));
    assert(!isValidState({ status: '' }));
    assert(!isValidState(null));
    assert(!isValidState(undefined));
  });

  await test('Data is stored only in SUCCESS state; rejected in other states', () => {
    // Valid SUCCESS with data
    assert(isValidState({ status: 'SUCCESS', data: { id: 1 } }));

    // SUCCESS without data is invalid
    assert(!isValidState({ status: 'SUCCESS' }));

    // IDLE, LOADING, ERROR cannot have data property
    assert(!isValidState({ status: 'IDLE', data: 'stray data' }));
    assert(!isValidState({ status: 'LOADING', data: 'stray data' }));
    assert(!isValidState({ status: 'ERROR', error: 'err', data: 'stray data' }));
  });

  await test('Error is stored only in ERROR state; rejected in other states', () => {
    // Valid ERROR with error string
    assert(isValidState({ status: 'ERROR', error: 'Network timeout' }));

    // ERROR without error string is invalid
    assert(!isValidState({ status: 'ERROR' }));
    assert(!isValidState({ status: 'ERROR', error: '' }));

    // IDLE, LOADING, SUCCESS cannot have error property
    assert(!isValidState({ status: 'IDLE', error: 'stray error' }));
    assert(!isValidState({ status: 'LOADING', error: 'stray error' }));
    assert(!isValidState({ status: 'SUCCESS', data: 'valid', error: 'stray error' }));
  });

  await test('Deterministic transitions: IDLE -> LOADING -> SUCCESS', async () => {
    const sm = new ResilientStateMachine();
    assertEqual(sm.getState().status, StateStatus.IDLE);

    const statesHistory = [];
    sm.subscribe((state) => statesHistory.push({ ...state }));

    const mockFetcher = async () => {
      await delay(20);
      return [{ id: 101, title: 'Project A' }];
    };

    const promise = sm.loadData(mockFetcher);
    // Immediate transition to LOADING
    assertEqual(sm.getState().status, StateStatus.LOADING);

    await promise;
    // Final transition to SUCCESS with payload
    assertEqual(sm.getState().status, StateStatus.SUCCESS);
    assertEqual(sm.getState().data[0].title, 'Project A');

    assertEqual(statesHistory.length, 2);
    assertEqual(statesHistory[0].status, StateStatus.LOADING);
    assertEqual(statesHistory[1].status, StateStatus.SUCCESS);
  });

  await test('Deterministic transitions: IDLE -> LOADING -> ERROR with safe error extraction', async () => {
    const sm = new ResilientStateMachine();

    const mockFailingFetcher = async () => {
      await delay(20);
      throw new Error('Connection refused by remote host');
    };

    await sm.loadData(mockFailingFetcher);

    assertEqual(sm.getState().status, StateStatus.ERROR);
    assertEqual(sm.getState().error, 'Connection refused by remote host');
  });

  await test('Handles non-Error thrown objects safely', async () => {
    const sm = new ResilientStateMachine();

    // Thrown string
    await sm.loadData(async () => {
      throw 'Raw string exception';
    });
    assertEqual(sm.getState().status, StateStatus.ERROR);
    assertEqual(sm.getState().error, 'Raw string exception');

    // Thrown plain object with message property
    await sm.loadData(async () => {
      throw { message: 'Custom API error object' };
    });
    assertEqual(sm.getState().status, StateStatus.ERROR);
    assertEqual(sm.getState().error, 'Custom API error object');

    // Thrown null
    await sm.loadData(async () => {
      throw null;
    });
    assertEqual(sm.getState().status, StateStatus.ERROR);
    assert(sm.getState().error.length > 0);
  });

  await test('Retry connection transition: ERROR -> LOADING -> SUCCESS', async () => {
    const sm = new ResilientStateMachine();

    // Step 1: Initial failure
    await sm.loadData(async () => {
      throw new Error('First attempt failed');
    });
    assertEqual(sm.getState().status, StateStatus.ERROR);

    // Step 2: Retry connection succeeds
    const retryPromise = sm.loadData(async () => {
      await delay(20);
      return 'Recovered Payload';
    });

    assertEqual(sm.getState().status, StateStatus.LOADING, 'Retry must transition to LOADING');
    await retryPromise;
    assertEqual(sm.getState().status, StateStatus.SUCCESS, 'Successful retry must transition to SUCCESS');
    assertEqual(sm.getState().data, 'Recovered Payload');
  });

  await test('Race-Condition Protection: Stale slow response does NOT overwrite newer fast response', async () => {
    const sm = new ResilientStateMachine();
    const history = [];
    sm.subscribe((state) => history.push(state));

    // Request 1: Slow request (100ms)
    const slowRequest = sm.loadData(async () => {
      await delay(100);
      return 'SLOW_RESULT_1';
    });

    // Request 2: Fast request (30ms), dispatched immediately after
    const fastRequest = sm.loadData(async () => {
      await delay(30);
      return 'FAST_RESULT_2';
    });

    // Wait for fast request to finish
    const fastResult = await fastRequest;
    assertEqual(fastResult.stale, false);
    assertEqual(sm.getState().status, StateStatus.SUCCESS);
    assertEqual(sm.getState().data, 'FAST_RESULT_2');

    // Wait for slow request to finish
    const slowResult = await slowRequest;
    assertEqual(slowResult.stale, true, 'Slow request must be marked stale');

    // Verify state remained FAST_RESULT_2 and was not overwritten by SLOW_RESULT_1
    assertEqual(sm.getState().status, StateStatus.SUCCESS);
    assertEqual(sm.getState().data, 'FAST_RESULT_2', 'State must NOT be overwritten by stale slow request');
  });

  await test('Race-Condition Protection: Stale slow error does NOT overwrite newer success', async () => {
    const sm = new ResilientStateMachine();

    // Request 1: Slow failing request (100ms)
    const slowFailure = sm.loadData(async () => {
      await delay(100);
      throw new Error('SLOW_FAILURE_1');
    });

    // Request 2: Fast successful request (30ms)
    const fastSuccess = sm.loadData(async () => {
      await delay(30);
      return 'SUCCESSFUL_RESULT_2';
    });

    await fastSuccess;
    assertEqual(sm.getState().status, StateStatus.SUCCESS);
    assertEqual(sm.getState().data, 'SUCCESSFUL_RESULT_2');

    // Wait for slow failure to resolve
    const slowResult = await slowFailure;
    assertEqual(slowResult.stale, true, 'Slow failure must be marked stale');

    // State must still be SUCCESSFUL_RESULT_2, not ERROR
    assertEqual(sm.getState().status, StateStatus.SUCCESS);
    assertEqual(sm.getState().data, 'SUCCESSFUL_RESULT_2');
  });

  console.log('\n-----------------------------------------');
  console.log(`Summary: ${passed}/${passed + failed} passed (${failed} failed)`);
  console.log('-----------------------------------------\n');

  if (typeof process !== 'undefined' && process.exitCode !== undefined) {
    process.exitCode = failed > 0 ? 1 : 0;
  }
}

runAllTests();
