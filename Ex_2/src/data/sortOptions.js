// src/data/sortOptions.js
// One source of truth for the sort <select> options and their comparators.
export const SORT_OPTIONS = Object.freeze([
  { id: 'iq-desc', label: 'IQ (high to low)', compare: (a, b) => b.iq - a.iq },
  { id: 'iq-asc', label: 'IQ (low to high)', compare: (a, b) => a.iq - b.iq },
  { id: 'age-asc', label: 'Age (young to old)', compare: (a, b) => a.age - b.age },
  { id: 'age-desc', label: 'Age (old to young)', compare: (a, b) => b.age - a.age },
]);

export const DEFAULT_SORT = SORT_OPTIONS[0].id;
