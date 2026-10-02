/* ==========================================
   ENTERPRISE THEME ENGINE (Dark Mode)
   ========================================== */
(function ThemeEngine() {
  'use strict';

  // State Persistence Constraint: Strictly 'theme' key in localStorage
  const STORAGE_KEY = 'theme';
  const THEME_ATTR = 'data-theme';
  const DARK_THEME = 'dark';
  const LIGHT_THEME = 'light';

  /**
   * Safe getter for stored theme preference
   * @returns {string} 'dark' | 'light'
   */
  function getPreferredTheme() {
    try {
      const storedTheme = localStorage.getItem(STORAGE_KEY);
      if (storedTheme === DARK_THEME || storedTheme === LIGHT_THEME) {
        return storedTheme;
      }
    } catch (e) {
      // Handles potential SecurityError in restricted iframe context
    }
    
    // Fallback to system preference
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? DARK_THEME
      : LIGHT_THEME;
  }

  /**
   * Applies target theme to DOM root and updates UI controls
   * @param {string} theme - 'dark' | 'light'
   */
  function applyTheme(theme) {
    const isDark = theme === DARK_THEME;
    const root = document.documentElement;

    if (isDark) {
      root.setAttribute(THEME_ATTR, DARK_THEME);
    } else {
      root.removeAttribute(THEME_ATTR);
    }

    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (e) {
      // Handles storage write errors smoothly without breaking runtime
    }

    // Synchronize UI Button State
    const toggleBtn = document.getElementById('theme-toggle');
    const toggleIcon = document.getElementById('theme-icon');
    const toggleText = document.getElementById('theme-text');

    if (toggleBtn) {
      toggleBtn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
    }
    if (toggleIcon) {
      toggleIcon.textContent = isDark ? '☀️' : '🌙';
    }
    if (toggleText) {
      toggleText.textContent = isDark ? 'Light Mode' : 'Dark Mode';
    }
  }

  /**
   * Toggles theme state on user interaction
   */
  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute(THEME_ATTR) === DARK_THEME
      ? DARK_THEME
      : LIGHT_THEME;
    
    const newTheme = currentTheme === DARK_THEME ? LIGHT_THEME : DARK_THEME;
    applyTheme(newTheme);
  }

  // Initialize Theme Immediately to Prevent FOUC
  const initialTheme = getPreferredTheme();
  applyTheme(initialTheme);

  // Attach Event Listeners on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = document.getElementById('theme-toggle');

    if (!toggleBtn) return;

    // Mouse & Keyboard Click Listener (Enter / Space triggered automatically on <button>)
    toggleBtn.addEventListener('click', (event) => {
      event.preventDefault();
      toggleTheme();
    });

    // Handle System Theme Changes dynamically
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem(STORAGE_KEY)) {
          applyTheme(e.matches ? DARK_THEME : LIGHT_THEME);
        }
      });
    }
  });
})();