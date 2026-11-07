// src/App.jsx
import GrandPiano from './components/GrandPiano.jsx';
import styles from './App.module.css';

export default function App() {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Grand Piano 88</h1>
      <GrandPiano />
    </main>
  );
}
