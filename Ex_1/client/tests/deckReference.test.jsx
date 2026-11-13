// client/tests/deckReference.test.jsx
// The reference code of the Lab 4 deck (slides 22, 25 and 26), copied as it is, to show what it does.
// These tests describe defects of the DECK code; this project does not copy it.
import { useEffect, useId, useState } from 'react';
import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, NavLink, Outlet, Route, Routes, useParams } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useForumMessages } from '../src/sprint3-forum/useForumMessages.js';
import { controlledFetch } from './fetchMock.js';

afterEach(() => vi.unstubAllGlobals());

// ---- Slide 25: InputField.jsx
const SlideInputField = ({ label, error, ...props }) => {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className="field-group">
      <label htmlFor={id}>{label}</label>
      <input id={id} aria-invalid={!!error} aria-describedby={error ? errorId : undefined} />
      {error && (
        <span id={errorId} role="alert">
          {error}
        </span>
      )}
    </div>
  );
};

describe('slide 25: InputField', () => {
  it('drops every prop it does not name: value, name and onChange never reach the <input>', async () => {
    const onChange = vi.fn();
    render(<SlideInputField label="Email" name="email" type="email" value="a@b.co" onChange={onChange} />);
    const input = screen.getByLabelText('Email');
    expect(input).not.toHaveAttribute('name');
    expect(input).not.toHaveAttribute('type'); // `...props` is collected but never spread
    expect(input).toHaveValue(''); // the value prop is ignored
    await userEvent.type(input, 'x');
    expect(onChange).not.toHaveBeenCalled(); // so it can never report what is typed
  });

  it('is built from <div> and <span>, which project rule 2.1 forbids', () => {
    const { container } = render(<SlideInputField label="Email" error="Bad" />);
    expect(container.querySelectorAll('div, span').length).toBeGreaterThan(0);
  });
});

// ---- Slide 26: useForumMessages.js (the part that fetches)
const useSlideForumMessages = (forumId) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    const fetchMessages = async () => {
      try {
        const res = await fetch(`/api/forums/${forumId}/messages`, { signal: controller.signal });
        const result = await res.json();
        if (!controller.signal.aborted) {
          setData(result);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          // the slide logs the error here (project rule bans console)
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };
    fetchMessages();
    return () => controller.abort();
  }, [forumId]);
  return { data, loading };
};

describe('slide 26: useForumMessages', () => {
  const msg = (text) => [{ id: text, author: 'A', text, timestamp: '2026-01-01T09:00:00.000Z' }];

  it('after a switch it says "not loading" and still shows the PREVIOUS forum\'s messages while the new one loads', async () => {
    const { fetchMock, calls } = controlledFetch();
    vi.stubGlobal('fetch', fetchMock);
    const { result, rerender } = renderHook(({ id }) => useSlideForumMessages(id), { initialProps: { id: 'nasa' } });
    await act(async () => calls[0].resolve(msg('from nasa')));
    expect(result.current.loading).toBe(false);
    rerender({ id: 'notNasa' }); // the new request is now in flight
    expect(result.current.loading).toBe(false); // wrong: it IS loading
    expect(result.current.data.map((m) => m.text)).toEqual(['from nasa']); // wrong: another forum's data
  });

  it('this project\'s hook shows loading and nothing at all in the same situation', async () => {
    const { fetchMock, calls } = controlledFetch();
    vi.stubGlobal('fetch', fetchMock);
    const { result, rerender } = renderHook(({ id }) => useForumMessages(id), { initialProps: { id: 'nasa' } });
    await act(async () => calls[0].resolve(msg('from nasa')));
    rerender({ id: 'notNasa' });
    expect(result.current.status).toBe('loading');
    expect(result.current.messages).toEqual([]);
  });

  it('asks for /api/forums/:id/messages, a path that the server of slide 27 (/api/messages/:forum) does not have', async () => {
    const { fetchMock, calls } = controlledFetch();
    vi.stubGlobal('fetch', fetchMock);
    renderHook(() => useSlideForumMessages('nasa'));
    expect(calls[0].url).toBe('/api/forums/nasa/messages');
    expect(calls[0].url).not.toBe('/api/messages/nasa');
  });
});

// ---- Slide 22: PeopleLayout.jsx and PersonDetail.jsx
function SlidePeopleLayout({ people }) {
  return (
    <div className="people-frame">
      <nav className="sidebar">
        {people.map((p) => (
          <NavLink key={p.id} to={`/people/${p.id}`} className={({ isActive }) => (isActive ? 'active-link' : 'link')}>
            {p.name}
          </NavLink>
        ))}
      </nav>
      <main className="content-area">
        <Outlet />
      </main>
    </div>
  );
}

function SlidePersonDetail({ people }) {
  const { id } = useParams();
  const person = people.find((p) => p.id === id);
  if (!person) {
    return <div role="alert">404: Person Not Found</div>;
  }
  return (
    <dl className="person-details">
      <dt>Name</dt>
      <dd>{person.name}</dd>
    </dl>
  );
}

describe('slide 22: PeopleLayout and PersonDetail', () => {
  const people = [{ id: 'ada', name: 'Ada' }];
  const renderSlide = (path) =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <main>
          <Routes>
            <Route path="/people" element={<SlidePeopleLayout people={people} />}>
              <Route path=":id" element={<SlidePersonDetail people={people} />} />
            </Route>
          </Routes>
        </main>
      </MemoryRouter>
    );

  it('puts a <main> inside the main of the page (two main landmarks), and builds the layout from <div>', () => {
    const { container } = renderSlide('/people/ada');
    expect(screen.getAllByRole('main')).toHaveLength(2);
    expect(container.querySelectorAll('div').length).toBeGreaterThan(0);
  });

  it('shows a person with no heading at all', () => {
    renderSlide('/people/ada');
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('answers an unknown person with a bare <div role="alert"> and no way out of the dead end', () => {
    renderSlide('/people/nobody');
    expect(screen.getByRole('alert').tagName).toBe('DIV');
    expect(screen.getByRole('alert')).toHaveTextContent('404: Person Not Found');
    expect(screen.queryByRole('link', { name: /back/i })).toBeNull();
  });
});
