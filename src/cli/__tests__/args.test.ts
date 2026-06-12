import { describe, expect, it } from "vitest";
import { formatCliHelp, parseCliArgs } from "../args";

describe("parseCliArgs", () => {
  it("defaults to run without arguments", () => {
    expect(parseCliArgs([])).toEqual({
      command: "run",
      specPath: undefined,
      showHelp: false,
      accessPolicy: { allowedSpaceIds: [] },
    });
  });

  it("parses run restrictions from repeated flags and aliases", () => {
    expect(parseCliArgs(["run", "--allow-space", "space-1", "--allow-channel=space-2"])).toEqual({
      command: "run",
      specPath: undefined,
      showHelp: false,
      accessPolicy: { allowedSpaceIds: ["space-1", "space-2"] },
    });
  });

  it("rejects unknown commands to preserve CLI compatibility", () => {
    expect(() => parseCliArgs(["./openapi.json"])).toThrow('Unknown command "./openapi.json"');
  });

  it("parses get-key with a spec path", () => {
    expect(parseCliArgs(["get-key", "./openapi.json"])).toEqual({
      command: "get-key",
      specPath: "./openapi.json",
      showHelp: false,
      accessPolicy: { allowedSpaceIds: [] },
    });
  });

  it("parses list-spaces with a spec path", () => {
    expect(parseCliArgs(["list-spaces", "./openapi.json"])).toEqual({
      command: "list-spaces",
      specPath: "./openapi.json",
      showHelp: false,
      accessPolicy: { allowedSpaceIds: [] },
    });
  });

  it("rejects allow-space flags for get-key", () => {
    expect(() => parseCliArgs(["get-key", "--allow-space", "space-1"])).toThrow(
      "--allow-space and --allow-channel can only be used when running the MCP server.",
    );
  });

  it("rejects allow-space flags for list-spaces", () => {
    expect(() => parseCliArgs(["list-spaces", "--allow-space", "space-1"])).toThrow(
      "--allow-space and --allow-channel can only be used when running the MCP server.",
    );
  });

  it("returns help text", () => {
    expect(formatCliHelp()).toContain("--allow-space");
  });
});
