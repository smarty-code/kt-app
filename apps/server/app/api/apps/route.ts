import { readDeviceName } from "@/lib/device";
import { foregroundApps, rememberDevice } from "@/lib/mongo";

export const runtime = "nodejs";

type IncomingApp = {
  id: string;
  packageName: string;
  appName: string;
  collectedAt: number;
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = parseUpload(body);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  const collection = await foregroundApps();
  const receivedAt = new Date();
  await collection.bulkWrite(
    parsed.apps.map((app) => ({
      updateOne: {
        filter: { id: app.id },
        update: {
          $setOnInsert: {
            ...app,
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

  return Response.json({ accepted: parsed.apps.map((app) => app.id) });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const deviceId = url.searchParams.get("deviceId");
  const requestedLimit = Number(url.searchParams.get("limit") ?? 12);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 50)
    : 12;
  const collection = await foregroundApps();
  const apps = await collection
    .find(deviceId ? { deviceId } : {}, { projection: { _id: 0 } })
    .sort({ collectedAt: -1 })
    .limit(limit)
    .toArray();

  return Response.json({ apps });
}

function parseUpload(
  body: unknown,
): { ok: true; deviceId: string; deviceName: string | null; apps: IncomingApp[] } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Expected a JSON object" };
  }
  const record = body as { deviceId?: unknown; deviceName?: unknown; apps?: unknown };
  if (typeof record.deviceId !== "string" || record.deviceId.length < 1 || record.deviceId.length > 128) {
    return { ok: false, error: "deviceId is required" };
  }
  if (!Array.isArray(record.apps) || record.apps.length < 1 || record.apps.length > 50) {
    return { ok: false, error: "apps must contain 1 to 50 readings" };
  }

  const apps: IncomingApp[] = [];
  for (const item of record.apps) {
    const app = parseApp(item);
    if (!app) return { ok: false, error: "An app reading is missing required fields" };
    apps.push(app);
  }
  return { ok: true, deviceId: record.deviceId, deviceName: readDeviceName(record.deviceName), apps };
}

function parseApp(value: unknown): IncomingApp | null {
  if (!value || typeof value !== "object") return null;
  const app = value as Record<string, unknown>;
  if (typeof app.id !== "string" || app.id.length < 1 || app.id.length > 80) return null;
  if (typeof app.packageName !== "string" || app.packageName.length > 200) return null;
  if (typeof app.appName !== "string" || app.appName.length < 1 || app.appName.length > 120) return null;
  if (typeof app.collectedAt !== "number" || !Number.isFinite(app.collectedAt)) return null;
  return {
    id: app.id,
    packageName: app.packageName,
    appName: app.appName,
    collectedAt: app.collectedAt,
  };
}
