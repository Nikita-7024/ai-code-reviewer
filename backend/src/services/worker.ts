import { Job } from 'bull';
import { reviewQueue, markAsProcessed } from './queue';
import {
  getInstallationOctokit,
  getPRDiff,
  getPRDetails,
  getPRFiles,
  postReview,
} from './github';
import { reviewPullRequest } from './openai';
import { Review } from '../models/review';
import { ReviewJobData } from '../types';

export function startWorker(): void {
  console.log('[Worker] Starting queue processor...');

  reviewQueue.process(async (job: Job<ReviewJobData>) => {
    const { repoFullName, prNumber, installationId, deliveryId } = job.data;
    const [owner, repo] = repoFullName.split('/');

    try {
      console.log(`[Worker] Processing PR #${prNumber} in ${repoFullName}`);
      await job.progress(10);

      console.log(`[Worker] Getting installation octokit for ${installationId}`);
      const octokit = await getInstallationOctokit(installationId);
      await job.progress(20);

      console.log(`[Worker] Fetching PR diff, details, files...`);
      const [diff, prDetails, files] = await Promise.all([
        getPRDiff(octokit, owner, repo, prNumber),
        getPRDetails(octokit, owner, repo, prNumber),
        getPRFiles(octokit, owner, repo, prNumber),
      ]);
      await job.progress(40);

      console.log(`[Worker] Diff length: ${diff?.length ?? 0}`);

      if (!diff || diff.length < 10) {
        console.log(`[Worker] PR #${prNumber} has no meaningful diff — skipping`);
        return { skipped: true };
      }

      console.log(`[Worker] Calling OpenAI for review...`);
      const aiReview = await reviewPullRequest(diff, files, prDetails);
      await job.progress(75);

      console.log(`[Worker] OpenAI done — Score: ${aiReview.score}, Comments: ${aiReview.comments.length}`);

      console.log(`[Worker] Posting review to GitHub...`);
      const githubReviewId = await postReview(octokit, owner, repo, prNumber, aiReview);
      await job.progress(88);

      console.log(`[Worker] Saving to MongoDB...`);
      const review = new Review({
        repoFullName, owner, repo, prNumber,
        prTitle: prDetails.title,
        prAuthor: prDetails.author,
        prAuthorAvatar: prDetails.authorAvatar,
        prUrl: prDetails.htmlUrl,
        headBranch: prDetails.headBranch,
        baseBranch: prDetails.baseBranch,
        additions: prDetails.additions,
        deletions: prDetails.deletions,
        changedFiles: prDetails.changedFiles,
        score: aiReview.score,
        summary: aiReview.summary,
        positives: aiReview.positives,
        comments: aiReview.comments,
        processingMs: aiReview.processingMs,
        aiModel: aiReview.aiModel,
        tokensUsed: aiReview.tokensUsed,
        githubReviewId: githubReviewId?.toString(),
        deliveryId,
        status: 'completed',
      });

      await review.save();
      await job.progress(95);
      await markAsProcessed(deliveryId);
      await job.progress(100);

      console.log(`[Worker] ✓ Review saved — Score: ${aiReview.score}/10, Comments: ${aiReview.comments.length}`);

      return {
        reviewId: String(review._id),
        score: aiReview.score,
        commentsCount: aiReview.comments.length,
      };

    } catch (err) {
      console.error(`[Worker] ERROR processing PR #${prNumber}:`, (err as Error).message);
      console.error(`[Worker] Stack:`, (err as Error).stack);
      throw err; // rethrow so Bull marks it failed and retries
    }
  });

  reviewQueue.on('failed', async (job: Job<ReviewJobData>, err: Error) => {
    console.error(`[Queue] Job failed (attempt ${job.attemptsMade}/${job.opts.attempts}): ${err.message}`);
    if (job.attemptsMade >= (job.opts.attempts ?? 3)) {
      console.error(`[Worker] Permanently failed — saving error state to MongoDB`);
      try {
        await Review.findOneAndUpdate(
          { repoFullName: job.data.repoFullName, prNumber: job.data.prNumber, deliveryId: job.data.deliveryId },
          { status: 'failed', errorMessage: err.message },
          { upsert: true, new: true }
        );
      } catch (dbErr) {
        console.error('[Worker] Failed to save error state:', (dbErr as Error).message);
      }
    }
  });

  reviewQueue.on('active', (job: Job<ReviewJobData>) => {
    console.log(`[Queue] Job ${job.id} started — PR #${job.data.prNumber}`);
  });

  console.log('[Worker] Ready — listening for jobs');
}