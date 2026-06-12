import { AccessPolicyConfig } from "../mcp/access-policy";

export type ParsedCliArgs = {
  command: "run" | "get-key" | "list-spaces";
  specPath?: string;
  showHelp: boolean;
  login: boolean;
  configure: boolean;
  accessPolicy: AccessPolicyConfig;
};

const HELP_TEXT = `Usage:
  anytype-mcp [options]
  anytype-mcp run [spec-path] [options]
  anytype-mcp get-key [spec-path]
  anytype-mcp list-spaces [spec-path]

Options:
  --allow-space <space_id>     Restrict MCP access to this Anytype space ID
  --allow-channel <space_id>   Alias for --allow-space (Anytype chat channels are spaces)
  --login                      For list-spaces: run the interactive Anytype login flow first
  --configure                  For list-spaces: choose spaces and print MCP config JSON
  -h, --help                   Show this help text

Authentication:
  Set ANYTYPE_API_KEY and ANYTYPE_API_VERSION
  or OPENAPI_MCP_HEADERS='{"Authorization":"Bearer ...","Anytype-Version":"..."}'

Examples:
  anytype-mcp --allow-space space_abc123
  anytype-mcp run ./openapi.json --allow-space space_abc123 --allow-space space_def456
  anytype-mcp get-key
  anytype-mcp list-spaces
  anytype-mcp list-spaces --login --configure`;

export function parseCliArgs(args: string[]): ParsedCliArgs {
  const normalizedArgs = [...args];
  let command: ParsedCliArgs["command"] = "run";

  if (normalizedArgs[0] === "run" || normalizedArgs[0] === "get-key" || normalizedArgs[0] === "list-spaces") {
    command = normalizedArgs.shift() as ParsedCliArgs["command"];
  } else if (normalizedArgs[0] && !normalizedArgs[0].startsWith("-")) {
    throw new Error(`Unknown command "${normalizedArgs[0]}"`);
  }

  let specPath: string | undefined;
  let showHelp = false;
  let login = false;
  let configure = false;
  const allowedSpaceIds: string[] = [];

  for (let index = 0; index < normalizedArgs.length; index += 1) {
    const arg = normalizedArgs[index]!;

    if (arg === "-h" || arg === "--help") {
      showHelp = true;
      continue;
    }

    if (arg === "--login") {
      login = true;
      continue;
    }

    if (arg === "--configure") {
      configure = true;
      continue;
    }

    if (arg.startsWith("--allow-space=")) {
      allowedSpaceIds.push(arg.slice("--allow-space=".length));
      continue;
    }

    if (arg.startsWith("--allow-channel=")) {
      allowedSpaceIds.push(arg.slice("--allow-channel=".length));
      continue;
    }

    if (arg === "--allow-space" || arg === "--allow-channel") {
      const value = normalizedArgs[index + 1];
      if (!value || value.startsWith("-")) {
        throw new Error(`Missing value for ${arg}`);
      }
      allowedSpaceIds.push(value);
      index += 1;
      continue;
    }

    if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    }

    if (!specPath) {
      specPath = arg;
      continue;
    }

    throw new Error(`Unexpected positional argument: ${arg}`);
  }

  if ((command === "get-key" || command === "list-spaces") && allowedSpaceIds.length > 0) {
    throw new Error("--allow-space and --allow-channel can only be used when running the MCP server.");
  }

  if (command !== "list-spaces" && login) {
    throw new Error("--login can only be used with list-spaces.");
  }

  if (command !== "list-spaces" && configure) {
    throw new Error("--configure can only be used with list-spaces.");
  }

  return {
    command,
    specPath,
    showHelp,
    login,
    configure,
    accessPolicy: {
      allowedSpaceIds,
    },
  };
}

export function formatCliHelp(): string {
  return HELP_TEXT;
}
