// src/arena/arenaData.js
// SAMPLE DATA: every title, price, stock and score below is invented for this exercise.
// None of it is an official PUBG Vietnam Series result, price or ticket offer.

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;

// How long a drop stays open after its drop time
export const DROP_WINDOW_MS = 30 * MINUTE_MS;

// Drop times are counted from the moment this module loads
const loadedAtMs = Date.now();

export const CRATES = Object.freeze([
  Object.freeze({
    id: 'gcoin-crate-2500',
    title: 'G-Coin Contraband Crate + 2,500 G-Coin',
    priceVnd: 199000,
    remainingStock: 1,
    dropEpochMs: loadedAtMs - MINUTE_MS,
  }),
  Object.freeze({
    id: 'pvs-gold-crate',
    title: 'PVS Gold Contraband Crate',
    priceVnd: 490000,
    remainingStock: 30,
    dropEpochMs: loadedAtMs + 20 * SECOND_MS,
  }),
  Object.freeze({
    id: 'pvs-vip-pass',
    title: 'PVS Finals VIP Pass + 5,000 G-Coin',
    priceVnd: 1200000,
    remainingStock: 20,
    dropEpochMs: loadedAtMs + 10 * MINUTE_MS,
  }),
  Object.freeze({
    id: 'pvs-standard-ticket',
    title: 'PVS Grand Finals Ticket (Standard)',
    priceVnd: 350000,
    remainingStock: 80,
    dropEpochMs: loadedAtMs - 2 * HOUR_MS,
  }),
]);

export const STANDINGS = Object.freeze([
  Object.freeze({ squadId: 'te', squadName: 'The Expendables', wwcdCount: 5, placementPts: 142, killPts: 188 }),
  Object.freeze({ squadId: 'ces', squadName: 'Cerberus Esports', wwcdCount: 2, placementPts: 118, killPts: 201 }),
  Object.freeze({ squadId: 'roy', squadName: 'Roy Esports', wwcdCount: 3, placementPts: 96, killPts: 154 }),
  Object.freeze({ squadId: 'agg', squadName: 'AGG', wwcdCount: 1, placementPts: 130, killPts: 90 }),
]);
