import React, { useEffect, useState } from 'react';
import { Movie, RewatchOrderResult } from '../types';
import { api, formatMinutes } from '../api';

interface RewatchPlanViewProps {
  movies: Movie[];
  onRefreshMovies: () => Promise<void>;
}

function formatTimecode(minutes: number): string {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00 · ${minutes}m`;
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
      <div className="card-header">
        <div>
          <h2 className="card-title">Rewatch screening sequence</h2>
          <p className="card-subtitle">
            Every prerequisite movie ordered topologically so each film screens after its dependencies
          </p>
        </div>
      </div>

      <div className="preset-strip">
        <span className="prereq-label">Target presets</span>
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

      <div className="form-field" style={{ maxWidth: 400, marginBottom: 24 }}>
        <label className="form-label">Target movie</label>
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
          <div className="stat-strip">
            <div className="stat-card">
              <span className="stat-label">Completion progress</span>
              <div className="stat-figure">
                {plan.watchedCount} of {plan.totalMovies} watched
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${progressPercent}%` }}
                  role="progressbar"
                  aria-valuenow={plan.watchedCount}
                  aria-valuemin={0}
                  aria-valuemax={plan.totalMovies}
                />
              </div>
            </div>

            <div className="stat-card">
              <span className="stat-label">Remaining watch time</span>
              <div className="stat-figure accent">{plan.unwatchedRuntime}m</div>
              <span className="stat-caption">{formatMinutes(plan.unwatchedRuntime)} unwatched</span>
            </div>

            <div className="stat-card">
              <span className="stat-label">Total marathon runtime</span>
              <div className="stat-figure">{plan.totalRuntimeMinutes}m</div>
              <span className="stat-caption">
                Before {plan.targetMovie.title} ({plan.targetMovie.releaseYear})
              </span>
            </div>
          </div>

          {plan.movies.length === 0 ? (
            <div
              style={{
                padding: 32,
                textAlign: 'center',
                backgroundColor: 'var(--bg-deep)',
                borderRadius: 8,
                border: '1px solid var(--border-hairline)',
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>
                No prerequisites required
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                {plan.targetMovie.title} has no prior prerequisite films in the catalog
              </div>
            </div>
          ) : (
            <div className="timeline-list">
              {plan.movies.map((movie, index) => (
                <div
                  key={movie.id}
                  className={`timeline-row ${movie.watched ? 'is-watched' : ''}`}
                >
                  <div className="timeline-step">
                    {String(index + 1).padStart(2, '0')}
                  </div>

                  <div>
                    <div className="movie-row-identity">
                      <input
                        type="checkbox"
                        className="checkbox-input"
                        checked={movie.watched}
                        onChange={() => handleToggleWatchedInPlan(movie)}
                        aria-label={`Mark ${movie.title} as watched`}
                      />
                      <span className={`movie-title ${movie.watched ? 'is-watched' : ''}`}>
                        {movie.title}
                      </span>
                      <span className="timecode-tag">{movie.releaseYear}</span>
                    </div>

                    {movie.prerequisites.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, marginLeft: 28, flexWrap: 'wrap' }}>
                        <span className="prereq-label">Follows</span>
                        {movie.prerequisites.map((pid) => {
                          const pm = movieMap.get(pid);
                          return (
                            <span key={pid} className="prereq-keycap">
                              {pm ? pm.title : `#${pid}`}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="movie-row-meta">
                    <span className="timecode-tag">{formatTimecode(movie.runtime)}</span>
                    <span className="status-indicator" style={{ minWidth: 84, justifyContent: 'flex-end' }}>
                      <span className={`status-dot ${movie.watched ? 'watched' : 'unwatched'}`} />
                      <span>{movie.watched ? 'Watched' : 'Remaining'}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
