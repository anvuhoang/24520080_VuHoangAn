/**
 * Exercise 4: Resilient Component Architecture
 * 4-State Resilient State Machine Engine
 */

const ComponentState = {
  LOADING: 'LOADING',
  LIVE: 'LIVE',
  EMPTY: 'EMPTY',
  ERROR: 'ERROR'
};

let currentState = ComponentState.LOADING;

/**
 * Updates component DOM elements to reflect the current state machine
 * @param {string} newState 
 */
function setComponentState(newState) {
  currentState = newState;

  // DOM State containers
  const loadingEl = document.getElementById('state-loading');
  const liveEl = document.getElementById('state-live');
  const emptyEl = document.getElementById('state-empty');
  const errorEl = document.getElementById('state-error');

  // Control Buttons
  const btnLoading = document.getElementById('btn-state-loading');
  const btnLive = document.getElementById('btn-state-live');
  const btnEmpty = document.getElementById('btn-state-empty');
  const btnError = document.getElementById('btn-state-error');

  // Hide all state containers
  loadingEl.classList.add('hidden');
  liveEl.classList.add('hidden');
  emptyEl.classList.add('hidden');
  errorEl.classList.add('hidden');

  // Reset button active classes
  [btnLoading, btnLive, btnEmpty, btnError].forEach(btn => btn.classList.remove('active'));

  // Announce state change to assistive technology
  const ariaStatus = document.getElementById('aria-status');

  switch (newState) {
    case ComponentState.LOADING:
      loadingEl.classList.remove('hidden');
      btnLoading.classList.add('active');
      if (ariaStatus) ariaStatus.textContent = "Loading component data...";
      break;

    case ComponentState.LIVE:
      liveEl.classList.remove('hidden');
      btnLive.classList.add('active');
      if (ariaStatus) ariaStatus.textContent = "Data loaded successfully.";
      break;

    case ComponentState.EMPTY:
      emptyEl.classList.remove('hidden');
      btnEmpty.classList.add('active');
      if (ariaStatus) ariaStatus.textContent = "No data available.";
      break;

    case ComponentState.ERROR:
      errorEl.classList.remove('hidden');
      btnError.classList.add('active');
      if (ariaStatus) ariaStatus.textContent = "Error loading data. Retry option available.";
      break;
  }
}

/**
 * Handles accessible retry trigger action
 */
function triggerRetry() {
  // Switch to loading state immediately
  setComponentState(ComponentState.LOADING);

  // Simulate network request recovery after 1.5 seconds
  setTimeout(() => {
    setComponentState(ComponentState.LIVE);
  }, 1500);
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  setComponentState(ComponentState.LOADING);
});
