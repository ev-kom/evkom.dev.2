// Integration tests: real HTTP against the production server (`node server.js`).
// Run with `npm test`. Tests marked "(network)" need internet access, because
// Cloudflare's dummy Turnstile secret still calls siteverify.
//
// Tokens come from a real dummy captcha solve (`getToken`), or from `mintToken`,
// which signs a session token with the test SESSION_SECRET_KEY (.env.test) to
// choose any session start.
//
// Session token format (see backend/captcha.js): an HS256 JWT signed with
// SESSION_SECRET_KEY (UTF-8 bytes) and the claims
//   iat (seconds), exp = iat + 10 min, aud = 'guestbook',
//   sst = session start in ms (custom claim).
// `mintToken` also adds a random jti, which the server neither sets nor checks.
// Valid while the token is under 10 minutes old (now < exp) and the session
// is under 30 minutes old (now - sst < 30 min).

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { parseEnv } from 'node:util';

import { decodeJwt, SignJWT } from 'jose';

const ROOT = join(import.meta.dirname, '..');
const SERVER = join(ROOT, 'server.js');
const ENV_FILE = join(ROOT, '.env.test');
const TEST_ENV = parseEnv(readFileSync(ENV_FILE, 'utf8'));
const SESSION_SECRET = TEST_ENV.SESSION_SECRET_KEY;

const MIN = 60 * 1000;
const WRITE_ABORTED = 'WRITE OPERATION ABORTED';

async function freePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

/**
 * Starts the production server with an explicit env (no inherited secrets).
 * @param {{envFile?: boolean, env?: object, cwd?: string}} [opts]
 */
async function startServer({ envFile = true, env = {}, cwd = ROOT } = {}) {
  const port = await freePort();
  const args = envFile ? [`--env-file=${ENV_FILE}`, SERVER] : [SERVER];
  const child = spawn(process.execPath, args, {
    cwd,
    env: { PATH: process.env.PATH, PORT: String(port), ...env },
    stdio: 'ignore',
  });
  const base = `http://127.0.0.1:${port}`;

  // Production mode silences console.log, so poll until the port answers.
  for (let i = 0; i < 100; i++) {
    try {
      await fetch(`${base}/robots.txt`, { redirect: 'manual' });
      return { base, stop: () => child.kill() };
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  child.kill();
  throw new Error('server did not start');
}

async function mintToken({
  sessionStart,
  issuedAt = Date.now(),
  alg = 'HS256',
  secret = SESSION_SECRET,
  audience = 'guestbook',
}) {
  const iat = Math.floor(issuedAt / 1000);
  return new SignJWT({ sst: sessionStart })
    .setProtectedHeader({ alg })
    .setAudience(audience)
    .setJti(randomUUID())
    .setIssuedAt(iat)
    .setExpirationTime(iat + 10 * 60)
    .sign(new TextEncoder().encode(secret));
}

const postJson = (base, path, body, headers = {}) =>
  fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

const postPage = (base, body, headers = {}) =>
  postJson(base, '/guestbook.html', body, headers);

// Matches the form field only; the page's inline JS also mentions the name.
const TOKEN_INPUT = /<input[^>]*name="sessionToken"/;
const tokenFrom = (html) =>
  html.match(/name="sessionToken" value="([^"]+)"/)?.[1];

/** network: solves the gate with Cloudflare's always-pass dummy secret. */
async function getToken(base) {
  const res = await postPage(base, { 'cf-turnstile-response': 'dummy' });
  const token = tokenFrom(await res.text());
  assert.ok(token, 'expected a session token from the dummy Turnstile solve');
  return token;
}

const validPost = (token, extra = {}) => ({
  name: 'tester',
  message: 'hello',
  sessionToken: token,
  ...extra,
});

describe('evkom.dev integration', () => {
  let main;

  before(async () => {
    execFileSync('npm', ['run', 'build'], {
      cwd: ROOT,
      env: { PATH: process.env.PATH, HOME: process.env.HOME },
      stdio: 'ignore',
    });
    main = await startServer();
  });

  after(() => main?.stop());

  describe('happy path', () => {
    test('every page returns 200 and / leads to the index', async () => {
      const root = await fetch(`${main.base}/`, { redirect: 'manual' });
      assert.equal(root.status, 302);
      assert.equal(root.headers.get('location'), '/index.html');

      for (const page of ['index', 'cv', 'manifest', 'guestbook']) {
        const res = await fetch(`${main.base}/${page}.html`);
        assert.equal(res.status, 200, page);
        assert.match(res.headers.get('content-type'), /text\/html/);
      }
    });

    test('guestbook shows the captcha gate, not the form, without a token', async () => {
      const html = await (await fetch(`${main.base}/guestbook.html`)).text();
      assert.match(html, /widget-wrapper/);
      assert.doesNotMatch(html, TOKEN_INPUT);
    });

    test('(network) solving the captcha renders the form with a session token', async () => {
      const res = await postPage(main.base, {
        'cf-turnstile-response': 'dummy',
      });
      const html = await res.text();
      assert.equal(res.status, 200);
      assert.match(html, /id="sign-form"/);
      assert.ok(tokenFrom(html));
    });

    test('(network) a valid API post passes validation (500 only because Sheets is not configured)', async () => {
      const token = await getToken(main.base);
      const res = await postJson(main.base, '/api/guestbook', validPost(token));
      assert.equal(res.status, 500);
      assert.match((await res.json()).error, new RegExp(WRITE_ABORTED));
    });
  });

  describe('errors', () => {
    test('unknown path returns a real 404, not a redirect to a 200 page', async () => {
      const res = await fetch(`${main.base}/nope`, { redirect: 'manual' });
      assert.equal(res.status, 404);
      assert.match(await res.text(), /404/);
    });

    test('the 404 page works at any depth and sets the base to the root', async () => {
      const res = await fetch(`${main.base}/a/b/c/nope`, {
        redirect: 'manual',
      });
      assert.equal(res.status, 404);
      assert.match(await res.text(), /<base href="\/">/);
    });

    test('build partials and nested paths are not served', async () => {
      for (const path of [
        '/guestbook/content.html',
        '/shared/header.html',
        '/page/index.html',
        '/a/b/cv.html',
      ]) {
        const res = await fetch(main.base + path, { redirect: 'manual' });
        assert.equal(res.status, 404, path);
      }
    });

    test('(network) bad input types and sizes give 400, not 500', async () => {
      const token = await getToken(main.base);
      const cases = {
        'array name': validPost(token, { name: ['x'.repeat(5000)] }),
        'name over 30': validPost(token, { name: 'n'.repeat(31) }),
        'message over 2000': validPost(token, { message: 'm'.repeat(2001) }),
        'numeric token': validPost(12345),
      };
      for (const [label, body] of Object.entries(cases)) {
        const res = await postJson(main.base, '/api/guestbook', body);
        assert.equal(res.status, 400, label);
      }

      // Bodies over the 10 kb JSON limit are refused as JSON 413.
      const big = await postJson(
        main.base,
        '/api/guestbook',
        validPost(token, { message: 'm'.repeat(20_000) })
      );
      assert.equal(big.status, 413);
      assert.ok((await big.json()).error);
    });

    test('a well-formed but forged token gives 403', async () => {
      const res = await postJson(
        main.base,
        '/api/guestbook',
        validPost('1:2:3:abcd')
      );
      assert.equal(res.status, 403);
    });

    test('tokens with alg none, HS384, another secret or another audience give 403', async () => {
      const sessionStart = Date.now();
      const now = Math.floor(sessionStart / 1000);
      const b64 = (obj) =>
        Buffer.from(JSON.stringify(obj)).toString('base64url');
      const forged = {
        'alg none': `${b64({ alg: 'none', typ: 'JWT' })}.${b64({
          iat: now,
          exp: now + 600,
          aud: 'guestbook',
          sst: sessionStart,
        })}.`,
        'HS384 with the real secret': await mintToken({
          sessionStart,
          alg: 'HS384',
        }),
        'HS256 with another secret': await mintToken({
          sessionStart,
          secret: 'a-different-session-secret-0123456789',
        }),
        'HS256 with aud other': await mintToken({
          sessionStart,
          audience: 'other',
        }),
      };
      for (const [label, token] of Object.entries(forged)) {
        const res = await postJson(
          main.base,
          '/api/guestbook',
          validPost(token)
        );
        assert.equal(res.status, 403, label);
      }
    });
  });

  describe('session lifetime', () => {
    test('a 29-minute-old session is accepted, a 31-minute-old one is rejected', async () => {
      const young = await mintToken({ sessionStart: Date.now() - 29 * MIN });
      const ok = await postJson(main.base, '/api/guestbook', validPost(young));
      assert.equal(ok.status, 500, 'accepted: reaches the Sheets write');

      const old = await mintToken({ sessionStart: Date.now() - 31 * MIN });
      const denied = await postJson(
        main.base,
        '/api/guestbook',
        validPost(old)
      );
      assert.equal(denied.status, 403);
    });

    test('a token older than 10 minutes is rejected even in a young session', async () => {
      const sessionStart = Date.now() - 15 * MIN;
      const fresh = await mintToken({
        sessionStart,
        issuedAt: Date.now() - 9 * MIN,
      });
      const ok = await postJson(main.base, '/api/guestbook', validPost(fresh));
      assert.equal(
        ok.status,
        500,
        'a 9-minute-old token reaches the Sheets write'
      );

      const stale = await mintToken({
        sessionStart,
        issuedAt: Date.now() - 11 * MIN,
      });
      const denied = await postJson(
        main.base,
        '/api/guestbook',
        validPost(stale)
      );
      assert.equal(denied.status, 403);
    });

    test('renewing a token keeps the original session start', async () => {
      const sessionStart = Date.now() - 29 * MIN;
      const old = await mintToken({
        sessionStart,
        issuedAt: Date.now() - 9 * MIN,
      });
      const res = await postPage(main.base, { sessionToken: old });
      const renewed = tokenFrom(await res.text());
      assert.ok(renewed, 'a valid token renews');
      assert.equal(decodeJwt(renewed).sst, sessionStart);
    });
  });

  describe('edge cases', () => {
    test('a duplicated sessionToken query param does not crash the page', async () => {
      const res = await fetch(
        `${main.base}/guestbook.html?sessionToken=a&sessionToken=b`,
        { redirect: 'manual' }
      );
      assert.equal(res.status, 200);
    });

    test('a captcha token in the query string of a GET is ignored', async () => {
      const res = await fetch(
        `${main.base}/guestbook.html?cf-turnstile-response=dummy`
      );
      const html = await res.text();
      assert.equal(res.status, 200);
      assert.match(html, /widget-wrapper/);
      assert.doesNotMatch(html, TOKEN_INPUT);
    });

    test('basic security headers are set and X-Powered-By is gone', async () => {
      const res = await fetch(`${main.base}/index.html`);
      assert.equal(res.headers.get('x-powered-by'), null);
      assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(res.headers.get('x-frame-options'), 'DENY');
      assert.match(
        res.headers.get('content-security-policy') ?? '',
        /frame-ancestors 'none'/
      );
      assert.equal(res.headers.get('referrer-policy'), 'no-referrer');
    });

    test('page POSTs with an oversized or malformed JSON body keep their 4xx status', async () => {
      const cases = {
        'over 10 kb': {
          body: JSON.stringify({ message: 'm'.repeat(20_000) }),
          status: 413,
        },
        'malformed JSON': { body: '{bad', status: 400 },
      };
      for (const [label, { body, status }] of Object.entries(cases)) {
        const res = await fetch(`${main.base}/guestbook.html`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          redirect: 'manual',
        });
        assert.equal(res.status, status, label);
      }
    });

    test('trailing slashes are 404, not pages; the bare path is 200', async () => {
      for (const path of ['/cv/', '/guestbook/', '/guestbook.html/']) {
        const res = await fetch(main.base + path, { redirect: 'manual' });
        assert.equal(res.status, 404, path);
      }
      const cv = await fetch(`${main.base}/cv`, { redirect: 'manual' });
      assert.equal(cv.status, 200);
    });
  });

  describe('separate server instances', () => {
    test('the server works when started from another directory', async () => {
      const srv = await startServer({ cwd: tmpdir() });
      try {
        const res = await fetch(`${srv.base}/index.html`);
        assert.equal(res.status, 200);
        assert.doesNotMatch(await res.text(), /Recursive/);
      } finally {
        srv.stop();
      }
    });

    test('without a Turnstile secret the captcha fails closed', async () => {
      const srv = await startServer({
        envFile: false,
        env: { SESSION_SECRET_KEY: SESSION_SECRET },
      });
      try {
        const res = await postPage(srv.base, {
          'cf-turnstile-response': 'anything',
        });
        const html = await res.text();
        assert.doesNotMatch(html, TOKEN_INPUT);
        assert.match(html, /error-dialog/);
      } finally {
        srv.stop();
      }
    });

    test('rate limits return JSON 429 and are per client IP', async () => {
      const srv = await startServer();
      try {
        const ipA = { 'do-connecting-ip': '203.0.113.10' };
        const ipB = { 'do-connecting-ip': '203.0.113.20' };

        // POST page route (no token, so no outbound Turnstile call).
        let limited;
        for (let i = 0; i < 70 && !limited; i++) {
          const res = await postPage(srv.base, {}, ipA);
          if (res.status === 429) limited = res;
        }
        assert.ok(limited, 'POST /guestbook.html is rate limited');
        assert.match(limited.headers.get('content-type'), /application\/json/);
        assert.ok(await limited.json());

        // Another client IP is not affected by A's limit.
        const other = await postPage(srv.base, {}, ipB);
        assert.equal(other.status, 200);

        // API route.
        let apiLimited;
        for (let i = 0; i < 70 && !apiLimited; i++) {
          const res = await postJson(
            srv.base,
            '/api/guestbook',
            validPost('x'),
            ipA
          );
          if (res.status === 429) apiLimited = res;
        }
        assert.ok(apiLimited, '/api/guestbook is rate limited');
        assert.match(
          apiLimited.headers.get('content-type'),
          /application\/json/
        );
      } finally {
        srv.stop();
      }
    });

    test('a junk do-connecting-ip is not its own bucket', async () => {
      const srv = await startServer();
      try {
        let limited;
        for (let i = 0; i < 70 && !limited; i++) {
          const res = await postPage(
            srv.base,
            {},
            { 'do-connecting-ip': `junk-${i}` }
          );
          if (res.status === 429) limited = res;
        }
        assert.ok(limited, 'different junk values share one bucket');
      } finally {
        srv.stop();
      }
    });

    test('31 IPv6 addresses in one /56 share one bucket', async () => {
      const srv = await startServer();
      try {
        const statuses = [];
        for (let i = 1; i <= 31; i++) {
          const res = await postPage(
            srv.base,
            {},
            { 'do-connecting-ip': `2001:db8::${i}` }
          );
          statuses.push(res.status);
        }
        assert.ok(
          statuses.includes(429),
          `expected a 429 by request 31, got ${statuses.join(',')}`
        );
      } finally {
        srv.stop();
      }
    });

    test('POSTs to a path that only starts with /api are limited like other page POSTs', async () => {
      const srv = await startServer();
      try {
        // /apiary is not under /api/, so it counts against the page-POST limit (30).
        const statuses = [];
        for (let i = 0; i < 40 && !statuses.includes(429); i++) {
          const res = await postJson(srv.base, '/apiary', {});
          statuses.push(res.status);
        }
        assert.ok(
          statuses.includes(429) && statuses.length <= 31,
          `expected a 429 by request 31, got ${statuses.join(',')}`
        );
      } finally {
        srv.stop();
      }
    });
  });
});
