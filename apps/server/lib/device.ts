export function readDeviceName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 1) return null;
  return name.slice(0, 80);
}
