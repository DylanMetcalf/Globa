import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Shell } from './components/Shell';
import { Intro } from './components/Intro';
import { useStore } from './store';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ExplorePage } from './pages/ExplorePage';
import { RunningCouple } from './components/Mascots';

const DiscoverPage = lazy(() => import('./pages/DiscoverPage'));
const SavedPage = lazy(() => import('./pages/SavedPage'));
const PlacePage = lazy(() => import('./pages/PlacePage'));
const ItinerariesPage = lazy(() => import('./pages/ItinerariesPage'));
const ItineraryWizard = lazy(() => import('./pages/ItineraryWizard'));
const ItineraryPage = lazy(() => import('./pages/ItineraryPage'));
const OurWorldPage = lazy(() => import('./pages/OurWorldPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const LightItUpPage = lazy(() => import('./pages/LightItUpPage'));

const Loading = () => (
  <div style={{ flex: 1, display: 'grid', placeItems: 'center' }} role="status" aria-label="Loading">
    <div className="stack center" style={{ alignItems: 'center' }}><RunningCouple size={84} /><span className="muted small">Packing for the trip…</span></div>
  </div>
);

function ThemeSync() {
  const theme = useStore((s) => s.settings.theme);
  const motion = useStore((s) => s.settings.reducedMotion);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.motion = motion === 'on' ? 'reduced' : motion === 'off' ? 'full' : 'system';
  }, [theme, motion]);
  return null;
}

export default function App() {
  const introSeen = useStore((s) => s.settings.introSeen);
  const update = useStore((s) => s.updateSettings);
  const [showIntro, setShowIntro] = useState(() => {
    try { return !sessionStorage.getItem('globa:intro-shown'); } catch { return true; }
  });
  const [returning] = useState(introSeen);
  const done = useCallback(() => {
    try { sessionStorage.setItem('globa:intro-shown', '1'); } catch { /* ignore */ }
    update({ introSeen: true });
    setShowIntro(false);
  }, [update]);

  return (
    <ErrorBoundary>
      <ThemeSync />
      {showIntro && <Intro returning={returning} onDone={done} />}
      <BrowserRouter>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/light/:id" element={<LightItUpPage />} />
            <Route element={<Shell />}>
              <Route index element={<ExplorePage />} />
              <Route path="discover" element={<DiscoverPage />} />
              <Route path="saved" element={<SavedPage />} />
              <Route path="place/:id" element={<PlacePage />} />
              <Route path="itineraries" element={<ItinerariesPage />} />
              <Route path="itineraries/new" element={<ItineraryWizard />} />
              <Route path="itineraries/:id" element={<ItineraryPage />} />
              <Route path="our-world" element={<OurWorldPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
