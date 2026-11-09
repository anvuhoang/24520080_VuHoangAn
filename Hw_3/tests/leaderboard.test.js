// tests/leaderboard.test.js
import { describe, expect, it } from 'vitest';
import { STANDINGS } from '../src/arena/arenaData.js';
import { SORT_KEYS, selectStandings, totalPts } from '../src/arena/leaderboard.js';

const ids = (list) => list.map((s) => s.squadId).join(',');

describe('totalPts', () => {
  it('adds placement and kill points', () => {
    expect(STANDINGS.map(totalPts)).toEqual([330, 319, 250, 220]);
  });

  it('counts missing or invalid numbers as 0', () => {
    expect(totalPts({})).toBe(0);
    expect(totalPts(undefined)).toBe(0);
    expect(totalPts({ placementPts: Number.NaN, killPts: 5 })).toBe(5);
    expect(totalPts({ placementPts: '9', killPts: 1 })).toBe(1);
  });
});

describe('selectStandings sort', () => {
  it('gives a different order for each of the four keys', () => {
    expect(SORT_KEYS).toEqual(['wwcd', 'placement', 'kills', 'total']);
    expect(ids(selectStandings(STANDINGS, { sortBy: 'wwcd' }))).toBe('te,roy,ces,agg');
    expect(ids(selectStandings(STANDINGS, { sortBy: 'placement' }))).toBe('te,agg,ces,roy');
    expect(ids(selectStandings(STANDINGS, { sortBy: 'kills' }))).toBe('ces,te,roy,agg');
    expect(ids(selectStandings(STANDINGS, { sortBy: 'total' }))).toBe('te,ces,roy,agg');
  });

  it('sorts by total when the key is missing or unknown', () => {
    expect(ids(selectStandings(STANDINGS))).toBe('te,ces,roy,agg');
    expect(ids(selectStandings(STANDINGS, { sortBy: 'bogus' }))).toBe('te,ces,roy,agg');
    expect(ids(selectStandings(STANDINGS, undefined))).toBe('te,ces,roy,agg');
  });

  it('breaks ties by squad name, whatever the order of the input', () => {
    const tie = [
      { squadId: 'b', squadName: 'Bravo', wwcdCount: 2, placementPts: 10, killPts: 10 },
      { squadId: 'a', squadName: 'alpha', wwcdCount: 2, placementPts: 10, killPts: 10 },
      { squadId: 'c', squadName: 'Charlie', wwcdCount: 2, placementPts: 5, killPts: 15 },
      { squadId: 'd', squadName: 'Đông', wwcdCount: 1, placementPts: 20, killPts: 0 },
      { squadId: 'e', squadName: 'Zeta', wwcdCount: 1, placementPts: 20, killPts: 0 },
    ];
    expect(ids(selectStandings(tie, { sortBy: 'wwcd' }))).toBe('a,b,c,d,e');
    expect(ids(selectStandings(tie, { sortBy: 'total' }))).toBe('a,b,c,d,e');
    expect(ids(selectStandings(tie, { sortBy: 'kills' }))).toBe('c,a,b,d,e');
    expect(ids(selectStandings(tie.toReversed(), { sortBy: 'total' }))).toBe('a,b,c,d,e');
  });
});

describe('selectStandings search', () => {
  const search = (query) => ids(selectStandings(STANDINGS, { query }));

  it('ignores case and the spaces around the text', () => {
    expect(search('e')).toBe('te,ces,roy');
    expect(search('E')).toBe('te,ces,roy');
    expect(search('ROY')).toBe('roy');
    expect(search('  roy  ')).toBe('roy');
    expect(search('ESPORTS ')).toBe('ces,roy');
    expect(search('the expendables')).toBe('te');
  });

  it('keeps the spaces inside the text', () => {
    expect(search('The  Expendables')).toBe('');
  });

  it('shows everyone for an empty, blank or missing query and no one for no match', () => {
    for (const query of ['', ' ', null, undefined]) expect(search(query)).toBe('te,ces,roy,agg');
    expect(search('zzz')).toBe('');
  });
});

describe('selectStandings minimum total', () => {
  const atLeast = (minTotal) => ids(selectStandings(STANDINGS, { minTotal }));

  it('filters on the total of placement and kill points', () => {
    expect(atLeast(220)).toBe('te,ces,roy,agg');
    expect(atLeast(221)).toBe('te,ces,roy');
    expect(atLeast(319)).toBe('te,ces');
    expect(atLeast(320)).toBe('te');
    expect(atLeast(330)).toBe('te');
    expect(atLeast(331)).toBe('');
  });

  it('treats a number that is not valid as no minimum', () => {
    for (const value of [undefined, null, Number.NaN, Infinity, -Infinity, '300', -10, 0]) {
      expect(atLeast(value)).toBe('te,ces,roy,agg');
    }
  });

  it('combines with the search and the sort', () => {
    expect(ids(selectStandings(STANDINGS, { query: 'esports', minTotal: 240, sortBy: 'kills' }))).toBe('ces,roy');
    expect(selectStandings(STANDINGS, { query: 'agg', minTotal: 999 })).toEqual([]);
  });
});

describe('selectStandings purity', () => {
  it('never changes the input and always returns a new array with the same items', () => {
    const copy = [...STANDINGS].reverse();
    const before = ids(copy);
    const out = selectStandings(copy, { sortBy: 'kills', query: '', minTotal: 0 });
    expect(ids(copy)).toBe(before);
    expect(out).not.toBe(copy);
    expect(out.every((item) => copy.includes(item))).toBe(true);
    expect(selectStandings(STANDINGS)).not.toBe(STANDINGS);
  });

  it('works on a frozen array and gives the same result every time', () => {
    const frozen = Object.freeze([...STANDINGS]);
    const results = new Set(Array.from({ length: 500 }, () => ids(selectStandings(frozen, { query: 'e', minTotal: 230, sortBy: 'placement' }))));
    expect(results.size).toBe(1);
  });

  it('returns an empty array for something that is not an array', () => {
    for (const value of [null, undefined, 'abc', {}, 5]) expect(selectStandings(value)).toEqual([]);
    expect(selectStandings([])).toEqual([]);
  });

  it('does not throw for items with missing fields', () => {
    const list = [{ squadId: 'x' }, { squadId: 'y', squadName: 'Y', wwcdCount: 1 }];
    expect(ids(selectStandings(list, { sortBy: 'wwcd' }))).toBe('y,x');
  });
});
