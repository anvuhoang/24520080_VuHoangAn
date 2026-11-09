// src/components/CrateArena.jsx
import { useId, useMemo } from 'react';
import { CRATES } from '../arena/arenaData.js';
import { createArenaServer } from '../arena/mockServer.js';
import { useCrateClaims } from '../hooks/useCrateClaims.js';
import { CrateCard } from './CrateCard.jsx';
import styles from './CrateArena.module.css';

const LATENCY_MS = 600;

// Units that other players have already taken on the server side. The screen does not know yet,
// so claiming the last G-Coin crate ends in a 409 Conflict and the optimistic stock is rolled back.
const TAKEN_BY_OTHERS = Object.freeze({ 'gcoin-crate-2500': 1 });

function describeNotice(notice, crates, stock) {
  const crate = crates.find((item) => item.id === notice.crateId);
  const title = crate?.title ?? 'the crate';

  switch (notice.kind) {
    case 'ok':
      return `Claimed: ${title}. ${stock[notice.crateId] ?? 0} left.`;
    case 'conflict':
      return `Looted out: ${title} was taken by another player. Your claim was rolled back.`;
    case 'error':
      return `Claim failed for ${title}. Nothing was taken. Please try again.`;
    default:
      return '';
  }
}

export function CrateArena({ crates = CRATES, server }) {
  const headingId = useId();

  const fallbackServer = useMemo(
    () =>
      createArenaServer({
        latencyMs: LATENCY_MS,
        crates: crates.map((crate) => ({
          ...crate,
          remainingStock: Math.max(0, crate.remainingStock - (TAKEN_BY_OTHERS[crate.id] ?? 0)),
        })),
      }),
    [crates]
  );

  const { stock, inFlight, notice, claim } = useCrateClaims(crates, server ?? fallbackServer);

  return (
    <section className={styles.arena} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.heading}>
        Crate arena
      </h2>

      <output className={styles.notice} data-kind={notice.kind}>
        {describeNotice(notice, crates, stock)}
      </output>

      <ul className={styles.list}>
        {crates.map((crate) => (
          <li key={crate.id} className={styles.item}>
            <CrateCard
              crate={crate}
              stock={stock[crate.id]}
              isClaiming={Object.hasOwn(inFlight, crate.id)}
              onClaim={claim}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
