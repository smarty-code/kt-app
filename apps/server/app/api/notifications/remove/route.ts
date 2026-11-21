import { deletedNotificationIds, deviceNotifications } from "@/lib/mongo";
import { redirect } from "next/navigation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const form = await request.formData();
  const id = stringValue(form.get("id"));
  const scope = stringValue(form.get("scope"));
  const windowId = stringValue(form.get("window")) || "15m";
  const collection = await deviceNotifications();
  const removed = await deletedNotificationIds();

  if (id) {
    await removed.updateOne({ id }, { $setOnInsert: { id } }, { upsert: true });
    await collection.deleteOne({ id });
  } else if (scope === "all") {
    const ids = await collection.find({}, { projection: { _id: 0, id: 1 } }).toArray();
    if (ids.length > 0) {
      await removed.bulkWrite(
        ids.map((item) => ({
          updateOne: { filter: { id: item.id }, update: { $setOnInsert: { id: item.id } }, upsert: true },
        })),
        { ordered: false },
      );
    }
    await collection.deleteMany({});
  } else if (scope === "window") {
    const cutoff = Date.now() - windowMillis(windowId);
    const ids = await collection
      .find({ postedAt: { $gte: cutoff } }, { projection: { _id: 0, id: 1 } })
      .toArray();
    if (ids.length > 0) {
      await removed.bulkWrite(
        ids.map((item) => ({
          updateOne: { filter: { id: item.id }, update: { $setOnInsert: { id: item.id } }, upsert: true },
        })),
        { ordered: false },
      );
      await collection.deleteMany({ id: { $in: ids.map((item) => item.id) } });
    }
  }

  redirect(`/?notifications=${encodeURIComponent(windowId)}`);
}

function stringValue(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
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
