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
    setMovies(res.movies);
    setCinemas(res.cinemas);
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="brand-group">
          <div className="brand-badge">DR</div>
          <div>
            <h1 className="brand-title">Doomsday Ready</h1>
            <p className="brand-subtitle">
              MCU Rewatch Order Planner &amp; Opening-Night Watch-Party Bundle Booking
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <nav className="nav-tabs" aria-label="Main Views">
            <button
              type="button"
              className={`nav-tab ${activeTab === 'movies' ? 'active' : ''}`}
              onClick={() => setActiveTab('movies')}
            >
              1. Movies
            </button>
            <button
              type="button"
              className={`nav-tab ${activeTab === 'rewatch' ? 'active' : ''}`}
              onClick={() => setActiveTab('rewatch')}
            >
              2. Rewatch Plan
            </button>
            <button
              type="button"
              className={`nav-tab ${activeTab === 'booking' ? 'active' : ''}`}
              onClick={() => setActiveTab('booking')}
            >
              3. Booking
            </button>
          </nav>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleResetSampleData}
            title="Restore the canonical MCU movies and test cinemas from the assessment PDF"
          >
            Reset Sample Data
          </button>
        </div>
      </header>

      {error && (
        <div className="alert alert-error">
          <div>Failed to connect to API: {error}</div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={loadData}>
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          Loading Doomsday Ready...
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
  );
};
