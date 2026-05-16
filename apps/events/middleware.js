import { NextResponse } from 'next/server';

/**
 * apps/events/middleware.js
 * 
 * Purpose: Preserves the original host of the request (e.g., events.parkconscious.in 
 * or a Vercel Preview URL) before it is proxied to the main API domain.
 * This allows the backend to generate correct absolute URLs (sitemaps, social previews)
 * regardless of where the request originated.
 */
export function middleware(request) {
  const requestHeaders = new Headers(request.headers);
  const host = request.headers.get('host');
  
  if (host) {
    requestHeaders.set('x-public-host', host);
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

// Only run middleware on API and special routes
export const config = {
  matcher: [
    '/api/:path*',
    '/sitemap.xml',
    '/robots.txt',
    '/event/:id'
  ],
};
