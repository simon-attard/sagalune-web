# Sagalune — Landing Page

Pre-launch waitlist page for [sagalune.com](https://sagalune.com).

**Stack:** static HTML + CSS + inline JS, with a single Vercel serverless function that writes waitlist signups to Supabase. No framework, no build step.

---

## Architecture

```
  Browser (index.html, styles.css)
      │
      │  POST /api/waitlist { email }
      ▼
  Vercel Serverless Function (api/waitlist.js)
      │  validates email, attaches source + user-agent + referrer
      │
      │  POST /rest/v1/waitlist  (service_role key, server-side only)
      ▼
  Supabase (public.waitlist table, RLS enabled, no policies)
```

The Supabase service-role key never leaves Vercel's environment. The browser only sees `/api/waitlist`. RLS is enabled with no policies — the table is locked to everyone except the service role.

---

## Files

| File | Purpose |
|---|---|
| `index.html` | The landing page |
| `styles.css` | All visual styling |
| `favicon.svg` | Brand mark placeholder |
| `api/waitlist.js` | Vercel serverless function — POSTs to Supabase |
| `supabase-setup.sql` | Run in Supabase SQL editor to create the table |
| `package.json` | Pins Node.js version for Vercel |
| `vercel.json` | Security headers + cache-control |
| `.env.example` | Documents the required env vars |
| `robots.txt`, `sitemap.xml` | SEO basics |

---

## Deploy — step by step

### 1. Set up Supabase (5 min)

1. Create a Supabase project (or reuse the one you already have)
2. Go to **SQL Editor → New Query**
3. Paste the contents of `supabase-setup.sql` and click **Run**
4. Go to **Settings → API** and copy two values:
   - **Project URL** — e.g. `https://xxx.supabase.co`
   - **service_role key** — the long `eyJ...` secret. This is admin-level; never put it in the browser or commit it.

### 2. Push to GitHub (5 min)

```bash
cd /Users/simon101ways/AI/Work/Marketing/sagalune-web
git init
git add .
git commit -m "feat: Sagalune waitlist landing page"
gh repo create sagalune-web --public --source=. --remote=origin --push
```

(Or use the GitHub UI — create `simon-attard/sagalune-web`, then `git remote add origin …` and push.)

### 3. Deploy to Vercel (5 min)

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import the `sagalune-web` repo
3. Framework preset: **Other** (Vercel auto-detects the static site and the `api/` function)
4. Before clicking Deploy, add environment variables:
   - `SUPABASE_URL` = your project URL
   - `SUPABASE_SERVICE_ROLE_KEY` = your service_role key
5. Click **Deploy**

In ~60 seconds you'll have a live URL like `https://sagalune-web.vercel.app`.

### 4. Point sagalune.com at Vercel (10 min + DNS propagation)

In Vercel:
1. Project → Settings → Domains → add `sagalune.com`
2. Vercel will show you DNS records to add

In GoDaddy:
1. My Products → DNS → sagalune.com
2. Add these records (Vercel will confirm the exact values):

| Type | Name | Value |
|---|---|---|
| `A` | `@` | `76.76.21.21` |
| `CNAME` | `www` | `cname.vercel-dns.com` |

3. Save. DNS propagation is usually 5–30 minutes. Vercel will auto-issue a TLS certificate once it sees the domain resolving.

### 5. Test

- Visit `https://sagalune.com`
- Submit a test email
- Check Supabase → Table Editor → `waitlist` — you should see the row

Done.

---

## Local preview

```bash
# Install Vercel CLI (once)
npm install -g vercel

# Link to your Vercel project and pull env vars
vercel link
vercel env pull .env.local

# Run the dev server with the serverless function live
vercel dev

# Visit http://localhost:3000
```

Without the CLI, you can still preview the static page without the form working:

```bash
python3 -m http.server 4000
# or
npx serve .
```

---

## Things to do before going public

- [ ] Run `supabase-setup.sql` in Supabase
- [ ] Deploy to Vercel with env vars set
- [ ] Point sagalune.com DNS at Vercel (GoDaddy)
- [ ] Verify TLS certificate is active
- [ ] End-to-end test: submit email → row appears in Supabase
- [ ] Write real `/privacy` and `/terms` pages (required under UK GDPR). Templates from Termly or GetTerms are fine for v1.
- [ ] Generate the Open Graph image (`og-image.png`, 1200×630, wordmark + tagline on Forest Green). Drop at repo root.
- [ ] Replace `favicon.svg` with the final logo when designer delivers
- [ ] Consider: add a welcome email via Resend or Loops (triggered by a Supabase database webhook or Edge Function)
- [ ] Add analytics — Plausible, Fathom, or Vercel Web Analytics (one-line snippet)

---

## Things that are placeholder / design-time

From the design handoff these are decorative numbers. Decide before launch:

1. **Seeded counts** — `1,247 drivers`, `153 slots left`, `347 / 500 claimed`, `69.4%` progress bar are static. Either:
   - **Show real numbers** — query `select count(*) from waitlist` from the serverless function at page load (adds latency); or
   - **Keep decorative** — update manually as they grow (honest above 100); or
   - **Start visibly low** — "12 on the list" is more credible than "1,247" and converts better than expected.
2. **Founding Explorer wording** — success copy says *"slot locked in"*. Technically they've only joined a waitlist — no £59.99 charged yet. Consider softening to *"slot reserved"*.
3. **Nav CTA duplication** — "Join the waitlist" in nav scrolls to the hero where the same button lives. Consider hiding the nav CTA while the hero is in view.

---

## Spam + rate limiting

The current serverless function validates email format and relies on the Supabase unique constraint to dedupe. For public launch consider:

- **Cloudflare Turnstile** (free, invisible CAPTCHA) — add a challenge token to the form and verify it in `api/waitlist.js`
- **Vercel KV / Upstash Redis** — rate-limit by IP (e.g. max 5 submissions per hour)
- **Disposable-email blocklist** — reject `@mailinator.com` etc. (npm: `disposable-email-domains`)

Wire in whichever feels proportionate. At low volumes none of these are urgent; a bot wasting your Supabase row allowance is not a real threat until the list matters.

---

## Welcome email (recommended next step)

Right now signup → silence. Add a welcome email so users know their spot is real:

**Option A: Supabase Database Webhook → Resend**
- Supabase → Database → Webhooks → create webhook on `waitlist` INSERT
- Point at a Vercel function (`api/welcome-email.js`) that calls Resend

**Option B: Trigger from `api/waitlist.js` directly**
- After the Supabase insert succeeds, call Resend in the same function
- Simplest; only downside is it ties email delivery to the signup request

Resend's free tier: 3,000 emails/month. Enough for years of waitlist growth.

---

## Rolling back

If you need to swap Supabase for something else later (Loops, Mailchimp, etc.), you only change `api/waitlist.js`. The page and database stay put. You can even export Supabase as CSV at any point (`\copy waitlist to '/tmp/waitlist.csv' csv header`) and import to any email service.

---

*Implementation follows the Claude Design handoff. Defaults from the design: `hero-fullbleed · form-inline · bg-all-cream · motion-on · hero-scene`.*
