// scripts/make-photos.mjs — writes the nine evidence illustrations to public/photos/ (plain SVG, about 1 kB each).
// Run with `npm run photos`. The pictures are generated so the project needs no network and no stock-photo licence.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'public', 'photos');
mkdirSync(out, { recursive: true });

const palette = {
  match: ['#0b3b5c', '#38bdf8'],
  chat: ['#3b1d5c', '#c4b5fd'],
  replay: ['#0f3d2e', '#4ade80'],
};

const scenes = {
  match: (c) => `<rect x="180" y="160" width="840" height="480" rx="24" fill="#0a0f1c" opacity=".55"/><rect x="240" y="230" width="320" height="60" rx="12" fill="${c}"/><rect x="640" y="230" width="320" height="60" rx="12" fill="#f8fafc" opacity=".8"/><rect x="240" y="330" width="720" height="24" rx="8" fill="#f8fafc" opacity=".35"/><rect x="240" y="390" width="720" height="24" rx="8" fill="#f8fafc" opacity=".35"/><rect x="240" y="450" width="560" height="24" rx="8" fill="#f8fafc" opacity=".35"/>`,
  chat: (c) => `<rect x="200" y="150" width="520" height="90" rx="40" fill="${c}"/><rect x="480" y="280" width="520" height="90" rx="40" fill="#f8fafc" opacity=".8"/><rect x="200" y="410" width="620" height="90" rx="40" fill="${c}"/><rect x="380" y="540" width="620" height="90" rx="40" fill="#f8fafc" opacity=".8"/>`,
  replay: (c) => `<polygon points="520,260 520,540 760,400" fill="${c}"/><rect x="180" y="640" width="840" height="14" rx="7" fill="#f8fafc" opacity=".35"/><rect x="180" y="640" width="470" height="14" rx="7" fill="${c}"/><circle cx="650" cy="647" r="18" fill="#f8fafc"/>`,
};

const photos = [
  ['m1', 'match', 'Round 1 scoreboard'],
  ['m2', 'match', 'Final scoreboard'],
  ['m3', 'match', 'Overtime scoreboard'],
  ['c1', 'chat', 'Team chat before the match'],
  ['c2', 'chat', 'Lobby chat during the match'],
  ['c3', 'chat', 'Post-match chat'],
  ['r1', 'replay', 'Replay at the opening'],
  ['r2', 'replay', 'Replay at the disputed moment'],
  ['r3', 'replay', 'Replay at the finish'],
];

writeFileSync(
  join(out, 'fallback.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><rect width="1200" height="800" fill="#1b2640"/><path d="M420 520l140-180 100 120 70-80 130 140z" fill="#7b8aa3"/><circle cx="500" cy="330" r="40" fill="#7b8aa3"/></svg>
`,
  'utf8'
);

for (const [id, category, title] of photos) {
  const [dark, light] = palette[category];
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${dark}"/><stop offset="1" stop-color="#0a0f1c"/></linearGradient></defs>` +
    `<rect width="1200" height="800" fill="url(#g)"/>${scenes[category](light)}</svg>\n`;
  writeFileSync(join(out, `${id}.svg`), svg, 'utf8');
  console.log(`${id}.svg  ${category}  ${title}  ${svg.length} bytes`);
}
