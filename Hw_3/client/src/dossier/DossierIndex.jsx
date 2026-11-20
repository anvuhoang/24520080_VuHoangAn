// client/src/dossier/DossierIndex.jsx — /dossier with no player chosen: the comparison of all of them.
import { useMemo } from 'react';
import { useOutletContext } from 'react-router';
import { computeMatrix } from './computeMatrix.js';
import MatrixTable from './MatrixTable.jsx';
import styles from './DossierView.module.css';

export default function DossierIndex() {
  const { dossiers } = useOutletContext();
  const matrix = useMemo(() => computeMatrix(dossiers), [dossiers]);
  return (
    <article className={styles.view}>
      <h2 className={styles.heading}>Choose a player</h2>
      <p className={styles.muted}>Open a dossier to see the evidence and to file an appeal. All players are compared below.</p>
      <MatrixTable matrix={matrix} />
    </article>
  );
}
