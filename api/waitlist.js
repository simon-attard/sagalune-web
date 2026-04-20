// Vercel Serverless Function — POST /api/waitlist
// Accepts { email } and inserts into Supabase `waitlist` table.

export default async function handler(req, res) {
  // CORS — same-origin in practice, but explicit for clarity
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body || {};

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email is required' });
  }

  const normalised = email.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalised)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  try {
    const referrer = req.headers.referer || req.headers.referrer || null;
    const userAgent = req.headers['user-agent'] || null;
    const source = new URL(referrer || 'https://sagalune.com/').searchParams.get('utm_source') || null;

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
        user_agent: userAgent
      })
    });

    // 409 = unique constraint violation (email already on the list)
    // Treat as success so repeat signups don't error out
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
