import { ApiError, BookingQuoteResult, Cinema, Movie, RewatchOrderResult } from './types';
import { standaloneStore } from './standaloneStore';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

// Tracks whether the backend API is unreachable or 404 (e.g. on static Netlify Drop)
let isStandaloneMode = false;

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  if (isStandaloneMode) {
    return handleStandalone<T>(path, options);
  }

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers ?? {}),
      },
      ...options,
    });

    if (res.status === 204) {
      return undefined as T;
    }

    const contentType = res.headers.get('content-type') || '';

    // If endpoint returned 404 or HTML (due to SPA fallback), backend is not running
    if (res.status === 404 || contentType.includes('text/html')) {
      console.warn(`[Doomsday Ready] API at ${path} returned ${res.status} (${contentType}). Falling back to in-browser standalone engine.`);
      isStandaloneMode = true;
      return handleStandalone<T>(path, options);
    }

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const code = data.error || data.code || `HTTP_${res.status}`;
      const message = data.message || code;
      throw new ApiError(res.status, code, message, data);
    }

    return data as T;
  } catch (err) {
    if (err instanceof ApiError) {
      throw err;
    }
    console.warn(`[Doomsday Ready] Backend unreachable. Falling back to in-browser standalone engine.`, err);
    isStandaloneMode = true;
    return handleStandalone<T>(path, options);
  }
}

function handleStandalone<T>(path: string, options?: RequestInit): Promise<T> {
  const method = (options?.method ?? 'GET').toUpperCase();
  const body = options?.body ? JSON.parse(options.body as string) : {};

  // GET /movies
  if (path === '/movies' && method === 'GET') {
    return Promise.resolve(standaloneStore.getMovies() as unknown as T);
  }

  // POST /movies
  if (path === '/movies' && method === 'POST') {
    return Promise.resolve(standaloneStore.createMovie(body) as unknown as T);
  }

  // PATCH /movies/:id
  const patchMovieMatch = path.match(/^\/movies\/(\d+)$/);
  if (patchMovieMatch && method === 'PATCH') {
    const id = Number(patchMovieMatch[1]);
    return Promise.resolve(standaloneStore.updateMovie(id, body) as unknown as T);
  }

  // DELETE /movies/:id
  if (patchMovieMatch && method === 'DELETE') {
    const id = Number(patchMovieMatch[1]);
    standaloneStore.deleteMovie(id);
    return Promise.resolve(undefined as unknown as T);
  }

  // GET /movies/:id/rewatch-order
  const rewatchMatch = path.match(/^\/movies\/(\d+)\/rewatch-order$/);
  if (rewatchMatch && method === 'GET') {
    const id = Number(rewatchMatch[1]);
    return Promise.resolve(standaloneStore.getRewatchOrder(id) as unknown as T);
  }

  // GET /cinemas
  if (path === '/cinemas' && method === 'GET') {
    return Promise.resolve(standaloneStore.getCinemas() as unknown as T);
  }

  // POST /cinemas
  if (path === '/cinemas' && method === 'POST') {
    return Promise.resolve(standaloneStore.createCinema(body) as unknown as T);
  }

  // DELETE /cinemas/:id
  const delCinemaMatch = path.match(/^\/cinemas\/(\d+)$/);
  if (delCinemaMatch && method === 'DELETE') {
    const id = Number(delCinemaMatch[1]);
    standaloneStore.deleteCinema(id);
    return Promise.resolve(undefined as unknown as T);
  }

  // GET /cinemas/:id/booking?groupSize=...
  const bookingMatch = path.match(/^\/cinemas\/(\d+)\/booking\?groupSize=(\d+)$/);
  if (bookingMatch && method === 'GET') {
    const id = Number(bookingMatch[1]);
    const size = Number(bookingMatch[2]);
    return Promise.resolve(standaloneStore.getBookingQuote(id, size) as unknown as T);
  }

  // POST /seed/reset
  if (path === '/seed/reset' && method === 'POST') {
    return Promise.resolve(standaloneStore.resetSampleData() as unknown as T);
  }

  throw new ApiError(404, 'NOT_FOUND', `Endpoint ${method} ${path} not supported in standalone mode`);
}

export const api = {
  getMovies(): Promise<Movie[]> {
    return request<Movie[]>('/movies');
  },

  createMovie(payload: {
    title: string;
    releaseYear: number;
    runtime: number;
    watched?: boolean;
    prerequisites?: number[];
  }): Promise<Movie> {
    return request<Movie>('/movies', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateMovie(
    id: number,
    payload: {
      title?: string;
      releaseYear?: number;
      runtime?: number;
      watched?: boolean;
      prerequisites?: number[];
    }
  ): Promise<Movie> {
    return request<Movie>(`/movies/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  deleteMovie(id: number): Promise<void> {
    return request<void>(`/movies/${id}`, {
      method: 'DELETE',
    });
  },

  getRewatchOrder(movieId: number): Promise<RewatchOrderResult> {
    return request<RewatchOrderResult>(`/movies/${movieId}/rewatch-order`);
  },

  getCinemas(): Promise<Cinema[]> {
    return request<Cinema[]>('/cinemas');
  },

  createCinema(payload: { name: string; bundleSizes: number[] }): Promise<Cinema> {
    return request<Cinema>('/cinemas', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  deleteCinema(id: number): Promise<void> {
    return request<void>(`/cinemas/${id}`, {
      method: 'DELETE',
    });
  },

  getBookingQuote(cinemaId: number, groupSize: number): Promise<BookingQuoteResult> {
    return request<BookingQuoteResult>(
      `/cinemas/${cinemaId}/booking?groupSize=${encodeURIComponent(groupSize)}`
    );
  },

  resetSampleData(): Promise<{ movies: Movie[]; cinemas: Cinema[]; message: string }> {
    return request<{ movies: Movie[]; cinemas: Cinema[]; message: string }>('/seed/reset', {
      method: 'POST',
    });
  },
};

export function formatMinutes(totalMinutes: number): string {
  if (totalMinutes <= 0) return '0 min';
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours}h (${totalMinutes} min)`;
  return `${hours}h ${mins}m (${totalMinutes} min)`;
}
