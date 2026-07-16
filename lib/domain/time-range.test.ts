import { describe, expect, it } from "vitest";
import { localDateTimeInputToIso, toLocalDateTimeInput } from "./time-range";

describe("local date-time conversion", () => {
  it("round-trips a local date without treating it as UTC", () => {
    const iso = "2026-07-16T08:30:00.000Z";
    const local = toLocalDateTimeInput(iso);
    expect(localDateTimeInputToIso(local)).toBe(iso);
  });

  it("rejects an empty date", () => {
    expect(localDateTimeInputToIso("")).toBeNull();
  });
});
