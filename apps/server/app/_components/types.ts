export type StatusEvent = {
  id: string;
  recordedAt: number;
  devicePoweredOn: boolean;
  screenOn: boolean;
  unlocked: boolean;
  activity: string;
  batteryPercent: number | null;
  batteryState: string;
  foregroundApp: string | null;
};

export type ForegroundApp = {
  id: string;
  packageName: string;
  appName: string;
  collectedAt: number;
};

export type DeviceNotification = {
  id: string;
  appName: string;
  title: string;
  text: string;
  subText: string;
  postedAt: number;
  active: boolean;
};

export const WINDOWS = [
  { id: "5m", label: "5m", long: "5 minutes", ms: 5 * 60 * 1000 },
  { id: "15m", label: "15m", long: "15 minutes", ms: 15 * 60 * 1000 },
  { id: "1h", label: "1h", long: "hour", ms: 60 * 60 * 1000 },
  { id: "6h", label: "6h", long: "6 hours", ms: 6 * 60 * 60 * 1000 },
  { id: "24h", label: "24h", long: "24 hours", ms: 24 * 60 * 60 * 1000 },
] as const;

export type WindowId = (typeof WINDOWS)[number]["id"];

export type TabId = "overview" | "activity" | "apps" | "notifications";
