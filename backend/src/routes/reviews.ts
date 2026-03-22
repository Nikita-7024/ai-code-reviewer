import { Router, Request, Response } from 'express';
import { Review } from '../models/review';
import { getQueueStats } from '../services/queue';

const router = Router();

/** GET /api/reviews — paginated list for dashboard */
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (req.query.repo) filter.repoFullName = req.query.repo;
    if (req.query.status) filter.status = req.query.status;

    const [reviews, total] = await Promise.all([
      Review.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-comments') // Omit full comments for list — fetched on detail page
        .lean(),
      Review.countDocuments(filter),
    ]);

    res.json({
      reviews,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** GET /api/reviews/stats — aggregated metrics for header cards */
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [aggregate, recentActivity, queue] = await Promise.all([
      Review.aggregate([
        { $match: { status: 'completed' } },
        {
          $group: {
            _id: null,
            totalReviews: { $sum: 1 },
            avgScore: { $avg: '$score' },
            totalComments: { $sum: { $size: '$comments' } },
            totalErrors: {
              $sum: {
                $size: {
                  $filter: { input: '$comments', cond: { $eq: ['$$this.severity', 'error'] } },
                },
              },
            },
          },
        },
      ]),
      Review.aggregate([
        { $match: { status: 'completed', createdAt: { $gte: sevenDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
            avgScore: { $avg: '$score' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      getQueueStats(),
    ]);

    const s = aggregate[0] ?? { totalReviews: 0, avgScore: 0, totalComments: 0, totalErrors: 0 };

    res.json({
      totalReviews: s.totalReviews,
      avgScore: s.avgScore ? Math.round((s.avgScore as number) * 10) / 10 : 0,
      totalComments: s.totalComments,
      totalErrors: s.totalErrors,
      recentActivity,
      queue,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** GET /api/reviews/:id — full review with comments */
router.get('/:id', async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) { res.status(404).json({ error: 'Review not found' }); return; }
    res.json(review);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** GET /api/reviews/pr/:owner/:repo/:prNumber — lookup by repo + PR */
router.get('/pr/:owner/:repo/:prNumber', async (req, res) => {
  try {
    const review = await Review.findOne({
      repoFullName: `${req.params.owner}/${req.params.repo}`,
      prNumber: parseInt(req.params.prNumber as string),
    }).sort({ createdAt: -1 });

   if (!review) { res.status(404).json({ error: 'Review not found' }); return; }
    res.json(review);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;