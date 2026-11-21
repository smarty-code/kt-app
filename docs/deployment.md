# Deployment guide

The phone installs like any other app. It is not a device owner. Each client keeps its own device id and reports the phone's name with it. The dashboard lists those phones by name, and every section shows the phone you select.

The server the phone uses is `https://kt-app-opal.vercel.app`, from `server.base.url` in `local.properties`.

## Server

The Vercel project root is `apps/server`. Set `MONGODB_URI` and `MONGODB_DB` in the Vercel project. `pnpm server:build` builds the Next.js app. Deploy that project the same way it reached `https://kt-app-opal.vercel.app`.

`GET /api/devices` returns each phone that has reported, with `deviceId`, `deviceName`, and `lastSeen`.

## Phone

Build and install the debug client and admin from the repo root:

```bash
pnpm build
adb install -r apps/client/build/outputs/apk/debug/client-debug.apk
adb install -r apps/admin/build/outputs/apk/debug/admin-debug.apk
```

On the phone, grant usage access and notification access once. The client reads the name in Android settings (About phone). When that name is missing, it sends the manufacturer and model. The id and the name are stored together on the server the next time the phone uploads.

A later build replaces the app with `adb install -r` of a new APK signed with the same key. `versionCode` in that app's `build.gradle.kts` has to be higher than the one already installed.

## Dashboard

Open the server URL. The device menu lists every phone by name. Choosing one loads that phone's status, apps, and notifications. The choice stays in the page address as `?device=`.

Two phones with the same name show a short id after the name, so you can tell them apart.
