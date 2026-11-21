# Developer guide

This repo is a pnpm workspace with two Kotlin Android apps and a Next.js server. Client and admin share one Gradle build so they reuse the same Gradle install and the same Android libraries.

| App | Workspace package | Gradle project | Application id | What you see |
| --- | --- | --- | --- | --- |
| Client | `@kt/client` | `:client` | `com.edutips.ktapp` | Device status, including the app currently in use |
| Admin | `@kt/admin` | `:admin` | `com.edutips.ktapp.admin` | Client readings stored in MongoDB |
| Server | `@kt/server` | none | none | Latest device state on port 3000 |

## Layout

```
kt-app/
  apps/client/          Kotlin Android client
  apps/admin/           Kotlin Android admin
  apps/server/          Next.js application (this is the server)
  gradle/               Wrapper and version catalog
  docs/                 This guide
  package.json          pnpm scripts for the whole repo
  pnpm-workspace.yaml   Workspace members: apps/*
  settings.gradle.kts   Registers :client and :admin
```

Android source for each app lives in `apps/<name>/src/main`. Kotlin files go under `java/`, layouts and strings under `res/`. The client package is `com.edutips.ktapp`. The admin package is `com.edutips.ktapp.admin`.

Shared dependency versions are in `gradle/libs.versions.toml`. Both apps read that catalog. Add a library there once, then depend on it from the app that needs it.

## What is already installed

A new checkout still needs the tools below. The Gradle distribution and the current Android libraries are already cached on this machine at `~/.cache/kt-app/gradle`. Build scripts point `GRADLE_USER_HOME` at that directory and pass `--offline`, so `pnpm build` does not download Gradle or those libraries again.

| Tool | Used version |
| --- | --- |
| JDK | 21 (`JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64`) |
| Android SDK | `$HOME/Android/Sdk` (platforms 36, 36.1, 37.0; build-tools 37.0.0) |
| Android Gradle Plugin | 9.5.2, with built-in Kotlin |
| Gradle | 9.6.0, started by `./gradlew` |
| compile / target SDK | API 37.0 |
| min SDK | 24 |
| Node | already on `PATH` |
| pnpm | 11.21.0 |

AGP 9 compiles Kotlin itself. Do not add the `org.jetbrains.kotlin.android` plugin. Applying it on top of AGP 9 fails.

## First-time machine setup

Shell config (`~/.zshrc`, and `~/.bashrc` if you use bash):

```bash
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
export ANDROID_HOME="$HOME/Android/Sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
```

Open a new terminal, then from the repo root create `local.properties` if it is missing. This file is machine-specific and is gitignored.

```bash
echo "sdk.dir=$HOME/Android/Sdk" > local.properties
pnpm install
```

`pnpm install` links the workspace and installs the Next.js server dependencies.

Confirm the shared Gradle cache is present:

```bash
test -x "$HOME/.cache/kt-app/gradle/wrapper/dists/gradle-9.6.0-bin/"*/gradle-9.6.0/bin/gradle && echo "Gradle cache ready"
```

## Everyday commands

Run these from the repo root.

| Command | Result |
| --- | --- |
| `pnpm build` | Debug APKs for client and admin, offline |
| `pnpm client:build` | Client debug APK only |
| `pnpm admin:build` | Admin debug APK only |
| `pnpm server:start` | Next.js dev server on port 3000 |
| `pnpm server:build` | Production build of the Next.js server |

APKs land here:

- `apps/client/build/outputs/apk/debug/client-debug.apk`
- `apps/admin/build/outputs/apk/debug/admin-debug.apk`

The server is the Next.js application in `apps/server`. `pnpm server:start` runs `next dev`. After `pnpm server:build`, `pnpm --filter @kt/server start` runs the production Next.js server with `next start`.

Open `http://localhost:3000` to see the latest stored state and its timestamp. The page reads the newest document in `status_events` and refreshes every few seconds. `GET /health` returns `{ "ok": true }`. Override the port with `PORT=4000 pnpm server:start`.

## Device status sync

The client writes each reading to a local SQLite database before it tries the network. A change is saved immediately while the client app is open. The same reading is saved again after two minutes so an idle phone still leaves a trail. The app does not post a status notification.

WorkManager uploads pending rows to `POST /api/events` when the phone has a connection. If the phone is offline, the rows stay marked pending and upload after the connection returns. The server stores them in MongoDB collection `status_events` in the `kt_app` database and ignores a repeated event id.

The server page at `/` refreshes every few seconds. Device status, the application in use, and notifications are separate sections. The application in use is stored in `foreground_apps` with `collectedAt`, the time the client recorded it. The admin app reads `GET /api/events` on the same interval.

Set the server address in `local.properties` (gitignored):

```
server.base.url=http://10.61.119.194:3000
```

Use the computer's LAN address while `pnpm server:start` is running, and the phone is on that network. After the server is deployed, change it to the Vercel `https` URL and rebuild the apps.

MongoDB credentials live in `apps/server/.env.local`, which is gitignored. Copy `apps/server/.env.example`. On Vercel, set the project root to `apps/server` and add `MONGODB_URI` and `MONGODB_DB`.

| Route | Purpose |
| --- | --- |
| `GET /` | Web page of the latest stored state |
| `POST /api/events` | Client uploads a batch of readings |
| `GET /api/events` | Admin reads the newest readings |

Generated `build/`, `.gradle/`, and `.kotlin/` directories are gitignored. Delete them when you want a clean tree. The next `pnpm build` recreates them from the cache.

## Install on a phone

1. On the phone, turn on Developer options and USB debugging.
2. Connect the phone and accept the debugging prompt.
3. Check that `adb devices` lists it.

Install an APK that is already built:

```bash
adb install -r apps/client/build/outputs/apk/debug/client-debug.apk
adb install -r apps/admin/build/outputs/apk/debug/admin-debug.apk
```

Or build and install in one step:

```bash
GRADLE_USER_HOME="$HOME/.cache/kt-app/gradle" ./gradlew :client:installDebug --offline
GRADLE_USER_HOME="$HOME/.cache/kt-app/gradle" ./gradlew :admin:installDebug --offline
```

`-r` and `installDebug` replace the app already on the device. Client and admin install side by side because their application ids differ.

For wireless debugging, pair from Developer options, then `adb pair <ip:port>` and `adb connect <ip:port>`.

## Changing the running app

Open the repo in Android Studio and run the debug variant on the phone. Use **Apply Changes** to push many Kotlin and layout edits without a full reinstall.

These apps use XML layouts, so Compose Live Edit does not apply. Manifest changes, application id changes, and some resource additions still need `installDebug`.

## How the build stays offline

`pnpm build` is:

```bash
GRADLE_USER_HOME="$HOME/.cache/kt-app/gradle" ./gradlew :client:assembleDebug :admin:assembleDebug --offline
```

`GRADLE_USER_HOME` is the directory that already contains Gradle 9.6.0 and the Android libraries from `libs.versions.toml`. `--offline` tells Gradle to use that directory and not the network. Client and admin both call the same wrapper, so a second app does not download Gradle again.

Keep that cache. Deleting `~/.cache/kt-app/gradle` means the next build cannot resolve Gradle or the current libraries until they are downloaded again.

## Adding a library

1. Add the version and the library alias in `gradle/libs.versions.toml`.
2. Depend on the alias from `apps/client/build.gradle.kts`, `apps/admin/build.gradle.kts`, or both.
3. Resolve it once without `--offline`, still using the shared cache:

```bash
GRADLE_USER_HOME="$HOME/.cache/kt-app/gradle" ./gradlew :client:assembleDebug :admin:assembleDebug
```

4. After that succeeds, go back to `pnpm build`. The new files are in the cache, and later builds stay offline.

Do not bump the Gradle wrapper URL or the AGP version unless you intend to download a new toolchain. The wrapper URL is `gradle-9.6.0-bin.zip` in `gradle/wrapper/gradle-wrapper.properties`. Changing it makes the wrapper look for a different distribution.

## Where to change things

| Task | File |
| --- | --- |
| Client screen | `apps/client/src/main/java/com/edutips/ktapp/MainActivity.kt` and `apps/client/src/main/res/` |
| Admin screen | `apps/admin/src/main/java/com/edutips/ktapp/admin/MainActivity.kt` and `apps/admin/src/main/res/` |
| Client or admin ids, SDK levels | That app's `build.gradle.kts` |
| Shared library versions | `gradle/libs.versions.toml` |
| Server page | `apps/server/app/page.tsx` |
| Server routes | `apps/server/app/api/events/route.ts` and `apps/server/app/health/route.ts` |
| Repo scripts | Root `package.json` and the app `package.json` files |

Match the existing style: AndroidX, Material 3 theme `Theme.Material3.DayNight.NoActionBar`, and the official Kotlin code style (`kotlin.code.style=official`).
