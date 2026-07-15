import "server-only";

interface Bucket { count: number; resetAt: number }
const buckets = new Map<string, Bucket>();

export function allowCollectorRequest(key: string, limit = 120, windowMs = 60_000): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}
