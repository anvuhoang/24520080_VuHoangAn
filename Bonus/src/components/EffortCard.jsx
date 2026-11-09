// src/components/EffortCard.jsx
import { useId } from 'react';
import styles from './EffortCard.module.css';
import { calculateImpact } from '../situationship/effortMetrics.js';
import { ACTOR_CONFIG } from '../situationship/constants.js';

export function EffortCard({
  myTries = 100,
  rivalTries = 1,
  onAddEffort = () => {},
  disabled = false,
}) {
  const myInputId = useId();
  const rivalInputId = useId();

  const myImpact = calculateImpact(myTries, ACTOR_CONFIG.EM.multiplier);
  const rivalImpact = calculateImpact(rivalTries, ACTOR_CONFIG.AI_DO.multiplier);

  const handleMyInput = (e) => {
    const val = e.target.valueAsNumber;
    const count = Number.isNaN(val) ? 0 : Math.max(0, Math.floor(val));
    const delta = count - myTries;
    if (delta !== 0) {
      onAddEffort({ actor: 'EM', steps: delta, label: 'Điều chỉnh số lần cố gắng của Em' });
    }
  };

  const handleRivalInput = (e) => {
    const val = e.target.valueAsNumber;
    const count = Number.isNaN(val) ? 0 : Math.max(0, Math.floor(val));
    const delta = count - rivalTries;
    if (delta !== 0) {
      onAddEffort({ actor: 'AI_DO', steps: delta, label: 'Điều chỉnh số phần nỗ lực của Ai Đó' });
    }
  };

  return (
    <article className={styles.card} aria-labelledby="effort-card-heading">
      <header className={styles.header}>
        <h3 id="effort-card-heading" className={styles.title}>
          Asymmetric Effort Meter
        </h3>
        <p className={styles.subtitle}>
          "Em cố trăm lần chẳng bằng ai đó một phần"
        </p>
      </header>

      <form className={styles.form} onSubmit={(e) => e.preventDefault()}>
        <fieldset className={styles.fieldset} disabled={disabled}>
          <legend className={styles.legend}>Cân đo nỗ lực đôi bên</legend>

          <section className={styles.actorSection}>
            <header className={styles.actorHeader}>
              <h4>Phía Em (Trọng số 0.1)</h4>
            </header>
            <label htmlFor={myInputId} className={styles.label}>
              Số lần cố gắng của Em
            </label>
            <input
              id={myInputId}
              type="number"
              min="0"
              className={styles.input}
              value={myTries}
              onChange={handleMyInput}
              disabled={disabled}
            />
            <menu className={styles.quickActions}>
              <li>
                <button
                  type="button"
                  className={styles.quickBtn}
                  disabled={disabled}
                  onClick={() => onAddEffort({ actor: 'EM', steps: 1, label: 'Quan tâm hỏi han (+1)' })}
                >
                  +1 Quan tâm
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={styles.quickBtn}
                  disabled={disabled}
                  onClick={() => onAddEffort({ actor: 'EM', steps: 10, label: 'Nấu cơm, chờ đợi (+10)' })}
                >
                  +10 Chăm sóc
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={styles.quickBtn}
                  disabled={disabled}
                  onClick={() => onAddEffort({ actor: 'EM', steps: 100, label: 'Em cố trăm lần (+100)' })}
                >
                  +100 Cố gắng
                </button>
              </li>
            </menu>
          </section>

          <section className={styles.actorSection}>
            <header className={styles.actorHeader}>
              <h4>Phía Ai Đó (Trọng số 50.0)</h4>
            </header>
            <label htmlFor={rivalInputId} className={styles.label}>
              Số phần nỗ lực của Ai Đó
            </label>
            <input
              id={rivalInputId}
              type="number"
              min="0"
              className={styles.input}
              value={rivalTries}
              onChange={handleRivalInput}
              disabled={disabled}
            />
            <menu className={styles.quickActions}>
              <li>
                <button
                  type="button"
                  className={styles.quickBtnRival}
                  disabled={disabled}
                  onClick={() => onAddEffort({ actor: 'AI_DO', steps: 1, label: 'Ai đó gõ "Ừ" một tiếng (+1 phần = 50 điểm)' })}
                >
                  +1 Gõ "Ừ" (50đ)
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={styles.quickBtnRival}
                  disabled={disabled}
                  onClick={() => onAddEffort({ actor: 'AI_DO', steps: 2, label: 'Ai đó hẹn cà phê (+2 phần = 100 điểm)' })}
                >
                  +2 Hẹn gặp (100đ)
                </button>
              </li>
            </menu>
          </section>
        </fieldset>
      </form>

      <dl className={styles.metricsList}>
        <dt>Điểm tác động từ Em (100x 0.1):</dt>
        <dd className={styles.myMetric}>{myImpact} điểm</dd>

        <dt>Điểm tác động từ Ai Đó (1x 50.0):</dt>
        <dd className={styles.rivalMetric}>{rivalImpact} điểm</dd>

        <dt>Chênh lệch nỗ lực:</dt>
        <dd className={styles.ratioMetric}>
          {myImpact >= rivalImpact
            ? `Em đang dẫn trước (${Math.round((myImpact - rivalImpact) * 10) / 10}đ)`
            : `Ai đó áp đảo gấp ${Math.round((rivalImpact / (myImpact || 1)) * 10) / 10} lần`}
        </dd>
      </dl>
    </article>
  );
}
export default EffortCard;

