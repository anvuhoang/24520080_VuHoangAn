// tests/SituationshipAnalyzer.test.jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import SituationshipAnalyzer from '../src/components/SituationshipAnalyzer.jsx';

describe('SituationshipAnalyzer component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('renders with zero <div> and zero <span> tags throughout subtree', () => {
    const { container } = render(<SituationshipAnalyzer />);
    expect(container.querySelectorAll('div')).toHaveLength(0);
    expect(container.querySelectorAll('span')).toHaveLength(0);
  });

  it('announces red flag initially when myImpact < rivalImpact', () => {
    render(<SituationshipAnalyzer />);
    const status = screen.getByRole('status');
    expect(status).toBeInTheDocument();
    expect(status.textContent).toContain('[RED-FLAG] Red Flag: Hẹn hò nhưng không yêu');
  });

  it('handles sending message and transitioning to GHOSTED_EXIT after 5s', () => {
    render(<SituationshipAnalyzer />);
    const sendBtn = screen.getByRole('button', { name: /Gửi tin nhắn tâm sự/i });

    act(() => {
      fireEvent.click(sendBtn);
    });

    expect(screen.getByText(/Đang chờ rep\.\.\./i)).toBeInTheDocument();
    expect(screen.getByText(/Đếm ngược Seen Không Rep/i)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    const statusAfterGhost = screen.getByRole('status');
    expect(statusAfterGhost.textContent).toContain('[GHOSTED] Đối phương seen không rep quá 5s — Đã giải phóng bộ nhớ!');
  });

  it('aborts message cleanly when Abort button is clicked', () => {
    render(<SituationshipAnalyzer />);
    const sendBtn = screen.getByRole('button', { name: /Gửi tin nhắn tâm sự/i });

    act(() => {
      fireEvent.click(sendBtn);
    });

    const abortBtn = screen.getByRole('button', { name: /Hủy tin nhắn \(Abort\)/i });
    act(() => {
      fireEvent.click(abortBtn);
    });

    expect(screen.queryByText(/Hủy tin nhắn \(Abort\)/i)).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(6000);
    });

    const status = screen.getByRole('status');
    expect(status.textContent).not.toContain('[GHOSTED]');
  });

  it('transitions to SELF_RESPECT_EXIT on Unbind and restores on Reset', () => {
    render(<SituationshipAnalyzer />);
    const unbindBtn = screen.getByRole('button', { name: /Unbind & Free Memory/i });

    act(() => {
      fireEvent.click(unbindBtn);
    });

    const statusSelfRespect = screen.getByRole('status');
    expect(statusSelfRespect.textContent).toContain('[SELF-RESPECT] Em chọn tự trọng buông tay');

    const resetBtn = screen.getByRole('button', { name: /Reset Situationship/i });
    act(() => {
      fireEvent.click(resetBtn);
    });

    const statusAfterReset = screen.getByRole('status');
    expect(statusAfterReset.textContent).toContain('[RED-FLAG]');
  });
});

