import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

// Sole owner of page CSP and security headers (no static CSP in next.config).
// The nonce makes HTML per-request; bundles and hashed assets stay cacheable.
function buildCsp(nonce: string, dev: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${dev ? ' ws: wss:' : ''}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "worker-src 'self'",
    "manifest-src 'self'",
  ].join('; ');
}

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = buildCsp(nonce, process.env.NODE_ENV !== 'production');
  request.headers.set('x-nonce', nonce);
  request.headers.set('Content-Security-Policy', csp);

  // The standalone server re-enters the proxy for next-intl's internal
  // /en/... rewrite; running intl again would redirect back to the unprefixed
  // path in a loop. A re-entered request already carries the resolved locale.
  const reentered = request.headers.has('x-next-intl-locale');
  const response = reentered ? NextResponse.next({ request: { headers: request.headers } }) : intlMiddleware(request);
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  // Nonce-bearing HTML must not be shared-cached.
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export const config = {
  matcher: ['/', '/(en|es)/:path*', '/((?!api|_next|_vercel|bundles|robots\\.txt|sitemap\\.xml|llms\\.txt|.*\\..*).*)'],
};
