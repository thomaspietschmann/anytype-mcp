import path from "node:path";
import * as readline from "readline";
import { ApiKeyGenerator, displayCredentialsInstructions, type AnytypeCredentials } from "../auth/get-key";
import { HttpClient } from "../client/http-client";
import { loadOpenApiSpec } from "../init-server";
import { getCredentialsFromEnv, parseHeadersFromEnv } from "../utils/headers";
import { determineBaseUrl } from "../utils/base-url";

export type AnytypeSpace = {
  id?: string;
  name?: string;
  object?: string;
};

type ListSpacesResponse = {
  data?: AnytypeSpace[];
};

export type ListSpacesOptions = {
  login?: boolean;
  configure?: boolean;
};

type SpaceSelectionState = {
  cursor: number;
  selected: Set<number>;
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

  if (options.configure) {
    const configCredentials = credentials ?? getCredentialsFromEnv();
    const selectedSpaces = await selectSpacesInteractively(spaces);

    if (selectedSpaces.length === 0) {
      console.log("\nNo spaces selected. Skipping MCP config output.");
    } else {
      console.log("\nSelected spaces:");
      selectedSpaces.forEach((space) => {
        console.log(`- ${space.name ?? "(unnamed)"}: ${space.id ?? "<missing id>"}`);
      });
      console.log("\nCopy-paste MCP config JSON:\n");
      console.log(JSON.stringify(buildMcpConfig(selectedSpaces, configCredentials ?? undefined), null, 2));
    }
  } else {
    console.log(formatSpacesTable(spaces));
    console.log("\nUse the ID with --allow-space or --allow-channel.");
  }

  if (credentials) {
    displayCredentialsInstructions(credentials, { includeMcpConfig: !options.configure });
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

export function renderSpaceCheckboxList(spaces: AnytypeSpace[], state: SpaceSelectionState): string {
  const lines = [
    "Use Up/Down to move, Space to toggle, Enter to confirm, A to toggle all, Q to cancel.\n",
  ];

  spaces.forEach((space, index) => {
    const prefix = state.cursor === index ? ">" : " ";
    const checkbox = state.selected.has(index) ? "[x]" : "[ ]";
    const name = space.name ?? "(unnamed)";
    const type = space.object ?? "unknown";
    const id = space.id ?? "";
    lines.push(`${prefix} ${checkbox} ${name} (${type})`);
    lines.push(`    ${id}`);
  });

  return lines.join("\n");
}

export function buildMcpConfig(
  spaces: AnytypeSpace[],
  credentials?: { apiKey: string; anytypeVersion?: string },
  cwd: string = process.cwd(),
): Record<string, unknown> {
  return {
    mcpServers: {
      anytype: {
        command: path.resolve(cwd, "node_modules/.bin/tsx"),
        args: [
          path.resolve(cwd, "scripts/start-server.ts"),
          ...spaces.flatMap((space) => (space.id ? ["--allow-space", space.id] : [])),
        ],
        env: {
          ANYTYPE_API_KEY: credentials?.apiKey ?? "<YOUR_API_KEY>",
          ANYTYPE_API_VERSION: credentials?.anytypeVersion ?? "<YOUR_ANYTYPE_VERSION>",
        },
      },
    },
  };
}

async function selectSpacesInteractively(spaces: AnytypeSpace[]): Promise<AnytypeSpace[]> {
  if (!process.stdin.isTTY || !process.stdout.isTTY || typeof process.stdin.setRawMode !== "function") {
    throw new Error("--configure requires an interactive terminal.");
  }

  return await new Promise<AnytypeSpace[]>((resolve, reject) => {
    const state: SpaceSelectionState = {
      cursor: 0,
      selected: new Set<number>(),
    };
    const previousRawMode = process.stdin.isRaw;

    readline.emitKeypressEvents(process.stdin);
    process.stdin.resume();
    process.stdin.setRawMode(true);

    const cleanup = () => {
      process.stdin.setRawMode(previousRawMode);
      process.stdin.off("keypress", onKeypress);
      process.stdin.pause();
      readline.cursorTo(process.stdout, 0, 0);
      readline.clearScreenDown(process.stdout);
    };

    const render = () => {
      readline.cursorTo(process.stdout, 0, 0);
      readline.clearScreenDown(process.stdout);
      process.stdout.write(renderSpaceCheckboxList(spaces, state));
    };

    const onKeypress = (_str: string, key: { name?: string; ctrl?: boolean }) => {
      if (key.ctrl && key.name === "c") {
        cleanup();
        reject(new Error("Space selection cancelled."));
        return;
      }

      switch (key.name) {
        case "up":
          state.cursor = state.cursor === 0 ? spaces.length - 1 : state.cursor - 1;
          render();
          return;
        case "down":
          state.cursor = state.cursor === spaces.length - 1 ? 0 : state.cursor + 1;
          render();
          return;
        case "space":
          toggleSelection(state.selected, state.cursor);
          render();
          return;
        case "return":
          cleanup();
          process.stdout.write("\n");
          resolve([...state.selected].sort((left, right) => left - right).map((index) => spaces[index]!));
          return;
        case "q":
        case "escape":
          cleanup();
          process.stdout.write("\n");
          resolve([]);
          return;
        default:
          break;
      }

      if (key.name === "a") {
        if (state.selected.size === spaces.length) {
          state.selected.clear();
        } else {
          spaces.forEach((_space, index) => state.selected.add(index));
        }
        render();
      }
    };

    process.stdin.on("keypress", onKeypress);
    render();
  });
}

function toggleSelection(selected: Set<number>, index: number): void {
  if (selected.has(index)) {
    selected.delete(index);
  } else {
    selected.add(index);
  }
}
