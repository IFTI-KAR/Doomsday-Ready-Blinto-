import { Router, Request, Response } from 'express';
import { AppDatabase } from '../db.js';
import { computeRewatchOrder, detectCircularDependency } from '../algorithms/rewatchOrder.js';

export function createMoviesRouter(database: AppDatabase): Router {
  const router = Router();

  /**
   * Helper to normalize prerequisite inputs (accepts numeric IDs, numeric strings, or exact movie titles)
   */
  function resolvePrerequisiteIds(
    rawPrereqs: unknown,
    selfId?: number
  ): { ok: true; ids: number[]; hasSelfRef: boolean } | { ok: false; status: number; code: string; message: string } {
    if (rawPrereqs === undefined || rawPrereqs === null) {
      return { ok: true, ids: [], hasSelfRef: false };
    }
    if (!Array.isArray(rawPrereqs)) {
      return {
        ok: false,
        status: 400,
        code: 'INVALID_PREREQUISITES',
        message: 'prerequisites must be an array of movie IDs',
      };
    }

    const resolvedIds: number[] = [];
    let hasSelfRef = false;

    for (const item of rawPrereqs) {
      let id: number | undefined;
      if (typeof item === 'number' && Number.isInteger(item)) {
        id = item;
      } else if (typeof item === 'string' && item.trim() !== '') {
        const parsed = Number(item.trim());
        if (Number.isInteger(parsed) && String(parsed) === item.trim()) {
          id = parsed;
        } else {
          const byTitle = database.getMovieByTitle(item.trim());
          if (byTitle) {
            id = byTitle.id;
          }
        }
      }

      if (id === undefined) {
        return {
          ok: false,
          status: 400,
          code: 'INVALID_PREREQUISITE',
          message: `Invalid or unknown prerequisite: ${JSON.stringify(item)}`,
        };
      }

      if (selfId !== undefined && id === selfId) {
        hasSelfRef = true;
      }

      if (!resolvedIds.includes(id)) {
        resolvedIds.push(id);
      }
    }

    return { ok: true, ids: resolvedIds, hasSelfRef };
  }

  // GET /api/movies — List all movies
  router.get('/', (_req: Request, res: Response) => {
    const movies = database.getAllMovies();
    res.json(movies);
  });

  // GET /api/movies/:id — Get a single movie
  router.get('/:id', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: 'INVALID_ID', message: 'Movie ID must be an integer' });
      return;
    }
    const movie = database.getMovieById(id);
    if (!movie) {
      res.status(404).json({ error: 'NOT_FOUND', message: `Movie with ID ${id} not found` });
      return;
    }
    res.json(movie);
  });

  // POST /api/movies — Create a movie
  router.post('/', (req: Request, res: Response) => {
    const { title, releaseYear, runtime, watched = false, prerequisites = [] } = req.body ?? {};

    if (typeof title !== 'string' || title.trim().length === 0) {
      res.status(400).json({
        error: 'INVALID_TITLE',
        message: 'Title is required and must be a non-empty string.',
      });
      return;
    }

    const existingTitle = database.getMovieByTitle(title);
    if (existingTitle) {
      res.status(409).json({
        error: 'DUPLICATE_TITLE',
        message: `A movie with title "${title.trim()}" already exists.`,
      });
      return;
    }

    const parsedYear = Number(releaseYear);
    if (!Number.isInteger(parsedYear) || parsedYear < 1 || parsedYear > 9999) {
      res.status(400).json({
        error: 'INVALID_RELEASE_YEAR',
        message: 'releaseYear must be a valid integer year.',
      });
      return;
    }

    const parsedRuntime = Number(runtime);
    if (!Number.isInteger(parsedRuntime) || parsedRuntime < 1 || parsedRuntime > 300) {
      res.status(400).json({
        error: 'INVALID_RUNTIME',
        message: 'runtime must be an integer between 1 and 300 minutes.',
      });
      return;
    }

    if (typeof watched !== 'boolean') {
      res.status(400).json({
        error: 'INVALID_WATCHED',
        message: 'watched must be a boolean (true or false).',
      });
      return;
    }

    const prereqResolution = resolvePrerequisiteIds(prerequisites);
    if (!prereqResolution.ok) {
      res.status(prereqResolution.status).json({
        error: prereqResolution.code,
        message: prereqResolution.message,
      });
      return;
    }

    // Verify all prerequisite movies exist
    const existingPrereqMap = database.getPrerequisiteMap();
    for (const prereqId of prereqResolution.ids) {
      if (!existingPrereqMap.has(prereqId)) {
        res.status(400).json({
          error: 'INVALID_PREREQUISITE',
          message: `Prerequisite movie with ID ${prereqId} does not exist.`,
        });
        return;
      }
    }

    // Check for circular dependency before creating
    const tempId = -1;
    const cycleCheck = detectCircularDependency(tempId, prereqResolution.ids, existingPrereqMap);
    if (cycleCheck.hasCycle) {
      res.status(409).json({
        error: 'CIRCULAR_DEPENDENCY',
        code: 'CIRCULAR_DEPENDENCY',
        message: 'A movie can never depend on itself, either directly or through other movies.',
        cyclePath: cycleCheck.cyclePath,
      });
      return;
    }

    const created = database.createMovie({
      title: title.trim(),
      releaseYear: parsedYear,
      runtime: parsedRuntime,
      watched,
      prerequisites: prereqResolution.ids,
    });

    res.status(201).json(created);
  });

  // PATCH /api/movies/:id — Update a movie (including watched and prerequisites)
  router.patch('/:id', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: 'INVALID_ID', message: 'Movie ID must be an integer' });
      return;
    }

    const existing = database.getMovieById(id);
    if (!existing) {
      res.status(404).json({ error: 'NOT_FOUND', message: `Movie with ID ${id} not found` });
      return;
    }

    const { title, releaseYear, runtime, watched, prerequisites } = req.body ?? {};

    if (title !== undefined) {
      if (typeof title !== 'string' || title.trim().length === 0) {
        res.status(400).json({
          error: 'INVALID_TITLE',
          message: 'Title must be a non-empty string.',
        });
        return;
      }
      const otherWithTitle = database.getMovieByTitle(title);
      if (otherWithTitle && otherWithTitle.id !== id) {
        res.status(409).json({
          error: 'DUPLICATE_TITLE',
          message: `A movie with title "${title.trim()}" already exists.`,
        });
        return;
      }
    }

    let parsedYear: number | undefined;
    if (releaseYear !== undefined) {
      parsedYear = Number(releaseYear);
      if (!Number.isInteger(parsedYear) || parsedYear < 1 || parsedYear > 9999) {
        res.status(400).json({
          error: 'INVALID_RELEASE_YEAR',
          message: 'releaseYear must be a valid integer year.',
        });
        return;
      }
    }

    let parsedRuntime: number | undefined;
    if (runtime !== undefined) {
      parsedRuntime = Number(runtime);
      if (!Number.isInteger(parsedRuntime) || parsedRuntime < 1 || parsedRuntime > 300) {
        res.status(400).json({
          error: 'INVALID_RUNTIME',
          message: 'runtime must be an integer between 1 and 300 minutes.',
        });
        return;
      }
    }

    if (watched !== undefined && typeof watched !== 'boolean') {
      res.status(400).json({
        error: 'INVALID_WATCHED',
        message: 'watched must be a boolean (true or false).',
      });
      return;
    }

    let resolvedPrereqs: number[] | undefined;
    if (prerequisites !== undefined) {
      const prereqResolution = resolvePrerequisiteIds(prerequisites, id);
      if (!prereqResolution.ok) {
        res.status(prereqResolution.status).json({
          error: prereqResolution.code,
          message: prereqResolution.message,
        });
        return;
      }

      if (prereqResolution.hasSelfRef) {
        res.status(409).json({
          error: 'CIRCULAR_DEPENDENCY',
          code: 'CIRCULAR_DEPENDENCY',
          message: 'A movie can never depend on itself, either directly or through other movies.',
          cyclePath: [id, id],
        });
        return;
      }

      const existingPrereqMap = database.getPrerequisiteMap();

      // Run circular dependency check first so cycle errors always return 409 CIRCULAR_DEPENDENCY
      const cycleCheck = detectCircularDependency(id, prereqResolution.ids, existingPrereqMap);
      if (cycleCheck.hasCycle) {
        const allMovies = database.getAllMovies();
        const titleById = new Map(allMovies.map((m) => [m.id, m.title]));
        const cycleTitles = cycleCheck.cyclePath.map((cid) => titleById.get(cid) ?? `#${cid}`);

        res.status(409).json({
          error: 'CIRCULAR_DEPENDENCY',
          code: 'CIRCULAR_DEPENDENCY',
          message: `Circular dependency detected: ${cycleTitles.join(' → ')}`,
          cyclePath: cycleCheck.cyclePath,
          cycleTitles,
        });
        return;
      }

      for (const prereqId of prereqResolution.ids) {
        if (!existingPrereqMap.has(prereqId)) {
          res.status(400).json({
            error: 'INVALID_PREREQUISITE',
            message: `Prerequisite movie with ID ${prereqId} does not exist.`,
          });
          return;
        }
      }

      resolvedPrereqs = prereqResolution.ids;
    }

    const updated = database.updateMovie(id, {
      title: title !== undefined ? title.trim() : undefined,
      releaseYear: parsedYear,
      runtime: parsedRuntime,
      watched,
      prerequisites: resolvedPrereqs,
    });

    res.json(updated);
  });

  // DELETE /api/movies/:id — Delete a movie
  router.delete('/:id', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: 'INVALID_ID', message: 'Movie ID must be an integer' });
      return;
    }
    const deleted = database.deleteMovie(id);
    if (!deleted) {
      res.status(404).json({ error: 'NOT_FOUND', message: `Movie with ID ${id} not found` });
      return;
    }
    res.status(204).send();
  });

  // GET /api/movies/:id/rewatch-order — Compute valid rewatch order for a target movie
  router.get('/:id/rewatch-order', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: 'INVALID_ID', message: 'Movie ID must be an integer' });
      return;
    }

    const allMovies = database.getAllMovies();
    const target = allMovies.find((m) => m.id === id);
    if (!target) {
      res.status(404).json({ error: 'NOT_FOUND', message: `Movie with ID ${id} not found` });
      return;
    }

    const result = computeRewatchOrder(id, allMovies);
    res.json(result);
  });

  return router;
}
