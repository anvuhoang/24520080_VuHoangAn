// client/src/dossier/DossierView.jsx — /dossier/:playerID. The player comes from the URL; an unknown one is an alert, never a crash.
// The matrix is computed while rendering and remembered for as long as `dossiers` is the same array. The countdown is in
// AppealSection, so a tick re-renders that section and not this page.
import { useMemo } from 'react';
import { useOutletContext, useParams } from 'react-router';
import AppealSection from '../appeal/AppealSection.jsx';
import NotFoundState from '../NotFoundState.jsx';
import { computeMatrix } from './computeMatrix.js';
import MatrixTable from './MatrixTable.jsx';
import styles from './DossierView.module.css';

const whole = new Intl.NumberFormat('en');

export default function DossierView() {
  const { playerID } = useParams();
  const { dossiers } = useOutletContext();
  const matrix = useMemo(() => computeMatrix(dossiers), [dossiers]);
  const dossier = dossiers.find((d) => d.playerId === playerID);

  if (!dossier) {
    return <NotFoundState title="Player not found" message="There is no dossier for this player." backTo="/dossier" backLabel="Back to the dossiers" />;
  }

  return (
    <article className={styles.view} aria-labelledby="dossier-title">
      <h2 id="dossier-title" className={styles.heading}>
        {dossier.name}
      </h2>
      <dl className={styles.facts}>
        <dt>Team</dt>
        <dd>{dossier.team}</dd>
        <dt>Matches played</dt>
        <dd>{dossier.matchesPlayed}</dd>
        <dt>Reports received</dt>
        <dd>{dossier.reportsReceived}</dd>
      </dl>

      <section className={styles.block} aria-labelledby="infractions-title">
        <h3 id="infractions-title" className={styles.subheading}>
          Infractions on record
        </h3>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Rule</th>
              <th scope="col">Severity (1–5)</th>
              <th scope="col">Penalty (minutes)</th>
            </tr>
          </thead>
          <tbody>
            {dossier.infractions.map((infraction) => (
              <tr key={infraction.id}>
                <th scope="row">{infraction.rule}</th>
                <td>{infraction.severity}</td>
                <td>{whole.format(infraction.penaltyMinutes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className={styles.block} aria-labelledby="matrix-title">
        <h3 id="matrix-title" className={styles.subheading}>
          How this compares with the other players
        </h3>
        <MatrixTable matrix={matrix} highlight={dossier.playerId} />
      </section>

      <AppealSection key={dossier.playerId} dossier={dossier} />
    </article>
  );
}
