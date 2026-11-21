import { readDeviceName } from "@/lib/device";
import { deviceNotifications, devices, foregroundApps, statusEvents } from "@/lib/mongo";

export const runtime = "nodejs";

type SeenDevice = {
  deviceId: string;
  lastSeen: number;
};

export async function GET() {
  const [registered, seen] = await Promise.all([
    devices().then((collection) => collection.find({}, { projection: { _id: 0 } }).toArray()),
    lastSeenByDevice(),
  ]);

  const names = new Map(
    registered
      .filter((device) => device.deviceId)
      .map((device) => [device.deviceId, readDeviceName(device.deviceName) ?? ""]),
  );
  const lastSeen = new Map<string, number>();
  for (const device of registered) {
    if (!device.deviceId) continue;
    lastSeen.set(device.deviceId, device.lastSeen?.getTime?.() ?? 0);
  }
  for (const row of seen) {
    const current = lastSeen.get(row.deviceId) ?? 0;
    if (row.lastSeen > current) lastSeen.set(row.deviceId, row.lastSeen);
    if (!names.has(row.deviceId)) names.set(row.deviceId, "");
  }

  const list = [...lastSeen.entries()]
    .filter(([deviceId]) => deviceId.length > 0)
    .map(([deviceId, seenAt]) => ({
      deviceId,
      deviceName: names.get(deviceId) || shortId(deviceId),
      lastSeen: seenAt,
    }))
    .sort((a, b) => b.lastSeen - a.lastSeen || a.deviceName.localeCompare(b.deviceName));

  return Response.json({ devices: list });
}

async function lastSeenByDevice(): Promise<SeenDevice[]> {
  const [status, apps, notes] = await Promise.all([
    statusEvents(),
    foregroundApps(),
    deviceNotifications(),
  ]);
  const [statusRows, appRows, noteRows] = await Promise.all([
    status
      .aggregate<{ _id: string; lastSeen: number }>([
        { $match: { deviceId: { $type: "string", $ne: "" } } },
        { $group: { _id: "$deviceId", lastSeen: { $max: "$recordedAt" } } },
      ])
      .toArray(),
    apps
      .aggregate<{ _id: string; lastSeen: number }>([
        { $match: { deviceId: { $type: "string", $ne: "" } } },
        { $group: { _id: "$deviceId", lastSeen: { $max: "$collectedAt" } } },
      ])
      .toArray(),
    notes
      .aggregate<{ _id: string; lastSeen: number }>([
        { $match: { deviceId: { $type: "string", $ne: "" } } },
        { $group: { _id: "$deviceId", lastSeen: { $max: "$updatedAt" } } },
      ])
      .toArray(),
  ]);

  return [...statusRows, ...appRows, ...noteRows]
    .filter((row) => typeof row._id === "string" && Number.isFinite(row.lastSeen))
    .map((row) => ({ deviceId: row._id, lastSeen: row.lastSeen }));
}

function shortId(deviceId: string): string {
  return deviceId.replace(/-/g, "").slice(0, 8);
}
