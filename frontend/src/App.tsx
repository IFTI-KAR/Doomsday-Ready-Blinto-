import React, { useEffect, useState } from 'react';
import { Cinema, Movie } from './types';
import { api } from './api';
import { MoviesView } from './components/MoviesView';
import { RewatchPlanView } from './components/RewatchPlanView';
import { BookingView } from './components/BookingView';

type ActiveTab = 'movies' | 'rewatch' | 'booking';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('movies');
  const [movies, setMovies] = useState<Movie[]>([]);
  const [cinemas, setCinemas] = useState<Cinema[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setError(null);
      const [moviesData, cinemasData] = await Promise.all([api.getMovies(), api.getCinemas()]);
      setMovies(Array.isArray(moviesData) ? moviesData : []);
      setCinemas(Array.isArray(cinemasData) ? cinemasData : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleResetSampleData = async () => {
    const res = await api.resetSampleData();
    setMovies(Array.isArray(res.movies) ? res.movies : []);
    setCinemas(Array.isArray(res.cinemas) ? res.cinemas : []);
  };

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="top-bar-inner">
          <div className="brand-group">
            <div className="brand-mark" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M7 4v16M17 4v16M2 9h5M17 9h5M2 15h5M17 15h5" />
              </svg>
            </div>
            <div className="brand-wordmark">
              <h1 className="brand-title">Doomsday Ready</h1>
              <span className="brand-meta">MCU rewatch &amp; premiere seating</span>
            </div>
          </div>

          <nav className="nav-tabs" aria-label="Workspace views">
            <button
              type="button"
              className={`nav-tab ${activeTab === 'movies' ? 'active' : ''}`}
              onClick={() => setActiveTab('movies')}
            >
              <span className="nav-tab-index">01</span>
              <span>Movies</span>
            </button>
            <button
              type="button"
              className={`nav-tab ${activeTab === 'rewatch' ? 'active' : ''}`}
              onClick={() => setActiveTab('rewatch')}
            >
              <span className="nav-tab-index">02</span>
              <span>Rewatch plan</span>
            </button>
            <button
              type="button"
              className={`nav-tab ${activeTab === 'booking' ? 'active' : ''}`}
              onClick={() => setActiveTab('booking')}
            >
              <span className="nav-tab-index">03</span>
              <span>Booking</span>
            </button>
          </nav>

          <button
            type="button"
            className="btn btn-quiet btn-sm"
            onClick={handleResetSampleData}
            title="Restore canonical MCU sample movies and test cinemas"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            <span>Reset sample data</span>
          </button>
        </div>
      </header>

      <div className="app-container">
        {error && (
          <div className="alert alert-error">
            <div>Connection error: {error}</div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={loadData}>
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-secondary)' }}>
            Loading catalog
          </div>
        ) : (
          <main>
            {activeTab === 'movies' && <MoviesView movies={movies} onRefresh={loadData} />}
            {activeTab === 'rewatch' && (
              <RewatchPlanView movies={movies} onRefreshMovies={loadData} />
            )}
            {activeTab === 'booking' && (
              <BookingView cinemas={cinemas} onRefreshCinemas={loadData} />
            )}
          </main>
        )}
      </div>
    </div>
  );
};
