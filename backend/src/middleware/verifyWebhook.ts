import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

/**
 * Verifies every incoming GitHub webhook using HMAC-SHA256.
 *
 * Interview explanation:
 * "GitHub signs each webhook with your secret using SHA-256 and puts
 *  the result in X-Hub-Signature-256. I recompute the same hash and
 *  use crypto.timingSafeEqual to compare — not a regular string compare.
 *  A regular compare short-circuits on the first mismatch, which leaks
 *  timing information an attacker can use to brute-force the secret.
 *  timingSafeEqual always takes the same amount of time regardless."
 */
export function verifyWebhookSignature(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const signature = req.headers['x-hub-signature-256'] as string | undefined;

  if (!signature) {
    res.status(401).json({ error: 'Missing X-Hub-Signature-256 header' });
    return;
  }

  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[Webhook] GITHUB_WEBHOOK_SECRET not configured');
    res.status(500).json({ error: 'Server misconfiguration' });
    return;
  }

  // req.body is a raw Buffer here (configured in app.ts before express.json)
  const rawBody = req.body as Buffer;

  const expected =
    'sha256=' +
    crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  try {
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);

    // Lengths must match before timingSafeEqual (throws if they differ)
    if (sigBuf.length !== expBuf.length) {
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    if (!crypto.timingSafeEqual(sigBuf, expBuf)) {
      console.warn('[Webhook] Signature mismatch — possible spoofed request');
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }
  } catch {
    res.status(401).json({ error: 'Signature verification failed' });
    return;
  }

  // Parse raw buffer → JSON so route handlers get req.body as object
  try {
    req.body = JSON.parse(rawBody.toString('utf8')) as unknown;
  } catch {
    res.status(400).json({ error: 'Invalid JSON payload' });
    return;
  }

  next();
}