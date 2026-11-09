// tests/EffortCard.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EffortCard from '../src/components/EffortCard.jsx';

describe('EffortCard component', () => {
  it('renders with zero <div> and zero <span> tags', () => {
    const { container } = render(<EffortCard />);
    expect(container.querySelectorAll('div')).toHaveLength(0);
    expect(container.querySelectorAll('span')).toHaveLength(0);
  });

  it('pairs every input with label via useId()', () => {
    render(<EffortCard myTries={100} rivalTries={1} />);
    const myInput = screen.getByLabelText(/Số lần cố gắng của Em/i);
    const rivalInput = screen.getByLabelText(/Số phần nỗ lực của Ai Đó/i);

    expect(myInput).toBeInTheDocument();
    expect(rivalInput).toBeInTheDocument();
    expect(myInput.id).toBeTruthy();
    expect(rivalInput.id).toBeTruthy();
    expect(myInput.id).not.toBe(rivalInput.id);
  });

  it('dispatches onAddEffort when quick action buttons are clicked', () => {
    const onAddEffort = vi.fn();
    render(<EffortCard myTries={100} rivalTries={1} onAddEffort={onAddEffort} />);

    const plusOne = screen.getByRole('button', { name: /\+1 Quan tâm/i });
    expect(plusOne.getAttribute('type')).toBe('button');
    fireEvent.click(plusOne);

    expect(onAddEffort).toHaveBeenCalledWith(
      expect.objectContaining({ actor: 'EM', steps: 1 })
    );

    const plusRival = screen.getByRole('button', { name: /\+1 Gõ "Ừ"/i });
    fireEvent.click(plusRival);

    expect(onAddEffort).toHaveBeenCalledWith(
      expect.objectContaining({ actor: 'AI_DO', steps: 1 })
    );
  });

  it('renders metric description list with correct calculated scores', () => {
    render(<EffortCard myTries={100} rivalTries={1} />);
    expect(screen.getByText('10 điểm')).toBeInTheDocument();
    expect(screen.getByText('50 điểm')).toBeInTheDocument();
    expect(screen.getByText(/Ai đó áp đảo gấp 5 lần/i)).toBeInTheDocument();
  });
});

