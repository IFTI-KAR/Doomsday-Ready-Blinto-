import { ApiError, BookingQuoteResult, Cinema, Movie, RewatchOrderResult } from './types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
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

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const code = data.error || data.code || `HTTP_${res.status}`;
    const message = data.message || code;
    throw new ApiError(res.status, code, message, data);
  }

  return data as T;
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
