import { appSessions, clock, dayKey, dayLabel, duration, hue, timeRange, topApps } from "./format";
import { GridIcon } from "./icons";
import type { ForegroundApp } from "./types";
import { AppAvatar, CardHeader, Empty, Skeleton } from "./ui";

export function Apps({ ready, apps, now }: { ready: boolean; apps: ForegroundApp[]; now: number }) {
  const sessions = appSessions(apps);
  const top = topApps(sessions);
  const current = sessions[0];

  return (
    <div className="apps-grid">
      <section className="card">
        <CardHeader
          title="Time per app"
          subtitle={sessions.length ? `Last ${apps.length} readings since ${clock.format(sessions[sessions.length - 1].start)}` : "Recent readings"}
        />
        {!ready ? (
          <Skeleton lines={4} />
        ) : top.length === 0 ? (
          <Empty icon={<GridIcon />} title="No app readings yet" />
        ) : (
          <>
            <div className="share-bar" aria-hidden="true">
              {top.map((item) => (
                <span key={item.name} style={{ flexGrow: item.share, ["--h" as string]: hue(item.name) }} />
              ))}
            </div>
            <ul className="usage-list">
              {top.map((item) => (
                <li key={item.name}>
                  <AppAvatar name={item.name} size={36} />
                  <div className="usage-main">
                    <div className="usage-row">
                      <strong>{item.name}</strong>
                      <span>
                        {duration(item.ms)} <em>{Math.round(item.share * 100)}%</em>
                      </span>
                    </div>
                    <div className="usage-bar" aria-hidden="true">
                      <span style={{ width: `${Math.max(item.share * 100, 3)}%`, ["--h" as string]: hue(item.name) }} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="card">
        <CardHeader title="App history" subtitle="Each block is one stretch in the same app" />
        {!ready ? (
          <Skeleton lines={6} />
        ) : sessions.length === 0 ? (
          <Empty icon={<GridIcon />} title="No app readings yet" />
        ) : (
          <ol className="session-list">
            {sessions.map((session, index) => {
              const showDay = index === 0 || dayKey(sessions[index - 1].start) !== dayKey(session.start);
              return (
                <li key={session.key}>
                  {showDay ? <p className="timeline-day">{dayLabel(session.start, now)}</p> : null}
                  <div className={index === 0 ? "session current" : "session"}>
                    <AppAvatar name={session.name} size={40} />
                    <div className="session-main">
                      <strong>{session.name}</strong>
                      <span>
                        {timeRange(session.start, session.end)}
                      </span>
                    </div>
                    {session === current ? (
                      <span className="chip chip-accent">Latest</span>
                    ) : (
                      <span className="session-duration">{duration(session.end - session.start)}</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
