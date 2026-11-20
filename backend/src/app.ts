import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { AppDatabase } from './db.js';
import { createMoviesRouter } from './routes/movies.js';
import { createCinemasRouter } from './routes/cinemas.js';

export function createApp(database: AppDatabase): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Health check
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'doomsday-ready-api' });
  });

  // Reset to canonical sample data from the Blinto Assessment PDF
  app.post('/api/seed/reset', (_req: Request, res: Response) => {
    database.resetToSampleData();
    res.json({
      message: 'Database reset to canonical MCU sample movies and cinemas.',
      movies: database.getAllMovies(),
      cinemas: database.getAllCinemas(),
    });
  });

  // Core API routes required by assessment
  app.use('/api/movies', createMoviesRouter(database));
  app.use('/api/cinemas', createCinemasRouter(database));

  // Optional static frontend serving if built frontend exists
  const frontendDist = path.resolve(process.cwd(), '../frontend/dist');
  if (fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
    app.get('*', (req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith('/api')) {
        next();
        return;
      }
      res.sendFile(path.join(frontendDist, 'index.html'));
    });
  }

  // Fallback 404 for unknown /api routes
  app.use('/api/*', (req: Request, res: Response) => {
    res.status(404).json({
      error: 'NOT_FOUND',
      message: `API endpoint ${req.method} ${req.originalUrl} not found`,
    });
  });

  // Global error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An unexpected error occurred',
    });
  });

  return app;
}
