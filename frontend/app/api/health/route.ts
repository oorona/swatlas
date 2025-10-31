export const dynamic = 'force-dynamic';

// Inexpensive liveness check; never reads or recomputes the bundle.
export function GET() {
  return Response.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } });
}
