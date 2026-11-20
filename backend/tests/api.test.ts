import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { AppDatabase } from '../src/db.js';
import { createApp } from '../src/app.js';

async function withTestServer(fn: (baseUrl: string, db: AppDatabase) => Promise<void>): Promise<void> {
  const db = new AppDatabase(':memory:');
  db.seedIfEmpty();
  const app = createApp(db);
  const server = http.createServer(app);

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await fn(baseUrl, db);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    db.close();
  }
}

test('API: GET /api/movies and GET /api/movies/:id/rewatch-order work on seeded MCU movies', async () => {
  await withTestServer(async (baseUrl) => {
    const listRes = await fetch(`${baseUrl}/api/movies`);
    assert.equal(listRes.status, 200);
    const movies = (await listRes.json()) as Array<{ id: number; title: string }>;
    assert.equal(movies.length, 8);

    const doomsday = movies.find((m) => m.title === 'Avengers: Doomsday')!;
    const orderRes = await fetch(`${baseUrl}/api/movies/${doomsday.id}/rewatch-order`);
    assert.equal(orderRes.status, 200);
    const orderBody = (await orderRes.json()) as {
      totalMovies: number;
      watchedCount: number;
      unwatchedRuntime: number;
      movies: Array<{ title: string }>;
    };
    assert.equal(orderBody.totalMovies, 7);
    assert.equal(orderBody.watchedCount, 4);
    assert.equal(orderBody.unwatchedRuntime, 460);
  });
});

test('API: PATCH /api/movies/:id rejects circular dependency with 409 CIRCULAR_DEPENDENCY', async () => {
  await withTestServer(async (baseUrl) => {
    const listRes = await fetch(`${baseUrl}/api/movies`);
    const movies = (await listRes.json()) as Array<{ id: number; title: string }>;
    const ironMan = movies.find((m) => m.title === 'Iron Man')!;
    const endgame = movies.find((m) => m.title === 'Avengers: Endgame')!;

    const patchRes = await fetch(`${baseUrl}/api/movies/${ironMan.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prerequisites: [endgame.id] }),
    });

    assert.equal(patchRes.status, 409);
    const body = (await patchRes.json()) as { error: string; code: string };
    assert.equal(body.error, 'CIRCULAR_DEPENDENCY');
    assert.equal(body.code, 'CIRCULAR_DEPENDENCY');
  });
});

test('API: POST /api/movies validates runtime 1-300 and unique title', async () => {
  await withTestServer(async (baseUrl) => {
    // Invalid runtime > 300
    const badRuntimeRes = await fetch(`${baseUrl}/api/movies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Long Cut', releaseYear: 2025, runtime: 350 }),
    });
    assert.equal(badRuntimeRes.status, 400);

    // Valid movie create
    const createRes = await fetch(`${baseUrl}/api/movies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Doctor Strange',
        releaseYear: 2016,
        runtime: 115,
        watched: false,
        prerequisites: [1],
      }),
    });
    assert.equal(createRes.status, 201);
    const created = (await createRes.json()) as { id: number; title: string; prerequisites: number[] };
    assert.equal(created.title, 'Doctor Strange');
    assert.deepEqual(created.prerequisites, [1]);

    // Duplicate title
    const dupRes = await fetch(`${baseUrl}/api/movies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Doctor Strange', releaseYear: 2016, runtime: 115 }),
    });
    assert.equal(dupRes.status, 409);
  });
});

test('API: POST /api/cinemas and GET /api/cinemas/:id/booking?groupSize=6 work as specified', async () => {
  await withTestServer(async (baseUrl) => {
    const createRes = await fetch(`${baseUrl}/api/cinemas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Bifrost Multiplex', bundleSizes: [6, 9, 20] }),
    });
    assert.equal(createRes.status, 201);
    const cinema = (await createRes.json()) as { id: number };

    const quoteRes = await fetch(`${baseUrl}/api/cinemas/${cinema.id}/booking?groupSize=44`);
    assert.equal(quoteRes.status, 200);
    const quote = (await quoteRes.json()) as {
      possible: boolean;
      totalBundles: number;
      formatted: string;
    };
    assert.equal(quote.possible, true);
    assert.equal(quote.totalBundles, 4);
    assert.equal(quote.formatted, '4 bundles: 20 × 1, 9 × 2, 6 × 1');
  });
});
