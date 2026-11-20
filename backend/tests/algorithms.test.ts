import test from 'node:test';
import assert from 'node:assert/strict';
import { computeRewatchOrder, detectCircularDependency } from '../src/algorithms/rewatchOrder.js';
import { computeBookingQuote } from '../src/algorithms/bookingQuote.js';
import { Cinema, Movie } from '../src/types.js';

const sampleMovies: Movie[] = [
  { id: 1, title: 'Iron Man', releaseYear: 2008, runtime: 126, watched: true, prerequisites: [] },
  { id: 2, title: 'Captain America: The First Avenger', releaseYear: 2011, runtime: 124, watched: true, prerequisites: [] },
  { id: 3, title: 'The Avengers', releaseYear: 2012, runtime: 143, watched: true, prerequisites: [1, 2] },
  { id: 4, title: 'Captain America: Civil War', releaseYear: 2016, runtime: 147, watched: true, prerequisites: [3] },
  { id: 5, title: 'Thor: Ragnarok', releaseYear: 2017, runtime: 130, watched: false, prerequisites: [] },
  { id: 6, title: 'Avengers: Infinity War', releaseYear: 2018, runtime: 149, watched: false, prerequisites: [4, 5] },
  { id: 7, title: 'Avengers: Endgame', releaseYear: 2019, runtime: 181, watched: false, prerequisites: [6] },
  { id: 8, title: 'Avengers: Doomsday', releaseYear: 2026, runtime: 165, watched: false, prerequisites: [7] },
];

function verifyTopologicalOrder(ordered: Movie[]): void {
  const seenIds = new Set<number>();
  const subsetIds = new Set(ordered.map((m) => m.id));
  for (const movie of ordered) {
    assert.equal(seenIds.has(movie.id), false, `Duplicate movie ${movie.title} in rewatch order`);
    for (const prereqId of movie.prerequisites) {
      if (subsetIds.has(prereqId)) {
        assert.equal(
          seenIds.has(prereqId),
          true,
          `Prerequisite ${prereqId} must appear before ${movie.title} (${movie.id})`
        );
      }
    }
    seenIds.add(movie.id);
  }
}

test('Feature 1: Rewatch order for Avengers: Doomsday returns all 7 prerequisites in valid order', () => {
  const result = computeRewatchOrder(8, sampleMovies);

  assert.equal(result.totalMovies, 7);
  assert.equal(result.movies.some((m) => m.id === 8), false, 'Target movie itself must not be included');
  verifyTopologicalOrder(result.movies);

  const titles = result.movies.map((m) => m.title);
  assert.deepEqual(titles, [
    'Iron Man',
    'Captain America: The First Avenger',
    'The Avengers',
    'Captain America: Civil War',
    'Thor: Ragnarok',
    'Avengers: Infinity War',
    'Avengers: Endgame',
  ]);

  assert.equal(result.watchedCount, 4);
  assert.equal(result.unwatchedCount, 3);
  assert.equal(result.unwatchedRuntime, 130 + 149 + 181);
});

test('Feature 1: Rewatch order for Captain America: Civil War returns Iron Man, First Avenger, then The Avengers', () => {
  const result = computeRewatchOrder(4, sampleMovies);

  assert.equal(result.totalMovies, 3);
  verifyTopologicalOrder(result.movies);

  const titles = result.movies.map((m) => m.title);
  assert.equal(titles[2], 'The Avengers');
  assert.equal(new Set(titles.slice(0, 2)).has('Iron Man'), true);
  assert.equal(new Set(titles.slice(0, 2)).has('Captain America: The First Avenger'), true);
});

test('Feature 1: Rewatch order for Thor: Ragnarok returns an empty list', () => {
  const result = computeRewatchOrder(5, sampleMovies);
  assert.equal(result.totalMovies, 0);
  assert.deepEqual(result.movies, []);
  assert.equal(result.watchedCount, 0);
  assert.equal(result.unwatchedRuntime, 0);
});

test('Feature 1: Making Avengers: Endgame a prerequisite of Iron Man is rejected as CIRCULAR_DEPENDENCY', () => {
  const prereqMap = new Map<number, number[]>(sampleMovies.map((m) => [m.id, m.prerequisites]));
  const check = detectCircularDependency(1, [7], prereqMap);
  assert.equal(check.hasCycle, true);
  assert.equal(check.cyclePath[0], 1);
  assert.equal(check.cyclePath[check.cyclePath.length - 1], 1);
});

test('Feature 1: Direct self-dependency is rejected as CIRCULAR_DEPENDENCY', () => {
  const prereqMap = new Map<number, number[]>(sampleMovies.map((m) => [m.id, m.prerequisites]));
  const check = detectCircularDependency(1, [1], prereqMap);
  assert.equal(check.hasCycle, true);
});

test('Feature 2: Booking quote expected results from specification table', () => {
  const c1: Cinema = { id: 1, name: 'C1', bundleSizes: [1, 3, 4] };
  const q1 = computeBookingQuote(c1, 6);
  assert.equal(q1.possible, true);
  assert.equal(q1.totalBundles, 2);
  assert.deepEqual(q1.breakdown, { 3: 2 });
  assert.equal(q1.formatted, '2 bundles: 3 × 2');

  const c2: Cinema = { id: 2, name: 'C2', bundleSizes: [2, 5] };
  const q2 = computeBookingQuote(c2, 11);
  assert.equal(q2.possible, true);
  assert.equal(q2.totalBundles, 4);
  assert.deepEqual(q2.breakdown, { 5: 1, 2: 3 });
  assert.equal(q2.formatted, '4 bundles: 5 × 1, 2 × 3');

  const c3: Cinema = { id: 3, name: 'C3', bundleSizes: [6, 9, 20] };
  const q3 = computeBookingQuote(c3, 44);
  assert.equal(q3.possible, true);
  assert.equal(q3.totalBundles, 4);
  assert.deepEqual(q3.breakdown, { 20: 1, 9: 2, 6: 1 });
  assert.equal(q3.formatted, '4 bundles: 20 × 1, 9 × 2, 6 × 1');

  const c4: Cinema = { id: 4, name: 'C4', bundleSizes: [4, 6] };
  const q4 = computeBookingQuote(c4, 7);
  assert.equal(q4.possible, false);
  assert.equal(q4.totalBundles, null);
  assert.equal(q4.formatted, 'Not possible');
});

test('Feature 2: Booking quote handles large groupSize up to 10,000 accurately', () => {
  const cinema: Cinema = { id: 5, name: 'Mega IMAX', bundleSizes: [7, 25, 100] };
  const quote = computeBookingQuote(cinema, 10000);
  assert.equal(quote.possible, true);
  assert.equal(quote.totalBundles, 100);
  assert.deepEqual(quote.breakdown, { 100: 100 });
});
