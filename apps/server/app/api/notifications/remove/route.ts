import { deletedNotificationIds, deviceNotifications } from "@/lib/mongo";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return Response.json({ error: "Expected a JSON object" }, { status: 400 });
  }

  const record = body as { id?: unknown; scope?: unknown; window?: unknown };
  const id = typeof record.id === "string" ? record.id : "";
  const scope = typeof record.scope === "string" ? record.scope : "";
  const windowId = typeof record.window === "string" && record.window ? record.window : "15m";
  const collection = await deviceNotifications();
  const removed = await deletedNotificationIds();
  let deleted = 0;

  if (id) {
    await removed.updateOne({ id }, { $setOnInsert: { id, deletedAt: new Date() } }, { upsert: true });
    deleted = (await collection.deleteOne({ id })).deletedCount;
  } else if (scope === "all") {
    const ids = await collection.find({}, { projection: { _id: 0, id: 1 } }).toArray();
    if (ids.length > 0) {
      await removed.bulkWrite(
        ids.map((item) => ({
          updateOne: {
            filter: { id: item.id },
            update: { $setOnInsert: { id: item.id, deletedAt: new Date() } },
            upsert: true,
          },
        })),
        { ordered: false },
      );
    }
    deleted = (await collection.deleteMany({})).deletedCount;
  } else if (scope === "window") {
    const cutoff = Date.now() - windowMillis(windowId);
    const ids = await collection
      .find({ postedAt: { $gte: cutoff } }, { projection: { _id: 0, id: 1 } })
      .toArray();
    if (ids.length > 0) {
      await removed.bulkWrite(
        ids.map((item) => ({
          updateOne: {
            filter: { id: item.id },
            update: { $setOnInsert: { id: item.id, deletedAt: new Date() } },
            upsert: true,
          },
        })),
        { ordered: false },
      );
      deleted = (await collection.deleteMany({ id: { $in: ids.map((item) => item.id) } })).deletedCount;
    }
  } else {
    return Response.json({ error: "Nothing to delete" }, { status: 400 });
  }

  return Response.json({ deleted });
}

function windowMillis(windowId: string): number {
  const windows: Record<string, number> = {
    "5m": 5 * 60 * 1000,
    "15m": 15 * 60 * 1000,
    "1h": 60 * 60 * 1000,
    "6h": 6 * 60 * 60 * 1000,
    "24h": 24 * 60 * 60 * 1000,
  };
  return windows[windowId] ?? windows["15m"];
}
