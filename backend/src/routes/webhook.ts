import { Router, Request, Response } from 'express';
import { verifyWebhookSignature } from '../middleware/verifyWebhook';
import { addReviewJob, isAlreadyProcessed } from '../services/queue';
import {
  PullRequestWebhookPayload,
  InstallationWebhookPayload,
  ReviewJobData,
} from '../types';

const router = Router();

/**
 * POST /webhook
 *
 * Entry point for all GitHub webhook events.
 * Returns 200 IMMEDIATELY — async work happens after the response.
 *
 * Why: GitHub marks the delivery failed if no 2xx within 10s.
 * OpenAI reviews take 15-30s. Without async decoupling, every review
 * would show as "failed" in GitHub and get retried → duplicate reviews.
 */
router.post('/', verifyWebhookSignature, async (req: Request, res: Response) => {
  const event = req.headers['x-github-event'] as string;
  const deliveryId = req.headers['x-github-delivery'] as string;

  // ← 200 goes out here, BEFORE any async work
  res.status(200).json({ status: 'received', deliveryId });

  try {
    if (event === 'pull_request') {
      await handlePullRequest(req.body as PullRequestWebhookPayload, deliveryId);
    } else if (event === 'installation') {
      await handleInstallation(req.body as InstallationWebhookPayload);
    } else if (event === 'ping') {
      console.log('[Webhook] Ping ✓ — webhook URL configured correctly');
    }
    // All other events are silently ignored
  } catch (err) {
    // Never let this throw — 200 already sent, errors here are fire-and-forget
    console.error(`[Webhook] Post-response error (${event} / ${deliveryId}):`, (err as Error).message);
  }
});

async function handlePullRequest(
  payload: PullRequestWebhookPayload,
  deliveryId: string
): Promise<void> {
  const { action, pull_request, installation, repository } = payload;

  // Only act on these three — ignore closed, edited, labeled, etc.
  const validActions: PullRequestWebhookPayload['action'][] = ['opened', 'synchronize', 'reopened'];
  if (!validActions.includes(action)) {
    console.log(`[Webhook] Ignoring PR action: ${action}`);
    return;
  }

  if (pull_request.draft) {
    console.log(`[Webhook] PR #${pull_request.number} is a draft — skipping`);
    return;
  }

  const repoFullName = repository.full_name;
  const prNumber = pull_request.number;

  console.log(`[Webhook] PR #${prNumber} ${action} in ${repoFullName}`);

  // ── Idempotency check ─────────────────────────────────────────────────────
  // GitHub retries webhooks that don't respond fast enough.
  // Using the delivery ID as a Redis key prevents the same webhook
  // from spawning two reviews. This is a key interview talking point.
  const alreadyProcessed = await isAlreadyProcessed(deliveryId);
  if (alreadyProcessed) {
    console.log(`[Webhook] Delivery ${deliveryId} already queued — skipping duplicate`);
    return;
  }

  const jobData: ReviewJobData = {
    repoFullName,
    prNumber,
    prTitle: pull_request.title,
    prAuthor: pull_request.user.login,
    installationId: installation.id,
    diffUrl: pull_request.diff_url,
    deliveryId,
    action,
  };

  await addReviewJob(jobData);
  console.log(`[Webhook] ✓ Queued review for PR #${prNumber}`);
}

async function handleInstallation(payload: InstallationWebhookPayload): Promise<void> {
  const { action, installation, repositories } = payload;
  const account = installation.account.login;

  if (action === 'created') {
    const repos = repositories?.map((r) => r.full_name).join(', ') ?? 'all repos';
    console.log(`[Webhook] App installed by @${account} on: ${repos}`);
    // TODO: store installation in MongoDB for multi-user dashboard
  } else if (action === 'deleted') {
    console.log(`[Webhook] App uninstalled by @${account}`);
    // TODO: soft-delete installation data
  }
}

export default router;