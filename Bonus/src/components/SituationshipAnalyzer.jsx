// src/components/SituationshipAnalyzer.jsx
import { useReducer, useId, useCallback } from 'react';
import styles from './SituationshipAnalyzer.module.css';
import { RELATIONSHIP_PHASES, INITIAL_STATE } from '../situationship/constants.js';
import { situationshipReducer, ACTION_TYPES } from '../situationship/situationshipReducer.js';
import { calculateEffortDerived } from '../situationship/effortMetrics.js';
import { useGhostingTimer } from '../hooks/useGhostingTimer.js';
import { sendSimulatedMessage } from '../situationship/messageService.js';
import EffortCard from './EffortCard.jsx';

export function SituationshipAnalyzer({ initialState = INITIAL_STATE } = {}) {
  const [state, dispatch] = useReducer(situationshipReducer, initialState);
  const msgInputId = useId();

  // Pure derived state computed during render — Zero extra useState / useEffect
  const {
    myImpact,
    rivalImpact,
    isRedFlag,
    ratio,
    alertMessage,
    phaseDescription,
  } = calculateEffortDerived({
    myTries: state.myTries,
    rivalTries: state.rivalTries,
    phase: state.phase,
  });

  const handleGhosted = useCallback((messageId) => {
    dispatch({
      type: ACTION_TYPES.MESSAGE_GHOSTED,
      payload: { messageId },
    });
  }, []);

  const {
    remainingMs,
    secondsLeft,
    isWaitingReply,
    cancelMessage,
    abortSignal,
  } = useGhostingTimer({
    phase: state.phase,
    pendingMessage: state.pendingMessage,
    onGhosted: handleGhosted,
    timeoutMs: 5000,
  });

  const handleSendMessage = () => {
    if (state.phase !== RELATIONSHIP_PHASES.DATING_NO_LOVE || isWaitingReply) {
      return;
    }

    const messageId = `msg-${Date.now()}`;
    const text = 'Em nhớ anh... Hôm nay anh có bận không?';

    dispatch({
      type: ACTION_TYPES.START_MESSAGE,
      payload: { messageId, text },
    });

    sendSimulatedMessage({
      text,
      latencyMs: 6000, // 6s latency ensures 5s ghosting timeout fires unless aborted
      signal: abortSignal,
    })
      .then(() => {
        dispatch({
          type: ACTION_TYPES.MESSAGE_REPLIED,
          payload: { messageId },
        });
      })
      .catch((err) => {
        // Safe AbortError guard: do not flash error or mutate state on intentional abort
        if (err?.name === 'AbortError') {
          return;
        }
      });
  };

  const handleAbortMessage = () => {
    cancelMessage();
    dispatch({ type: ACTION_TYPES.ABORT_MESSAGE });
  };

  const handleAddEffort = (payload) => {
    dispatch({ type: ACTION_TYPES.ADD_EFFORT, payload });
  };

  const handleUnbind = () => {
    cancelMessage();
    dispatch({
      type: ACTION_TYPES.TRANSITION_PHASE,
      payload: { nextPhase: RELATIONSHIP_PHASES.SELF_RESPECT_EXIT },
    });
  };

  const handleReset = () => {
    cancelMessage();
    dispatch({ type: ACTION_TYPES.RESET });
  };

  const isTerminal =
    state.phase === RELATIONSHIP_PHASES.GHOSTED_EXIT ||
    state.phase === RELATIONSHIP_PHASES.SELF_RESPECT_EXIT;

  return (
    <article
      className={styles.analyzer}
      aria-label="Hẹn Hò Nhưng Không Yêu Analyzer"
      data-phase={state.phase}
    >
      <header className={styles.header}>
        <h2 className={styles.title}>Situationship State Machine</h2>
        <p
          className={styles.phaseBadge}
          data-phase={state.phase}
        >
          {phaseDescription}
        </p>
      </header>

      {/* Primary WCAG 2.2 live region announcing red flags and state transitions */}
      <section className={styles.statusSection} aria-label="Thông báo hệ thống">
        <output
          role="status"
          aria-live="polite"
          className={`${styles.alertBox} ${isRedFlag ? styles.alertRedFlag : styles.alertStable}`}
          data-redflag={isRedFlag ? 'true' : 'false'}
        >
          {alertMessage}
        </output>
      </section>

      {/* Asymmetric Effort Tuner */}
      <section className={styles.effortSection} aria-label="Bộ điều chỉnh nỗ lực">
        <EffortCard
          myTries={state.myTries}
          rivalTries={state.rivalTries}
          onAddEffort={handleAddEffort}
          disabled={isTerminal}
        />
      </section>

      {/* Simulated Ghosting & Ping Section */}
      <section className={styles.pingSection} aria-label="Mô phỏng tin nhắn và Ghosting">
        <header className={styles.pingHeader}>
          <h3>Seen Không Rep (Ghosting 5s)</h3>
          <p className={styles.pingSubtitle}>
            Gửi tin nhắn tâm sự. Nếu đối phương "seen không rep" sau 5s, hệ thống tự động giải phóng bộ nhớ.
          </p>
        </header>

        <form className={styles.pingForm} onSubmit={(e) => e.preventDefault()}>
          <label htmlFor={msgInputId} className={styles.visuallyHidden}>
            Nội dung tin nhắn gửi đi
          </label>
          <input
            id={msgInputId}
            type="text"
            readOnly
            className={styles.pingInput}
            value={
              isWaitingReply
                ? `Đã gửi: "${state.pendingMessage?.text}" (Đang chờ hồi âm...)`
                : 'Em nhớ anh... Hôm nay anh có bận không?'
            }
          />

          <menu className={styles.pingActions}>
            <li>
              <button
                type="button"
                className={styles.sendBtn}
                onClick={handleSendMessage}
                disabled={isWaitingReply || state.phase !== RELATIONSHIP_PHASES.DATING_NO_LOVE}
              >
                {isWaitingReply ? 'Đang chờ rep...' : 'Gửi tin nhắn tâm sự'}
              </button>
            </li>
            {isWaitingReply && (
              <li>
                <button
                  type="button"
                  className={styles.abortBtn}
                  onClick={handleAbortMessage}
                >
                  Hủy tin nhắn (Abort)
                </button>
              </li>
            )}
          </menu>
        </form>

        {isWaitingReply && (
          <section className={styles.countdownSection} aria-live="polite">
            <p className={styles.countdownText}>
              Đếm ngược Seen Không Rep: <strong>{secondsLeft}s</strong> ({remainingMs}ms)
            </p>
            <progress
              className={styles.progressBar}
              value={remainingMs}
              max={5000}
              aria-label="Thời gian chờ tin nhắn còn lại"
            />
          </section>
        )}
      </section>

      {/* Control Actions & Recovery */}
      <footer className={styles.footerControls}>
        <button
          type="button"
          className={styles.unbindBtn}
          onClick={handleUnbind}
          disabled={isTerminal}
        >
          Unbind & Free Memory (Buông tay)
        </button>
        <button
          type="button"
          className={styles.resetBtn}
          onClick={handleReset}
        >
          Reset Situationship (Thiết lập lại)
        </button>
      </footer>
    </article>
  );
}
export default SituationshipAnalyzer;
