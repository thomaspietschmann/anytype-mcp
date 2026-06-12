export function parseHeadersFromEnv(): Record<string, string> {
  const headersJson = process.env.OPENAPI_MCP_HEADERS;
  if (headersJson) {
    try {
      const headers = JSON.parse(headersJson);
      if (typeof headers !== "object" || headers === null) {
        console.warn("OPENAPI_MCP_HEADERS environment variable must be a JSON object, got:", typeof headers);
        return {};
      }
      return headers;
    } catch (error) {
      console.warn("Failed to parse OPENAPI_MCP_HEADERS environment variable:", error);
      return {};
    }
  }

  const apiKey = process.env.ANYTYPE_API_KEY;
  if (!apiKey) {
    return {};
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
  };
  const anytypeVersion = process.env.ANYTYPE_API_VERSION ?? process.env.ANYTYPE_VERSION;
  if (anytypeVersion) {
    headers["Anytype-Version"] = anytypeVersion;
  } else {
    console.warn(
      "ANYTYPE_API_KEY is set without ANYTYPE_API_VERSION. Requests may fail if your Anytype API requires an Anytype-Version header.",
    );
  }

  return headers;
}
