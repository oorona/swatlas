'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { Point } from '@/lib/atlas/layout';
import { CHART_H, CHART_W } from './Points';

export interface Link {
  a: string;
  b: string;
  /** 0..1; how hard this link pulls its endpoints. */
  strength: number;
}

const ANCHOR_K = 0.035;
const LINK_K = 0.09;
const DAMPING = 0.78;
const REST_EPSILON = 0.02;
const CLICK_SLOP = 4;

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Animated, draggable positions on top of fixed projection coordinates.
 * Every point springs toward its home (the projection position, or wherever
 * the user dropped it), and each drawn link is a spring with the rest length
 * it has at home, so dragging one point tugs its linked points along. Nothing
 * here changes a score or a ranking; it only moves marks on screen.
 * `resetKey` clears dropped positions (e.g. on projection or mode change).
 */
export function useLiveLayout(home: Record<string, Point>, links: Link[], resetKey: string) {
  const svgRef = useRef<SVGSVGElement>(null);
  const pos = useRef(new Map<string, Point>());
  const vel = useRef(new Map<string, Point>());
  const pins = useRef(new Map<string, Point>());
  const drag = useRef<{ id: string; pointerId: number; start: Point; offset: Point; moved: boolean } | null>(null);
  const justDragged = useRef(false);
  const frame = useRef(0);
  const [live, setLive] = useState<Record<string, Point>>(() => {
    // First paint: points spread out from the chart center (skipped for reduced motion).
    if (prefersReducedMotion()) return home;
    const out: Record<string, Point> = {};
    Object.keys(home).forEach((id, i) => {
      const angle = i * 2.39996;
      out[id] = { x: CHART_W / 2 + Math.cos(angle) * 12, y: CHART_H / 2 + Math.sin(angle) * 12 };
      pos.current.set(id, { ...out[id] });
      vel.current.set(id, { x: 0, y: 0 });
    });
    return out;
  });
  const [pinnedCount, setPinnedCount] = useState(0);
  const [dragging, setDragging] = useState<string | null>(null);
  const [settled, setSettled] = useState<Record<string, Point>>(home);

  const homeRef = useRef(home);
  homeRef.current = home;

  // Spring rest lengths come from the home layout so an undisturbed chart sits still.
  const springs = useMemo(() => {
    const degree = new Map<string, number>();
    for (const l of links) {
      degree.set(l.a, (degree.get(l.a) ?? 0) + 1);
      degree.set(l.b, (degree.get(l.b) ?? 0) + 1);
    }
    return links
      .filter((l) => home[l.a] && home[l.b])
      .map((l) => ({
        ...l,
        rest: Math.hypot(home[l.b]!.x - home[l.a]!.x, home[l.b]!.y - home[l.a]!.y),
        ka: (LINK_K * l.strength) / Math.max(1, Math.sqrt(degree.get(l.a)!)),
        kb: (LINK_K * l.strength) / Math.max(1, Math.sqrt(degree.get(l.b)!)),
      }));
  }, [links, home]);
  const springsRef = useRef(springs);
  springsRef.current = springs;

  const publish = useCallback(() => {
    const out: Record<string, Point> = {};
    for (const id of Object.keys(homeRef.current)) {
      const p = pos.current.get(id);
      out[id] = p ? { x: p.x, y: p.y } : homeRef.current[id]!;
    }
    setLive(out);
    return out;
  }, []);

  const step = useCallback(() => {
    frame.current = 0;
    const reduced = prefersReducedMotion();
    const target = homeRef.current;
    const dragged = drag.current?.id;
    const force = new Map<string, Point>();
    for (const id of Object.keys(target)) {
      if (!pos.current.has(id)) {
        pos.current.set(id, { ...target[id]! });
        vel.current.set(id, { x: 0, y: 0 });
      }
      const anchor = pins.current.get(id) ?? target[id]!;
      const p = pos.current.get(id)!;
      force.set(id, { x: (anchor.x - p.x) * ANCHOR_K, y: (anchor.y - p.y) * ANCHOR_K });
    }
    if (!reduced) {
      for (const s of springsRef.current) {
        const pa = pos.current.get(s.a);
        const pb = pos.current.get(s.b);
        if (!pa || !pb) continue;
        const dx = pb.x - pa.x;
        const dy = pb.y - pa.y;
        const len = Math.hypot(dx, dy) || 1;
        const stretch = (len - s.rest) / len;
        const fa = force.get(s.a)!;
        const fb = force.get(s.b)!;
        fa.x += dx * stretch * s.ka;
        fa.y += dy * stretch * s.ka;
        fb.x -= dx * stretch * s.kb;
        fb.y -= dy * stretch * s.kb;
      }
    }
    let energy = 0;
    for (const [id, f] of force) {
      const p = pos.current.get(id)!;
      const v = vel.current.get(id)!;
      if (id === dragged) {
        v.x = 0;
        v.y = 0;
        continue;
      }
      if (reduced) {
        const anchor = pins.current.get(id) ?? target[id]!;
        p.x = anchor.x;
        p.y = anchor.y;
        continue;
      }
      v.x = (v.x + f.x) * DAMPING;
      v.y = (v.y + f.y) * DAMPING;
      p.x = Math.min(CHART_W - 8, Math.max(8, p.x + v.x));
      p.y = Math.min(CHART_H - 8, Math.max(8, p.y + v.y));
      energy += Math.abs(v.x) + Math.abs(v.y) + Math.abs(f.x) + Math.abs(f.y);
    }
    for (const id of [...pos.current.keys()]) {
      if (!target[id]) {
        pos.current.delete(id);
        vel.current.delete(id);
      }
    }
    const out = publish();
    if (dragged || energy > REST_EPSILON) frame.current = requestAnimationFrame(step);
    else setSettled(out);
  }, [publish]);

  const kick = useCallback(() => {
    if (!frame.current) frame.current = requestAnimationFrame(step);
  }, [step]);

  useEffect(() => {
    kick();
  }, [home, springs, kick]);

  useEffect(() => {
    pins.current.clear();
    setPinnedCount(0);
    kick();
  }, [resetKey, kick]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const toSvg = (e: ReactPointerEvent): Point | null => {
    const ctm = svgRef.current?.getScreenCTM();
    if (!ctm) return null;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return { x: pt.x, y: pt.y };
  };

  const bind = (id: string) => ({
    onPointerDown: (e: ReactPointerEvent<SVGGElement>) => {
      if (e.button !== 0) return;
      const at = toSvg(e);
      const p = pos.current.get(id) ?? homeRef.current[id];
      if (!at || !p) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { id, pointerId: e.pointerId, start: at, offset: { x: p.x - at.x, y: p.y - at.y }, moved: false };
      justDragged.current = false;
      setDragging(id);
    },
    onPointerMove: (e: ReactPointerEvent<SVGGElement>) => {
      const d = drag.current;
      if (!d || d.id !== id || d.pointerId !== e.pointerId) return;
      const at = toSvg(e);
      if (!at) return;
      if (!d.moved && Math.hypot(at.x - d.start.x, at.y - d.start.y) < CLICK_SLOP) return;
      d.moved = true;
      const p = pos.current.get(id) ?? { ...homeRef.current[id]! };
      p.x = Math.min(CHART_W - 8, Math.max(8, at.x + d.offset.x));
      p.y = Math.min(CHART_H - 8, Math.max(8, at.y + d.offset.y));
      pos.current.set(id, p);
      kick();
    },
    onPointerUp: (e: ReactPointerEvent<SVGGElement>) => {
      const d = drag.current;
      if (!d || d.pointerId !== e.pointerId) return;
      drag.current = null;
      setDragging(null);
      if (d.moved) {
        justDragged.current = true;
        pins.current.set(id, { ...pos.current.get(id)! });
        setPinnedCount(pins.current.size);
        kick();
      }
    },
    onPointerCancel: () => {
      drag.current = null;
      setDragging(null);
      kick();
    },
  });

  /** True once right after a drag, so the trailing click does not also select. */
  const consumeDrag = () => {
    const was = justDragged.current;
    justDragged.current = false;
    return was;
  };

  const resetLayout = useCallback(() => {
    pins.current.clear();
    setPinnedCount(0);
    kick();
  }, [kick]);

  // Ids that just appeared (filters) render at home until the next frame places them.
  const points = useMemo(() => {
    const out: Record<string, Point> = {};
    for (const id of Object.keys(home)) out[id] = live[id] ?? home[id]!;
    return out;
  }, [home, live]);

  const settledPoints = useMemo(() => {
    const out: Record<string, Point> = {};
    for (const id of Object.keys(home)) out[id] = settled[id] ?? home[id]!;
    return out;
  }, [home, settled]);

  return { svgRef, points, settled: settledPoints, bind, consumeDrag, dragging, pinnedCount, resetLayout };
}
