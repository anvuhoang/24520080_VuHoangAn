// client/tests/sourceHygiene.test.js — project-rules.md checks that a grep would do, kept as tests so they cannot be forgotten.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const names = readdirSync('src', { recursive: true }).filter((name) => statSync(join('src', name)).isFile());
const files = names.map((name) => ({ name: name.replaceAll('\\', '/'), text: readFileSync(join('src', name), 'utf8') }));
const jsx = files.filter((f) => f.name.endsWith('.jsx'));
const css = files.filter((f) => f.name.endsWith('.module.css'));
const byName = (name) => files.find((f) => f.name === name).text;

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
  ['<Switch', /<Switch/],
  ['<Redirect', /<Redirect/],
  ['activeClassName', /activeClassName/],
  ['react-router-dom', /react-router-dom/],
  ['component={…} on a Route', /component=\{/],
  ['a hard-coded host or port', /localhost|127\.0\.0\.1|:\d{4}\b/],
  ['setInterval', /setInterval/],
];

describe('source hygiene', () => {
  for (const [label, pattern] of banned) {
    it(`no ${label} in src`, () => {
      expect(files.filter((f) => pattern.test(f.text)).map((f) => f.name)).toEqual([]);
    });
  }

  it('useEffect appears only where something outside React is involved: the three loaders', () => {
    const hits = files.filter((f) => /useEffect\(/.test(f.text)).map((f) => f.name).sort();
    expect(hits).toEqual(['appeal/useAppeal.js', 'dossier/useDossiers.js', 'sla/useAppealSlaTimer.js']);
  });

  it('the form files have no effect at all (no useEffect, no useLayoutEffect)', () => {
    for (const f of files.filter((x) => x.name.startsWith('appeal/') && /Form|Field/.test(x.name))) {
      expect(f.text, f.name).not.toMatch(/useEffect|useLayoutEffect/);
    }
  });

  it('the errors of the rules are derived while rendering and never stored', () => {
    const text = byName('appeal/AppealForm.jsx');
    expect(text).toMatch(/const errors = validateAppeal\(values\)/);
    expect(text).not.toMatch(/useState\([^)]*errors/i);
    expect(text).not.toMatch(/setErrors/);
  });

  it('every loader aborts its requests in the cleanup', () => {
    for (const name of ['appeal/useAppeal.js', 'dossier/useDossiers.js']) {
      const text = byName(name);
      expect(text, name).toMatch(/new AbortController\(\)/);
      expect(text, name).toMatch(/return \(\) => controller\.abort\(\)/);
    }
  });

  describe('the timer', () => {
    const timer = () => byName('sla/useAppealSlaTimer.js');

    it('plans one setTimeout at a time and clears it in the cleanup', () => {
      expect(timer()).toMatch(/setTimeout\(/);
      expect(timer()).toMatch(/clearTimeout\(timer\)/);
    });

    it('computes from the absolute deadline and the clock offset, never by subtracting a step from a counter', () => {
      expect(timer()).toMatch(/deadlineMs - \(now \+ offset\)/);
      expect(timer()).toMatch(/deadlineMs - \(current \+ offset\)/);
      expect(timer()).not.toMatch(/(remaining|remainingMs|left|count)\w*\s*(-=|=\s*\w+\s*-\s*(1000|SECOND))/);
      expect(timer()).not.toMatch(/prev\w*\s*-\s*(1000|SECOND)/);
    });

    it('removes every listener it adds, with the same function', () => {
      expect(timer()).toMatch(/document\.addEventListener\('visibilitychange', handleVisibility\)/);
      expect(timer()).toMatch(/document\.removeEventListener\('visibilitychange', handleVisibility\)/);
      expect(timer()).toMatch(/window\.addEventListener\('online', resync\)/);
      expect(timer()).toMatch(/window\.removeEventListener\('online', resync\)/);
    });

    it('aborts the request that is still on its way in the cleanup', () => {
      expect(timer()).toMatch(/controller\?\.abort\(\)/);
    });
  });

  it('buttons use aria-disabled, not the disabled attribute (so keyboard focus is kept)', () => {
    for (const f of jsx) expect(f.text, f.name).not.toMatch(/<button[^>]*\sdisabled[=\s>]/);
  });

  it('every <button> has visible text', () => {
    for (const f of jsx) {
      for (const [, body] of f.text.matchAll(/<button[\s\S]*?>([\s\S]*?)<\/button>/g)) expect(body.trim().length, f.name).toBeGreaterThan(0);
    }
  });

  it('every form control is wired to a label with an id from useId', () => {
    const text = byName('appeal/FormField.jsx');
    expect(text).toMatch(/useId\(\)/);
    expect(text).toMatch(/htmlFor=\{id\}/);
    expect(text).toMatch(/'aria-invalid'/);
    expect(text).toMatch(/'aria-describedby'/);
  });

  it('the routes are the v7 ones: Routes, Route element, Outlet context, :playerID', () => {
    const text = byName('App.jsx');
    expect(text).toMatch(/<Route path=":playerID" element=\{<DossierView \/>\}/);
    expect(text).toMatch(/<Routes>/);
    expect(byName('dossier/DossierLayout.jsx')).toMatch(/<Outlet context=/);
  });

  it('the page reads the player from the URL with useParams and has no route per player', () => {
    expect(byName('dossier/DossierView.jsx')).toMatch(/useParams\(\)/);
    expect(byName('App.jsx')).not.toMatch(/dossier\/himass|dossier\/tanvuu|"himass"|'himass'/i);
  });

  it('component styles use tokens only: no hex or rgb colors in a module', () => {
    for (const f of css) expect(f.text, f.name).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  });

  it('never renders text from a user as HTML or as a link target', () => {
    for (const f of jsx) {
      expect(f.text, f.name).not.toMatch(/href=\{(values|appeal|evidence)/);
    }
  });
});
