import { describe, expect, it } from "vitest";
import { filtersFromUrl } from "@/lib/domain/filters";

describe("event URL filters", () => {
  it("accepts one client using the backwards-compatible parameter", () => {
    expect(
      filtersFromUrl(
        new URL("http://localhost/api/events?clientEmail=alice%40example.com"),
      ).clientEmails,
    ).toEqual(["alice@example.com"]);
  });

  it("parses, deduplicates and sorts multiple clients", () => {
    const url = new URL(
      "http://localhost/api/events?clientEmail=bob%40example.com&clientEmail=alice%40example.com&clientEmail=bob%40example.com",
    );
    expect(filtersFromUrl(url).clientEmails).toEqual([
      "alice@example.com",
      "bob@example.com",
    ]);
  });

  it("treats an absent client filter as all clients", () => {
    expect(
      filtersFromUrl(new URL("http://localhost/api/events")).clientEmails,
    ).toEqual([]);
  });
});
