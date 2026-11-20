// client/tests/sourceHygiene.test.js — project-rules.md checks that a grep would do, kept as tests so they cannot be forgotten.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const files = readdirSync('src').map((name) => ({ name, text: readFileSync(join('src', name), 'utf8') }));
const jsx = files.filter((f) => f.name.endsWith('.jsx'));
const css = files.filter((f) => f.name.endsWith('.module.css'));

const banned = [
  ['<div', /<div[\s>]/],
  ['<span', /<span[\s>]/],
  ['keyCode', /keyCode/],
  ['alert(', /\balert\(/],
  ['console.', /console\./],
  ['inline style prop', /style=\{/],
  ['defaultProps', /defaultProps/],
  ['Math.random', /Math\.random/],
  ['dangerouslySetInnerHTML', /dangerouslySetInnerHTML/],
  ['didCancel flag', /didCancel/],
  ['react-router (this page has no routes)', /react-router/],
  ['a hard-coded host or port', /localhost|127\.0\.0\.1|:\d{4}\b/],
];

describe('source hygiene', () => {
  for (const [label, pattern] of banned) {
    it(`no ${label} in src`, () => {
      expect(files.filter((f) => pattern.test(f.text)).map((f) => f.name)).toEqual([]);
    });
  }

  it('useEffect appears once, in useDeck.js, for the load (an external system); everything else is derived or in handlers', () => {
    const hits = files.filter((f) => /useEffect\(/.test(f.text));
    expect(hits.map((f) => f.name)).toEqual(['useDeck.js']);
    expect(hits[0].text.match(/useEffect\(/g)).toHaveLength(1);
  });

  it('the load effect aborts its requests in the cleanup', () => {
    const text = files.find((f) => f.name === 'useDeck.js').text;
    expect(text).toMatch(/new AbortController\(\)/);
    expect(text).toMatch(/return \(\) => controller\.abort\(\)/);
  });

  it('the score and the stats are never stored in state', () => {
    for (const f of files) {
      expect(f.text, f.name).not.toMatch(/useState\([^)]*score/i);
      expect(f.text, f.name).not.toMatch(/setScore/);
    }
  });

  it('buttons use aria-disabled, not the disabled attribute (so keyboard focus is kept)', () => {
    for (const f of jsx) expect(f.text, f.name).not.toMatch(/<button[^>]*\sdisabled[=\s>]/);
  });

  it('every <button> has visible text', () => {
    for (const f of jsx) {
      for (const [, body] of f.text.matchAll(/<button[\s\S]*?>([\s\S]*?)<\/button>/g)) {
        expect(body.trim().length, f.name).toBeGreaterThan(0);
      }
    }
  });

  it('the pointer start is kept in a ref, not in state', () => {
    const text = files.find((f) => f.name === 'SwipeCard.jsx').text;
    expect(text).toMatch(/useRef\(null\)/);
    expect(text).not.toMatch(/useState/);
  });

  it('component styles use tokens only: no hex or rgb colors in a module', () => {
    for (const f of css) expect(f.text, f.name).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  });
});
