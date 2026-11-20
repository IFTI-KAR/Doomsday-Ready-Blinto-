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
