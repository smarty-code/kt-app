"use client";

import { useState } from "react";
import { activityLabel, activityTone, clock, dayKey, dayLabel, duration, stateSpans, timeRange } from "./format";
import { BoltIcon, PulseIcon } from "./icons";
import type { StatusEvent } from "./types";
import { BatteryChart, CardHeader, Empty, Skeleton } from "./ui";

export function Activity({ ready, history, now }: { ready: boolean; history: StatusEvent[]; now: number }) {
  const [limit, setLimit] = useState(20);
  const spans = stateSpans(history);
  const visible = spans.slice(0, limit);
  const inUse = spans.filter((span) => span.activity === "IN_USE").reduce((sum, span) => sum + (span.end - span.start), 0);
  const oldest = history.length ? history[history.length - 1].recordedAt : null;

  return (
    <div className="stack">
      <div className="stat-row">
        <Stat label="Screen time" value={ready ? duration(inUse) : "—"} hint={oldest ? `since ${clock.format(oldest)}` : undefined} />
        <Stat label="App switches" value={ready ? String(spans.filter((s) => s.activity === "IN_USE").length) : "—"} hint="while in use" />
        <Stat label="Readings" value={ready ? String(history.length) : "—"} hint="latest stored" />
      </div>

      <section className="card">
        <CardHeader title="Battery trend" subtitle={oldest ? `From ${clock.format(oldest)} to now` : "Recent readings"} />
        {!ready ? <Skeleton lines={4} /> : <BatteryChart events={history} height={180} />}
      </section>

      <section className="card">
        <CardHeader title="Timeline" subtitle="How the phone's state changed" />
        {!ready ? (
          <Skeleton lines={5} />
        ) : spans.length === 0 ? (
          <Empty icon={<PulseIcon />} title="No activity yet" />
        ) : (
          <ol className="timeline">
            {visible.map((span, index) => {
              const showDay = index === 0 || dayKey(visible[index - 1].start) !== dayKey(span.start);
              const tone = activityTone(span.activity);
              return (
                <li key={span.key} className={`tone-${tone}`}>
                  {showDay ? <p className="timeline-day">{dayLabel(span.start, now)}</p> : null}
                  <div className="timeline-item">
                    <span className="timeline-dot" aria-hidden="true" />
                    <div className="timeline-body">
                      <div className="timeline-top">
                        <strong>
                          {activityLabel(span.activity)}
                          {span.app ? <span className="timeline-app"> · {span.app}</span> : null}
                        </strong>
                        <span className="timeline-duration">{duration(span.end - span.start)}</span>
                      </div>
                      <p className="timeline-meta">
                        {timeRange(span.start, span.end)}
                        {span.battery !== null ? (
                          <span className="timeline-battery">
                            {span.charging ? <BoltIcon size={12} /> : null}
                            {span.battery}%
                          </span>
                        ) : null}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        {ready && spans.length > limit ? (
          <button type="button" className="more-button" onClick={() => setLimit(limit + 30)}>
            Show more · {spans.length - limit} older
          </button>
        ) : null}
      </section>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card stat">
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      {hint ? <span className="stat-hint">{hint}</span> : null}
    </div>
  );
}
