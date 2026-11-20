// client/src/App.jsx — the route tree (React Router v7: <Routes>, element={…}, nested layout with <Outlet/>).
import { Navigate, Route, Routes } from 'react-router';
import DossierIndex from './dossier/DossierIndex.jsx';
import DossierLayout from './dossier/DossierLayout.jsx';
import DossierView from './dossier/DossierView.jsx';
import NotFoundState from './NotFoundState.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dossier" replace />} />
      <Route path="/dossier" element={<DossierLayout />}>
        <Route index element={<DossierIndex />} />
        <Route path=":playerID" element={<DossierView />} />
      </Route>
      <Route
        path="*"
        element={
          <main>
            <NotFoundState headingLevel={1} />
          </main>
        }
      />
    </Routes>
  );
}
