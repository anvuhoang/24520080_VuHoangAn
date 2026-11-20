// client/tests/matrixMemo.test.jsx — the matrix is computed once for the same dossiers, however often the page renders.
import { useState } from 'react';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DossierView from '../src/dossier/DossierView.jsx';
import { computeMatrix } from '../src/dossier/computeMatrix.js';
import { fakeApi, makeDossiers } from './fakeApi.js';

vi.mock('../src/dossier/computeMatrix.js', async (importOriginal) => {
  const original = await importOriginal();
  return { ...original, computeMatrix: vi.fn(original.computeMatrix) };
});

afterEach(() => vi.unstubAllGlobals());

// A layout that re-renders when asked and hands DossierView the SAME dossiers array each time
function Layout({ dossiers }) {
  const [renders, setRenders] = useState(0);
  return (
    <>
      <button type="button" onClick={() => setRenders(renders + 1)}>
        render {renders}
      </button>
      <Outlet context={{ dossiers }} />
    </>
  );
}

describe('the matrix of a dossier page', () => {
  it('is computed once while the dossiers keep their identity, although the page renders again', async () => {
    const api = fakeApi();
    vi.stubGlobal('fetch', api.fetchMock);
    const dossiers = makeDossiers();
    computeMatrix.mockClear();
    render(
      <MemoryRouter initialEntries={['/dossier/himass']}>
        <Routes>
          <Route path="/dossier" element={<Layout dossiers={dossiers} />}>
            <Route path=":playerID" element={<DossierView />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByRole('heading', { level: 2, name: 'Himass' })).toBeInTheDocument();
    for (let i = 0; i < 4; i++) await act(async () => screen.getByRole('button', { name: /^render/ }).click());
    expect(screen.getByRole('button', { name: 'render 4' })).toBeInTheDocument();
    expect(computeMatrix).toHaveBeenCalledTimes(1);
  });

  it('is computed again when the dossiers are a new array', async () => {
    const api = fakeApi();
    vi.stubGlobal('fetch', api.fetchMock);
    computeMatrix.mockClear();
    const { rerender } = render(
      <MemoryRouter initialEntries={['/dossier/himass']}>
        <Routes>
          <Route path="/dossier" element={<Layout dossiers={makeDossiers()} />}>
            <Route path=":playerID" element={<DossierView />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    await screen.findByRole('heading', { level: 2, name: 'Himass' });
    const before = computeMatrix.mock.calls.length;
    rerender(
      <MemoryRouter initialEntries={['/dossier/himass']}>
        <Routes>
          <Route path="/dossier" element={<Layout dossiers={makeDossiers()} />}>
            <Route path=":playerID" element={<DossierView />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    expect(computeMatrix.mock.calls.length).toBeGreaterThan(before);
  });
});
