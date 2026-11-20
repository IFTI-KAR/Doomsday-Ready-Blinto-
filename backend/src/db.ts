import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { Cinema, Movie } from './types.js';

export class AppDatabase {
  public db: DatabaseSync;

  constructor(dbPath: string = process.env.DB_PATH || path.join(process.cwd(), 'data', 'doomsday.db')) {
    if (dbPath !== ':memory:') {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
    this.db = new DatabaseSync(dbPath);
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS movies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL UNIQUE COLLATE NOCASE,
        release_year INTEGER NOT NULL CHECK (release_year >= 1 AND release_year <= 9999),
        runtime INTEGER NOT NULL CHECK (runtime >= 1 AND runtime <= 300),
        watched INTEGER NOT NULL DEFAULT 0 CHECK (watched IN (0, 1)),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS movie_prerequisites (
        movie_id INTEGER NOT NULL,
        prerequisite_id INTEGER NOT NULL,
        position INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (movie_id, prerequisite_id),
        FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE,
        FOREIGN KEY (prerequisite_id) REFERENCES movies(id) ON DELETE CASCADE,
        CHECK (movie_id != prerequisite_id)
      );

      CREATE TABLE IF NOT EXISTS cinemas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE COLLATE NOCASE,
        bundle_sizes TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  }

  public seedIfEmpty(): void {
    const movieCountRow = this.db.prepare('SELECT COUNT(*) as count FROM movies').get() as { count: number };
    const cinemaCountRow = this.db.prepare('SELECT COUNT(*) as count FROM cinemas').get() as { count: number };

    if (movieCountRow.count === 0 && cinemaCountRow.count === 0) {
      this.resetToSampleData();
    }
  }

  public resetToSampleData(): void {
    this.db.exec('BEGIN TRANSACTION');
    try {
      this.db.exec('DELETE FROM movie_prerequisites');
      this.db.exec('DELETE FROM movies');
      this.db.exec('DELETE FROM cinemas');
      this.db.exec("DELETE FROM sqlite_sequence WHERE name IN ('movies', 'cinemas')");

      // Canonical sample movies from the Blinto Assessment PDF
      const sampleMovies: Array<{
        title: string;
        releaseYear: number;
        runtime: number;
        watched: boolean;
        prereqTitles: string[];
      }> = [
        {
          title: 'Iron Man',
          releaseYear: 2008,
          runtime: 126,
          watched: true,
          prereqTitles: [],
        },
        {
          title: 'Captain America: The First Avenger',
          releaseYear: 2011,
          runtime: 124,
          watched: true,
          prereqTitles: [],
        },
        {
          title: 'The Avengers',
          releaseYear: 2012,
          runtime: 143,
          watched: true,
          prereqTitles: ['Iron Man', 'Captain America: The First Avenger'],
        },
        {
          title: 'Captain America: Civil War',
          releaseYear: 2016,
          runtime: 147,
          watched: true,
          prereqTitles: ['The Avengers'],
        },
        {
          title: 'Thor: Ragnarok',
          releaseYear: 2017,
          runtime: 130,
          watched: false,
          prereqTitles: [],
        },
        {
          title: 'Avengers: Infinity War',
          releaseYear: 2018,
          runtime: 149,
          watched: false,
          prereqTitles: ['Captain America: Civil War', 'Thor: Ragnarok'],
        },
        {
          title: 'Avengers: Endgame',
          releaseYear: 2019,
          runtime: 181,
          watched: false,
          prereqTitles: ['Avengers: Infinity War'],
        },
        {
          title: 'Avengers: Doomsday',
          releaseYear: 2026,
          runtime: 165,
          watched: false,
          prereqTitles: ['Avengers: Endgame'],
        },
      ];

      const insertMovieStmt = this.db.prepare(
        'INSERT INTO movies (title, release_year, runtime, watched) VALUES (?, ?, ?, ?)'
      );
      const idByTitle = new Map<string, number>();

      for (const m of sampleMovies) {
        const info = insertMovieStmt.run(m.title, m.releaseYear, m.runtime, m.watched ? 1 : 0);
        idByTitle.set(m.title, Number(info.lastInsertRowid));
      }

      const insertPrereqStmt = this.db.prepare(
        'INSERT INTO movie_prerequisites (movie_id, prerequisite_id, position) VALUES (?, ?, ?)'
      );

      for (const m of sampleMovies) {
        const movieId = idByTitle.get(m.title)!;
        m.prereqTitles.forEach((prereqTitle, idx) => {
          const prereqId = idByTitle.get(prereqTitle)!;
          insertPrereqStmt.run(movieId, prereqId, idx);
        });
      }

      // Canonical sample cinemas corresponding to the 4 Expected Results rows in the PDF
      const sampleCinemas: Array<{ name: string; bundleSizes: number[] }> = [
        { name: 'Stark Tower IMAX (Bundles: 1, 3, 4)', bundleSizes: [1, 3, 4] },
        { name: 'Wakanda Royal Cinema (Bundles: 2, 5)', bundleSizes: [2, 5] },
        { name: 'Avengers Compound VIP (Bundles: 6, 9, 20)', bundleSizes: [6, 9, 20] },
        { name: 'Sanctum Sanctorum Screen (Bundles: 4, 6)', bundleSizes: [4, 6] },
      ];

      const insertCinemaStmt = this.db.prepare(
        'INSERT INTO cinemas (name, bundle_sizes) VALUES (?, ?)'
      );

      for (const c of sampleCinemas) {
        insertCinemaStmt.run(c.name, JSON.stringify(c.bundleSizes));
      }

      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  public getAllMovies(): Movie[] {
    const movieRows = this.db
      .prepare('SELECT id, title, release_year, runtime, watched, created_at FROM movies ORDER BY id ASC')
      .all() as Array<{
      id: number;
      title: string;
      release_year: number;
      runtime: number;
      watched: number;
      created_at: string;
    }>;

    const prereqRows = this.db
      .prepare('SELECT movie_id, prerequisite_id FROM movie_prerequisites ORDER BY position ASC, prerequisite_id ASC')
      .all() as Array<{ movie_id: number; prerequisite_id: number }>;

    const prereqsByMovie = new Map<number, number[]>();
    for (const row of prereqRows) {
      const list = prereqsByMovie.get(row.movie_id) ?? [];
      list.push(row.prerequisite_id);
      prereqsByMovie.set(row.movie_id, list);
    }

    return movieRows.map((row) => ({
      id: Number(row.id),
      title: row.title,
      releaseYear: Number(row.release_year),
      runtime: Number(row.runtime),
      watched: Boolean(row.watched),
      prerequisites: prereqsByMovie.get(Number(row.id)) ?? [],
      createdAt: row.created_at,
    }));
  }

  public getMovieById(id: number): Movie | undefined {
    const all = this.getAllMovies();
    return all.find((m) => m.id === id);
  }

  public getMovieByTitle(title: string): Movie | undefined {
    const row = this.db
      .prepare('SELECT id FROM movies WHERE LOWER(title) = LOWER(?)')
      .get(title.trim()) as { id: number } | undefined;
    if (!row) return undefined;
    return this.getMovieById(Number(row.id));
  }

  public getPrerequisiteMap(): Map<number, number[]> {
    const map = new Map<number, number[]>();
    for (const m of this.getAllMovies()) {
      map.set(m.id, m.prerequisites);
    }
    return map;
  }

  public createMovie(input: {
    title: string;
    releaseYear: number;
    runtime: number;
    watched: boolean;
    prerequisites: number[];
  }): Movie {
    this.db.exec('BEGIN TRANSACTION');
    try {
      const info = this.db
        .prepare('INSERT INTO movies (title, release_year, runtime, watched) VALUES (?, ?, ?, ?)')
        .run(input.title.trim(), input.releaseYear, input.runtime, input.watched ? 1 : 0);

      const movieId = Number(info.lastInsertRowid);
      const insertPrereq = this.db.prepare(
        'INSERT INTO movie_prerequisites (movie_id, prerequisite_id, position) VALUES (?, ?, ?)'
      );
      input.prerequisites.forEach((prereqId, idx) => {
        insertPrereq.run(movieId, prereqId, idx);
      });

      this.db.exec('COMMIT');
      return this.getMovieById(movieId)!;
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  public updateMovie(
    id: number,
    updates: {
      title?: string;
      releaseYear?: number;
      runtime?: number;
      watched?: boolean;
      prerequisites?: number[];
    }
  ): Movie {
    const existing = this.getMovieById(id);
    if (!existing) {
      throw new Error(`Movie ${id} not found`);
    }

    const nextTitle = updates.title !== undefined ? updates.title.trim() : existing.title;
    const nextReleaseYear = updates.releaseYear !== undefined ? updates.releaseYear : existing.releaseYear;
    const nextRuntime = updates.runtime !== undefined ? updates.runtime : existing.runtime;
    const nextWatched = updates.watched !== undefined ? updates.watched : existing.watched;

    this.db.exec('BEGIN TRANSACTION');
    try {
      this.db
        .prepare('UPDATE movies SET title = ?, release_year = ?, runtime = ?, watched = ? WHERE id = ?')
        .run(nextTitle, nextReleaseYear, nextRuntime, nextWatched ? 1 : 0, id);

      if (updates.prerequisites !== undefined) {
        this.db.prepare('DELETE FROM movie_prerequisites WHERE movie_id = ?').run(id);
        const insertPrereq = this.db.prepare(
          'INSERT INTO movie_prerequisites (movie_id, prerequisite_id, position) VALUES (?, ?, ?)'
        );
        updates.prerequisites.forEach((prereqId, idx) => {
          insertPrereq.run(id, prereqId, idx);
        });
      }

      this.db.exec('COMMIT');
      return this.getMovieById(id)!;
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  public deleteMovie(id: number): boolean {
    const info = this.db.prepare('DELETE FROM movies WHERE id = ?').run(id);
    return Number(info.changes) > 0;
  }

  public getAllCinemas(): Cinema[] {
    const rows = this.db
      .prepare('SELECT id, name, bundle_sizes, created_at FROM cinemas ORDER BY id ASC')
      .all() as Array<{ id: number; name: string; bundle_sizes: string; created_at: string }>;

    return rows.map((row) => ({
      id: Number(row.id),
      name: row.name,
      bundleSizes: JSON.parse(row.bundle_sizes) as number[],
      createdAt: row.created_at,
    }));
  }

  public getCinemaById(id: number): Cinema | undefined {
    const row = this.db
      .prepare('SELECT id, name, bundle_sizes, created_at FROM cinemas WHERE id = ?')
      .get(id) as { id: number; name: string; bundle_sizes: string; created_at: string } | undefined;

    if (!row) return undefined;
    return {
      id: Number(row.id),
      name: row.name,
      bundleSizes: JSON.parse(row.bundle_sizes) as number[],
      createdAt: row.created_at,
    };
  }

  public getCinemaByName(name: string): Cinema | undefined {
    const row = this.db
      .prepare('SELECT id FROM cinemas WHERE LOWER(name) = LOWER(?)')
      .get(name.trim()) as { id: number } | undefined;
    if (!row) return undefined;
    return this.getCinemaById(Number(row.id));
  }

  public createCinema(input: { name: string; bundleSizes: number[] }): Cinema {
    const info = this.db
      .prepare('INSERT INTO cinemas (name, bundle_sizes) VALUES (?, ?)')
      .run(input.name.trim(), JSON.stringify(input.bundleSizes));
    return this.getCinemaById(Number(info.lastInsertRowid))!;
  }

  public deleteCinema(id: number): boolean {
    const info = this.db.prepare('DELETE FROM cinemas WHERE id = ?').run(id);
    return Number(info.changes) > 0;
  }

  public close(): void {
    this.db.close();
  }
}
