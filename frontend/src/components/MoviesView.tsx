import React, { useState } from 'react';
import { ApiError, Movie } from '../types';
import { api } from '../api';

interface MoviesViewProps {
  movies: Movie[];
  onRefresh: () => Promise<void>;
}

function formatTimecode(minutes: number): string {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00 · ${minutes}m`;
}

export const MoviesView: React.FC<MoviesViewProps> = ({ movies, onRefresh }) => {
  const [title, setTitle] = useState('');
  const [releaseYear, setReleaseYear] = useState('2025');
  const [runtime, setRuntime] = useState('135');
  const [watched, setWatched] = useState(false);
  const [selectedPrereqs, setSelectedPrereqs] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [editingMovieId, setEditingMovieId] = useState<number | null>(null);
  const [editPrereqs, setEditPrereqs] = useState<number[]>([]);
  const [editTitle, setEditTitle] = useState('');
  const [editYear, setEditYear] = useState('');
  const [editRuntime, setEditRuntime] = useState('');

  const [errorMsg, setErrorMsg] = useState<{ code: string; message: string } | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const movieMap = new Map(movies.map((m) => [m.id, m]));
  const watchedTotal = movies.filter((m) => m.watched).length;

  const toggleCreatePrereq = (id: number) => {
    setSelectedPrereqs((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleEditPrereq = (id: number) => {
    setEditPrereqs((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleCreateMovie = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setSubmitting(true);

    try {
      const created = await api.createMovie({
        title: title.trim(),
        releaseYear: Number(releaseYear),
        runtime: Number(runtime),
        watched,
        prerequisites: selectedPrereqs,
      });
      setTitle('');
      setSelectedPrereqs([]);
      setWatched(false);
      setSuccessMsg(`Added ${created.title} (${created.releaseYear}, ${created.runtime}m)`);
      await onRefresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg({ code: err.code, message: err.message });
      } else {
        setErrorMsg({ code: 'ERROR', message: String(err) });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleWatched = async (movie: Movie) => {
    setErrorMsg(null);
    try {
      await api.updateMovie(movie.id, { watched: !movie.watched });
      await onRefresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg({ code: err.code, message: err.message });
      }
    }
  };

  const startEditing = (movie: Movie) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setEditingMovieId(movie.id);
    setEditTitle(movie.title);
    setEditYear(String(movie.releaseYear));
    setEditRuntime(String(movie.runtime));
    setEditPrereqs([...movie.prerequisites]);
  };

  const handleSaveEdit = async (movieId: number) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setSubmitting(true);
    try {
      const updated = await api.updateMovie(movieId, {
        title: editTitle.trim(),
        releaseYear: Number(editYear),
        runtime: Number(editRuntime),
        prerequisites: editPrereqs,
      });
      setEditingMovieId(null);
      setSuccessMsg(`Updated ${updated.title}`);
      await onRefresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg({
          code: `${err.status} ${err.code}`,
          message: err.message,
        });
      } else {
        setErrorMsg({ code: 'ERROR', message: String(err) });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleTestCircularDependency = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    const ironMan = movies.find((m) => m.title.toLowerCase() === 'iron man');
    const endgame = movies.find((m) => m.title.toLowerCase() === 'avengers: endgame');
    if (!ironMan || !endgame) {
      setErrorMsg({
        code: 'MISSING_SAMPLE_DATA',
        message: 'Use "Reset sample data" in the top bar to restore Iron Man and Avengers: Endgame',
      });
      return;
    }

    try {
      await api.updateMovie(ironMan.id, { prerequisites: [endgame.id] });
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg({
          code: `${err.status} ${err.code}`,
          message: `${ironMan.title} cannot depend on ${endgame.title} — ${err.message}`,
        });
      }
    }
  };

  return (
    <div className="grid-workspace">
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Add movie</h2>
            <p className="card-subtitle">
              Register a title, runtime (1–300 min), and required prerequisites
            </p>
          </div>
        </div>

        <form onSubmit={handleCreateMovie} className="form-stack">
          <div className="form-field">
            <label className="form-label">Title</label>
            <input
              type="text"
              className="form-input"
              placeholder="Doctor Strange"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-field">
              <label className="form-label">Release year</label>
              <input
                type="number"
                className="form-input"
                min={1888}
                max={2100}
                value={releaseYear}
                onChange={(e) => setReleaseYear(e.target.value)}
                required
              />
            </div>
            <div className="form-field">
              <label className="form-label">
                <span>Runtime</span>
                <span className="form-label-meta">1–300m</span>
              </label>
              <input
                type="number"
                className="form-input"
                min={1}
                max={300}
                value={runtime}
                onChange={(e) => setRuntime(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-field">
            <label className="form-label">
              <span>Prerequisites</span>
              <span className="form-label-meta">{selectedPrereqs.length} selected</span>
            </label>
            <div className="prereq-picker">
              {movies.map((m) => (
                <label key={m.id} className="prereq-option">
                  <span className="prereq-option-left">
                    <input
                      type="checkbox"
                      className="checkbox-input"
                      checked={selectedPrereqs.includes(m.id)}
                      onChange={() => toggleCreatePrereq(m.id)}
                    />
                    <span>{m.title}</span>
                  </span>
                  <span className="form-label-meta">{m.releaseYear}</span>
                </label>
              ))}
              {movies.length === 0 && (
                <span style={{ color: 'var(--text-muted)', fontSize: 13, padding: 8 }}>
                  No movies in catalog
                </span>
              )}
            </div>
          </div>

          <label className="prereq-option" style={{ paddingLeft: 0 }}>
            <span className="prereq-option-left">
              <input
                type="checkbox"
                className="checkbox-input"
                checked={watched}
                onChange={(e) => setWatched(e.target.checked)}
              />
              <span>Mark as already watched</span>
            </span>
          </label>

          <button type="submit" className="btn btn-primary" disabled={submitting}>
            Add to catalog
          </button>
        </form>

        <hr className="divider" />

        <div className="form-field">
          <span className="form-label">Cycle validation check</span>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={handleTestCircularDependency}
          >
            Test circular dependency (Endgame → Iron Man)
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Movie catalog</h2>
            <p className="card-subtitle">
              Tick movies as watched or edit prerequisite chains
            </p>
          </div>
          <span className="timecode-tag">
            {watchedTotal} / {movies.length} watched
          </span>
        </div>

        {errorMsg && (
          <div className="alert alert-error">
            <div>
              <strong style={{ fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
                {errorMsg.code}
              </strong>{' '}
              — {errorMsg.message}
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setErrorMsg(null)}
            >
              Dismiss
            </button>
          </div>
        )}

        {successMsg && (
          <div className="alert alert-success">
            <div>{successMsg}</div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setSuccessMsg(null)}
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="movie-list">
          {movies.map((movie) => {
            const isEditing = editingMovieId === movie.id;

            return (
              <div key={movie.id} className="movie-row">
                <div className="movie-row-main">
                  <div className="movie-row-identity">
                    <input
                      type="checkbox"
                      className="checkbox-input"
                      checked={movie.watched}
                      onChange={() => handleToggleWatched(movie)}
                      aria-label={`Mark ${movie.title} as watched`}
                    />
                    <span className={`movie-title ${movie.watched ? 'is-watched' : ''}`}>
                      {movie.title}
                    </span>
                  </div>

                  <div className="movie-row-meta">
                    <span className="status-indicator">
                      <span className={`status-dot ${movie.watched ? 'watched' : 'unwatched'}`} />
                      <span>{movie.watched ? 'Watched' : 'Unwatched'}</span>
                    </span>
                    <span className="timecode-tag">{movie.releaseYear}</span>
                    <span className="timecode-tag">{formatTimecode(movie.runtime)}</span>

                    {!isEditing ? (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => startEditing(movie)}
                      >
                        Edit prerequisites
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-quiet btn-sm"
                        onClick={() => setEditingMovieId(null)}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>

                <div className="movie-prereq-bar">
                  <span className="prereq-label">Watch first</span>
                  {movie.prerequisites.length === 0 ? (
                    <span className="form-label-meta">None</span>
                  ) : (
                    movie.prerequisites.map((pid) => {
                      const pm = movieMap.get(pid);
                      return (
                        <span key={pid} className="prereq-keycap">
                          {pm ? pm.title : `#${pid}`}
                        </span>
                      );
                    })
                  )}
                </div>

                {isEditing && (
                  <div className="edit-drawer form-stack">
                    <div className="form-row">
                      <div className="form-field">
                        <label className="form-label">Title</label>
                        <input
                          type="text"
                          className="form-input"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                        />
                      </div>
                      <div className="form-row">
                        <div className="form-field">
                          <label className="form-label">Year</label>
                          <input
                            type="number"
                            className="form-input"
                            value={editYear}
                            onChange={(e) => setEditYear(e.target.value)}
                          />
                        </div>
                        <div className="form-field">
                          <label className="form-label">Runtime (m)</label>
                          <input
                            type="number"
                            className="form-input"
                            min={1}
                            max={300}
                            value={editRuntime}
                            onChange={(e) => setEditRuntime(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="form-field">
                      <label className="form-label">
                        <span>Prerequisites for {movie.title}</span>
                        <span className="form-label-meta">Cycles return 409 CIRCULAR_DEPENDENCY</span>
                      </label>
                      <div className="prereq-picker">
                        {movies
                          .filter((candidate) => candidate.id !== movie.id)
                          .map((candidate) => (
                            <label key={candidate.id} className="prereq-option">
                              <span className="prereq-option-left">
                                <input
                                  type="checkbox"
                                  className="checkbox-input"
                                  checked={editPrereqs.includes(candidate.id)}
                                  onChange={() => toggleEditPrereq(candidate.id)}
                                />
                                <span>{candidate.title}</span>
                              </span>
                              <span className="form-label-meta">{candidate.releaseYear}</span>
                            </label>
                          ))}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="btn btn-quiet btn-sm"
                        onClick={() => setEditingMovieId(null)}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => handleSaveEdit(movie.id)}
                        disabled={submitting}
                      >
                        Save changes
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
