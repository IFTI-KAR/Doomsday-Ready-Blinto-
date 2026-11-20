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

  // Create Cinema form state
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
      setQuoteError('Group size must be an integer between 1 and 10,000.');
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
      setCreateSuccess(`Created cinema "${created.name}" with bundles [${created.bundleSizes.join(', ')}].`);
      await onRefreshCinemas();
      setSelectedCinemaId(created.id);
    } catch (err) {
      if (err instanceof ApiError) {
        setCreateError(`${err.code}: ${err.message}`);
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
    <div className="grid-two">
      {/* Left column: Create Cinema */}
      <div className="card">
        <h2 className="card-title">Add Opening-Night Cinema</h2>
        <p className="card-subtitle">
          Each cinema has a unique name and 1 to 10 different seat bundle sizes (1–500 seats each).
        </p>

        {createError && <div className="alert alert-error">{createError}</div>}
        {createSuccess && <div className="alert alert-success">{createSuccess}</div>}

        <form onSubmit={handleCreateCinema}>
          <div className="form-group">
            <label className="form-label">Cinema Name (unique)</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Knowhere Galactic Theater"
              value={newCinemaName}
              onChange={(e) => setNewCinemaName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Bundle Sizes (comma-separated, 1–500 seats)</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. 2, 5, 12"
              value={newBundlesInput}
              onChange={(e) => setNewBundlesInput(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
            + Create Cinema
          </button>
        </form>
      </div>

      {/* Right column: Watch-Party Booking Quote */}
      <div className="card">
        <h2 className="card-title">Opening-Night Watch-Party Booking Quote</h2>
        <p className="card-subtitle">
          Find the fewest seat bundles whose seats add up to your exact group size (1–10,000) so nobody
          pays for an empty seat.
        </p>

        {/* Quick presets for the 4 Expected Results rows in the PDF */}
        <div className="preset-row">
          <span style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', alignSelf: 'center' }}>
            PDF Test Cases:
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => applyPreset([1, 3, 4], 6)}
          >
            [1, 3, 4] &bull; Group 6
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => applyPreset([2, 5], 11)}
          >
            [2, 5] &bull; Group 11
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => applyPreset([6, 9, 20], 44)}
          >
            [6, 9, 20] &bull; Group 44
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => applyPreset([4, 6], 7)}
          >
            [4, 6] &bull; Group 7
          </button>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Select Cinema</label>
            <select
              className="form-select"
              value={selectedCinemaId ?? ''}
              onChange={(e) => setSelectedCinemaId(Number(e.target.value))}
            >
              {cinemas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — Bundles: [{c.bundleSizes.join(', ')}]
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Group Size (1–10,000 seats)</label>
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

        {quoteError && <div className="alert alert-error">{quoteError}</div>}

        {quote && (
          <div className={`quote-box ${quote.possible ? 'possible' : 'impossible'}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                  Optimal Bundle Combination for <strong>{quote.groupSize}</strong> guests
                </div>
                <div
                  style={{
                    fontSize: '1.45rem',
                    fontWeight: 800,
                    marginTop: 4,
                    color: quote.possible ? '#34d399' : '#fca5a5',
                  }}
                >
                  {quote.formatted}
                </div>
              </div>

              <span className={`badge ${quote.possible ? 'badge-watched' : 'alert-error'}`}>
                {quote.possible
                  ? `${quote.totalBundles} ${quote.totalBundles === 1 ? 'bundle' : 'bundles'} • 0 empty seats`
                  : 'Exact match not possible'}
              </span>
            </div>

            {quote.possible && quote.bundles.length > 0 && (
              <div className="bundle-cards">
                {quote.bundles.map((b) => (
                  <div key={b.bundleSize} className="bundle-card">
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {b.bundleSize}-Seat Bundle
                    </div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, margin: '6px 0' }}>
                      {b.bundleSize} &times; {b.count}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#34d399' }}>
                      {b.totalSeats} seats total
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
