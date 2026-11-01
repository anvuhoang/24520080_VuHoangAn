// src/App.jsx
import ScientistDirectory from './components/ScientistDirectory.jsx';
import styles from './App.module.css';

export default function App() {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Scientist &amp; Pioneer Directory</h1>
      <ScientistDirectory />
    </main>
  );
}
