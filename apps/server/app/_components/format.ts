import type { ForegroundApp, StatusEvent } from "./types";

const TIME_ZONE = "Asia/Kolkata";

export const clock = new Intl.DateTimeFormat("en-IN", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});

export const dateTime = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: TIME_ZONE,
});

const dayFormat = new Intl.DateTimeFormat("en-IN", {
  weekday: "long",
  day: "numeric",
  month: "short",
  timeZone: TIME_ZONE,
});

const dayKeyFormat = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE });

export function relativeTime(ms: number, now = Date.now()): string {
  const seconds = Math.round((now - ms) / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function timeRange(start: number, end: number): string {
  const a = clock.format(start);
  const b = clock.format(end);
  return a === b ? a : `${a} – ${b}`;
}

export function duration(ms: number): string {
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return "<1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

export function dayLabel(ms: number, now = Date.now()): string {
  const key = dayKeyFormat.format(ms);
  if (key === dayKeyFormat.format(now)) return "Today";
  if (key === dayKeyFormat.format(now - 86_400_000)) return "Yesterday";
  return dayFormat.format(ms);
}

export function dayKey(ms: number): string {
  return dayKeyFormat.format(ms);
}

export type Connection = { tone: "live" | "recent" | "offline"; label: string };

export function connection(lastSeen: number | undefined, now = Date.now()): Connection {
  if (lastSeen === undefined) return { tone: "offline", label: "Waiting for device" };
  const age = now - lastSeen;
  if (age < 2 * 60_000) return { tone: "live", label: "Live" };
  if (age < 15 * 60_000) return { tone: "recent", label: `Seen ${relativeTime(lastSeen, now)}` };
  return { tone: "offline", label: `Offline · ${relativeTime(lastSeen, now)}` };
}

const KNOWN_APPS: Record<string, string> = {
  "com.android.chrome": "Chrome",
  "com.android.settings": "Settings",
  "com.android.launcher": "Home screen",
  "com.android.launcher3": "Home screen",
  "com.google.android.apps.nexuslauncher": "Home screen",
  "com.google.android.youtube": "YouTube",
  "com.google.android.gm": "Gmail",
  "com.google.android.dialer": "Phone",
  "com.google.android.apps.messaging": "Messages",
  "com.whatsapp": "WhatsApp",
  "com.instagram.android": "Instagram",
  "com.snapchat.android": "Snapchat",
  "com.zhiliaoapp.musically": "TikTok",
  "com.facebook.katana": "Facebook",
  "com.spotify.music": "Spotify",
  "com.netflix.mediaclient": "Netflix",
  "com.edutips.ktapp": "KT Client",
  "com.google.android.googlequicksearchbox": "Google",
  "com.google.android.apps.maps": "Maps",
};

const KNOWN_SEGMENTS: Record<string, string> = {
  youtube: "YouTube",
  googlequicksearchbox: "Google",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
};

/** Turns raw package names and launcher labels into something a parent can read. */
export function appLabel(name: string | null | undefined, packageName?: string): string {
  const raw = (name ?? "").trim();
  if (packageName && KNOWN_APPS[packageName]) return KNOWN_APPS[packageName];
  if (KNOWN_APPS[raw]) return KNOWN_APPS[raw];
  if (!raw || ["unknown", "none", "null"].includes(raw.toLowerCase())) return "Unknown app";
  if (raw === "System Launcher") return "Home screen";
  if (/^[a-z][\w]*(\.[\w]+)+$/i.test(raw)) {
    const last = raw.split(".").filter((part) => part !== "android" && part !== "app").pop() ?? raw;
    return KNOWN_SEGMENTS[last.toLowerCase()] ?? last.charAt(0).toUpperCase() + last.slice(1);
  }
  return raw;
}

export function hue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return Math.round(Math.abs(hash) * 137.508) % 360;
}

export function activityLabel(activity: string): string {
  switch (activity) {
    case "IN_USE":
      return "In use";
    case "LOCK_SCREEN":
      return "On lock screen";
    case "IDLE":
      return "Idle";
    default:
      return activity;
  }
}

export function activityTone(activity: string): "active" | "lock" | "idle" {
  if (activity === "IN_USE") return "active";
  if (activity === "LOCK_SCREEN") return "lock";
  return "idle";
}

export type AppSession = {
  key: string;
  name: string;
  start: number;
  end: number;
  readings: number;
};

/** Collapses consecutive readings of the same app into one session (input newest first). */
export function appSessions(apps: ForegroundApp[]): AppSession[] {
  const sessions: AppSession[] = [];
  for (const item of [...apps].reverse()) {
    const name = appLabel(item.appName, item.packageName);
    const last = sessions[sessions.length - 1];
    if (last && last.name === name && item.collectedAt - last.end < 5 * 60_000) {
      last.end = item.collectedAt;
      last.readings += 1;
    } else {
      sessions.push({ key: item.id, name, start: item.collectedAt, end: item.collectedAt, readings: 1 });
    }
  }
  // Each session lasts until the next one starts.
  for (let i = 0; i < sessions.length - 1; i++) {
    const gap = sessions[i + 1].start - sessions[i].end;
    if (gap < 5 * 60_000) sessions[i].end = sessions[i + 1].start;
  }
  return sessions.reverse();
}

export type AppShare = { name: string; ms: number; share: number };

export function topApps(sessions: AppSession[]): AppShare[] {
  const totals = new Map<string, number>();
  for (const session of sessions) {
    totals.set(session.name, (totals.get(session.name) ?? 0) + Math.max(session.end - session.start, 30_000));
  }
  const all = [...totals.values()].reduce((sum, ms) => sum + ms, 0) || 1;
  return [...totals.entries()]
    .map(([name, ms]) => ({ name, ms, share: ms / all }))
    .sort((a, b) => b.ms - a.ms);
}

export type StateSpan = {
  key: string;
  activity: string;
  app: string | null;
  battery: number | null;
  charging: boolean;
  start: number;
  end: number;
};

/** Groups status events (newest first) into spans where the phone state did not change. */
export function stateSpans(events: StatusEvent[]): StateSpan[] {
  const spans: StateSpan[] = [];
  for (const event of [...events].reverse()) {
    const app = event.activity === "IN_USE" && event.foregroundApp ? appLabel(event.foregroundApp) : null;
    const last = spans[spans.length - 1];
    if (last && last.activity === event.activity && last.app === app && event.recordedAt - last.end < 10 * 60_000) {
      last.end = event.recordedAt;
      last.battery = event.batteryPercent;
      last.charging = isCharging(event.batteryState);
    } else {
      if (last && event.recordedAt - last.end < 10 * 60_000) last.end = event.recordedAt;
      spans.push({
        key: event.id,
        activity: event.activity,
        app,
        battery: event.batteryPercent,
        charging: isCharging(event.batteryState),
        start: event.recordedAt,
        end: event.recordedAt,
      });
    }
  }
  return spans.reverse();
}

export function isCharging(state: string): boolean {
  const lower = state.toLowerCase();
  return lower.includes("charging") && !lower.includes("not charging") && !lower.includes("discharging");
}

export function batteryTone(percent: number | null): "ok" | "mid" | "low" | "unknown" {
  if (percent === null) return "unknown";
  if (percent < 20) return "low";
  if (percent < 50) return "mid";
  return "ok";
}
