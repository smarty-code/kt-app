import { readDeviceName } from "@/lib/device";
import { rememberDevice, statusEvents } from "@/lib/mongo";

export const runtime = "nodejs";

const ACTIVITIES = new Set(["IN_USE", "LOCK_SCREEN", "IDLE"]);

type IncomingEvent = {
  id: string;
  recordedAt: number;
  devicePoweredOn: boolean;
  screenOn: boolean;
  unlocked: boolean;
  activity: string;
  batteryPercent: number | null;
  batteryState: string;
  foregroundApp: string | null;
  notifications: PostedNotification[];
};

type PostedNotification = {
  app: string;
  title: string;
  text: string;
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = parseUpload(body);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  const collection = await statusEvents();
  const receivedAt = new Date();
  await collection.bulkWrite(
    parsed.events.map((event) => ({
      updateOne: {
        filter: { id: event.id },
        update: {
          $setOnInsert: {
            ...event,
            deviceId: parsed.deviceId,
            receivedAt,
          },
        },
        upsert: true,
      },
    })),
    { ordered: false },
  );
  await rememberDevice(parsed.deviceId, parsed.deviceName);

  return Response.json({ accepted: parsed.events.map((event) => event.id) });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const deviceId = url.searchParams.get("deviceId");
  const requestedLimit = Number(url.searchParams.get("limit") ?? 50);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 200)
    : 50;

  const collection = await statusEvents();
  const events = await collection
    .find(deviceId ? { deviceId } : {}, { projection: { _id: 0 } })
    .sort({ recordedAt: -1 })
    .limit(limit)
    .toArray();

  return Response.json({ events });
}

function parseUpload(
  body: unknown,
): { ok: true; deviceId: string; deviceName: string | null; events: IncomingEvent[] } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Expected a JSON object" };
  }
  const record = body as { deviceId?: unknown; deviceName?: unknown; events?: unknown };
  if (typeof record.deviceId !== "string" || record.deviceId.length < 1 || record.deviceId.length > 128) {
    return { ok: false, error: "deviceId is required" };
  }
  if (!Array.isArray(record.events) || record.events.length < 1 || record.events.length > 100) {
    return { ok: false, error: "events must contain 1 to 100 readings" };
  }

  const events: IncomingEvent[] = [];
  for (const item of record.events) {
    const event = parseEvent(item);
    if (!event) return { ok: false, error: "An event is missing required fields" };
    events.push(event);
  }
  return { ok: true, deviceId: record.deviceId, deviceName: readDeviceName(record.deviceName), events };
}

function parseEvent(value: unknown): IncomingEvent | null {
  if (!value || typeof value !== "object") return null;
  const event = value as Record<string, unknown>;
  if (typeof event.id !== "string" || event.id.length < 1 || event.id.length > 80) return null;
  if (typeof event.recordedAt !== "number" || !Number.isFinite(event.recordedAt)) return null;
  if (typeof event.devicePoweredOn !== "boolean") return null;
  if (typeof event.screenOn !== "boolean") return null;
  if (typeof event.unlocked !== "boolean") return null;
  if (typeof event.activity !== "string" || !ACTIVITIES.has(event.activity)) return null;
  if (typeof event.batteryState !== "string" || event.batteryState.length > 80) return null;
  if (event.batteryPercent !== null && typeof event.batteryPercent !== "number") return null;
  const foregroundApp = event.foregroundApp === undefined || event.foregroundApp === null
    ? null
    : event.foregroundApp;
  if (foregroundApp !== null && (typeof foregroundApp !== "string" || foregroundApp.length > 120)) return null;
  const notifications = parseNotifications(event.notifications);
  if (notifications === null) return null;

  return {
    id: event.id,
    recordedAt: event.recordedAt,
    devicePoweredOn: event.devicePoweredOn,
    screenOn: event.screenOn,
    unlocked: event.unlocked,
    activity: event.activity,
    batteryPercent: event.batteryPercent,
    batteryState: event.batteryState,
    foregroundApp,
    notifications,
  };
}

function parseNotifications(value: unknown): PostedNotification[] | null {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 50) return null;
  const notifications: PostedNotification[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const notification = item as Record<string, unknown>;
    if (typeof notification.app !== "string" || notification.app.length > 80) return null;
    if (typeof notification.title !== "string" || notification.title.length > 200) return null;
    if (typeof notification.text !== "string" || notification.text.length > 2000) return null;
    notifications.push({
      app: notification.app,
      title: notification.title,
      text: notification.text,
    });
  }
  return notifications;
}
