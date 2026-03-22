import { Router, Request, Response } from 'express';
import { Review } from '../models/review';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const repos = await Review.aggregate([
      { $match: { status: 'completed' } },
      {
        $group: {
          _id: '$repoFullName',
          owner: { $first: '$owner' },
          repo: { $first: '$repo' },
          totalReviews: { $sum: 1 },
          avgScore: { $avg: '$score' },
          lastReviewAt: { $max: '$createdAt' },
        },
      },
      { $sort: { lastReviewAt: -1 } },
    ]);

    res.json(
      repos.map((r) => ({
        repoFullName: r._id,
        owner: r.owner,
        repo: r.repo,
        totalReviews: r.totalReviews,
        avgScore: Math.round((r.avgScore as number) * 10) / 10,
        lastReviewAt: r.lastReviewAt,
      }))
    );
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;