// tests/sourceHygiene.test.js — project-rules.md checks that a grep would do, kept as tests so they cannot be forgotten.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const names = readdirSync('src', { recursive: true }).filter((name) => statSync(join('src', name)).isFile());
const files = names.map((name) => ({ name, text: readFileSync(join('src', name), 'utf8') }));
const jsx = files.filter((f) => f.name.endsWith('.jsx'));
const css = files.filter((f) => f.name.endsWith('.css'));

const banned = [
  ['<div', /<div[\s>]/],
  ['<span', /<span[\s>]/],
  ['keyCode', /keyCode/],
  ['alert(', /\balert\(/],
  ['console.', /console\./],
  ['inline style prop', /style=\{/],
  ['<Switch', /<Switch/],
  ['<Redirect', /<Redirect/],
  ['activeClassName', /activeClassName/],
  ['defaultProps', /defaultProps/],
  ['Math.random', /Math\.random/],
  ['dangerouslySetInnerHTML', /dangerouslySetInnerHTML/],
  ['react-router-dom', /react-router-dom/],
  ['setSearchParams({})', /setSearchParams\(\s*\{\s*\}\s*\)/],
];

describe('source hygiene', () => {
  for (const [label, pattern] of banned) {
    it(`no ${label} in src`, () => {
      const hits = files.filter((f) => pattern.test(f.text)).map((f) => f.name);
      expect(hits).toEqual([]);
    });
  }

  it('no useEffect anywhere: the URL is the state and the dialog is opened from a ref callback', () => {
    expect(files.filter((f) => /useEffect/.test(f.text)).map((f) => f.name)).toEqual([]);
  });

  it('every <img> has width, height, alt and an onError fallback', () => {
    for (const f of jsx) {
      for (const tag of f.text.match(/<img[\s\S]*?\/>/g) ?? []) {
        expect(tag, f.name).toMatch(/width=/);
        expect(tag, f.name).toMatch(/height=/);
        expect(tag, f.name).toMatch(/alt=/);
        expect(tag, f.name).toMatch(/onError=/);
      }
    }
  });

  it('every <button> has visible text (no icon-only button without a name)', () => {
    for (const f of jsx) {
      for (const [, body] of f.text.matchAll(/<button[\s\S]*?>([\s\S]*?)<\/button>/g)) {
        expect(body.trim().length, f.name).toBeGreaterThan(0);
        expect(body, f.name).not.toMatch(/^\s*<(svg|img)/);
      }
    }
  });

  it('component styles use tokens only: no hex or rgb colors in a module', () => {
    for (const f of css.filter((c) => c.name.endsWith('.module.css'))) {
      expect(f.text, f.name).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
    }
  });

  it('imports routing from react-router (v7), not react-router-dom', () => {
    for (const f of jsx) expect(f.text, f.name).not.toMatch(/from 'react-router-dom'/);
  });
});
