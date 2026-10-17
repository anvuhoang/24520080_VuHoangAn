/**
 * Exercise 3 — Resilient State Machine & Async Engine (Phase 1)
 *
 * Implements:
 * - ViewState<T> runtime contract with strictly restricted states (IDLE, LOADING, SUCCESS, ERROR)
 * - Safe state transition engine
 * - Async loadData() with race-condition protection via sequence token tracking
 * - Data stored strictly in SUCCESS; error messages stored strictly in ERROR
 * - Robust error handling for all thrown types
 */

/**
 * Supported State Statuses
 */
export const StateStatus = Object.freeze({
  IDLE: 'IDLE',
  LOADING: 'LOADING',
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR'
});

/**
 * Creates an IDLE state object.
 * @returns {{ status: 'IDLE' }}
 */
export function createIdleState() {
  return { status: StateStatus.IDLE };
}

/**
 * Creates a LOADING state object.
 * @returns {{ status: 'LOADING' }}
 */
export function createLoadingState() {
  return { status: StateStatus.LOADING };
}

/**
 * Creates a SUCCESS state object containing data.
 * @template T
 * @param {T} data
 * @returns {{ status: 'SUCCESS', data: T }}
 */
export function createSuccessState(data) {
  return { status: StateStatus.SUCCESS, data };
}

/**
 * Creates an ERROR state object containing an error message.
 * @param {string|Error|any} error
 * @returns {{ status: 'ERROR', error: string }}
 */
export function createErrorState(error) {
  const errorMessage =
    error instanceof Error
      ? error.message
      : typeof error === 'string' && error.trim() !== ''
        ? error
        : typeof error === 'object' && error !== null && error.message
          ? String(error.message)
          : 'An unexpected error occurred';

  return { status: StateStatus.ERROR, error: errorMessage };
}

/**
 * Validates that an object conforms strictly to the ViewState<T> discriminated union contract:
 * - status must be one of IDLE, LOADING, SUCCESS, ERROR
 * - data is allowed ONLY when status === SUCCESS
 * - error is allowed ONLY when status === ERROR and must be a non-empty string
 *
 * @param {any} state
 * @returns {boolean}
 */
export function isValidState(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    return false;
  }

  const { status } = state;
  if (![StateStatus.IDLE, StateStatus.LOADING, StateStatus.SUCCESS, StateStatus.ERROR].includes(status)) {
    return false;
  }

  // Ensure data exists strictly in SUCCESS state
  if (status === StateStatus.SUCCESS) {
    if (!('data' in state)) return false;
  } else {
    if ('data' in state) return false;
  }

  // Ensure error exists strictly in ERROR state
  if (status === StateStatus.ERROR) {
    if (typeof state.error !== 'string' || state.error.trim() === '') return false;
  } else {
    if ('error' in state) return false;
  }

  return true;
}

/**
 * Factory for creating an asynchronous data loader with race-condition protection.
 * Uses monotonically increasing sequence tokens to discard stale/out-of-order responses.
 *
 * @param {Function} onStateChange - Callback invoked on state transitions
 * @returns {{ loadData: Function, getCurrentRequestId: Function, reset: Function }}
 */
export function createAsyncDataLoader(onStateChange) {
  if (typeof onStateChange !== 'function') {
    throw new TypeError('onStateChange must be a callback function');
  }

  let currentRequestId = 0;

  /**
   * Executes an asynchronous fetcher function safely.
   * Discards stale responses if a newer request was dispatched while this request was in flight.
   *
   * @template T
   * @param {() => Promise<T>} fetcher
   * @returns {Promise<{ stale: boolean, data?: T, error?: string }>}
   */
  async function loadData(fetcher) {
    if (typeof fetcher !== 'function') {
      throw new TypeError('Fetcher must be a function returning a Promise');
    }

    const requestId = ++currentRequestId;

    // Transition to LOADING
    onStateChange(createLoadingState());

    try {
      const data = await fetcher();

      // Race-condition check: if a newer request began, discard this result
      if (requestId !== currentRequestId) {
        return { stale: true };
      }

      // Transition to SUCCESS with retrieved data
      onStateChange(createSuccessState(data));
      return { stale: false, data };
    } catch (err) {
      // Race-condition check: discard stale error
      if (requestId !== currentRequestId) {
        return { stale: true };
      }

      // Transition to ERROR with safe error message
      const errorState = createErrorState(err);
      onStateChange(errorState);
      return { stale: false, error: errorState.error };
    }
  }

  function getCurrentRequestId() {
    return currentRequestId;
  }

  function reset() {
    currentRequestId++;
    onStateChange(createIdleState());
  }

  return { loadData, getCurrentRequestId, reset };
}

/**
 * Resilient State Machine managing 4-state lifecycle with event subscriptions.
 */
export class ResilientStateMachine {
  constructor(initialState = createIdleState()) {
    if (!isValidState(initialState)) {
      throw new TypeError('Invalid initial ViewState');
    }
    this._state = initialState;
    this._listeners = new Set();
    this._loader = createAsyncDataLoader((nextState) => this._setState(nextState));
  }

  getState() {
    return this._state;
  }

  subscribe(listener) {
    if (typeof listener !== 'function') {
      throw new TypeError('Listener must be a function');
    }
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  _setState(nextState) {
    if (!isValidState(nextState)) {
      throw new TypeError('Attempted to transition to an invalid ViewState');
    }
    this._state = nextState;
    for (const listener of this._listeners) {
      try {
        listener(this._state);
      } catch (e) {
        console.error('State listener error:', e);
      }
    }
  }

  async loadData(fetcher) {
    return this._loader.loadData(fetcher);
  }

  reset() {
    this._loader.reset();
  }
}

export default {
  StateStatus,
  createIdleState,
  createLoadingState,
  createSuccessState,
  createErrorState,
  isValidState,
  createAsyncDataLoader,
  ResilientStateMachine
};
