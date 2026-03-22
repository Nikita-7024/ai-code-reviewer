import Bull, { Job } from 'bull';
import Redis from 'ioredis';
import { ReviewJobData, QueueStats } from '../types';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const isTLS = REDIS_URL.startsWith('rediss://');

function createRedisClient() {
  const client = new Redis(REDIS_URL, {
    tls: isTLS ? { rejectUnauthorized: false } : undefined,
    maxRetriesPerRequest: null as unknown as number,
    enableReadyCheck: false,
    retryStrategy: (times: number) => {
      if (times > 5) return null;
      return Math.min(times * 500, 3000);
    },
  });
  client.on('error', (err) => console.error('[Redis] Error:', err.message));
  return client;
}

// Standalone client for idempotency checks
export const redis = createRedisClient();
redis.on('connect', () => console.log('[Redis] Connected'));
redis.on('ready', () => console.log('[Redis] Ready'));

// Bull queue using custom createClient for all 3 connection types
export const reviewQueue = new Bull<ReviewJobData>('pr-reviews', {
  createClient: (type) => {
    console.log(`[Queue] Creating ${type} Redis connection`);
    return createRedisClient();
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential' as const, delay: 3000 },
    removeOnComplete: 100,
    removeOnFail: 50,
    timeout: 120_000,
  },
});

reviewQueue.on('error', (err: Error) => console.error('[Queue] Error:', err.message));
reviewQueue.on('waiting', (jobId: string) => console.log(`[Queue] Job ${jobId} waiting`));
reviewQueue.on('active', (job: Job<ReviewJobData>) => console.log(`[Queue] Job ${job.id} active — PR #${job.data.prNumber}`));
reviewQueue.on('completed', (job: Job<ReviewJobData>) => console.log(`[Queue] ✓ Job ${job.id} completed`));
reviewQueue.on('failed', (job: Job<ReviewJobData>, err: Error) => console.error(`[Queue] ✗ Job ${job.id} failed: ${err.message}`));
reviewQueue.on('stalled', (job: Job<ReviewJobData>) => console.warn(`[Queue] Job ${job.id} stalled`));

export async function addReviewJob(data: ReviewJobData): Promise<Job<ReviewJobData>> {
  console.log(`[Queue] Adding job for PR #${data.prNumber}...`);
  const job = await reviewQueue.add(data, { jobId: data.deliveryId });
  console.log(`[Queue] Job ${job.id} added`);
  return job;
}

export async function isAlreadyProcessed(deliveryId: string): Promise<boolean> {
  try {
    const result = await redis.get(`delivery:${deliveryId}`);
    return result === '1';
  } catch (err) {
    console.warn('[Queue] Idempotency check failed:', (err as Error).message);
    return false;
  }
}

export async function markAsProcessed(deliveryId: string): Promise<void> {
  try {
    await redis.set(`delivery:${deliveryId}`, '1', 'EX', 86_400);
  } catch (err) {
    console.warn('[Queue] Failed to mark processed:', (err as Error).message);
  }
}

export async function getQueueStats(): Promise<QueueStats> {
  try {
    const [waiting, active, completed, failed] = await Promise.all([
      reviewQueue.getWaitingCount(),
      reviewQueue.getActiveCount(),
      reviewQueue.getCompletedCount(),
      reviewQueue.getFailedCount(),
    ]);
    return { waiting, active, completed, failed };
  } catch {
    return { waiting: 0, active: 0, completed: 0, failed: 0 };
  }
}