import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseHeadersFromEnv } from "../headers";

describe("parseHeadersFromEnv", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("parses OPENAPI_MCP_HEADERS when set", () => {
    process.env.OPENAPI_MCP_HEADERS = JSON.stringify({
      Authorization: "Bearer token123",
      "X-Custom-Header": "test",
    });

    expect(parseHeadersFromEnv()).toEqual({
      Authorization: "Bearer token123",
      "X-Custom-Header": "test",
    });
  });

  it("builds headers from ANYTYPE_API_KEY and ANYTYPE_API_VERSION", () => {
    process.env.ANYTYPE_API_KEY = "token123";
    process.env.ANYTYPE_API_VERSION = "2025-11-08";

    expect(parseHeadersFromEnv()).toEqual({
      Authorization: "Bearer token123",
      "Anytype-Version": "2025-11-08",
    });
  });

  it("supports ANYTYPE_VERSION as a fallback alias", () => {
    process.env.ANYTYPE_API_KEY = "token123";
    process.env.ANYTYPE_VERSION = "2025-11-08";

    expect(parseHeadersFromEnv()).toEqual({
      Authorization: "Bearer token123",
      "Anytype-Version": "2025-11-08",
    });
  });

  it("warns when ANYTYPE_API_KEY is set without a version", () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    process.env.ANYTYPE_API_KEY = "token123";

    expect(parseHeadersFromEnv()).toEqual({
      Authorization: "Bearer token123",
    });
    expect(consoleSpy).toHaveBeenCalledWith(
      "ANYTYPE_API_KEY is set without ANYTYPE_API_VERSION. Requests may fail if your Anytype API requires an Anytype-Version header.",
    );
  });

  it("returns empty headers when nothing is configured", () => {
    delete process.env.OPENAPI_MCP_HEADERS;
    delete process.env.ANYTYPE_API_KEY;
    delete process.env.ANYTYPE_API_VERSION;
    delete process.env.ANYTYPE_VERSION;

    expect(parseHeadersFromEnv()).toEqual({});
  });
});
