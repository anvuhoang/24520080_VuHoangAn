// src/App.jsx
import DrumKit from './components/DrumKit.jsx';
import styles from './App.module.css';

export default function App() {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Studio Drum Kit</h1>
      <DrumKit />
    </main>
  );
}
