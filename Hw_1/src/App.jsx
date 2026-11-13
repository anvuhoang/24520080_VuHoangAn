// src/App.jsx — the route tree.
import { Navigate, Route, Routes } from 'react-router';
import PhotoGalleryLayout from './gallery/PhotoGalleryLayout.jsx';
import NotFoundState from './NotFoundState.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/gallery" replace />} />
      <Route path="/gallery" element={<PhotoGalleryLayout />} />
      <Route path="*" element={<NotFoundState />} />
    </Routes>
  );
}
