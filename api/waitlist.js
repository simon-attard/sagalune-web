// Vercel Serverless Function — POST /api/waitlist
// Accepts { email, honeypot } and inserts into Supabase `waitlist` table.
// Hardened: CORS allowlist, honeypot, per-IP rate limit (5/hour).

import crypto from 'node:crypto';

const ALLOWED_ORIGINS = new Set([
  'https://sagalune.com',
  'https://www.sagalune.com',
  'https://sagalune-web.vercel.app'
]);

// Match any Vercel preview deploy for this project
const VERCEL_PREVIEW_PATTERNS = [
  /^https:\/\/sagalune-web-[\w-]+\.vercel\.app$/,
  /^https:\/\/sagalune-[\w-]+-simonpattard-4938s-projects\.vercel\.app$/
];

const RATE_LIMIT_WINDOW_MINUTES = 60;
const RATE_LIMIT_MAX_SIGNUPS = 5;

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  return VERCEL_PREVIEW_PATTERNS.some(re => re.test(origin));
}

function hashIp(ip, salt) {
  return crypto.createHash('sha256').update(`${salt}:${ip}`).digest('hex');
}

function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length) {
    return xff.split(',')[0].trim();
  }
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

export default async function handler(req, res) {
  const origin = req.headers.origin;

  // Set CORS header ONLY for allowed origins. If Origin header is present and
  // not allowed, we reject below. If Origin is absent (curl, server-to-server),
  // we don't enforce — honeypot and rate limiting are the backstops.
  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Block browser requests from disallowed origins
  if (origin && !isAllowedOrigin(origin)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { email, honeypot } = req.body || {};

  // Honeypot: bots fill this hidden field, humans leave it empty.
  // Silently accept the request (so the bot thinks it succeeded and moves on),
  // but don't write anything to the database.
  if (honeypot && String(honeypot).trim().length > 0) {
    return res.status(200).json({ ok: true });
  }

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email is required' });
  }

  const normalised = email.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalised)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const ipSalt = process.env.IP_SALT;

  if (!supabaseUrl || !supabaseKey || !ipSalt) {
    console.error('Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or IP_SALT');
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  const clientIp = getClientIp(req);
  const ipHash = hashIp(clientIp, ipSalt);

  try {
    // ----- Rate limit check -----
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString();
    const rateCheckUrl = `${supabaseUrl}/rest/v1/waitlist` +
      `?ip_hash=eq.${encodeURIComponent(ipHash)}` +
      `&created_at=gte.${encodeURIComponent(windowStart)}` +
      `&select=id`;

    const rateRes = await fetch(rateCheckUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'count=exact'
      }
    });

    if (rateRes.ok) {
      // Supabase returns Content-Range header with the count
      const contentRange = rateRes.headers.get('content-range') || '';
      const total = parseInt(contentRange.split('/')[1], 10);
      if (Number.isFinite(total) && total >= RATE_LIMIT_MAX_SIGNUPS) {
        return res.status(429).json({
          error: 'Too many signups from your network. Please try again in an hour.'
        });
      }
    }
    // If rate check fails, fail open — the insert itself will still succeed
    // or fail on its own, and occasional extra requests aren't critical.

    // ----- Insert -----
    const referrer = req.headers.referer || req.headers.referrer || null;
    const userAgent = req.headers['user-agent'] || null;
    let source = null;
    try {
      if (referrer) source = new URL(referrer).searchParams.get('utm_source');
    } catch {}

    const supabaseRes = await fetch(`${supabaseUrl}/rest/v1/waitlist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        email: normalised,
        source,
        referrer,
        user_agent: userAgent,
        ip_hash: ipHash
      })
    });

    // 409 = unique email constraint violation → treat as success (idempotent)
    if (supabaseRes.status === 409) {
      return res.status(200).json({ ok: true, duplicate: true });
    }

    if (!supabaseRes.ok) {
      const errorText = await supabaseRes.text();
      console.error('Supabase insert failed:', supabaseRes.status, errorText);
      return res.status(500).json({ error: 'Could not save your email' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Waitlist handler error:', err);
    return res.status(500).json({ error: 'Could not save your email' });
  }
}
