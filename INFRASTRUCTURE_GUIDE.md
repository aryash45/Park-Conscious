# Infrastructure Guide: Email Scaling & Workers

This guide explains how to transition from Vercel-native email sending to a high-scale background worker system using BullMQ.

## 1. Current Setup (Direct Mode)
By default, the platform uses a **Dual-Mode Dispatcher** in `api/lib/email.js`. 
- **How it works:** After a payment is confirmed, the API sends the email directly.
- **Limit:** Best for small to medium traffic (< 50 emails/hour).
- **Cost:** $0 (Runs entirely on Vercel/Resend free tiers).

## 2. When to Enable BullMQ (Scale Mode)
Switch to BullMQ when you experience:
- **Timeouts:** Users see a loading spinner for > 5 seconds after payment.
- **High Volume:** You are hosting events with 500+ attendees.
- **Fail-Safety:** You want emails to automatically "retry" if the email provider (Resend) is down.

## 3. How to Activate Scale Mode

### Step A: Configuration
Set the following environment variable in your Vercel Dashboard and local `.env`:
```bash
USE_QUEUE=true
```

### Step B: Host the Worker
Vercel cannot run the worker 24/7. You need a separate Node.js process.
1. **Option 1 (Railway/DigitalOcean):** Deploy the repo and run `node api/lib/worker.js`.
2. **Option 2 (Local Server):** If you have a dedicated machine, run `npm run worker`.

### Step C: Monitor
Once active, you can monitor your queue via the Redis dashboard (Upstash). If a job fails, BullMQ will automatically retry it 3 times with exponential backoff.

---

## 4. Monorepo Network Bridge (Multi-Project Setup)

Because the **Events App** is deployed as a standalone project on Vercel (pointed to `apps/events`), it cannot natively see the root `/api` folder. We use a **Proxy Bridge** to solve this:

### How it works:
1. **Internal Proxy:** `apps/events/vercel.json` rewrites all `/api/*` requests to the main domain (`https://parkconscious.in/api/*`).
2. **Host Preservation:** A dedicated middleware in `apps/events/middleware.js` captures the original host (e.g., `events.parkconscious.in`) and passes it to the backend via the `x-public-host` header.
3. **Identity Mapping:** The root `vercel.json` contains explicit "Identity Rewrites" to ensure specific handlers like `sitemap.js` and `render-event.js` aren't swallowed by the global API catch-all.

**Troubleshooting:** If the events site shows a 404 for API requests, ensure the `apps/events/vercel.json` file exists and is pointing to the correct main production domain.
