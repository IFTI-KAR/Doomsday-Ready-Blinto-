import { ApiError, BookingQuoteResult, Cinema, Movie, RewatchOrderResult } from './types';
import { computeRewatchOrder, detectCircularDependency } from './algorithms/rewatchOrder';
import { computeBookingQuote } from './algorithms/bookingQuote';

const INITIAL_SAMPLE_MOVIES: Movie[] = [
  { id: 1, title: 'Iron Man', releaseYear: 2008, runtime: 126, watched: true, prerequisites: [] },
  { id: 2, title: 'Captain America: The First Avenger', releaseYear: 2011, runtime: 124, watched: true, prerequisites: [] },
  { id: 3, title: 'The Avengers', releaseYear: 2012, runtime: 143, watched: true, prerequisites: [1, 2] },
  { id: 4, title: 'Captain America: Civil War', releaseYear: 2016, runtime: 147, watched: true, prerequisites: [3] },
  { id: 5, title: 'Thor: Ragnarok', releaseYear: 2017, runtime: 130, watched: false, prerequisites: [] },
  { id: 6, title: 'Avengers: Infinity War', releaseYear: 2018, runtime: 149, watched: false, prerequisites: [4, 5] },
  { id: 7, title: 'Avengers: Endgame', releaseYear: 2019, runtime: 181, watched: false, prerequisites: [6] },
  { id: 8, title: 'Avengers: Doomsday', releaseYear: 2026, runtime: 165, watched: false, prerequisites: [7] },
];

const INITIAL_SAMPLE_CINEMAS: Cinema[] = [
  { id: 1, name: 'Stark Tower IMAX (Bundles: 1, 3, 4)', bundleSizes: [1, 3, 4] },
  { id: 2, name: 'Wakanda Royal Cinema (Bundles: 2, 5)', bundleSizes: [2, 5] },
  { id: 3, name: 'Avengers Compound VIP (Bundles: 6, 9, 20)', bundleSizes: [6, 9, 20] },
  { id: 4, name: 'Sanctum Sanctorum Screen (Bundles: 4, 6)', bundleSizes: [4, 6] },
];

const MOVIES_KEY = 'dr_movies_v1';
const CINEMAS_KEY = 'dr_cinemas_v1';

class StandaloneStore {
  private getStoredMovies(): Movie[] {
    try {
      const data = localStorage.getItem(MOVIES_KEY);
      if (data) return JSON.parse(data);
    } catch {}
    this.saveMovies(INITIAL_SAMPLE_MOVIES);
    return JSON.parse(JSON.stringify(INITIAL_SAMPLE_MOVIES));
  }

  private saveMovies(movies: Movie[]): void {
    try {
      localStorage.setItem(MOVIES_KEY, JSON.stringify(movies));
    } catch {}
  }

  private getStoredCinemas(): Cinema[] {
    try {
      const data = localStorage.getItem(CINEMAS_KEY);
      if (data) return JSON.parse(data);
    } catch {}
    this.saveCinemas(INITIAL_SAMPLE_CINEMAS);
    return JSON.parse(JSON.stringify(INITIAL_SAMPLE_CINEMAS));
  }

  private saveCinemas(cinemas: Cinema[]): void {
    try {
      localStorage.setItem(CINEMAS_KEY, JSON.stringify(cinemas));
    } catch {}
  }

  public getMovies(): Movie[] {
    return this.getStoredMovies();
  }

  public getMovieById(id: number): Movie | undefined {
    return this.getStoredMovies().find((m) => m.id === id);
  }

  public createMovie(payload: {
    title: string;
    releaseYear: number;
    runtime: number;
    watched?: boolean;
    prerequisites?: number[];
  }): Movie {
    const movies = this.getStoredMovies();
    if (!payload.title || payload.title.trim().length === 0) {
      throw new ApiError(400, 'INVALID_TITLE', 'Title is required');
    }
    if (movies.some((m) => m.title.toLowerCase() === payload.title.trim().toLowerCase())) {
      throw new ApiError(409, 'DUPLICATE_TITLE', `Movie "${payload.title}" already exists`);
    }
    if (payload.runtime < 1 || payload.runtime > 300) {
      throw new ApiError(400, 'INVALID_RUNTIME', 'Runtime must be between 1 and 300 minutes');
    }

    const prereqs = payload.prerequisites ?? [];
    const prereqMap = new Map(movies.map((m) => [m.id, m.prerequisites]));
    const cycle = detectCircularDependency(-1, prereqs, prereqMap);
    if (cycle.hasCycle) {
      throw new ApiError(409, 'CIRCULAR_DEPENDENCY', 'A movie can never depend on itself, either directly or through other movies.');
    }

    const newId = movies.reduce((max, m) => Math.max(max, m.id), 0) + 1;
    const newMovie: Movie = {
      id: newId,
      title: payload.title.trim(),
      releaseYear: payload.releaseYear,
      runtime: payload.runtime,
      watched: Boolean(payload.watched),
      prerequisites: prereqs,
      createdAt: new Date().toISOString(),
    };

    movies.push(newMovie);
    this.saveMovies(movies);
    return newMovie;
  }

  public updateMovie(
    id: number,
    payload: {
      title?: string;
      releaseYear?: number;
      runtime?: number;
      watched?: boolean;
      prerequisites?: number[];
    }
  ): Movie {
    const movies = this.getStoredMovies();
    const movie = movies.find((m) => m.id === id);
    if (!movie) {
      throw new ApiError(404, 'NOT_FOUND', `Movie with ID ${id} not found`);
    }

    if (payload.title !== undefined) {
      if (!payload.title.trim()) {
        throw new ApiError(400, 'INVALID_TITLE', 'Title cannot be empty');
      }
      if (movies.some((m) => m.id !== id && m.title.toLowerCase() === payload.title!.trim().toLowerCase())) {
        throw new ApiError(409, 'DUPLICATE_TITLE', `Movie "${payload.title}" already exists`);
      }
      movie.title = payload.title.trim();
    }

    if (payload.releaseYear !== undefined) movie.releaseYear = payload.releaseYear;
    if (payload.runtime !== undefined) {
      if (payload.runtime < 1 || payload.runtime > 300) {
        throw new ApiError(400, 'INVALID_RUNTIME', 'Runtime must be between 1 and 300 minutes');
      }
      movie.runtime = payload.runtime;
    }
    if (payload.watched !== undefined) movie.watched = payload.watched;

    if (payload.prerequisites !== undefined) {
      if (payload.prerequisites.includes(id)) {
        throw new ApiError(409, 'CIRCULAR_DEPENDENCY', 'A movie cannot depend on itself directly.');
      }
      const prereqMap = new Map(movies.map((m) => [m.id, m.prerequisites]));
      const cycle = detectCircularDependency(id, payload.prerequisites, prereqMap);
      if (cycle.hasCycle) {
        const titleById = new Map(movies.map((m) => [m.id, m.title]));
        const titles = cycle.cyclePath.map((cid) => titleById.get(cid) ?? `#${cid}`);
        throw new ApiError(409, 'CIRCULAR_DEPENDENCY', `Circular dependency detected: ${titles.join(' → ')}`);
      }
      movie.prerequisites = payload.prerequisites;
    }

    this.saveMovies(movies);
    return movie;
  }

  public deleteMovie(id: number): void {
    const movies = this.getStoredMovies().filter((m) => m.id !== id);
    this.saveMovies(movies);
  }

  public getRewatchOrder(movieId: number): RewatchOrderResult {
    const movies = this.getStoredMovies();
    return computeRewatchOrder(movieId, movies);
  }

  public getCinemas(): Cinema[] {
    return this.getStoredCinemas();
  }

  public createCinema(payload: { name: string; bundleSizes: number[] }): Cinema {
    const cinemas = this.getStoredCinemas();
    if (!payload.name || !payload.name.trim()) {
      throw new ApiError(400, 'INVALID_NAME', 'Cinema name is required');
    }
    if (cinemas.some((c) => c.name.toLowerCase() === payload.name.trim().toLowerCase())) {
      throw new ApiError(409, 'DUPLICATE_NAME', `Cinema "${payload.name}" already exists`);
    }

    const uniqueSizes = Array.from(new Set(payload.bundleSizes.map(Number))).sort((a, b) => a - b);
    if (uniqueSizes.length < 1 || uniqueSizes.length > 10) {
      throw new ApiError(400, 'INVALID_BUNDLE_COUNT', 'Cinema must have between 1 and 10 bundle sizes');
    }

    const newId = cinemas.reduce((max, c) => Math.max(max, c.id), 0) + 1;
    const newCinema: Cinema = {
      id: newId,
      name: payload.name.trim(),
      bundleSizes: uniqueSizes,
      createdAt: new Date().toISOString(),
    };
    cinemas.push(newCinema);
    this.saveCinemas(cinemas);
    return newCinema;
  }

  public deleteCinema(id: number): void {
    const cinemas = this.getStoredCinemas().filter((c) => c.id !== id);
    this.saveCinemas(cinemas);
  }

  public getBookingQuote(cinemaId: number, groupSize: number): BookingQuoteResult {
    const cinema = this.getStoredCinemas().find((c) => c.id === cinemaId);
    if (!cinema) {
      throw new ApiError(404, 'NOT_FOUND', `Cinema with ID ${cinemaId} not found`);
    }
    return computeBookingQuote(cinema, groupSize);
  }

  public resetSampleData(): { movies: Movie[]; cinemas: Cinema[]; message: string } {
    const movies = JSON.parse(JSON.stringify(INITIAL_SAMPLE_MOVIES));
    const cinemas = JSON.parse(JSON.stringify(INITIAL_SAMPLE_CINEMAS));
    this.saveMovies(movies);
    this.saveCinemas(cinemas);
    return {
      movies,
      cinemas,
      message: 'Database reset to canonical MCU sample movies and cinemas.',
    };
  }
}

export const standaloneStore = new StandaloneStore();
