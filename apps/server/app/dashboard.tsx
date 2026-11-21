"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Activity } from "./_components/activity";
import { Apps } from "./_components/apps";
import { appLabel, batteryTone, connection, isCharging, relativeTime } from "./_components/format";
import { AlertIcon, BellIcon, BoltIcon, GridIcon, HomeIcon, PulseIcon, ShieldIcon, XIcon } from "./_components/icons";
import { Notifications, type RemoveRequest } from "./_components/notifications";
import { Overview } from "./_components/overview";
import {
  WINDOWS,
  type DeviceNotification,
  type ForegroundApp,
  type KnownDevice,
  type StatusEvent,
  type TabId,
  type WindowId,
} from "./_components/types";

const DEVICE_KEY = "kt-device";

const TABS: { id: TabId; label: string; title: string; subtitle: string; icon: typeof HomeIcon }[] = [
  { id: "overview", label: "Overview", title: "Overview", subtitle: "What the phone is doing right now", icon: HomeIcon },
  { id: "activity", label: "Activity", title: "Activity", subtitle: "Screen time, battery and state changes", icon: PulseIcon },
  { id: "apps", label: "Apps", title: "Apps", subtitle: "Which apps were open, and for how long", icon: GridIcon },
  { id: "notifications", label: "Alerts", title: "Notifications", subtitle: "Everything that arrived on the phone", icon: BellIcon },
];

const windowSpan = (id: WindowId) => WINDOWS.find((item) => item.id === id)?.ms ?? WINDOWS[1].ms;

export function Dashboard() {
  const [tab, setTab] = useState<TabId>("overview");
  const [windowId, setWindowId] = useState<WindowId>("1h");
  const [devices, setDevices] = useState<KnownDevice[]>([]);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [event, setEvent] = useState<StatusEvent | null>(null);
  const [history, setHistory] = useState<StatusEvent[]>([]);
  const [apps, setApps] = useState<ForegroundApp[]>([]);
  const [notes, setNotes] = useState<DeviceNotification[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const busyRef = useRef(false);

  // Keep the selected tab in the URL hash so a refresh or shared link opens the same view.
  useEffect(() => {
    const sync = () => {
      const fromHash = window.location.hash.slice(1) as TabId;
      if (TABS.some((item) => item.id === fromHash)) setTab(fromHash);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const navigate = useCallback((next: TabId) => {
    setTab(next);
    const url = new URL(window.location.href);
    url.hash = next;
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const stored = new URLSearchParams(window.location.search).get("device") || window.localStorage.getItem(DEVICE_KEY);
    if (stored) setDeviceId(stored);
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadDevices() {
      try {
        const response = await fetch("/api/devices", { cache: "no-store" });
        if (!response.ok) throw new Error("devices failed");
        const body = (await response.json()) as { devices?: KnownDevice[] };
        if (ignore) return;
        const list = body.devices ?? [];
        setDevices(list);
        setDeviceId((current) => {
          if (list.length === 0) return null;
          if (current && list.some((device) => device.deviceId === current)) return current;
          return list[0].deviceId;
        });
        if (list.length === 0) setReady(true);
        setError(null);
      } catch {
        if (!ignore) setError("Couldn't reach the server. Retrying…");
      }
    }

    void loadDevices();
    const timer = setInterval(() => void loadDevices(), 15000);
    return () => {
      ignore = true;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    setEvent(null);
    setHistory([]);
    setApps([]);
    setNotes([]);
  }, [deviceId]);

  useEffect(() => {
    if (!deviceId) return;
    window.localStorage.setItem(DEVICE_KEY, deviceId);
    const url = new URL(window.location.href);
    if (url.searchParams.get("device") === deviceId) return;
    url.searchParams.set("device", deviceId);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, [deviceId]);

  useEffect(() => {
    let ignore = false;

    async function load(first: boolean) {
      if (!deviceId) return;
      try {
        const query = `deviceId=${encodeURIComponent(deviceId)}`;
        const [eventResponse, appResponse, noteResponse] = await Promise.all([
          fetch(`/api/events?limit=1&${query}`, { cache: "no-store" }),
          fetch(`/api/apps?limit=50&${query}`, { cache: "no-store" }),
          fetch(`/api/notifications?active=false&since=${Date.now() - windowSpan(windowId)}&${query}`, { cache: "no-store" }),
        ]);
        if (!eventResponse.ok || !appResponse.ok || !noteResponse.ok) throw new Error("refresh failed");
        const eventBody = (await eventResponse.json()) as { events?: StatusEvent[] };
        const appBody = (await appResponse.json()) as { apps?: ForegroundApp[] };
        const noteBody = (await noteResponse.json()) as { notifications?: DeviceNotification[] };
        if (ignore) return;
        setEvent(eventBody.events?.[0] ?? null);
        setApps(appBody.apps ?? []);
        if (!busyRef.current) setNotes(noteBody.notifications ?? []);
        setError(null);
      } catch {
        if (!ignore && first) setError("Couldn't reach the server. Retrying…");
      } finally {
        if (!ignore) {
          setReady(true);
          setNow(Date.now());
        }
      }
    }

    void load(true);
    const timer = setInterval(() => void load(false), 5000);
    return () => {
      ignore = true;
      clearInterval(timer);
    };
  }, [deviceId, windowId]);

  // The longer history changes slowly and is heavier, so it refreshes less often.
  useEffect(() => {
    let ignore = false;
    async function loadHistory() {
      if (!deviceId) {
        if (!ignore) setHistory([]);
        return;
      }
      try {
        const response = await fetch(`/api/events?limit=200&deviceId=${encodeURIComponent(deviceId)}`, { cache: "no-store" });
        if (!response.ok) return;
        const body = (await response.json()) as { events?: StatusEvent[] };
        if (!ignore) setHistory(body.events ?? []);
      } catch {
        // The fast poll already reports connection problems.
      }
    }
    void loadHistory();
    const timer = setInterval(() => void loadHistory(), 20000);
    return () => {
      ignore = true;
      clearInterval(timer);
    };
  }, [deviceId]);

  async function removeNotifications(request: RemoveRequest) {
    if (!deviceId) return;
    const previous = notes;
    busyRef.current = true;
    setBusy(true);

    let bodies: object[];
    if ("id" in request) {
      setNotes((current) => current.filter((item) => item.id !== request.id));
      bodies = [{ id: request.id, deviceId }];
    } else if ("ids" in request) {
      const ids = new Set(request.ids);
      setNotes((current) => current.filter((item) => !ids.has(item.id)));
      bodies = request.ids.map((id) => ({ id, deviceId }));
    } else if (request.scope === "all") {
      setNotes([]);
      bodies = [{ scope: "all", deviceId }];
    } else {
      const cutoff = Date.now() - windowSpan(windowId);
      setNotes((current) => current.filter((item) => item.postedAt < cutoff));
      bodies = [{ scope: "window", deviceId }];
    }

    try {
      const responses = await Promise.all(
        bodies.map((body) =>
          fetch("/api/notifications/remove", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ ...body, window: windowId }),
          }),
        ),
      );
      if (responses.some((response) => !response.ok)) throw new Error("Delete failed");
    } catch {
      setNotes(previous);
      setError("Couldn't delete. The list was restored.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  const active = TABS.find((item) => item.id === tab) ?? TABS[0];
  const selected = devices.find((device) => device.deviceId === deviceId) ?? null;
  const windowLong = WINDOWS.find((item) => item.id === windowId)?.long ?? "hour";
  const conn = ready ? connection(event?.recordedAt, now) : { tone: "recent" as const, label: "Connecting…" };
  const battery = event?.batteryPercent ?? null;
  const charging = event ? isCharging(event.batteryState) : false;

  return (
    <div className="shell">
      <aside className="sidebar">
        <Brand />
        <nav className="side-nav" aria-label="Sections">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className="side-link"
              aria-current={item.id === tab ? "page" : undefined}
              onClick={() => navigate(item.id)}
            >
              <item.icon size={20} />
              <span>{item.title}</span>
              {item.id === "notifications" && notes.length > 0 ? <span className="count">{countLabel(notes.length)}</span> : null}
            </button>
          ))}
        </nav>
        <div className="device-card">
          <DevicePicker devices={devices} deviceId={deviceId} onChange={setDeviceId} />
          <div className="device-card-top">
            <span className="device-label">{selected?.deviceName ?? "No device yet"}</span>
            <span className={`conn-dot conn-${conn.tone}`} aria-hidden="true" />
          </div>
          <strong>{conn.label}</strong>
          {selected ? <span className="device-meta">Seen {relativeTime(selected.lastSeen, now)}</span> : null}
          {event ? (
            <span className="device-meta">
              {event.activity === "IN_USE" && event.foregroundApp ? appLabel(event.foregroundApp) : "Not in use"}
            </span>
          ) : null}
          <BatteryPill percent={battery} charging={charging} />
        </div>
      </aside>

      <div className="content">
        <header className="topbar">
          <Brand compact />
          <div className="topbar-status">
            <span className={`conn-pill conn-${conn.tone}`}>
              <span className="conn-dot" aria-hidden="true" />
              {!ready ? "Connecting" : conn.tone === "live" ? "Live" : conn.tone === "recent" ? "Recent" : "Offline"}
            </span>
            <BatteryPill percent={battery} charging={charging} />
          </div>
        </header>

        <main className="main">
          <div className="page-head">
            <h1>{active.title}</h1>
            <p>{active.subtitle}</p>
            <DevicePicker className="page-device" devices={devices} deviceId={deviceId} onChange={setDeviceId} />
          </div>

          {error ? (
            <div className="banner" role="alert">
              <AlertIcon size={18} />
              <span>{error}</span>
              <button type="button" aria-label="Dismiss" onClick={() => setError(null)}>
                <XIcon size={16} />
              </button>
            </div>
          ) : null}

          <div className="tab-panel" key={tab}>
            {tab === "overview" ? (
              <Overview
                ready={ready}
                now={now}
                event={event}
                history={history}
                apps={apps}
                notes={notes}
                windowLong={windowLong}
                onNavigate={navigate}
              />
            ) : null}
            {tab === "activity" ? <Activity ready={ready} history={history} now={now} /> : null}
            {tab === "apps" ? <Apps ready={ready} apps={apps} now={now} /> : null}
            {tab === "notifications" ? (
              <Notifications
                ready={ready}
                now={now}
                notes={notes}
                windowId={windowId}
                onWindowChange={setWindowId}
                busy={busy}
                onRemove={(request) => void removeNotifications(request)}
              />
            ) : null}
          </div>
        </main>
      </div>

      <nav className="tabbar" aria-label="Sections">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className="tab"
            aria-current={item.id === tab ? "page" : undefined}
            onClick={() => navigate(item.id)}
          >
            <span className="tab-icon">
              <item.icon size={22} />
              {item.id === "notifications" && notes.length > 0 ? <span className="tab-badge">{countLabel(notes.length)}</span> : null}
            </span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function DevicePicker({
  devices,
  deviceId,
  onChange,
  className,
}: {
  devices: KnownDevice[];
  deviceId: string | null;
  onChange: (deviceId: string) => void;
  className?: string;
}) {
  return (
    <label className={className ? `device-picker ${className}` : "device-picker"}>
      <span>Device</span>
      <select
        value={deviceId ?? ""}
        disabled={devices.length === 0}
        onChange={(event) => onChange(event.target.value)}
      >
        {devices.length === 0 ? <option value="">No devices yet</option> : null}
        {devices.map((device) => (
          <option key={device.deviceId} value={device.deviceId}>
            {deviceOptionLabel(device, devices)}
          </option>
        ))}
      </select>
    </label>
  );
}

function deviceOptionLabel(device: KnownDevice, devices: KnownDevice[]): string {
  const shared = devices.filter((item) => item.deviceName === device.deviceName).length > 1;
  if (!shared) return device.deviceName;
  return `${device.deviceName} · ${device.deviceId.replace(/-/g, "").slice(0, 8)}`;
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "brand compact" : "brand"}>
      <span className="brand-mark">
        <ShieldIcon size={compact ? 18 : 20} />
      </span>
      <span className="brand-name">
        KT Monitor
        {compact ? null : <small>Family device dashboard</small>}
      </span>
    </div>
  );
}

function BatteryPill({ percent, charging }: { percent: number | null; charging: boolean }) {
  return (
    <span className={`battery-pill tone-${batteryTone(percent)}`} aria-label={`Battery ${percent ?? "unknown"}%${charging ? ", charging" : ""}`}>
      <span className="battery-glyph" aria-hidden="true">
        <span style={{ width: `${percent ?? 0}%` }} />
      </span>
      {percent === null ? "—" : `${percent}%`}
      {charging ? <BoltIcon size={12} /> : null}
    </span>
  );
}

function countLabel(count: number): string {
  return count >= 50 ? "50+" : String(count);
}
