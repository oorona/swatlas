import type { Character } from '@/lib/atlas/schema';

export const MARK_FILL: Record<Character['force_status'], string> = {
  sensitive: 'var(--mark-sensitive)',
  not_sensitive: 'var(--mark-not)',
  unknown: 'var(--mark-unknown)',
  disputed: 'var(--mark-unknown)',
};

/** Shape encodes editorial Force status redundantly with color: circle, square, diamond, triangle. */
/** Shape always encodes Force status; `fill` overrides the color (e.g. faction). */
export function Marker({ status, x, y, size = 7, fill = MARK_FILL[status] }: { status: Character['force_status']; x: number; y: number; size?: number; fill?: string }) {
  const stroke = 'var(--surface)';
  if (status === 'not_sensitive') {
    return <rect x={x - size} y={y - size} width={size * 2} height={size * 2} rx={1.5} fill={fill} stroke={stroke} strokeWidth={1.5} />;
  }
  if (status === 'unknown') {
    const s = size * 1.25;
    return <path d={`M${x} ${y - s}L${x + s} ${y}L${x} ${y + s}L${x - s} ${y}Z`} fill={fill} stroke={stroke} strokeWidth={1.5} />;
  }
  if (status === 'disputed') {
    const s = size * 1.2;
    return <path d={`M${x} ${y - s}L${x + s} ${y + s * 0.8}L${x - s} ${y + s * 0.8}Z`} fill={fill} stroke={stroke} strokeWidth={1.5} />;
  }
  return <circle cx={x} cy={y} r={size} fill={fill} stroke={stroke} strokeWidth={1.5} />;
}

export function MarkerLegendIcon({ status, fill }: { status: Character['force_status']; fill?: string }) {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" className="inline-block shrink-0">
      <Marker status={status} x={9} y={9} size={6} fill={fill} />
    </svg>
  );
}
