# Deploying ZEX (Vercel + Render + Supabase)

This app has 3 services: a React frontend, an Express + WebSocket backend, and a Postgres database.

## 1. Supabase (database)

1. Create a project at https://supabase.com (Free tier).
2. In **Project Settings → Database**, copy the **Connection string** under "Connection pooling" (use the **Transaction** mode, port `6543`). It looks like:
   ```
   postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
   ```
3. In **SQL Editor → New query**, paste the contents of `supabase_schema.sql` from this repo and click **Run**.

## 2. Render (backend)

1. Push this repo to GitHub (already done).
2. At https://render.com → **New → Web Service** → connect the GitHub repo.
3. Render will pick up `render.yaml`. Confirm:
   - Root directory: `server`
   - Build command: `npm install --prefix .. --omit=dev`
   - Start command: `node index.js`
   - Health check path: `/health`
4. Set the following environment variables (Dashboard → your service → Environment):
   - `DATABASE_URL` — the Supabase connection string from step 1
   - `STRIPE_SECRET_KEY` — your `sk_test_...` (or `sk_live_...`) key
   - `STRIPE_WEBHOOK_SECRET` — optional, only if you set up the webhook below
   - `CRYPTOCOMPARE_API_KEY` — optional
   - `ALLOWED_ORIGINS` — your Vercel URL once you have it, e.g. `https://zex.vercel.app`
5. Deploy. After it goes live, note the URL (e.g. `https://zex-backend.onrender.com`).

> **Note:** Render's free plan sleeps after 15 min of inactivity. The first request after a sleep will be slow (~30s). Upgrade to the $7/mo Starter plan to keep it warm.

## 3. Vercel (frontend)

1. At https://vercel.com → **Add New → Project** → import the GitHub repo.
2. Vercel will pick up `vercel.json`. Confirm:
   - Build command: `npm install && cd client && npm install && npm run build`
   - Output directory: `client/dist`
   - Install command: leave default
3. Set these environment variables (Settings → Environment Variables):
   - `VITE_API_URL` — your Render URL from step 2 (e.g. `https://zex-backend.onrender.com`)
   - `STRIPE_PUBLISHABLE_KEY` — your `pk_test_...` (or `pk_live_...`) key
4. Deploy.
5. After it's live, copy the Vercel URL and put it in Render's `ALLOWED_ORIGINS` env var, then redeploy the Render service.

## 4. Stripe webhook (optional, recommended)

1. Stripe Dashboard → Developers → Webhooks → Add endpoint
2. Endpoint URL: `https://<your-render-url>/api/stripe/webhook`
3. Events: `payment_intent.succeeded`
4. Copy the signing secret and set it as `STRIPE_WEBHOOK_SECRET` in Render.

## Local development

Still works the same:
```bash
bash run.sh
```
The Replit Postgres `DATABASE_URL` is already set; Stripe keys come from Replit Secrets.
