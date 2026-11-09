// src/arena/leaderboard.js
export const SORT_KEYS = Object.freeze(['wwcd', 'placement', 'kills', 'total']);

const toPoints = (value) => (Number.isFinite(value) ? value : 0);

export function totalPts(standing) {
  return toPoints(standing?.placementPts) + toPoints(standing?.killPts);
}

const SORT_VALUE = {
  wwcd: (standing) => toPoints(standing.wwcdCount),
  placement: (standing) => toPoints(standing.placementPts),
  kills: (standing) => toPoints(standing.killPts),
  total: totalPts,
};

export function selectStandings(standings, { query = '', minTotal, sortBy = 'total' } = {}) {
  if (!Array.isArray(standings)) return [];

  const needle = String(query ?? '').trim().toLowerCase();
  const minimum = typeof minTotal === 'number' && Number.isFinite(minTotal) ? minTotal : -Infinity;
  const valueOf = SORT_VALUE[sortBy] ?? SORT_VALUE.total;

  return standings
    .filter(
      (standing) =>
        String(standing.squadName ?? '').toLowerCase().includes(needle) && totalPts(standing) >= minimum
    )
    .toSorted(
      (a, b) =>
        valueOf(b) - valueOf(a) || String(a.squadName ?? '').localeCompare(String(b.squadName ?? ''), 'vi')
    );
}
