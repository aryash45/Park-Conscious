# BACKSTAGE INCIDENT REPORT

> **Confidential — Internal / Stakeholder Distribution Only**

---

## 1. Executive Summary

| Field | Details |
|---|---|
| **Incident Title** | Backstage Platform — Full API Service Outage |
| **Date of Incident** | 14 May 2026 – 17 May 2026 |
| **Prepared By** | Piyush Kumar, Founding Engineer |
| **Incident Severity** | 🔴 Critical |
| **Total Downtime Duration** | ~60–72 Hours (approx. 3 Days) |
| **Resolution Time** | 17 May 2026, ~02:15 AM IST |

**Affected Services:**

- ❌ Events Website (`events.parkconscious.in`) — Public event feed, event detail pages
- ❌ Admin Dashboard (`admin.events.parkconscious.in`) — Organizer portal, login, ticket management
- ❌ All REST API Endpoints (`/api/events`, `/api/auth`, `/api/admin`, `/api/pay`)
- ❌ Ticket Email Dispatch System
- ✅ Database (MongoDB Atlas) — Unaffected, data fully intact
- ✅ CDN / Media Assets (Cloudinary) — Unaffected
- ✅ Payment Gateway (Razorpay) — Unaffected

---

## 2. Overview of the Incident

Between **14 May 2026 and 17 May 2026**, the Backstage platform experienced a **complete API service outage**, rendering the public events website, the admin dashboard, and all associated API endpoints fully inaccessible to users and organizers.

The outage manifested as a `FUNCTION_INVOCATION_FAILED` HTTP 500 error on every API request, meaning the platform could not load events, process logins, register attendees, or dispatch confirmation emails.

The root cause was a **routing configuration regression** introduced in a routine developer experience improvement commit. A change to `vercel.json` — the deployment configuration file that tells Vercel's infrastructure how to route incoming requests to the correct serverless functions — inadvertently stripped mandatory `.js` file extensions from all API route destinations. Vercel's production infrastructure strictly requires these extensions to locate and invoke serverless functions. Without them, every API call was silently rejected before reaching the application code.

Recovery was significantly delayed by a secondary infrastructure constraint: the project's Vercel Hobby (free) tier account reached the **hard limit of 100 deployments per day**, preventing any fixes from being deployed for an extended period even after the root cause was identified.

All user data, event records, bookings, and payment history remained **fully intact** throughout the incident. No data loss occurred.

---

## 3. Timeline of Events

| Date & Time (IST) | Event |
|---|---|
| **~14 May, Daytime** | Routine development commit strips `.js` extensions from `vercel.json` API rewrites as part of a local dev compatibility improvement |
| **~14 May, Evening** | Merged to `main`; Vercel production deployment picks up the broken configuration |
| **~14 May, Evening** | All API endpoints begin returning `FUNCTION_INVOCATION_FAILED` (HTTP 500); platform goes dark |
| **~15 May, Morning** | User-facing downtime confirmed; engineering investigation begins |
| **15 May** | Root cause (`vercel.json` routing misconfiguration) identified; first hotfix PR (`fix/vercel-production-crash`) pushed and merged |
| **15 May** | Vercel silently skips Production build due to monorepo optimization — fix fails to deploy despite successful merge |
| **15–16 May** | Multiple fix attempts via new branches; each attempt burns through Vercel's free deployment limit |
| **16 May, ~11 PM IST** | Vercel account hits **100-deployment-per-day limit** (`api-deployments-free-per-day`); all further deploys blocked for 24 hours |
| **17 May, ~01:00 AM IST** | Secondary bug discovered: `OverwriteModelError` crash in Mongoose warm serverless containers; email dispatch system also identified as Redis-dependent and failing |
| **17 May, ~01:30 AM IST** | Final consolidated fix PR (`fix/production-final-v2`, PR #124) prepared with all three fixes |
| **17 May, ~02:00 AM IST** | Deployment quota resets; PR #124 merged and deployed to Vercel production |
| **17 May, ~02:15 AM IST** | All services confirmed restored. Events page loading. Admin login functional. Email dispatch working. |

---

## 4. Impact Analysis

### User Impact

- Public attendees were **unable to browse or register for any events** during the outage window
- Organizers could **not access the Admin Dashboard** — no event management, check-in, or attendee visibility
- All ticket confirmation emails were **queued and not delivered** during the outage
- New event registrations and ticket purchases were **inaccessible** for the full 3-day window
- Users attempting to visit the platform received a generic "A server error has occurred" message with no informative feedback

### Business Impact

- Approximately **3 days of platform revenue** from ticket registrations was interrupted
- **Organizer trust** was impacted as clients were unable to access their dashboards or manage their events during active listing periods
- **Support volume** increased as organizers and attendees reported issues
- Potential **SEO impact** from extended downtime on the primary events domain

### Technical Impact

- All 10+ API routes returned HTTP 500 with `FUNCTION_INVOCATION_FAILED` error
- Vercel serverless function cold-start recovery was blocked by the 100-deployment daily limit
- Upstash Redis quota exhaustion (a separate ongoing constraint) further complicated the email delivery system during the recovery phase
- Significant engineering time (~3 days) spent on diagnosis, fix attempts, and deployment coordination

---

## 5. Root Cause Analysis (RCA)

### Primary Root Cause

A commit (`552dcd2`) introduced to improve local development compatibility using `vercel dev` changed the routing destinations in `vercel.json` from:

```json
{ "source": "/api/events/:path*", "destination": "/api/events.js" }
```

to:

```json
{ "source": "/api/events/:path*", "destination": "/api/events" }
```

This change removes the `.js` file extension from all 20 API route destinations. While this is compatible with `vercel dev` (the local emulation tool), **Vercel's production serverless runtime strictly requires exact file paths including extensions** to locate and mount function handlers. Without the `.js` extension, Vercel cannot find the function file and immediately returns a 500 error before any application code executes.

### Secondary Root Cause — Deployment Amplification

After the initial fix was identified and pushed (restoring `.js` extensions), **Vercel's monorepo build optimization system** silently skipped the production deployment. Vercel determined that changes to `vercel.json` at the repository root did not affect any specific sub-project (`apps/events`, `apps/admin`) and skipped rebuilding them. This meant the fix was merged to `main` on GitHub but **was never actually deployed to production**, extending the outage unexpectedly.

### Tertiary Root Cause — Deployment Quota Exhaustion

The repeated cycle of pushing fix attempts, verifying builds, and investigating Vercel behavior caused the project's Vercel Hobby account to exceed **100 deployments in a single day**. Vercel enforces this as a hard billing limit (`api-deployments-free-per-day`), which blocked all further deployments — including the correct fix — for 24 hours.

### Contributing Factors

| Factor | Description |
|---|---|
| **No staging environment** | All fixes were tested in production, contributing to rapid deployment count escalation |
| **Monorepo build skipping** | Vercel's build optimization is opaque — no clear warning is shown when a deployment is silently skipped |
| **Shared routing config** | A single `vercel.json` controls all three sub-projects; a single misconfiguration takes down everything simultaneously |
| **Redis quota exhaustion** | Upstash free tier quota for BullMQ was exhausted, causing the email system to fail independently during recovery |
| **Free tier constraints** | The 100-deployment/day Vercel limit severely restricted recovery speed |
| **Missing deployment verification** | No automated health check ran post-deployment to confirm API routes were reachable |

---

## 6. Systems Affected

| System | Status During Outage | Impact Level |
|---|---|---|
| Events Website (`events.parkconscious.in`) | ❌ Down | Critical |
| Admin Dashboard (`admin.events.parkconscious.in`) | ❌ Down | Critical |
| Events API (`/api/events`) | ❌ Down | Critical |
| Auth API (`/api/auth`) | ❌ Down | Critical |
| Admin API (`/api/admin`) | ❌ Down | Critical |
| Payment API (`/api/pay`) | ❌ Down | Critical |
| Ticket Email Dispatch | ❌ Blocked (Redis quota) | High |
| MongoDB Atlas Database | ✅ Fully Operational | None |
| Cloudinary Media CDN | ✅ Fully Operational | None |
| Razorpay Payment Gateway | ✅ Fully Operational | None |

---

## 7. Immediate Actions Taken

1. **Identified** the `FUNCTION_INVOCATION_FAILED` error pattern across all API routes within hours of downtime confirmation
2. **Audited** recent commits and identified the `vercel.json` routing regression in commit `552dcd2`
3. **Restored** `.js` file extensions across all 20 API route destinations in `vercel.json`
4. **Identified** and fixed a secondary `OverwriteModelError` bug in Mongoose model initialization that would have caused instability in Vercel warm containers even after the routing fix
5. **Removed** the BullMQ/Redis dependency from the admin email-batch endpoint, replacing it with direct multi-provider email dispatch to eliminate Redis quota as a point of failure
6. **Created** the final consolidated fix PR (`fix/production-final-v2`, PR #124) containing all three patches
7. **Coordinated** merge timing to align with Vercel deployment quota reset to ensure successful production deployment

---

## 8. Resolution Details

Full service restoration was achieved by merging **PR #124** (`fix/production-final-v2`) to `main` on **17 May 2026 at approximately 02:00 AM IST**.

The PR contained three targeted fixes:

**Fix 1 — `vercel.json` Routing Restoration**
Restored `.js` file extensions to all 20 API route destinations, ensuring Vercel's production runtime can correctly locate and invoke each serverless function.

**Fix 2 — Mongoose Model Caching (`api/events.js`)**
Replaced runtime `mongoose.connection.model()` calls with references to pre-compiled, cached model exports. This prevents `OverwriteModelError` crashes that would have occurred on subsequent invocations in Vercel warm containers — a bug that would have caused intermittent 500 errors even after the routing fix.

**Fix 3 — Direct Email Dispatch (`api/admin/bookings.js`)**
Removed the BullMQ/Redis queue dependency from the ticket email endpoint. Email sending now calls `processTicketEmail()` directly, using a multi-provider fallback chain (Resend → MSG91 → SMTP). This makes email dispatch resilient to Redis quota exhaustion.

Following deployment, a manual health check confirmed:
- `GET /api/health` → `200 OK`, `status: "ONLINE"`, `database.connected: true`
- Admin login flow → Functional
- Public events feed → Loading correctly
- Ticket email dispatch → Operational

---

## 9. Preventive Measures & Future Improvements

### Infrastructure Improvements

- [ ] **Upgrade to Vercel Pro** — Remove the 100-deployment/day hard limit that critically delayed recovery; enable preview deployments without SSO authentication walls
- [ ] **Create a dedicated staging environment** — All configuration changes must be validated in staging before touching production
- [ ] **Implement Infrastructure as Code validation** — Add a CI step that validates `vercel.json` schema and verifies all `destination` paths have `.js` extensions and exist in the `api/` directory
- [ ] **Separate Redis from critical email path** — Completed in this incident; BullMQ is now optional, not a hard dependency for email delivery

### Monitoring & Alerting

- [ ] **Deploy an uptime monitor** (e.g., Better Uptime, UptimeRobot) that pings `/api/health` every 60 seconds and sends an SMS/WhatsApp alert on failure
- [ ] **Set up Vercel deployment notifications** — Alert when a production deployment is skipped or when a deployment fails
- [ ] **Add post-deployment smoke tests** — Automated scripts that verify at least one request to each API namespace succeeds after every production deploy
- [ ] **Monitor Upstash Redis quota** — Set an alert at 80% quota usage to prevent silent queue failures

### Operational Improvements

- [ ] **Document the `vercel.json` extension requirement** formally in `INFRASTRUCTURE_GUIDE.md` with a ⛔ warning that production requires `.js` extensions even when `vercel dev` works without them
- [ ] **Establish a deployment runbook** — A checklist engineers must follow before merging any change to `vercel.json` or any routing configuration
- [ ] **Implement a post-merge verification step** — After every PR merge to `main`, manually verify that Vercel actually triggered a Production deployment (not skipped it)
- [ ] **Disaster Recovery plan** — Document the process for quickly promoting a Preview deployment to Production when a Production build is skipped

---

## 10. Current Status

As of **17 May 2026, 02:15 AM IST**, all core platform services have been fully restored and are operational.

| Service | Status |
|---|---|
| Events Website | ✅ Online |
| Admin Dashboard | ✅ Online |
| All API Endpoints | ✅ Online |
| Ticket Email Dispatch | ✅ Online (direct, queue-independent) |
| Uptime Monitoring | ⚠️ Not yet configured (in progress) |

The platform is under enhanced manual monitoring. The engineering team is actively implementing the preventive measures outlined in Section 9.

---

## 11. Conclusion

The May 2026 downtime incident was caused by a cascade of three compounding issues: a routing configuration regression, a deployment infrastructure constraint, and a secondary Redis quota exhaustion. While each issue was individually manageable, their combination resulted in an extended 60–72 hour outage that impacted all public and organizer-facing services.

No user data, event records, or payment information was lost or compromised during the incident.

The engineering team has implemented three targeted code-level fixes and has identified a comprehensive set of infrastructure, monitoring, and operational improvements to prevent recurrence. The highest priority actions — uptime monitoring, staging environment, and Vercel plan upgrade — are being implemented immediately.

We recognize the impact this outage had on our organizers and attendees, and we are committed to building a significantly more resilient and observable platform going forward.

---

*Report prepared by: Piyush Kumar*
*Date of Report: 17 May 2026*
*Classification: Internal / Stakeholder*
