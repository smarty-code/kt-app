import type { ReactNode } from "react";
import { batteryTone, clock, hue } from "./format";
import { BoltIcon } from "./icons";
import type { StatusEvent } from "./types";

export function AppAvatar({ name, size = 40 }: { name: string; size?: number }) {
  const h = hue(name);
  return (
    <span
      className="app-avatar"
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: size * 0.42, ["--h" as string]: h }}
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="card-header">
      <div>
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function LinkButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" className="link-button" onClick={onClick}>
      {children}
    </button>
  );
}

export function BatteryRing({ percent, charging }: { percent: number | null; charging: boolean }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const value = percent ?? 0;
  return (
    <div className={`battery-ring tone-${batteryTone(percent)}`}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r={r} className="ring-track" />
        <circle
          cx="50"
          cy="50"
          r={r}
          className="ring-fill"
          strokeDasharray={c}
          strokeDashoffset={c - (c * value) / 100}
        />
      </svg>
      <div className="ring-label">
        <strong>
          {percent === null ? "—" : percent}
          {percent === null ? null : <small>%</small>}
        </strong>
        {charging ? (
          <span className="ring-charging">
            <BoltIcon size={12} /> Charging
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function BatteryChart({ events, height = 140 }: { events: StatusEvent[]; height?: number }) {
  const points = events
    .filter((event) => event.batteryPercent !== null)
    .map((event) => ({ t: event.recordedAt, v: event.batteryPercent as number }))
    .reverse();

  if (points.length < 2) {
    return <p className="empty-inline">Not enough readings yet to draw a trend.</p>;
  }

  const t0 = points[0].t;
  const t1 = points[points.length - 1].t;
  const span = Math.max(t1 - t0, 1);
  const W = 100;
  const H = 100;
  const x = (t: number) => ((t - t0) / span) * W;
  const y = (v: number) => H - (v / 100) * H;

  // Break the line where the phone stopped reporting for more than 10 minutes.
  const segments: { t: number; v: number }[][] = [[]];
  points.forEach((point, index) => {
    if (index > 0 && point.t - points[index - 1].t > 10 * 60_000) segments.push([]);
    segments[segments.length - 1].push(point);
  });

  const line = segments
    .map((seg) => seg.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.t).toFixed(2)},${y(p.v).toFixed(2)}`).join(" "))
    .join(" ");
  const area = segments
    .filter((seg) => seg.length > 1)
    .map(
      (seg) =>
        `M${x(seg[0].t).toFixed(2)},${H} ` +
        seg.map((p) => `L${x(p.t).toFixed(2)},${y(p.v).toFixed(2)}`).join(" ") +
        ` L${x(seg[seg.length - 1].t).toFixed(2)},${H} Z`,
    )
    .join(" ");

  const last = points[points.length - 1];
  const min = Math.min(...points.map((p) => p.v));
  const max = Math.max(...points.map((p) => p.v));

  return (
    <figure className="battery-chart">
      <div className="chart-plot" style={{ height }}>
        <div className="chart-grid" aria-hidden="true">
          <span data-label="100%" />
          <span data-label="50%" />
          <span data-label="0%" />
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`Battery from ${points[0].v}% to ${last.v}%`}>
          <defs>
            <linearGradient id="batteryFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#batteryFill)" />
          <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
        <span
          className="chart-dot"
          style={{ left: `${x(last.t)}%`, top: `${y(last.v)}%` }}
          aria-hidden="true"
        />
      </div>
      <figcaption className="chart-axis">
        <span>{clock.format(t0)}</span>
        <span className="chart-range">
          Low {min}% · High {max}%
        </span>
        <span>{clock.format(t1)}</span>
      </figcaption>
    </figure>
  );
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="skeleton" aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} style={{ width: `${90 - i * 15}%` }} />
      ))}
    </div>
  );
}

export function Empty({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="empty-state">
      <span className="empty-icon">{icon}</span>
      <strong>{title}</strong>
      {children ? <p>{children}</p> : null}
    </div>
  );
}
