import { deletedNotificationIds, deviceNotifications } from "@/lib/mongo";

export const runtime = "nodejs";

type IncomingNotification = {
  id: string;
  appName: string;
  title: string;
  text: string;
  subText: string;
  postedAt: number;
  updatedAt: number;
  active: boolean;
  removedAt: number | null;
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = parseUpload(body);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  const collection = await deviceNotifications();
  const removed = await deletedNotificationIds();
  const ids = parsed.notifications.map((notification) => notification.id);
  const blocked = new Set(
    (await removed.find({ id: { $in: ids } }, { projection: { _id: 0, id: 1 } }).toArray()).map((item) => item.id),
  );
  const fresh = parsed.notifications.filter((notification) => !blocked.has(notification.id));
  if (fresh.length > 0) {
    const receivedAt = new Date();
    await collection.bulkWrite(
      fresh.map((notification) => ({
        updateOne: {
          filter: { id: notification.id },
          update: {
            $set: {
              ...notification,
              deviceId: parsed.deviceId,
              receivedAt,
            },
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );
  }

  return Response.json({ accepted: ids });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const deviceId = url.searchParams.get("deviceId");
  const activeOnly = url.searchParams.get("active") !== "false";
  const filter: { deviceId?: string; active?: boolean; postedAt?: { $gte: number } } = {};
  if (deviceId) filter.deviceId = deviceId;
  if (activeOnly) filter.active = true;
  const since = url.searchParams.get("since");
  if (since) filter.postedAt = { $gte: Number(since) };

  const collection = await deviceNotifications();
  const notifications = await collection
    .find(filter, { projection: { _id: 0 } })
    .sort({ postedAt: -1 })
    .limit(50)
    .toArray();

  return Response.json({ notifications });
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const scope = url.searchParams.get("scope");
  const collection = await deviceNotifications();

  if (id) {
    const result = await collection.deleteOne({ id });
    return Response.json({ deleted: result.deletedCount });
  }

  if (scope === "all") {
    const result = await collection.deleteMany({});
    return Response.json({ deleted: result.deletedCount });
  }

  if (scope === "window") {
    const cutoff = windowCutoff(url.searchParams.get("window"));
    const result = await collection.deleteMany({ postedAt: { $gte: cutoff } });
    return Response.json({ deleted: result.deletedCount });
  }

  return Response.json({ error: "Nothing to delete" }, { status: 400 });
}

function windowCutoff(windowId: string | null): number {
  const windows: Record<string, number> = {
    "5m": 5 * 60 * 1000,
    "15m": 15 * 60 * 1000,
    "1h": 60 * 60 * 1000,
    "6h": 6 * 60 * 60 * 1000,
    "24h": 24 * 60 * 60 * 1000,
  };
  const span = windows[windowId ?? ""] ?? windows["15m"];
  return Date.now() - span;
}

function parseUpload(
  body: unknown,
): { ok: true; deviceId: string; notifications: IncomingNotification[] } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Expected a JSON object" };
  }
  const record = body as { deviceId?: unknown; notifications?: unknown };
  if (typeof record.deviceId !== "string" || record.deviceId.length < 1 || record.deviceId.length > 128) {
    return { ok: false, error: "deviceId is required" };
  }
  if (!Array.isArray(record.notifications) || record.notifications.length < 1 || record.notifications.length > 50) {
    return { ok: false, error: "notifications must contain 1 to 50 items" };
  }

  const notifications: IncomingNotification[] = [];
  for (const item of record.notifications) {
    const notification = parseNotification(item);
    if (!notification) return { ok: false, error: "A notification is missing required fields" };
    notifications.push(notification);
  }
  return { ok: true, deviceId: record.deviceId, notifications };
}

function parseNotification(value: unknown): IncomingNotification | null {
  if (!value || typeof value !== "object") return null;
  const notification = value as Record<string, unknown>;
  if (typeof notification.id !== "string" || notification.id.length < 1 || notification.id.length > 80) return null;
  if (typeof notification.appName !== "string" || notification.appName.length > 80) return null;
  if (typeof notification.title !== "string" || notification.title.length > 200) return null;
  if (typeof notification.text !== "string" || notification.text.length > 2000) return null;
  if (typeof notification.subText !== "string" || notification.subText.length > 200) return null;
  if (typeof notification.postedAt !== "number" || !Number.isFinite(notification.postedAt)) return null;
  if (typeof notification.updatedAt !== "number" || !Number.isFinite(notification.updatedAt)) return null;
  if (typeof notification.active !== "boolean") return null;
  if (notification.removedAt !== null && typeof notification.removedAt !== "number") return null;

  return {
    id: notification.id,
    appName: notification.appName,
    title: notification.title,
    text: notification.text,
    subText: notification.subText,
    postedAt: notification.postedAt,
    updatedAt: notification.updatedAt,
    active: notification.active,
    removedAt: notification.removedAt,
  };
}
