// client/tests/DetailSkeleton.test.jsx
import { Suspense, lazy } from 'react';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DetailSkeleton from '../src/sprint1-router/DetailSkeleton.jsx';

describe('DetailSkeleton', () => {
  it('is a named region that says it is busy and announces its message politely', () => {
    const { container } = render(<DetailSkeleton />);
    const skeleton = screen.getByRole('region', { name: 'Loading dossier' });
    expect(skeleton).toHaveAttribute('aria-busy', 'true');
    expect(skeleton).toHaveAttribute('aria-live', 'polite');
    expect(skeleton).toHaveTextContent('Loading dossier…');
    expect(container.querySelectorAll('div, span')).toHaveLength(0);
  });

  it('shows another message when it is given one', () => {
    render(<DetailSkeleton label="One moment…" />);
    expect(screen.getByRole('region', { name: 'Loading dossier' })).toHaveTextContent('One moment…');
  });

  it('is what Suspense shows while a lazy view is still loading, and is replaced when the view arrives', async () => {
    let finish;
    const Slow = lazy(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({ default: () => <p>the loaded view</p> });
        })
    );
    render(
      <Suspense fallback={<DetailSkeleton />}>
        <Slow />
      </Suspense>
    );
    expect(screen.getByRole('region', { name: 'Loading dossier' })).toBeInTheDocument();
    expect(screen.queryByText('the loaded view')).toBeNull();

    await act(async () => {
      finish();
    });

    expect(await screen.findByText('the loaded view')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Loading dossier' })).toBeNull();
  });
});
