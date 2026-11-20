import React, { useState } from 'react';
import { ApiError, Movie } from '../types';
import { api } from '../api';

interface MoviesViewProps {
  movies: Movie[];
  onRefresh: () => Promise<void>;
}

export const MoviesView: React.FC<MoviesViewProps> = ({ movies, onRefresh }) => {
  const [title, setTitle] = useState('');
  const [releaseYear, setReleaseYear] = useState('2025');
  const [runtime, setRuntime] = useState('135');
  const [watched, setWatched] = useState(false);
  const [selectedPrereqs, setSelectedPrereqs] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Edit state
  const [editingMovieId, setEditingMovieId] = useState<number | null>(null);
  const [editPrereqs, setEditPrereqs] = useState<number[]>([]);
  const [editTitle, setEditTitle] = useState('');
  const [editYear, setEditYear] = useState('');
  const [editRuntime, setEditRuntime] = useState('');

  // Feedback banner
  const [errorMsg, setErrorMsg] = useState<{ code: string; message: string } | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const movieMap = new Map(movies.map((m) => [m.id, m]));

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
      setSuccessMsg(`Created "${created.title}" (${created.releaseYear}, ${created.runtime} min).`);
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
      setSuccessMsg(`Updated "${updated.title}" and its prerequisites.`);
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
        message: 'Click "Reset Sample Data" in the top bar first to restore Iron Man and Avengers: Endgame.',
      });
      return;
    }

    try {
      await api.updateMovie(ironMan.id, { prerequisites: [endgame.id] });
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg({
          code: `${err.status} ${err.code}`,
          message: `Attempted to make "${endgame.title}" a prerequisite of "${ironMan.title}" → Rejected with ${err.status} ${err.code}: ${err.message}`,
        });
      }
    }
  };

  return (
    <div className="grid-two">
      {/* Left column: Create Movie form */}
      <div className="card">
        <h2 className="card-title">Add MCU Movie</h2>
        <p className="card-subtitle">
          Create a movie with a unique title, runtime (1–300 min), and optional prerequisites.
        </p>

        <form onSubmit={handleCreateMovie}>
          <div className="form-group">
            <label className="form-label">Movie Title (unique)</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Doctor Strange"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="form-row form-group">
            <div>
              <label className="form-label">Release Year</label>
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
            <div>
              <label className="form-label">Runtime (1–300 min)</label>
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

          <div className="form-group">
            <label className="form-label">
              Prerequisites — Watch These First ({selectedPrereqs.length} selected)
            </label>
            <div className="prereq-picker">
              {movies.map((m) => (
                <label key={m.id} className="prereq-option">
                  <input
                    type="checkbox"
                    checked={selectedPrereqs.includes(m.id)}
                    onChange={() => toggleCreatePrereq(m.id)}
                  />
                  <span>
                    {m.title} <small style={{ color: '#94a3b8' }}>({m.releaseYear})</small>
                  </span>
                </label>
              ))}
              {movies.length === 0 && (
                <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No existing movies yet.</span>
              )}
            </div>
          </div>

          <div className="form-group">
            <label className="prereq-option" style={{ paddingLeft: 0 }}>
              <input
                type="checkbox"
                className="watched-checkbox"
                checked={watched}
                onChange={(e) => setWatched(e.target.checked)}
              />
              <span>Already watched</span>
            </label>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={submitting}>
            + Create Movie
          </button>
        </form>

        <hr style={{ borderColor: 'var(--border-color)', margin: '20px 0 14px' }} />
        <div>
          <div className="form-label">Specification Validation Quick-Test</div>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            style={{ width: '100%' }}
            onClick={handleTestCircularDependency}
          >
            Test: Make Endgame a Prerequisite of Iron Man (409)
          </button>
        </div>
      </div>

      {/* Right column: Movies list & prerequisite editor */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <h2 className="card-title">MCU Movies Catalog ({movies.length})</h2>
            <p className="card-subtitle" style={{ marginBottom: 0 }}>
              Tick movies as watched or click &ldquo;Edit Prerequisites&rdquo; to modify dependencies.
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="alert alert-error">
            <div>
              <strong>{errorMsg.code}</strong>: {errorMsg.message}
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
              <div key={movie.id} className={`movie-item ${movie.watched ? 'watched' : ''}`}>
                <div className="movie-item-header">
                  <div className="movie-title-row">
                    <input
                      type="checkbox"
                      className="watched-checkbox"
                      checked={movie.watched}
                      onChange={() => handleToggleWatched(movie)}
                      title="Mark watched / unwatched"
                    />
                    <span className="movie-title">{movie.title}</span>
                    <span className="badge badge-meta">{movie.releaseYear}</span>
                    <span className="badge badge-meta">{movie.runtime} min</span>
                    <span className={`badge ${movie.watched ? 'badge-watched' : 'badge-unwatched'}`}>
                      {movie.watched ? 'Watched' : 'Unwatched'}
                    </span>
                  </div>

                  <div>
                    {!isEditing ? (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => startEditing(movie)}
                      >
                        Edit Prerequisites
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setEditingMovieId(null)}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>

                {/* Current prerequisites display */}
                <div className="prereq-chips">
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Watch first:
                  </span>
                  {movie.prerequisites.length === 0 ? (
                    <span className="badge badge-meta">None</span>
                  ) : (
                    movie.prerequisites.map((pid) => {
                      const pm = movieMap.get(pid);
                      return (
                        <span key={pid} className="badge badge-prereq">
                          {pm ? pm.title : `#${pid}`}
                        </span>
                      );
                    })
                  )}
                </div>

                {/* Inline Edit Panel */}
                {isEditing && (
                  <div
                    style={{
                      marginTop: 14,
                      paddingTop: 14,
                      borderTop: '1px solid var(--border-color)',
                    }}
                  >
                    <div className="form-row form-group">
                      <div>
                        <label className="form-label">Title</label>
                        <input
                          type="text"
                          className="form-input"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                        />
                      </div>
                      <div className="form-row">
                        <div>
                          <label className="form-label">Year</label>
                          <input
                            type="number"
                            className="form-input"
                            value={editYear}
                            onChange={(e) => setEditYear(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="form-label">Runtime (1–300)</label>
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

                    <div className="form-group">
                      <label className="form-label">
                        Select Prerequisites for &ldquo;{movie.title}&rdquo; (cycles return 409 CIRCULAR_DEPENDENCY):
                      </label>
                      <div className="prereq-picker">
                        {movies
                          .filter((candidate) => candidate.id !== movie.id)
                          .map((candidate) => (
                            <label key={candidate.id} className="prereq-option">
                              <input
                                type="checkbox"
                                checked={editPrereqs.includes(candidate.id)}
                                onChange={() => toggleEditPrereq(candidate.id)}
                              />
                              <span>
                                {candidate.title}{' '}
                                <small style={{ color: '#94a3b8' }}>({candidate.releaseYear})</small>
                              </span>
                            </label>
                          ))}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
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
                        Save Changes
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
