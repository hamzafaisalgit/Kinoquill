import type { DiscoveryMetadata } from "./types";

const details = new Map<
  string,
  { expiresAt: number; data: DiscoveryMetadata }
>();
const TTL = 5 * 60_000;
export function clearMetadataCache() {
  details.clear();
}
export function readMetadataCache(key: string) {
  const cached = details.get(key);
  if (!cached) return undefined;
  if (cached.expiresAt <= Date.now()) {
    details.delete(key);
    return undefined;
  }
  return structuredClone(cached.data);
}
export function writeMetadataCache(key: string, data: DiscoveryMetadata) {
  if (details.size >= 24) details.delete(details.keys().next().value!);
  details.set(key, {
    expiresAt: Date.now() + TTL,
    data: structuredClone(data),
  });
}
