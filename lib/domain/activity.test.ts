import { describe, expect, it } from "vitest";
import {
  buildActivityBuckets,
  buildActivityBucketsFromCounts,
  chooseActivityBucketMs,
} from "./activity";

describe("activity buckets", () => {
  it("keeps short ranges minute-based and limits long ranges", () => {
    expect(chooseActivityBucketMs(60 * 60_000)).toBe(60_000);
    expect(chooseActivityBucketMs(24 * 60 * 60_000)).toBe(30 * 60_000);
  });

  it("fills empty intervals so adjacent columns represent adjacent time", () => {
    const from = new Date("2026-07-16T00:00:00.000Z");
    const to = new Date("2026-07-16T00:03:00.000Z");
    const result = buildActivityBuckets(
      [
        new Date("2026-07-16T00:00:10.000Z"),
        new Date("2026-07-16T00:02:10.000Z"),
        new Date("2026-07-16T00:03:00.000Z"),
      ],
      from,
      to,
    );
    expect(result.items.map((item) => item.value)).toEqual([1, 0, 2]);
    expect(result.items[1]).toMatchObject({
      from: "2026-07-16T00:01:00.000Z",
      to: "2026-07-16T00:02:00.000Z",
    });
  });

  it("builds the same zero-filled timeline from database aggregates", () => {
    const result = buildActivityBucketsFromCounts(
      new Map([
        [0, 4],
        [2, 7],
      ]),
      new Date("2026-07-16T00:00:00.000Z"),
      new Date("2026-07-16T00:03:00.000Z"),
    );
    expect(result.items.map((item) => item.value)).toEqual([4, 0, 7]);
  });
});
