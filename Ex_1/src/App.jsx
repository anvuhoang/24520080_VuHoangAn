// src/App.jsx
import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { PEOPLE } from './data/people.js';
import AppNav from './components/AppNav.jsx';
import DetailSkeleton from './components/DetailSkeleton.jsx';
import NoSelection from './components/NoSelection.jsx';
import NotFoundState from './components/NotFoundState.jsx';
import PeopleLayout from './components/PeopleLayout.jsx';
import { CHANNELS } from './forum/channels.js';
import ForumPage from './forum/ForumPage.jsx';
import SimpleForm from './form/SimpleForm.jsx';
import styles from './App.module.css';

// The detail view is its own chunk: it is only downloaded when a person is opened
const PersonDetail = lazy(() => import('./components/PersonDetail.jsx'));

export default function App() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Multi-route SPA</h1>
        <AppNav />
      </header>
      <Routes>
        <Route path="/" element={<Navigate to="/people" replace />} />

        {/* Sprint 1: nested layout, URL params and a lazy detail route */}
        <Route path="/people" element={<PeopleLayout people={PEOPLE} />}>
          <Route index element={<NoSelection />} />
          <Route
            path=":id"
            element={
              <Suspense fallback={<DetailSkeleton />}>
                <PersonDetail people={PEOPLE} />
              </Suspense>
            }
          />
        </Route>

        {/* Sprint 2: context form with synchronous validation */}
        <Route path="/form" element={<SimpleForm />} />

        {/* Sprint 3: forum channels backed by the Express API */}
        <Route path="/forum" element={<Navigate to={`/forum/${CHANNELS[0].id}`} replace />} />
        <Route path="/forum/:channelId" element={<ForumPage />} />

        <Route path="*" element={<NotFoundState />} />
      </Routes>
    </main>
  );
}
