import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ToastProvider } from './components/ui/Toast';

// Lazy-load pages for code splitting
const Home          = lazy(() => import('./pages/Home'));
const PollMaker     = lazy(() => import('./pages/PollMaker'));
const HostDashboard = lazy(() => import('./pages/HostDashboard'));
const BigScreen     = lazy(() => import('./pages/BigScreen'));
const JoinPage      = lazy(() => import('./pages/JoinPage'));
const VoteScreen    = lazy(() => import('./pages/VoteScreen'));
const ResultsScreen = lazy(() => import('./pages/ResultsScreen'));

const LoadingFallback: React.FC = () => (
  <div style={{
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--void)',
  }}>
    <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--ash)', fontSize: 16, letterSpacing: '0.08em' }}>
      LOADING…
    </p>
  </div>
);

const NotFound: React.FC = () => (
  <div style={{
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--void)',
    gap: 16,
  }}>
    <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 64, color: 'var(--pumpkin)' }}>404</h1>
    <p style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: 'var(--bone)' }}>NOTHING HERE BUT GHOSTS</p>
    <a href="/" className="btn-secondary">BACK HOME</a>
  </div>
);

const App: React.FC = () => (
  <BrowserRouter>
    <ToastProvider>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/"                  element={<Home />} />
          <Route path="/create"            element={<PollMaker />} />
          <Route path="/host/:pollId"      element={<HostDashboard />} />
          <Route path="/display"           element={<BigScreen />} />
          <Route path="/display/:pollId"   element={<BigScreen />} />
          <Route path="/join/:code"        element={<JoinPage />} />
          <Route path="/vote/:pollId"      element={<VoteScreen />} />
          <Route path="/results/:pollId"   element={<ResultsScreen />} />
          <Route path="*"                  element={<NotFound />} />
        </Routes>
      </Suspense>
    </ToastProvider>
  </BrowserRouter>
);

export default App;
