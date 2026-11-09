// src/App.jsx
import styles from './App.module.css';
import SituationshipAnalyzer from './components/SituationshipAnalyzer.jsx';

export function App() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Lab 3 · Bonus — Situationship Analyzer</h1>
        <p className={styles.subtitle}>
          Finite State Machine & Asymmetric Effort Engine
        </p>
        <aside className={styles.note} aria-label="Ghi chú bối cảnh đề bài">
          <p>
            <strong>Domain context:</strong> Mô phỏng ca khúc <em>"Hẹn Hò Nhưng Không Yêu"</em> của ca sĩ Wendy Thảo.
            Giải quyết bài toán "Situationship Boolean Soup" bằng Finite State Machine thuần túy, tính toán nỗ lực bất đối xứng ("Em cố trăm lần chẳng bằng ai đó một phần"), và cơ chế đếm ngược 5s Seen Không Rep tích hợp <code>AbortController</code>.
          </p>
        </aside>
      </header>

      <SituationshipAnalyzer />
    </main>
  );
}
export default App;
