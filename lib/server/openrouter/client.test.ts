import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { OpenRouterClient, readOpenRouterConfig } from "./client";

afterEach(() => vi.unstubAllGlobals());

describe("OpenRouterClient", () => {
  it("requires both key and model", () => {
    expect(readOpenRouterConfig({ OPENROUTER_API_KEY: "key" })).toBeNull();
    expect(readOpenRouterConfig({ OPENROUTER_API_KEY: "key", OPENROUTER_MODEL: "provider/model" })?.model).toBe("provider/model");
  });

  it("sends authenticated aggregate request and validates the response", async () => {
    const fetchMock = vi.fn(async () => Response.json({ model: "provider/model", choices: [{ message: { content: "Кратко: всё спокойно" } }], usage: { total_tokens: 42 } }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new OpenRouterClient({ apiKey: "secret", model: "provider/model", baseUrl: "https://openrouter.ai/api/v1", siteUrl: "https://books.synapse-web.ru/", appName: "Xray Scope" });
    const result = await client.analyze({ eventCount: 3 });
    expect(result.usage.totalTokens).toBe(42);
    const [, init] = fetchMock.mock.calls[0];
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer secret");
    expect(init?.body).not.toContain("secret");
  });
});
