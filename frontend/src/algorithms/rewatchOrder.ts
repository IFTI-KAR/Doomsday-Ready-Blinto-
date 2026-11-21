import { Movie, RewatchOrderResult } from '../types';

export function detectCircularDependency(
  targetMovieId: number,
  proposedPrerequisites: number[],
  existingPrereqMap: Map<number, number[]>
): { hasCycle: boolean; cyclePath: number[] } {
  if (proposedPrerequisites.includes(targetMovieId)) {
    return {
      hasCycle: true,
      cyclePath: [targetMovieId, targetMovieId],
    };
  }

  const getPrerequisites = (movieId: number): number[] => {
    if (movieId === targetMovieId) {
      return proposedPrerequisites;
    }
    return existingPrereqMap.get(movieId) ?? [];
  };

  const state = new Map<number, 0 | 1 | 2>();
  const parentStack: number[] = [];
  let detectedCycle: number[] = [];

  const allNodes = new Set<number>([
    targetMovieId,
    ...proposedPrerequisites,
    ...existingPrereqMap.keys(),
  ]);

  function dfs(nodeId: number): boolean {
    state.set(nodeId, 1);
    parentStack.push(nodeId);

    const prereqs = getPrerequisites(nodeId);
    for (const prereqId of prereqs) {
      const prereqState = state.get(prereqId) ?? 0;
      if (prereqState === 1) {
        const cycleStartIndex = parentStack.indexOf(prereqId);
        detectedCycle = [
          ...parentStack.slice(cycleStartIndex),
          prereqId,
        ];
        return true;
      }
      if (prereqState === 0) {
        if (dfs(prereqId)) {
          return true;
        }
      }
    }

    parentStack.pop();
    state.set(nodeId, 2);
    return false;
  }

  for (const nodeId of allNodes) {
    if ((state.get(nodeId) ?? 0) === 0) {
      if (dfs(nodeId)) {
        return {
          hasCycle: true,
          cyclePath: detectedCycle,
        };
      }
    }
  }

  return {
    hasCycle: false,
    cyclePath: [],
  };
}

export function computeRewatchOrder(
  targetMovieId: number,
  allMovies: Movie[]
): RewatchOrderResult {
  const movieById = new Map<number, Movie>();
  for (const movie of allMovies) {
    movieById.set(movie.id, movie);
  }

  const targetMovie = movieById.get(targetMovieId);
  if (!targetMovie) {
    throw new Error(`Movie with ID ${targetMovieId} not found`);
  }

  const visited = new Set<number>();
  const visiting = new Set<number>();
  const orderedMovies: Movie[] = [];

  function visit(movieId: number): void {
    if (visited.has(movieId)) {
      return;
    }
    if (visiting.has(movieId)) {
      throw new Error('CIRCULAR_DEPENDENCY');
    }

    const movie = movieById.get(movieId);
    if (!movie) {
      return;
    }

    visiting.add(movieId);

    for (const prereqId of movie.prerequisites) {
      visit(prereqId);
    }

    visiting.delete(movieId);
    visited.add(movieId);
    orderedMovies.push(movie);
  }

  for (const prereqId of targetMovie.prerequisites) {
    visit(prereqId);
  }

  let watchedCount = 0;
  let unwatchedRuntime = 0;
  let totalRuntimeMinutes = 0;

  for (const movie of orderedMovies) {
    totalRuntimeMinutes += movie.runtime;
    if (movie.watched) {
      watchedCount += 1;
    } else {
      unwatchedRuntime += movie.runtime;
    }
  }

  const totalMovies = orderedMovies.length;
  const unwatchedCount = totalMovies - watchedCount;

  return {
    targetMovie,
    movies: orderedMovies,
    order: orderedMovies,
    totalMovies,
    watchedCount,
    unwatchedCount,
    unwatchedRuntime,
    remainingRuntimeMinutes: unwatchedRuntime,
    totalRuntimeMinutes,
  };
}
