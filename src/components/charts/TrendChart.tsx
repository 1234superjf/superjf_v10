"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type TrendChartProps = {
  data: number[];
  // Label for each point (e.g., date strings); if omitted, indexes are used
  labels?: string[];
  // HSL string for stroke/fill base color (without hsl()) or full CSS color
  color?: string; // e.g. "hsl(var(--custom-rose-700))"
  height?: number; // px
  className?: string;
};

function useResizeObserver<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const update = () => setRect(el.getBoundingClientRect());
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, rect } as const;
}

function catmullRom2bezier(points: [number, number][], closed = false): string {
  if (points.length < 2) return "";
  const d: string[] = [];
  const p = points;
  d.push(`M ${p[0][0]},${p[0][1]}`);
  const crp = (i: number) => p[Math.max(0, Math.min(p.length - 1, i))];
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = crp(i - 1);
    const p1 = crp(i);
    const p2 = crp(i + 1);
    const p3 = crp(i + 2);
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    d.push(`C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2[0]},${p2[1]}`);
  }
  if (closed) d.push("Z");
  return d.join(" ");
}

export function TrendChart({ data, labels, color = "hsl(var(--custom-rose-700))", height = 160, className }: TrendChartProps) {
  const { ref, rect } = useResizeObserver<HTMLDivElement>();
  const width = rect?.width ?? 0;
  const max = Math.max(1, ...data);
  const padding = { l: 8, r: 8, t: 12, b: 18 };
  const w = Math.max(0, width - padding.l - padding.r);
  const h = Math.max(0, height - padding.t - padding.b);

  const points = useMemo<[number, number][]>(() => {
    if (w <= 0 || h <= 0 || data.length === 0) return [] as any;
    const stepX = data.length > 1 ? w / (data.length - 1) : w;
    return data.map((v, i) => [padding.l + i * stepX, padding.t + (1 - v / max) * h]);
  }, [data, w, h]);

  const areaPath = useMemo(() => {
    if (points.length === 0) return "";
    const top = catmullRom2bezier(points);
    const last = points[points.length - 1];
    const first = points[0];
    const baseline = `L ${last[0]},${padding.t + h} L ${first[0]},${padding.t + h} Z`;
    return `${top} ${baseline}`;
  }, [points, h]);

  const linePath = useMemo(() => (points.length ? catmullRom2bezier(points) : ""), [points]);

  // Tooltip state
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);
  const onMove = (e: React.MouseEvent) => {
    if (!rect || points.length === 0) return;
    const x = e.clientX - rect.left;
    // find nearest point by x
    let nearest = 0;
    let best = Infinity;
    points.forEach((pt, i) => {
      const d = Math.abs(pt[0] - x);
      if (d < best) { best = d; nearest = i; }
    });
    const pt = points[nearest];
    setHover({ i: nearest, x: pt[0], y: pt[1] });
  };

  const onLeave = () => setHover(null);

  const activeValue = hover ? data[hover.i] : null;
  const activeLabel = hover ? (labels?.[hover.i] ?? String(hover.i + 1)) : null;

  const gradientId = useMemo(() => `trend-grad-${Math.random().toString(36).slice(2)}`,[data.length]);

  return (
    <div ref={ref} className={`relative w-full`} style={{ height }}>
      <svg width={width} height={height} className={className}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        {/* Area */}
        {areaPath && (
          <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
        )}
        {/* Line */}
        {linePath && (
          <path d={linePath} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        )}
        {/* Hover crosshair and dot */}
        {hover && (
          <g>
            <line x1={hover.x} x2={hover.x} y1={padding.t} y2={padding.t + h} stroke={color} strokeOpacity={0.2} />
            <circle cx={hover.x} cy={hover.y} r={4} fill="#fff" stroke={color} strokeWidth={2} />
          </g>
        )}
        {/* X axis ticks (sparse) */}
        {points.length > 1 && (
          <g>
            {points.map((pt, i) => (i % Math.ceil(points.length / 6) === 0 || i === points.length - 1) && (
              <line key={i} x1={pt[0]} x2={pt[0]} y1={padding.t + h} y2={padding.t + h + 4} stroke="currentColor" strokeOpacity={0.2} />
            ))}
          </g>
        )}
      </svg>

      {/* Tooltip */}
      {hover && activeValue != null && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full px-2 py-1 rounded-md text-xs shadow bg-popover text-popover-foreground border"
          style={{ left: hover.x, top: Math.max(0, hover.y - 8) }}
        >
          <div className="font-semibold">{activeValue}</div>
          {activeLabel && <div className="opacity-70">{activeLabel}</div>}
        </div>
      )}

      {/* Interaction layer */}
      <div className="absolute inset-0 cursor-crosshair" onMouseMove={onMove} onMouseLeave={onLeave} />
    </div>
  );
}

export default TrendChart;
