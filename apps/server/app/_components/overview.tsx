import type { ReactNode } from "react";
import {
  activityLabel,
  activityTone,
  appLabel,
  appSessions,
  clock,
  connection,
  duration,
  hue,
  isCharging,
  relativeTime,
  topApps,
} from "./format";
import { BellIcon, ChevronRight, GridIcon, LockIcon, PowerIcon, ScreenIcon, UnlockIcon } from "./icons";
import type { DeviceNotification, ForegroundApp, StatusEvent, TabId } from "./types";
import { AppAvatar, BatteryChart, BatteryRing, CardHeader, Empty, LinkButton, Skeleton } from "./ui";

type Props = {
  ready: boolean;
  now: number;
  event: StatusEvent | null;
  history: StatusEvent[];
  apps: ForegroundApp[];
  notes: DeviceNotification[];
  windowLong: string;
  onNavigate: (tab: TabId) => void;
};

export function Overview({ ready, now, event, history, apps, notes, windowLong, onNavigate }: Props) {
  const sessions = appSessions(apps);
  const top = topApps(sessions).slice(0, 4);

  return (
    <div className="overview-grid">
      <HeroCard ready={ready} event={event} now={now} />

      <section className="card battery-card">
        <CardHeader title="Battery" subtitle={event ? event.batteryState : "No reading"} />
        {!ready ? (
          <Skeleton lines={2} />
        ) : (
          <div className="battery-body">
            <BatteryRing percent={event?.batteryPercent ?? null} charging={event ? isCharging(event.batteryState) : false} />
            <div className="battery-trend">
              <BatteryChart events={history} height={96} />
            </div>
          </div>
        )}
      </section>

      <section className="card status-card" aria-label="Device state">
        <StatusTile
          label="Power"
          value={!event ? "—" : event.devicePoweredOn ? "On" : "Off"}
          on={!!event?.devicePoweredOn}
          icon={<PowerIcon />}
        />
        <StatusTile
          label="Screen"
          value={!event ? "—" : event.screenOn ? "On" : "Off"}
          on={!!event?.screenOn}
          icon={<ScreenIcon />}
        />
        <StatusTile
          label="Lock"
          value={!event ? "—" : event.unlocked ? "Unlocked" : "Locked"}
          on={!!event?.unlocked}
          icon={event?.unlocked ? <UnlockIcon /> : <LockIcon />}
        />
      </section>

      <section className="card">
        <CardHeader
          title="Most used"
          subtitle={sessions.length ? `Since ${clock.format(sessions[sessions.length - 1].start)}` : "Recent app readings"}
          action={<LinkButton onClick={() => onNavigate("apps")}>All apps <ChevronRight size={16} /></LinkButton>}
        />
        {!ready ? (
          <Skeleton />
        ) : top.length === 0 ? (
          <Empty icon={<GridIcon />} title="No app readings yet" />
        ) : (
          <ul className="usage-list">
            {top.map((item) => (
              <li key={item.name}>
                <AppAvatar name={item.name} size={36} />
                <div className="usage-main">
                  <div className="usage-row">
                    <strong>{item.name}</strong>
                    <span>{duration(item.ms)}</span>
                  </div>
                  <div className="usage-bar" aria-hidden="true">
                    <span style={{ width: `${Math.max(item.share * 100, 4)}%`, ["--h" as string]: hue(item.name) }} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <CardHeader
          title="Latest notifications"
          subtitle={ready ? `${notes.length}${notes.length >= 50 ? "+" : ""} in the last ${windowLong}` : "Loading"}
          action={<LinkButton onClick={() => onNavigate("notifications")}>View all <ChevronRight size={16} /></LinkButton>}
        />
        {!ready ? (
          <Skeleton />
        ) : notes.length === 0 ? (
          <Empty icon={<BellIcon />} title="All quiet">No notifications in this range.</Empty>
        ) : (
          <ul className="mini-notes">
            {notes.slice(0, 4).map((item) => (
              <li key={item.id}>
                <AppAvatar name={item.appName || "?"} size={36} />
                <div>
                  <div className="mini-note-top">
                    <strong>{item.appName || "Unknown app"}</strong>
                    <time dateTime={new Date(item.postedAt).toISOString()}>{relativeTime(item.postedAt, now)}</time>
                  </div>
                  <p>{item.title || item.text || "No text"}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function HeroCard({ ready, event, now }: { ready: boolean; event: StatusEvent | null; now: number }) {
  if (!ready) {
    return (
      <section className="card hero-card">
        <Skeleton lines={3} />
      </section>
    );
  }
  if (!event) {
    return (
      <section className="card hero-card tone-idle">
        <p className="eyebrow">Right now</p>
        <h1 className="hero-title">No readings yet</h1>
        <p className="hero-sub">Open the client app on the child&apos;s phone to start sending status.</p>
      </section>
    );
  }

  const tone = activityTone(event.activity);
  const conn = connection(event.recordedAt, now);
  const app = event.foregroundApp ? appLabel(event.foregroundApp) : null;

  return (
    <section className={`card hero-card tone-${tone} conn-${conn.tone}`}>
      <div className="hero-top">
        <p className="eyebrow">Right now</p>
        <span className={`conn-pill conn-${conn.tone}`}>
          <span className="conn-dot" aria-hidden="true" />
          {conn.label}
        </span>
      </div>
      <h1 className="hero-title">{conn.tone === "offline" ? "Last known: " : ""}{activityLabel(event.activity)}</h1>
      {tone === "active" && app ? (
        <div className="hero-app">
          <AppAvatar name={app} size={44} />
          <div>
            <span>Using</span>
            <strong>{app}</strong>
          </div>
        </div>
      ) : (
        <p className="hero-sub">
          {tone === "lock" ? "The screen is on but the phone is locked." : "The screen is off. Nothing is being used."}
        </p>
      )}
      <p className="hero-time">
        Updated <time dateTime={new Date(event.recordedAt).toISOString()}>{clock.format(event.recordedAt)}</time> ·{" "}
        {relativeTime(event.recordedAt, now)}
      </p>
    </section>
  );
}

function StatusTile({ label, value, on, icon }: { label: string; value: string; on: boolean; icon: ReactNode }) {
  return (
    <div className={on ? "status-tile on" : "status-tile"}>
      <span className="status-icon">{icon}</span>
      <span className="status-label">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
