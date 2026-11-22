import React, { useEffect, useState } from 'react';
import { ApiError, BookingQuoteResult, Cinema } from '../types';
import { api } from '../api';

interface BookingViewProps {
  cinemas: Cinema[];
  onRefreshCinemas: () => Promise<void>;
}

export const BookingView: React.FC<BookingViewProps> = ({ cinemas, onRefreshCinemas }) => {
  const [selectedCinemaId, setSelectedCinemaId] = useState<number | null>(cinemas[0]?.id ?? null);
  const [groupSize, setGroupSize] = useState<string>('6');
  const [quote, setQuote] = useState<BookingQuoteResult | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const [newCinemaName, setNewCinemaName] = useState('');
  const [newBundlesInput, setNewBundlesInput] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (selectedCinemaId === null && cinemas.length > 0) {
      setSelectedCinemaId(cinemas[0].id);
    }
  }, [cinemas, selectedCinemaId]);

  const fetchQuote = async (cinemaId: number, size: number) => {
    setQuoteError(null);
    if (!Number.isInteger(size) || size < 1 || size > 10000) {
      setQuote(null);
      setQuoteError('Group size must be an integer between 1 and 10,000');
      return;
    }

    try {
      const res = await api.getBookingQuote(cinemaId, size);
      setQuote(res);
    } catch (err) {
      setQuote(null);
      setQuoteError(err instanceof Error ? err.message : String(err));
    }
  };

  useEffect(() => {
    if (selectedCinemaId !== null && groupSize.trim() !== '') {
      fetchQuote(selectedCinemaId, Number(groupSize));
    }
  }, [selectedCinemaId, groupSize]);

  const handleCreateCinema = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreateSuccess(null);

    const parsedSizes = newBundlesInput
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map(Number);

    try {
      const created = await api.createCinema({
        name: newCinemaName.trim(),
        bundleSizes: parsedSizes,
      });
      setNewCinemaName('');
      setNewBundlesInput('');
      setCreateSuccess(`Added ${created.name} with bundles [${created.bundleSizes.join(', ')}]`);
      await onRefreshCinemas();
      setSelectedCinemaId(created.id);
    } catch (err) {
      if (err instanceof ApiError) {
        setCreateError(`${err.code} — ${err.message}`);
      } else {
        setCreateError(String(err));
      }
    }
  };

  const applyPreset = (targetSizes: number[], size: number) => {
    const key = targetSizes.slice().sort((a, b) => a - b).join(',');
    const matching = cinemas.find(
      (c) => c.bundleSizes.slice().sort((a, b) => a - b).join(',') === key
    );
    if (matching) {
      setSelectedCinemaId(matching.id);
      setGroupSize(String(size));
    }
  };

  return (
    <div className="grid-workspace">
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Add cinema</h2>
            <p className="card-subtitle">
              Configure 1 to 10 distinct opening-night bundle sizes (1–500 seats each)
            </p>
          </div>
        </div>

        {createError && <div className="alert alert-error">{createError}</div>}
        {createSuccess && <div className="alert alert-success">{createSuccess}</div>}

        <form onSubmit={handleCreateCinema} className="form-stack">
          <div className="form-field">
            <label className="form-label">Cinema name</label>
            <input
              type="text"
              className="form-input"
              placeholder="Knowhere Screening Hall"
              value={newCinemaName}
              onChange={(e) => setNewCinemaName(e.target.value)}
              required
            />
          </div>

          <div className="form-field">
            <label className="form-label">
              <span>Bundle sizes</span>
              <span className="form-label-meta">1–500 seats</span>
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="2, 5, 12"
              value={newBundlesInput}
              onChange={(e) => setNewBundlesInput(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary">
            Create cinema
          </button>
        </form>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Watch-party seat allocation</h2>
            <p className="card-subtitle">
              Compute the fewest seat bundles summing to your exact group size (1–10,000) with zero empty seats
            </p>
          </div>
        </div>

        <div className="preset-strip">
          <span className="prereq-label">Specification cases</span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => applyPreset([1, 3, 4], 6)}
          >
            [1, 3, 4] · 6 guests
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => applyPreset([2, 5], 11)}
          >
            [2, 5] · 11 guests
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => applyPreset([6, 9, 20], 44)}
          >
            [6, 9, 20] · 44 guests
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => applyPreset([4, 6], 7)}
          >
            [4, 6] · 7 guests
          </button>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label className="form-label">Cinema</label>
            <select
              className="form-select"
              value={selectedCinemaId ?? ''}
              onChange={(e) => setSelectedCinemaId(Number(e.target.value))}
            >
              {cinemas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — [{c.bundleSizes.join(', ')}]
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label className="form-label">
              <span>Group size</span>
              <span className="form-label-meta">1–10,000</span>
            </label>
            <input
              type="number"
              className="form-input"
              min={1}
              max={10000}
              value={groupSize}
              onChange={(e) => setGroupSize(e.target.value)}
            />
          </div>
        </div>

        {quoteError && (
          <div className="alert alert-error" style={{ marginTop: 16 }}>
            {quoteError}
          </div>
        )}

        {quote && (
          <div className="ticket-manifest">
            <div className="ticket-manifest-header">
              <div>
                <span className="stat-label">
                  Allocation quote for {quote.groupSize} guests
                </span>
                <div
                  className="ticket-total-figure"
                  style={{ color: quote.possible ? 'var(--text-primary)' : '#f28b8d' }}
                >
                  {quote.formatted}
                </div>
              </div>

              <span className="timecode-tag">
                {quote.possible
                  ? `${quote.totalBundles} ${quote.totalBundles === 1 ? 'bundle' : 'bundles'} · 0 empty seats`
                  : 'No exact combination'}
              </span>
            </div>

            {quote.possible && quote.bundles.length > 0 && (
              <>
                <div className="seat-meter-bar" aria-hidden="true">
                  {quote.bundles.map((b) => (
                    <div
                      key={b.bundleSize}
                      className="seat-meter-segment"
                      style={{ width: `${(b.totalSeats / quote.groupSize) * 100}%` }}
                      title={`${b.bundleSize} × ${b.count} (${b.totalSeats} seats)`}
                    />
                  ))}
                </div>

                <div className="bundle-grid">
                  {quote.bundles.map((b) => (
                    <div key={b.bundleSize} className="bundle-voucher">
                      <span className="stat-label">{b.bundleSize}-seat bundle</span>
                      <div className="bundle-voucher-equation">
                        {b.bundleSize} × {b.count}
                      </div>
                      <span className="form-label-meta">{b.totalSeats} seats</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
