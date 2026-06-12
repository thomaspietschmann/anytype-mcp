export type EnvCredentials = {
  apiKey: string;
  anytypeVersion?: string;
};

function parseOpenApiHeadersFromEnv(): Record<string, string> | null {
  const headersJson = process.env.OPENAPI_MCP_HEADERS;
  if (!headersJson) {
    return null;
  }

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

export function getCredentialsFromEnv(): EnvCredentials | null {
  const parsedHeaders = parseOpenApiHeadersFromEnv();
  if (parsedHeaders) {
    const authorization = parsedHeaders.Authorization ?? parsedHeaders.authorization;
    const apiKey = extractBearerToken(authorization);
    if (!apiKey) {
      return null;
    }

    return {
      apiKey,
      anytypeVersion: parsedHeaders["Anytype-Version"] ?? parsedHeaders["anytype-version"],
    };
  }

  const apiKey = process.env.ANYTYPE_API_KEY;
  if (!apiKey) {
    return null;
  }

  return {
    apiKey,
    anytypeVersion: process.env.ANYTYPE_API_VERSION ?? process.env.ANYTYPE_VERSION,
  };
}

export function parseHeadersFromEnv(): Record<string, string> {
  const parsedHeaders = parseOpenApiHeadersFromEnv();
  if (parsedHeaders) {
    return parsedHeaders;
  }

  const credentials = getCredentialsFromEnv();
  if (!credentials) {
    return {};
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${credentials.apiKey}`,
  };
  if (credentials.anytypeVersion) {
    headers["Anytype-Version"] = credentials.anytypeVersion;
  } else {
    console.warn(
      "ANYTYPE_API_KEY is set without ANYTYPE_API_VERSION. Requests may fail if your Anytype API requires an Anytype-Version header.",
    );
  }

  return headers;
}

function extractBearerToken(authorization: string | undefined): string | null {
  if (!authorization) {
    return null;
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}
