# SEO Roadmap: Park Conscious & Backstage

This roadmap outlines the strategy to dominate search results for "Backstage" and individual event names on the `events.parkconscious.in` subdomain.

---

## 💎 The #1 High-Impact Step: JSON-LD Schema
**Priority: CRITICAL | Impact: MASSIVE**

Search engines (Google, Bing) use a specific format called **Schema.org** to understand events. Implementing this will:
1. Show your events in the **Google Events Carousel**.
2. Display dates, locations, and "Get Tickets" links directly in search results.
3. Help you rank for "Events near me" searches.

**Action:** Inject a dynamic JSON-LD block into the `<head>` of `Event.Page.jsx`.

---

## 🟢 Phase 1: Technical Foundation (Days 1-7)
*Focus: Ensuring Google can find and read your site.*

1. **Dynamic Sitemaps:** Create a `sitemap.xml` at the root that automatically lists all published events.
2. **Robots.txt Optimization:** Ensure `Googlebot` is allowed to crawl the `/api/` folder if it’s used for SSR/metadata.
3. **URL Slug Refactoring:** Move from ID-based URLs (`/event/123`) to keyword-rich slugs (`/events/tech-summit-delhi`).
4. **Google Search Console (GSC):** Register the subdomain `events.parkconscious.in` as a separate property in GSC.

---

## 🟡 Phase 2: On-Page Optimization (Days 8-21)
*Focus: Telling Google what each page is about.*

1. **Title Tag Blueprint:** Standardize titles to: `[Event Name] Tickets & Info | [Location] | Backstage`.
2. **Meta Description Automation:** Use the first 150 characters of the event description with a "Book Now" CTA.
3. **Semantic Headers:** Ensure `<h1>` is reserved ONLY for the Event Title. Use `<h2>` for "About", "Hosts", and "Gallery".
4. **Image Alt Text:** Automatically use `Event Name - Poster` as the alt text for all gallery and hero images.

---

## 🟠 Phase 3: Brand Authority (Days 22-45)
*Focus: Ranking for the brand name "Backstage".*

1. **Pillar "About" Page:** Create a comprehensive `/about` page on the subdomain explaining "What is Backstage?".
2. **Inter-Domain Linking:** Add a high-visibility "Powered by Backstage" or "Upcoming Events" link on the main `parkconscious.in` homepage.
3. **Social Metadata (OG Tags):** Ensure every shared link on WhatsApp/Twitter looks like a premium advertisement.

---

## 🔴 Phase 4: Content & Backlinks (Ongoing)
*Focus: Long-term growth.*

1. **Event Recap Posts:** Create a "Discussion" or "Recap" section where past events are archived to keep the keywords alive.
2. **Host Promotion:** Encourage organizers to link to their Backstage event page from their own websites and social bios.
