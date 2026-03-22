import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';

import webhookRouter from './routes/webhook';
import reviewsRouter from './routes/reviews';
import reposRouter from './routes/repos';
import { startWorker } from './services/worker';

const app = express();

app.use('/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(cors({
  origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  credentials: true,
}));

app.get('/health', (_req: any, res: any) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), uptime: Math.floor(process.uptime()) });
});

app.use('/webhook', webhookRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/repos', reposRouter);

app.use((err: any, _req: any, res: any, _next: any) => {
  console.error('[Error]', err.message);
  res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
});

async function bootstrap(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGODB_URI is not set');

  await mongoose.connect(mongoUri);
  console.log('[MongoDB] Connected');

  startWorker();

  const port = parseInt(process.env.PORT ?? '3001', 10);
  app.listen(port, '0.0.0.0', () => {
    console.log(`[Server] http://localhost:${port} (${process.env.NODE_ENV})`);
    console.log(`[Server] Also try: http://127.0.0.1:${port}`);
  });
}

bootstrap().catch((err: Error) => {
  console.error('[Bootstrap] Fatal:', err.message);
  process.exit(1);
});

export default app;