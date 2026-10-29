import { FlashSaleEngine, SaleEndedError, SaleNotStartedError, SalePhase } from './flash-sale-engine.js';
import { LimitExceededError, OutOfStockError, ReservationExpiredError, VersionConflictError } from './inventory-fsm.js';
import { PROFILE_INFO, REGIONS, TrafficSimulator, createSeededRandom } from './traffic-simulator.js';
import { formatCountdown } from './anti-drift-timer.js';

const PRODUCTS = [
  { sku: 'PHONE', name: 'Smartphone 5G 128GB', priceMinor: 4_990_000, stock: 200, limitPerBuyer: 1 },
  { sku: 'BUDS', name: 'Wireless earbuds Pro', priceMinor: 590_000, stock: 500, limitPerBuyer: 2 },
  { sku: 'FRYER', name: 'Air fryer 5L', priceMinor: 1_290_000, stock: 800, limitPerBuyer: 2 },
];

const YOU = 'you';
const MAX_LOG_ENTRIES = 60;
const OTHER_HOLD_ROWS = 8;
const URGENT_MS = 5000;
const RENDER_DIRTY_MS = 100;
const RENDER_IDLE_MS = 250;
const SIM_MAX_DELAY_MS = 100;
const SIM_MIN_DELAY_MS = 4;
const SIM_STEP_BUDGET = 1500;

const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });
const count = new Intl.NumberFormat('en-US');

/** @param {string} id */
function byId(id) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element #${id}`);
  return node;
}

const el = {
  phaseChip: byId('phase-chip'),
  auditChip: byId('audit-chip'),
  clockLabel: byId('clock-label'),
  countdown: byId('countdown'),
  countdownNote: byId('countdown-note'),
  skew: /** @type {HTMLSelectElement} */ (byId('skew')),
  sync: /** @type {HTMLButtonElement} */ (byId('sync')),
  offsetNote: byId('offset-note'),
  form: /** @type {HTMLFormElement} */ (byId('config')),
  profile: /** @type {HTMLSelectElement} */ (byId('profile')),
  buyers: /** @type {HTMLInputElement} */ (byId('buyers')),
  startsIn: /** @type {HTMLInputElement} */ (byId('starts-in')),
  duration: /** @type {HTMLInputElement} */ (byId('duration')),
  hold: /** @type {HTMLInputElement} */ (byId('hold')),
  seed: /** @type {HTMLInputElement} */ (byId('seed')),
  start: /** @type {HTMLButtonElement} */ (byId('start')),
  stop: /** @type {HTMLButtonElement} */ (byId('stop')),
  formError: byId('form-error'),
  profileNote: byId('profile-note'),
  products: byId('products'),
  optimistic: /** @type {HTMLInputElement} */ (byId('optimistic')),
  myHolds: byId('my-holds'),
  myHoldsEmpty: byId('my-holds-empty'),
  otherHolds: byId('other-holds'),
  otherHoldsEmpty: byId('other-holds-empty'),
  allHoldsCount: byId('all-holds-count'),
  metrics: byId('metrics'),
  regions: byId('regions'),
  log: byId('log'),
};

/** Seconds the device clock is off by, in milliseconds. Read by the engine on every countdown frame. */
let skewMs = 0;
let youKeys = 0;
let run = null;

/** @param {Node} node @param {string} text */
function setText(node, text) {
  if (node.textContent !== text) node.textContent = text;
}

// ---------------------------------------------------------------------------------------
// One-time page setup
// ---------------------------------------------------------------------------------------

for (const { id, label } of PROFILE_INFO) {
  const option = document.createElement('option');
  option.value = id;
  option.textContent = label;
  el.profile.append(option);
}

function showProfileNote() {
  setText(el.profileNote, PROFILE_INFO.find((p) => p.id === el.profile.value)?.description ?? '');
}
el.profile.addEventListener('change', showProfileNote);
showProfileNote();

/** @type {Map<string, any>} */
const productCards = new Map();
{
  const template = /** @type {HTMLTemplateElement} */ (byId('product-template'));
  for (const product of PRODUCTS) {
    const root = /** @type {HTMLElement} */ (template.content.firstElementChild.cloneNode(true));
    const card = {
      root,
      bar: root.querySelector('.stockbar'),
      sold: root.querySelector('.seg.sold'),
      held: root.querySelector('.seg.held'),
      avail: root.querySelector('.seg.avail'),
      nAvail: root.querySelector('.n-avail'),
      nHeld: root.querySelector('.n-held'),
      nSold: root.querySelector('.n-sold'),
      meta: root.querySelector('.p-meta'),
      buy: /** @type {HTMLButtonElement} */ (root.querySelector('.buy')),
      version: 0,
    };
    setText(root.querySelector('.p-name'), product.name);
    setText(root.querySelector('.p-price'), money.format(product.priceMinor));
    card.buy.dataset.buy = product.sku;
    card.buy.setAttribute('aria-label', `Buy ${product.name}`);
    productCards.set(product.sku, card);
    el.products.append(root);
  }
}

const METRICS = [
  ['Buyers arrived', (m) => `${count.format(m.arrived)} / ${count.format(m.buyers)}`],
  ['Requests per second', (m, x) => `≈ ${count.format(x.rps)}`],
  ['Requests sent', (m) => count.format(m.attempts)],
  ['Holds taken', (m) => count.format(m.reserved)],
  ['Orders paid', (m) => count.format(m.paid)],
  ['Revenue', (m) => money.format(m.revenueMinor)],
  ['Refused: sold out', (m) => count.format(m.outOfStock)],
  ['Refused: before opening', (m) => count.format(m.rejectedEarly)],
  ['Version conflicts', (m) => count.format(m.conflicts)],
  ['Double clicks absorbed', (m) => count.format(m.duplicatesAbsorbed)],
  ['Abandoned carts', (m) => count.format(m.abandoned)],
  ['Expired before checkout', (m) => count.format(m.expiredBeforeCheckout)],
  ['Payments failed', (m) => count.format(m.paymentFailed)],
  ['Late payments refused', (m) => count.format(m.expiredDuringPayment)],
  ['Gave up retrying', (m) => count.format(m.gaveUp)],
  ['Latency p50 / p95', (m) => `${m.latencyMs.p50} / ${m.latencyMs.p95} ms`],
].map(([label, format]) => {
  const wrapper = document.createElement('div');
  const dt = document.createElement('dt');
  const dd = document.createElement('dd');
  dt.textContent = label;
  dd.textContent = '—';
  wrapper.append(dt, dd);
  el.metrics.append(wrapper);
  return { dd, format };
});

const regionRows = new Map();
for (const region of REGIONS) {
  const tr = document.createElement('tr');
  const cells = [document.createElement('th'), ...Array.from({ length: 3 }, () => document.createElement('td'))];
  cells[0].scope = 'row';
  cells[0].textContent = `${region.code} · ${region.name}`;
  cells.slice(1).forEach((cell) => {
    cell.className = 'num';
    cell.textContent = '—';
  });
  tr.append(...cells);
  el.regions.append(tr);
  regionRows.set(region.code, cells);
}

// ---------------------------------------------------------------------------------------
// Running a simulation
// ---------------------------------------------------------------------------------------

/** @returns {{ error: string } | { config: object }} */
function readConfig() {
  const fields = [el.buyers, el.startsIn, el.duration, el.hold, el.seed];
  const values = {};
  for (const input of fields) {
    const value = Number(input.value);
    const min = Number(input.min);
    const max = Number(input.max);
    if (input.value.trim() === '' || !Number.isInteger(value) || value < min || value > max) {
      const name = input.labels?.[0]?.textContent ?? input.name;
      return { error: `${name} must be a whole number from ${min} to ${max}.` };
    }
    values[input.name] = value;
  }
  return { config: { profile: el.profile.value, ...values } };
}

function startRun() {
  const parsed = readConfig();
  if ('error' in parsed) {
    el.formError.textContent = parsed.error;
    el.formError.hidden = false;
    return;
  }
  el.formError.hidden = true;
  const { config } = parsed;

  stopRun({ keepLog: true });

  const startsAt = Date.now() + config.startsIn * 1000;
  const endsAt = startsAt + config.duration * 1000;
  const engine = new FlashSaleEngine({
    products: PRODUCTS,
    saleStartsAt: startsAt,
    saleEndsAt: endsAt,
    serverClock: Date.now,
    clientClock: () => Date.now() + skewMs,
    holdTtlMs: config.hold * 1000,
    checkoutWindowMs: config.hold * 2000,
    maxQuantityPerRequest: 2,
    onError: (error) => log(`Internal error: ${error instanceof Error ? error.message : String(error)}`, 'bad'),
  });
  const sim = new TrafficSimulator({
    engine,
    clock: Date.now,
    random: createSeededRandom(config.seed),
    buyers: config.buyers,
    profile: config.profile,
  });

  run = {
    engine,
    sim,
    config,
    startsAt,
    unsubscribe: engine.subscribe(onEngineEvent),
    simTimer: null,
    auditTimer: null,
    frameId: null,
    dirty: true,
    lastHeavy: 0,
    lastAttempts: 0,
    lastRateAt: performance.now(),
    rps: 0,
    clientOpen: false,
    auditChecks: 0,
    soldOutLogged: new Set(),
    myRows: new Map(),
    otherRows: new Map(),
    finishedLogged: false,
  };

  setRunning(true);
  log(`Simulation armed: ${count.format(config.buyers)} buyers, "${PROFILE_INFO.find((p) => p.id === config.profile)?.label}", opens in ${config.startsIn} s.`);
  engine.start();
  sim.start(startsAt);
  driveSimulation();
  run.auditTimer = setInterval(audit, 1000);
  run.frameId = requestAnimationFrame(uiFrame);
}

/**
 * Releases everything the run owns and returns the page to its idle state.
 * @param {{ keepLog?: boolean }} [options]
 */
function stopRun({ keepLog = false } = {}) {
  if (run) {
    clearTimeout(run.simTimer);
    clearInterval(run.auditTimer);
    if (run.frameId !== null) cancelAnimationFrame(run.frameId);
    run.unsubscribe();
    run.sim.stop();
    run.engine.dispose();
    run = null;
  }
  setRunning(false);
  renderIdle();
  if (!keepLog) log('Simulation stopped.');
}

/** @param {boolean} running */
function setRunning(running) {
  el.start.disabled = running;
  el.stop.disabled = !running;
  el.sync.disabled = !running;
  for (const input of [el.profile, el.buyers, el.startsIn, el.duration, el.hold, el.seed]) input.disabled = running;
}

/** Drives the simulator with one timeout aimed at its next event. */
function driveSimulation() {
  if (!run) return;
  run.simTimer = null;
  run.sim.step(Date.now(), SIM_STEP_BUDGET);
  const next = run.sim.nextDueAt();
  if (next === null) {
    if (!run.finishedLogged) {
      run.finishedLogged = true;
      log('All virtual buyers have finished.');
    }
    return;
  }
  const delay = Math.min(SIM_MAX_DELAY_MS, Math.max(SIM_MIN_DELAY_MS, next - Date.now()));
  run.simTimer = setTimeout(driveSimulation, delay);
}

function audit() {
  if (!run) return;
  const violations = run.engine.checkInvariants();
  run.auditChecks++;
  if (violations.length === 0) {
    el.auditChip.dataset.state = 'ok';
    setText(el.auditChip, `Stock audit: OK · ${count.format(run.auditChecks)} checks`);
  } else {
    el.auditChip.dataset.state = 'bad';
    setText(el.auditChip, `Stock audit FAILED: ${violations[0].invariant}`);
    log(`Audit failed: ${violations.map((v) => `${v.invariant} ${v.message}`).join('; ')}`, 'bad');
  }
}

// ---------------------------------------------------------------------------------------
// Engine events
// ---------------------------------------------------------------------------------------

/** @param {any} event */
function onEngineEvent(event) {
  if (!run) return;
  switch (event.type) {
    case 'tick': {
      const remaining = event.countdown.remainingMs;
      setText(el.countdown, formatCountdown(remaining));
      if (event.phase === SalePhase.UPCOMING && remaining > 0 && run.clientOpen) {
        run.clientOpen = false;
        renderPhase(event.phase);
      }
      break;
    }
    case 'phase':
      renderPhase(event.phase);
      // A phase change decides which buttons work, so redraw on the next frame, not the next interval.
      run.dirty = true;
      run.lastHeavy = 0;
      if (event.phase === SalePhase.LIVE) log('The sale is LIVE. Stock can now be held.', 'good');
      if (event.phase === SalePhase.ENDED) summarise();
      break;
    case 'countdown-zero':
      if (event.phase === SalePhase.UPCOMING) {
        run.clientOpen = true;
        run.dirty = true;
        run.lastHeavy = 0;
        renderPhase(event.phase);
        log('Your device clock says the sale has opened, but the server has not opened it. Purchases are still refused.', 'bad');
      }
      break;
    default:
      run.dirty = true;
  }
}

function summarise() {
  const state = run.engine.getState();
  const stock = state.products.reduce((sum, p) => sum + p.stock.initial, 0);
  log(
    `The sale has closed: ${count.format(state.totals.unitsSold)} of ${count.format(stock)} units sold so far, ` +
      `${count.format(state.totals.orders)} orders, ${money.format(state.totals.revenueMinor)}. ` +
      `${count.format(state.totals.activeHolds)} holds are still in progress and can complete until they expire.`,
    'good',
  );
}

// ---------------------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------------------

/** @param {string} phase */
function renderPhase(phase) {
  const chip = el.phaseChip;
  if (phase === SalePhase.UPCOMING) {
    chip.dataset.state = 'soon';
    setText(chip, 'Opens soon');
    setText(el.clockLabel, 'Sale opens in');
    setText(
      el.countdownNote,
      run?.clientOpen
        ? 'Your device clock says it is time, but the server has not opened the sale. Press “Sync with server”.'
        : 'The server decides when the sale opens. Your device clock only drives this display.',
    );
  } else if (phase === SalePhase.LIVE) {
    chip.dataset.state = 'live';
    setText(chip, 'LIVE');
    setText(el.clockLabel, 'Sale ends in');
    setText(el.countdownNote, 'Holds last for the hold time. Check out and pay before the timer runs out.');
  } else {
    chip.dataset.state = 'idle';
    setText(chip, 'Ended');
    setText(el.clockLabel, 'Sale ended');
    setText(el.countdownNote, 'New holds are refused. Holds taken earlier can still be paid for until they expire.');
  }
}

function renderIdle() {
  el.phaseChip.dataset.state = 'idle';
  setText(el.phaseChip, 'Not started');
  el.auditChip.dataset.state = 'idle';
  setText(el.auditChip, 'Stock audit: waiting');
  setText(el.clockLabel, 'Sale opens in');
  setText(el.countdown, '--:--:--.---');
  setText(el.countdownNote, 'Press “Start simulation” to schedule a sale.');
  for (const product of PRODUCTS) {
    const stock = { sku: product.sku, initial: product.stock, available: product.stock, reserved: 0, sold: 0, version: 0, limitPerBuyer: product.limitPerBuyer };
    renderProduct(product, stock, { phase: null, soldOut: false, heldByOthers: false });
  }
  el.myHolds.replaceChildren();
  el.otherHolds.replaceChildren();
  el.myHoldsEmpty.hidden = false;
  el.otherHoldsEmpty.hidden = false;
  setText(el.allHoldsCount, '');
  METRICS.forEach(({ dd }) => setText(dd, '—'));
  for (const cells of regionRows.values()) cells.slice(1).forEach((c) => setText(c, '—'));
}

/**
 * @param {typeof PRODUCTS[number]} product
 * @param {any} stock
 * @param {{ phase: string | null, soldOut: boolean, heldByOthers: boolean }} flags
 */
function renderProduct(product, stock, flags) {
  const card = productCards.get(product.sku);
  card.version = stock.version;
  card.sold.style.setProperty('--v', String(stock.sold));
  card.held.style.setProperty('--v', String(stock.reserved));
  card.avail.style.setProperty('--v', String(stock.available));
  card.bar.setAttribute('aria-label', `${stock.sold} sold, ${stock.reserved} held, ${stock.available} available, of ${stock.initial}`);
  setText(card.nAvail, count.format(stock.available));
  setText(card.nHeld, count.format(stock.reserved));
  setText(card.nSold, count.format(stock.sold));
  const limit = stock.limitPerBuyer === Infinity ? 'no limit' : `limit ${stock.limitPerBuyer} per buyer`;
  setText(card.meta, `${limit} · stock version ${stock.version}`);
  card.root.dataset.flag = flags.soldOut ? 'soldout' : flags.heldByOthers ? 'held' : 'open';

  let label = 'Start a simulation';
  let disabled = true;
  if (run) {
    if (flags.phase === SalePhase.ENDED) label = 'Sale ended';
    else if (flags.phase === SalePhase.LIVE && flags.soldOut) label = 'Sold out';
    else if (flags.phase === SalePhase.LIVE && flags.heldByOthers) label = 'All held by others';
    else if (flags.phase === SalePhase.LIVE || run.clientOpen) {
      // While the device clock says the sale is open the button works, so the server's refusal is visible.
      label = 'Buy now';
      disabled = false;
    } else label = 'Opens soon';
  }
  setText(card.buy, label);
  card.buy.disabled = disabled;
}

/** @param {any} state */
function renderProducts(state) {
  for (const p of state.products) {
    const product = PRODUCTS.find((x) => x.sku === p.sku);
    renderProduct(product, p.stock, { phase: state.phase, soldOut: p.soldOut, heldByOthers: p.heldByOthers });
    if (p.soldOut && state.phase !== SalePhase.UPCOMING && !run.soldOutLogged.has(p.sku)) {
      run.soldOutLogged.add(p.sku);
      log(`${product.name} is sold out.`, 'good');
    }
  }
}

/** @param {any} state */
function renderHolds(state) {
  const mine = state.active.filter((r) => r.buyerId === YOU);
  const others = state.active.filter((r) => r.buyerId !== YOU).slice(0, OTHER_HOLD_ROWS);
  syncRows(el.myHolds, run.myRows, mine, true);
  syncRows(el.otherHolds, run.otherRows, others, false);
  el.myHoldsEmpty.hidden = mine.length > 0;
  el.otherHoldsEmpty.hidden = others.length > 0;
  setText(el.allHoldsCount, `(${count.format(state.totals.activeHolds)} active)`);
}

/**
 * Keeps a list of hold rows in step with the data: reuse, update, reorder, remove.
 *
 * @param {HTMLElement} container
 * @param {Map<string, any>} rows
 * @param {any[]} items
 * @param {boolean} interactive
 */
function syncRows(container, rows, items, interactive) {
  const seen = new Set();
  let previous = null;
  for (const item of items) {
    seen.add(item.id);
    let row = rows.get(item.id);
    if (!row) {
      row = createHoldRow(interactive);
      row.root.dataset.id = item.id;
      rows.set(item.id, row);
    }
    updateHoldRow(row, item, interactive);
    const expected = previous ? previous.root.nextSibling : container.firstChild;
    if (row.root !== expected) container.insertBefore(row.root, expected);
    previous = row;
  }
  for (const [id, row] of rows) {
    if (!seen.has(id)) {
      row.root.remove();
      rows.delete(id);
    }
  }
}

function createHoldRow() {
  const template = /** @type {HTMLTemplateElement} */ (byId('hold-template'));
  const root = /** @type {HTMLElement} */ (template.content.firstElementChild.cloneNode(true));
  return {
    root,
    name: root.querySelector('.h-name'),
    qty: root.querySelector('.h-qty'),
    state: root.querySelector('.h-state'),
    timer: root.querySelector('.h-timer'),
    fill: root.querySelector('.h-fill'),
    checkout: root.querySelector('[data-action="checkout"]'),
    pay: root.querySelector('[data-action="pay"]'),
    cancel: root.querySelector('[data-action="cancel"]'),
    sku: '',
    expiresAt: 0,
    span: 1,
  };
}

function updateHoldRow(row, item, interactive) {
  const product = PRODUCTS.find((p) => p.sku === item.sku);
  setText(row.name, product?.name ?? item.sku);
  setText(row.qty, `× ${item.quantity}${interactive ? '' : ` · ${item.buyerId}`}`);
  setText(row.state, item.state === 'CHECKOUT' ? 'Checkout' : 'Held');
  row.state.dataset.state = item.state;
  row.sku = item.sku;
  row.expiresAt = item.expiresAt;
  row.span = Math.max(1, item.expiresAt - item.createdAt);
  row.checkout.hidden = !interactive || item.state !== 'HELD';
  row.pay.hidden = !interactive || item.state !== 'CHECKOUT';
  row.cancel.hidden = !interactive;
}

/** Updates every visible timer from the clock, without asking the engine. */
function updateTimers() {
  const now = Date.now();
  for (const rows of [run.myRows, run.otherRows]) {
    for (const row of rows.values()) {
      const remaining = Math.max(0, row.expiresAt - now);
      setText(row.timer, `${(remaining / 1000).toFixed(1)} s`);
      const fraction = Math.min(1, remaining / row.span).toFixed(3);
      if (row.fill.dataset.p !== fraction) {
        row.fill.dataset.p = fraction;
        row.fill.style.setProperty('--p', fraction);
      }
      const urgent = remaining < URGENT_MS ? 'true' : 'false';
      if (row.root.dataset.urgent !== urgent) row.root.dataset.urgent = urgent;
    }
  }
}

/** @param {any} state */
function renderTraffic(state) {
  const metrics = run.sim.metrics();
  const nowPerf = performance.now();
  const elapsed = nowPerf - run.lastRateAt;
  if (elapsed >= 500) {
    run.rps = Math.round(((metrics.attempts - run.lastAttempts) * 1000) / elapsed);
    run.lastAttempts = metrics.attempts;
    run.lastRateAt = nowPerf;
  }
  const extra = { rps: run.rps, totals: state.totals };
  METRICS.forEach(({ dd, format }) => setText(dd, format(metrics, extra)));
  for (const r of metrics.regions) {
    const cells = regionRows.get(r.code);
    setText(cells[1], count.format(r.buyers));
    setText(cells[2], count.format(r.reserved));
    setText(cells[3], count.format(r.paid));
  }
}

/** @param {DOMHighResTimeStamp} timestamp */
function uiFrame(timestamp) {
  if (!run) return;
  run.frameId = null;
  updateTimers();
  const since = timestamp - run.lastHeavy;
  if ((run.dirty && since >= RENDER_DIRTY_MS) || since >= RENDER_IDLE_MS) {
    run.lastHeavy = timestamp;
    run.dirty = false;
    const state = run.engine.getState();
    renderProducts(state);
    renderHolds(state);
    renderTraffic(state);
  }
  run.frameId = requestAnimationFrame(uiFrame);
}

// ---------------------------------------------------------------------------------------
// Activity log
// ---------------------------------------------------------------------------------------

/**
 * @param {string} message
 * @param {'good' | 'bad' | ''} [kind]
 */
function log(message, kind = '') {
  const item = document.createElement('li');
  if (kind) item.dataset.kind = kind;
  const time = document.createElement('time');
  const text = document.createElement('span');
  time.textContent = relativeTime();
  text.textContent = message;
  item.append(time, text);
  el.log.prepend(item);
  while (el.log.childElementCount > MAX_LOG_ENTRIES) el.log.lastElementChild.remove();
}

function relativeTime() {
  if (!run) return '—';
  const seconds = (Date.now() - run.startsAt) / 1000;
  return `T${seconds < 0 ? '−' : '+'}${Math.abs(seconds).toFixed(1)}s`;
}

// ---------------------------------------------------------------------------------------
// The buyer's own actions
// ---------------------------------------------------------------------------------------

/** @param {Error} error @param {any} product */
function explain(error, product) {
  if (error instanceof SaleNotStartedError) return `The sale has not opened yet on the server. It opens in ${(error.retryAfterMs / 1000).toFixed(1)} s.`;
  if (error instanceof SaleEndedError) return 'The sale has ended.';
  if (error instanceof OutOfStockError) return error.available === 0 ? `${product.name} is gone or held by other buyers.` : `Only ${error.available} left.`;
  if (error instanceof LimitExceededError) return `Limit reached: ${error.limit} per buyer for ${product.name}.`;
  if (error instanceof ReservationExpiredError) return 'Too late. The hold expired and the units went back on sale.';
  return error.message;
}

/**
 * @param {string} sku
 * @param {number | undefined} expectedVersion
 * @param {boolean} allowRetry
 */
function reserveAsYou(sku, expectedVersion, allowRetry) {
  const product = PRODUCTS.find((p) => p.sku === sku);
  const result = run.engine.reserve({
    sku,
    buyerId: YOU,
    quantity: 1,
    idempotencyKey: `you-${++youKeys}`,
    expectedVersion,
  });
  run.dirty = true;
  if (result.ok) {
    log(`You hold ${product.name}. Check out before the timer runs out.`, 'good');
    return;
  }
  if (result.error instanceof VersionConflictError) {
    log(`Stock changed while you were looking (version ${result.error.expectedVersion} → ${result.error.actualVersion}).`, 'bad');
    if (allowRetry) {
      log('Retrying with the latest view…');
      reserveAsYou(sku, result.error.snapshot.version, false);
    }
    return;
  }
  log(explain(result.error, product), 'bad');
}

el.products.addEventListener('click', (event) => {
  const button = /** @type {HTMLElement} */ (event.target).closest('button[data-buy]');
  if (!button || !run) return;
  const sku = /** @type {HTMLElement} */ (button).dataset.buy;
  const seen = el.optimistic.checked ? productCards.get(sku).version : undefined;
  reserveAsYou(sku, seen, true);
});

el.myHolds.addEventListener('click', (event) => {
  const button = /** @type {HTMLElement} */ (event.target).closest('button[data-action]');
  const row = button?.closest('.hold');
  if (!button || !row || !run) return;
  const id = /** @type {HTMLElement} */ (row).dataset.id;
  const action = /** @type {HTMLElement} */ (button).dataset.action;
  const product = PRODUCTS.find((p) => p.sku === run.myRows.get(id)?.sku) ?? PRODUCTS[0];

  if (action === 'checkout') {
    const r = run.engine.beginCheckout(id);
    log(r.ok ? 'Checkout started. Your deadline was extended.' : explain(r.error, product), r.ok ? 'good' : 'bad');
  } else if (action === 'pay') {
    const r = run.engine.confirm(id);
    log(r.ok ? `Order placed: ${product.name}, ${money.format(r.order?.totalMinor ?? 0)}.` : explain(r.error, product), r.ok ? 'good' : 'bad');
  } else if (action === 'cancel') {
    run.engine.cancel(id);
    log('Hold cancelled. The units went back on sale.');
  }
  run.dirty = true;
});

// ---------------------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------------------

el.form.addEventListener('submit', (event) => {
  event.preventDefault();
  startRun();
});

el.stop.addEventListener('click', () => stopRun());

function describeSkew() {
  if (skewMs === 0) return 'Your device clock is accurate.';
  return `Your device clock is ${Math.abs(skewMs) / 1000} s ${skewMs > 0 ? 'fast' : 'slow'}.`;
}

el.skew.addEventListener('change', () => {
  skewMs = Number(el.skew.value);
  if (!run) {
    setText(el.offsetNote, `${describeSkew()} It applies when you start a simulation.`);
    return;
  }
  // A countdown that already reached zero stays there until it is pointed at a target again.
  run.engine.refreshCountdown();
  run.clientOpen = false;
  setText(el.offsetNote, `${describeSkew()} Correction applied: ${(run.engine.clientOffsetMs / 1000).toFixed(2)} s. Press “Sync with server” to correct it.`);
  log(describeSkew());
});

el.sync.addEventListener('click', () => {
  if (!run) return;
  // One simulated request and response. The server stamps its time halfway through the trip.
  const roundTripMs = 120;
  const sentAt = Date.now() + skewMs;
  const receivedAt = sentAt + roundTripMs;
  const serverTime = Date.now() + roundTripMs / 2;
  const offset = run.engine.calibrateClient(serverTime, sentAt, receivedAt);
  run.clientOpen = false;
  renderPhase(run.engine.phase);
  setText(el.offsetNote, `${describeSkew()} Correction applied: ${(offset / 1000).toFixed(2)} s.`);
  log(`Synced with the server: correction ${(offset / 1000).toFixed(2)} s.`, 'good');
});

window.addEventListener('pagehide', () => stopRun({ keepLog: true }));

renderIdle();
