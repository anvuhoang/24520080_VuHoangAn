// src/components/CrateCard.jsx
import { useId } from 'react';
import { DROP_WINDOW_MS } from '../arena/arenaData.js';
import { DROP_PHASES, getDropPhase } from '../arena/dropPhase.js';
import { formatCountdown, formatVnd } from '../arena/format.js';
import { usePubgAirdropTimer } from '../hooks/usePubgAirdropTimer.js';
import styles from './CrateCard.module.css';

const NO_CRATE = Object.freeze({
  id: '',
  title: 'Unknown crate',
  priceVnd: 0,
  remainingStock: 0,
  dropEpochMs: Number.NaN,
});

const PHASE_LABELS = {
  [DROP_PHASES.WARMUP]: 'Opens soon',
  [DROP_PHASES.AIRDROP_LIVE]: 'Airdrop live',
  [DROP_PHASES.LOOTED_OUT]: 'Looted out',
  [DROP_PHASES.EXPIRED]: 'Drop ended',
};

const noop = () => {};

export function CrateCard({
  crate = NO_CRATE,
  stock = crate.remainingStock,
  isClaiming = false,
  onClaim = noop,
}) {
  const headingId = useId();

  // Two clocks: one until the drop opens, one until its window closes
  const untilDrop = usePubgAirdropTimer(crate.dropEpochMs).remainingMs;
  const untilClose = usePubgAirdropTimer(crate.dropEpochMs + DROP_WINDOW_MS).remainingMs;

  // "Now" rebuilt from the two countdowns, so the phase follows the clocks and no clock is read here
  const nowMs =
    untilDrop > 0 ? crate.dropEpochMs - untilDrop : crate.dropEpochMs + DROP_WINDOW_MS - untilClose;
  const phase = getDropPhase({
    nowMs,
    dropEpochMs: crate.dropEpochMs,
    remainingStock: stock,
    openWindowMs: DROP_WINDOW_MS,
  });

  let claimLabel = 'Claim';
  if (isClaiming) claimLabel = 'Claiming…';
  else if (phase === DROP_PHASES.WARMUP) claimLabel = 'Opens soon';
  else if (phase === DROP_PHASES.LOOTED_OUT) claimLabel = 'Looted out';
  else if (phase === DROP_PHASES.EXPIRED) claimLabel = 'Drop ended';
  const canClaim = claimLabel === 'Claim';

  // aria-disabled keeps the keyboard focus on the button while it changes to "Claiming…"
  const handleClick = () => {
    if (canClaim) onClaim(crate.id);
  };

  return (
    <article className={styles.card} aria-labelledby={headingId} data-phase={phase}>
      <header className={styles.header}>
        <h3 id={headingId} className={styles.title}>
          {crate.title}
        </h3>
        <p role="status" className={styles.phase}>
          {PHASE_LABELS[phase]}
        </p>
      </header>

      <dl className={styles.facts}>
        <dt>Price</dt>
        <dd>{formatVnd(crate.priceVnd)}</dd>
        <dt>Stock left</dt>
        <dd>{stock}</dd>
        {phase === DROP_PHASES.WARMUP && (
          <>
            <dt>Opens in</dt>
            <dd className={styles.countdown}>{formatCountdown(untilDrop)}</dd>
          </>
        )}
        {phase === DROP_PHASES.AIRDROP_LIVE && (
          <>
            <dt>Closes in</dt>
            <dd className={styles.countdown}>{formatCountdown(untilClose)}</dd>
          </>
        )}
      </dl>

      <button
        type="button"
        className={styles.claim}
        aria-disabled={!canClaim}
        aria-describedby={headingId}
        onClick={handleClick}
      >
        {claimLabel}
      </button>
    </article>
  );
}
