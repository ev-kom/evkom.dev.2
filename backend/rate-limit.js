import { isIP } from 'node:net';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';

/**
 * Client key comes only from the `do-connecting-ip` header (set by DigitalOcean's
 * ingress): its first value when it holds a valid IP, else the socket IP.
 * `trust proxy` stays off, so `req.ip` alone would be the proxy for everyone;
 * an invalid header must not become its own bucket. `ipKeyGenerator` groups IPv6
 * by /56 and maps `::ffff:a.b.c.d` to `a.b.c.d`, so a client cannot rotate
 * addresses or spellings past the limit.
 */
function clientKey(req) {
  const forwarded = req.headers['do-connecting-ip']?.split(',')[0].trim();
  return ipKeyGenerator(isIP(forwarded) ? forwarded : (req.ip ?? ''));
}

const WINDOW_MS = 15 * 60 * 1000;

/**
 * Creates a per-client rate limiter with its own store.
 * Over the limit it answers JSON 429 and, for the first rejected request of a
 * key per window, logs the key and the raw IP headers (console.warn survives
 * the production console.log mute), so the key can be checked in the runtime
 * logs after a deploy.
 *
 * @param {{ limit: number, skip?: (req, res) => boolean }} opts
 */
export function createLimiter({ limit, skip }) {
  return rateLimit({
    windowMs: WINDOW_MS,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: clientKey,
    skip,
    handler: (req, res) => {
      if (req.rateLimit.used === req.rateLimit.limit + 1) {
        console.warn(
          `Rate limit: key=${req.rateLimit.key} do-connecting-ip=${req.headers['do-connecting-ip']} x-forwarded-for=${req.headers['x-forwarded-for']} cf-connecting-ip=${req.headers['cf-connecting-ip']} req.ip=${req.ip}`
        );
      }
      res.status(429).json({ error: 'TOO MANY REQUESTS. TRY AGAIN LATER.' });
    },
  });
}
