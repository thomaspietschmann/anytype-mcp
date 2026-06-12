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

export async function listSpaces(specPath?: string): Promise<void> {
  const spaces = await fetchSpaces(specPath);

  if (spaces.length === 0) {
    console.log("No accessible spaces found.");
    return;
  }

  console.log("Accessible Anytype spaces:\n");
  console.log(formatSpacesTable(spaces));
  console.log("\nUse the ID with --allow-space or --allow-channel.");
}

export async function fetchSpaces(specPath?: string): Promise<AnytypeSpace[]> {
  const openApiSpec = await loadOpenApiSpec(specPath);
  const baseUrl = determineBaseUrl(openApiSpec);
  const operation = openApiSpec.paths?.["/v1/spaces"]?.get;

  if (!operation) {
    throw new Error("The OpenAPI specification does not expose GET /v1/spaces.");
  }

  const httpClient = new HttpClient(
    {
      baseUrl,
      headers: parseHeadersFromEnv(),
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
  return Array.isArray(data?.data) ? data.data : [];
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
