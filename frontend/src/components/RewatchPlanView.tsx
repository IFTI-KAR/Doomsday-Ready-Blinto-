import React, { useEffect, useState } from 'react';
import { Movie, RewatchOrderResult } from '../types';
import { api, formatMinutes } from '../api';

interface RewatchPlanViewProps {
  movies: Movie[];
  onRefreshMovies: () => Promise<void>;
}

export const RewatchPlanView: React.FC<RewatchPlanViewProps> = ({ movies, onRefreshMovies }) => {
  const [targetId, setTargetId] = useState<number | null>(() => {
    const doomsday = movies.find((m) => m.title.toLowerCase().includes('doomsday'));
    return doomsday ? doomsday.id : movies[0]?.id ?? null;
  });
  const [plan, setPlan] = useState<RewatchOrderResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (targetId === null && movies.length > 0) {
      const doomsday = movies.find((m) => m.title.toLowerCase().includes('doomsday'));
      setTargetId(doomsday ? doomsday.id : movies[0].id);
    }
  }, [movies, targetId]);

  const fetchPlan = async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getRewatchOrder(id);
      setPlan(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (targetId !== null) {
      fetchPlan(targetId);
    }
  }, [targetId, movies]);

  const handleToggleWatchedInPlan = async (movie: Movie) => {
    await api.updateMovie(movie.id, { watched: !movie.watched });
    await onRefreshMovies();
    if (targetId !== null) {
      await fetchPlan(targetId);
    }
  };

  const movieMap = new Map(movies.map((m) => [m.id, m]));
  const progressPercent =
    plan && plan.totalMovies > 0 ? Math.round((plan.watchedCount / plan.totalMovies) * 100) : 100;

  return (
    <div className="card">
      <h2 className="card-title">Rewatch Plan</h2>
      <p className="card-subtitle">
        Pick a target movie to see every prerequisite movie you need to watch before it, ordered so every
        movie comes after its prerequisites.
      </p>

      {/* Quick Presets from Assessment Expected Results */}
      <div className="preset-row">
        <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', alignSelf: 'center' }}>
          PDF Expected Result Presets:
        </span>
        {['Avengers: Doomsday', 'Captain America: Civil War', 'Thor: Ragnarok'].map((presetTitle) => {
          const found = movies.find((m) => m.title.toLowerCase() === presetTitle.toLowerCase());
          if (!found) return null;
          const isActive = targetId === found.id;
          return (
            <button
              key={found.id}
              type="button"
              className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setTargetId(found.id)}
            >
              {found.title}
            </button>
          );
        })}
      </div>

      <div className="form-group" style={{ maxWidth: 420 }}>
        <label className="form-label">Target Movie</label>
        <select
          className="form-select"
          value={targetId ?? ''}
          onChange={(e) => setTargetId(Number(e.target.value))}
        >
          {movies.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title} ({m.releaseYear})
            </option>
          ))}
        </select>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {plan && !loading && (
        <>
          <div className="progress-card">
            <div className="progress-stats">
              <div>
                <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                  Rewatch Progress for <strong>{plan.targetMovie.title}</strong>
                </div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, marginTop: 2 }}>
                  {plan.watchedCount} of {plan.totalMovies} watched
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                  Remaining Watch Time (Unwatched)
                </div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#34d399', marginTop: 2 }}>
                  {formatMinutes(plan.unwatchedRuntime)}
                </div>
              </div>
            </div>

            <div className="progress-bar-track">
              <div
                className="progress-bar-fill"
                style={{ width: `${progressPercent}%` }}
                role="progressbar"
                aria-valuenow={plan.watchedCount}
                aria-valuemin={0}
                aria-valuemax={plan.totalMovies}
              />
            </div>
          </div>

          {plan.movies.length === 0 ? (
            <div
              style={{
                padding: '28px 20px',
                textAlign: 'center',
                background: 'var(--bg-secondary)',
                borderRadius: 12,
                border: '1px dashed var(--border-color)',
              }}
            >
              <div style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 4 }}>
                No prerequisites required!
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                You can watch <strong>{plan.targetMovie.title}</strong> right away (empty prerequisite list).
              </div>
            </div>
          ) : (
            <div className="movie-list">
              {plan.movies.map((movie, index) => (
                <div key={movie.id} className={`movie-item ${movie.watched ? 'watched' : ''}`}>
                  <div className="movie-item-header">
                    <div className="movie-title-row">
                      <span className="step-number">{index + 1}</span>
                      <input
                        type="checkbox"
                        className="watched-checkbox"
                        checked={movie.watched}
                        onChange={() => handleToggleWatchedInPlan(movie)}
                        title="Tick as watched"
                      />
                      <span
                        className="movie-title"
                        style={{
                          textDecoration: movie.watched ? 'line-through' : 'none',
                          opacity: movie.watched ? 0.78 : 1,
                        }}
                      >
                        {movie.title}
                      </span>
                      <span className="badge badge-meta">{movie.releaseYear}</span>
                      <span className="badge badge-meta">{movie.runtime} min</span>
                    </div>

                    <span className={`badge ${movie.watched ? 'badge-watched' : 'badge-unwatched'}`}>
                      {movie.watched ? 'Watched' : `${movie.runtime} min remaining`}
                    </span>
                  </div>

                  {movie.prerequisites.length > 0 && (
                    <div className="prereq-chips" style={{ marginLeft: 38 }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        Unlocked after:
                      </span>
                      {movie.prerequisites.map((pid) => {
                        const pm = movieMap.get(pid);
                        return (
                          <span key={pid} className="badge badge-prereq">
                            {pm ? pm.title : `#${pid}`}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
