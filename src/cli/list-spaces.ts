import { ApiKeyGenerator, displayCredentialsInstructions, type AnytypeCredentials } from "../auth/get-key";
import { HttpClient } from "../client/http-client";
import { loadOpenApiSpec } from "../init-server";
import { parseHeadersFromEnv } from "../utils/headers";
import { determineBaseUrl } from "../utils/base-url";

type AnytypeSpace = {
  id?: string;
  name?: string;
  object?: string;
};

type ListSpacesResponse = {
  data?: AnytypeSpace[];
};

export type ListSpacesOptions = {
  login?: boolean;
};

export async function listSpaces(specPath?: string, options: ListSpacesOptions = {}): Promise<void> {
  const { spaces, credentials } = await fetchSpaces(specPath, options);

  if (spaces.length === 0) {
    console.log("No accessible spaces found.");
    if (credentials) {
      displayCredentialsInstructions(credentials);
    }
    return;
  }

  if (credentials) {
    console.log("Authenticated successfully!");
  }

  console.log("Accessible Anytype spaces:\n");
  console.log(formatSpacesTable(spaces));
  console.log("\nUse the ID with --allow-space or --allow-channel.");

  if (credentials) {
    displayCredentialsInstructions(credentials);
  }
}

export async function fetchSpaces(
  specPath?: string,
  options: ListSpacesOptions = {},
): Promise<{ spaces: AnytypeSpace[]; credentials?: AnytypeCredentials }> {
  const openApiSpec = await loadOpenApiSpec(specPath);
  const baseUrl = determineBaseUrl(openApiSpec);
  const operation = openApiSpec.paths?.["/v1/spaces"]?.get;

  if (!operation) {
    throw new Error("The OpenAPI specification does not expose GET /v1/spaces.");
  }

  const credentials = options.login ? await new ApiKeyGenerator(baseUrl).authenticate() : undefined;
  const httpClient = new HttpClient(
    {
      baseUrl,
      headers: credentials
        ? {
            Authorization: `Bearer ${credentials.apiKey}`,
            "Anytype-Version": credentials.anytypeVersion,
          }
        : parseHeadersFromEnv(),
    },
    openApiSpec,
  );

  const response = await httpClient.executeOperation(
    {
      ...operation,
      method: "get",
      path: "/v1/spaces",
    },
    {},
  );

  const data = response.data as ListSpacesResponse;
  return {
    spaces: Array.isArray(data?.data) ? data.data : [],
    ...(credentials ? { credentials } : {}),
  };
}

export function formatSpacesTable(spaces: AnytypeSpace[]): string {
  const rows = spaces.map((space) => ({
    id: space.id ?? "",
    type: space.object ?? "",
    name: space.name ?? "",
  }));

  const headers = { id: "ID", type: "TYPE", name: "NAME" };
  const idWidth = Math.max(headers.id.length, ...rows.map((row) => row.id.length));
  const typeWidth = Math.max(headers.type.length, ...rows.map((row) => row.type.length));

  const lines = [
    `${headers.id.padEnd(idWidth)}  ${headers.type.padEnd(typeWidth)}  ${headers.name}`,
    `${"-".repeat(idWidth)}  ${"-".repeat(typeWidth)}  ${"-".repeat(headers.name.length)}`,
    ...rows.map((row) => `${row.id.padEnd(idWidth)}  ${row.type.padEnd(typeWidth)}  ${row.name}`),
  ];

  return lines.join("\n");
}
