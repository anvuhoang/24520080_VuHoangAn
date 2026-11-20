// server/src/dossiersSeed.js — the two case-study dossiers (fictional players). The deadline is set by the seed command, not stored here.
export const APPEAL_WINDOW_HOURS = Object.freeze({ himass: 72, tanvuu: 48 });

export const DOSSIERS_SEED = Object.freeze([
  {
    playerId: 'himass',
    name: 'Himass',
    team: 'Night Owls',
    matchesPlayed: 120,
    reportsReceived: 9,
    infractions: [
      { rule: 'Suspected macro input', severity: 4, penaltyMinutes: 4320 },
      { rule: 'Chat: repeated spam', severity: 1, penaltyMinutes: 60 },
    ],
  },
  {
    playerId: 'tanvuu',
    name: 'TanVuu',
    team: 'Night Owls',
    matchesPlayed: 118,
    reportsReceived: 11,
    infractions: [
      { rule: 'Suspected macro input', severity: 4, penaltyMinutes: 1440 },
      { rule: 'Chat: toxic language', severity: 2, penaltyMinutes: 240 },
      { rule: 'Late to match', severity: 1, penaltyMinutes: 30 },
    ],
  },
]);
