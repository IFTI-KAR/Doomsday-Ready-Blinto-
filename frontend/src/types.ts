export interface Movie {
  id: number;
  title: string;
  releaseYear: number;
  runtime: number;
  watched: boolean;
  prerequisites: number[];
  createdAt?: string;
}

export interface RewatchOrderResult {
  targetMovie: Movie;
  movies: Movie[];
  order: Movie[];
  totalMovies: number;
  watchedCount: number;
  unwatchedCount: number;
  unwatchedRuntime: number;
  remainingRuntimeMinutes: number;
  totalRuntimeMinutes: number;
}

export interface Cinema {
  id: number;
  name: string;
  bundleSizes: number[];
  createdAt?: string;
}

export interface BundleAllocation {
  bundleSize: number;
  count: number;
  totalSeats: number;
}

export interface BookingQuoteResult {
  cinemaId: number;
  cinemaName: string;
  bundleSizes: number[];
  groupSize: number;
  possible: boolean;
  totalBundles: number | null;
  bundles: BundleAllocation[];
  breakdown: Record<number, number>;
  formatted: string;
}

export class ApiError extends Error {
  public status: number;
  public code: string;
  public details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
