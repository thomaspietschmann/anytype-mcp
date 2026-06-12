import { OpenAPIV3 } from "openapi-types";
import { Headers } from "node-fetch";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiKeyGenerator } from "../../auth/get-key";
import { HttpClient } from "../../client/http-client";
import { fetchSpaces, formatSpacesTable } from "../list-spaces";

vi.mock("../../auth/get-key");
vi.mock("../../client/http-client");
vi.mock("../../init-server");
vi.mock("../../utils/base-url");

describe("list-spaces bootstrap", () => {
  const sampleSpec: OpenAPIV3.Document = {
    openapi: "3.0.0",
    info: { title: "Anytype API", version: "1.0.0" },
    servers: [{ url: "http://localhost:31009" }],
    paths: {
      "/v1/spaces": {
        get: {
          operationId: "list_spaces",
          responses: {
            "200": { description: "OK" },
          },
        },
      },
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const initServer = await import("../../init-server");
    const baseUrl = await import("../../utils/base-url");
    vi.mocked(initServer.loadOpenApiSpec).mockResolvedValue(sampleSpec);
    vi.mocked(baseUrl.determineBaseUrl).mockReturnValue("http://localhost:31009");
  });

  it("fetches spaces through the Anytype API", async () => {
    (HttpClient.prototype.executeOperation as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        data: [
          { id: "space-1", name: "Alpha", object: "space" },
          { id: "space-2", name: "Team Chat", object: "chat" },
        ],
      },
      status: 200,
      headers: new Headers(),
    });

    const result = await fetchSpaces();

    expect(result).toEqual({
      spaces: [
        { id: "space-1", name: "Alpha", object: "space" },
        { id: "space-2", name: "Team Chat", object: "chat" },
      ],
    });
    expect(HttpClient.prototype.executeOperation).toHaveBeenCalledWith(
      expect.objectContaining({ operationId: "list_spaces", method: "get", path: "/v1/spaces" }),
      {},
    );
  });

  it("fails clearly when the spec does not expose list spaces", async () => {
    const initServer = await import("../../init-server");
    vi.mocked(initServer.loadOpenApiSpec).mockResolvedValue({
      ...sampleSpec,
      paths: {},
    });

    await expect(fetchSpaces()).rejects.toThrow("The OpenAPI specification does not expose GET /v1/spaces.");
  });

  it("can authenticate first when --login is requested", async () => {
    vi.mocked(ApiKeyGenerator.prototype.authenticate).mockResolvedValue({
      apiKey: "token123",
      anytypeVersion: "2025-11-08",
    });
    (HttpClient.prototype.executeOperation as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        data: [{ id: "space-1", name: "Alpha", object: "space" }],
      },
      status: 200,
      headers: new Headers(),
    });

    const result = await fetchSpaces(undefined, { login: true });

    expect(result).toEqual({
      spaces: [{ id: "space-1", name: "Alpha", object: "space" }],
      credentials: { apiKey: "token123", anytypeVersion: "2025-11-08" },
    });
    expect(ApiKeyGenerator.prototype.authenticate).toHaveBeenCalled();
    expect(HttpClient).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: {
          Authorization: "Bearer token123",
          "Anytype-Version": "2025-11-08",
        },
      }),
      expect.anything(),
    );
  });

  it("formats a readable table", () => {
    expect(
      formatSpacesTable([
        { id: "space-1", name: "Alpha", object: "space" },
        { id: "space-22", name: "Team Chat", object: "chat" },
      ]),
    ).toBe(
      ["ID        TYPE   NAME", "--------  -----  ----", "space-1   space  Alpha", "space-22  chat   Team Chat"].join(
        "\n",
      ),
    );
  });
});
