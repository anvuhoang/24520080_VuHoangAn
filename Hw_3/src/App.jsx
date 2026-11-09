// src/App.jsx
import { CrateArena } from './components/CrateArena.jsx';
import { Leaderboard } from './components/Leaderboard.jsx';
import styles from './App.module.css';

export default function App() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>PUBG VN Arena</h1>
        <p className={styles.note}>
          Sample data: every crate, price, stock level and score on this page is invented for this exercise. None of
          it is an official PUBG Vietnam Series result or offer.
        </p>
      </header>
      <CrateArena />
      <Leaderboard />
    </main>
  );
}
