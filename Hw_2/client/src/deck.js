// client/src/deck.js — the rules of the deck as pure functions: actions, score, key and gesture mapping.

export const LIKE = 'LIKE';
export const PASS = 'PASS';
export const SUPER = 'SUPER';

// Asymmetric on purpose: a like earns 10, a pass costs 5, a super like earns 25.
export const POINTS = Object.freeze({ [LIKE]: 10, [PASS]: -5, [SUPER]: 25 });

// Distance in pixels a pointer must travel before it counts as a swipe (slide 31 uses 50)
export const SWIPE_THRESHOLD = 50;

// The score is never stored: it is computed from the history on every render, so undo can not leave it behind.
// Object.hasOwn: an action such as "constructor" must score nothing, not an inherited function.
export const scoreOf = (history) => history.reduce((total, swipe) => total + (Object.hasOwn(POINTS, swipe.action) ? POINTS[swipe.action] : 0), 0);

export function statsOf(history) {
  const count = (action) => history.filter((swipe) => swipe.action === action).length;
  return { score: scoreOf(history), likes: count(LIKE), passes: count(PASS), supers: count(SUPER), swiped: history.length };
}

// ArrowLeft passes, ArrowRight likes, ArrowUp super-likes; Backspace is handled by the caller as undo.
const KEY_ACTIONS = Object.freeze({ ArrowLeft: PASS, ArrowRight: LIKE, ArrowUp: SUPER });
export const actionForKey = (key) => (Object.hasOwn(KEY_ACTIONS, key) ? KEY_ACTIONS[key] : null);

// A drag counts for its dominant axis: a clear upward drag is SUPER, a clear sideways drag is LIKE or PASS.
// Short drags (a tap, a jitter) and downward drags are nothing.
export function actionForGesture(dx, dy) {
  if (Math.abs(dy) > Math.abs(dx)) return dy < -SWIPE_THRESHOLD ? SUPER : null;
  if (dx > SWIPE_THRESHOLD) return LIKE;
  if (dx < -SWIPE_THRESHOLD) return PASS;
  return null;
}

export const ACTION_LABELS = Object.freeze({ [LIKE]: 'Liked', [PASS]: 'Passed', [SUPER]: 'Super-liked' });
