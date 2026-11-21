import {
  deviceNotifications,
  foregroundApps,
  statusEvents,
  type DeviceNotification,
  type ForegroundAppSample,
  type StatusEvent,
} from "@/lib/mongo";
import { DeleteNotificationBatch, DeleteNotificationButton } from "./notification-actions";
import { LiveRefresh } from "./live-refresh";

export const dynamic = "force-dynamic";

const NOTIFICATION_WINDOWS = [
  { id: "5m", label: "5 min", ms: 5 * 60 * 1000 },
  { id: "15m", label: "15 min", ms: 15 * 60 * 1000 },
  { id: "1h", label: "1 hour", ms: 60 * 60 * 1000 },
  { id: "6h", label: "6 hours", ms: 6 * 60 * 60 * 1000 },
  { id: "24h", label: "24 hours", ms: 24 * 60 * 60 * 1000 },
] as const;

type NotificationWindow = (typeof NOTIFICATION_WINDOWS)[number]["id"];

const clock = new Intl.DateTimeFormat("en-IN", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

const recordedAtFormat = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
});

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ notifications?: string }>;
}) {
  const params = await searchParams;
  const windowId = notificationWindow(params.notifications);
  const windowLabel = NOTIFICATION_WINDOWS.find((item) => item.id === windowId)?.label ?? "15 min";
  const [reading, apps, notifications] = await Promise.all([
    loadLatest(),
    loadForegroundApps(),
    loadNotifications(windowId),
  ]);

  return (
    <main>
      <LiveRefresh />
      <header className="top">
        <div>
          <p className="eyebrow">Phone</p>
          <h1>Overview</h1>
        </div>
        <p className="live">
          <span className="live-dot" aria-hidden="true" />
          Refreshes every 5 seconds
        </p>
      </header>

      <StatusBoard event={reading.event} error={reading.error} />

      <div className="columns">
        <section className="panel">
          <div className="panel-heading">
            <h2>Recent apps</h2>
            <p>Last 10 readings</p>
          </div>
          <ForegroundAppList items={apps.items} error={apps.error} />
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Notifications</h2>
              <p>
                {notifications.error
                  ? "Stored on the server"
                  : `${notifications.items.length} in the last ${windowLabel}`}
              </p>
            </div>
            <div className="danger-actions">
              <DeleteNotificationBatch scope="window" windowId={windowId} label="Delete shown" />
              <DeleteNotificationBatch scope="all" windowId={windowId} label="Delete all" />
            </div>
          </div>
          <nav className="filters" aria-label="Notification time range">
            {NOTIFICATION_WINDOWS.map((item) => (
              <a
                key={item.id}
                href={`/?notifications=${item.id}`}
                aria-current={item.id === windowId ? "page" : undefined}
              >
                {item.label}
              </a>
            ))}
          </nav>
          <NotificationList items={notifications.items} error={notifications.error} windowId={windowId} />
        </section>
      </div>
    </main>
  );
}

function StatusBoard({ event, error }: { event: StatusEvent | null; error: string | null }) {
  if (error) return <p className="error">{error}</p>;
  if (!event) return <p className="empty">No current state yet.</p>;

  const battery = event.batteryPercent;
  const level = battery === null ? "unknown" : battery < 20 ? "low" : battery < 50 ? "mid" : "ok";

  return (
    <section className={`board tone-${event.activity.toLowerCase()}`}>
      <div className="board-main">
        <p className="eyebrow">Right now</p>
        <h2 className="activity">{activityLabel(event.activity)}</h2>
        <p className="open-app">{event.foregroundApp || "No app reported"}</p>
        <p className="timestamp">
          <time dateTime={new Date(event.recordedAt).toISOString()}>{recordedAtFormat.format(event.recordedAt)}</time>
          <span>{relativeTime(event.recordedAt)}</span>
        </p>
      </div>
      <div className="board-side">
        <div className="meter">
          <div className="meter-top">
            <span>Battery</span>
            <strong>{battery === null ? "Unknown" : `${battery}%`}</strong>
          </div>
          <div className="meter-track" aria-hidden="true">
            <span className={`meter-fill level-${level}`} style={{ width: `${battery ?? 0}%` }} />
          </div>
          <p>{event.batteryState}</p>
        </div>
        <ul className="pills">
          <li>
            <span>Power</span>
            <strong>{event.devicePoweredOn ? "On" : "Off"}</strong>
          </li>
          <li>
            <span>Screen</span>
            <strong>{event.screenOn ? "On" : "Off"}</strong>
          </li>
          <li>
            <span>Lock</span>
            <strong>{event.unlocked ? "Unlocked" : "Locked"}</strong>
          </li>
        </ul>
      </div>
    </section>
  );
}

function ForegroundAppList({ items, error }: { items: ForegroundAppSample[]; error: string | null }) {
  if (error) return <p className="error">{error}</p>;
  if (items.length === 0) return <p className="none">No application reading yet.</p>;

  return (
    <ol className="apps">
      {items.map((item, index) => (
        <li key={item.id}>
          <span className="mark" aria-hidden="true">
            {index === 0 ? "Now" : String(index + 1)}
          </span>
          <div>
            <strong>{item.appName}</strong>
            <time dateTime={new Date(item.collectedAt).toISOString()}>
              {clock.format(item.collectedAt)} · {relativeTime(item.collectedAt)}
            </time>
          </div>
        </li>
      ))}
    </ol>
  );
}

function NotificationList({
  items,
  error,
  windowId,
}: {
  items: DeviceNotification[];
  error: string | null;
  windowId: NotificationWindow;
}) {
  if (error) return <p className="error">{error}</p>;
  if (items.length === 0) return <p className="none">No notifications in this range.</p>;

  return (
    <ul className="notifications">
      {items.map((item) => {
        const letter = item.appName.trim().charAt(0).toUpperCase() || "?";
        return (
          <li key={item.id}>
            <span className="avatar" aria-hidden="true">
              {letter}
            </span>
            <div className="note-body">
              <div className="note-title">
                <strong>{item.appName}</strong>
                <span className={item.active ? "badge on" : "badge"}>{item.active ? "On phone" : "Cleared"}</span>
              </div>
              {item.title ? <p className="note-heading">{item.title}</p> : null}
              {item.subText ? <p className="subtext">{item.subText}</p> : null}
              {item.text ? <p className="note-text">{item.text}</p> : null}
              <time dateTime={new Date(item.postedAt).toISOString()}>
                {recordedAtFormat.format(item.postedAt)} · {relativeTime(item.postedAt)}
              </time>
            </div>
            <DeleteNotificationButton id={item.id} windowId={windowId} />
          </li>
        );
      })}
    </ul>
  );
}

async function loadLatest(): Promise<{ event: StatusEvent | null; error: string | null }> {
  try {
    const collection = await statusEvents();
    const event = await collection.findOne({}, { sort: { recordedAt: -1 }, projection: { _id: 0, deviceId: 0 } });
    return { event, error: null };
  } catch {
    return { event: null, error: "Could not read the current state." };
  }
}

async function loadForegroundApps(): Promise<{ items: ForegroundAppSample[]; error: string | null }> {
  try {
    const collection = await foregroundApps();
    const items = await collection
      .find({}, { projection: { _id: 0, deviceId: 0 } })
      .sort({ collectedAt: -1 })
      .limit(10)
      .toArray();
    return { items, error: null };
  } catch {
    return { items: [], error: "Could not read the application in use." };
  }
}

function notificationWindow(value: string | undefined): NotificationWindow {
  return NOTIFICATION_WINDOWS.some((item) => item.id === value) ? (value as NotificationWindow) : "15m";
}

async function loadNotifications(
  windowId: NotificationWindow,
): Promise<{ items: DeviceNotification[]; error: string | null }> {
  const windowMs = NOTIFICATION_WINDOWS.find((item) => item.id === windowId)?.ms ?? 15 * 60 * 1000;
  try {
    const collection = await deviceNotifications();
    const items = await collection
      .find({ postedAt: { $gte: Date.now() - windowMs } }, { projection: { _id: 0, deviceId: 0 } })
      .sort({ postedAt: -1 })
      .limit(50)
      .toArray();
    return { items, error: null };
  } catch {
    return { items: [], error: "Could not read notifications." };
  }
}

function activityLabel(activity: string): string {
  switch (activity) {
    case "IN_USE":
      return "In use";
    case "LOCK_SCREEN":
      return "Lock screen";
    case "IDLE":
      return "Idle, screen off";
    default:
      return activity;
  }
}

function relativeTime(ms: number): string {
  const minutes = Math.round((Date.now() - ms) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
