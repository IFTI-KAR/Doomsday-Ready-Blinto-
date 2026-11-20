import { Router, Request, Response } from 'express';
import { AppDatabase } from '../db.js';
import { computeBookingQuote } from '../algorithms/bookingQuote.js';

export function createCinemasRouter(database: AppDatabase): Router {
  const router = Router();

  // GET /api/cinemas — List all cinemas
  router.get('/', (_req: Request, res: Response) => {
    const cinemas = database.getAllCinemas();
    res.json(cinemas);
  });

  // GET /api/cinemas/:id — Get a single cinema
  router.get('/:id', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: 'INVALID_ID', message: 'Cinema ID must be an integer' });
      return;
    }
    const cinema = database.getCinemaById(id);
    if (!cinema) {
      res.status(404).json({ error: 'NOT_FOUND', message: `Cinema with ID ${id} not found` });
      return;
    }
    res.json(cinema);
  });

  // POST /api/cinemas — Create a cinema
  router.post('/', (req: Request, res: Response) => {
    const { name, bundleSizes } = req.body ?? {};

    if (typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({
        error: 'INVALID_NAME',
        message: 'Cinema name is required and must be a non-empty string.',
      });
      return;
    }

    const existing = database.getCinemaByName(name);
    if (existing) {
      res.status(409).json({
        error: 'DUPLICATE_NAME',
        message: `A cinema named "${name.trim()}" already exists.`,
      });
      return;
    }

    if (!Array.isArray(bundleSizes)) {
      res.status(400).json({
        error: 'INVALID_BUNDLE_SIZES',
        message: 'bundleSizes must be an array of integers.',
      });
      return;
    }

    const parsedSizes: number[] = [];
    for (const rawSize of bundleSizes) {
      const size = Number(rawSize);
      if (!Number.isInteger(size) || size < 1 || size > 500) {
        res.status(400).json({
          error: 'INVALID_BUNDLE_SIZE',
          message: 'Each bundle size must be an integer between 1 and 500 seats.',
        });
        return;
      }
      parsedSizes.push(size);
    }

    const uniqueSizes = Array.from(new Set(parsedSizes)).sort((a, b) => a - b);
    if (uniqueSizes.length < 1 || uniqueSizes.length > 10) {
      res.status(400).json({
        error: 'INVALID_BUNDLE_COUNT',
        message: 'A cinema must have between 1 and 10 different bundle sizes.',
      });
      return;
    }

    if (uniqueSizes.length !== parsedSizes.length) {
      res.status(400).json({
        error: 'DUPLICATE_BUNDLE_SIZES',
        message: 'Bundle sizes for a cinema must be distinct integers.',
      });
      return;
    }

    const created = database.createCinema({
      name: name.trim(),
      bundleSizes: uniqueSizes,
    });

    res.status(201).json(created);
  });

  // DELETE /api/cinemas/:id — Delete a cinema
  router.delete('/:id', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: 'INVALID_ID', message: 'Cinema ID must be an integer' });
      return;
    }
    const deleted = database.deleteCinema(id);
    if (!deleted) {
      res.status(404).json({ error: 'NOT_FOUND', message: `Cinema with ID ${id} not found` });
      return;
    }
    res.status(204).send();
  });

  // GET /api/cinemas/:id/booking?groupSize=6 — Compute optimal bundle booking quote
  router.get('/:id/booking', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: 'INVALID_ID', message: 'Cinema ID must be an integer' });
      return;
    }

    const cinema = database.getCinemaById(id);
    if (!cinema) {
      res.status(404).json({ error: 'NOT_FOUND', message: `Cinema with ID ${id} not found` });
      return;
    }

    const rawGroupSize = req.query.groupSize;
    if (rawGroupSize === undefined || rawGroupSize === '') {
      res.status(400).json({
        error: 'INVALID_GROUP_SIZE',
        message: 'Query parameter groupSize is required (integer 1–10,000).',
      });
      return;
    }

    const groupSize = Number(rawGroupSize);
    if (!Number.isInteger(groupSize) || groupSize < 1 || groupSize > 10000) {
      res.status(400).json({
        error: 'INVALID_GROUP_SIZE',
        message: 'groupSize must be an integer between 1 and 10,000.',
      });
      return;
    }

    const quote = computeBookingQuote(cinema, groupSize);
    res.json(quote);
  });

  return router;
}
