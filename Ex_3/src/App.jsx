// src/App.jsx
import { useState } from 'react';
import SquadSelector from './components/SquadSelector.jsx';
import PubgMatchTelemetry from './components/PubgMatchTelemetry.jsx';
import styles from './App.module.css';

const SQUADS = [
  { id: 'ces', name: 'Cerberus Esports' },
  { id: 'te', name: 'The Expendables' },
  { id: 'ge', name: 'Genius Esports' },
];

export default function App() {
  const [selectedId, setSelectedId] = useState('te');

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>PUBG Vietnam Series Telemetry</h1>
      <SquadSelector squads={SQUADS} selectedId={selectedId} onSelect={setSelectedId} />
      <PubgMatchTelemetry squadId={selectedId} />
    </main>
  );
}
