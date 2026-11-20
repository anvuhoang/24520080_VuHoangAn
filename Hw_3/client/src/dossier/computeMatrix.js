// client/src/dossier/computeMatrix.js — the disproportionality matrix. A pure function: the same dossiers always give the same matrix.
//
// For each player: how many penalty minutes did each point of severity cost?  rate = penalty minutes / severity points.
// The index compares a player's rate with the mean rate of all players: 1.00 is "as the others", above 1.25 is "harsher
// than the others for the same severity", below 0.80 is "lighter".

export const HARSHER_AT = 1.25;
export const LIGHTER_AT = 0.8;

const sum = (items, pick) => items.reduce((total, item) => total + pick(item), 0);

export function verdictOf(index) {
  if (index === null) return 'no-data';
  if (index >= HARSHER_AT) return 'harsher';
  if (index <= LIGHTER_AT) return 'lighter';
  return 'proportionate';
}

export function computeMatrix(dossiers) {
  const base = (dossiers ?? []).map((dossier) => {
    const severity = sum(dossier.infractions, (i) => i.severity);
    const minutes = sum(dossier.infractions, (i) => i.penaltyMinutes);
    return {
      playerId: dossier.playerId,
      name: dossier.name,
      infractions: dossier.infractions.length,
      severity,
      minutes,
      rate: severity > 0 ? minutes / severity : null, // nothing to compare when there is no severity
    };
  });

  const rates = base.filter((row) => row.rate !== null).map((row) => row.rate);
  const mean = rates.length > 0 ? sum(rates, (r) => r) / rates.length : null;

  const rows = base.map((row) => {
    let index = null;
    if (row.rate !== null && mean !== null) index = mean === 0 ? 1 : row.rate / mean; // everybody at zero is "the same"
    return { ...row, index, verdict: verdictOf(index) };
  });

  return { mean, rows };
}
