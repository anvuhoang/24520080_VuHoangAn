// src/data/people.js
// Sample records for the master-detail directory (one fixed, unique id per person).
export const PEOPLE = Object.freeze([
  Object.freeze({ id: 'ada', name: 'Ada Lovelace', role: 'Mathematician', team: 'Analytical Engine', since: 1833 }),
  Object.freeze({ id: 'alan', name: 'Alan Turing', role: 'Logician', team: 'Computing Machinery', since: 1936 }),
  Object.freeze({ id: 'grace', name: 'Grace Hopper', role: 'Compiler pioneer', team: 'UNIVAC', since: 1949 }),
  Object.freeze({ id: 'katherine', name: 'Katherine Johnson', role: 'Orbital mechanics', team: 'NASA', since: 1953 }),
  Object.freeze({ id: 'margaret', name: 'Margaret Hamilton', role: 'Flight software lead', team: 'Apollo', since: 1960 }),
]);
