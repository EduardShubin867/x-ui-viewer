export interface ActivityBucket {
  from: string;
  to: string;
  value: number;
}

const BUCKET_SIZES_MS = [
  60_000,
  5 * 60_000,
  15 * 60_000,
  30 * 60_000,
  60 * 60_000,
  3 * 60 * 60_000,
  6 * 60 * 60_000,
  12 * 60 * 60_000,
  24 * 60 * 60_000,
];

export function chooseActivityBucketMs(
  durationMs: number,
  maxBuckets = 60,
): number {
  return (
    BUCKET_SIZES_MS.find(
      (size) => Math.ceil(durationMs / size) <= maxBuckets,
    ) ?? BUCKET_SIZES_MS.at(-1)!
  );
}

export function buildActivityBuckets(
  timestamps: readonly Date[],
  from: Date,
  to: Date,
): { bucketMs: number; items: ActivityBucket[] } {
  const durationMs = Math.max(0, to.getTime() - from.getTime());
  if (!durationMs) return { bucketMs: 60_000, items: [] };
  const bucketMs = chooseActivityBucketMs(durationMs);
  const count = Math.ceil(durationMs / bucketMs);
  const values = Array.from({ length: count }, () => 0);
  for (const timestamp of timestamps) {
    const index =
      timestamp.getTime() === to.getTime()
        ? values.length - 1
        : Math.floor((timestamp.getTime() - from.getTime()) / bucketMs);
    if (index >= 0 && index < values.length) values[index] += 1;
  }
  return {
    bucketMs,
    items: values.map((value, index) => {
      const start = from.getTime() + index * bucketMs;
      return {
        from: new Date(start).toISOString(),
        to: new Date(Math.min(start + bucketMs, to.getTime())).toISOString(),
        value,
      };
    }),
  };
}
