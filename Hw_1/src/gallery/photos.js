// src/gallery/photos.js — the evidence photos. Plain data, frozen; files live in public/photos/ (made by `npm run photos`).

export const CATEGORIES = Object.freeze([
  Object.freeze({ id: 'match', label: 'Match' }),
  Object.freeze({ id: 'chat', label: 'Chat' }),
  Object.freeze({ id: 'replay', label: 'Replay' }),
]);

const photo = (id, category, title, alt, caption, takenOn) =>
  Object.freeze({ id, category, title, alt, caption, takenOn, src: `/photos/${id}.svg`, width: 1200, height: 800 });

export const PHOTOS = Object.freeze([
  photo('m1', 'match', 'Round 1 scoreboard', 'Scoreboard after round 1 with two team bars and three stat rows', 'Both teams level after the first round.', '2026-03-14'),
  photo('m2', 'match', 'Final scoreboard', 'Scoreboard at the end of the match with the winning team bar highlighted', 'Final result as shown to both teams.', '2026-03-14'),
  photo('m3', 'match', 'Overtime scoreboard', 'Scoreboard during overtime with a shorter stat table', 'Overtime started after a tie at the end of regulation.', '2026-03-14'),
  photo('c1', 'chat', 'Team chat before the match', 'Four chat bubbles alternating between two speakers', 'Agreement on the match rules before the start.', '2026-03-14'),
  photo('c2', 'chat', 'Lobby chat during the match', 'Chat window with alternating left and right messages', 'Messages sent while the match was running.', '2026-03-14'),
  photo('c3', 'chat', 'Post-match chat', 'Chat bubbles after the match, wider than before', 'The reaction of both players after the result.', '2026-03-15'),
  photo('r1', 'replay', 'Replay at the opening', 'Replay player paused near the start with a short progress bar', 'The first seconds of the recorded match.', '2026-03-14'),
  photo('r2', 'replay', 'Replay at the disputed moment', 'Replay player at the middle of the timeline with the play button shown', 'The moment the appeal is about.', '2026-03-14'),
  photo('r3', 'replay', 'Replay at the finish', 'Replay player near the end of the timeline', 'The last seconds before the result screen.', '2026-03-14'),
]);
